# Data Model: Performance Review

**Branch**: `009-performance-review` | **Date**: 2026-05-09
**Schema**: `hr_core`

## Entities

### PerformanceReviewCycle

HR-defined review period and active submission window.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, generated | |
| name | String | required, unique per period/type | Example: `2026 Annual Review` |
| reviewType | ReviewType | required | `ANNUAL`, `MID_YEAR`, `PROBATION` |
| periodStart | DateTime | required, date-only semantics | Review period start |
| periodEnd | DateTime | required, date-only semantics | Must be after periodStart |
| selfReviewOpensAt | DateTime | required | Employee submission window opens |
| selfReviewClosesAt | DateTime | required | Employee submission window closes |
| managerReviewDueAt | DateTime | required | Reviewer due date |
| status | ReviewCycleStatus | required, default `DRAFT` | `DRAFT`, `ACTIVE`, `CLOSED`, `CANCELLED` |
| createdById | UUID | required | HR user/employee id initiating cycle |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |
| closedAt | DateTime | optional | Set on HR close |
| cancelledAt | DateTime | optional | Set on cancellation |

**Indexes and constraints**:
- `@@unique([reviewType, periodStart, periodEnd, name])`
- `@@index([status, selfReviewOpensAt, selfReviewClosesAt])`
- `@@index([reviewType, periodStart, periodEnd])`

**Relations**:
- `reviews` -> `PerformanceReview[]`
- `createdBy` -> `Employee` or user id reference depending on existing IAM linkage

**Table**: `performance_review_cycles`

---

### PerformanceReview

One employee's review assignment and final review record for a cycle.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, generated | |
| cycleId | UUID | FK, required | `PerformanceReviewCycle.id` |
| employeeId | UUID | FK, required | Reviewed employee |
| reviewerId | UUID | FK, required | Assigned reviewer; normally employee manager |
| reviewDate | DateTime | required | Defaults to cycle period end or manager completion date |
| dueDate | DateTime | required | Defaults to cycle manager due date |
| status | ReviewStatus | required, default `PENDING` | Workflow state |
| businessUnitId | UUID | optional snapshot | Employee org context at assignment |
| businessUnitName | String | optional snapshot | For historical reporting |
| departmentId | UUID | optional snapshot | |
| departmentName | String | optional snapshot | |
| teamId | UUID | optional snapshot | |
| teamName | String | optional snapshot | |
| positionId | UUID | optional snapshot | |
| positionTitle | String | optional snapshot | |
| environmentSatisfaction | SatisfactionLevel | optional until self submission | Five-point scale |
| jobSatisfaction | SatisfactionLevel | optional until self submission | Five-point scale |
| relationshipSatisfaction | SatisfactionLevel | optional until self submission | Five-point scale |
| trainingOpportunitiesTaken | Int | optional until self submission, min 0 | |
| workLifeBalance | SatisfactionLevel | optional until self submission | Five-point scale |
| selfRating | PerformanceRating | optional until self submission | Five-point scale |
| managerRating | PerformanceRating | optional until manager completion | Five-point scale |
| employeeComments | String | optional, max 4000 | Employee-authored |
| managerComments | String | optional, max 4000 | Reviewer-authored |
| submittedAt | DateTime | optional | Employee submitted |
| submittedById | UUID | optional | Employee actor |
| completedAt | DateTime | optional | Reviewer submitted |
| completedById | UUID | optional | Reviewer actor |
| reopenedAt | DateTime | optional | Last HR reopen timestamp |
| reopenedById | UUID | optional | HR actor |
| reopenReason | String | optional, max 1000 | Required on reopen |
| closedAt | DateTime | optional | HR locked the outcome |
| closedById | UUID | optional | HR actor |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**Indexes and constraints**:
- `@@unique([employeeId, cycleId])`
- `@@index([cycleId, status])`
- `@@index([employeeId, reviewDate])`
- `@@index([reviewerId, status, dueDate])`
- `@@index([departmentId, positionId, reviewDate])`
- `@@index([managerRating])`
- Optional raw SQL CHECK constraints:
  - `training_opportunities_taken >= 0`
  - manager completion requires `manager_rating IS NOT NULL`
  - employee submission requires all self-review scale fields

**Relations**:
- `cycle` -> `PerformanceReviewCycle`
- `employee` -> `Employee` relation name `EmployeePerformanceReviews`
- `reviewer` -> `Employee` relation name `ReviewerPerformanceReviews`
- `audits` -> `PerformanceReviewAudit[]`
- `salaryFollowUps` -> `PerformanceReviewSalaryFollowUp[]`

**Table**: `performance_reviews`

---

### PerformanceReviewAudit

Append-only audit journal for key review actions.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, generated | |
| reviewId | UUID | FK, required | |
| action | PerformanceReviewAuditAction | required | `CYCLE_CREATED`, `ASSIGNED`, `SELF_SUBMITTED`, `MANAGER_COMPLETED`, `REVIEWER_REASSIGNED`, `REOPENED`, `CLOSED`, `CANCELLED`, `SALARY_FOLLOW_UP_RECORDED` |
| actorId | UUID | required | Employee/user performing the action |
| fromStatus | ReviewStatus | optional | |
| toStatus | ReviewStatus | optional | |
| reason | String | optional, max 1000 | Required for reopen/cancel/reassign where applicable |
| metadata | Json | optional | Small contextual payload such as old/new reviewer id |
| createdAt | DateTime | auto | |

**Indexes**:
- `@@index([reviewId, createdAt])`
- `@@index([actorId, createdAt])`
- `@@index([action, createdAt])`

**Mutation policy**: insert-only from application code.

