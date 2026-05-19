import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  DomainEvent,
  EVENT_BUS,
  IEventBus,
  JwtPayload,
  KeyResultMetricType,
  KeyResultStatus,
  OkrCheckInStatus,
  ObjectiveLevel,
} from '@sentient/shared';

import { Decimal } from '../../../generated/prisma/runtime/library';
import {
  OkrCheckIn,
  OkrCheckInStatus as PrismaOkrCheckInStatus,
  KeyResultStatus as PrismaKeyResultStatus,
  Prisma,
} from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { RejectCheckInDto } from '../dto/check-ins/reject-check-in.dto';
import { SubmitCheckInDto } from '../dto/check-ins/submit-check-in.dto';
import { OkrCheckInResponseDto } from '../dto/response/okr-check-in-response.dto';
import { computeScore } from '../util/kr-score.util';
import { canApproveCheckIn } from '../util/okr-rbac.util';
import { appendKrStatusHistory } from '../util/kr-status-history.util';

export interface CheckInListResult {
  items: OkrCheckInResponseDto[];
}

@Injectable()
export class OkrCheckInsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async submit(dto: SubmitCheckInDto, user: JwtPayload): Promise<OkrCheckInResponseDto> {
    const kr = await this.prisma.keyResult.findUnique({
      where: { id: dto.keyResultId },
      include: { objective: { include: { cycle: true } } },
    });

    if (!kr) throw new BadRequestException('KrNotFound');

    if (
      kr.status === PrismaKeyResultStatus.CANCELLED ||
      kr.objective.status !== 'ACTIVE' ||
      kr.objective.cycle.status !== 'ACTIVE'
    ) {
      throw new BadRequestException('KrNotActive');
    }

    if (!user.employeeId || !kr.assigneeIds.includes(user.employeeId)) {
      throw new BadRequestException('NotAssigned');
    }

    const valueDecimal = new Decimal(dto.value);

    if (kr.metricType === 'BOOLEAN') {
      if (!valueDecimal.equals(0) && !valueDecimal.equals(1)) {
        throw new BadRequestException('BooleanValueInvalid');
      }
    }

    const score = computeScore(
      kr.metricType as unknown as KeyResultMetricType,
      valueDecimal,
      kr.targetValue,
    );

    const isAutoApprove =
      kr.objective.level === 'EMPLOYEE' && kr.objective.ownerId === user.sub;

    const now = new Date();

    const checkIn = await this.prisma.$transaction(async (tx) => {
      const created = await tx.okrCheckIn.create({
        data: {
          keyResultId: dto.keyResultId,
          employeeId: user.employeeId ?? '',
          value: valueDecimal.toString(),
          score: score.toString(),
          comment: dto.comment ?? null,
          status: isAutoApprove ? PrismaOkrCheckInStatus.APPROVED : PrismaOkrCheckInStatus.PENDING,
          reviewedAt: isAutoApprove ? now : null,
          reviewedById: null,
        },
      });

      if (isAutoApprove) {
        const newScore = score;
        const scoreNum = newScore.toNumber();
        const newKrStatus =
          scoreNum >= 1 && kr.status !== PrismaKeyResultStatus.CANCELLED
            ? PrismaKeyResultStatus.ACHIEVED
            : undefined;

        const prevStatus = kr.status as unknown as KeyResultStatus;
        const krData: Parameters<typeof tx.keyResult.update>[0]['data'] = {
          currentValue: valueDecimal.toString(),
          score: newScore.toString(),
        };
        if (newKrStatus) {
          krData.status = newKrStatus;
          await appendKrStatusHistory(tx, {
            keyResultId: kr.id,
            fromStatus: prevStatus,
            toStatus: KeyResultStatus.ACHIEVED,
            changedById: null,
            reason: 'Score reached 1.0 on auto-approved check-in',
          });
        }

        await tx.keyResult.update({ where: { id: kr.id }, data: krData });
      }

      return created;
    });

