# Phase 1 — Data Model: OKR (Objectives & Key Results) Module

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)
**Date**: 2026-05-17

**Four** new tables (`OkrCycle`, `Objective`, `KeyResult`, `OkrCheckIn`) plus a small audit table (`KeyResultStatusHistory` — see §2.5) in the `hr_core` schema, seven new enums. The conceptual fifth entity `OkrAlignment` is **not** a table — it is modelled via `Objective.parentObjectiveId`. No changes to existing tables beyond back-relations on `User` and `Department`. No cross-schema relationships.

> **Note on OkrAlignment**: The spec lists "OkrAlignment" as a fifth entity to design. The decision (locked in spec.md "Key Entities") is that alignment is **not** a separate table — it is modelled by `Objective.parentObjectiveId`. The alignment tree (company → department → employee) is reconstructed by recursive walks over that column. This section documents the four physical tables that DO exist.

---

## 1. Enums (shared package + Prisma)

All seven enums live in `packages/shared/src/enums/` (single source of truth) and are mirrored in `apps/hr-core/prisma/schema.prisma` with `@@schema("hr_core")` so they exist as PostgreSQL types in the `hr_core` schema.

### `OkrCycleType`

```ts
export enum OkrCycleType {
  ANNUAL = 'ANNUAL',
  QUARTERLY = 'QUARTERLY',
}
```

### `OkrCycleStatus`

```ts
export enum OkrCycleStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}
```

Allowed transitions: `DRAFT → ACTIVE`, `ACTIVE → CLOSED`. No transition out of `CLOSED`. `DRAFT → CLOSED` (skip ACTIVE) is allowed for cycles that were created in error and never activated.

### `ObjectiveLevel`

```ts
export enum ObjectiveLevel {
  COMPANY = 'COMPANY',
  DEPARTMENT = 'DEPARTMENT',
  EMPLOYEE = 'EMPLOYEE',
}
```

Cascading rule (FR-008, FR-009): `EMPLOYEE.parentObjective.level == 'DEPARTMENT'` AND `DEPARTMENT.parentObjective.level == 'COMPANY'`. `COMPANY` has `parentObjectiveId = null`. Enforced in `ObjectivesService.create`.

### `ObjectiveStatus`

```ts
export enum ObjectiveStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}
```

Allowed transitions: `DRAFT → ACTIVE`, `ACTIVE → CLOSED`, `* → CANCELLED` (soft delete). No transition out of `CLOSED` or `CANCELLED`.

### `KeyResultMetricType`

```ts
export enum KeyResultMetricType {
  PERCENTAGE = 'PERCENTAGE',
  NUMBER = 'NUMBER',
  CURRENCY = 'CURRENCY',
  BOOLEAN = 'BOOLEAN',
}
```

### `KeyResultStatus`

```ts
export enum KeyResultStatus {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  BEHIND = 'BEHIND',
  ACHIEVED = 'ACHIEVED',
  CANCELLED = 'CANCELLED',
}
```

`AT_RISK` here is the **manually set** status (a Manager explicitly marks the KR as at-risk because of an external blocker). The **computed** at-risk flag is a derived `isAtRisk` boolean on the dashboard query (research R8) and does not overwrite the stored status.

### `OkrCheckInStatus`

```ts
export enum OkrCheckInStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
```

Allowed transitions: `PENDING → APPROVED`, `PENDING → REJECTED`. `APPROVED` and `REJECTED` are terminal. Auto-approval (FR-016) sets `APPROVED` directly on creation, bypassing `PENDING`.

---

## 2. Prisma models

