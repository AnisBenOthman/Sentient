# Phase 0 Research: Performance Review

This document resolves planning decisions before schema and contract design.

---

## R-001: Review cycle as first-class aggregate

**Decision**: Add a `PerformanceReviewCycle` table. A cycle owns the review period, submission window, due date, type, active/closed state, and optional population filters. `PerformanceReview` references one cycle through `cycleId`.

**Rationale**: The spec requires active review windows, duplicate prevention for the same period/population, overdue tracking, and HR initiation for a set of eligible employees. A first-class cycle makes those constraints explicit instead of encoding them in dates on each review.

**Alternatives considered**:
- Only store `reviewDate` on `PerformanceReview`: too weak for duplicate prevention, active window rules, and cycle-level reporting.
- Store cycle metadata as JSON on reviews: harder to query and validate.

---

## R-002: One review row per employee per cycle

**Decision**: `PerformanceReview` is both the assignment and the completed record. It starts in `PENDING`, progresses as the employee and manager submit, and is preserved permanently for history. Enforce `@@unique([employeeId, cycleId])`.

**Rationale**: The class diagram centers one `PerformanceReview` record with employee, reviewer, review date, ratings, satisfaction scores, comments, and timestamps. Using one row avoids an unnecessary assignment table while still supporting lifecycle status.

**Alternatives considered**:
- Separate `ReviewAssignment` and `PerformanceReview`: extra join and more state synchronization with no functional benefit for this workflow.
- Append-only event stream only: valuable later, but too heavy for the current CRUD/reporting needs.

---

## R-003: Enum reconciliation with class diagram

**Decision**: Use the core HRIS class diagram names as the source of truth:
- `SatisfactionLevel`: `VERY_DISSATISFIED`, `DISSATISFIED`, `NEUTRAL`, `SATISFIED`, `VERY_SATISFIED`
- `PerformanceRating`: `UNACCEPTABLE`, `NEEDS_IMPROVEMENT`, `MEETS_EXPECTATIONS`, `EXCEEDS_EXPECTATIONS`, `ABOVE_AND_BEYOND`
- `ReviewStatus`: `PENDING`, `IN_PROGRESS`, `SUBMITTED`, `COMPLETED`, plus `REOPENED`, `CANCELLED`, and `CLOSED` for workflow control
- `ReviewType`: `ANNUAL`, `MID_YEAR`, `PROBATION`

Prisma stores enums as strings. Numeric 1-5 ordering is represented in `EnumMeta` rows and in UI option order, not by integer database values.

**Rationale**: Existing shared `PerformanceRating` and `ReviewStatus` names drift from the class diagram and the web local store already uses the diagram's 1-5 meaning. Standardizing now prevents a mismatch between API, web, and database.

**Alternatives considered**:
- Keep existing shared `EXCEPTIONAL`/`UNSATISFACTORY` labels and map to class diagram values in DTOs: creates long-term translation debt.
- Store numeric ratings only: loses semantic readability in Prisma, queries, and API responses.

---

## R-004: Eligibility and reviewer assignment

**Decision**: Cycle initiation selects active employees by optional organization filters: business unit, department, team, position, and employee id list. The default reviewer is `Employee.managerId`. HR can override reviewer during initiation or later reassign a pending/in-progress review. Employees without a resolved reviewer are skipped and returned in an `unassigned` list for HR resolution.

**Rationale**: The spec requires missing reviewer handling and manager-change stability. Capturing `reviewerId` on the review row freezes the assignment until HR explicitly changes it.

**Alternatives considered**:
- Always derive reviewer from current `managerId` at read time: manager changes would silently alter active reviews.
- Create incomplete rows with null reviewer: weakens reviewer access rules and creates dangling assignments.

---

## R-005: State machine

**Decision**: Use this state flow:

```text
PENDING -> IN_PROGRESS -> SUBMITTED -> COMPLETED -> CLOSED
             |              |             |
             +--------------+-------------+-> REOPENED -> IN_PROGRESS or SUBMITTED
PENDING/IN_PROGRESS/SUBMITTED -> CANCELLED
```

`PENDING` means assigned but no employee submission. `IN_PROGRESS` means the employee saved or started work, if draft save is implemented. `SUBMITTED` means employee portion is complete and manager review is open. `COMPLETED` means manager rating/comments are submitted. `CLOSED` means HR has locked the cycle outcome. `REOPENED` records that HR reopened a submitted/completed review with a reason; after update it returns to the appropriate active state.

**Rationale**: This covers spec states and the domain diagram's `ReviewStatus` enum while adding explicit reopen/closure control for auditability.

**Alternatives considered**:
- Only `PENDING`, `SUBMITTED`, `COMPLETED`: insufficient to represent HR closure, cancellation, or reopened edits.
- Separate employee and manager status fields: queryable, but too easy to put into contradictory combinations.

