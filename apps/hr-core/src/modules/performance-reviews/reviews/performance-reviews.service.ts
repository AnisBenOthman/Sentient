import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayload, PermissionScope } from '@sentient/shared';
import {
  EmploymentStatus,
  PerformanceRating,
  PerformanceReview,
  PerformanceReviewAudit,
  PerformanceReviewAuditAction,
  PerformanceReviewSalaryFollowUp,
  Prisma,
  ReviewCycleStatus,
  ReviewStatus,
  SatisfactionLevel,
} from '../../../generated/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReassignReviewerDto } from '../dto/reassign-reviewer.dto';
import { RecordSalaryFollowUpDto } from '../dto/record-salary-follow-up.dto';
import { ReopenReviewDto } from '../dto/reopen-review.dto';
import { ReviewQueryDto } from '../dto/review-query.dto';
import { SubmitManagerReviewDto } from '../dto/submit-manager-review.dto';
import { SubmitSelfReviewDto } from '../dto/submit-self-review.dto';
import { hasRatingGap } from '../util/rating-gap.util';
import { assertActiveCycle, assertReviewStatusTransition, isManagerReviewEditable, isSelfReviewEditable } from '../util/review-status.util';

type ReviewDetail = Prisma.PerformanceReviewGetPayload<{
  include: {
    cycle: true;
    employee: { select: { id: true; firstName: true; lastName: true } };
    reviewer: { select: { id: true; firstName: true; lastName: true } };
    salaryFollowUps: true;
  };
}>;

export interface PerformanceReviewList {
  data: ReviewDetail[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class PerformanceReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ReviewQueryDto, user: JwtPayload): Promise<PerformanceReviewList> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const now = new Date();
    const baseWhere: Prisma.PerformanceReviewWhereInput = {
      ...this.buildReviewScopeFilter(user),
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.reviewerId ? { reviewerId: query.reviewerId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.status ? { status: query.status as ReviewStatus } : {}),
      ...(query.managerRating ? { managerRating: query.managerRating as PerformanceRating } : {}),
      ...(query.periodStart || query.periodEnd
        ? {
            reviewDate: {
              ...(query.periodStart ? { gte: this.asDate(query.periodStart) } : {}),
              ...(query.periodEnd ? { lte: this.asDate(query.periodEnd) } : {}),
            },
          }
        : {}),
      ...(query.overdue === true
        ? { dueDate: { lt: now }, status: { notIn: [ReviewStatus.COMPLETED, ReviewStatus.CLOSED, ReviewStatus.CANCELLED] } }
        : {}),
    };

    if (query.ratingGap === true) {
      // Rating gap requires comparing two enum-rank values — must filter in memory.
      // Bound the set: only COMPLETED/CLOSED reviews can have both ratings present.
      const ratingGapWhere: Prisma.PerformanceReviewWhereInput = {
        ...baseWhere,
        status: { in: [ReviewStatus.COMPLETED, ReviewStatus.CLOSED] },
        selfRating: { not: null },
        managerRating: { not: null },
      };
      const rows = await this.prisma.performanceReview.findMany({
        where: ratingGapWhere,
        include: this.reviewInclude(),
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      });
      const filtered = rows.filter((r) => hasRatingGap(r.selfRating, r.managerRating));
      const start = (page - 1) * limit;
      return { data: filtered.slice(start, start + limit), total: filtered.length, page, limit };
    }

