# Tasks: Performance Review

**Input**: Design documents from `/specs/009-performance-review/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/performance-review-api.md, quickstart.md
**Tests**: Included because the feature specification defines independent tests for each user story and quickstart requires backend and frontend validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files or has no dependency on incomplete tasks.
- **[Story]**: Maps task to a user story from `spec.md`.
- Every task includes an exact target file path.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared TypeScript contracts and module directories used by all stories.

- [x] T001 [P] Create shared satisfaction enum in `packages/shared/src/enums/satisfaction-level.enum.ts`
- [x] T002 [P] Reconcile shared performance rating enum with class diagram values in `packages/shared/src/enums/performance-rating.enum.ts`
- [x] T003 [P] Reconcile shared review status enum with workflow states in `packages/shared/src/enums/review-status.enum.ts`
- [x] T004 [P] Create shared review type enum in `packages/shared/src/enums/review-type.enum.ts`
- [x] T005 [P] Create shared review cycle status enum in `packages/shared/src/enums/review-cycle-status.enum.ts`
- [x] T006 [P] Create shared performance review audit action enum in `packages/shared/src/enums/performance-review-audit-action.enum.ts`
- [x] T007 Export performance review enums from `packages/shared/src/enums/index.ts`
- [x] T008 [P] Create performance review API interfaces in `packages/shared/src/interfaces/performance-review.interface.ts`
- [x] T009 Export performance review interfaces from `packages/shared/src/interfaces/index.ts`
- [x] T010 Create performance review module folder structure under `apps/hr-core/src/modules/performance-reviews/`

**Checkpoint**: Shared enum/interface surface and module directories exist.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, DTOs, pure utilities, seed metadata, and module wiring that all user stories need.

**Critical**: No user story work can begin until this phase is complete.

- [x] T011 Add performance review enums and models to `apps/hr-core/prisma/schema.prisma`
- [x] T012 Add Employee back-relations for performance reviews in `apps/hr-core/prisma/schema.prisma`
- [x] T013 Generate and review performance review migration in `apps/hr-core/prisma/migrations/<timestamp>_add_performance_reviews/migration.sql`
- [x] T014 Add raw CHECK constraints for review date order and non-negative training count in `apps/hr-core/prisma/migrations/<timestamp>_add_performance_reviews/migration.sql`
- [x] T015 [P] Add idempotent EnumMeta seed data for satisfaction/rating/status/type labels in `apps/hr-core/prisma/seed.ts`
- [x] T016 [P] Create create-cycle DTO in `apps/hr-core/src/modules/performance-reviews/dto/create-review-cycle.dto.ts`
- [x] T017 [P] Create initiate-cycle DTO in `apps/hr-core/src/modules/performance-reviews/dto/initiate-review-cycle.dto.ts`
- [x] T018 [P] Create self-review DTO in `apps/hr-core/src/modules/performance-reviews/dto/submit-self-review.dto.ts`
- [x] T019 [P] Create manager-review DTO in `apps/hr-core/src/modules/performance-reviews/dto/submit-manager-review.dto.ts`
- [x] T020 [P] Create reopen-review DTO in `apps/hr-core/src/modules/performance-reviews/dto/reopen-review.dto.ts`
- [x] T021 [P] Create reassign-reviewer DTO in `apps/hr-core/src/modules/performance-reviews/dto/reassign-reviewer.dto.ts`
- [x] T022 [P] Create salary-follow-up DTO in `apps/hr-core/src/modules/performance-reviews/dto/record-salary-follow-up.dto.ts`
- [x] T023 [P] Create review query DTO in `apps/hr-core/src/modules/performance-reviews/dto/review-query.dto.ts`
- [x] T024 [P] Create rating gap unit tests in `apps/hr-core/src/modules/performance-reviews/util/rating-gap.util.spec.ts`
- [x] T025 [P] Create review status unit tests in `apps/hr-core/src/modules/performance-reviews/util/review-status.util.spec.ts`
- [x] T026 Implement rating gap helper in `apps/hr-core/src/modules/performance-reviews/util/rating-gap.util.ts`
- [x] T027 Implement review status transition helper in `apps/hr-core/src/modules/performance-reviews/util/review-status.util.ts`
- [x] T028 Create performance reviews module shell in `apps/hr-core/src/modules/performance-reviews/performance-reviews.module.ts`
- [x] T029 Register PerformanceReviewsModule in `apps/hr-core/src/app.module.ts`
- [x] T030 Run Prisma generate after schema changes for generated client in `apps/hr-core/src/generated/prisma/`

**Checkpoint**: Foundation ready; user story implementation can start.

---

## Phase 3: User Story 1 - Initiate a Review Cycle (Priority: P1) MVP

**Goal**: HR admin can create and initiate a review cycle, creating one assigned review per eligible employee and returning missing-reviewer conflicts.

**Independent Test**: Initiate a cycle for a defined employee group and confirm expected draft review records exist with assigned employee, reviewer, and due date; missing reviewers are returned without incomplete assignments; duplicate initiation creates no duplicate rows.

### Tests for User Story 1

- [x] T031 [P] [US1] Add cycle service tests for create/initiate/missing-reviewer/duplicate behavior in `apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.service.spec.ts`
- [x] T032 [P] [US1] Add cycle controller contract tests for create/initiate/list/summary/close routes in `apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.controller.spec.ts`

### Implementation for User Story 1

- [x] T033 [US1] Implement ReviewCyclesService create/initiate logic in `apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.service.ts`
- [x] T034 [US1] Implement review assignment org snapshot mapping in `apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.service.ts`
- [x] T035 [US1] Implement assignment audit row creation in `apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.service.ts`
- [x] T036 [US1] Implement ReviewCyclesController endpoints in `apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.controller.ts`
- [x] T037 [US1] Wire cycle controller and service providers in `apps/hr-core/src/modules/performance-reviews/performance-reviews.module.ts`
- [x] T038 [US1] Add cycle API client functions in `apps/web/src/lib/api/hr-core.ts`
- [x] T039 [US1] Add HR cycle creation and initiation view in `apps/web/src/pages/performance-reviews.tsx`
- [x] T040 [US1] Add UI handling for missing reviewer and duplicate assignment responses in `apps/web/src/pages/performance-reviews.tsx`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Submit Employee Self-Review (Priority: P2)

**Goal**: Employee can submit all self-review fields during an active/reopened window, with five-point enum validation and edit blocking after submission/closure.

**Independent Test**: Open an assigned active review as the employee, enter all required satisfaction scores, training count, work-life balance, self-rating, and comments, submit it, and confirm status becomes `SUBMITTED`.

### Tests for User Story 2

- [x] T041 [P] [US2] Add self-review service tests for valid submit, invalid enum, closed window, reopened edit, and owner-only access in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.spec.ts`
- [x] T042 [P] [US2] Add self-review controller contract tests for detail and submit routes in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.spec.ts`

### Implementation for User Story 2

- [x] T043 [US2] Implement PerformanceReviewsService findOne and employee row-scope checks in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T044 [US2] Implement PerformanceReviewsService submitSelfReview transaction in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T045 [US2] Implement self-review audit row creation in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T046 [US2] Implement PerformanceReviewsController detail and self-review endpoints in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.ts`
- [x] T047 [US2] Wire reviews controller and service providers in `apps/hr-core/src/modules/performance-reviews/performance-reviews.module.ts`
- [x] T048 [US2] Add self-review API client functions in `apps/web/src/lib/api/hr-core.ts`
- [x] T049 [US2] Replace local-only review loading with API-backed My Reviews data in `apps/web/src/pages/performance-reviews.tsx`
- [x] T050 [US2] Implement employee self-review form and validation states in `apps/web/src/pages/performance-reviews.tsx`
- [x] T051 [US2] Remove production localStorage writes from `apps/web/src/lib/performance-review-store.ts`

