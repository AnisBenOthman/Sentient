# Phase 0 — Research: OKR (Objectives & Key Results) Module

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Date**: 2026-05-17

This document resolves the twelve open technical questions called out in `plan.md` before Phase 1 design. Every entry is `Decision / Rationale / Alternatives considered`.

---

## R1. Cycle hierarchy — annual + quarterly or also half-yearly?

**Decision**: **Annual + Quarterly only** for v1. The `OkrCycle.type` enum holds `ANNUAL | QUARTERLY` and `OkrCycle.parentCycleId` is optional (a quarterly cycle MAY but does not have to reference an annual parent — standalone quarterly cycles are valid for bootstrapping).

**Rationale**:
- The spec explicitly locks the two-level model. Adding a third level (half-yearly, monthly, custom) would multiply the validation surface (which annual maps to which half? do halves nest in annuals?) for a level of cadence that no project stakeholder asked for.
- Two levels match the way modern OKR tools (Lattice, 15Five, Gtmhub) actually ship — quarterly is the operating cadence, annual is the framing cadence. Half-yearly is a legacy artefact in older corporate calendars.
- Standalone quarterly support is essential for adoption: a team rolling out OKRs mid-year does not want to back-fill an artificial annual frame just to start a Q3 cycle.

**Alternatives considered**:
- **Annual + Half-yearly + Quarterly + Monthly**: rejected. Three-level nesting (e.g. annual → half → quarter) requires a unique-per-period validation that ballooning sub-levels would force into the data model. Out of scope and unrequested.
- **Quarterly only (no annual)**: rejected. The spec explicitly lists annual cycles as the strategic frame. HR_ADMIN/EXECUTIVE need the year-level view for strategy alignment, even when day-to-day operates on quarterly.

---

## R2. Score formula — fixed or pluggable?

**Decision**: **Fixed formula** for v1, encapsulated in `apps/hr-core/src/modules/okrs/util/kr-score.util.ts`:

```ts
function computeScore(
  metricType: KeyResultMetricType,
  currentValue: Decimal,
  targetValue: Decimal,
): Decimal {
  if (metricType === 'BOOLEAN') {
    return currentValue.greaterThanOrEqualTo(1) ? new Decimal(1.0) : new Decimal(0.0);
  }
  // PERCENTAGE | NUMBER | CURRENCY
  if (targetValue.lessThanOrEqualTo(0)) return new Decimal(0.0);
  const raw = currentValue.dividedBy(targetValue);
  return Decimal.max(0, Decimal.min(1, raw));
}
```

**Rationale**:
- FR-012 specifies exactly this default. Stakeholders agreed the linear formula is the right starting point; sigmoid/threshold variants are speculative.
- Encapsulating it in a pure utility means a future "per-KR custom formula" is a one-file change (add a `formula` column to `KeyResult`, branch in `computeScore`).
- Pure function = trivially unit-testable. 100% branch coverage achievable in a single short spec file.

**Alternatives considered**:
- **Pluggable formula per KR (column `KeyResult.formulaExpression: string`)**: rejected as YAGNI. No stakeholder has requested non-linear scoring; introducing it now adds a parser, a validation surface, and ambiguity in the dashboard.
- **Sigmoid / S-curve scoring**: rejected. More mathematically pleasing for stretch goals but harder for end-users to predict. Linear is the industry default.

---

## R3. Auto-approval scope

**Decision**: **Strictly owner-on-own-personal-Objective**. A check-in auto-approves if and only if:
1. The parent Objective's `level == 'EMPLOYEE'`.
2. The parent Objective's `ownerId == checkIn.submitterId` (the submitting employee owns the personal Objective).

Any other check-in (DEPARTMENT-level KR, COMPANY-level KR, EMPLOYEE-level KR but owned by someone else) is created as `PENDING` and requires manual review.

**Rationale**:
- The auto-approve rule exists to remove noise: an employee logging "10% closer to my own goal" should not need to ping their manager.
- Extending it to "if the submitter is HR_ADMIN, auto-approve their dept check-ins" creates a class of dashboard data that no human reviewed — the original noise problem returns in a more dangerous form (admins inflating scores).
- SC-006 in the spec is built around this exact rule: zero auto-approved check-ins on DEPARTMENT-level KRs.

**Alternatives considered**:
- **Auto-approve if submitter == any assignee of the KR**: rejected. Department KRs typically have multiple assignees; auto-approving each assignee's self-reported progress without manager review is exactly what we want to avoid.
- **Configurable per-KR `requiresReview: boolean`**: rejected as added surface for marginal gain. Owners reviewing their own personal goals is sufficient.

