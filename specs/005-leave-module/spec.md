# Feature Specification: Leave Management Module

**Feature Branch**: `005-leave-module`
**Created**: 2026-04-19
**Status**: Draft
**Input**: User description: "leave feature. look at leave-class-diagram and engage with me, ask me clarifying questions (use AskUserQuestions) so we align"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Employee submits a leave request and tracks its status (Priority: P1)

An employee needs time off (vacation, sick day, personal matter). They open the leave module, see their current balance per leave type, fill in start/end dates (optionally half-day), choose the leave type, and submit. The system calculates how many business days they are requesting (excluding weekends and configured holidays), reserves that amount as "pending" against their balance, and routes the request to their direct manager. The employee can return at any time to see whether the request is still PENDING, APPROVED, REJECTED, or CANCELLED.

**Why this priority**: This is the heart of the feature. Without it, no one can do anything else. It also delivers immediate user value on day one — even before managers are wired in, a deployed employee self-service flow with visible balances is a usable MVP.

**Independent Test**: Seed one leave type (ANNUAL), one employee with a balance of 15 days, and run: submit a request for 3 business days. The request is persisted as PENDING, balance.pendingDays moves from 0 to 3, balance.remainingDays drops from 15 to 12, and the employee's leave list shows the new entry with correct computed totalDays. Works end-to-end without any manager or HR_ADMIN involvement.

**Acceptance Scenarios**:

1. **Given** an employee with 15 remaining days of ANNUAL leave, **When** they submit a request for Mon–Fri of next week (no holidays), **Then** a PENDING LeaveRequest is created with totalDays=5, pendingDays on the balance increases by 5, and remainingDays drops to 10.
2. **Given** a request spanning a weekend (Fri–Mon), **When** the employee submits, **Then** totalDays=2 (Fri + Mon only).
3. **Given** a request that overlaps a Holiday row belonging to the employee's BusinessUnit, **When** submitted, **Then** the holiday date is excluded from totalDays.
4. **Given** a request with `startHalfDay=afternoon` and `endHalfDay=morning` over a 3-day span, **When** submitted, **Then** totalDays=2 (0.5 + 1 + 0.5).
5. **Given** an employee with 2 remaining days, **When** they try to submit a request for 5 days, **Then** the system rejects with "Insufficient leave balance" and no LeaveRequest is persisted.
6. **Given** an employee with an existing PENDING or APPROVED request covering July 5, **When** they submit another request covering July 5, **Then** the system rejects with an overlap error.
7. **Given** a past start date (sick leave logged retroactively), **When** the employee submits, **Then** the request is accepted (retroactive submission is allowed) and goes into PENDING like any other.
8. **Given** a LeaveType with `requiresApproval=false`, **When** the employee submits within balance, **Then** the request is auto-set to APPROVED, `pendingDays` is skipped, and `usedDays` is incremented directly.

---

### User Story 2 - Manager reviews and decides on team leave requests (Priority: P2)

A manager sees a list of PENDING leave requests from their direct reports, opens one, reviews the dates and reason, and either approves or rejects. On approval, the requested days move from pendingDays to usedDays on the employee's balance. On rejection, the pendingDays are released back to remainingDays. The manager can attach a note explaining their decision. They can also view a team-wide calendar showing who's out when, to spot coverage gaps before deciding.

**Why this priority**: Without approvals, P1 requests accumulate forever in PENDING. Approving is the gating action that converts the request into actual time off. Delivered second because it depends on P1 data existing.

**Independent Test**: Given an employee in team T with a PENDING request for 3 days, a manager of team T can list PENDING requests, pick that one, and approve. Balance transitions from (usedDays=0, pendingDays=3) to (usedDays=3, pendingDays=0). Status becomes APPROVED. The employee sees the updated status on their next view.

**Acceptance Scenarios**:

1. **Given** a PENDING request from a direct report with totalDays=3, **When** the manager approves, **Then** status becomes APPROVED, reviewedBy and reviewedAt are set, pendingDays -3 and usedDays +3 on the balance.
2. **Given** a PENDING request, **When** the manager rejects with a reviewNote, **Then** status becomes REJECTED, pendingDays -3 and remainingDays restored, note persisted.
3. **Given** a MANAGER with scope=TEAM, **When** they list leave requests, **Then** they see only requests whose employee's manager is them (no other teams).
4. **Given** a MANAGER viewing the team calendar for July, **When** two direct reports have APPROVED leaves, **Then** the calendar shows both employees' date ranges color-coded by leave type.
5. **Given** an HR_ADMIN with GLOBAL scope, **When** they approve any employee's request, **Then** the action succeeds (HR override).
6. **Given** a request already APPROVED or REJECTED, **When** the manager tries to change the decision, **Then** the system rejects with "Request already decided" (terminal states are immutable except via HR override).

---

### User Story 3 - HR Admin configures leave types, holidays, and initial credits (Priority: P3)

HR_ADMIN sets up the catalog that the rest of the module depends on: leave types (ANNUAL, SICK, MATERNITY, PATERNITY, UNPAID) with defaults like `defaultDaysPerYear`, `maxCarryoverDays`, `requiresApproval`, and color. They configure holidays (Eid al-Fitr, New Year, etc.) including whether each is recurring and which country it applies to. They grant or adjust individual employee leave credits (e.g., extra days after a promotion, correction after a clerical error) — creating or updating LeaveBalance rows directly.

**Why this priority**: Required for the module to be operationally useful in a new tenant/company, but the P1 and P2 flows work on seeded defaults, so this can ship just after the core workflow.

**Independent Test**: An HR_ADMIN creates a new LeaveType "Study Leave" with 5 days/year, adds a Holiday "Independence Day 2026-07-05" (non-recurring), and credits employee E with 10 bonus ANNUAL days. All three actions persist, and a subsequent employee leave submission reflects the new type/holiday/balance correctly.

**Acceptance Scenarios**:

1. **Given** HR_ADMIN creates a new LeaveType with name="Study Leave", **When** they save, **Then** a LeaveType row exists with unique name and default config values.
2. **Given** a Holiday row "2026-12-25, recurring=true, businessUnitId=BU-A", **When** an employee in BU-A submits a leave request spanning Dec 24–26 of any year, **Then** Dec 25 is always excluded from totalDays.
3. **Given** a Holiday belonging to BU-A, **When** computing totalDays for an employee in BU-A, **Then** the holiday is excluded; for an employee in BU-B (different BU), it is not.
4. **Given** HR_ADMIN grants employee E 10 extra ANNUAL days via a credit adjustment, **When** E views balance, **Then** totalDays reflects the new amount.
5. **Given** a non-HR_ADMIN user, **When** they attempt to create/edit LeaveType, Holiday, or adjust another user's balance, **Then** the system returns 403.

---

### User Story 4 - Automated monthly accrual and capped year-end carryover (Priority: P4)

Balances are not granted in full at the start of the year. Each employee accrues `defaultDaysPerYear / 12` of each leave type on the first day of every month they are employed. At year end (Dec 31 → Jan 1), each balance's remaining days roll into the next year up to the leave type's `maxCarryoverDays` cap; any excess expires. This protects the company from paying out a full annual grant to someone who leaves in February, and respects the user's stated business reality.

**Why this priority**: The module can technically ship without automation — HR could crank a manual button monthly at first. But without it, balances drift out of sync within one month, so it's a close fourth.

**Independent Test**: With time mocked to the first of a month, run the accrual job. For each active employee × each leave type, totalDays on the current-year LeaveBalance row increases by (defaultDaysPerYear / 12). Run it again same-month → no duplicate accrual (idempotency). Roll time to Jan 1 of next year, run carryover → new-year balance row seeded with carryover, old-year row finalized.

**Acceptance Scenarios**:

1. **Given** an employee hired 2026-03-15 with ANNUAL (24 days/year), **When** the accrual job runs on 2026-04-01, **Then** the LeaveBalance for (employee, ANNUAL, 2026) has totalDays incremented by 2 (24/12).
2. **Given** accrual already ran for month M, **When** the job runs again the same month, **Then** no additional accrual happens (idempotent per month).
3. **Given** an employee with 7 remainingDays on Dec 31 and LeaveType with maxCarryoverDays=5, **When** year-end carryover runs, **Then** the new year's LeaveBalance starts with totalDays=5 carryover + that month's accrual, and the 2 excess days are forfeited.
4. **Given** an employee marked TERMINATED before the accrual date, **When** the job runs, **Then** no accrual is granted.
5. **Given** hire date mid-month, **When** first accrual runs at the next month start, **Then** full monthly accrual is granted (no sub-monthly proration in MVP).

---

### User Story 5 - Employee cancels a pending request (Priority: P5)

An employee changes their mind before a manager has decided. They open the PENDING request and cancel it. Status becomes CANCELLED and the pendingDays are released back to remainingDays. Once a request has been APPROVED or REJECTED, the employee cannot self-cancel — they must re-request or ask HR.

**Why this priority**: Small quality-of-life feature. The flow works fine without it (manager can just reject), but self-cancel is a common user expectation.

**Independent Test**: Given a PENDING request with totalDays=3, the owning employee calls cancel. Status becomes CANCELLED, pendingDays -3, remainingDays +3. A second employee cannot cancel it. An APPROVED request cannot be cancelled this way.

**Acceptance Scenarios**:

1. **Given** a PENDING request owned by employee E, **When** E cancels, **Then** status=CANCELLED, pendingDays released.
2. **Given** an APPROVED request, **When** the owning employee tries to cancel, **Then** the system rejects with "Only pending requests can be cancelled".
3. **Given** a PENDING request owned by employee E, **When** another employee F attempts to cancel it, **Then** system returns 403 (scope OWN violation).

---

### Edge Cases

- **Zero-day requests**: A request where startDate=endDate with both halves set to the same half (e.g., both `afternoon`) is invalid and rejected.
- **Inverted dates**: endDate < startDate → rejected at DTO validation.
- **All-holiday range**: A request covering only holidays yields totalDays=0 → rejected.
- **All-weekend range**: Similarly totalDays=0 → rejected.
- **Balance race condition**: Two concurrent submissions both trying to use remaining days → the second to commit must fail the balance check (application-level guard + DB constraint).
- **Terminated employee with PENDING request**: When Employee.status becomes TERMINATED, any PENDING requests are auto-cancelled and pendingDays released. APPROVED future-dated leaves follow HR policy (out of MVP scope — flagged for HR review).
- **Holiday added retroactively**: An HR_ADMIN adds a Holiday after some requests were already APPROVED across that date. Existing requests are NOT recalculated (immutability of approved records); future requests pick up the new holiday.
- **LeaveType deactivated**: Soft-delete path — future submissions against it are blocked, existing balances and requests remain queryable.
- **Employee BusinessUnit change**: If an employee transfers from BU-A to BU-B (via a team/department reassignment), their *future* requests use BU-B holidays and leave types; past balances and requests are not rewritten.
- **Negative balance from credit adjustment**: HR_ADMIN sets balance below 0 (e.g., to claw back). System allows it but flags it; new submissions still require remainingDays ≥ requested amount, so employees cannot submit new leave until remainingDays ≥ 0.

## Requirements *(mandatory)*

### Functional Requirements

**Leave Types (HR_ADMIN)**