---

## R-006: Review comments and audit trail

**Decision**: Store employee comments separately from manager comments. Add `PerformanceReviewAudit` append-only rows for cycle initiation, self submission, manager completion, reviewer reassignment, HR reopen, HR closure, cancellation, and salary follow-up recording.

**Rationale**: The class diagram has one `comments` field, but the workflow has two authors and different access needs. Separate comment fields keep attribution clear while preserving a derived `comments` view if needed.

**Alternatives considered**:
- One combined comments field: overwrites or conflates employee and reviewer input.
- Full audit JSON snapshots on every edit: useful later, but more storage and masking work than the current scope needs.

---

## R-007: Access control and privacy

**Decision**:
- Employee: can read their own reviews and submit their self-review during the active window or after HR reopen.
- Reviewer/Manager: can read and complete reviews assigned to them; can view manager summary for assigned reviews.
- HR admin: can initiate cycles, read/filter all reviews, resolve missing reviewer assignments, reassign reviewer, reopen/close/cancel reviews, and record salary follow-up.
- Executive: read-only aggregate/list visibility when RBAC grants global or business-unit scope.

Services apply scope filters in addition to controller roles because review comments and ratings are sensitive HR records.

**Rationale**: Global guards authenticate the request, but review-specific row scope is domain logic.

**Alternatives considered**:
- Rely only on role decorators: insufficient for "reviewer sees assigned reviews only".
- Hide manager comments from employee forever: not specified; for MVP, employee access to completed review can include final manager comment unless HR policy later says otherwise.

---

## R-008: Salary follow-up coupling

**Decision**: A completed review can record one or more `PerformanceReviewSalaryFollowUp` rows with `reason`, `salaryHistoryId` optional, `createdById`, and `createdAt`. If an actual salary change is created elsewhere, it should use existing `SalaryHistory.reason = ANNUAL_REVIEW` or `OTHER` with `reasonComment`, and may later back-link through `salaryHistoryId`.

**Rationale**: The spec says salary changes are outside the review itself, but HR must record post-review follow-up. Keeping a follow-up table avoids coupling the review module to compensation mutation paths.

**Alternatives considered**:
- Create salary history directly from the review endpoint: too broad and risks mixing performance access with compensation write permissions.
- Store only a boolean on PerformanceReview: loses reason/history and cannot represent multiple follow-up actions.

---

## R-009: Query and indexing strategy

**Decision**: Add indexes for common filters:
- `PerformanceReview(cycleId, status)`
- `PerformanceReview(employeeId, reviewDate)`
- `PerformanceReview(reviewerId, status, dueDate)`
- `PerformanceReview(managerRating)`
- `PerformanceReview(departmentId, positionId, reviewDate)` as denormalized snapshot fields captured at initiation

Store department, team, position, and business unit snapshots on each review to make historical HR reporting stable even when an employee later moves.

**Rationale**: HR filters by organizational context and historical reports should not mutate when current employee assignment changes.

**Alternatives considered**:
- Join current Employee, Department, Position on every report: cheaper schema, but historically misleading after org changes.
- Materialized reporting table: premature for 20k rows/year.

---

## R-010: Web implementation path

**Decision**: Replace `apps/web/src/lib/performance-review-store.ts` localStorage storage with API-backed calls and TanStack Query cache helpers. Keep `apps/web/src/pages/performance-reviews.tsx` as the main route but reshape it into operational views: HR cycles, assigned reviews, self-review form, manager review form, and HR outcome filters.

**Rationale**: A local-only page already exists and uses the correct 1-5 satisfaction/rating model. Reusing the route avoids navigation churn while making the feature real.

**Alternatives considered**:
- Leave web localStorage as-is and implement backend only: does not satisfy user workflows in the running app.
- Create a completely new web route: unnecessary duplication.

---

## Summary of decisions

| # | Topic | Decision |
|---|-------|----------|
| R-001 | Review cycle | First-class `PerformanceReviewCycle` |
| R-002 | Assignment | One `PerformanceReview` per employee per cycle |
| R-003 | Enums | Class diagram labels as source of truth; order via `EnumMeta` |
| R-004 | Reviewer | Snapshot reviewer at initiation; HR resolves/reassigns |
| R-005 | Status | Explicit workflow states including reopen/cancel/close |
| R-006 | Comments/audit | Separate employee and manager comments plus audit rows |
| R-007 | Access | Role plus row-scope service enforcement |
| R-008 | Salary | Separate follow-up rows, optional SalaryHistory link |
| R-009 | Reporting | Indexes plus org snapshot fields |
| R-010 | Web | Replace local store with API-backed route |
