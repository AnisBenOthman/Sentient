/**
 * Performance Review — acceptance scenario unit tests (FR coverage).
 *
 * These run against mocked Prisma. Full DB integration tests should be
 * added when the hr_core test harness (cleanHrCoreSchema) is wired up.
 * Each test maps to a named acceptance scenario from specs/009-performance-review/spec.md.
 */
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChannelType, PerformanceRating, PermissionScope, ReviewType, SatisfactionLevel } from '@sentient/shared';
import { ReviewCycleStatus, ReviewStatus } from '../../generated/prisma';
import { ReviewCyclesService } from './cycles/review-cycles.service';
import { PerformanceReviewsService } from './reviews/performance-reviews.service';
import type { JwtPayload } from '@sentient/shared';

const baseUser = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
  sub: 'user-1',
  employeeId: 'emp-1',
  roles: ['EMPLOYEE'],
  departmentId: null,
  teamId: null,
  businessUnitId: null,
  channel: ChannelType.WEB,
  roleAssignments: [],
  sessionId: 'session-1',
  iat: 0,
  exp: Date.now() + 900,
  ...overrides,
});

const hrUser = baseUser({ roles: ['HR_ADMIN'], roleAssignments: [] });

// ───────────────────────────────────────────────
// US1 — Initiate a Review Cycle
// ───────────────────────────────────────────────