- **FR-001**: System MUST allow HR_ADMIN to create and update leave types scoped to a BusinessUnit. Fields: `businessUnitId` (required), `name`, `accrualFrequency` (MONTHLY|YEARLY), `defaultDaysPerYear`, `maxCarryoverDays`, `requiresApproval`, `color`.
- **FR-002**: System MUST reject leave type names that duplicate within the same BusinessUnit (`(name, businessUnitId)` must be unique).
- **FR-003**: System MUST seed at minimum the following leave types per BusinessUnit on first run: ANNUAL (MONTHLY), SICK (MONTHLY), MATERNITY (YEARLY), PATERNITY (YEARLY), UNPAID (YEARLY) — values configurable by HR_ADMIN afterwards.
- **FR-003b**: System MUST prevent changing `accrualFrequency` once any LeaveBalance or LeaveBalanceAdjustment references the leave type.

**Holidays (HR_ADMIN)**

- **FR-004**: System MUST allow HR_ADMIN to create, update, and delete holidays scoped to a BusinessUnit. Fields: `businessUnitId` (required), `name`, `date`, `isRecurring`, `year` (null if recurring).
- **FR-005**: System MUST only include holidays belonging to the employee's resolved BusinessUnit when computing totalDays or displaying the calendar.
- **FR-006**: System MUST treat `isRecurring=true` holidays as applicable every year on the same month/day within that BusinessUnit.

**Leave Balance (system-maintained, HR_ADMIN can override)**

- **FR-007**: System MUST maintain one LeaveBalance row per unique triple (employee, leaveType, year).
- **FR-008**: System MUST expose a computed `remainingDays = totalDays − usedDays − pendingDays` on every balance read.
- **FR-009**: System MUST accrue leave balances on the first day of every month per each active employee × each leave type belonging to that employee's resolved BusinessUnit, based on `accrualFrequency`: MONTHLY types accrue `defaultDaysPerYear / 12` (rounded to 2 decimals); YEARLY types accrue `defaultDaysPerYear` only in January. Accrual is idempotent (re-running same month MUST NOT double-apply).
- **FR-010**: System MUST skip accrual for employees whose employment status is TERMINATED or whose hire date is after the accrual run date.
- **FR-011**: System MUST perform year-end carryover on Jan 1: for each balance, seed the new year's balance with `min(remainingDays, leaveType.maxCarryoverDays)` as starting totalDays; remainder is forfeited.
- **FR-012**: System MUST allow HR_ADMIN to manually adjust `totalDays` on any balance (credit grant or claw-back) with an audit record (who, when, previous value, new value, reason).
- **FR-013**: System MUST reject new leave submissions when `remainingDays < requestedDays`.

**Leave Request Submission (Employee)**

- **FR-014**: System MUST allow an employee to submit a leave request with: `leaveTypeId`, `startDate`, `endDate`, optional `startHalfDay` (morning|afternoon|null), optional `endHalfDay` (morning|afternoon|null), optional `reason`.
- **FR-015**: System MUST compute `totalDays` by counting business days (Mon–Fri) between startDate and endDate inclusive, excluding applicable holidays, adjusting for half-day flags (each half = 0.5).
- **FR-016**: System MUST reject requests where computed `totalDays = 0` (all-weekend, all-holiday, or inconsistent half-day range).
- **FR-017**: System MUST reject requests where `endDate < startDate`.
- **FR-018**: System MUST allow submissions with `startDate < today` (retroactive submissions permitted).
- **FR-019**: System MUST reject a new request if the date range overlaps any existing PENDING or APPROVED request for the same employee.
- **FR-020**: On successful submission of a type that requires approval, the system MUST set status=PENDING, persist the request, and increment `pendingDays` by `totalDays` on the relevant LeaveBalance.
- **FR-021**: For LeaveTypes where `requiresApproval=false`, the system MUST directly set status=APPROVED, increment `usedDays`, and skip `pendingDays`.

**Leave Request Review (Manager, HR_ADMIN)**

