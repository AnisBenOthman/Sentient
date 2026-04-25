# Phase 1 Data Model — Leave Management Module

**Schema**: `hr_core`
**New enums**: 3 (`HalfDay`, `LeaveStatus`, `AccrualFrequency`)
**New models**: 6 (`LeaveType`, `LeaveBalance`, `LeaveRequest`, `Holiday`, `LeaveBalanceAdjustment`, `LeaveAccrualRun`)
**Modified models**: 1 (`Employee` — reverse relations only; `BusinessUnit` receives two new reverse relations but no scalar additions)

All day counts are `Decimal(5,2)` — max 999.99 days, 2-decimal precision enough for half-days and monthly accrual rounding.

---

## Enums

### `HalfDay` *(NEW — in `packages/shared/src/enums/half-day.enum.ts` and Prisma enum)*

```
MORNING
AFTERNOON
```

Semantic: indicates which half of the start or end day the leave covers for display/payroll. Per R-007, the count contribution is always 0.5 regardless of which enum value is set; the value is preserved for downstream systems.

### `LeaveStatus` *(NEW — in `packages/shared/src/enums/leave-status.enum.ts`, already present)*

```
PENDING
APPROVED
REJECTED
CANCELLED
ESCALATED   -- reserved for future Leave Agent risk routing; not set by MVP flows
```

### `AccrualFrequency` *(NEW — in `packages/shared/src/enums/accrual-frequency.enum.ts` and Prisma enum)*

```
MONTHLY    -- balance is credited defaultDaysPerYear / 12 each month
YEARLY     -- full defaultDaysPerYear granted once on January 1 of each year
```

Set per-LeaveType by HR_ADMIN at creation. Immutable once any LeaveBalance or LeaveBalanceAdjustment references the type (mutation guard in service).

---

## Modified: `BusinessUnit`

No scalar field additions. Two reverse relations added:

```prisma
model BusinessUnit {
  // ... existing scalars unchanged ...

  departments Department[]
  teams       Team[]
  leaveTypes  LeaveType[]  // NEW
  holidays    Holiday[]    // NEW

  @@schema("hr_core")
  @@map("business_units")
  @@index([isActive])
}
```

No `country` column. Leave policy scoping is done directly through `businessUnitId` on `LeaveType` and `Holiday`.

---

## Modified: `Employee`

Add two reverse relations (no new columns):

```prisma
model Employee {
  // ... existing fields unchanged ...

  leaveBalances LeaveBalance[]
  leaveRequests LeaveRequest[] @relation("EmployeeLeaveRequests")
  reviewedLeaves LeaveRequest[] @relation("EmployeeReviewedLeaves")

  // ... existing relations unchanged ...
}
```

No direct `businessUnitId` on Employee. The employee's BusinessUnit is resolved via `employee.team.businessUnit` (primary) or `employee.department.businessUnit` (fallback), per R-002. If both are null, the employee cannot submit leave (400 `UnresolvedBusinessUnit`).

---

## New: `LeaveType`

```prisma
model LeaveType {
  id                  String           @id @default(uuid())
  businessUnitId      String                                           // NEW — required FK
  name                String
  defaultDaysPerYear  Decimal          @db.Decimal(5, 2)               // e.g., 24.00
  accrualFrequency    AccrualFrequency @default(MONTHLY)               // NEW — MONTHLY | YEARLY
  maxCarryoverDays    Decimal          @db.Decimal(5, 2) @default(0)
  requiresApproval    Boolean          @default(true)
  color               String?                                          // e.g., "#4CAF50"
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  businessUnit BusinessUnit   @relation(fields: [businessUnitId], references: [id])
  balances     LeaveBalance[]
  requests     LeaveRequest[]

  @@schema("hr_core")
  @@map("leave_types")
  @@unique([name, businessUnitId])
  @@index([businessUnitId])
}
```

**Invariants**:
- `(name, businessUnitId)` unique — each BusinessUnit owns its own catalog, names repeat freely across BUs.
- `businessUnitId` required (NOT NULL). Every leave type belongs to exactly one BU.
- `defaultDaysPerYear >= 0`, `maxCarryoverDays >= 0`, `maxCarryoverDays <= defaultDaysPerYear` (DTO level).
- `accrualFrequency` immutable once any `LeaveBalance` or `LeaveBalanceAdjustment` references this type (service layer guard, 400 `AccrualFrequencyLocked`).
- No deletion (per R-005). UPDATE allowed on every field except `id`, `businessUnitId`, and `accrualFrequency` (after first accrual).