---

## R4. Routing for check-in reviewer — single Manager or any Manager?

**Decision**: **Any Manager of the parent Objective's `departmentId`** can act on a `PENDING` check-in. The Manager review queue (UI + REST `GET /api/hr/okr-check-ins?status=PENDING&departmentId=...`) returns every pending check-in for the department, and the first manager to call approve/reject wins. HR_ADMIN can act on any pending check-in globally.

**Rationale**:
- Single-reviewer routing would require a "primary reviewer per department" assignment table, plus a fallback policy when the primary is on leave. That's an entire sub-feature.
- "Any Manager" matches how every approval queue in Sentient already works (leave requests, promotion requests). Consistency wins.
- Race condition (two managers approve the same check-in simultaneously) is handled by a Prisma `update({ where: { id, status: 'PENDING' } })` which is atomic; the loser gets `RecordNotFound` and the controller maps it to `409 Conflict`.

**Alternatives considered**:
- **Single primary reviewer per department**: rejected per above.
- **Round-robin among department's Managers**: rejected. Adds complexity (state of last assignment), opaque to users, and rare to bring measurable benefit at this scale.

---

## R5. Notification category for OKR events — extend `NotificationCategory` enum or reuse `SYSTEM`?

**Decision**: **Extend `NotificationCategory` with a new value `OKR`**. The enum lives in `packages/shared/src/enums/notification-category.enum.ts`. The PostgreSQL enum (mirrored in Prisma) is extended via a small migration (`ALTER TYPE "hr_core"."notification_category" ADD VALUE 'OKR' AFTER 'EXIT_SURVEY'`). All five OKR-related notification rows use `category: 'OKR'`. The `eventType` column reuses existing values: `INFO` (cycle activated, check-in approved), `DECISION_PENDING` (check-in submitted to manager, check-in reminder due, check-in rejected — rejected reuses DECISION_PENDING because action is required: re-submit).

**Rationale**:
- Feature 010 spec §4 explicitly enumerates ten categories and reserves `SYSTEM` for platform-level notices ("your password expires"). Hijacking `SYSTEM` for OKR cycle activation breaks that contract and pollutes the inbox category filter.
- A dedicated `OKR` category lets users filter their inbox to OKR notifications only (the inbox filter chips in feature 010 are designed for exactly this).
- ADD VALUE on a Postgres enum is non-breaking and zero-downtime — no data migration required.
- Mapping the OKR-friendly labels in spec (`ACTION_REQUIRED` / `INFO`) onto the existing 010 enum values (`DECISION_PENDING` / `INFO`) keeps a single shared vocabulary for every notification across the platform.

**Alternatives considered**:
- **Reuse `SYSTEM`**: rejected per above.
- **Add OKR-specific `notificationEventType` values (`CYCLE_ACTIVATED`, `CHECK_IN_SUBMITTED`, …)**: rejected. The existing seven values cover the semantic space cleanly. Per-domain event-type proliferation makes cross-domain UI rendering harder (icon per type, copy per type).

---

## R6. `KeyResult.assigneeIds` storage — pivot table or array column?