- **FR-022**: System MUST allow a manager to list PENDING requests for employees whose `managerId` equals the manager's id (TEAM scope).
- **FR-023**: System MUST allow HR_ADMIN to list all leave requests across the organization (GLOBAL scope).
- **FR-024**: System MUST allow a manager or HR_ADMIN to approve a PENDING request, setting status=APPROVED, `reviewedBy`, `reviewedAt`, optional `reviewNote`, decrementing `pendingDays` by totalDays and incrementing `usedDays` by totalDays.
- **FR-025**: System MUST allow a manager or HR_ADMIN to reject a PENDING request, setting status=REJECTED, `reviewedBy`, `reviewedAt`, `reviewNote`, decrementing `pendingDays` by totalDays (remainingDays restored).
- **FR-026**: System MUST reject review actions on requests already in APPROVED, REJECTED, or CANCELLED state (HR_ADMIN override is a separate HR-only endpoint, out of MVP scope).
- **FR-027**: System MUST allow a manager to view a team calendar aggregating APPROVED leave requests of their direct reports over a selectable date range.

**Cancellation (Employee)**

- **FR-028**: System MUST allow the owning employee to cancel their own request only while status=PENDING, setting status=CANCELLED and releasing `pendingDays`.
- **FR-029**: System MUST reject self-cancellation attempts by anyone other than the owning employee (OWN scope violation → 403).

**Read / History**

- **FR-030**: System MUST expose an endpoint returning the requesting employee's own leave history with filters by leave type, year, and status.
- **FR-031**: System MUST expose an endpoint returning the requesting employee's current balances across all leave types for the current year.

**Agent Placeholders (Leave Agent — populated in Month 5)**

- **FR-032**: LeaveRequest MUST include persistent nullable fields `agentRiskAssessment` (JSON) and `agentSuggestedDates` (JSON), writable only by the AI Agentic service via an authenticated internal endpoint. The HR Core module scaffolds the storage and the PATCH endpoint but performs no risk computation itself.

**Domain Events (Phase 1 REST event bus)**

- **FR-033**: Module MUST emit `leave.requested` on creation, `leave.approved` on approval, `leave.rejected` on rejection, `leave.cancelled` on cancellation. Event payload includes `leaveRequestId`, `employeeId`, `leaveTypeId`, date range, and (for reviewer events) `reviewerId`.

**Security / Access Control**

- **FR-034**: All leave endpoints MUST require a valid JWT. No leave endpoint is anonymous.
- **FR-035**: Role-scope matrix enforced:
  - EMPLOYEE: submit own, cancel own (PENDING only), view own balance/history
  - MANAGER: all EMPLOYEE rights + list/approve/reject PENDING requests for direct reports + view team calendar
  - HR_ADMIN: all MANAGER rights + manage LeaveType/Holiday + adjust any balance + review any request
  - EXECUTIVE: read-only access to aggregated leave usage by department (no individual PII beyond name)

### Key Entities

- **LeaveType**: The catalog definition. Fields: `id`, `name` (unique), `defaultDaysPerYear`, `maxCarryoverDays` (**NEW** — needed for FR-011), `requiresApproval`, `color`, `deletedAt` (soft-delete). One-to-many with LeaveBalance and LeaveRequest.

- **LeaveBalance**: Per-employee, per-leave-type, per-year ledger. Fields: `id`, `employeeId`, `leaveTypeId`, `year`, `totalDays`, `usedDays`, `pendingDays`, `remainingDays` (computed). Unique on `(employeeId, leaveTypeId, year)`.

- **LeaveRequest**: Fields per class diagram plus half-day support: `id`, `employeeId`, `leaveTypeId`, `startDate`, `endDate`, `startHalfDay` (**NEW** — enum morning|afternoon|null), `endHalfDay` (**NEW** — enum morning|afternoon|null), `totalDays` (computed at creation, immutable thereafter), `reason`, `status` (LeaveStatus), `reviewedBy`, `reviewedAt`, `reviewNote`, `agentRiskAssessment` (Json), `agentSuggestedDates` (Json), `createdAt`, `updatedAt`.

- **Holiday**: Calendar configuration. Fields: `id`, `businessUnitId` (required FK), `name`, `date`, `isRecurring`, `year` (null if recurring), `createdAt`.