```prisma
enum OkrCycleType {
  ANNUAL
  QUARTERLY

  @@schema("hr_core")
}

enum OkrCycleStatus {
  DRAFT
  ACTIVE
  CLOSED

  @@schema("hr_core")
}

enum ObjectiveLevel {
  COMPANY
  DEPARTMENT
  EMPLOYEE

  @@schema("hr_core")
}

enum ObjectiveStatus {
  DRAFT
  ACTIVE
  CLOSED
  CANCELLED

  @@schema("hr_core")
}

enum KeyResultMetricType {
  PERCENTAGE
  NUMBER
  CURRENCY
  BOOLEAN

  @@schema("hr_core")
}

enum KeyResultStatus {
  ON_TRACK
  AT_RISK
  BEHIND
  ACHIEVED
  CANCELLED

  @@schema("hr_core")
}

enum OkrCheckInStatus {
  PENDING
  APPROVED
  REJECTED

  @@schema("hr_core")
}

model OkrCycle {
  id              String          @id @default(uuid()) @db.Uuid
  name            String          @db.VarChar(64)
  type            OkrCycleType
  year            Int
  quarter         Int?            @db.SmallInt
  status          OkrCycleStatus  @default(DRAFT)
  startDate       DateTime        @map("start_date") @db.Date
  endDate         DateTime        @map("end_date") @db.Date
  parentCycleId   String?         @map("parent_cycle_id") @db.Uuid
  createdById     String          @map("created_by_id") @db.Uuid
  activatedAt     DateTime?       @map("activated_at") @db.Timestamptz(6)
  activatedById   String?         @map("activated_by_id") @db.Uuid
  closedAt        DateTime?       @map("closed_at") @db.Timestamptz(6)
  closedById      String?         @map("closed_by_id") @db.Uuid
  createdAt       DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)

  parentCycle     OkrCycle?       @relation("OkrCycleChildren", fields: [parentCycleId], references: [id], onDelete: SetNull)
  childCycles     OkrCycle[]      @relation("OkrCycleChildren")
  objectives      Objective[]
  createdBy       User            @relation("UserCreatedOkrCycles", fields: [createdById], references: [id])
  activatedBy     User?           @relation("UserActivatedOkrCycles", fields: [activatedById], references: [id], onDelete: SetNull)
  closedBy        User?           @relation("UserClosedOkrCycles", fields: [closedById], references: [id], onDelete: SetNull)

  @@unique([name], name: "uq_okr_cycle_name")
  @@index([type, year, status], name: "idx_okr_cycle_type_year_status")
  @@index([parentCycleId], name: "idx_okr_cycle_parent")
  @@index([status, endDate], name: "idx_okr_cycle_status_end")
  @@map("okr_cycles")
  @@schema("hr_core")
}

model Objective {
  id                String          @id @default(uuid()) @db.Uuid
  title             String          @db.VarChar(200)
  description       String?         @db.VarChar(2000)
  level             ObjectiveLevel
  cycleId           String          @map("cycle_id") @db.Uuid
  parentObjectiveId String?         @map("parent_objective_id") @db.Uuid
  ownerId           String?         @map("owner_id") @db.Uuid     // userId for EMPLOYEE-level; null for COMPANY/DEPARTMENT
  departmentId      String?         @map("department_id") @db.Uuid // FK to Department; required for DEPARTMENT; denormalised on EMPLOYEE
  status            ObjectiveStatus @default(DRAFT)
  createdById       String          @map("created_by_id") @db.Uuid
  activatedAt       DateTime?       @map("activated_at") @db.Timestamptz(6)
  activatedById     String?         @map("activated_by_id") @db.Uuid
  closedAt          DateTime?       @map("closed_at") @db.Timestamptz(6)
  closedById        String?         @map("closed_by_id") @db.Uuid
  cancelledAt       DateTime?       @map("cancelled_at") @db.Timestamptz(6)
  cancelledById     String?         @map("cancelled_by_id") @db.Uuid
  createdAt         DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)

  cycle             OkrCycle        @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  parentObjective   Objective?      @relation("ObjectiveAlignment", fields: [parentObjectiveId], references: [id], onDelete: SetNull)
  childObjectives   Objective[]     @relation("ObjectiveAlignment")
  department        Department?     @relation("DepartmentObjectives", fields: [departmentId], references: [id], onDelete: SetNull)
  owner             User?           @relation("UserOwnedObjectives", fields: [ownerId], references: [id], onDelete: SetNull)
  createdBy         User            @relation("UserCreatedObjectives", fields: [createdById], references: [id])
  activatedBy       User?           @relation("UserActivatedObjectives", fields: [activatedById], references: [id], onDelete: SetNull)
  closedBy          User?           @relation("UserClosedObjectives", fields: [closedById], references: [id], onDelete: SetNull)
  cancelledBy       User?           @relation("UserCancelledObjectives", fields: [cancelledById], references: [id], onDelete: SetNull)
  keyResults        KeyResult[]

  @@index([cycleId, level, status], name: "idx_objective_cycle_level_status")
  @@index([parentObjectiveId], name: "idx_objective_parent")
  @@index([departmentId, level], name: "idx_objective_dept_level")
  @@index([ownerId, level], name: "idx_objective_owner_level")
  @@map("objectives")
  @@schema("hr_core")
}

model KeyResult {
  id            String              @id @default(uuid()) @db.Uuid
  objectiveId   String              @map("objective_id") @db.Uuid
  title         String              @db.VarChar(200)
  metricType    KeyResultMetricType @map("metric_type")
  targetValue   Decimal             @map("target_value") @db.Decimal(18, 4)
  currentValue  Decimal             @default(0) @map("current_value") @db.Decimal(18, 4)
  unit          String              @db.VarChar(32)
  score         Decimal             @default(0) @db.Decimal(3, 2)
  assigneeIds   String[]            @map("assignee_ids") @db.Uuid
  dueDate       DateTime?           @map("due_date") @db.Date
  status        KeyResultStatus     @default(ON_TRACK)
  createdAt     DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)

  objective     Objective           @relation(fields: [objectiveId], references: [id], onDelete: Cascade)
  checkIns      OkrCheckIn[]

  @@index([objectiveId, status], name: "idx_kr_objective_status")
  @@map("key_results")
  @@schema("hr_core")
}

model OkrCheckIn {
  id            String            @id @default(uuid()) @db.Uuid
  keyResultId   String            @map("key_result_id") @db.Uuid
  employeeId    String            @map("employee_id") @db.Uuid    // logical FK to Employee.id
  value         Decimal           @db.Decimal(18, 4)
  score         Decimal           @db.Decimal(3, 2)
  comment       String?           @db.VarChar(2000)
  status        OkrCheckInStatus  @default(PENDING)
  reviewedById  String?           @map("reviewed_by_id") @db.Uuid  // null when auto-approved
  reviewedAt    DateTime?         @map("reviewed_at") @db.Timestamptz(6)
  rejectionReason String?         @map("rejection_reason") @db.VarChar(2000)
  createdAt     DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)

  keyResult     KeyResult         @relation(fields: [keyResultId], references: [id], onDelete: Cascade)
  reviewedBy    User?             @relation("UserReviewedOkrCheckIns", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([keyResultId, createdAt(sort: Desc)], name: "idx_checkin_kr_created")
  @@index([status, keyResultId], name: "idx_checkin_status_kr")
  @@index([employeeId, createdAt(sort: Desc)], name: "idx_checkin_employee_created")
  @@map("okr_check_ins")
  @@schema("hr_core")
}

// FR-034 audit trail for KR status transitions.
// Cycle and Objective transitions are captured by `activatedBy/closedBy/cancelledBy` columns on those models;
// KRs churn through more statuses (ON_TRACK ↔ AT_RISK ↔ BEHIND ↔ ACHIEVED ↔ CANCELLED), so we record each
// transition as a row here. One row per status change; immutable (no UPDATE/DELETE).
model KeyResultStatusHistory {
  id           String          @id @default(uuid()) @db.Uuid
  keyResultId  String          @map("key_result_id") @db.Uuid
  fromStatus   KeyResultStatus? @map("from_status")          // null for the first row (initial ON_TRACK)
  toStatus     KeyResultStatus  @map("to_status")
  changedById  String?         @map("changed_by_id") @db.Uuid // null when system-induced (score auto-flip, cascade cancel)
  reason       String?         @db.VarChar(2000)
  changedAt    DateTime        @default(now()) @map("changed_at") @db.Timestamptz(6)

  keyResult    KeyResult       @relation(fields: [keyResultId], references: [id], onDelete: Cascade)
  changedBy    User?           @relation("UserChangedKeyResultStatus", fields: [changedById], references: [id], onDelete: SetNull)

  @@index([keyResultId, changedAt(sort: Desc)], name: "idx_kr_status_history_kr_changed")
  @@map("key_result_status_history")
  @@schema("hr_core")
}
```

