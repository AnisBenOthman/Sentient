import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EmploymentStatus,
  PerformanceReviewAuditAction,
  Prisma,
  ReviewCycleStatus,
  ReviewStatus,
  ReviewType,
} from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReviewCycleDto } from '../dto/create-review-cycle.dto';
import { InitiateReviewCycleDto } from '../dto/initiate-review-cycle.dto';
import { hasRatingGap } from '../util/rating-gap.util';

type ReviewCycleWithReviews = Prisma.PerformanceReviewCycleGetPayload<{
  include: { reviews: true };
}>;

type EmployeeForAssignment = Prisma.EmployeeGetPayload<{
  include: {
    department: { include: { businessUnit: true } };
    team: { include: { businessUnit: true } };
    position: true;
  };
}>;

export interface MissingReviewerConflict {
  employeeId: string;
  employeeName: string;
  reason: string;
}

export interface InitiateReviewCycleResult {
  cycle: ReviewCycleWithReviews;
  created: number;
  skippedExisting: number;
  missingReviewers: MissingReviewerConflict[];
}

export interface ReviewCycleSummary {
  cycleId: string;
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  completed: number;
  reopened: number;
  closed: number;
  cancelled: number;
  overdue: number;
  ratingGaps: number;
}

@Injectable()
export class ReviewCyclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReviewCycleDto, actorEmployeeId: string): Promise<ReviewCycleWithReviews> {
    const periodStart = this.asDate(dto.periodStart);
    const periodEnd = this.asDate(dto.periodEnd);
    const selfReviewOpensAt = new Date(dto.selfReviewOpensAt);
    const selfReviewClosesAt = new Date(dto.selfReviewClosesAt);
    const managerReviewDueAt = new Date(dto.managerReviewDueAt);

    if (periodEnd < periodStart) throw new BadRequestException('PeriodEndBeforeStart');
    if (selfReviewClosesAt < selfReviewOpensAt) throw new BadRequestException('SelfReviewWindowInvalid');
    if (managerReviewDueAt < selfReviewClosesAt) throw new BadRequestException('ManagerDueBeforeSelfWindowCloses');

