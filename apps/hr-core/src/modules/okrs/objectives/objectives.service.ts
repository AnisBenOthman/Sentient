import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  DomainEvent,
  EVENT_BUS,
  IEventBus,
  JwtPayload,
  KeyResultStatus,
  ObjectiveLevel,
  ObjectiveStatus,
} from '@sentient/shared';

import {
  Objective,
  ObjectiveLevel as PrismaObjectiveLevel,
  ObjectiveStatus as PrismaObjectiveStatus,
  Prisma,
} from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateObjectiveDto } from '../dto/objectives/create-objective.dto';
import { ObjectiveQueryDto } from '../dto/objectives/objective-query.dto';
import { UpdateObjectiveDto } from '../dto/objectives/update-objective.dto';
import { KeyResultResponseDto } from '../dto/response/key-result-response.dto';
import { ObjectiveResponseDto } from '../dto/response/objective-response.dto';
import { canCreateObjective, canEditObjective } from '../util/okr-rbac.util';
import { appendKrStatusHistory } from '../util/kr-status-history.util';

export interface ObjectiveListResult {
  items: ObjectiveResponseDto[];
  nextCursor: string | null;
}

export interface ObjectiveAlignment {
  parent: { id: string; title: string; level: string } | null;
  children: { id: string; title: string; level: string; ownerId: string | null }[];
}

export interface ObjectiveDetailResult {
  objective: ObjectiveResponseDto;
  keyResults: KeyResultResponseDto[];
  alignment: ObjectiveAlignment;
}

interface CursorPayload {
  createdAt: string;
  id: string;
}

@Injectable()
export class ObjectivesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async create(dto: CreateObjectiveDto, user: JwtPayload): Promise<ObjectiveResponseDto> {
    if (!canCreateObjective(user, dto.level, dto.departmentId, dto.ownerId)) {
      throw new ForbiddenException('Insufficient permissions to create this Objective');
    }

    const cycle = await this.prisma.okrCycle.findUnique({ where: { id: dto.cycleId } });
    if (!cycle || cycle.status !== 'ACTIVE') {
      throw new BadRequestException('CycleNotActive');
    }

    if (dto.level !== ObjectiveLevel.COMPANY) {
      if (!dto.parentObjectiveId) throw new BadRequestException('LevelMismatch');

      const parent = await this.prisma.objective.findUnique({ where: { id: dto.parentObjectiveId } });
      if (!parent) throw new BadRequestException('ParentNotFound');
      if (parent.status !== PrismaObjectiveStatus.ACTIVE) throw new BadRequestException('ParentNotActive');

      const expectedParentLevel =
        dto.level === ObjectiveLevel.DEPARTMENT
          ? PrismaObjectiveLevel.COMPANY
          : PrismaObjectiveLevel.DEPARTMENT;

      if (parent.level !== expectedParentLevel) throw new BadRequestException('ParentWrongLevel');

      if (dto.level === ObjectiveLevel.DEPARTMENT) {
        if (!dto.departmentId) throw new BadRequestException('LevelMismatch');
      }

      if (dto.level === ObjectiveLevel.EMPLOYEE) {
        if (!dto.ownerId) throw new BadRequestException('LevelMismatch');

        let employeeDeptId: string | null = null;
        const employee = await this.prisma.employee.findUnique({
          where: { id: dto.ownerId },
          select: { departmentId: true },
        });
        employeeDeptId = employee?.departmentId ?? null;

        if (parent.departmentId && employeeDeptId && parent.departmentId !== employeeDeptId) {
          throw new BadRequestException('CrossDepartmentAlignment');
        }
      }
    }

    const createdDepartmentId =
      dto.level === ObjectiveLevel.EMPLOYEE && dto.ownerId
        ? (
            await this.prisma.employee.findUnique({
              where: { id: dto.ownerId },
              select: { departmentId: true },
            })
          )?.departmentId ?? dto.departmentId ?? null
        : dto.departmentId ?? null;