**Decision**: **`text[]` (Postgres array of logical employee ids)** stored as `key_results.assignee_ids`. No `kr_assignees` pivot table. No FK constraints (logical references, consistent with project's cross-schema rule and existing patterns).

**Rationale**:
- KR-assignee relation is **set on creation, rarely changes**, and is **always read with the KR** (the API never asks "which KRs is employee X assigned to without also wanting the KRs"). A pivot table forces a join on every KR read.
- Average assignee list length is 1–3; max realistic is ~10. Postgres array operations stay well within performance envelope.
- The codebase already uses this pattern (`LeaveRequest.coveringEmployeeIds`, `Skill.endorserIds`). New code matches the prevailing convention.
- A GIN index on `assignee_ids` enables fast "find all KRs assigned to employee X" — needed for the `flagAtRiskOkrs` Career Agent tool and the `/api/hr/okr-analytics/employee/:id/cycle/:id` endpoint. We add the GIN index **only when the tool ships** (per the "no speculative indexes" rule); for v1 the queries are by-cycle and naturally select all KRs in the cycle then filter in memory.

**Alternatives considered**:
- **`kr_assignees(kr_id, employee_id)` pivot table**: rejected per above. Higher write cost on KR creation, mandatory join on read, no countervailing benefit.
- **JSON column `assignees: { employeeId, addedAt }[]`**: rejected. Adds richness we don't use and rules out array operators.

---

## R7. Check-in `value` precision

**Decision**: **`Decimal(18, 4)`** for `value`, `currentValue`, and `targetValue` columns. **`Decimal(3, 2)`** for `score` (range [0.00, 1.00]). Use Prisma's `Decimal` type; class-validator validates DTO inputs with `@IsNumber({ maxDecimalPlaces: 4 })`.

**Rationale**:
- `Decimal(18, 4)` covers:
  - Percentages 0.0000–100.0000 (with sub-percent granularity).
  - Counts up to 99,999,999,999,999 (e.g. "tickets resolved this quarter").
  - Currency in DZD (which has no fractional units in common use) and other currencies needing two decimals.
- `Decimal(3, 2)` for score enforces the range visually at the DB level. A CHECK constraint (`score >= 0 AND score <= 1`) backs it up.
- Using `Decimal` (not `Float`) avoids the classic 0.1 + 0.2 = 0.30000000000000004 issues that bite financial / scoring math.

**Alternatives considered**:
- **`Float` / `Double Precision`**: rejected. IEEE-754 rounding errors in score arithmetic break exact-match comparisons (e.g. "score == 1.0" for ACHIEVED).
- **`Decimal(10, 2)`**: rejected as too narrow for headcount-style metrics ("hire 1,000 engineers").

---

## R8. At-risk recompute trigger — stored column or computed on read?

**Decision**: **Computed on read** in the dashboard query. The KR's `status` column is still updated when the user (or system) explicitly transitions it (e.g. `PATCH /api/hr/key-results/:id { status: 'ACHIEVED' }`), but the "at risk" badge is **not** a stored status value — it's derived inline:

```sql
SELECT kr.*,
       (kr.score < 0.3
        AND kr.status NOT IN ('ACHIEVED', 'CANCELLED')
        AND EXISTS (
          SELECT 1 FROM hr_core.okr_check_ins ci
          WHERE ci.key_result_id = kr.id AND ci.status = 'APPROVED'
        )) AS "isAtRisk"
FROM hr_core.key_results kr
WHERE kr.objective_id IN (...);
```

The `status` enum still includes `AT_RISK` as a value because it's an explicitly stored override (a manager can mark a KR as AT_RISK regardless of computed score, e.g. an external blocker the score doesn't reflect).

**Rationale**:
- Storing `is_at_risk` would force a write on every check-in approval and on every score recomputation — many writes for a query that runs at most a few hundred times a day.
- The computation is a single CASE expression on indexed columns; it adds < 5 ms to the dashboard query at the FYP scale (300 KRs per cycle).
- Manual `AT_RISK` status is preserved as a separate concept ("the human explicitly says this is at risk") distinct from the computed flag ("the math says it's below threshold").

**Alternatives considered**:
- **Materialised view refreshed on check-in approval**: over-engineering at this scale.
- **Trigger-maintained `is_at_risk` boolean**: rejected. Triggers add invisible state changes that are hard to debug and version-control.

---

## R9. Reminder cron cadence

**Decision**: **Daily at 09:00 server time**, `@Cron('0 9 * * *')`, implemented in `apps/hr-core/src/modules/okrs/scheduler/okr-reminder.scheduler.ts`. The scheduler:

1. Queries `OkrCycle WHERE status='ACTIVE' AND endDate::date = (now()::date + interval '14 days')::date` — finds cycles whose endDate is exactly 14 days away today.
2. For each such cycle, iterates active KRs and finds assignees with no `APPROVED` check-in in the last 14 days.
3. Emits one `okr.checkin_reminder_due` per (employee, cycle) pair.

**Rationale**:
- FR-026 specifies "two weeks before". Daily cadence is sufficient — reminders are nudges, not time-of-day-sensitive deadlines.
- 09:00 server time lands in business hours for most users.
- Single daily run avoids the "reminded every hour for 24 hours" worst case.

**Alternatives considered**:
- **Hourly cron**: rejected. More writes, more noise, no business reason.
- **Reminder N days before endDate where N is configurable**: rejected as YAGNI. 14 days is the spec's number.

---

## R10. Career Agent tool RBAC — through the tool registry or in the agent graph?

**Decision**: **In the tool itself**, via `HrCoreClient` JWT forwarding (the standard Sentient pattern). The three new OKR tools call HR Core endpoints that enforce RBAC (FR-028); on `HTTP 403` the existing `GracefulDegradationHandler` returns an `AgentDegradationResult` and the agent (LangGraph) continues with reduced context, explaining the limitation to the user.

The agent graph does **not** pre-check permissions before invoking the tool. Same pattern as every other Career Agent tool today (e.g. `getEmployeeProfile`, `getPerformanceHistory`).

