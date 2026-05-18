# Event Subscription Contract: OKR Module

**Feature**: [spec.md](../spec.md) · **Plan**: [plan.md](../plan.md) · **Data model**: [data-model.md](../data-model.md)
**EventBus**: existing `IEventBus` from `@sentient/shared` (`InMemoryEventBus` in HR Core for Phase 1; Kafka in Phase 2).

This contract lists every `DomainEvent.type` the OKR module **emits** and every event the module **consumes** (in practice, only via the notifications bridge and the Career Agent — there are no internal subscriptions inside the OKR module itself). It is the single source of truth for OKR-domain event flow.

> All events emitted by the OKR module follow the post-commit emission contract (FR-035 in [spec.md](../spec.md), mirroring feature 010's FR-020): events are emitted **after** the Prisma transaction commits. Routing-rule failures are async fire-and-forget and never roll back the originating domain transaction.

---

## Wiring overview

```
┌────────────────────────────────────────────────────────────────────┐
│ OKR services (OkrCyclesService, OkrCheckInsService, …)             │
│   ├── runs business logic in a Prisma transaction                  │
│   └── AFTER commit, emits DomainEvent on IEventBus                 │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────┼──────────────────────────────────┐
│ NotificationsEventsBridge       │  Career Agent (event subscriber) │
│  (subscribes to okr.* events)   │  (subscribes to selected okr.*)  │
│   → okr.rules.ts                │   → conversation-level reactions │
│   → INSERT notifications        │   → updates AgentTaskLog         │
└─────────────────────────────────┴──────────────────────────────────┘
```

The OKR module **never** calls `NotificationsService` directly. The OKR module **never** imports anything from `apps/ai-agentic/`. All interaction is via `IEventBus`.

---

## Events emitted by the OKR module

> **Status legend**: ✅ producer ships in this feature.

### `okr.cycle_activated`

| Field | Value |
|---|---|
| **Source** | `OkrCyclesService.activate(id)` |
| **Status** | ✅ |
| **Emit point** | After `prisma.okrCycle.update({ status: 'ACTIVE' })` commits |
| **Payload** | `{ cycleId: string; cycleName: string; type: 'ANNUAL' \| 'QUARTERLY'; startDate: string; endDate: string }` |
| **Consumed by** | Notifications bridge → `okr.rules.ts → onCycleActivated` → broadcast `OKR / INFO` to every active employee |

### `okr.objective_created`

| Field | Value |
|---|---|
| **Source** | `ObjectivesService.create(dto, user)` |
| **Status** | ✅ |
| **Emit point** | After `prisma.objective.create` commits, **only when `level === 'EMPLOYEE'`** (other levels are not interesting for the Career Agent) |
| **Payload** | `{ objectiveId: string; level: 'EMPLOYEE'; cycleId: string; ownerId: string; departmentId: string; parentObjectiveId: string }` |
| **Consumed by** | Career Agent — opt-in per-conversation; offers to suggest Key Results via the `suggestKeyResults` tool the next time the owner chats with the agent. **No notification is created** (FR-029). |

### `okr.objective_closed`

| Field | Value |
|---|---|
| **Source** | `ObjectivesService.update(id, { status: 'CLOSED' })` and `OkrCyclesService.close(id)` (cascade close) |
| **Status** | ✅ |
| **Emit point** | After the closing transaction commits, once per Objective transitioned |
| **Payload** | `{ objectiveId: string; level: ObjectiveLevel; ownerId: string \| null; departmentId: string \| null; finalScore: string }` (`finalScore` = average of KRs' final `score`) |
| **Consumed by** | Career Agent — Pull integration: stores a `performance_summary` row in the agent's `AgentTaskLog`; surfaced the next time the owner or their Manager chats with the agent about that cycle (FR-030). **No notification.** |

### `okr.checkin_submitted`

| Field | Value |
|---|---|
| **Source** | `OkrCheckInsService.submit(dto, user)` |
| **Status** | ✅ |
| **Emit point** | After `prisma.okrCheckIn.create` commits, **only when the check-in did NOT auto-approve** (i.e. `status === 'PENDING'`) |
| **Payload** | `{ checkInId: string; keyResultId: string; objectiveId: string; departmentId: string; submitterId: string; submitterName: string; value: string; score: string; keyResultTitle: string }` |
| **Consumed by** | Notifications bridge → `okr.rules.ts → onCheckInSubmitted` → routes to Managers of `departmentId`, minus the submitter (FR-023) |

### `okr.checkin_approved`

| Field | Value |
|---|---|
| **Source** | `OkrCheckInsService.approve(id, user)` |
| **Status** | ✅ |
| **Emit point** | After the approve transaction commits |
| **Payload** | `{ checkInId: string; keyResultId: string; objectiveId: string; submitterId: string; approverId: string; approverName: string; value: string; newScore: string; keyResultTitle: string }` |
| **Consumed by** | Notifications bridge → `okr.rules.ts → onCheckInApproved` → routes to `submitterId` as `OKR / INFO` (FR-024) |

### `okr.checkin_rejected`

| Field | Value |
|---|---|
| **Source** | `OkrCheckInsService.reject(id, dto, user)` — manual rejection only |
| **Status** | ✅ |
| **Emit point** | After the reject transaction commits |
| **Payload** | `{ checkInId: string; keyResultId: string; objectiveId: string; submitterId: string; reviewerId: string; reviewerName: string; reason: string; keyResultTitle: string }` |
| **Consumed by** | Notifications bridge → `okr.rules.ts → onCheckInRejected` → routes to `submitterId` as `OKR / DECISION_PENDING` with `body` including `reason` verbatim (FR-025) |

> **Cycle-close cascade rejections do NOT emit this event** (FR-021). When `OkrCyclesService.close` flips a batch of `PENDING` check-ins to `REJECTED` with the system reason `"Cycle closed before review"`, no `okr.checkin_rejected` event is published and no per-submitter notification is created. The rejection is observable only via the submitter's check-in history. This is a deliberate noise-control decision documented alongside FR-021; if a future product change wants per-cascade notification, T049 (in tasks.md) emits one event per auto-rejected check-in with `reviewerId = null`.

### `okr.checkin_reminder_due`

| Field | Value |
|---|---|
| **Source** | `OkrReminderScheduler` (`@Cron('0 9 * * *')`) — see [research.md §R9](../research.md) |
| **Status** | ✅ |
| **Emit point** | After scanning active cycles whose `endDate` is exactly 14 days away and resolving stale assignees |
| **Payload** | `{ employeeId: string; userId: string; cycleId: string; cycleName: string; dueAt: string; openKeyResultIds: string[]; openKeyResultTitles: string[] }` |
| **Consumed by** | Notifications bridge → `okr.rules.ts → onReminderDue` → routes to `userId` (FR-026) as `OKR / DECISION_PENDING` |

---

## Routing rules — `okr.rules.ts`

A single new file `apps/hr-core/src/modules/notifications/events/routing-rules/okr.rules.ts` exports the five routing rules below. The bridge maps each event type → rule in `apps/hr-core/src/modules/notifications/events/notifications-events.bridge.ts`.

> **Notification category**: a new value `OKR` is added to the existing `NotificationCategory` enum (research R5). All OKR notifications carry `category: 'OKR'`. **No new value is added to `NotificationEventType`** — OKR rules reuse the existing seven values (`REQUEST_SUBMITTED`, `REQUEST_APPROVED`, `REQUEST_REJECTED`, `DECISION_PENDING`, `RESOLVED`, `INFO`, `REQUEST_CANCELLED`).

| Event | Rule export | NotificationCategory | NotificationEventType | Recipients | referenceType |
|---|---|---|---|---|---|
| `okr.cycle_activated` | `onCycleActivated` | `OKR` | `INFO` | All active employees (broadcast) | `okr_cycle` |
| `okr.checkin_submitted` | `onCheckInSubmitted` | `OKR` | `DECISION_PENDING` | All active Managers of `payload.departmentId`, minus the submitter | `okr_check_in` |
| `okr.checkin_approved` | `onCheckInApproved` | `OKR` | `INFO` | `payload.submitterId` (resolved to `User.id`) | `okr_check_in` |
| `okr.checkin_rejected` | `onCheckInRejected` | `OKR` | `DECISION_PENDING` | `payload.submitterId` (resolved to `User.id`); body contains `payload.reason` verbatim | `okr_check_in` |
| `okr.checkin_reminder_due` | `onReminderDue` | `OKR` | `DECISION_PENDING` | `payload.userId` | `okr_cycle` (carries `cycleId` in `referenceId`; `payload.openKeyResultIds` listed in payload for the UI to render chips) |

### Title and body templates

Each rule returns a `NotificationDraft` (per [event-subscriptions.md from feature 010](../../010-notifications/contracts/event-subscriptions.md)). The templates below are rendered by `notifications.renderers.ts` (extended with five new entries).

| Event | Title | Body |
|---|---|---|
| `okr.cycle_activated` | `OKR cycle "<cycleName>" is active` | `The <type> cycle "<cycleName>" runs <startDate> to <endDate>. Open your OKR workspace to align your goals.` |
| `okr.checkin_submitted` | `Check-in awaiting review on <keyResultTitle>` | `<submitterName> submitted a check-in of <value> on "<keyResultTitle>". Approve or reject in the OKR review queue.` |
| `okr.checkin_approved` | `Your check-in on <keyResultTitle> was approved` | `<approverName> approved your check-in. New KR score: <newScore>.` |
| `okr.checkin_rejected` | `Your check-in on <keyResultTitle> was rejected` | `<reviewerName> asked you to resubmit. Reason: <reason>` (reason truncated to 400 chars with `…` suffix, mirroring feature 010 §3) |
| `okr.checkin_reminder_due` | `Cycle <cycleName> closes in 14 days — log your check-ins` | `You have <openKeyResultIds.length> Key Result(s) without an approved check-in in the last 14 days. Cycle ends on <dueAt>.` |

### Deep-link conventions (`referenceType` → frontend URL)

Mirrored in `apps/web/src/components/notifications/notification-row.tsx`:

| `referenceType` | URL template | Notes |
|---|---|---|
| `okr_cycle` | `/okr-dashboard?cycleId=<referenceId>` | Default landing for all roles |
| `okr_check_in` | `/okr-dashboard?cycleId=<cycleId>&checkInId=<referenceId>` (for the submitter) or `/okr-dashboard?cycleId=<cycleId>&review=<referenceId>` (for the reviewer) | Distinguished by recipient role |

---

## Rule interface

Every rule in `okr.rules.ts` matches the existing `RoutingRule` interface defined by feature 010 in `apps/hr-core/src/modules/notifications/events/routing-rules/routing-rule.interface.ts`:

```ts
type RoutingRule<T = Record<string, unknown>> = (
  event: DomainEvent<T>,
  deps: { prisma: PrismaService; renderers: NotificationRenderers },
) => Promise<NotificationDraft[]>;
```

The OKR rules use `deps.prisma` to:
- Resolve `departmentId` → list of active Managers (`onCheckInSubmitted`).
- Resolve `submitterId` (an `Employee.id`) → `User.id` (`onCheckInApproved`, `onCheckInRejected`).
- Iterate all active employees with a User account (`onCycleActivated`).

The bridge applies the no-self-notification filter (feature 010 R5) after the rule returns — `okr.rules.ts` does not need to filter the actor itself.

---

## Adding a new OKR-domain notification later

If a future task adds a new OKR event (e.g. `okr.kr_overdue`), the developer follows the checklist from [feature 010 event-subscriptions.md](../../010-notifications/contracts/event-subscriptions.md):

1. Emit the new event after-commit from the OKR service that detects the condition.
2. Add a new exported function in `okr.rules.ts`.
3. Register the event type → rule mapping in `notifications-events.bridge.ts`.
4. Add a renderer entry in `notifications.renderers.ts` for the new title/body pair.
5. Add a unit test for the rule.
6. Add a row to this contract document.

No new table, no new controller, no new category (`OKR` already covers all OKR-domain notifications).

---

## Career Agent subscriptions

The Career Agent subscribes to **two** OKR events directly, NOT via the notifications bridge:

### `okr.objective_created` (EMPLOYEE-level only)

- The agent's subscriber logs a small per-conversation hint: "User <ownerId> created Objective <objectiveId>; offer `suggestKeyResults` next time".
- Implementation: a thin subscriber in `apps/ai-agentic/src/agents/career-agent/career-agent.subscriptions.ts` calls `ConversationsService.attachHint(...)` if the user has an open conversation; otherwise discards.
- This is an **enabling signal**, not a notification — no `NotificationDraft` is produced.

### `okr.objective_closed`

- The agent's subscriber inserts an `AgentTaskLog` row of `taskType: 'okr.performance_summary_ready'` keyed on `(objectiveId, ownerId)`.
- The next time the owner (or their Manager) opens a Career Agent conversation about that cycle, the agent retrieves the row and includes a one-line summary in its initial reply.
- Again, no notification.

These two subscriptions live in `apps/ai-agentic/`, not in the OKR module. They are documented here for traceability so the full event consumption picture is in one place.

---

## Error & retry semantics

Inherits feature 010's semantics:
- Routing rule failures are logged with `correlationId` and **do not** propagate back to the EventBus (handlers are async fire-and-forget for the in-memory bus).
- A failed notification insert is recorded at `error` level with the original event payload; the underlying OKR state change is unaffected (FR-022 of feature 010, mirrored here).
- Phase 2 (Kafka) will add at-least-once retry + DLQ; OKR rules are idempotent on `(recipientUserId, referenceType, referenceId, eventType)` semantically but the bridge does not enforce a unique index (legitimate duplicates exist — e.g. multiple `INFO` notifications for repeated cycle activations after a mistaken close).