    const [data, total] = await Promise.all([
      this.prisma.performanceReview.findMany({
        where: baseWhere,
        include: this.reviewInclude(),
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.performanceReview.count({ where: baseWhere }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, user: JwtPayload): Promise<ReviewDetail> {
    const review = await this.prisma.performanceReview.findUnique({
      where: { id },
      include: this.reviewInclude(),
    });
    if (!review) throw new NotFoundException(`PerformanceReview ${id} not found`);
    this.assertCanView(review, user);
    return review;
  }

  async submitSelfReview(id: string, dto: SubmitSelfReviewDto, user: JwtPayload): Promise<ReviewDetail> {
    const actorId = this.requireEmployeeId(user);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.performanceReview.findUnique({
        where: { id },
        include: { cycle: true },
      });
      if (!review) throw new NotFoundException(`PerformanceReview ${id} not found`);
      if (review.employeeId !== actorId) throw new ForbiddenException('NotReviewOwner');
      assertActiveCycle(review.cycle.status);
      if (!this.isInsideSelfReviewWindow(review.cycle) && review.status !== ReviewStatus.REOPENED) {
        throw new ConflictException('SelfReviewWindowClosed');
      }
      if (!isSelfReviewEditable(review.status)) throw new ConflictException('ReviewNotEditable');
      assertReviewStatusTransition(review.status, ReviewStatus.SUBMITTED);

      const updated = await tx.performanceReview.update({
        where: { id },
        data: {
          environmentSatisfaction: dto.environmentSatisfaction as SatisfactionLevel,
          jobSatisfaction: dto.jobSatisfaction as SatisfactionLevel,
          relationshipSatisfaction: dto.relationshipSatisfaction as SatisfactionLevel,
          trainingOpportunitiesTaken: dto.trainingOpportunitiesTaken,
          workLifeBalance: dto.workLifeBalance as SatisfactionLevel,
          selfRating: dto.selfRating as PerformanceRating,
          employeeComments: dto.employeeComments?.trim() ?? null,
          submittedAt: new Date(),
          submittedById: actorId,
          status: ReviewStatus.SUBMITTED,
        },
      });

      await this.createAudit(tx, updated.id, PerformanceReviewAuditAction.SELF_SUBMITTED, actorId, review.status, ReviewStatus.SUBMITTED);
      return this.findOneInTransaction(tx, updated.id);
    });
  }

  async submitManagerReview(id: string, dto: SubmitManagerReviewDto, user: JwtPayload): Promise<ReviewDetail> {
    const actorId = this.requireEmployeeId(user);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.performanceReview.findUnique({
        where: { id },
        include: { cycle: true },
      });
      if (!review) throw new NotFoundException(`PerformanceReview ${id} not found`);
      if (!this.isHr(user) && review.reviewerId !== actorId) throw new ForbiddenException('NotAssignedReviewer');
      assertActiveCycle(review.cycle.status);
      if (!isManagerReviewEditable(review.status)) throw new ConflictException('ReviewNotReadyForManager');
      assertReviewStatusTransition(review.status, ReviewStatus.COMPLETED);

      const updated = await tx.performanceReview.update({
        where: { id },
        data: {
          managerRating: dto.managerRating as PerformanceRating,
          managerComments: dto.managerComments?.trim() ?? null,
          completedAt: new Date(),
          completedById: actorId,
          status: ReviewStatus.COMPLETED,
        },
      });

      await this.createAudit(
        tx,
        updated.id,
        PerformanceReviewAuditAction.MANAGER_COMPLETED,
        actorId,
        review.status,
        ReviewStatus.COMPLETED,
        undefined,
        { ratingGap: hasRatingGap(updated.selfRating, updated.managerRating) },
      );
      return this.findOneInTransaction(tx, updated.id);
    });
  }