describe('US1 — Initiate Review Cycle', () => {
  it('AS1.3: rejects initiation on a CLOSED cycle (duplicate prevention)', async () => {
    const prisma = {
      performanceReviewCycle: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cycle-1', status: ReviewCycleStatus.CLOSED, reviews: [] }),
      },
    } as unknown as ConstructorParameters<typeof ReviewCyclesService>[0];

    const service = new ReviewCyclesService(prisma);
    await expect(service.initiate('cycle-1', {}, 'emp-1')).rejects.toThrow(ConflictException);
  });

  it('AS1.3: rejects initiation on a CANCELLED cycle', async () => {
    const prisma = {
      performanceReviewCycle: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cycle-1', status: ReviewCycleStatus.CANCELLED, reviews: [] }),
      },
    } as unknown as ConstructorParameters<typeof ReviewCyclesService>[0];

    const service = new ReviewCyclesService(prisma);
    await expect(service.initiate('cycle-1', {}, 'emp-1')).rejects.toThrow(ConflictException);
  });

  it('throws 404 when cycle does not exist', async () => {
    const prisma = {
      performanceReviewCycle: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as unknown as ConstructorParameters<typeof ReviewCyclesService>[0];

    const service = new ReviewCyclesService(prisma);
    await expect(service.initiate('missing', {}, 'emp-1')).rejects.toThrow(NotFoundException);
  });

  it('rejects cycle creation when period end is before period start', async () => {
    const prisma = {
      performanceReviewCycle: { create: jest.fn() },
    } as unknown as ConstructorParameters<typeof ReviewCyclesService>[0];

    const service = new ReviewCyclesService(prisma);
    await expect(
      service.create(
        { name: 'Bad cycle', reviewType: ReviewType.ANNUAL, periodStart: '2026-12-31', periodEnd: '2026-01-01', selfReviewOpensAt: '2026-11-01T09:00:00.000Z', selfReviewClosesAt: '2026-11-30T17:00:00.000Z', managerReviewDueAt: '2026-12-15T17:00:00.000Z' },
        'emp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects cycle creation when manager review due is before self-review window closes', async () => {
    const prisma = {
      performanceReviewCycle: { create: jest.fn() },
    } as unknown as ConstructorParameters<typeof ReviewCyclesService>[0];

    const service = new ReviewCyclesService(prisma);
    await expect(
      service.create(
        { name: 'Bad cycle 2', reviewType: ReviewType.ANNUAL, periodStart: '2026-01-01', periodEnd: '2026-12-31', selfReviewOpensAt: '2026-11-01T09:00:00.000Z', selfReviewClosesAt: '2026-11-30T17:00:00.000Z', managerReviewDueAt: '2026-11-15T17:00:00.000Z' },
        'emp-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

// ───────────────────────────────────────────────
// US2 — Self-Review Submission
// ───────────────────────────────────────────────

describe('US2 — Self-Review Submission', () => {
  function makeReview(overrides: object) {
    return {
      id: 'review-1',
      employeeId: 'emp-1',
      status: ReviewStatus.PENDING,
      cycle: {
        id: 'cycle-1',
        status: ReviewCycleStatus.ACTIVE,
        selfReviewOpensAt: new Date(Date.now() - 7200_000),
        selfReviewClosesAt: new Date(Date.now() - 3600_000),
      },
      ...overrides,
    };
  }

  it('AS2.3: blocks self-review submission outside the window (non-REOPENED review)', async () => {
    const txReview = makeReview({});
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({ performanceReview: { findUnique: jest.fn().mockResolvedValue(txReview) } }),
      ),
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];

    const service = new PerformanceReviewsService(prisma);
    await expect(
      service.submitSelfReview(
        'review-1',
        { environmentSatisfaction: SatisfactionLevel.SATISFIED, jobSatisfaction: SatisfactionLevel.SATISFIED, relationshipSatisfaction: SatisfactionLevel.SATISFIED, trainingOpportunitiesTaken: 0, workLifeBalance: SatisfactionLevel.SATISFIED, selfRating: PerformanceRating.MEETS_EXPECTATIONS },
        baseUser(),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('AS2.2: rejects self-review from wrong employee', async () => {
    const txReview = makeReview({
      employeeId: 'emp-2', // different employee
      cycle: {
        id: 'cycle-1',
        status: ReviewCycleStatus.ACTIVE,
        selfReviewOpensAt: new Date(Date.now() - 3600_000),
        selfReviewClosesAt: new Date(Date.now() + 3600_000),
      },
    });
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({ performanceReview: { findUnique: jest.fn().mockResolvedValue(txReview) } }),
      ),
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];

    const service = new PerformanceReviewsService(prisma);
    await expect(
      service.submitSelfReview(
        'review-1',
        { environmentSatisfaction: SatisfactionLevel.SATISFIED, jobSatisfaction: SatisfactionLevel.SATISFIED, relationshipSatisfaction: SatisfactionLevel.SATISFIED, trainingOpportunitiesTaken: 0, workLifeBalance: SatisfactionLevel.SATISFIED, selfRating: PerformanceRating.MEETS_EXPECTATIONS },
        baseUser({ employeeId: 'emp-1' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ───────────────────────────────────────────────
// US3 — Manager Review / Rating Gap
// ───────────────────────────────────────────────

describe('US3 — Manager Review', () => {
  it('AS3.2: blocks manager review by non-assigned reviewer (non-HR)', async () => {
    const txReview = { id: 'review-1', reviewerId: 'emp-99', status: ReviewStatus.SUBMITTED, cycle: { id: 'cycle-1', status: ReviewCycleStatus.ACTIVE } };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) =>
        cb({ performanceReview: { findUnique: jest.fn().mockResolvedValue(txReview) } }),
      ),
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];

    const service = new PerformanceReviewsService(prisma);
    await expect(
      service.submitManagerReview(
        'review-1',
        { managerRating: PerformanceRating.MEETS_EXPECTATIONS, managerComments: 'Good work' },
        baseUser({ employeeId: 'emp-1', roles: ['MANAGER'] }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ───────────────────────────────────────────────
// US4 — Scope Filtering (FR-017)
// ───────────────────────────────────────────────

describe('US4 — Scope Filtering (FR-017)', () => {
  it('AS4.3: EMPLOYEE cannot view a review outside their scope', async () => {
    const prisma = {
      performanceReview: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'review-1',
          employeeId: 'emp-99',
          reviewerId: 'emp-88',
          departmentId: 'dept-a',
          teamId: 'team-a',
          businessUnitId: 'bu-a',
          status: ReviewStatus.PENDING,
        }),
      },
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];

    const service = new PerformanceReviewsService(prisma);
    await expect(
      service.findOne('review-1', baseUser({ employeeId: 'emp-1', roles: ['EMPLOYEE'], roleAssignments: [] })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('AS4.3: HR_ADMIN can view any review regardless of scope', async () => {
    const review = {
      id: 'review-1',
      employeeId: 'emp-99',
      reviewerId: 'emp-88',
      departmentId: 'dept-a',
      teamId: 'team-a',
      businessUnitId: 'bu-a',
      status: ReviewStatus.PENDING,
    };
    const prisma = {
      performanceReview: {
        findUnique: jest.fn().mockResolvedValue(review),
      },
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];

    const service = new PerformanceReviewsService(prisma);
    await expect(service.findOne('review-1', hrUser)).resolves.toMatchObject({ id: 'review-1' });
  });

  it('MANAGER can view a review for their direct team scope', async () => {
    const review = {
      id: 'review-1',
      employeeId: 'emp-99',
      reviewerId: 'emp-88',
      departmentId: null,
      teamId: 'team-1',
      businessUnitId: null,
      status: ReviewStatus.PENDING,
    };
    const prisma = {
      performanceReview: {
        findUnique: jest.fn().mockResolvedValue(review),
      },
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];

    const service = new PerformanceReviewsService(prisma);
    const manager = baseUser({
      roles: ['MANAGER'],
      employeeId: 'emp-mgr',
      roleAssignments: [{ roleCode: 'MANAGER', scope: PermissionScope.TEAM, scopeEntityId: 'team-1' }],
    });
    await expect(service.findOne('review-1', manager)).resolves.toMatchObject({ id: 'review-1' });
  });
});

// ───────────────────────────────────────────────
// Reassign reviewer guards (fixes)
// ───────────────────────────────────────────────

describe('reassignReviewer guards', () => {
  it('rejects reassignment when review is COMPLETED', async () => {
    const txMocks = {
      performanceReview: { findUnique: jest.fn().mockResolvedValue({ id: 'review-1', employeeId: 'emp-2', status: ReviewStatus.COMPLETED }) },
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-3' }) },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => cb(txMocks)),
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];

    const service = new PerformanceReviewsService(prisma);
    await expect(
      service.reassignReviewer('review-1', { reviewerId: 'emp-3', reason: 'Left company' }, hrUser),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects reassignment when reviewer is the same employee as reviewee', async () => {
    const txMocks = {
      performanceReview: { findUnique: jest.fn().mockResolvedValue({ id: 'review-1', employeeId: 'emp-2', status: ReviewStatus.PENDING }) },
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-2' }) },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => cb(txMocks)),
    } as unknown as ConstructorParameters<typeof PerformanceReviewsService>[0];

    const service = new PerformanceReviewsService(prisma);
    await expect(
      service.reassignReviewer('review-1', { reviewerId: 'emp-2', reason: 'Test' }, hrUser),
    ).rejects.toThrow(BadRequestException);
  });
});
