# Feature Specification: OKR (Objectives & Key Results) Module

**Feature Branch**: `011-okr-module`
**Created**: 2026-05-17
**Status**: Draft
**Input**: User description: "OKR module: HR Admins and Department Managers set strategic objectives; employees track progress and contribute through personal OKRs and check-ins. Three-level cascading hierarchy (Company → Department → Employee), annual + quarterly cycles, dual-track contribution (personal OKRs + shared KR check-ins), Career Agent AI tools, notifications via feature 010."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - HR Admin runs strategic cycles end-to-end (Priority: P1)

As an HR Admin (or Executive), I want to set up an annual strategic frame and the four quarterly cycles inside it, declare the company-level Objectives that everyone should align to, and activate cycles when they are ready, so that managers and employees have a clear, time-boxed structure to plan against and the whole organisation moves in the same direction each quarter.

**Why this priority**: Without an active cycle and at least one company Objective, no department or employee OKR can exist (cascading alignment is mandatory). The entire feature is dead weight until the strategic top of the tree is in place. Shipping cycle + company Objective management first turns the rest of the module on.

**Independent Test**: An HR Admin signs in, creates an `ANNUAL` cycle "FY 2026", creates a `QUARTERLY` cycle "Q1 2026" linked to it, activates Q1 2026, then creates two `COMPANY` Objectives inside Q1 2026. Verify the OKR Cycle Management page lists both cycles with the right parent link, the activation transitions DRAFT → ACTIVE, and the two company Objectives appear at the root of the alignment tree on the OKR Dashboard for every signed-in role.

**Acceptance Scenarios**:

1. **Given** there is no `FY 2026` cycle, **When** HR Admin creates an `ANNUAL` cycle with name "FY 2026" and start/end dates spanning the year, **Then** the cycle is persisted in `DRAFT` status and appears in the cycle list.
2. **Given** an `ANNUAL` cycle "FY 2026" exists, **When** HR Admin creates a `QUARTERLY` cycle "Q1 2026" with `parentCycleId` pointing at FY 2026 and `quarter = 1`, **Then** the quarterly cycle is created in `DRAFT` status with a visible link back to its annual parent.
3. **Given** "Q1 2026" is in `DRAFT`, **When** HR Admin activates it, **Then** the status transitions to `ACTIVE`, an `okr.cycle_activated` event is emitted, and (via the notifications bridge) every active employee receives an in-app notification "Q1 2026 OKR cycle has started".
4. **Given** "Q1 2026" is `ACTIVE`, **When** HR Admin creates two `COMPANY` Objectives inside that cycle, **Then** both Objectives are persisted with `level = COMPANY`, `cycleId = Q1 2026`, `parentObjectiveId = null`, and become visible to every role on the OKR Dashboard.
5. **Given** "Q1 2026" is `ACTIVE` and has dependent department/employee Objectives, **When** HR Admin closes the cycle, **Then** status transitions ACTIVE → CLOSED, no new Objectives can be created inside it, and existing OKRs become read-only (status = CLOSED).

---

### User Story 2 - Manager cascades company strategy into department OKRs and reviews team check-ins (Priority: P1)

As a Department Manager, I want to create department-level Objectives that align to the company OKRs of the active quarterly cycle, attach measurable Key Results, assign team members to specific KRs, and approve/reject the check-ins my team logs against those KRs, so that strategic intent flows into accountable team work and I can keep the dashboard honest with reviewed progress.

**Why this priority**: Without department OKRs, the company strategy stops at HR. Without check-in review, the dashboard fills with self-reported scores nobody has verified — leadership stops trusting the numbers within one cycle. The manager loop (cascade + review) is what turns OKRs from a planning exercise into an operating cadence.

**Independent Test**: A Manager signs in during an active Q1 2026 cycle that already contains company Objectives. They create a `DEPARTMENT` Objective aligned to one of those company Objectives, add three Key Results with target values, and assign two of their direct reports to one of those KRs. One of the assignees submits a check-in. The Manager opens the check-in queue for their department, approves it, and verifies the KR's `currentValue` and `score` reflect the approved check-in. They then reject another check-in with a reason and verify the rejection notification reaches the submitter with the reason verbatim.

**Acceptance Scenarios**:

1. **Given** "Q1 2026" is `ACTIVE` and a company Objective "Grow ARR to 5M DZD" exists, **When** Manager M creates a `DEPARTMENT` Objective "Engineering ships 4 enterprise features" with `parentObjectiveId` pointing at the company Objective and `departmentId` = M's department, **Then** the Objective is persisted with `level = DEPARTMENT`, appears under its parent in the alignment tree, and shows in M's department dashboard.
2. **Given** Manager M's department Objective exists, **When** M adds a Key Result with `metricType = PERCENTAGE`, `targetValue = 100`, `unit = "%"`, `assigneeIds = [empA, empB]`, **Then** the KR is created with `currentValue = 0`, `score = 0.0`, `status = ON_TRACK`, and both assignees see it on their `/my-okrs` page.
3. **Given** Employee A is assigned to a department KR, **When** A submits a check-in with `value = 45`, `score = 0.45`, `comment = "First two features shipped"`, **Then** the check-in is persisted with `status = PENDING`, an `okr.checkin_submitted` event is emitted, and Manager M receives an `ACTION_REQUIRED` notification.
4. **Given** Manager M has a `PENDING` check-in in the queue, **When** M approves it, **Then** the check-in transitions to `APPROVED`, the KR's `currentValue` is updated to the check-in value, the KR's `score` is recomputed, an `okr.checkin_approved` event is emitted, and Employee A receives an `INFO` notification.
5. **Given** Manager M has a `PENDING` check-in in the queue, **When** M rejects it with reason "Please re-base on the latest sprint metrics", **Then** the check-in transitions to `REJECTED`, the KR's `currentValue` and `score` are NOT updated, an `okr.checkin_rejected` event is emitted, and Employee A receives an `ACTION_REQUIRED` notification whose body contains the rejection reason verbatim.
6. **Given** a Manager from a different department tries to approve a check-in in M's department, **When** they call the approve endpoint, **Then** the system responds 403 and no state changes.

---

### User Story 3 - Employee owns personal OKRs aligned to their department and logs progress (Priority: P1)

As an Employee, I want to create one or more personal Objectives aligned to my department's OKRs for the active quarterly cycle, attach my own Key Results, and log check-ins for both my personal KRs and the department KRs I am assigned to, so my individual contribution to team strategy is visible, measurable, and reviewable.

**Why this priority**: Without the employee surface, OKRs are a top-down planning artefact with no execution loop. Personal OKRs and check-ins are the daily operating layer where the system earns its keep. This is the most-used surface in the module by volume (every employee, every week) and must work for the module to be considered shipped.

**Independent Test**: An Employee signs in during an active Q1 2026 cycle. Their department already has an Objective with one KR they are assigned to. The Employee opens `/my-okrs`, creates a personal `EMPLOYEE` Objective aligned to that department Objective, adds two Key Results with target values, and submits a check-in on one of their personal KRs (which they own, so it auto-approves) and one on the department KR they are assigned to (which routes to the Manager for review). Verify both check-ins appear in the Employee's check-in history with the correct statuses.

**Acceptance Scenarios**:

1. **Given** "Q1 2026" is `ACTIVE` and a department Objective for Employee E's department exists, **When** E creates a personal `EMPLOYEE` Objective with `parentObjectiveId` pointing at that department Objective, `ownerId = E.userId`, **Then** the Objective is persisted with `level = EMPLOYEE` and an `okr.objective_created` event is emitted (consumed by Career Agent).
2. **Given** E has a personal Objective, **When** E adds a Key Result with target `targetValue = 10`, `unit = "blog posts"`, `metricType = NUMBER`, **Then** the KR is created and assigned to E (`assigneeIds = [E.id]`) by default.
3. **Given** E owns a KR on their personal Objective, **When** E submits a check-in with new value, **Then** the check-in is auto-approved (owner of the parent Objective is the same person as the submitter), `currentValue` and `score` update immediately, no notification is sent to a reviewer, and no manager review queue is touched.
4. **Given** E is assigned to a department KR (parent Objective is `DEPARTMENT`, not `EMPLOYEE` owned by E), **When** E submits a check-in on that KR, **Then** the check-in is created with `status = PENDING` and routes to the department's Manager (see US2), regardless of whether E also owns personal OKRs.
5. **Given** E tries to create a personal Objective without specifying `parentObjectiveId` or pointing it at a non-department Objective, **When** E submits, **Then** the system rejects the request with a validation error "Employee Objectives must align to a department Objective in the same active cycle".

---

### User Story 4 - Leadership monitors OKR health on a role-aware dashboard (Priority: P2)

As an Executive, HR Admin, Manager, or Employee, I want a single OKR Dashboard whose content adapts to my role and shows the cycle's overall progress, top-level alignment tree, at-risk Key Results, and a cycle selector, so I can answer "are we on track?" in under thirty seconds without combing through individual Objectives.

**Why this priority**: The dashboard is what makes the module visible and trusted. Without it, OKRs become a data silo. Marked P2 because it depends on US1/US2/US3 having produced real data; without those producing rows, the dashboard has nothing to show. Once data exists, the dashboard is the daily entry point for every role.