**Checkpoint**: User Stories 1 and 2 work independently.

---

## Phase 5: User Story 3 - Complete Manager Review (Priority: P3)

**Goal**: Assigned reviewer can view submitted self-review input, submit manager rating/comments, complete the review, and trigger rating-gap detection.

**Independent Test**: Assign a reviewer to a submitted review, submit manager rating/comments as that reviewer, and confirm the review reaches `COMPLETED`; an unassigned reviewer is denied; a two-point rating gap is flagged.

### Tests for User Story 3

- [x] T052 [P] [US3] Add manager-review service tests for assigned reviewer, unassigned reviewer denial, HR override, and rating-gap detection in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.spec.ts`
- [x] T053 [P] [US3] Add manager-review controller contract tests for manager review submission in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.spec.ts`

### Implementation for User Story 3

- [x] T054 [US3] Implement reviewer row-scope checks in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T055 [US3] Implement PerformanceReviewsService submitManagerReview transaction in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T056 [US3] Implement manager completion audit row and rating-gap response mapping in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T057 [US3] Add manager-review endpoint to `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.ts`
- [x] T058 [US3] Add manager review API client function in `apps/web/src/lib/api/hr-core.ts`
- [x] T059 [US3] Add Assigned to Me manager review view in `apps/web/src/pages/performance-reviews.tsx`
- [x] T060 [US3] Add rating gap visual indicator for completed reviews in `apps/web/src/pages/performance-reviews.tsx`

