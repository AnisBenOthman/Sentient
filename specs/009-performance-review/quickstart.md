# Quickstart: Performance Review Implementation Guide

Build the feature in dependency order. Each step should compile before moving to the next.

---

## Step 1: Schema and migration

1. Open `apps/hr-core/prisma/schema.prisma`.
2. Add or reconcile these enums with `@@schema("hr_core")`:
   - `SatisfactionLevel`
   - `PerformanceRating`
   - `ReviewStatus`
   - `ReviewType`
   - `ReviewCycleStatus`
   - `PerformanceReviewAuditAction`
3. Add models from [data-model.md](./data-model.md):
   - `PerformanceReviewCycle`
   - `PerformanceReview`
   - `PerformanceReviewAudit`
   - `PerformanceReviewSalaryFollowUp`
4. Add Employee back-relations:
   ```prisma
   performanceReviews PerformanceReview[] @relation("EmployeePerformanceReviews")
   reviewsToComplete  PerformanceReview[] @relation("ReviewerPerformanceReviews")
   ```
5. Add indexes and unique constraints exactly as listed in [data-model.md](./data-model.md).
6. Generate the migration:
   ```bash
   cd apps/hr-core
   npx prisma migrate dev --name add_performance_reviews
   ```
7. Review the generated SQL. Add raw CHECK constraints for non-negative `training_opportunities_taken` and valid date ordering if Prisma does not generate them.
8. Run:
   ```bash
   npx prisma generate
   ```

---

## Step 2: Shared enums and interfaces

1. Create `packages/shared/src/enums/satisfaction-level.enum.ts`.
2. Reconcile `packages/shared/src/enums/performance-rating.enum.ts` with the class diagram values:
   ```ts
   export enum PerformanceRating {
     UNACCEPTABLE = 'UNACCEPTABLE',
     NEEDS_IMPROVEMENT = 'NEEDS_IMPROVEMENT',
     MEETS_EXPECTATIONS = 'MEETS_EXPECTATIONS',
     EXCEEDS_EXPECTATIONS = 'EXCEEDS_EXPECTATIONS',
     ABOVE_AND_BEYOND = 'ABOVE_AND_BEYOND',
   }
   ```
3. Reconcile `packages/shared/src/enums/review-status.enum.ts` with the workflow states from [data-model.md](./data-model.md).
4. Add `review-type.enum.ts`, `review-cycle-status.enum.ts`, and `performance-review-audit-action.enum.ts`.
5. Export all new/updated enums from `packages/shared/src/enums/index.ts`.
6. Add `packages/shared/src/interfaces/performance-review.interface.ts` with API DTO-facing interfaces for review, cycle, summary, and salary follow-up responses.
7. Export the interface file from `packages/shared/src/interfaces/index.ts`.

---

## Step 3: Seed enum metadata

Use the existing `EnumMeta` model to seed display labels and ranks:

- `SatisfactionLevel`: ranks 1-5.
- `PerformanceRating`: ranks 1-5.
- `ReviewStatus`: workflow order for UI display.
- `ReviewType`: annual, mid-year, probation.

Add idempotent upserts to the existing seed path used by HR Core. Keep labels human-readable.

---

## Step 4: Module skeleton

Create `apps/hr-core/src/modules/performance-reviews/performance-reviews.module.ts`:

```ts
@Module({
  imports: [PrismaModule],
  controllers: [ReviewCyclesController, PerformanceReviewsController],
  providers: [ReviewCyclesService, PerformanceReviewsService],
  exports: [ReviewCyclesService, PerformanceReviewsService],
})
export class PerformanceReviewsModule {}
```

Import `PerformanceReviewsModule` in `apps/hr-core/src/app.module.ts`.

---

## Step 5: DTOs

Create DTOs under `apps/hr-core/src/modules/performance-reviews/dto/`:

- `create-review-cycle.dto.ts`: cycle name, review type, period dates, self-review open/close, manager due date. Validate date order.
- `initiate-review-cycle.dto.ts`: optional `businessUnitId`, `departmentId`, `teamId`, `positionId`, `employeeIds`, `reviewerOverrides`.
- `submit-self-review.dto.ts`: satisfaction fields, `trainingOpportunitiesTaken`, `workLifeBalance`, `selfRating`, `employeeComments`.
- `submit-manager-review.dto.ts`: `managerRating`, `managerComments`.
- `reopen-review.dto.ts`: required `reason`.
- `reassign-reviewer.dto.ts`: `reviewerId`, required `reason`.
- `record-salary-follow-up.dto.ts`: required `reason`, optional `salaryHistoryId`.
- `review-query.dto.ts`: `cycleId`, `employeeId`, `reviewerId`, `departmentId`, `positionId`, `status`, `rating`, `ratingGap`, `overdue`, `from`, `to`, `page`, `limit`.

Every enum field uses `@IsEnum(...)`. All IDs use `@IsUUID()`. Comment/reason fields use `@MaxLength(...)`.

---

## Step 6: Utilities

Create pure helpers first and cover them with unit tests:

- `rating-gap.util.ts`
  - `getPerformanceRatingRank(rating: PerformanceRating): number`
  - `hasRatingGap(selfRating: PerformanceRating, managerRating: PerformanceRating): boolean`
- `review-status.util.ts`
  - `assertSelfReviewEditable(status, cycleWindow, reopened): void`
  - `assertManagerReviewEditable(status): void`

Tests should cover every enum value and all transition boundaries.

---

## Step 7: Cycle service

Implement `ReviewCyclesService`:

- `create(dto, actor)` creates draft cycle.
- `initiate(cycleId, dto, actor)` activates the cycle and creates review rows in a transaction.
- `findAll(query, actor)` lists cycles with scope-aware summary counts.
- `summary(cycleId, actor)` returns assigned/pending/submitted/completed/overdue/rating gap counts.
- `close(cycleId, dto, actor)` closes the cycle and writes audit rows.

Initiation algorithm:

1. Load cycle and reject non-draft/non-active states as needed.
2. Query eligible active employees with optional filters and include manager/org context.
3. Resolve reviewer from override or `employee.managerId`.
4. If no reviewer, collect in `unassigned`.
5. Create `PerformanceReview` with org snapshot fields and due date.
6. Catch unique conflicts as skipped duplicates for idempotent retries.
7. Insert assignment audit rows.
8. Return created/skipped/unassigned counts.

---

## Step 8: Review service

Implement `PerformanceReviewsService`:

- `findAll(query, actor)` applies role/scope filters and returns paginated reviews.
- `findOne(id, actor)` applies row scope.
- `submitSelfReview(id, dto, actor)` validates employee ownership and active/reopened window.
- `submitManagerReview(id, dto, actor)` validates reviewer assignment or HR admin role.
- `reopen(id, dto, actor)` requires HR admin and reason.
- `reassignReviewer(id, dto, actor)` requires HR admin and active reviewer.
- `recordSalaryFollowUp(id, dto, actor)` requires completed/closed review.
- `audit(id, actor)` returns audit rows for HR admin.

Use Prisma transactions for state-changing methods so the review update and audit insert succeed or fail together.

---

## Step 9: Controllers

Create:

- `cycles/review-cycles.controller.ts` under `/performance-review-cycles`
- `reviews/performance-reviews.controller.ts` under `/performance-reviews`

Every endpoint gets:

- `@ApiTags(...)`
- `@ApiOperation(...)`
- `@ApiResponse(...)`
- `@UseGuards(SharedJwtGuard, RbacGuard)`
- `@Roles(...)`

Use `@CurrentUser()` from `@sentient/shared` for actor context and keep service methods responsible for row-scope checks.

---

## Step 10: Web API client

Update `apps/web/src/lib/api/hr-core.ts` with typed functions:

- `getPerformanceReviewCycles`
- `createPerformanceReviewCycle`
- `initiatePerformanceReviewCycle`
- `getPerformanceReviewCycleSummary`
- `getPerformanceReviews`
- `getPerformanceReview`
- `submitPerformanceSelfReview`
- `submitPerformanceManagerReview`
- `reopenPerformanceReview`
- `reassignPerformanceReviewer`
- `recordPerformanceSalaryFollowUp`

Keep request and response types in the shared package or a local API type module that mirrors the contract.

---

## Step 11: Web page replacement

Update `apps/web/src/pages/performance-reviews.tsx`:

1. Replace local-only state with TanStack Query calls.
2. Add tabs or segmented views for:
   - My Reviews
   - Assigned to Me
   - HR Cycles
   - Outcomes
3. Employees can submit self-review fields.
4. Managers can complete assigned reviews.
5. HR admins can create/initiate cycles, filter outcomes, reopen, reassign reviewer, and record salary follow-up.
6. Preserve the current 1-5 satisfaction/rating labels, but source them from shared enum metadata/order where practical.

Update or remove `apps/web/src/lib/performance-review-store.ts` so it no longer persists production review data to localStorage.

---

## Step 12: Tests

Backend unit tests:

- `rating-gap.util.spec.ts`
- `review-status.util.spec.ts`
- `review-cycles.service.spec.ts`
- `performance-reviews.service.spec.ts`

Backend scenarios:

- Cycle initiation creates one review per eligible employee.
- Missing manager returns unassigned result.
- Duplicate initiation does not create duplicate review rows.
- Employee can submit during active window.
- Employee cannot submit outside window unless reopened.
- Reviewer can complete assigned review only after employee submission.
- Rating gap is true when rank difference is at least 2.
- HR reopen requires reason and writes audit.
- Salary follow-up requires completed review.
- Unauthorized row access is rejected.

Frontend tests or manual verification:

- HR can create/initiate a cycle.
- Employee self-review form validates all required fields.
- Manager review form only appears for assigned reviews.
- HR filters by cycle/status/rating gap.

---

## Step 13: Verification commands

Run from repo root unless noted:

```bash
pnpm --filter @sentient/shared type-check
pnpm --filter @sentient/hr-core type-check
pnpm --filter @sentient/hr-core test
pnpm --filter @sentient/hr-core build
pnpm --filter @sentient/web type-check
pnpm --filter @sentient/web build
```

If the database is available:

```bash
cd apps/hr-core
npx prisma migrate status
npx prisma migrate dev
```

Manual Swagger check:

1. Start HR Core.
2. Open `http://localhost:3001/api/docs`.
3. Confirm Performance Review Cycle and Performance Review endpoints render with schemas.
4. Initiate a small cycle, submit one self-review, complete manager review, and verify HR summary counts.

---

## Definition of Done

- [ ] Prisma migration applies cleanly to `hr_core`.
- [x] Shared enum names match the core HRIS class diagram.
- [x] All endpoints are guarded and role-decorated.
- [x] Services enforce row-scope access.
- [x] Duplicate employee/cycle assignment is impossible.
- [x] Completed reviews preserve historical data.
- [x] HR reopen requires and stores a reason.
- [x] Rating gap detection is covered by tests.
- [x] Web route uses API-backed data instead of production localStorage.
- [x] Type-check, tests, and builds are green for touched packages.

## Observed Results

Validated on 2026-05-09:

- `npx prisma generate --schema prisma/schema.prisma` completed and regenerated `apps/hr-core/src/generated/prisma`.
- `pnpm --filter @sentient/shared build` completed.
- `pnpm --filter @sentient/shared type-check` passed.
- `pnpm --filter @sentient/hr-core type-check` passed.
- `pnpm --filter @sentient/hr-core exec jest performance-reviews --runInBand` passed: 7 suites, 10 tests.
- `pnpm --filter @sentient/hr-core build` passed.
- `pnpm --filter @sentient/web type-check` passed.
- `pnpm --filter @sentient/web build` passed with the existing Vite chunk-size warning.

Database migration apply and Swagger/manual workflow checks still require a running PostgreSQL/HR Core environment.