---

## New: `LeaveBalance`

```prisma
model LeaveBalance {
  id          String  @id @default(uuid())
  employeeId  String
  leaveTypeId String
  year        Int
  totalDays   Decimal @db.Decimal(5, 2) @default(0)
  usedDays    Decimal @db.Decimal(5, 2) @default(0)
  pendingDays Decimal @db.Decimal(5, 2) @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  employee    Employee                  @relation(fields: [employeeId], references: [id])
  leaveType   LeaveType                 @relation(fields: [leaveTypeId], references: [id])
  adjustments LeaveBalanceAdjustment[]

  @@schema("hr_core")
  @@map("leave_balances")
  @@unique([employeeId, leaveTypeId, year])
  @@index([employeeId])
  @@index([leaveTypeId])
  @@index([year])
}
```

**Computed (not persisted)**: `remainingDays = totalDays - usedDays - pendingDays`. Exposed via service/DTO, never stored.

**Invariants**:
- `usedDays >= 0`, `pendingDays >= 0` (DTO + service checks).
- `totalDays` can be negative (HR clawback scenario — FR edge case) but submission logic still requires `remainingDays >= requestedDays`.
- Unique on `(employeeId, leaveTypeId, year)` — enforced at DB level for data integrity.

---

## New: `LeaveRequest`

```prisma
model LeaveRequest {
  id                   String      @id @default(uuid())
  employeeId           String
  leaveTypeId          String
  startDate            DateTime    @db.Date
  endDate              DateTime    @db.Date
  startHalfDay         HalfDay?
  endHalfDay           HalfDay?
  totalDays            Decimal     @db.Decimal(5, 2)
  reason               String?     @db.VarChar(500)
  status               LeaveStatus @default(PENDING)
  reviewedById         String?
  reviewedAt           DateTime?
  reviewNote           String?     @db.VarChar(500)
  agentRiskAssessment  Json?
  agentSuggestedDates  Json?
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt

  employee   Employee  @relation("EmployeeLeaveRequests", fields: [employeeId], references: [id])
  leaveType  LeaveType @relation(fields: [leaveTypeId], references: [id])
  reviewedBy Employee? @relation("EmployeeReviewedLeaves", fields: [reviewedById], references: [id])

  @@schema("hr_core")
  @@map("leave_requests")
  @@index([employeeId, status, startDate, endDate])
  @@index([leaveTypeId])
  @@index([reviewedById])
  @@index([status])
  @@index([startDate])
}
```

**Invariants**:
- `endDate >= startDate` (DTO + DB check constraint via raw SQL in migration: `CHECK (end_date >= start_date)`).
- `totalDays > 0` (rejected at submit if 0 — FR-016).
- `totalDays` set at insert time and never updated thereafter (service discipline; no trigger).
- `status=APPROVED` or `REJECTED` requires `reviewedById` and `reviewedAt` to be non-null (app-level invariant).
- `startDate == endDate && startHalfDay !== endHalfDay` rejected by DTO (R-007).

**State machine**:

```
PENDING ──approve──▶ APPROVED       (terminal unless HR override — out of MVP)
PENDING ──reject───▶ REJECTED       (terminal)
PENDING ──cancel───▶ CANCELLED      (terminal; owner-initiated only)

Auto-approve (requiresApproval=false): request is inserted directly as APPROVED.
ESCALATED: never set by MVP; reserved for future Leave Agent.
```

---

## New: `Holiday`

```prisma
model Holiday {
  id             String   @id @default(uuid())
  businessUnitId String                          // NEW — required FK
  name           String
  date           DateTime @db.Date
  isRecurring    Boolean  @default(false)
  year           Int?                            // null if isRecurring = true
  createdAt      DateTime @default(now())

  businessUnit BusinessUnit @relation(fields: [businessUnitId], references: [id])

  @@schema("hr_core")
  @@map("holidays")
  @@unique([date, businessUnitId, year])        // prevents duplicate same-date rows per BU/year
  @@index([businessUnitId])
  @@index([year])
  @@index([isRecurring])
}
```