**Checkpoint**: User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - Track Review Outcomes and Follow-Up (Priority: P4)

**Goal**: HR can filter outcomes, identify overdue/incomplete/rating-gap reviews, reopen or reassign reviews with audit reasons, and record salary follow-up for completed reviews.

**Independent Test**: Complete multiple reviews, filter by period/department/reviewer/rating/status, inspect a record, identify rating gaps and overdue reviews, record salary follow-up, and confirm non-HR users only see authorized reviews.

### Tests for User Story 4

- [x] T061 [P] [US4] Add HR filtering and manager summary service tests in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.spec.ts`
- [x] T062 [P] [US4] Add reopen, reassign, audit, and salary follow-up service tests in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.spec.ts`
- [x] T063 [P] [US4] Add HR outcomes controller contract tests in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.spec.ts`

### Implementation for User Story 4

- [x] T064 [US4] Implement PerformanceReviewsService findAll filters, pagination, overdue flag, and rating-gap filter in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T065 [US4] Implement ReviewCyclesService list, summary, and close operations in `apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.service.ts`
- [x] T066 [US4] Implement reopenReview transaction with required audit reason in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T067 [US4] Implement reassignReviewer transaction with reviewer activity validation in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T068 [US4] Implement recordSalaryFollowUp transaction with optional SalaryHistory link in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T069 [US4] Implement audit retrieval for HR admins in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.ts`
- [x] T070 [US4] Add list, reopen, reassign, salary follow-up, and audit endpoints to `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.ts`
- [x] T071 [US4] Add list, summary, close, reopen, reassign, salary follow-up, and audit API client functions in `apps/web/src/lib/api/hr-core.ts`
- [x] T072 [US4] Add HR Outcomes filters and table in `apps/web/src/pages/performance-reviews.tsx`
- [x] T073 [US4] Add HR reopen, reviewer reassign, and salary follow-up dialogs in `apps/web/src/pages/performance-reviews.tsx`
- [x] T074 [US4] Add role-aware rendering for employee, manager, HR admin, and executive review visibility in `apps/web/src/pages/performance-reviews.tsx`

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation, performance, and integration hardening across the full feature.

