import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  EVENT_BUS,
  IEventBus,
  JwtPayload,
  KeyResultMetricType,
  KeyResultStatus,
  ObjectiveLevel,
} from '@sentient/shared';

import { Decimal } from '../../../generated/prisma/runtime/library';
import {
  KeyResult,
  KeyResultMetricType as PrismaKeyResultMetricType,
  KeyResultStatus as PrismaKeyResultStatus,
  Prisma,
} from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateKeyResultDto } from '../dto/key-results/create-key-result.dto';
import { UpdateKeyResultDto } from '../dto/key-results/update-key-result.dto';
import { KeyResultResponseDto } from '../dto/response/key-result-response.dto';
import { computeScore } from '../util/kr-score.util';
import { canEditObjective } from '../util/okr-rbac.util';
import { appendKrStatusHistory } from '../util/kr-status-history.util';

export interface KeyResultListResult {
  items: KeyResultResponseDto[];
}

@Injectable()
export class KeyResultsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async create(dto: CreateKeyResultDto, user: JwtPayload): Promise<KeyResultResponseDto> {
    const objective = await this.prisma.objective.findUnique({ where: { id: dto.objectiveId } });
    if (!objective || objective.status !== 'ACTIVE') {
      throw new BadRequestException('ObjectiveNotActive');
    }

    if (!canEditObjective(user, objective.level as unknown as ObjectiveLevel, objective.departmentId, objective.ownerId)) {
      throw new ForbiddenException('Insufficient permissions to add Key Results to this Objective');
    }

    const targetDecimal = new Decimal(dto.targetValue);

    if (dto.metricType === KeyResultMetricType.BOOLEAN) {
      if (!targetDecimal.equals(1)) {
        throw new BadRequestException('BooleanTargetMustBeOne');
      }
    } else {
      if (targetDecimal.lessThanOrEqualTo(0)) {
        throw new BadRequestException('TargetMustBePositive');
      }
    }

    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      const activeCount = await this.prisma.employee.count({
        where: { id: { in: dto.assigneeIds }, employmentStatus: 'ACTIVE' },
      });
      if (activeCount !== dto.assigneeIds.length) {
        throw new BadRequestException('AssigneeNotFound');
      }
    }

    const kr = await this.prisma.keyResult.create({
      data: {
        objectiveId: dto.objectiveId,
        title: dto.title,
        metricType: dto.metricType as unknown as PrismaKeyResultMetricType,
        targetValue: dto.targetValue,
        currentValue: '0',
        unit: dto.unit,
        score: '0',
        assigneeIds: dto.assigneeIds ?? [],
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: PrismaKeyResultStatus.ON_TRACK,
      },
    });

    return this.toDto(kr);
  }

  async update(id: string, dto: UpdateKeyResultDto, user: JwtPayload): Promise<KeyResultResponseDto> {
    const kr = await this.prisma.keyResult.findUnique({
      where: { id },
      include: { objective: true },
    });
    if (!kr) throw new NotFoundException('Key Result not found');

    const { objective } = kr;
    if (!canEditObjective(user, objective.level as unknown as ObjectiveLevel, objective.departmentId, objective.ownerId)) {
      throw new ForbiddenException('Insufficient permissions to edit this Key Result');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.KeyResultUpdateInput = {};

      if (dto.title !== undefined) data.title = dto.title;
      if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      if (dto.assigneeIds !== undefined) {
        data.assigneeIds = { set: dto.assigneeIds };
      }

      if (dto.targetValue !== undefined) {
        data.targetValue = dto.targetValue;
        const newTarget = new Decimal(dto.targetValue);
        const newScore = computeScore(
          kr.metricType as unknown as KeyResultMetricType,
          kr.currentValue,
          newTarget,
        );
        data.score = newScore.toString();
      }

      if (dto.status !== undefined) {
        const fromStatus = kr.status as unknown as KeyResultStatus;
        const toStatus = dto.status;
        data.status = dto.status as unknown as PrismaKeyResultStatus;

        await appendKrStatusHistory(tx, {
          keyResultId: id,
          fromStatus,
          toStatus,
          changedById: user.sub,
        });
      }

      return tx.keyResult.update({ where: { id }, data });
    });

    return this.toDto(updated);
  }

  async listByObjective(objectiveId: string, user: JwtPayload): Promise<KeyResultListResult> {
    const objective = await this.prisma.objective.findUnique({ where: { id: objectiveId } });
    if (!objective) throw new NotFoundException('Objective not found');

    const krs = await this.prisma.keyResult.findMany({
      where: { objectiveId },
      orderBy: { createdAt: 'asc' },
    });

    return { items: krs.map((kr) => this.toDto(kr)) };
  }

  toDto(kr: KeyResult): KeyResultResponseDto {
    const dto = new KeyResultResponseDto();
    dto.id = kr.id;
    dto.objectiveId = kr.objectiveId;
    dto.title = kr.title;
    dto.metricType = kr.metricType as unknown as KeyResultMetricType;
    dto.targetValue = kr.targetValue.toString();
    dto.currentValue = kr.currentValue.toString();
    dto.unit = kr.unit;
    dto.score = kr.score.toString();
    dto.assigneeIds = kr.assigneeIds;
    dto.dueDate = kr.dueDate instanceof Date ? kr.dueDate.toISOString().slice(0, 10) : null;
    dto.status = kr.status as unknown as KeyResultStatus;
    dto.isAtRisk =
      Number(kr.score) < 0.3 &&
      kr.status !== PrismaKeyResultStatus.ACHIEVED &&
      kr.status !== PrismaKeyResultStatus.CANCELLED;
    dto.createdAt = kr.createdAt.toISOString();
    dto.updatedAt = kr.updatedAt.toISOString();
    return dto;
  }
}