**Table**: `performance_review_audits`

---

### PerformanceReviewSalaryFollowUp

Tracks compensation follow-up caused by a completed review without owning salary mutation.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, generated | |
| reviewId | UUID | FK, required | Must reference completed review |
| salaryHistoryId | UUID | optional | Link to `SalaryHistory.id` when a pay change exists |
| reason | String | required, max 1000 | HR-entered reason, default option can be Annual review |
| createdById | UUID | required | HR actor |
| createdAt | DateTime | auto | |

**Indexes**:
- `@@index([reviewId])`
- `@@index([salaryHistoryId])`
- `@@index([createdById, createdAt])`

**Table**: `performance_review_salary_followups`

---

## Enum Additions and Updates

### SatisfactionLevel

```text
VERY_DISSATISFIED
DISSATISFIED
NEUTRAL
SATISFIED
VERY_SATISFIED
```

Ordering is stored in `EnumMeta`:

| Key | Rank |
|-----|------|
| VERY_DISSATISFIED | 1 |
| DISSATISFIED | 2 |
| NEUTRAL | 3 |
| SATISFIED | 4 |
| VERY_SATISFIED | 5 |

### PerformanceRating

```text
UNACCEPTABLE
NEEDS_IMPROVEMENT
MEETS_EXPECTATIONS
EXCEEDS_EXPECTATIONS
ABOVE_AND_BEYOND
```

Ordering is stored in `EnumMeta`:

| Key | Rank |
|-----|------|
| UNACCEPTABLE | 1 |
| NEEDS_IMPROVEMENT | 2 |
| MEETS_EXPECTATIONS | 3 |
| EXCEEDS_EXPECTATIONS | 4 |
| ABOVE_AND_BEYOND | 5 |

### ReviewStatus

```text
PENDING
IN_PROGRESS
SUBMITTED
COMPLETED
REOPENED
CLOSED
CANCELLED
```

### ReviewType

```text
ANNUAL
MID_YEAR
PROBATION
```

### ReviewCycleStatus

```text
DRAFT
ACTIVE
CLOSED
CANCELLED
```

### PerformanceReviewAuditAction

```text
CYCLE_CREATED
ASSIGNED
SELF_SUBMITTED
MANAGER_COMPLETED
REVIEWER_REASSIGNED
REOPENED
CLOSED
CANCELLED
SALARY_FOLLOW_UP_RECORDED
```

---

## Employee Model Additions

The existing `Employee` model gains Prisma back-relations only:

| Relation | Type | Reverse of |
|----------|------|------------|
| performanceReviews | PerformanceReview[] | `PerformanceReview.employeeId` |
| reviewsToComplete | PerformanceReview[] | `PerformanceReview.reviewerId` |

No existing Employee scalar column is required for this feature.

---

## State Transitions

### Cycle initiation

1. HR creates or activates a cycle.
2. Service resolves eligible active employees using filters.
3. For each employee:
   - If `managerId` or HR override reviewer exists, create `PerformanceReview`.
   - If no reviewer exists, skip row creation and return employee in `unassigned`.
   - Snapshot employee org context on the review.
4. Unique `(employeeId, cycleId)` prevents duplicate assignment even under retry.
5. Insert audit rows for cycle creation and each assignment.

### Self-review submission

Allowed when:
- caller is the reviewed employee
- cycle status is `ACTIVE`
- current time is within self-review window or review was reopened by HR
- review status is `PENDING`, `IN_PROGRESS`, or `REOPENED`

Effects:
- Validate all satisfaction values and self rating are provided.
- Validate `trainingOpportunitiesTaken >= 0`.
- Set self-review fields and employee comments.
- Set `submittedAt`, `submittedById`, and status `SUBMITTED`.
- Insert audit row.

### Manager review completion

Allowed when:
- caller is the assigned reviewer or HR admin
- review status is `SUBMITTED` or `REOPENED`
- manager rating and manager comments are valid

Effects:
- Set manager rating/comments.
- Set `completedAt`, `completedById`, and status `COMPLETED`.
- Insert audit row.
- Rating gap is derived when absolute rank difference between `managerRating` and `selfRating` is at least 2.

### HR reopen

Allowed when:
- caller is HR admin
- review status is `SUBMITTED`, `COMPLETED`, or `CLOSED`
- reason is present

Effects:
- Set `reopenedAt`, `reopenedById`, `reopenReason`.
- Set status `REOPENED`.
- Insert audit row.

### HR close/cancel

Close locks completed outcomes at cycle end. Cancel stops a pending/in-progress/submitted review for inactive employee or HR exception. Both actions require an audit row.

---

## Domain Events

Events are useful for downstream notification and analytics consumers but do not add a new service dependency.

| Event | Trigger | Payload |
|-------|---------|---------|
| `performance.review.assigned` | Review assignment created | `{ reviewId, cycleId, employeeId, reviewerId, dueDate }` |
| `performance.review.self_submitted` | Employee submits | `{ reviewId, cycleId, employeeId, submittedAt }` |
| `performance.review.completed` | Reviewer completes | `{ reviewId, cycleId, employeeId, reviewerId, managerRating, ratingGap }` |
| `performance.review.reopened` | HR reopens | `{ reviewId, reopenedById, reason }` |
| `performance.review.salary_follow_up_recorded` | HR records follow-up | `{ reviewId, followUpId, salaryHistoryId? }` |

---

## Data Volume Assumptions

- 10k active employees.
- 1-2 cycles per year.
- Around 20k review rows/year.
- Audit rows average 3-5 per review.
- Indexes above are enough for MVP reporting without a materialized summary table.