  async reopenReview(id: string, dto: ReopenReviewDto, user: JwtPayload): Promise<ReviewDetail> {
    const actorId = this.requireHrEmployeeId(user);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.performanceReview.findUnique({ where: { id } });
      if (!review) throw new NotFoundException(`PerformanceReview ${id} not found`);
      if (!new Set<ReviewStatus>([ReviewStatus.SUBMITTED, ReviewStatus.COMPLETED, ReviewStatus.CLOSED]).has(review.status)) {
        throw new ConflictException('ReviewCannotBeReopened');
      }
      assertReviewStatusTransition(review.status, ReviewStatus.REOPENED);

      const updated = await tx.performanceReview.update({
        where: { id },
        data: {
          status: ReviewStatus.REOPENED,
          reopenedAt: new Date(),
          reopenedById: actorId,
          reopenReason: dto.reason.trim(),
        },
      });
      await this.createAudit(tx, id, PerformanceReviewAuditAction.REOPENED, actorId, review.status, ReviewStatus.REOPENED, dto.reason);
      return this.findOneInTransaction(tx, updated.id);
    });
  }

  async reassignReviewer(id: string, dto: ReassignReviewerDto, user: JwtPayload): Promise<ReviewDetail> {
    const actorId = this.requireHrEmployeeId(user);

    return this.prisma.$transaction(async (tx) => {
      const [review, reviewer] = await Promise.all([
        tx.performanceReview.findUnique({ where: { id } }),
        tx.employee.findFirst({
          where: { id: dto.reviewerId, deletedAt: null, employmentStatus: { in: [EmploymentStatus.ACTIVE, EmploymentStatus.PROBATION] } },
          select: { id: true },
        }),
      ]);
      if (!review) throw new NotFoundException(`PerformanceReview ${id} not found`);
      if (!reviewer) throw new NotFoundException(`Reviewer ${dto.reviewerId} not found or inactive`);
      if (new Set<ReviewStatus>([ReviewStatus.COMPLETED, ReviewStatus.CLOSED, ReviewStatus.CANCELLED]).has(review.status)) {
        throw new ConflictException('ReviewAlreadyFinalized');
      }
      if (dto.reviewerId === review.employeeId) {
        throw new BadRequestException('ReviewerCannotBeTheReviewee');
      }

      const updated = await tx.performanceReview.update({
        where: { id },
        data: { reviewerId: dto.reviewerId },
      });
      await this.createAudit(
        tx,
        id,
        PerformanceReviewAuditAction.REVIEWER_REASSIGNED,
        actorId,
        review.status,
        review.status,
        dto.reason,
        { oldReviewerId: review.reviewerId, newReviewerId: dto.reviewerId },
      );
      return this.findOneInTransaction(tx, updated.id);
    });
  }

  async recordSalaryFollowUp(
    id: string,
    dto: RecordSalaryFollowUpDto,
    user: JwtPayload,
  ): Promise<PerformanceReviewSalaryFollowUp> {
    const actorId = this.requireHrEmployeeId(user);

    return this.prisma.$transaction(async (tx) => {
      const review = await tx.performanceReview.findUnique({ where: { id } });
      if (!review) throw new NotFoundException(`PerformanceReview ${id} not found`);
      if (!new Set<ReviewStatus>([ReviewStatus.COMPLETED, ReviewStatus.CLOSED]).has(review.status)) {
        throw new ConflictException('ReviewMustBeCompleted');
      }

      if (dto.salaryHistoryId) {
        const salaryHistory = await tx.salaryHistory.findUnique({
          where: { id: dto.salaryHistoryId },
          select: { employeeId: true },
        });
        if (!salaryHistory) throw new NotFoundException(`SalaryHistory ${dto.salaryHistoryId} not found`);
        if (salaryHistory.employeeId !== review.employeeId) throw new BadRequestException('SalaryHistoryEmployeeMismatch');
      }

      const followUp = await tx.performanceReviewSalaryFollowUp.create({
        data: {
          reviewId: id,
          salaryHistoryId: dto.salaryHistoryId ?? null,
          reason: dto.reason.trim(),
          createdById: actorId,
        },
      });
      await this.createAudit(
        tx,
        id,
        PerformanceReviewAuditAction.SALARY_FOLLOW_UP_RECORDED,
        actorId,
        review.status,
        review.status,
        dto.reason,
        { salaryHistoryId: dto.salaryHistoryId ?? null, followUpId: followUp.id },
      );
      return followUp;
    });
  }

  async getAudit(id: string, user: JwtPayload): Promise<PerformanceReviewAudit[]> {
    this.requireHrEmployeeId(user);
    const review = await this.prisma.performanceReview.findUnique({ where: { id }, select: { id: true } });
    if (!review) throw new NotFoundException(`PerformanceReview ${id} not found`);
    return this.prisma.performanceReviewAudit.findMany({
      where: { reviewId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  private reviewInclude(): {
    cycle: true;
    employee: { select: { id: true; firstName: true; lastName: true } };
    reviewer: { select: { id: true; firstName: true; lastName: true } };
    salaryFollowUps: true;
  } {
    return {
      cycle: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
      reviewer: { select: { id: true, firstName: true, lastName: true } },
      salaryFollowUps: true,
    };
  }

  private async findOneInTransaction(tx: Prisma.TransactionClient, id: string): Promise<ReviewDetail> {
    const review = await tx.performanceReview.findUnique({
      where: { id },
      include: this.reviewInclude(),
    });
    if (!review) throw new NotFoundException(`PerformanceReview ${id} not found`);
    return review;
  }

  private async createAudit(
    tx: Prisma.TransactionClient,
    reviewId: string,
    action: PerformanceReviewAuditAction,
    actorId: string,
    fromStatus: ReviewStatus | null,
    toStatus: ReviewStatus | null,
    reason?: string,
    metadata?: Prisma.InputJsonObject,
  ): Promise<void> {
    await tx.performanceReviewAudit.create({
      data: {
        reviewId,
        action,
        actorId,
        fromStatus,
        toStatus,
        reason: reason?.trim() ?? null,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  }

  private assertCanView(review: Pick<PerformanceReview, 'employeeId' | 'reviewerId' | 'departmentId' | 'teamId' | 'businessUnitId'>, user: JwtPayload): void {
    if (this.isHr(user) || user.roles.includes('EXECUTIVE')) return;
    const employeeId = this.requireEmployeeId(user);
    if (review.employeeId === employeeId || review.reviewerId === employeeId) return;

    const teamScope = user.roleAssignments.find((assignment) => assignment.scope === PermissionScope.TEAM);
    if (teamScope?.scopeEntityId && review.teamId === teamScope.scopeEntityId) return;
    const departmentScope = user.roleAssignments.find((assignment) => assignment.scope === PermissionScope.DEPARTMENT);
    if (departmentScope?.scopeEntityId && review.departmentId === departmentScope.scopeEntityId) return;
    const buScope = user.roleAssignments.find((assignment) => assignment.scope === PermissionScope.BUSINESS_UNIT);
    if (buScope?.scopeEntityId && review.businessUnitId === buScope.scopeEntityId) return;

    throw new ForbiddenException('PerformanceReviewOutOfScope');
  }

  private buildReviewScopeFilter(user: JwtPayload): Prisma.PerformanceReviewWhereInput {
    if (this.isHr(user) || user.roles.includes('EXECUTIVE')) return {};
    const employeeId = this.requireEmployeeId(user);
    const orFilters: Prisma.PerformanceReviewWhereInput[] = [
      { employeeId },
      { reviewerId: employeeId },
    ];

    for (const assignment of user.roleAssignments) {
      if (assignment.scope === PermissionScope.TEAM && assignment.scopeEntityId) {
        orFilters.push({ teamId: assignment.scopeEntityId });
      }
      if (assignment.scope === PermissionScope.DEPARTMENT && assignment.scopeEntityId) {
        orFilters.push({ departmentId: assignment.scopeEntityId });
      }
      if (assignment.scope === PermissionScope.BUSINESS_UNIT && assignment.scopeEntityId) {
        orFilters.push({ businessUnitId: assignment.scopeEntityId });
      }
    }

    return { OR: orFilters };
  }

  private isInsideSelfReviewWindow(cycle: { selfReviewOpensAt: Date; selfReviewClosesAt: Date; status: ReviewCycleStatus }): boolean {
    if (cycle.status !== ReviewCycleStatus.ACTIVE) return false;
    const now = new Date();
    return cycle.selfReviewOpensAt <= now && cycle.selfReviewClosesAt >= now;
  }

  private requireEmployeeId(user: JwtPayload): string {
    if (!user.employeeId) throw new ForbiddenException('No employee record linked to this account');
    return user.employeeId;
  }

  private requireHrEmployeeId(user: JwtPayload): string {
    if (!this.isHr(user)) throw new ForbiddenException('Requires HR role');
    return this.requireEmployeeId(user);
  }

  private isHr(user: JwtPayload): boolean {
    return user.roles.some((role) => ['HR_ADMIN', 'GLOBAL_HR_ADMIN', 'SYSTEM_ADMIN'].includes(role));
  }

  private asDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}