Existing `User` and `Department` models gain the inverse sides (each a single line):

```prisma
// User model
ownedObjectives          Objective[]              @relation("UserOwnedObjectives")
createdObjectives        Objective[]              @relation("UserCreatedObjectives")
activatedObjectives      Objective[]              @relation("UserActivatedObjectives")
closedObjectives         Objective[]              @relation("UserClosedObjectives")
cancelledObjectives      Objective[]              @relation("UserCancelledObjectives")
createdOkrCycles         OkrCycle[]               @relation("UserCreatedOkrCycles")
activatedOkrCycles       OkrCycle[]               @relation("UserActivatedOkrCycles")
closedOkrCycles          OkrCycle[]               @relation("UserClosedOkrCycles")
reviewedOkrCheckIns      OkrCheckIn[]             @relation("UserReviewedOkrCheckIns")
changedKeyResultStatuses KeyResultStatusHistory[] @relation("UserChangedKeyResultStatus")

// Department model
objectives        Objective[]    @relation("DepartmentObjectives")
```

> Note: `OkrCheckIn.employeeId` is a logical FK to `Employee.id` (no Prisma `@relation` declared). This mirrors the project's existing pattern for performance reasons and keeps the table independent of `Employee`'s cascade behaviour. The link is enforced at the application layer.

