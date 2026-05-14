# Feature Specification: Notification Module

**Feature Branch**: `010-notifications`
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "notification module : so the manage can receive notfication when employee subit leave request, hr-admin receive notif when manager submit promotion request and vice ver sa when requests are approved or refused.."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manager is notified of incoming leave requests and employees are notified of decisions (Priority: P1)

As a Manager, when one of my direct reports submits a leave request, I want to be notified immediately so I can review and act on it without polling the leave queue. As an Employee, after my manager approves or rejects my request, I want to be notified so I know whether to make travel plans or revise the request.

**Why this priority**: The leave-request approval loop is the most frequent, time-sensitive HR workflow in the platform today. Without notifications, managers miss requests sitting in the queue and employees keep refreshing the leaves page to learn the outcome — both produce avoidable friction and slow the entire approval cycle. Shipping this loop first delivers the largest user-visible win.

**Independent Test**: An employee submits a leave request; verify their direct manager's notification list contains a "New leave request" item within the next API call. The manager approves the request; verify the employee's notification list contains an "Approved" item. Repeat the second step with rejection and confirm the rejection notification (including reason if provided) appears. The whole loop can be exercised end-to-end without any other notification flow being implemented.

**Acceptance Scenarios**:

1. **Given** Employee E reports to Manager M and has a positive leave balance, **When** E submits a leave request, **Then** M sees a new unread notification identifying E, the leave type, the dates, and a link/reference to the pending request.
2. **Given** Manager M has a pending leave request from E in the queue, **When** M approves the request, **Then** E sees a new unread notification stating the request was approved, including the dates and approver name.
3. **Given** Manager M has a pending leave request from E in the queue, **When** M rejects the request with a reason, **Then** E sees a new unread notification stating the request was rejected, including the reason text M provided.
4. **Given** Employee E cancels their own pending leave request before any decision, **When** the cancellation is recorded, **Then** Manager M's previous "New leave request" notification is no longer presented as actionable (either auto-marked read/dismissed or labelled as "cancelled by requester").

---

### User Story 2 - HR Admins are notified of incoming promotion requests and managers are notified of decisions (Priority: P1)

As an HR Admin, when a manager submits a promotion request for an employee, I want to be notified so I can review the salary impact, budget impact, and justification without watching the promotion dashboard. As a Manager, after HR approves or rejects my promotion request, I want to be notified so I can communicate the outcome to the employee.

**Why this priority**: Promotion requests carry real financial impact (salary lift, team-budget delta) and are reviewed by a small group of HR admins. Without notifications, requests can sit unreviewed for days; with notifications, HR can react in hours. The manager-side decision notification closes the loop and removes the need for back-channel "did it go through?" pings.

**Independent Test**: A manager submits a promotion request; verify HR admins (and only HR admins) receive a notification identifying the requesting manager, the target employee, current/new role and salary, and a reference to the request. An HR admin approves it; verify the submitting manager receives an "Approved" notification. Reject with a reason; verify the manager receives a "Rejected" notification including the reason.

**Acceptance Scenarios**:

1. **Given** Manager M has submitted a promotion request for Employee E, **When** the request is recorded, **Then** every active HR Admin receives an unread notification identifying M, E, the current and proposed role, the salary delta, and a reference to the request.
2. **Given** HR Admin H has a pending promotion request from M, **When** H approves the request, **Then** M receives an unread notification stating the promotion was approved, including the effective change summary.
3. **Given** HR Admin H has a pending promotion request from M, **When** H rejects the request with a reason, **Then** M receives an unread notification stating the rejection and the reason H provided.
4. **Given** the same promotion request is reviewed by HR Admin H, **When** H makes a decision, **Then** the other HR admins' "Pending promotion request" notifications are presented as resolved (no longer flagged as awaiting their action).

---

### User Story 3 - Users browse, filter, and clear their notification inbox (Priority: P2)

As any authenticated user, I want a single place — accessible from the top bar of every page — where I can see all my notifications, distinguish read from unread, mark items as read, and clear my history, so the indicator does not become noise.

**Why this priority**: Without inbox management, the unread badge becomes permanent visual clutter and users tune it out, which defeats the purpose of US1 and US2. It's P2 (not P1) because the underlying notifications themselves deliver value via direct page links even before the inbox is polished.

**Independent Test**: Seed a user with a mix of read and unread notifications across leave and promotion types. Verify the inbox shows them in reverse chronological order, the unread count badge matches the unread total, "mark as read" toggles a single item, "mark all as read" zeroes the badge, and filtering by category shows only matching items.