    return this.prisma.performanceReviewCycle.create({
      data: {
        name: dto.name,
        reviewType: dto.reviewType as ReviewType,
        periodStart,
        periodEnd,
        selfReviewOpensAt,
        selfReviewClosesAt,
        managerReviewDueAt,
        createdById: actorEmployeeId,
      },
      include: { reviews: true },
    });
  }

  async list(): Promise<ReviewCycleWithReviews[]> {
    return this.prisma.performanceReviewCycle.findMany({
      include: { reviews: true },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async initiate(
    cycleId: string,
    dto: InitiateReviewCycleDto,
    actorEmployeeId: string,
  ): Promise<InitiateReviewCycleResult> {
    const cycle = await this.prisma.performanceReviewCycle.findUnique({
      where: { id: cycleId },
      include: { reviews: true },
    });
    if (!cycle) throw new NotFoundException(`PerformanceReviewCycle ${cycleId} not found`);
    if (new Set<ReviewCycleStatus>([ReviewCycleStatus.CLOSED, ReviewCycleStatus.CANCELLED]).has(cycle.status)) {
      throw new ConflictException('ReviewCycleLocked');
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        deletedAt: null,
        employmentStatus: dto.includeProbationEmployees
          ? { in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION] }
          : EmploymentStatus.ACTIVE,
        ...(dto.businessUnitId
          ? {
              OR: [
                { department: { businessUnitId: dto.businessUnitId } },
                { team: { businessUnitId: dto.businessUnitId } },
              ],
            }
          : {}),
        ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
        ...(dto.teamId ? { teamId: dto.teamId } : {}),
        ...(dto.employeeIds?.length ? { id: { in: dto.employeeIds } } : {}),
      },
      include: {
        department: { include: { businessUnit: true } },
        team: { include: { businessUnit: true } },
        position: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    // Batch-validate all candidate reviewer IDs in one query
    const candidateReviewerIds = new Set<string>();
    for (const emp of employees) {
      const id = dto.reviewerOverrideId ?? emp.managerId;
      if (id) candidateReviewerIds.add(id);
    }
    const activeReviewerSet = new Set(
      (
        await this.prisma.employee.findMany({
          where: { id: { in: [...candidateReviewerIds] }, deletedAt: null },
          select: { id: true },
        })
      ).map((r) => r.id),
    );

    // Pre-collect existing review employee IDs in one query
    const existingEmployeeIds = new Set(
      (
        await this.prisma.performanceReview.findMany({
          where: { cycleId },
          select: { employeeId: true },
        })
      ).map((r) => r.employeeId),
    );

    const missingReviewers: MissingReviewerConflict[] = [];
    const reviewsToCreate: Prisma.PerformanceReviewCreateManyInput[] = [];
    let skippedExisting = 0;

    for (const employee of employees) {
      if (existingEmployeeIds.has(employee.id)) {
        skippedExisting += 1;
        continue;
      }
      const reviewerId = dto.reviewerOverrideId ?? employee.managerId;
      if (!reviewerId) {
        missingReviewers.push({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, reason: 'Missing manager or reviewer override' });
        continue;
      }
      if (!activeReviewerSet.has(reviewerId)) {
        missingReviewers.push({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, reason: 'Reviewer is inactive or missing' });
        continue;
      }
      reviewsToCreate.push(this.buildBatchAssignmentData(cycleId, cycle, employee, reviewerId));
    }

    const updatedCycle = await this.prisma.$transaction(async (tx) => {
      const activated = await tx.performanceReviewCycle.update({
        where: { id: cycleId },
        data: { status: ReviewCycleStatus.ACTIVE },
        include: { reviews: true },
      });

      if (reviewsToCreate.length > 0) {
        await tx.performanceReview.createMany({ data: reviewsToCreate });
        const createdReviews = await tx.performanceReview.findMany({
          where: { cycleId, employeeId: { in: reviewsToCreate.map((r) => r.employeeId) } },
          select: { id: true, reviewerId: true },
        });
        await tx.performanceReviewAudit.createMany({
          data: createdReviews.map((review) => ({
            reviewId: review.id,
            action: PerformanceReviewAuditAction.ASSIGNED,
            actorId: actorEmployeeId,
            toStatus: ReviewStatus.PENDING,
            metadata: { cycleId, reviewerId: review.reviewerId } as unknown as Prisma.InputJsonObject,
          })),
        });
      }

      return activated;
    });

    return { cycle: updatedCycle, created: reviewsToCreate.length, skippedExisting, missingReviewers };
  }

  async summary(cycleId: string): Promise<ReviewCycleSummary> {
    const exists = await this.prisma.performanceReviewCycle.findUnique({
      where: { id: cycleId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`PerformanceReviewCycle ${cycleId} not found`);

    const now = new Date();
    const [statusGroups, overdueCount, ratingCandidates] = await Promise.all([
      this.prisma.performanceReview.groupBy({
        by: ['status'],
        where: { cycleId },
        _count: true,
      }),
      this.prisma.performanceReview.count({
        where: {
          cycleId,
          dueDate: { lt: now },
          status: { notIn: [ReviewStatus.COMPLETED, ReviewStatus.CLOSED, ReviewStatus.CANCELLED] },
        },
      }),
      this.prisma.performanceReview.findMany({
        where: {
          cycleId,
          status: { in: [ReviewStatus.COMPLETED, ReviewStatus.CLOSED] },
          selfRating: { not: null },
          managerRating: { not: null },
        },
        select: { selfRating: true, managerRating: true },
      }),
    ]);

    const counts: Partial<Record<ReviewStatus, number>> = {};
    let total = 0;
    for (const group of statusGroups) {
      counts[group.status] = group._count;
      total += group._count;
    }

    const ratingGaps = ratingCandidates.filter((r) =>
      hasRatingGap(r.selfRating, r.managerRating),
    ).length;

    return {
      cycleId,
      total,
      pending: counts[ReviewStatus.PENDING] ?? 0,
      inProgress: counts[ReviewStatus.IN_PROGRESS] ?? 0,
      submitted: counts[ReviewStatus.SUBMITTED] ?? 0,
      completed: counts[ReviewStatus.COMPLETED] ?? 0,
      reopened: counts[ReviewStatus.REOPENED] ?? 0,
      closed: counts[ReviewStatus.CLOSED] ?? 0,
      cancelled: counts[ReviewStatus.CANCELLED] ?? 0,
      overdue: overdueCount,
      ratingGaps,
    };
  }

  async close(cycleId: string, actorEmployeeId: string): Promise<ReviewCycleWithReviews> {
    const cycle = await this.prisma.performanceReviewCycle.findUnique({
      where: { id: cycleId },
      include: { reviews: true },
    });
    if (!cycle) throw new NotFoundException(`PerformanceReviewCycle ${cycleId} not found`);
    if (cycle.status === ReviewCycleStatus.CLOSED) return cycle;
    if (cycle.status === ReviewCycleStatus.CANCELLED) throw new ConflictException('ReviewCycleCancelled');

    return this.prisma.$transaction(async (tx) => {
      // Capture IDs of COMPLETED reviews before transitioning them
      const toClose = await tx.performanceReview.findMany({
        where: { cycleId, status: ReviewStatus.COMPLETED },
        select: { id: true },
      });

      if (toClose.length > 0) {
        const now = new Date();
        await tx.performanceReview.updateMany({
          where: { id: { in: toClose.map((r) => r.id) } },
          data: { status: ReviewStatus.CLOSED, closedAt: now, closedById: actorEmployeeId },
        });
        await tx.performanceReviewAudit.createMany({
          data: toClose.map((review) => ({
            reviewId: review.id,
            action: PerformanceReviewAuditAction.CLOSED,
            actorId: actorEmployeeId,
            fromStatus: ReviewStatus.COMPLETED,
            toStatus: ReviewStatus.CLOSED,
          })),
        });
      }

      return tx.performanceReviewCycle.update({
        where: { id: cycleId },
        data: { status: ReviewCycleStatus.CLOSED, closedAt: new Date() },
        include: { reviews: true },
      });
    });
  }

  private buildBatchAssignmentData(
    cycleId: string,
    cycle: { periodEnd: Date; managerReviewDueAt: Date },
    employee: EmployeeForAssignment,
    reviewerId: string,
  ): Prisma.PerformanceReviewCreateManyInput {
    const businessUnit = employee.team?.businessUnit ?? employee.department?.businessUnit ?? null;
    return {
      cycleId,
      employeeId: employee.id,
      reviewerId,
      reviewDate: cycle.periodEnd,
      dueDate: cycle.managerReviewDueAt,
      status: ReviewStatus.PENDING,
      businessUnitId: businessUnit?.id ?? null,
      businessUnitName: businessUnit?.name ?? null,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? null,
      teamId: employee.teamId,
      teamName: employee.team?.name ?? null,
      positionId: employee.positionId,
      positionTitle: employee.position?.title ?? null,
    };
  }

  private asDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}