### Additional migration SQL (the parts Prisma cannot express directly)

After `npx prisma migrate dev --name add_okrs`, append the following raw SQL to the generated `migration.sql`:

```sql
-- Score range invariants (belt-and-braces; DTOs validate too)
ALTER TABLE "hr_core"."key_results"
  ADD CONSTRAINT "ck_kr_score_range"
  CHECK ("score" >= 0 AND "score" <= 1);

ALTER TABLE "hr_core"."okr_check_ins"
  ADD CONSTRAINT "ck_checkin_score_range"
  CHECK ("score" >= 0 AND "score" <= 1);

-- Current value must be non-negative (transitively enforced by score range + positive target,
-- but a dedicated CHECK is cheap belt-and-braces and aligns with plan.md §1.1).
ALTER TABLE "hr_core"."key_results"
  ADD CONSTRAINT "ck_kr_current_value_nonneg"
  CHECK ("current_value" >= 0);

-- Target value must be > 0 for non-BOOLEAN metrics; BOOLEAN target is conventionally 1
ALTER TABLE "hr_core"."key_results"
  ADD CONSTRAINT "ck_kr_target_positive"
  CHECK (
    ("metric_type" = 'BOOLEAN' AND "target_value" = 1)
    OR ("metric_type" <> 'BOOLEAN' AND "target_value" > 0)
  );

-- Quarter is 1..4 when set; null for ANNUAL
ALTER TABLE "hr_core"."okr_cycles"
  ADD CONSTRAINT "ck_cycle_quarter_range"
  CHECK (
    ("type" = 'ANNUAL' AND "quarter" IS NULL)
    OR ("type" = 'QUARTERLY' AND "quarter" BETWEEN 1 AND 4)
  );

-- A QUARTERLY cycle MAY reference an ANNUAL parent; ANNUAL cycles MUST NOT have a parent
ALTER TABLE "hr_core"."okr_cycles"
  ADD CONSTRAINT "ck_cycle_parent_type"
  CHECK (
    ("type" = 'ANNUAL' AND "parent_cycle_id" IS NULL)
    OR ("type" = 'QUARTERLY')
  );

-- COMPANY Objectives have no parent, no department, no owner.
-- DEPARTMENT Objectives have a parent and a department, no owner.
-- EMPLOYEE Objectives have a parent, a department (denormalised), and an owner.
ALTER TABLE "hr_core"."objectives"
  ADD CONSTRAINT "ck_objective_level_invariants"
  CHECK (
    ("level" = 'COMPANY' AND "parent_objective_id" IS NULL AND "department_id" IS NULL AND "owner_id" IS NULL)
    OR ("level" = 'DEPARTMENT' AND "parent_objective_id" IS NOT NULL AND "department_id" IS NOT NULL AND "owner_id" IS NULL)
    OR ("level" = 'EMPLOYEE' AND "parent_objective_id" IS NOT NULL AND "owner_id" IS NOT NULL)
  );

-- Extend the existing notification_category enum with 'OKR' (research R5)
ALTER TYPE "hr_core"."notification_category" ADD VALUE IF NOT EXISTS 'OKR' AFTER 'EXIT_SURVEY';
```