**Acceptance Scenarios**:

1. **Given** I have 5 unread and 3 read notifications, **When** I open my inbox, **Then** I see 8 items in reverse chronological order with the 5 unread visually distinguished and a badge showing "5".
2. **Given** I have unread notifications, **When** I click a single notification, **Then** that notification is marked as read, the badge decrements by one, and (if the notification has a target) I am taken to the related request page.
3. **Given** I have unread notifications, **When** I click "Mark all as read", **Then** every notification in my inbox is marked as read and the badge shows zero.
4. **Given** my inbox contains both leave and promotion notifications, **When** I filter by "Leave", **Then** only leave-related notifications are visible and the badge reflects only unread items in that filter (or shows the total, with the filter clearly indicated — system MUST be consistent).

---

### Edge Cases

- **Self-approval**: If the requester and the approver are the same person (e.g., an HR Admin submits and approves their own leave) the system MUST NOT generate a notification to "self" — there is no value and it creates noise.
- **No manager assigned**: If an employee submits a leave request and has no direct manager set, the notification MUST be routed to HR Admin(s) instead, so requests do not silently fall through.
- **Manager change between submission and decision**: If the direct manager changes after a leave request was submitted, the decision notification MUST be addressed to the actual approver, not the original manager.
- **Request cancelled by submitter before review**: The submitted-side notification MUST be dismissed (or marked "Cancelled") so the approver does not act on a stale item.
- **Bulk operations**: If HR Admin approves several promotion requests in rapid succession, each manager MUST receive exactly one decision notification per request (not a batch with mixed outcomes).
- **Disabled/terminated recipient**: If a notification's intended recipient is no longer active (terminated, deactivated), the notification MUST NOT be created, and the failure MUST be logged for audit but MUST NOT block the underlying state change (leave approval, promotion approval).
- **High-volume HR Admin queue**: When dozens of promotion requests arrive in a short window, the HR Admin inbox MUST remain readable — there is no requirement to coalesce them, but ordering and unread counts MUST stay correct.
- **Notification created but underlying request fails downstream**: If the leave approval transaction rolls back, the notification MUST NOT be visible (notifications are created within the same transaction as the state change, or by a reliable event listener that fires only after commit).

## Requirements *(mandatory)*

### Functional Requirements

**Notification creation — leave domain**

- **FR-001**: When an Employee submits a leave request, the system MUST create a notification addressed to the employee's direct manager identifying the requester, leave type, requested dates, and a reference to the pending request.
- **FR-002**: When a Manager approves a leave request, the system MUST create a notification addressed to the requesting employee stating the request was approved, including the dates and the approver's name.
- **FR-003**: When a Manager rejects a leave request, the system MUST create a notification addressed to the requesting employee stating the request was rejected and including the rejection reason provided by the approver.
- **FR-004**: When an Employee cancels their own pending leave request, the system MUST mark the manager's "New leave request" notification as resolved (no longer awaiting action).

**Notification creation — promotion domain**

- **FR-005**: When a Manager submits a promotion request, the system MUST create a notification for every active HR Admin identifying the requesting manager, the target employee, the current and proposed role and salary, and a reference to the pending request.
- **FR-006**: When an HR Admin approves a promotion request, the system MUST create a notification addressed to the submitting manager stating the promotion was approved and summarising the effective change.
- **FR-007**: When an HR Admin rejects a promotion request, the system MUST create a notification addressed to the submitting manager stating the rejection and including the reason provided by the reviewer.
- **FR-008**: When an HR Admin makes a decision on a promotion request, the system MUST mark the other HR admins' "Pending promotion request" notifications for that same request as resolved.

**Recipient routing & RBAC**

- **FR-009**: The system MUST resolve the "direct manager" recipient at the moment the triggering action occurs, not from a stale cache.
- **FR-010**: If an employee has no direct manager assigned at the time of leave submission, the system MUST route the notification to active HR Admins instead.
- **FR-011**: The system MUST NOT create a notification whose recipient is the same person as the actor that caused it (no self-notifications).
- **FR-012**: A user MUST only be able to read, list, and modify their own notifications. Cross-user notification access MUST be forbidden.
- **FR-013**: HR Admins MUST NOT have a global "all notifications" view that exposes other users' inboxes.

**Inbox & user actions**