**Rationale**:
- Pre-checking in the graph would require duplicating the RBAC matrix in two places (HR Core endpoints AND the agent). Two sources of truth = drift.
- The 403 → `AgentDegradationResult` flow is already exercised across the platform; reusing it is free.
- Logged in `AgentTaskLog.status = DEGRADED` so admins can see permission boundaries in the Governance Center.

**Alternatives considered**:
- **Pre-check RBAC in graph**: rejected per above (duplication).
- **Sub-graph that routes per role**: rejected as over-engineering for three tools.

---

## R11. Frontend cycle selector — global state or per-page?

**Decision**: **Per-page** for v1. Each of the three OKR pages owns its own `cycleId` state (`const [cycleId, setCycleId] = useState<string | null>(null)`), with a shared `<CycleSelector>` component under `apps/web/src/components/okrs/cycle-selector.tsx`. The page passes `(cycleId, setCycleId)` into the selector.

**Rationale**:
- The three pages have different default cycles:
  - `okr-dashboard.tsx` defaults to the most recently activated cycle (could be quarterly or annual).
  - `okr-cycle-management.tsx` defaults to "all cycles" (no single cycle filter).
  - `my-okrs.tsx` defaults to the current quarterly cycle for the user.
- A global "active cycle" context would force every page through the same default and add coupling.
- TanStack Query keys include `cycleId` so cross-page navigation doesn't surprise the user.
- A global context is a 30-minute refactor if needed later — YAGNI for v1.

**Alternatives considered**:
- **`<OkrCycleProvider>` context at the App root**: rejected as premature.
- **URL search param `?cycleId=...`**: a reasonable refinement for shareable links; documented as a future polish task but not in scope here.

---

## R12. Department-Objective `departmentId` source of truth

**Decision**: **`Objective.departmentId` is set explicitly on department-level Objectives**, NOT inferred from the creator's `user.departmentId`. The Manager-side create form pre-fills `departmentId = currentUser.departmentId`. The HR_ADMIN form lets them choose any department. Validation:

```
IF level == 'DEPARTMENT':
  IF user.role IN ('HR_ADMIN', 'EXECUTIVE'):
    body.departmentId is required, any active department allowed
  ELIF user.role == 'MANAGER':
    body.departmentId MUST equal user.departmentId  (cannot create dept Objective for another dept)
  ELSE:
    403
```

For `EMPLOYEE`-level Objectives, the `departmentId` is **derived** from the employee's current department at creation time (denormalised onto the Objective for the dashboard's department-grouping query speed) — it can drift from the employee's current department if the employee moves later, but that drift is documented as intended ("the Objective stays in its original department for audit").

**Rationale**:
- Explicit `departmentId` is faster on every dashboard query (no `JOIN employees ON ...departmentId` per row).
- Manager-creates-for-own-dept is a strong invariant the validation can enforce in one place (in `ObjectivesService.create`).
- HR_ADMIN editing on behalf of a department needs the ability to set `departmentId` freely — coupling it to creator wouldn't allow that.

**Alternatives considered**:
- **Derive `departmentId` from creator at all times**: rejected because HR_ADMIN cannot then create dept Objectives for departments they're not in (and HR_ADMIN typically belongs to the HR department, not Engineering).
- **No `departmentId` on Objective at all, infer via parent walk**: rejected. Forces a recursive query on every dashboard read.

---

## Summary table

| # | Topic | Decision (one line) |
|---|---|---|
| R1 | Cycle hierarchy | Annual + Quarterly only; quarterly parent optional |
| R2 | Score formula | Fixed `currentValue / targetValue`, encapsulated in pure util |
| R3 | Auto-approval scope | Strictly owner-on-own-personal-Objective |
| R4 | Reviewer routing | Any Manager of parent Objective's dept; first wins |
| R5 | Notification category | Extend `NotificationCategory` with new value `OKR` |
| R6 | `assigneeIds` storage | `text[]` array column; no pivot table; GIN index deferred |
| R7 | Value precision | `Decimal(18, 4)` for values, `Decimal(3, 2)` for score |
| R8 | At-risk flag | Computed on read; `AT_RISK` enum kept for manual override |
| R9 | Reminder cron | Daily `@Cron('0 9 * * *')`, 14-day window |
| R10 | Career Agent RBAC | Enforced in tool via HrCoreClient JWT; 403 → GracefulDegradation |
| R11 | Cycle selector | Per-page state; shared component; no global context |
| R12 | `Objective.departmentId` | Explicit; Manager pinned to own dept; HR_ADMIN free; EMPLOYEE derived at creation |