    const objective = await this.prisma.objective.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        level: dto.level as unknown as PrismaObjectiveLevel,
        cycleId: dto.cycleId,
        parentObjectiveId: dto.parentObjectiveId ?? null,
        ownerId: dto.ownerId ?? null,
        departmentId: createdDepartmentId,
        createdById: user.sub,
        status: PrismaObjectiveStatus.DRAFT,
      },
    });

    if (dto.level === ObjectiveLevel.EMPLOYEE && dto.ownerId) {
      await this.eventBus.emit<Record<string, unknown>>({
        id: randomUUID(),
        type: 'okr.objective_created',
        source: 'HR_CORE',
        timestamp: new Date(),
        payload: {
          objectiveId: objective.id,
          level: 'EMPLOYEE',
          cycleId: objective.cycleId,
          ownerId: objective.ownerId,
          departmentId: objective.departmentId,
          parentObjectiveId: objective.parentObjectiveId,
        },
        metadata: { userId: user.sub, correlationId: randomUUID() },
      } satisfies DomainEvent<Record<string, unknown>>);
    }

    return this.toDto(objective);
  }

  async list(query: ObjectiveQueryDto, user: JwtPayload): Promise<ObjectiveListResult> {
    const limit = query.limit ?? 50;
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;

    const scopeFilter = this.buildScopeFilter(user);
    const filters: Prisma.ObjectiveWhereInput[] = [scopeFilter];

    if (query.cycleId) filters.push({ cycleId: query.cycleId });
    if (query.level) filters.push({ level: query.level as unknown as PrismaObjectiveLevel });
    if (query.departmentId) filters.push({ departmentId: query.departmentId });
    if (query.ownerId) filters.push({ ownerId: query.ownerId });
    if (query.status) {
      filters.push({ status: query.status as unknown as PrismaObjectiveStatus });
    } else {
      filters.push({ status: { not: PrismaObjectiveStatus.CANCELLED } });
    }

    if (cursor) {
      filters.push({
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ],
      });
    }

    const rows = await this.prisma.objective.findMany({
      where: { AND: filters },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((r) => this.toDto(r)),
      nextCursor: rows.length > limit && last ? this.encodeCursor(last) : null,
    };
  }

  async findOneWithKrsAndAlignment(id: string, user: JwtPayload): Promise<ObjectiveDetailResult> {
    const scopeFilter = this.buildScopeFilter(user);

    const objective = await this.prisma.objective.findFirst({
      where: { id, AND: [scopeFilter] },
      include: {
        keyResults: true,
        parentObjective: { select: { id: true, title: true, level: true } },
        childObjectives: { select: { id: true, title: true, level: true, ownerId: true } },
      },
    });

    if (!objective) throw new NotFoundException('Objective not found');

    const krDtos = objective.keyResults.map((kr) => {
      const dto = new KeyResultResponseDto();
      dto.id = kr.id;
      dto.objectiveId = kr.objectiveId;
      dto.title = kr.title;
      dto.metricType = kr.metricType as unknown as KeyResultResponseDto['metricType'];
      dto.targetValue = kr.targetValue.toString();
      dto.currentValue = kr.currentValue.toString();
      dto.unit = kr.unit;
      dto.score = kr.score.toString();
      dto.assigneeIds = kr.assigneeIds;
      dto.dueDate = kr.dueDate instanceof Date ? kr.dueDate.toISOString().slice(0, 10) : null;
      dto.status = kr.status as unknown as KeyResultResponseDto['status'];
      dto.isAtRisk = Number(kr.score) < 0.3 && kr.status !== 'ACHIEVED' && kr.status !== 'CANCELLED';
      dto.createdAt = kr.createdAt.toISOString();
      dto.updatedAt = kr.updatedAt.toISOString();
      return dto;
    });

    return {
      objective: this.toDto(objective),
      keyResults: krDtos,
      alignment: {
        parent: objective.parentObjective
          ? {
              id: objective.parentObjective.id,
              title: objective.parentObjective.title,
              level: objective.parentObjective.level,
            }
          : null,
        children: objective.childObjectives.map((c) => ({
          id: c.id,
          title: c.title,
          level: c.level,
          ownerId: c.ownerId,
        })),
      },
    };
  }

  async update(id: string, dto: UpdateObjectiveDto, user: JwtPayload): Promise<ObjectiveResponseDto> {
    const objective = await this.prisma.objective.findUnique({ where: { id } });
    if (!objective) throw new NotFoundException('Objective not found');

    if (!canEditObjective(user, objective.level as unknown as ObjectiveLevel, objective.departmentId, objective.ownerId)) {
      throw new ForbiddenException('Insufficient permissions to edit this Objective');
    }

    const now = new Date();
    const data: Prisma.ObjectiveUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;

    if (dto.status !== undefined) {
      data.status = dto.status as unknown as PrismaObjectiveStatus;
      if (dto.status === ObjectiveStatus.ACTIVE) {
        data.activatedAt = now;
        data.activatedBy = { connect: { id: user.sub } };
      } else if (dto.status === ObjectiveStatus.CLOSED) {
        data.closedAt = now;
        data.closedBy = { connect: { id: user.sub } };
      } else if (dto.status === ObjectiveStatus.CANCELLED) {
        data.cancelledAt = now;
        data.cancelledBy = { connect: { id: user.sub } };
      }
    }

    const updated = await this.prisma.objective.update({ where: { id }, data });

    if (dto.status === ObjectiveStatus.CLOSED) {
      await this.eventBus.emit<Record<string, unknown>>({
        id: randomUUID(),
        type: 'okr.objective_closed',
        source: 'HR_CORE',
        timestamp: new Date(),
        payload: {
          objectiveId: updated.id,
          level: updated.level,
          ownerId: updated.ownerId,
          departmentId: updated.departmentId,
          finalScore: '0',
        },
        metadata: { userId: user.sub, correlationId: randomUUID() },
      } satisfies DomainEvent<Record<string, unknown>>);
    }

    return this.toDto(updated);
  }

  async softDelete(id: string, user: JwtPayload): Promise<void> {
    const objective = await this.prisma.objective.findUnique({ where: { id } });
    if (!objective) throw new NotFoundException('Objective not found');

    if (!canEditObjective(user, objective.level as unknown as ObjectiveLevel, objective.departmentId, objective.ownerId)) {
      throw new ForbiddenException('Insufficient permissions to delete this Objective');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const krs = await tx.keyResult.findMany({
        where: { objectiveId: id, status: { not: 'CANCELLED' } },
        select: { id: true, status: true },
      });

      for (const kr of krs) {
        await appendKrStatusHistory(tx, {
          keyResultId: kr.id,
          fromStatus: kr.status as unknown as KeyResultStatus,
          toStatus: KeyResultStatus.CANCELLED,
          changedById: null,
          reason: 'Objective cancelled',
        });
      }

      if (krs.length > 0) {
        await tx.keyResult.updateMany({
          where: { objectiveId: id },
          data: { status: 'CANCELLED' },
        });

        await tx.okrCheckIn.updateMany({
          where: {
            status: 'PENDING',
            keyResultId: { in: krs.map((k) => k.id) },
          },
          data: {
            status: 'REJECTED',
            rejectionReason: 'Objective cancelled',
            reviewedAt: now,
            reviewedById: null,
          },
        });
      }

      await tx.objective.update({
        where: { id },
        data: {
          status: PrismaObjectiveStatus.CANCELLED,
          cancelledAt: now,
          cancelledById: user.sub,
        },
      });
    });
  }

  private buildScopeFilter(user: JwtPayload): Prisma.ObjectiveWhereInput {
    if (user.roles.includes('HR_ADMIN') || user.roles.includes('EXECUTIVE')) {
      return {};
    }
    if (user.roles.includes('MANAGER')) {
      return {
        OR: [
          { level: PrismaObjectiveLevel.COMPANY },
          { level: PrismaObjectiveLevel.DEPARTMENT, departmentId: user.departmentId },
          { level: PrismaObjectiveLevel.EMPLOYEE, departmentId: user.departmentId },
        ],
      };
    }
    return {
      OR: [
        { level: PrismaObjectiveLevel.COMPANY },
        { level: PrismaObjectiveLevel.DEPARTMENT, departmentId: user.departmentId },
        { level: PrismaObjectiveLevel.EMPLOYEE, ownerId: user.sub },
      ],
    };
  }

  toDto(objective: Objective): ObjectiveResponseDto {
    const dto = new ObjectiveResponseDto();
    dto.id = objective.id;
    dto.title = objective.title;
    dto.description = objective.description;
    dto.level = objective.level as unknown as ObjectiveLevel;
    dto.cycleId = objective.cycleId;
    dto.parentObjectiveId = objective.parentObjectiveId;
    dto.ownerId = objective.ownerId;
    dto.departmentId = objective.departmentId;
    dto.status = objective.status as unknown as ObjectiveStatus;
    dto.createdById = objective.createdById;
    dto.closedAt = objective.closedAt?.toISOString() ?? null;
    dto.cancelledAt = objective.cancelledAt?.toISOString() ?? null;
    dto.createdAt = objective.createdAt.toISOString();
    dto.updatedAt = objective.updatedAt.toISOString();
    return dto;
  }

  private encodeCursor(objective: Objective): string {
    const payload: CursorPayload = { createdAt: objective.createdAt.toISOString(), id: objective.id };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'createdAt' in parsed &&
        'id' in parsed &&
        typeof (parsed as Record<string, unknown>).createdAt === 'string' &&
        typeof (parsed as Record<string, unknown>).id === 'string'
      ) {
        return parsed as CursorPayload;
      }
      return null;
    } catch {
      return null;
    }
  }
}