    if (!isAutoApprove) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: user.employeeId },
        select: { firstName: true, lastName: true },
      });

      await this.eventBus.emit<Record<string, unknown>>({
        id: randomUUID(),
        type: 'okr.checkin_submitted',
        source: 'HR_CORE',
        timestamp: new Date(),
        payload: {
          checkInId: checkIn.id,
          keyResultId: kr.id,
          objectiveId: kr.objectiveId,
          departmentId: kr.objective.departmentId,
          submitterId: user.employeeId,
          submitterName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
          value: valueDecimal.toString(),
          score: score.toString(),
          keyResultTitle: kr.title,
        },
        metadata: { userId: user.sub, correlationId: randomUUID() },
      } satisfies DomainEvent<Record<string, unknown>>);
    }

    return this.toDto(checkIn);
  }

  async listByKeyResult(keyResultId: string, user: JwtPayload): Promise<CheckInListResult> {
    const kr = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
      include: { objective: true },
    });
    if (!kr) throw new NotFoundException('Key Result not found');

    let where: Prisma.OkrCheckInWhereInput = { keyResultId };

    if (!user.roles.includes('HR_ADMIN')) {
      if (user.roles.includes('MANAGER') || user.roles.includes('TEAM_LEAD')) {
        where = {
          keyResultId,
          OR: [
            ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
            { keyResult: { objective: { departmentId: user.departmentId ?? undefined } } },
          ],
        };
      } else {
        where = {
          keyResultId,
          OR: [
            ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
            ...(user.employeeId ? [{ keyResult: { assigneeIds: { has: user.employeeId } } }] : []),
          ],
        };
      }
    }

    const checkIns = await this.prisma.okrCheckIn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { items: checkIns.map((c) => this.toDto(c)) };
  }

  async approve(id: string, user: JwtPayload): Promise<OkrCheckInResponseDto> {
    const checkIn = await this.prisma.okrCheckIn.findUnique({
      where: { id },
      include: { keyResult: { include: { objective: true } } },
    });
    if (!checkIn) throw new NotFoundException('Check-in not found');

    if (checkIn.status !== PrismaOkrCheckInStatus.PENDING) {
      throw new ConflictException('CheckInNotPending');
    }

    const { objective } = checkIn.keyResult;

    if (!canApproveCheckIn(user, objective.departmentId)) {
      throw new ForbiddenException('WrongDepartment');
    }

    const now = new Date();
    const valueDecimal = checkIn.value;
    const scoreDecimal = new Decimal(checkIn.score.toString());

    const updated = await this.prisma.$transaction(async (tx) => {
      const approved = await tx.okrCheckIn.update({
        where: { id },
        data: {
          status: PrismaOkrCheckInStatus.APPROVED,
          reviewedById: user.sub,
          reviewedAt: now,
        },
      });

      const kr = checkIn.keyResult;
      const newScore = computeScore(
        kr.metricType as unknown as KeyResultMetricType,
        new Decimal(valueDecimal.toString()),
        kr.targetValue,
      );
      const scoreNum = newScore.toNumber();
      const newKrStatus =
        scoreNum >= 1 && kr.status !== PrismaKeyResultStatus.CANCELLED
          ? PrismaKeyResultStatus.ACHIEVED
          : undefined;

      const krData: Parameters<typeof tx.keyResult.update>[0]['data'] = {
        currentValue: valueDecimal.toString(),
        score: newScore.toString(),
      };

      if (newKrStatus) {
        krData.status = newKrStatus;
        await appendKrStatusHistory(tx, {
          keyResultId: kr.id,
          fromStatus: kr.status as unknown as KeyResultStatus,
          toStatus: KeyResultStatus.ACHIEVED,
          changedById: user.sub,
          reason: 'Score reached 1.0 on check-in approval',
        });
      }

      await tx.keyResult.update({ where: { id: kr.id }, data: krData });

      return approved;
    });

    const reviewer = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { employee: { select: { firstName: true, lastName: true } } },
    });
    const reviewerName = reviewer?.employee
      ? `${reviewer.employee.firstName} ${reviewer.employee.lastName}`
      : 'Manager';

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: 'okr.checkin_approved',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        checkInId: id,
        keyResultId: checkIn.keyResult.id,
        objectiveId: checkIn.keyResult.objectiveId,
        submitterId: checkIn.employeeId,
        approverId: user.sub,
        approverName: reviewerName,
        value: valueDecimal.toString(),
        newScore: scoreDecimal.toString(),
        keyResultTitle: checkIn.keyResult.title,
      },
      metadata: { userId: user.sub, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return this.toDto(updated);
  }

  async reject(id: string, dto: RejectCheckInDto, user: JwtPayload): Promise<OkrCheckInResponseDto> {
    const checkIn = await this.prisma.okrCheckIn.findUnique({
      where: { id },
      include: { keyResult: { include: { objective: true } } },
    });
    if (!checkIn) throw new NotFoundException('Check-in not found');

    if (checkIn.status !== PrismaOkrCheckInStatus.PENDING) {
      throw new ConflictException('CheckInNotPending');
    }

    const { objective } = checkIn.keyResult;

    if (!canApproveCheckIn(user, objective.departmentId)) {
      throw new ForbiddenException('WrongDepartment');
    }

    const now = new Date();

    const updated = await this.prisma.okrCheckIn.update({
      where: { id },
      data: {
        status: PrismaOkrCheckInStatus.REJECTED,
        rejectionReason: dto.reason,
        reviewedById: user.sub,
        reviewedAt: now,
      },
    });

    const reviewer = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { employee: { select: { firstName: true, lastName: true } } },
    });
    const reviewerName = reviewer?.employee
      ? `${reviewer.employee.firstName} ${reviewer.employee.lastName}`
      : 'Manager';

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: 'okr.checkin_rejected',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        checkInId: id,
        keyResultId: checkIn.keyResult.id,
        objectiveId: checkIn.keyResult.objectiveId,
        submitterId: checkIn.employeeId,
        reviewerId: user.sub,
        reviewerName,
        reason: dto.reason,
        keyResultTitle: checkIn.keyResult.title,
      },
      metadata: { userId: user.sub, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return this.toDto(updated);
  }

  private toDto(checkIn: OkrCheckIn): OkrCheckInResponseDto {
    const dto = new OkrCheckInResponseDto();
    dto.id = checkIn.id;
    dto.keyResultId = checkIn.keyResultId;
    dto.employeeId = checkIn.employeeId;
    dto.value = checkIn.value.toString();
    dto.score = checkIn.score.toString();
    dto.comment = checkIn.comment;
    dto.status = checkIn.status as unknown as OkrCheckInStatus;
    dto.reviewedById = checkIn.reviewedById;
    dto.reviewedAt = checkIn.reviewedAt?.toISOString() ?? null;
    dto.rejectionReason = checkIn.rejectionReason;
    dto.createdAt = checkIn.createdAt.toISOString();
    return dto;
  }
}