- **LeaveBalanceAdjustment** (**NEW** — needed for FR-012 audit trail): `id`, `balanceId`, `adjustedBy` (userId), `previousTotalDays`, `newTotalDays`, `reason`, `createdAt`. Append-only audit log.

- **LeaveAccrualRun** (**NEW** — needed for FR-009 idempotency): `id`, `runMonth` (YYYY-MM), `executedAt`, `employeesProcessed`. Guarantees at most one accrual per month.

- **LeaveStatus (enum)**: PENDING, APPROVED, REJECTED, CANCELLED, ESCALATED (ESCALATED reserved for future Leave Agent use — not set by any MVP flow).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An employee can submit a valid leave request in under 30 seconds from opening the form (dates, type, half-day, reason, submit).
- **SC-002**: 100% of submitted leave requests land in the correct manager's PENDING queue with zero misroutes, verified against the employee.managerId linkage.
- **SC-003**: Balance math is exact to 2 decimal places — no drift over a full year of monthly accruals and mixed half-day requests. Automated reconciliation test passes 100% of runs.
- **SC-004**: Manager can decide (approve or reject) on a request in under 15 seconds once opened.
- **SC-005**: Monthly accrual job completes for 10,000 employees × 5 leave types in under 60 seconds and is idempotent (re-running same month produces zero new writes).
- **SC-006**: Year-end carryover applies the cap correctly for 100% of balances — no balance exceeds `maxCarryoverDays` post-carryover.
- **SC-007**: Zero concurrent-submission double-spends: a burst of 10 simultaneous requests consuming more than remaining balance results in exactly `floor(remaining / requested)` succeeding and the rest failing with the balance error.
- **SC-008**: Every RBAC violation returns 403 — the test matrix of wrong-role × endpoint pairs yields 403 in 100% of cases, no silent data leaks.
- **SC-009**: Domain events (`leave.requested`, `.approved`, `.rejected`, `.cancelled`) are emitted 100% of the time on the matching action, verifiable via event bus subscriber test.

## Assumptions

- **Work week**: Business days are Monday through Friday for every employee. A configurable per-BU work week is out of scope for MVP.
- **BusinessUnit resolution**: The employee's BusinessUnit is resolved via `employee.team.businessUnit` first, then `employee.department.businessUnit`. Employees without either link cannot submit leave until assigned.
- **Half-day granularity**: Only morning/afternoon halves are supported. Quarter-days or hourly leave are out of scope.
- **Accrual rounding**: `defaultDaysPerYear / 12` is rounded to 2 decimals. Leftover fractions at year end are absorbed into the final month's accrual so the year's total equals the configured annual value.
- **Accrual granularity**: Mid-month hires still receive the full monthly accrual at the next month start — no sub-monthly proration in MVP.
- **Retroactive submissions**: Allowed without any special approval path — managers can reject retroactive requests they don't want to approve.
- **LeaveType soft-delete**: Existing balances and requests referencing a soft-deleted type remain intact; only new submissions are blocked.
- **Agent fields**: `agentRiskAssessment` and `agentSuggestedDates` are persisted but never computed by this module. The AI Agentic service (Month 5) PATCHes them via a system-scoped internal endpoint.
- **EXECUTIVE read model**: Aggregated leave analytics endpoint is reserved for future analytics work. The role is included in the matrix but only the aggregate-read endpoint is in MVP scope.
- **Scheduler**: Monthly accrual and year-end carryover run as scheduled jobs inside the HR Core service (e.g., cron). External orchestration is out of scope for MVP; an in-process scheduler is sufficient.
- **Notifications**: Manager is not proactively notified of new PENDING requests in this spec — polling/dashboard is enough for MVP. Notification dispatch is the Notifications module's responsibility and consumes `leave.requested`.
- **Manager resolution**: "Direct manager" means `Employee.managerId`. Change-of-manager mid-lifecycle does not retroactively reassign existing PENDING requests; they remain with the original reviewer assignment (or HR_ADMIN can reassign via override — out of MVP scope).
