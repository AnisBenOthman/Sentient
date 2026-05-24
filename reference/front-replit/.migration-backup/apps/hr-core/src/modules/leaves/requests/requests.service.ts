import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Decimal } from '../../../generated/prisma/runtime/library';
import { LeaveRequest, LeaveStatus, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { IEventBus, EVENT_BUS, DomainEvent } from '@sentient/shared';
import { CreateLeaveRequestDto } from '../dto/create-leave-request.dto';
import { LeaveQueryDto } from '../dto/leave-query.dto';
import { ReviewLeaveRequestDto } from '../dto/review-leave-request.dto';
import { PatchAgentAssessmentDto } from '../dto/patch-agent-assessment.dto';
import { HolidaysService } from '../holidays/holidays.service';
import { resolveEmployeeBusinessUnitId } from '../util/bu-resolver.util';
import { countBusinessDays } from '../util/business-day.util';

export interface TeamCalendarEntry {
  employeeId: string;
  employeeName: string;
  leaveTypeColor: string | null;
  startDate: Date;
  endDate: Date;
  startHalfDay: string | null;
  endHalfDay: string | null;
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  async create(employeeId: string, dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    // Load employee with BU resolution relations
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        team: { include: { businessUnit: true } },
        department: { include: { businessUnit: true } },
      },
    });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);

    const businessUnitId = resolveEmployeeBusinessUnitId(employee);
    if (!businessUnitId) throw new BadRequestException('UnresolvedBusinessUnit');

    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: dto.leaveTypeId },
    });
    if (!leaveType) throw new NotFoundException(`LeaveType ${dto.leaveTypeId} not found`);
    if (leaveType.businessUnitId !== businessUnitId) {
      throw new BadRequestException('LeaveTypeOutOfScope');
    }

    const startDate = new Date(dto.startDate + 'T00:00:00.000Z');
    const endDate = new Date(dto.endDate + 'T00:00:00.000Z');
    const year = startDate.getUTCFullYear();

    // WHY: holidays and totalDays are computed before the serializable tx. A holiday
    // added between this read and the tx commit would not be reflected, but totalDays
    // is intentionally frozen at submission time (immutable after creation per spec).
    const holidays = await this.holidaysService.listForBusinessUnit(businessUnitId, year);
    const totalDays = countBusinessDays(
      startDate,
      endDate,
      dto.startHalfDay ?? null,
      dto.endHalfDay ?? null,
      holidays,
    );

    if (totalDays.equals(new Decimal(0))) {
      throw new BadRequestException('ZeroDayRequest');
    }

    const createdRequest = await this.prisma.$transaction(
      async (tx) => {
        // Overlap check: PENDING or APPROVED requests that overlap
        const overlapping = await tx.leaveRequest.findFirst({
          where: {
            employeeId,
            status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        });
        if (overlapping) throw new ConflictException('OverlappingRequest');

        // Balance check
        const balance = await tx.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: dto.leaveTypeId, year } },
        });
        const remainingDays = balance
          ? balance.totalDays.minus(balance.usedDays).minus(balance.pendingDays)
          : new Decimal(0);
        if (remainingDays.lessThan(totalDays)) {
          throw new BadRequestException('InsufficientBalance');
        }

        const status = leaveType.requiresApproval ? LeaveStatus.PENDING : LeaveStatus.APPROVED;

        const request = await tx.leaveRequest.create({
          data: {
            employeeId,
            leaveTypeId: dto.leaveTypeId,
            startDate,
            endDate,
            startHalfDay: dto.startHalfDay ?? null,
            endHalfDay: dto.endHalfDay ?? null,
            totalDays,
            reason: dto.reason,
            status,
          },
        });

        if (balance) {
          if (status === LeaveStatus.PENDING) {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: { pendingDays: { increment: totalDays } },
            });
          } else {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: { usedDays: { increment: totalDays } },
            });
          }
        }

        return request;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: 'leave.requested',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        leaveRequestId: createdRequest.id,
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        totalDays: totalDays.toNumber(),
      },
      metadata: { userId: employeeId, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return createdRequest;
  }

  async findByEmployee(employeeId: string, query: LeaveQueryDto): Promise<LeaveRequest[]> {
    return this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        ...(query.status ? { status: query.status as LeaveStatus } : {}),
        ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
        ...(query.year
          ? {
              startDate: { lte: new Date(`${query.year}-12-31T00:00:00.000Z`) },
              endDate: { gte: new Date(`${query.year}-01-01T00:00:00.000Z`) },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, ownerId?: string): Promise<LeaveRequest> {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`LeaveRequest ${id} not found`);
    if (ownerId && request.employeeId !== ownerId) {
      throw new ForbiddenException('NotOwner');
    }
    return request;
  }

  async approve(id: string, dto: ReviewLeaveRequestDto, reviewerId: string): Promise<LeaveRequest> {
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.leaveRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException(`LeaveRequest ${id} not found`);
        if (request.status !== LeaveStatus.PENDING) {
          throw new ConflictException('RequestAlreadyDecided');
        }

        const approved = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.APPROVED,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
            reviewNote: dto.reviewNote,
          },
        });

        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              year: request.startDate.getUTCFullYear(),
            },
          },
        });
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pendingDays: { decrement: request.totalDays },
              usedDays: { increment: request.totalDays },
            },
          });
        }

        return approved;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: 'leave.approved',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        leaveRequestId: id,
        employeeId: updated.employeeId,
        reviewerId,
        reviewedAt: updated.reviewedAt?.toISOString(),
        reviewNote: dto.reviewNote,
      },
      metadata: { userId: reviewerId, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return updated;
  }

  async reject(id: string, dto: ReviewLeaveRequestDto, reviewerId: string): Promise<LeaveRequest> {
    if (!dto.reviewNote || dto.reviewNote.trim().length === 0) {
      throw new BadRequestException('reviewNote is required for rejection');
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.leaveRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException(`LeaveRequest ${id} not found`);
        if (request.status !== LeaveStatus.PENDING) {
          throw new ConflictException('RequestAlreadyDecided');
        }

        const rejected = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.REJECTED,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
            reviewNote: dto.reviewNote,
          },
        });

        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              year: request.startDate.getUTCFullYear(),
            },
          },
        });
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { pendingDays: { decrement: request.totalDays } },
          });
        }

        return rejected;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: 'leave.rejected',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        leaveRequestId: id,
        employeeId: updated.employeeId,
        reviewerId,
        reviewedAt: updated.reviewedAt?.toISOString(),
        reviewNote: dto.reviewNote,
      },
      metadata: { userId: reviewerId, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return updated;
  }

  async cancel(id: string, ownerId: string): Promise<LeaveRequest> {
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const request = await tx.leaveRequest.findUnique({ where: { id } });
        if (!request) throw new NotFoundException(`LeaveRequest ${id} not found`);
        if (request.employeeId !== ownerId) throw new ForbiddenException('NotOwner');
        if (request.status !== LeaveStatus.PENDING) {
          throw new ConflictException('RequestAlreadyDecided');
        }

        const cancelled = await tx.leaveRequest.update({
          where: { id },
          data: { status: LeaveStatus.CANCELLED },
        });

        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              year: request.startDate.getUTCFullYear(),
            },
          },
        });
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { pendingDays: { decrement: request.totalDays } },
          });
        }

        return cancelled;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.eventBus.emit<Record<string, unknown>>({
      id: randomUUID(),
      type: 'leave.cancelled',
      source: 'HR_CORE',
      timestamp: new Date(),
      payload: {
        leaveRequestId: id,
        employeeId: updated.employeeId,
        cancelledBy: ownerId,
      },
      metadata: { userId: ownerId, correlationId: randomUUID() },
    } satisfies DomainEvent<Record<string, unknown>>);

    return updated;
  }

  async teamCalendar(
    managerId: string,
    from: string,
    to: string,
    departmentId?: string,
    teamId?: string,
  ): Promise<TeamCalendarEntry[]> {
    const fromDate = new Date(from + 'T00:00:00.000Z');
    const toDate = new Date(to + 'T00:00:00.000Z');

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: { lte: toDate },
        endDate: { gte: fromDate },
        employee: {
          managerId,
          ...(departmentId ? { departmentId } : {}),
          ...(teamId ? { teamId } : {}),
        },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        leaveType: { select: { color: true } },
      },
    });

    return requests.map((r) => ({
      employeeId: r.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      leaveTypeColor: r.leaveType.color,
      startDate: r.startDate,
      endDate: r.endDate,
      startHalfDay: r.startHalfDay,
      endHalfDay: r.endHalfDay,
    }));
  }

  async patchAgentAssessment(id: string, dto: PatchAgentAssessmentDto): Promise<LeaveRequest> {
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException(`LeaveRequest ${id} not found`);

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        ...(dto.agentRiskAssessment !== undefined
          ? { agentRiskAssessment: dto.agentRiskAssessment as Prisma.InputJsonValue }
          : {}),
        ...(dto.agentSuggestedDates !== undefined
          ? { agentSuggestedDates: dto.agentSuggestedDates as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}
