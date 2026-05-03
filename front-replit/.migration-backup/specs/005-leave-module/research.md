# Phase 0 Research — Leave Management Module

This document resolves open technical questions before schema design. Each entry is a single decision with rationale and what was rejected.

---

## R-001: Business-day counting with half-days and holidays

**Decision**: A pure function `countBusinessDays(start, end, startHalf, endHalf, holidays): Decimal` lives in `util/business-day.util.ts`. Algorithm:

1. Iterate dates from `start` to `end` inclusive.
2. Skip Saturday and Sunday.
3. Skip any date in the `holidays` set (set is pre-resolved for the employee's country + the year range in one query).
4. For each remaining date, add 1.0 — unless it is the `start` date and `startHalf` is set (add 0.5 — the morning half is lost if `startHalf=AFTERNOON`, the afternoon half is lost if `startHalf=MORNING`), or the `end` date and `endHalf` is set (add 0.5).
5. If `start == end` and both halves are set to the same enum value, result is 0 — the DTO validator rejects this combination upfront (see R-007).

Result is stored in `LeaveRequest.totalDays` at creation time (`@db.Decimal(5,2)`) and is immutable thereafter (FR-015, FR-016). A new holiday added later does not recompute past requests.

**Rationale**: Single pure function makes unit testing trivial (dozens of permutations). Fixing totalDays at submission makes the audit trail reliable — if a holiday is added retroactively, existing requests don't silently change.

**Alternatives rejected**:
- DB-side computation via a Postgres function: harder to test, ties logic to the DB, and the result would have to be rematerialized anyway.
- Recomputing on every read: breaks immutability guarantee and causes UI flicker when the holiday calendar changes.

---

## R-002: Holiday and LeaveType scoping via BusinessUnit

**Decision**: Both `Holiday` and `LeaveType` are owned by a `BusinessUnit` through a required `businessUnitId` foreign key. No `country` field is added to `BusinessUnit`. An employee's BusinessUnit is resolved in this order:
1. `employee.team.businessUnit` (if employee has a team)
2. `employee.department.businessUnit` (fallback)
3. If neither exists, the employee is not yet assigned and submission is rejected with 400.

`bu-resolver.util.ts` wraps this logic. On leave submission, the service pre-loads the employee with both relations (`include: { team: { include: { businessUnit: true } }, department: { include: { businessUnit: true } } }`) and resolves in one query. Holidays and leave types matching the resolved `businessUnitId` are used; holidays/leave types of other BUs are invisible to the employee.

**Leave type scoping implications**:
- `LeaveType.name` is unique per-BU: `@@unique([name, businessUnitId])`. Different BUs can each have their own "ANNUAL" row with different `defaultDaysPerYear`.
- `GET /leave-types` scope-filters by the caller's resolved BU (EMPLOYEE/MANAGER) or accepts an explicit `businessUnitId` query for HR_ADMIN.
- A leave request's `leaveTypeId` must belong to the same BU as the requesting employee — enforced at service layer with a 400 on mismatch.

**Holiday scoping implications**:
- `Holiday.businessUnitId` is required (NOT NULL). Company-wide holidays are duplicated per BU by the seed script and HR_ADMIN UI (bulk "add to all BUs" helper planned but not in MVP).
- `GET /holidays` scope-filters by resolved BU. Unique: `@@unique([date, businessUnitId, year])`.

No `country` column, no country backfill migration.

**Rationale**: Matches the user's direct stated model ("holiday is assigned to Business unit, leaveType is assigned also to Business unit"). Strict per-BU scoping matches the reality that BUs often have distinct leave policies (paternity duration, annual leave ceiling). Avoids the ambiguous "null = company-wide" pattern.

**Alternatives rejected**:
- Nullable `businessUnitId` (null = company-wide): explicitly rejected by user — every leave type and holiday must belong to exactly one BU.
- `country` field on BusinessUnit: superseded by direct BU scoping. The prior draft had this; it's been removed.
- Many-to-many `BusinessUnitLeaveType` join: overkill; each BU owns its own rows outright.

---

## R-003: Overlap detection

**Decision**: Application-layer guard runs inside the submission transaction:

```sql
SELECT 1 FROM hr_core.leave_requests
 WHERE employee_id = $1
   AND status IN ('PENDING', 'APPROVED')
   AND start_date <= $3  -- new endDate
   AND end_date   >= $2  -- new startDate
 LIMIT 1;
```

If a row is returned, throw `ConflictException('Overlapping leave request exists')` before the insert. Wrapped in a Prisma `$transaction` at `Serializable` isolation to prevent TOCTOU on concurrent submissions for the same employee.

Supporting index: `@@index([employeeId, status, startDate, endDate])` on `LeaveRequest` — makes the overlap probe index-only.

No database-level exclusion constraint in MVP — PostgreSQL `EXCLUDE USING gist` would add `btree_gist` dependency and is overkill for FYP scope. Race losers get a clean 409 from the exception filter.

**Rationale**: Simple, index-efficient, correct under serializable. Fits FR-019 exactly.

**Alternatives rejected**:
- EXCLUDE constraint with `daterange`: requires `btree_gist` extension, more DBA overhead for marginal benefit.
- Pessimistic lock on `LeaveBalance` row: conflates balance arithmetic with overlap detection; serializable transaction already handles both.

---

## R-004: Configurable accrual frequency per LeaveType (MONTHLY vs YEARLY)

**Decision**: `LeaveType` gets a new field `accrualFrequency: AccrualFrequency` enum with two values: `MONTHLY` and `YEARLY`. HR_ADMIN sets this per type at creation (immutable after first accrual — changing it mid-year would double-grant or skip; enforced by service check). Additionally, `maxCarryoverDays` is HR_ADMIN-configurable per type and governs the carryover cap for BOTH frequencies (set to 0 to disable carryover entirely, set > 0 to cap, set = `defaultDaysPerYear` for unlimited-carry behavior).

A single `@Cron('0 5 1 * *')` job (1st of every month at 05:00) in `accrual.service.ts` using `@nestjs/schedule` handles both frequencies. Idempotency via the `LeaveAccrualRun` ledger:

```
await prisma.$transaction([
  prisma.leaveAccrualRun.create({ data: { runMonth: 'YYYY-MM', executedAt: now, employeesProcessed: 0 } }),
  ...  // per-(employee, leaveType) accrual inserts/updates
], { isolationLevel: 'Serializable' });
```

`LeaveAccrualRun.runMonth` has a `UNIQUE` constraint, so a second invocation for the same month throws `P2002` caught by the service and returns early (no-op). Internal HR_ADMIN-only endpoint `POST /leave-balances/accrual/trigger?month=YYYY-MM` for manual re-runs and tests.

Per-run algorithm:
1. Read all active employees (`employmentStatus != TERMINATED`, `hireDate <= firstOfMonth`).
2. For each (employee, leaveType) pair where `leaveType.businessUnitId == resolvedBusinessUnitId(employee)`:
   - Upsert `LeaveBalance` for the current year.
   - If `leaveType.accrualFrequency == MONTHLY`: increment `totalDays` by `round(defaultDaysPerYear / 12, 2)`. Insert one `LeaveBalanceAdjustment` (reason='Monthly accrual YYYY-MM').
   - If `leaveType.accrualFrequency == YEARLY`: increment `totalDays` by `defaultDaysPerYear` ONLY when `runMonth` is January (`YYYY-01`); skip in all other months. Insert one `LeaveBalanceAdjustment` (reason='Yearly grant YYYY').

Year-end carryover (FR-011) runs as a separate `@Cron('0 3 1 1 *')` (Jan 1st 03:00) BEFORE the January accrual job (05:00 same day). Ordering guaranteed by wall-clock spacing. The carryover job applies to **both** MONTHLY and YEARLY types — the cap is per-LeaveType via `maxCarryoverDays`:
1. For each current-year balance, compute `carryDays = min(remainingDays, leaveType.maxCarryoverDays)`.
2. Upsert next-year balance with `totalDays = carryDays`, `usedDays = 0`, `pendingDays = 0`.
3. Write a `LeaveBalanceAdjustment` row with reason='Year-end carryover YYYY->YYYY+1 (forfeited N.NN)'.
4. The old balance is left intact (audit preservation).

**Mutation guard**: `PATCH /leave-types/:id` rejects changes to `accrualFrequency` if any `LeaveBalance` or `LeaveBalanceAdjustment` row references the type (400 `AccrualFrequencyLocked`). Prevents mid-year confusion.

**Rationale**: User explicitly asked for "monthly or yearly" configurable per leave type. Single cron keeps scheduling simple; frequency branch is per-type. Carryover cap is the HR_ADMIN lever for year-end behavior (user's note: "the hr-admin configure the carryover behave on the system").

**Alternatives rejected**:
- Separate cron per frequency: doubles the scheduler surface with no benefit.
- Allow `accrualFrequency` mutation anytime: creates silent double-grants or skipped months.
- Infer frequency from `defaultDaysPerYear` shape: magical and fragile.
- Bull queue: introduces Redis dependency for a once-per-month job — overkill.
- Sub-monthly accrual proration for mid-month hires: adds complexity with no business value per user's acceptance scenario 5 ("full monthly accrual at next month start").

---

## R-005: LeaveType soft-delete (rejected)

**Decision**: LeaveType has **no** deactivation mechanism. The table supports only INSERT and UPDATE. Once defined, a leave type is forever. HR_ADMIN can rename it or change default days, but cannot delete or hide it.

**Rationale**: User explicitly chose this option. Matches the practical reality — leave types are a small, stable catalog (ANNUAL, SICK, MATERNITY, PATERNITY, UNPAID, plus maybe one or two extras over the company's lifetime). Historical requests and balances always have valid type references. No tombstone complexity.

**Alternatives rejected**: `deletedAt` soft-delete, `isActive` flag, archive semantics — all overkill for a ~10-row catalog.

---

## R-006: Audit model for balance changes

**Decision**: Every change to `LeaveBalance.totalDays` (not `usedDays` or `pendingDays`) writes one `LeaveBalanceAdjustment` row:

```
LeaveBalanceAdjustment {
  id
  balanceId
  adjustedBy       // userId; 'SYSTEM' for scheduler-driven accrual/carryover
  previousTotalDays
  newTotalDays
  reason           // free-text String, e.g., "Monthly accrual 2026-04"
  createdAt
}
```

`usedDays` and `pendingDays` are not audited — those are derived from the sum of `LeaveRequest.totalDays` per status and can always be reconciled from the request history. Only `totalDays` is a free variable.

`adjustedBy` is a String (not FK to User) so it can accept the literal `'SYSTEM'` for scheduler runs without requiring a fake user row.

**Rationale**: User chose "log every monthly accrual per employee". Auditing only totalDays keeps the log focused on things that can't be otherwise reconstructed. Free-text reason keeps the schema simple; the scheduler follows a consistent string pattern making reporting easy.

**Alternatives rejected**:
- Enum reason: user did not select this option; free-text is sufficient.
- Audit usedDays/pendingDays too: would double the log size and add no information (already derivable from LeaveRequest).

---

## R-007: Half-day DTO validation

**Decision**: `CreateLeaveRequestDto` has:
- `startDate: string (ISO)` — required
- `endDate: string (ISO)` — required
- `startHalfDay?: HalfDay` — optional enum
- `endHalfDay?: HalfDay` — optional enum
- `leaveTypeId: string (UUID)`
- `reason?: string (max 500 chars)`

Custom class-validator decorator `@IsValidHalfDayRange()` enforces:
- `endDate >= startDate`
- If `startDate === endDate`: reject combinations that yield 0 days — namely `startHalfDay === endHalfDay === MORNING` or `=== AFTERNOON` (one is the opposite of the other, total = 0.5 which is valid; same value = 0 or full-day overlap which is 1.0 but ambiguous → reject).
- Actually: on single-day, the only valid combinations are (a) both null → 1.0 day, (b) startHalf=MORNING, endHalf=MORNING → 0.5 morning, (c) startHalf=AFTERNOON, endHalf=AFTERNOON → 0.5 afternoon. All other single-day combinations rejected.

Multi-day rules:
- `startHalf=MORNING` means "work the morning, start leave at afternoon" → start date counts as 0.5.
- `startHalf=AFTERNOON` means "start leave at morning, work the afternoon" → start date counts as 0.5. (Documented explicitly in quickstart.)
- Wait — re-reading R-001 step 4: I said "startHalf=MORNING → 0.5 added". That is the simpler model: if startHalf is set, the day counts as 0.5 regardless of which half. The UI shows two dropdowns: "from Monday [afternoon]", "until Friday [morning]". Both halves mean half-day leave on that date.

We use the simpler model: **any non-null halfDay on start/end means 0.5 on that date**. The specific MORNING/AFTERNOON enum value is for display/payroll later (afternoon leave means the employee worked the morning), but does not change the count.

Validator rejects `startDate === endDate && startHalf !== endHalf` (fractions would overlap or gap) and `startDate === endDate && startHalf === null` when `endHalf !== null` and vice versa (inconsistent). Edge rules enumerated in `business-day.util.spec.ts` test fixtures.

**Rationale**: Simpler count model avoids ambiguous arithmetic (what if both halves are MORNING on a 2-day request?). The enum value survives for semantic richness (future payroll integration can read it) but doesn't affect `totalDays`.

**Alternatives rejected**:
- Fractional start/end decimals: no semantic clarity ("is 0.5 morning or afternoon?" becomes implicit).
- Four separate boolean flags: verbose and error-prone.

---

## R-008: Leave Agent hand-off endpoint

**Decision**: One internal endpoint `PATCH /leave-requests/:id/agent-assessment` guarded by `SharedJwtGuard` with a `@Roles('SYSTEM')` requirement. Payload:

```json
{
  "agentRiskAssessment": { ... any JSON ... },
  "agentSuggestedDates": { ... any JSON ... }
}
```

The service does NOT validate the JSON structure in MVP — it's a raw pass-through. The Leave Agent (Month 5) defines the shape via its own OpenAPI spec and the HR Core module trusts the SYSTEM JWT.

The endpoint is callable only by the AI Agentic service with a SYSTEM JWT minted by `AgentContextFactory.forSystemTask()`. HR_ADMIN humans cannot invoke it (returns 403 on role mismatch) — agent assessment is a machine-only write.

**Rationale**: FR-032 requires the storage and endpoint exist; computing risk is explicitly out of this module's scope. Lax JSON validation now avoids coupling HR Core's release to the Leave Agent's schema — the contract is negotiated later via the Leave Agent's own DTO documentation.

**Alternatives rejected**:
- Define rigid JSON schema now: premature; will change when Leave Agent is designed.
- Allow HR_ADMIN to write too: breaks the audit story ("was this an AI assessment or a manual override?").

---

## R-009: Domain events emission

**Decision**: Four events, emitted via the existing `IEventBus` (currently Phase-1 REST stub, Phase-2 Kafka):

| Event | When | Payload |
|-------|------|---------|
| `leave.requested` | After `POST /leave-requests` succeeds | `{ leaveRequestId, employeeId, leaveTypeId, startDate, endDate, totalDays }` |
| `leave.approved` | After approve action | adds `{ reviewerId, reviewedAt, reviewNote? }` |
| `leave.rejected` | After reject action | adds `{ reviewerId, reviewedAt, reviewNote }` |
| `leave.cancelled` | After cancel action | adds `{ cancelledBy }` |

Emission happens inside the same transaction that persists the state change (transactional outbox pattern), via a lightweight `prisma.domainEventOutbox` insert that the event bus drains. If the outbox doesn't exist yet in HR Core, we use direct in-process emit with `@EventPattern` and accept at-most-once semantics for MVP — a known project convention from prior features.

**Rationale**: FR-033 requires these four events. Payload stays minimal (ids, not full objects) — consumers fetch what they need. Reviewer events omit `reason` from the request to respect privacy (reason can contain medical details).

**Alternatives rejected**:
- Emit the full LeaveRequest object in the payload: over-shares PII.
- Only emit `leave.decided` with a status field: loses filtering ability for subscribers.

---

## R-010: Balance math correctness under concurrency

**Decision**: The submission, approval, rejection, and cancellation services all run inside a Prisma `$transaction([ ... ], { isolationLevel: 'Serializable' })`. Each transaction:

1. Re-fetches the `LeaveBalance` row with `SELECT ... FOR UPDATE` (via raw SQL in Prisma: `$queryRaw` + lock, or by relying on serializable guarantees).
2. Performs the overlap check (for submissions only).
3. Computes new `pendingDays` / `usedDays` values.
4. Updates the balance and inserts/updates the request.

Serializable retries on conflict are handled at the controller boundary (a Nest interceptor that catches `PrismaClientKnownRequestError` code P2034 "serialization failure" and retries up to 3 times with small jitter). Budget: 3 retries × ~10ms = typically <50ms added latency on contention.

This satisfies SC-007 (no double-spend under burst).

**Rationale**: Serializable is the simplest correct model for the leave domain's small per-employee working set. Retries keep the API responsive under realistic contention (one user clicking submit twice).

**Alternatives rejected**:
- Advisory locks on `(employeeId, leaveTypeId, year)`: correct but more DB-specific plumbing.
- Optimistic concurrency via a `version` column on LeaveBalance: extra schema field, same semantics as serializable.

---

## R-011: Team calendar query shape

**Decision**: `GET /leave-requests/team-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`

- For MANAGER role: returns all APPROVED leave requests for employees where `managerId = user.employeeId` whose date range intersects [from, to].
- For HR_ADMIN: `?departmentId=X` or `?teamId=X` filter optional — otherwise all.
- Response: array of `{ employeeId, employeeName, leaveTypeColor, startDate, endDate, startHalfDay, endHalfDay }`. No `reason` is leaked here (privacy).

SQL:
```sql
SELECT lr.*, e.first_name, e.last_name, lt.color
  FROM hr_core.leave_requests lr
  JOIN hr_core.employees e ON e.id = lr.employee_id
  JOIN hr_core.leave_types lt ON lt.id = lr.leave_type_id
 WHERE lr.status = 'APPROVED'
   AND lr.start_date <= $to AND lr.end_date >= $from
   AND e.manager_id = $managerId
```

Index required: `@@index([employeeId, status, startDate, endDate])` (already added in R-003).

**Rationale**: Covers FR-027 exactly. Reuses overlap index.

**Alternatives rejected**:
- Materialized view per manager: premature optimization; 10k employees × 5 leaves/year = 50k approved rows/year, trivial for Postgres.

---

## R-012: Seed data

**Decision**: Seed script (`prisma/seed.ts` addition) on first run of `pnpm prisma:seed`:

- For **every existing active `BusinessUnit`**, seed 5 LeaveType rows: ANNUAL (24 days/yr, MONTHLY, maxCarryover=5, requiresApproval=true, color=#4CAF50), SICK (12/yr, MONTHLY, carryover=0, requiresApproval=true, color=#F44336), MATERNITY (98/yr, YEARLY, carryover=0, requiresApproval=true, color=#E91E63), PATERNITY (3/yr, YEARLY, carryover=0, requiresApproval=true, color=#2196F3), UNPAID (0/yr, YEARLY, carryover=0, requiresApproval=true, color=#9E9E9E).
- For **every BusinessUnit**, seed 5–10 Holiday rows for 2026 (New Year, Yennayer, Labour Day, Independence Day, Revolution Day, Eid al-Fitr/Adha — approximations; recurring=true for fixed-date; dynamic Islamic dates seeded year-by-year). Seed uses each BU's id.
- No `BusinessUnit.country` backfill; no new column.

**Rationale**: Lets the module be demoable immediately after migration. FR-003 requires these leave types per BU. Seeds are idempotent (upsert on `(name, businessUnitId)` for leave types; on `(date, businessUnitId, year)` for holidays).

**Alternatives rejected**:
- Empty seed (HR_ADMIN bootstraps from scratch): slows down local dev and demo.
- One global set of seeds, ignoring BU: doesn't match the required per-BU scoping.

---

## R-013: Pre-IAM RBAC handling

**Decision**: Guards (`@UseGuards(SharedJwtGuard, RbacGuard)`) and `@Roles(...)` decorators are declared on every controller method but commented out with `// TODO(iam): re-enable once IAM module lands` (per memory `feedback_pre_iam_rbac_comment_out`). Swagger runs without auth. Service code still calls `buildScopeFilter` — but until IAM ships, it receives a stub `user` from a dev middleware that defaults to HR_ADMIN scope. The stub is a single function and will be removed in one commit when IAM is wired.

**Rationale**: Follows the locked project convention from prior features. Keeps the RBAC shape visible in code for future wiring.

**Alternatives rejected**:
- No guards at all: loses the shape of the final design.
- Real guards with a hand-rolled JWT: duplicates IAM work.

---

## Summary of decisions

| # | Topic | Key choice |
|---|-------|-----------|
| R-001 | Business-day counting | Pure fn, immutable totalDays stored at submit |
| R-002 | BU scoping | LeaveType + Holiday owned by BusinessUnit (required FK); no country field |
| R-003 | Overlap detection | App-level check inside serializable tx |
| R-004 | Accrual scheduling | Per-LeaveType MONTHLY/YEARLY enum; single cron; LeaveAccrualRun ledger |
| R-005 | LeaveType soft-delete | None — catalog is permanent |
| R-006 | Balance audit | Adjustment log on totalDays only, free-text reason |
| R-007 | Half-day DTO rules | HalfDay enum, any non-null = 0.5 on that date |
| R-008 | Agent hand-off | PATCH endpoint SYSTEM-only, free-form JSON |
| R-009 | Domain events | 4 events, minimal payload, transactional outbox |
| R-010 | Concurrency | Serializable tx + bounded retry |
| R-011 | Team calendar | Single endpoint, index-backed overlap query |
| R-012 | Seed data | 5 leave types + holidays seeded per BusinessUnit |
| R-013 | Pre-IAM RBAC | Guards commented with TODO(iam), stub user |