`DROP INDEX` / `DROP CONSTRAINT` operations are not needed — this is a pure additive migration. The `ALTER TYPE ... ADD VALUE` requires being run outside a transaction; Prisma's migration runner handles this correctly when the statement is the last in the file.

### 2.5 FR-034 audit trail summary

For traceability, the actor/timestamp columns and the `KeyResultStatusHistory` table together satisfy FR-034. Every status transition is reconstructable from the database:

| Entity | Transition | Where it lives |
|---|---|---|
| `OkrCycle` | DRAFT → ACTIVE | `activated_at`, `activated_by_id` |
| `OkrCycle` | ACTIVE → CLOSED (or DRAFT → CLOSED) | `closed_at`, `closed_by_id` |
| `Objective` | DRAFT → ACTIVE | `activated_at`, `activated_by_id` |
| `Objective` | ACTIVE → CLOSED | `closed_at`, `closed_by_id` |
| `Objective` | * → CANCELLED | `cancelled_at`, `cancelled_by_id` |
| `KeyResult` | any → any | one row per change in `key_result_status_history` (immutable; system-induced changes have `changed_by_id = NULL`) |
| `OkrCheckIn` | PENDING → APPROVED | `reviewed_by_id` (NULL when auto-approved), `reviewed_at` |
| `OkrCheckIn` | PENDING → REJECTED | `reviewed_by_id`, `reviewed_at`, `rejection_reason` |

The service layer writes these atomically inside the same Prisma transaction as the status change — never as a follow-up call.

---

## 3. Field semantics & validation rules

### `OkrCycle`

| Field | Validation / invariant |
|---|---|
| `name` | Unique, ≤ 64 chars. Conventionally "FY YYYY" for annuals and "QN YYYY" for quarterlies, but not enforced — naming freedom for atypical cases (e.g. "FY 2026 — refreshed"). |
| `type` | Required. Constrained to enum. Drives validation in `parent_cycle_id` and `quarter`. |
| `year` | Required. Integer. Convention: calendar year for `QUARTERLY`, fiscal year for `ANNUAL`. |
| `quarter` | NULL for `ANNUAL`; 1–4 for `QUARTERLY`. CHECK constraint above. |
| `status` | Default `DRAFT`. Transitions validated in service. |
| `startDate` / `endDate` | Required. `endDate > startDate` enforced at service layer (no CHECK; allows edge-case same-day overrides). |
| `parentCycleId` | Nullable. CHECK ensures only `QUARTERLY` can have a parent. When set, the parent's `type` MUST be `ANNUAL` (enforced at service — Postgres CHECK cannot reference joined rows). |

### `Objective`

| Field | Validation / invariant |
|---|---|
| `title` | Required, ≤ 200 chars. |
| `description` | Optional, ≤ 2000 chars. |
| `level` | Required. Constrained to enum. Triggers the level-invariant CHECK above. |
| `cycleId` | Required. Cascade-delete with cycle (rare — cycles are not hard-deleted in practice). |
| `parentObjectiveId` | Required for `DEPARTMENT` and `EMPLOYEE`; null for `COMPANY`. Parent's `level` MUST be one rung up (service enforces). Parent's `status` MUST be `ACTIVE` (service enforces, FR-009). |
| `ownerId` | Required for `EMPLOYEE`; null otherwise. Refers to `User.id` (NOT `Employee.id`) for consistency with JWT `sub`. |
| `departmentId` | Required for `DEPARTMENT`; denormalised for `EMPLOYEE` (set at creation from `Employee.departmentId`); null for `COMPANY`. |
| `status` | Default `DRAFT`. Transitions validated in service. Cancellation cascades to KRs and auto-rejects pending check-ins (FR-010). |
| `createdById` | Required. Set from JWT `sub` in the controller. |
| `closedAt` / `cancelledAt` | Set when status transitions to `CLOSED` / `CANCELLED`. |