**Independent Test**: With Q1 2026 active and at least one company + two department + several employee Objectives populated with check-ins, sign in as each of the four roles in turn. Verify each sees a cycle selector, the correct subset of departments/objectives matching their RBAC scope, the count of at-risk KRs (`score < 0.3` AND status not in [ACHIEVED, CANCELLED]), and a top-level alignment tree they can expand from company → department → employee.

**Acceptance Scenarios**:

1. **Given** Q1 2026 has aggregated check-in data, **When** an Executive opens the OKR Dashboard, **Then** they see all departments' progress bars, the total at-risk KR count, and the full alignment tree from company down to employee.
2. **Given** Q1 2026 has data, **When** a Manager opens the OKR Dashboard, **Then** they see only their own department's progress bar and only the department + employee Objectives whose `departmentId` matches their managed department; company-level Objectives are visible read-only as context.
3. **Given** Q1 2026 has data, **When** an Employee opens the OKR Dashboard, **Then** they see their department's progress bar plus their own personal Objectives; no other employee's personal Objectives are visible.
4. **Given** a cycle selector is shown, **When** any role changes it from Q1 2026 to Q4 2025, **Then** the dashboard re-queries and shows the closed cycle's final progress; closed-cycle data is rendered with a "CLOSED" badge.
5. **Given** an Employee is opening the dashboard, **When** they are not assigned to any KR in the selected cycle, **Then** the dashboard shows "No active OKRs for you in this cycle" with a link to the OKR Cycle Management page to view department OKRs.

---

### Edge Cases