- [x] T075 [P] Add end-to-end backend integration scenarios for cycle-initiate, self-submit, manager-complete, HR-filter, and unauthorized access in `apps/hr-core/src/modules/performance-reviews/performance-reviews.integration.spec.ts`
- [x] T076 [P] Add frontend smoke coverage for performance review page states in `apps/web/src/pages/performance-reviews.test.tsx`
- [x] T077 Verify Swagger decorators and response schemas for performance review endpoints in `apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.controller.ts`
- [x] T078 Verify Swagger decorators and response schemas for review endpoints in `apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.ts`
- [x] T079 Run shared package type-check and fix issues in `packages/shared/src/enums/index.ts`
- [x] T080 Run HR Core type-check/test/build and fix issues in `apps/hr-core/src/modules/performance-reviews/`
- [x] T081 Run web type-check/build and fix issues in `apps/web/src/pages/performance-reviews.tsx`
- [x] T082 Validate quickstart workflow and record observed results in `specs/009-performance-review/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2; delivers MVP cycle initiation.
- **Phase 4 US2**: Depends on Phase 2 and a review assignment from US1 for full journey validation.
- **Phase 5 US3**: Depends on Phase 2 and a submitted review from US2 for full journey validation.
- **Phase 6 US4**: Depends on completed/submitted review data from US1-US3 for full reporting validation.
- **Phase 7 Polish**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: No story dependency after foundation; MVP.
- **US2**: Needs review assignment data produced by US1 in real end-to-end flow, but service-level implementation is independently testable with seeded review rows.
- **US3**: Needs submitted review data produced by US2 in real end-to-end flow, but service-level implementation is independently testable with seeded submitted rows.
- **US4**: Best after US1-US3 because filters and follow-up need realistic assigned/submitted/completed data.

### Within Each User Story

- Write tests before implementation and verify they fail when practical.
- DTOs and schema precede services.
- Services precede controllers.
- Controllers precede web API client use.
- API client functions precede page wiring.
- Complete each story checkpoint before moving to the next priority.

---

## Parallel Opportunities

- T001-T006 and T008 can run in parallel.
- T016-T025 can run in parallel after shared enums exist.
- T031 and T032 can run in parallel for US1.
- T041 and T042 can run in parallel for US2.
- T052 and T053 can run in parallel for US3.
- T061-T063 can run in parallel for US4.
- Frontend page work and backend tests can proceed in parallel once API contracts and shared interfaces are stable.
- Polish tests T075 and T076 can run in parallel.

---

## Parallel Example: User Story 1

```bash
Task: "Add cycle service tests for create/initiate/missing-reviewer/duplicate behavior in apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.service.spec.ts"
Task: "Add cycle controller contract tests for create/initiate/list/summary/close routes in apps/hr-core/src/modules/performance-reviews/cycles/review-cycles.controller.spec.ts"
Task: "Add cycle API client functions in apps/web/src/lib/api/hr-core.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add self-review controller contract tests for detail and submit routes in apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.spec.ts"
Task: "Add self-review API client functions in apps/web/src/lib/api/hr-core.ts"
Task: "Remove production localStorage writes from apps/web/src/lib/performance-review-store.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add manager-review controller contract tests for manager review submission in apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.spec.ts"
Task: "Add manager review API client function in apps/web/src/lib/api/hr-core.ts"
Task: "Add Assigned to Me manager review view in apps/web/src/pages/performance-reviews.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "Add HR filtering and manager summary service tests in apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.service.spec.ts"
Task: "Add HR outcomes controller contract tests in apps/hr-core/src/modules/performance-reviews/reviews/performance-reviews.controller.spec.ts"
Task: "Add HR Outcomes filters and table in apps/web/src/pages/performance-reviews.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 User Story 1.
4. Validate cycle initiation with assigned reviews, missing reviewer handling, and duplicate prevention.
5. Demo HR cycle creation/initiation before adding self-review and manager review.

### Incremental Delivery

1. US1 creates review assignments.
2. US2 lets employees submit self-review data.
3. US3 lets managers complete the review and flags rating gaps.
4. US4 gives HR reporting, reopen/reassign, and salary follow-up.
5. Polish runs full verification and Swagger/manual checks.

### Parallel Team Strategy

1. One engineer handles shared enums/schema/Prisma foundation.
2. One engineer writes backend service/controller tests from the contract.
3. One engineer prepares web API client and page structure.
4. After foundation, US1-US4 can be split by backend service method and web surface, with `apps/web/src/lib/api/hr-core.ts` changes coordinated to avoid conflicts.

---

## Notes

- [P] tasks use different files or can be completed without waiting for another incomplete task in the same phase.
- Shared enums must be reconciled before DTOs or generated client code that imports them.
- `apps/web/src/lib/api/hr-core.ts` is touched in multiple stories; coordinate edits or land story slices sequentially.
- Preserve unrelated dirty worktree changes while implementing these tasks.