### `KeyResult`

| Field | Validation / invariant |
|---|---|
| `title` | Required, ≤ 200 chars. |
| `metricType` | Required. Drives scoring formula (research R2). |
| `targetValue` | Required, `Decimal(18, 4)`. CHECK ensures `> 0` for non-BOOLEAN; `= 1` for BOOLEAN. |
| `currentValue` | Default 0. Updated only via approved check-in (FR-018) or explicit PATCH by Manager/HR_ADMIN. |
| `unit` | Required, ≤ 32 chars (e.g. "%", "hires", "DZD", "tickets"). Free-form label; the UI does not parse it. |
| `score` | Default 0, `Decimal(3, 2)`. CHECK enforces [0, 1]. Auto-recomputed on `currentValue` change (FR-012). |
| `assigneeIds` | `uuid[]`. Empty array allowed (KR with no assignees yet — Manager will add later). Validated in DTO: every id MUST be a valid UUID; runtime check that each id exists in `Employee` is performed in `KeyResultsService.create/update`. |
| `dueDate` | Optional. UI surfaces "overdue" badge when `dueDate < today AND status NOT IN (ACHIEVED, CANCELLED)`. |
| `status` | Default `ON_TRACK`. Manager/HR_ADMIN may set `AT_RISK` or `BEHIND` manually. `ACHIEVED` is auto-set when `score == 1.0` AND the KR is not already `CANCELLED`. `CANCELLED` cascades from the parent Objective. |

### `OkrCheckIn`

| Field | Validation / invariant |
|---|---|
| `keyResultId` | Required. Cascade-delete with KR. |
| `employeeId` | Required. Logical FK to `Employee.id`. MUST be in the KR's `assigneeIds` (service enforces — FR-015). |
| `value` | Required, `Decimal(18, 4)`. For `BOOLEAN`, accepts only 0 or 1. |
| `score` | Required, `Decimal(3, 2)`. Computed server-side from `(value, KR.targetValue, KR.metricType)` per `kr-score.util.ts`; the DTO accepts the client-side computed value as a sanity hint but the server overwrites it on insert. |
| `comment` | Optional, ≤ 2000 chars. |
| `status` | Default `PENDING`. Auto-set to `APPROVED` on creation when the auto-approval rule applies (FR-016). |
| `reviewedById` | Set on approve/reject. NULL when auto-approved **and** NULL when auto-rejected by cycle close (distinguishes "no human reviewed" from "Reviewer X reviewed" — see FR-021). |
| `reviewedAt` | Set on approve/reject (= `now()` for auto-approve and for cycle-close auto-reject). |
| `rejectionReason` | Required when status transitions to `REJECTED`; null otherwise. For cycle-close cascade rejections the value is the literal string `"Cycle closed before review"`. |

---

## 4. State machines

### `OkrCycle.status`

```
DRAFT ──activate──▶ ACTIVE ──close──▶ CLOSED
   │                                     ▲
   └──────────close (skip ACTIVE)────────┘
```

Side effects:
- `DRAFT → ACTIVE`: emit `okr.cycle_activated`.
- `* → CLOSED`: auto-reject all `PENDING` check-ins in this cycle (system reason "Cycle closed before review"); transition all `ACTIVE` Objectives in the cycle to `CLOSED`; emit `okr.objective_closed` for each.

### `Objective.status`

```
DRAFT ──activate──▶ ACTIVE ──close──▶ CLOSED
   │                  │
   │                  └─cancel──▶ CANCELLED
   │
   └─cancel──▶ CANCELLED
```