- **FR-014**: Users MUST be able to list their notifications in reverse chronological order with read/unread state visible.
- **FR-015**: Users MUST be able to mark an individual notification as read.
- **FR-016**: Users MUST be able to mark all of their notifications as read in a single action.
- **FR-017**: Users MUST be able to filter their inbox by category (at minimum: Leave, Promotion).
- **FR-018**: The system MUST expose an unread count so the UI can render a badge.
- **FR-019**: Each notification with an associated request MUST carry a navigable reference so the user can open the related leave or promotion request directly.

**Consistency, durability, audit**

- **FR-020**: A notification MUST become visible to its recipient only if and after the triggering state change is durably committed. A rolled-back approval MUST NOT leave a dangling "Approved" notification.
- **FR-021**: The system MUST retain notifications for at least 90 days, after which expired notifications MAY be archived or purged.
- **FR-022**: Notification creation failures MUST NOT block the underlying state change (leave/promotion decision), but MUST be logged for operations review.
- **FR-023**: The system MUST record, for each notification, who the recipient is, what event produced it, when it was created, and when it was read (if applicable).

**Delivery surface**

- **FR-024**: Notifications MUST be delivered through the in-app surface (web UI inbox + badge). Multi-channel delivery (email, Slack, WhatsApp) is out of scope for this module's first release.
- **FR-025**: Newly created notifications SHOULD appear in the recipient's inbox within 60 seconds of the triggering event without requiring a full page reload.

### Key Entities *(include if feature involves data)*

- **Notification**: A single piece of inbox content addressed to one user. Attributes: recipient user, category (Leave | Promotion), event type (Submitted | Approved | Rejected | Cancelled | Resolved), human-readable title and body, structured payload (requester, dates, salary delta, etc. as appropriate to the event), reference to the underlying request (type + id), unread/read state, created timestamp, read timestamp.
- **Notification Recipient Resolution Rule**: The logic that converts an event ("leave request submitted by employee E") into a concrete recipient list (e.g., "manager of E, or HR Admin fallback"). Not necessarily a stored entity, but a named, testable concept the spec refers to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of leave-request submissions made by an employee with an assigned manager produce exactly one notification to that manager within 60 seconds of submission, verified across at least 50 test submissions.
- **SC-002**: 100% of approve/reject decisions on leave or promotion requests produce exactly one notification to the original requester within 60 seconds of the decision being committed.
- **SC-003**: Median time from a manager submitting a promotion request to the first HR Admin opening the request page drops by at least 50% compared to the pre-notification baseline (measured over a two-week pilot period).
- **SC-004**: Zero notifications are created with a recipient identical to the actor (no self-notifications) across all test scenarios and a 30-day production audit.
- **SC-005**: 95% of users surveyed after one month of use report that the unread badge accurately reflects items that genuinely need their attention (i.e., the inbox is not perceived as noise).
- **SC-006**: Zero observed cases of a notification surviving a rolled-back triggering transaction (verified by integration tests covering forced rollback scenarios).
- **SC-007**: A user can find a specific leave or promotion notification in their inbox within 10 seconds, using the category filter, across an inbox of up to 200 notifications.

## Assumptions

- **Direct manager source of truth**: "Direct manager" for routing FR-001 means the manager linked to the employee on the Employee record at the moment of the event. If team-level managers differ from direct managers, the direct manager wins.
- **HR Admin recipient set**: "HR Admin" for FR-005 and FR-010 means every user with an active HR_ADMIN role assignment at the time of the event. The system does not pre-assign a single owner per promotion request.
- **First release is in-app only**: Email, Slack, and WhatsApp delivery channels exist elsewhere in the platform vision (`ChannelType` enum) but are intentionally out of scope here. Multi-channel routing will be added in a follow-up feature once preferences and opt-in storage are designed.
- **Reasons are mandatory on rejection**: The leave and promotion flows already require a reason on reject; the notification body simply includes whatever reason was supplied. If a flow does not require a reason today, the notification displays "No reason provided".
- **Cancelled-by-submitter case**: When the submitter cancels before any decision, the approver's pending notification is shown as resolved rather than deleted, so the audit trail is preserved.
- **Retention**: 90 days is the assumed retention window. This is a typical default for HR-adjacent notification systems and can be tuned later.
- **Permission scope reuse**: User role and scope information comes from the existing IAM/JWT layer. This feature does not introduce new role types.
- **Polling cadence**: Until a push channel is added, the web UI may poll the inbox endpoint at a reasonable cadence (e.g., 30–60 seconds) to satisfy SC-001/SC-002.