**Invariants**:
- `businessUnitId` required (NOT NULL). Every holiday belongs to exactly one BU. Company-wide holidays are duplicated per BU by seed/HR_ADMIN UI.
- If `isRecurring = true`, `year` must be null (DTO validation).
- If `isRecurring = false`, `year` must match `date`'s year (DTO validation).
- Composite unique prevents adding two "2026-07-05" rows for the same BU/year.

---

## New: `LeaveBalanceAdjustment`

```prisma
model LeaveBalanceAdjustment {
  id                String   @id @default(uuid())
  balanceId         String
  adjustedBy        String   // userId or literal 'SYSTEM'
  previousTotalDays Decimal  @db.Decimal(5, 2)
  newTotalDays      Decimal  @db.Decimal(5, 2)
  reason            String   @db.VarChar(255)
  createdAt         DateTime @default(now())

  balance LeaveBalance @relation(fields: [balanceId], references: [id])

  @@schema("hr_core")
  @@map("leave_balance_adjustments")
  @@index([balanceId, createdAt])
  @@index([createdAt])
}
```

**Invariants**: Append-only — no UPDATE or DELETE queries in services. `adjustedBy` is a plain String (not FK) so it can hold `'SYSTEM'` without needing a system user row.

Example reason strings (free-text, following conventions):
- `Monthly accrual 2026-04`
- `Year-end carryover 2026->2027 (forfeited 2.00)`
- `Manual grant by HR — promotion bonus`
- `Manual clawback — duplicate grant correction`

---

## New: `LeaveAccrualRun`

```prisma
model LeaveAccrualRun {
  id                 String   @id @default(uuid())
  runMonth           String   @unique @db.VarChar(7)   // 'YYYY-MM'
  executedAt         DateTime @default(now())
  employeesProcessed Int

  @@schema("hr_core")
  @@map("leave_accrual_runs")
  @@index([executedAt])
}
```

**Invariants**: Unique `runMonth` ensures at-most-once accrual per month. `employeesProcessed` updated after the per-employee loop completes inside the same transaction.

---

## Relationship diagram (textual)

```
BusinessUnit
   ├── 1:N LeaveType  (catalog scoped to this BU)
   ├── 1:N Holiday    (calendar scoped to this BU)
   ├── 1:N Department
   └── 1:N Team

Department/Team → BusinessUnit (used to resolve employee's BU)

Employee
   ├── 1:N LeaveBalance ─── N:1 LeaveType ─── N:1 BusinessUnit
   │            └── 1:N LeaveBalanceAdjustment
   ├── 1:N LeaveRequest (as requester) ─── N:1 LeaveType
   └── 0..1:N LeaveRequest (as reviewer)

LeaveAccrualRun (standalone, idempotency ledger)
```

---

## Validation rules summary

| Field | Rule | Enforced where |
|-------|------|----------------|
| `LeaveType.(name, businessUnitId)` | unique | DB unique |
| `LeaveType.businessUnitId` | required, FK | DB NOT NULL + DTO `@IsUUID()` |
| `LeaveType.accrualFrequency` | MONTHLY or YEARLY; immutable after first accrual | DTO enum + service guard |
| `LeaveType.defaultDaysPerYear` | >= 0, <= 366 | DTO `@Min(0) @Max(366)` |
| `LeaveType.maxCarryoverDays` | >= 0, <= defaultDaysPerYear | DTO custom `@IsCarryoverWithinDefault()` |
| `LeaveBalance (employeeId,leaveTypeId,year)` | unique | DB unique |
| Leave type scope at request time | `leaveType.businessUnitId == resolveBU(employee)` | Service (400 `LeaveTypeOutOfScope`) |
| `LeaveRequest.endDate >= startDate` | required | DTO + DB CHECK |
| `LeaveRequest.totalDays > 0` | required | Service (after count) |
| `LeaveRequest.reason` | <= 500 chars | DTO `@MaxLength(500)` |
| `Holiday.businessUnitId` | required, FK | DB NOT NULL + DTO `@IsUUID()` |
| `Holiday.year XOR isRecurring` | exactly one rule | DTO `@IsValidHolidayYear()` |
| `Holiday (date,businessUnitId,year)` | unique | DB unique |
| `LeaveAccrualRun.runMonth` | unique, format 'YYYY-MM' | DB unique + DTO regex |
| Overlap: no two PENDING/APPROVED requests for same employee overlap | required | Service inside serializable tx |