Side effects:
- `* → CANCELLED`: set all child KRs to `CANCELLED`; auto-reject `PENDING` check-ins on those KRs.
- `ACTIVE → CLOSED`: emit `okr.objective_closed`. Final KR scores are frozen for analytics.

### `KeyResult.status`

```
ON_TRACK ◄──manual──▶ AT_RISK ◄──manual──▶ BEHIND
    │                    │                    │
    └─score≥1.0 auto────►ACHIEVED             │
    │                                         │
    └──cancel-from-parent or manual──▶ CANCELLED
```

Auto rule: when `score` reaches `1.0` (via approved check-in), status auto-transitions to `ACHIEVED` unless already `CANCELLED`.

### `OkrCheckIn.status`

```
[create]
   ├── auto-approve rule applies ──▶ APPROVED
   └── otherwise ──▶ PENDING ──approve──▶ APPROVED
                          └──reject──▶ REJECTED
```

`APPROVED` and `REJECTED` are terminal; once set, no further transitions.

---

## 5. Query patterns and index justification

### Hot queries

1. **OKR Dashboard cycle summary** — `SELECT o.department_id, AVG(weighted_score), COUNT(*) FILTER (WHERE at_risk) FROM objectives o JOIN key_results kr ON kr.objective_id = o.id WHERE o.cycle_id = $1 AND o.status = 'ACTIVE' GROUP BY o.department_id`. Hits `idx_objective_cycle_level_status` for the WHERE filter.
2. **Alignment tree per cycle** — `SELECT * FROM objectives WHERE cycle_id = $1 ORDER BY level, parent_objective_id`. Reconstructed in memory into a tree. Hits `idx_objective_cycle_level_status`.
3. **My personal OKRs** — `SELECT * FROM objectives WHERE owner_id = $1 AND cycle_id = $2`. Hits `idx_objective_owner_level` (partial-style filter on `level = 'EMPLOYEE'`).
4. **Department's OKRs** — `SELECT * FROM objectives WHERE department_id = $1 AND level = 'DEPARTMENT' AND cycle_id = $2`. Hits `idx_objective_dept_level`.
5. **Pending check-in queue for a Manager's department** — `SELECT ci.* FROM okr_check_ins ci JOIN key_results kr ON kr.id = ci.key_result_id JOIN objectives o ON o.id = kr.objective_id WHERE ci.status = 'PENDING' AND o.department_id = $1`. Hits `idx_checkin_status_kr` for the status filter; join keys are primary keys.
6. **Check-in history per KR** — `SELECT * FROM okr_check_ins WHERE key_result_id = $1 ORDER BY created_at DESC LIMIT 20`. Hits `idx_checkin_kr_created`.
7. **Employee portfolio (analytics)** — `SELECT * FROM key_results WHERE $1 = ANY(assignee_ids) AND ...`. **No GIN index in v1** (research R6) — falls back to a sequential scan filtered by cycle's KR set (~300 rows max, fast enough). Add GIN if it becomes a hot path.
8. **Cycle list filtered by type/year/status** — `SELECT * FROM okr_cycles WHERE type = $1 AND year = $2 AND status = $3`. Hits `idx_okr_cycle_type_year_status`.
9. **Reminder cron** — `SELECT * FROM okr_cycles WHERE status = 'ACTIVE' AND end_date = (CURRENT_DATE + INTERVAL '14 days')::date`. Hits `idx_okr_cycle_status_end`.

### Index inventory (all justified by a query above)

| Index | Table | Query supporting it |
|---|---|---|
| `idx_okr_cycle_type_year_status` | `okr_cycles` | #8 cycle list filter |
| `idx_okr_cycle_parent` | `okr_cycles` | annual → quarterly children walk |
| `idx_okr_cycle_status_end` | `okr_cycles` | #9 reminder cron + cycle auto-close cron |
| `idx_objective_cycle_level_status` | `objectives` | #1 #2 dashboard + alignment tree |
| `idx_objective_parent` | `objectives` | recursive alignment walks |
| `idx_objective_dept_level` | `objectives` | #4 Manager's dept Objectives |
| `idx_objective_owner_level` | `objectives` | #3 Employee's personal Objectives |
| `idx_kr_objective_status` | `key_results` | KRs of an Objective (every dashboard read) |
| `idx_checkin_kr_created` | `okr_check_ins` | #6 KR history |
| `idx_checkin_status_kr` | `okr_check_ins` | #5 pending review queue |
| `idx_checkin_employee_created` | `okr_check_ins` | "my check-in history" page |
| `idx_kr_status_history_kr_changed` | `key_result_status_history` | "audit timeline for KR X" lookup (FR-034) |