- **Self-approval auto-pass**: When the submitter of a check-in is also the owner of the parent personal Objective (employee logs progress on their own personal KR), the check-in MUST auto-approve to avoid noise — there is no separate reviewer.
- **Multiple assignees per KR**: When a department KR has multiple assignees, each assignee submits their own independent check-ins. The KR's `currentValue` is overwritten by each approved check-in (most recent wins), and the KR `score` follows.
- **Closed cycle protection**: When a cycle transitions to `CLOSED`, no new Objectives, Key Results, or check-ins can be created inside it; existing rows become read-only and any in-flight `PENDING` check-ins are auto-rejected with system reason "Cycle closed before review".
- **Alignment to closed parent**: If a Manager tries to create a department Objective whose parent company Objective is in a `CLOSED` or `CANCELLED` status, the system MUST reject with a validation error.
- **Cross-department employee Objective**: An employee can only align their personal Objective to a department Objective belonging to **their own department**. Cross-department alignment is rejected.
- **Manager change mid-cycle**: If an employee moves to a new department during a cycle, their existing personal Objectives keep their original `parentObjectiveId` (audit-preserving). They can create new personal Objectives in the new department only — but the old ones remain visible on their dashboard until the cycle closes.
- **Orphaned KR after Objective cancellation**: When an Objective is cancelled (soft-delete via status), all its Key Results are cancelled too (status = CANCELLED). Their pending check-ins are auto-rejected.
- **Score boundaries**: Check-in `score` MUST be in the closed interval [0.0, 1.0]. Submissions outside this range MUST be rejected at the DTO boundary.
- **Quarterly cycle without parent**: A `QUARTERLY` cycle MAY be created without a `parentCycleId` (early bootstrapping), but then no `ANNUAL` rollup is possible. UI clearly flags this as "Standalone cycle (no annual frame)".
- **At-risk threshold**: A Key Result is "at risk" when `score < 0.3` AND it has at least one approved check-in (so newly created KRs with score 0 by default are NOT flagged at-risk before any progress was reported).
- **Notification to terminated recipient**: If an `okr.cycle_activated` broadcast targets an employee who is terminated between event emission and notification creation, the notification is silently skipped (consistent with feature 010's recipient resolution rule).
- **Manager approves their own check-in**: A Manager who is themselves assigned to one of their own department's KRs and submits a check-in on it MUST NOT have that check-in auto-approved by virtue of also being the reviewer of their own department — it follows the standard PENDING flow, but the queue indicates "submitted by you (self-review allowed)" so the Manager can clear it immediately.

## Requirements *(mandatory)*

### Functional Requirements

**Cycle management**

- **FR-001**: HR Admins MUST be able to create OKR cycles of type `ANNUAL` or `QUARTERLY`. A `QUARTERLY` cycle MAY reference a `parentCycleId` pointing at an `ANNUAL` cycle.
- **FR-002**: Cycles MUST progress through states `DRAFT → ACTIVE → CLOSED`. No transition is allowed from `CLOSED` back to any other state.
- **FR-003**: When a cycle transitions to `ACTIVE`, the system MUST emit `okr.cycle_activated` so the notifications module can broadcast to all active employees.
- **FR-004**: When a cycle is `CLOSED`, the system MUST prevent any new Objective, Key Result, or check-in from being created inside it.
- **FR-005**: The system MUST support listing cycles filtered by `type`, `year`, and `status`.

**Objective management & alignment**

- **FR-006**: HR Admins and Executives MUST be able to create `COMPANY`-level Objectives inside any `ACTIVE` cycle. `COMPANY` Objectives MUST have `parentObjectiveId = null` and `departmentId = null` and `ownerId = null`.
- **FR-007**: HR Admins and Managers (for their own department only) MUST be able to create `DEPARTMENT`-level Objectives. `DEPARTMENT` Objectives MUST have a non-null `parentObjectiveId` pointing at a `COMPANY` Objective in the same cycle (or its annual parent cycle when the dept Objective lives in a quarterly child cycle) and a non-null `departmentId`.
- **FR-008**: Employees MUST be able to create `EMPLOYEE`-level Objectives for themselves; their Manager MUST also be able to create `EMPLOYEE`-level Objectives on behalf of their direct reports. `EMPLOYEE` Objectives MUST have a non-null `parentObjectiveId` pointing at a `DEPARTMENT` Objective belonging to the same department as the employee, and `ownerId = employee.userId`.
- **FR-009**: The system MUST reject attempts to align an Objective to a parent whose status is `CLOSED` or `CANCELLED`, or whose level does not match the expected parent level (employee → department, department → company).
- **FR-010**: Objectives MUST support a soft-delete via status transition to `CANCELLED`; cancellation MUST cascade to the Objective's Key Results (status = CANCELLED) and auto-reject any `PENDING` check-ins on those KRs.

**Key Results & scoring**

- **FR-011**: Every Key Result MUST have a `title`, `metricType` (PERCENTAGE | NUMBER | CURRENCY | BOOLEAN), `targetValue`, `unit`, `currentValue` (default 0), `score` (Decimal in [0.0, 1.0], default 0), `assigneeIds` (a list of employeeIds), `status`, and optional `dueDate`.
- **FR-012**: `score` MUST be recomputed automatically after an approved check-in. The default formula is `min(1.0, max(0.0, currentValue / targetValue))` for `PERCENTAGE`, `NUMBER`, and `CURRENCY` metrics; for `BOOLEAN`, score is 0.0 until `currentValue = targetValue` (= 1), then 1.0.
- **FR-013**: A Key Result MUST be flagged "at risk" (in the dashboard view) when `score < 0.3` AND it has at least one approved check-in AND its status is not in [ACHIEVED, CANCELLED].
- **FR-014**: Managers (own department only) and HR Admins MUST be able to update a KR's `targetValue`, `assigneeIds`, `dueDate`, and `status` while its parent Objective is `ACTIVE`.

**Check-ins & review**

- **FR-015**: Any user assigned to a Key Result (`employeeId IN assigneeIds`) MUST be able to submit a check-in with `value`, `score` (derived from value + targetValue by the client or computed server-side as a guard), and optional `comment`.
- **FR-016**: A check-in on a Key Result whose parent Objective is `EMPLOYEE`-level AND whose `ownerId` equals the submitter MUST be auto-approved on creation (status `APPROVED`, `reviewedAt = now()`, `reviewedById = null` to indicate auto-approval).
- **FR-017**: A check-in on a Key Result whose parent Objective is `DEPARTMENT`-level (or `COMPANY`-level rare-case) MUST be created with `status = PENDING` and routed to a Manager of the parent Objective's department for review.
- **FR-018**: A Manager (for their own department only) and HR Admins MUST be able to approve a `PENDING` check-in. On approval the KR's `currentValue` is set to the check-in's `value`, the KR's `score` is recomputed (FR-012), the check-in transitions to `APPROVED`, and `okr.checkin_approved` is emitted.
- **FR-019**: A Manager (for their own department only) and HR Admins MUST be able to reject a `PENDING` check-in with a reason. The KR's `currentValue` and `score` are NOT updated, the check-in transitions to `REJECTED`, and `okr.checkin_rejected` is emitted with the reason.
- **FR-020**: The system MUST emit `okr.checkin_submitted` when any check-in is created with `status = PENDING`, so the notifications bridge can alert the appropriate Manager.
- **FR-021**: When the parent cycle transitions to `CLOSED`, all `PENDING` check-ins in that cycle MUST be auto-rejected with a system-generated reason "Cycle closed before review". These cascade rejections do NOT emit `okr.checkin_rejected` and do NOT produce per-submitter notifications — the rejection is observable in the submitter's check-in history only, to avoid notification spam during cycle wrap-up.

**Notifications integration**

- **FR-022**: `okr.cycle_activated` MUST be routed via the existing notifications module (feature 010) as a broadcast notification in the new `OKR` category (added to `NotificationCategory`, see research R5) to every active employee. Title and body templates are specified in [contracts/event-subscriptions.md](./contracts/event-subscriptions.md).
- **FR-023**: `okr.checkin_submitted` MUST be routed to the Manager(s) of the parent Objective's department as an `ACTION_REQUIRED` notification.
- **FR-024**: `okr.checkin_approved` MUST be routed to the submitter as an `INFO` notification.
- **FR-025**: `okr.checkin_rejected` MUST be routed to the submitter as an `ACTION_REQUIRED` notification including the reviewer's reason verbatim.
- **FR-026**: Two weeks before a cycle's `endDate`, the system MUST emit a per-employee `okr.checkin_reminder_due` event for every employee who has at least one Key Result they are assigned to with no approved check-in in the last 14 days; the notifications bridge converts those into `ACTION_REQUIRED` reminder notifications.

**AI integration — Career Agent extensions**

- **FR-027**: The existing Career Agent MUST expose three new tools: `suggestObjectiveDraft(employeeId, departmentOkrId) → { title, description, alignedTo }`, `suggestKeyResults(objectiveId) → { keyResults: [{ title, metricType, targetValue, unit }, …] }` (returns 2–4 measurable KRs), and `flagAtRiskOkrs(managerId, cycleId) → { atRisk: [{ keyResultId, title, score, employeeId }, …] }`.
- **FR-028**: The Career Agent's three OKR tools MUST honour the requesting user's JWT scope:
  - `suggestObjectiveDraft` requires the caller to be the employee/owner, that employee's Manager, or HR_ADMIN. EXECUTIVE is denied (Executives do not draft personal OKRs).
  - `suggestKeyResults` is allowed for EMPLOYEE (read access to the target Objective), MANAGER (own department + company), HR_ADMIN, and EXECUTIVE (read-only — Executives may draft KR suggestions for HR_ADMIN to consider). Mirrors the read RBAC of `GET /api/hr/objectives/:id`.
  - `flagAtRiskOkrs` is allowed for MANAGER (own department only — server-side scope filter), HR_ADMIN, and EXECUTIVE (read-only, all departments). Mirrors the RBAC of `GET /api/hr/okr-analytics/cycle/:id/summary`.
  EMPLOYEE invoking `flagAtRiskOkrs` receives HTTP 403 from the underlying endpoint; the agent degrades gracefully via `GracefulDegradationHandler`.
- **FR-029**: When an `EMPLOYEE`-level Objective is created (`okr.objective_created` event), the Career Agent MUST be able to subscribe and offer (proactively in chat) to draft Key Results for it. The subscription is opt-in per-conversation; no notification is created for this.
- **FR-030**: When an Objective transitions to `CLOSED` (`okr.objective_closed` event), the Career Agent MUST be able to consume the event and produce a one-line performance summary entry in the employee's conversation history. This is a Pull integration — the summary is shown only when the employee or their Manager next chats with the Career Agent about that cycle.

**Dashboard & analytics**

- **FR-031**: An OKR Dashboard endpoint MUST return per-department progress (average `score` weighted by KR count), at-risk KR count, and the alignment tree for the given cycle, scoped to the caller's role: Executive/HR_ADMIN see all departments; Manager sees own department; Employee sees own + own department.
- **FR-032**: An Employee OKR portfolio endpoint MUST return all Objectives and Key Results the given employee owns or is assigned to within a given cycle, plus their latest approved check-in per KR.

**RBAC, audit, durability**

- **FR-033**: Every endpoint in the OKR module MUST be guarded by `SharedJwtGuard` + `RbacGuard`; scope filters MUST be applied in the service layer using the caller's `departmentId`, `employeeId`, and `roles`.
- **FR-034**: All status transitions on Cycle, Objective, KeyResult, and OkrCheckIn MUST be logged with actor user id, timestamp, and (where applicable) reason, so an audit log can be reconstructed from the database. The schema captures this as: actor/timestamp columns on `OkrCycle` (`activatedBy/At`, `closedBy/At`), on `Objective` (`activatedBy/At`, `closedBy/At`, `cancelledBy/At`), and on `OkrCheckIn` (`reviewedBy/At`, `rejectionReason`); a dedicated immutable `KeyResultStatusHistory` table records one row per KR status change (see [data-model.md §2.5](./data-model.md)). System-induced transitions (cycle-close cascade, score-auto-flip to ACHIEVED) MUST set the actor column to NULL — distinguishing "no human acted" from "Reviewer X acted".
- **FR-035**: Events MUST be emitted on `IEventBus` **after** the Prisma transaction commits — never inside it — so a rolled-back state change cannot produce dangling notifications (consistent with feature 010's FR-020 contract).
- **FR-036**: A user MUST only see check-ins they submitted, check-ins on KRs they are assigned to, or check-ins in their managed department (Manager) / globally (HR_ADMIN). Cross-user check-in access outside those scopes MUST be forbidden.

### Key Entities *(include if feature involves data)*

- **OkrCycle**: The time frame inside which OKRs live. `type` is `ANNUAL` (e.g. "FY 2026", spans a full year) or `QUARTERLY` (e.g. "Q1 2026", three months, MAY reference an annual parent). Status transitions `DRAFT → ACTIVE → CLOSED`. Drives the cycle selector everywhere.
- **Objective**: A goal at one of three `level`s: `COMPANY` (no parent, no department, no owner), `DEPARTMENT` (parent = company Objective, departmentId set, no owner), or `EMPLOYEE` (parent = department Objective, ownerId = employee userId, departmentId optional but typically matches the employee's department). Status `DRAFT | ACTIVE | CLOSED | CANCELLED`.
- **KeyResult**: A measurable outcome under an Objective. Has a `metricType` (PERCENTAGE | NUMBER | CURRENCY | BOOLEAN), `targetValue`, `currentValue`, `score` (Decimal 0–1), `unit` label, `assigneeIds` (list of employee ids), `dueDate`, and `status` (ON_TRACK | AT_RISK | BEHIND | ACHIEVED | CANCELLED). Updated when an approved check-in lands.
- **OkrCheckIn**: One progress report on one Key Result by one assignee. Carries `value`, `score`, optional `comment`, `status` (PENDING | APPROVED | REJECTED), and review metadata (`reviewedById`, `reviewedAt`). Auto-approved when the submitter owns the parent personal Objective; otherwise routes to a Manager.
- **OkrAlignment** *(conceptual, not a stored entity)*: The parent/child relationship between Objectives at different levels (company → department → employee). Modelled via `Objective.parentObjectiveId`. There is no separate alignment table; the alignment tree is reconstructed by following `parentObjectiveId` recursively within a cycle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An HR Admin can create an annual cycle, the four quarterly children, and activate Q1 (including its broadcast notification) in under 5 minutes total.
- **SC-002**: A Manager can create one department Objective with three Key Results in under 3 minutes, with the Career Agent's `suggestKeyResults` tool reducing time by at least 30% for users who opt to use it.
- **SC-003**: 95% of submitted check-ins reach a final status (APPROVED or REJECTED) within 2 business days of submission, verified over a quarter of operation.
- **SC-004**: After a cycle closes, every Key Result in that cycle has a definitive final score reflected in the dashboard's per-department average in zero manual reconciliation steps.
- **SC-005**: Zero employee-level Objectives exist whose parent Objective is in a different department from the employee's `departmentId`, verified by a periodic data-integrity audit query.
- **SC-006**: Zero check-ins are auto-approved when their parent Objective is `DEPARTMENT`-level (i.e. the auto-approve rule strictly applies to owner-on-own-personal-objective and nothing else), verified by integration tests.
- **SC-007**: Executive / HR_ADMIN can answer "which departments are below 0.5 cycle progress at the midpoint?" in under 30 seconds via the OKR Dashboard, on a dataset of 20 departments × 5 OKRs each.
- **SC-008**: 100% of `okr.checkin_submitted` events result in exactly one in-app notification to a Manager of the parent Objective's department within 60 seconds of submission (inheriting feature 010's SC-001/SC-002 latency guarantee).
- **SC-009**: Zero OKR notifications survive a rolled-back triggering transaction (verified by integration tests covering forced rollback).

## Assumptions

- **Cycle hierarchy is fixed at two levels**: `ANNUAL` and `QUARTERLY` only. Half-yearly, monthly, or custom-period cycles are out of scope for v1.
- **Single active quarterly cycle is the operating norm**: Multiple `ACTIVE` quarterly cycles MAY exist simultaneously (e.g. overlapping fiscal years) but the cycle selector defaults to the most recently activated quarterly cycle whose `endDate` is in the future.
- **Score formula is overrideable later**: The default `currentValue / targetValue` formula in FR-012 is hard-coded for v1. Per-KR or per-cycle custom scoring formulas are explicitly out of scope.
- **Default reviewer is "any Manager of the department"**: Check-ins on department KRs are visible to all Managers in that department; the first one to act decides. Single-reviewer routing is a future refinement.
- **Auto-approval is owner-only**: A check-in is auto-approved only when the parent Objective is `EMPLOYEE`-level AND the submitter equals the Objective's `ownerId`. No other auto-approval path exists, including for HR Admins on their own personal OKRs (consistency wins over convenience).
- **AI tool calls are Pull**: All three Career Agent OKR tools (`suggestObjectiveDraft`, `suggestKeyResults`, `flagAtRiskOkrs`) are invoked by user chat requests. There is no scheduled job that proactively pushes AI-generated drafts into the OKR module.
- **The Career Agent is the AI home for OKR features**: A separate "OKR Agent" is explicitly NOT created. The Career Agent's existing graph is extended with the three new tools. The agent's existing RBAC model (employee owns conversation, agent inherits employee scope) carries over.
- **Notifications come from feature 010**: This module emits domain events; the notifications bridge does the per-recipient routing. No notification-specific code lives in the OKR module beyond emitting the right events and providing one routing-rule file (`okr.rules.ts`) per the existing notifications convention.
- **Retention follows feature 010's window**: OKR notifications inherit the 90-day retention from `hr_core.notifications`. OKR rows themselves are not purged — they remain for the lifetime of the platform as historical performance data.
- **RBAC scope reuse**: User role and scope information comes from the existing IAM/JWT layer. This feature does not introduce new role types.
- **Frontend pages are added under `apps/web/src/pages/`**: Three new pages (`okr-dashboard.tsx`, `okr-cycle-management.tsx`, `my-okrs.tsx`) per `apps/web/`'s file-per-route convention. No new top-level navigation framework is introduced — they slot into the existing sidebar.
- **All new entities live in `hr_core` schema**: OKRs are a core HR construct, not a Social or AI artefact. Four new physical tables (`OkrCycle`, `Objective`, `KeyResult`, `OkrCheckIn`) join the existing 24 HR Core entities, raising the count to **28**. The conceptual fifth entity `OkrAlignment` is modelled via `Objective.parentObjectiveId` and is NOT a separate table. A small auxiliary audit table `KeyResultStatusHistory` (FR-034) is added to the schema but is not counted in the 28 — it is an internal log, not a domain entity.

---

## RBAC matrix (this module)

| Action | EMPLOYEE | MANAGER | HR_ADMIN | EXECUTIVE |
|---|---|---|---|---|
| Create company Objective | ❌ | ❌ | ✅ | ✅ |
| Create department Objective | ❌ | ✅ (own dept) | ✅ | ❌ |
| Create employee Objective (own) | ✅ | ✅ (for direct reports) | ✅ | ❌ |
| View all Objectives (global) | ❌ | ❌ | ✅ | ✅ |
| View department Objectives | ❌ | ✅ (own dept) | ✅ | ✅ |
| View own Objectives | ✅ | ✅ | ✅ | ❌ |
| Log check-in on assigned KR | ✅ | ✅ | ✅ | ❌ |
| Approve/reject check-in | ❌ | ✅ (own dept) | ✅ | ❌ |
| Manage OKR cycles | ❌ | ❌ | ✅ | ❌ |
| View OKR analytics dashboard | ❌ | ✅ (own dept) | ✅ | ✅ |
| Invoke Career Agent `suggestObjectiveDraft` | ✅ (own) | ✅ (own + reports) | ✅ | ❌ |
| Invoke Career Agent `suggestKeyResults` | ✅ (read access) | ✅ (own dept + company) | ✅ | ✅ (read-only) |
| Invoke Career Agent `flagAtRiskOkrs` | ❌ | ✅ (own dept) | ✅ | ✅ (read-only) |

Scope semantics:
- `own dept` = `user.departmentId == resource.departmentId` (Manager scope).
- `own` = `user.employeeId == resource.ownerId` or `user.employeeId IN resource.assigneeIds` (Employee scope on personal OKRs and assigned KRs).
- HR_ADMIN bypasses department filters; EXECUTIVE has read-only `GLOBAL` scope.

---

## Domain Events Catalog (this module)

The OKR module emits the following events on the existing `IEventBus` (after each respective Prisma transaction commits). Each consumer is listed for traceability.

| Event | Source | Consumed by | Payload (key fields) |
|---|---|---|---|
| `okr.cycle_activated` | HR Core / OKR | Notifications bridge (broadcast `SYSTEM`) | `{ cycleId, cycleName, type, startDate, endDate }` |
| `okr.objective_created` | HR Core / OKR | Career Agent (employee-level only); Notifications bridge optional | `{ objectiveId, level, cycleId, ownerId?, departmentId?, parentObjectiveId? }` |
| `okr.objective_closed` | HR Core / OKR | Career Agent (performance summary trigger) | `{ objectiveId, level, ownerId?, finalScore? }` |
| `okr.checkin_submitted` | HR Core / OKR | Notifications bridge (alert Manager) | `{ checkInId, keyResultId, objectiveId, departmentId, submitterId, value, score }` |
| `okr.checkin_approved` | HR Core / OKR | Notifications bridge (alert submitter) | `{ checkInId, keyResultId, submitterId, approverId, value, newScore }` |
| `okr.checkin_rejected` | HR Core / OKR | Notifications bridge (alert submitter with reason) | `{ checkInId, keyResultId, submitterId, reviewerId, reason }` |
| `okr.checkin_reminder_due` | HR Core / OKR (scheduled) | Notifications bridge (reminder for stale assignees) | `{ employeeId, cycleId, dueAt, openKeyResultIds }` |

---

## Notification Routing Rules (this module)

Following the existing pattern in `apps/hr-core/src/modules/notifications/events/routing-rules/`, a new file `okr.rules.ts` MUST be created with these mappings (full details in [contracts/event-subscriptions.md](./contracts/event-subscriptions.md)):

| Event | Routing rule | Category | Recipients |
|---|---|---|---|
| `okr.cycle_activated` | `okr.rules.ts → onCycleActivated` | `SYSTEM` | All active employees (broadcast) |
| `okr.checkin_submitted` | `okr.rules.ts → onCheckInSubmitted` | `ACTION_REQUIRED` | Manager(s) of the parent Objective's department, minus the submitter |
| `okr.checkin_approved` | `okr.rules.ts → onCheckInApproved` | `INFO` | The submitter |
| `okr.checkin_rejected` | `okr.rules.ts → onCheckInRejected` | `ACTION_REQUIRED` | The submitter |
| `okr.checkin_reminder_due` | `okr.rules.ts → onReminderDue` | `ACTION_REQUIRED` | The named employee |

> Note: `ACTION_REQUIRED` and `INFO` are friendlier in-spec labels mapped onto feature 010's `NotificationEventType` values (`DECISION_PENDING` and `INFO` respectively) — see the contract document for the exact enum mapping. No new categories are added to `NotificationCategory` beyond the existing values; OKR notifications use a new `category` value `OKR` if the enum is extended at implementation time, or `SYSTEM` otherwise (decision deferred to research.md R5).

---

## Frontend Pages (this module)

Three new pages added under `apps/web/src/pages/` per the file-per-route convention:

1. **`okr-dashboard.tsx`** — Role-aware OKR health view. Cycle selector at the top, department progress bars, at-risk KR count, and a top-level objective alignment tree (expandable from company → department → employee). EXECUTIVE/HR_ADMIN see all departments; MANAGER sees own department; EMPLOYEE sees own + own department.
2. **`okr-cycle-management.tsx`** — HR_ADMIN-only. Create/activate/close cycles; list all Objectives grouped by cycle; drill-down to individual Objective + KR editing.
3. **`my-okrs.tsx`** — Employee personal OKR workspace. Lists the user's own Objectives (with create / edit / cancel actions) and KRs assigned to them across all active cycles; submission form for check-ins; history of past check-ins per KR with their final status.

API functions are added to `apps/web/src/lib/api/hr-core.ts` (new functions section — no new file) per `getOkrCycles()`, `createOkrCycle()`, `activateCycle()`, `closeCycle()`, `getObjectives()`, `createObjective()`, `getObjective(id)`, `updateObjective()`, `getKeyResults(objectiveId)`, `createKeyResult()`, `updateKeyResult()`, `submitCheckIn()`, `getCheckIns(keyResultId)`, `approveCheckIn()`, `rejectCheckIn()`, `getOkrCycleSummary(cycleId)`, `getEmployeeOkrPortfolio(employeeId, cycleId)`.

---

## Career Agent Tool Extensions (this module)

In `apps/ai-agentic/src/tools/tool-registry.ts`, add a new `OkrTools` group with three LangGraph-wrapped REST tools (full schemas in [contracts/career-agent-tools.md](./contracts/career-agent-tools.md)):

| Tool | Input | Output |
|---|---|---|
| `suggestObjectiveDraft` | `{ employeeId, departmentOkrId }` | `{ title, description, alignedTo: departmentObjectiveTitle }` |
| `suggestKeyResults` | `{ objectiveTitle, objectiveDescription }` | `{ keyResults: Array<{ title, metricType, targetValue, unit }> }` |
| `flagAtRiskOkrs` | `{ managerId, cycleId }` | `{ atRisk: Array<{ keyResultId, title, score, employeeId }> }` |

All three tools use the standard `AgentContext` pattern, log to `AgentTaskLog`, and route REST calls through the existing `HrCoreClient` (newly extended with OKR endpoints). The Career Agent's existing graph is extended; no new agent is created.