No GIN on `key_results.assignee_ids` in v1 (research R6 — deferred until proven needed).

---

## 6. RBAC at the data layer

Scope filters applied in every service method (mirroring spec.md RBAC matrix):

```ts
function scopeForObjectiveList(user: JwtPayload): Prisma.ObjectiveWhereInput {
  const roles = user.roles;
  if (roles.includes('HR_ADMIN') || roles.includes('EXECUTIVE')) {
    return {}; // GLOBAL
  }
  if (roles.includes('MANAGER')) {
    return {
      OR: [
        { level: 'COMPANY' },                           // see company OKRs for context
        { level: 'DEPARTMENT', departmentId: user.departmentId },
        { level: 'EMPLOYEE', departmentId: user.departmentId },
      ],
    };
  }
  // EMPLOYEE
  return {
    OR: [
      { level: 'COMPANY' },
      { level: 'DEPARTMENT', departmentId: user.departmentId },
      { level: 'EMPLOYEE', ownerId: user.sub },        // only own personal OKRs
    ],
  };
}
```

Check-in visibility (FR-036):

```ts
function scopeForCheckInList(user: JwtPayload): Prisma.OkrCheckInWhereInput {
  if (user.roles.includes('HR_ADMIN')) return {};
  if (user.roles.includes('MANAGER')) {
    return {
      OR: [
        { employeeId: user.employeeId },              // own submissions
        { keyResult: { objective: { departmentId: user.departmentId } } }, // dept
      ],
    };
  }
  // EMPLOYEE
  return {
    OR: [
      { employeeId: user.employeeId },
      { keyResult: { assigneeIds: { has: user.employeeId } } },
    ],
  };
}
```

---

## 7. Cross-schema integrity (deliberate non-relationships)

- `OkrCheckIn.employeeId` and `KeyResult.assigneeIds` are **logical FKs** to `hr_core.employees.id`. No Prisma `@relation` is declared; no DB-level FK constraint. Reasons:
  1. Consistent with the existing pattern (`LeaveRequest.coveringEmployeeIds`).
  2. Cross-cascading behaviour for employees who leave the organisation is bespoke and handled at the application layer (assigneeIds are left in place for audit; check-ins from terminated employees remain visible to the Manager).
- `Objective.departmentId` IS a hard FK (same schema, single-cascade behaviour: `onDelete: SetNull` so cancelling a department doesn't orphan its Objectives but lets them float for HR to triage).
- All cross-table relations within `hr_core` use hard FKs where the relationship is structural (Objective → Cycle, KR → Objective, CheckIn → KR, `KeyResultStatusHistory` → KR cascade) and `SetNull` where the relationship is referential (Objective → Department, Objective → User owner, all User audit relations: `activatedBy`, `closedBy`, `cancelledBy`, `changedBy`).

---

## 8. Migration notes

The migration `20260518000000_add_okrs/migration.sql` will be generated by `npx prisma migrate dev --name add_okrs`. After generation:

1. Append the raw SQL block from §2 (CHECK constraints + enum extension).
2. The `ALTER TYPE ... ADD VALUE` MUST be the final statement (it cannot run inside a transaction).
3. Re-run `npx prisma migrate dev` to apply.

The migration is purely additive; no `DROP INDEX` / `DROP CONSTRAINT` operations are required (per `.claude/rules/code-style.md` rule on Prisma unique constraint renames — not relevant here).

The `notification_category` enum extension is safe to apply against an existing production database — existing rows are unaffected because no row currently has `category = 'OKR'`.
