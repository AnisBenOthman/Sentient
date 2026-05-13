# Event Subscription Contract: Notifications

**Feature**: [spec.md](../spec.md) · **Plan**: [plan.md](../plan.md) · **Data model**: [data-model.md](../data-model.md)
**EventBus**: existing `IEventBus` from `@sentient/shared` (`InMemoryEventBus` in HR Core for Phase 1; Kafka in Phase 2).

This contract lists every `DomainEvent.type` the Notifications module subscribes to, the routing rule that handles it, the recipients it produces, and the resulting `(category, eventType)` row. It is the single source of truth for **which features generate notifications**.

> **Status legend**: ✅ producer ships in this feature · 🟡 producer already ships (this feature only adds the subscriber) · 🔜 producer ships with a future feature; the subscription is wired but inactive until events start flowing.

---

## Wiring overview

```
┌────────────────────────────────────────────────────────────────────┐
│ Domain Service (LeavesService, PromotionRequestsService, …)        │
│   ├── runs business logic in a Prisma transaction                  │
│   └── AFTER commit, emits DomainEvent on IEventBus                 │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ NotificationsEventsBridge  (subscribes to all event types below)   │
│   1. Look up routing rule by event.type                            │
│   2. rule.resolveRecipients(event, deps) → NotificationDraft[]     │
│   3. filter out actor=recipient pairs (FR-011)                     │
│   4. NotificationsService.bulkCreate(drafts)                       │
│   5. NotificationsSseRegistry.push(recipientId, payload)           │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ INSERT into hr_core.notifications                                  │
│ SSE push to connected EventSource clients (best-effort)            │
└────────────────────────────────────────────────────────────────────┘
```

`NotificationDraft` is the in-process struct each rule returns:

```ts
interface NotificationDraft {
  recipientUserId: string;          // Resolved from event payload + Employee/User tables
  actorUserId: string | null;       // event.metadata.userId
  category: NotificationCategory;
  eventType: NotificationEventType;
  title: string;                     // Rendered by the rule
  body: string;                      // Rendered by the rule
  payload: Record<string, unknown>;
  referenceType: string;
  referenceId: string;
  correlationId: string;             // event.metadata.correlationId
}
```

---

## Subscriptions

### Leave domain (HR Core)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `leave.requested` | 🟡 | `Employee.managerId`; fallback: every active HR Admin if no manager set (FR-010). | `LEAVE / REQUEST_SUBMITTED` · `referenceType='leave_request'` | `leave.rules.ts → onRequested` |
| `leave.approved` | 🟡 | Original requester (`event.payload.employeeId` → its `User.id`). | `LEAVE / REQUEST_APPROVED` | `leave.rules.ts → onApproved` |
| `leave.rejected` | 🟡 | Original requester. Body includes `payload.reason`. | `LEAVE / REQUEST_REJECTED` | `leave.rules.ts → onRejected` |
| `leave.cancelled` | ✅ (new emission) | Manager of the original notification (looked up by `referenceType='leave_request', referenceId=leaveRequestId, status='UNREAD'`). The rule flips status of the manager's pending notification AND inserts a paired `LEAVE / RESOLVED` notification for the audit trail (FR-004). | `LEAVE / RESOLVED` | `leave.rules.ts → onCancelled` |

`leave.cancelled` is not yet emitted by `LeavesService`. This feature adds the emission in `RequestsService.cancel` (one line after the transaction commits, mirroring the existing `leave.requested` pattern).

### Promotion domain (HR Core)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `promotion.requested` | ✅ (new emission) | All active HR Admins (users with role `HR_ADMIN` or `GLOBAL_HR_ADMIN` and active status), minus the actor. | `PROMOTION / REQUEST_SUBMITTED` · `referenceType='promotion_request'` | `promotion.rules.ts → onRequested` |
| `promotion.approved` | ✅ (new emission) | The submitting manager (`event.payload.requestedById` → `User.id`). | `PROMOTION / REQUEST_APPROVED` | `promotion.rules.ts → onApproved` |
| `promotion.rejected` | ✅ (new emission) | The submitting manager. Body includes rejection reason. | `PROMOTION / REQUEST_REJECTED` | `promotion.rules.ts → onRejected` |

On `promotion.approved` / `promotion.rejected`, the rule also flips status of all other HR Admins' pending broadcast notifications (`referenceType='promotion_request', referenceId=...`, status='UNREAD') to `READ` and inserts a paired `RESOLVED` notification with `payload.decision` set to `APPROVED`/`REJECTED` (FR-008).

### Skills domain (HR Core)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `skill.endorsement_requested` | 🔜 | The endorser (`payload.endorserId`). | `SKILL / DECISION_PENDING` · `referenceType='skill_endorsement'` | `skills.rules.ts → onEndorsementRequested` |
| `skill.endorsement_completed` | 🔜 | The endorsee. | `SKILL / RESOLVED` | `skills.rules.ts → onEndorsementCompleted` |
| `skill.review_due` | 🔜 | Manager. | `SKILL / DECISION_PENDING` | `skills.rules.ts → onReviewDue` |

### Performance reviews domain (HR Core)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `performance.cycle_launched` | 🔜 | All participants in the cycle. | `PERFORMANCE / INFO` · `referenceType='performance_cycle'` | `performance.rules.ts → onCycleLaunched` |
| `performance.review_assigned` | 🔜 | Reviewee + Reviewer. | `PERFORMANCE / DECISION_PENDING` · `referenceType='performance_review'` | `performance.rules.ts → onReviewAssigned` |
| `performance.review_submitted` | 🔜 | Reviewee. | `PERFORMANCE / INFO` | `performance.rules.ts → onReviewSubmitted` |
| `performance.review_completed` | 🔜 | Reviewee. | `PERFORMANCE / RESOLVED` | `performance.rules.ts → onReviewCompleted` |

### Probation domain (HR Core)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `probation.started` | 🔜 | Employee + Manager. | `PROBATION / INFO` · `referenceType='probation_period'` | `probation.rules.ts → onStarted` |
| `probation.evaluation_due` | 🔜 | Manager. | `PROBATION / DECISION_PENDING` | `probation.rules.ts → onEvaluationDue` |
| `probation.decision.confirmed` / `extended` / `terminated` | 🔜 | Employee. | `PROBATION / RESOLVED` (payload carries decision). | `probation.rules.ts → onDecision` |

### Contract amendments domain (HR Core)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `contract.amendment_submitted` | 🔜 | All active HR Admins. | `CONTRACT_AMENDMENT / REQUEST_SUBMITTED` · `referenceType='contract_amendment'` | `contract-amendment.rules.ts → onSubmitted` |
| `contract.amendment_approved` | 🔜 | Submitting Manager. | `CONTRACT_AMENDMENT / REQUEST_APPROVED` | `contract-amendment.rules.ts → onApproved` |
| `contract.amendment_rejected` | 🔜 | Submitting Manager. | `CONTRACT_AMENDMENT / REQUEST_REJECTED` | `contract-amendment.rules.ts → onRejected` |

### Complaints domain (HR Core)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `complaint.submitted` | 🔜 | All active HR Admins. If `payload.isAnonymous`, `actorUserId` on the notification is null (anonymisation preserved end-to-end). | `COMPLAINT / REQUEST_SUBMITTED` · `referenceType='complaint'` | `complaint.rules.ts → onSubmitted` |
| `complaint.resolved` | 🔜 | Submitter (only if not anonymous; otherwise no notification — anonymous submitter has no inbox link to the complaint). | `COMPLAINT / RESOLVED` | `complaint.rules.ts → onResolved` |

### Engagement domain (Social → HR Core via EventBus)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `announcement.published` | 🔜 | Resolved per `payload.audience` (department, team, company-wide). | `ENGAGEMENT / INFO` · `referenceType='announcement'` | `engagement.rules.ts → onAnnouncement` |
| `event.created` | 🔜 | `payload.invitees[]`. | `ENGAGEMENT / INFO` · `referenceType='event'` | `engagement.rules.ts → onEventCreated` |

When Social is online, its outgoing events reach HR Core via the EventBus (Phase 2: Kafka). Until then, the bridge logs "unsubscribed event ignored" and skips.

### Exit survey domain (Social)

| Event | Status | Recipients | Notification | Rule |
|---|---|---|---|---|
| `exit_survey.sent` | 🔜 | The employee (one-shot link → token in payload). | `EXIT_SURVEY / INFO` · `referenceType='exit_survey'` | `exit-survey.rules.ts → onSent` |
| `exit_survey.completed` | 🔜 | All active HR Admins (anonymised — no `respondentId`). | `EXIT_SURVEY / RESOLVED` | `exit-survey.rules.ts → onCompleted` |

---

## Rule interface

Every rule file under `apps/hr-core/src/modules/notifications/events/routing-rules/` exports a function matching:

```ts
type RoutingRule<T = Record<string, unknown>> = (
  event: DomainEvent<T>,
  deps: { prisma: PrismaService; renderers: NotificationRenderers },
) => Promise<NotificationDraft[]>;
```

`renderers` is a small helper that turns `(category, eventType, payload)` into `{ title, body }` strings, centralising copy so rules stay focused on routing logic.

---

## Adding a new notification type (checklist)

1. Add the event type to the producing service's emission point (after-commit `eventBus.emit`).
2. Add a routing rule file under `events/routing-rules/<domain>.rules.ts` exporting a `RoutingRule`.
3. Add an entry to `notifications-events.bridge.ts` mapping the event type to the rule.
4. Add a renderer entry in `notifications.renderers.ts` for the new `(category, eventType)` pair.
5. Add a Jest unit test for the rule (happy path + actor=recipient skip + missing-recipient fallback).
6. Add a row to this contract document.

No table migration, no controller change, no DTO change.

---

## Error & retry semantics

- Routing rule failures are logged with `correlationId` and **do not** propagate back to the EventBus (handlers are async fire-and-forget for in-memory bus, per `IEventBus.emit` contract).
- A failed notification insert is recorded via Logger at `error` level with the original event payload; the underlying domain state change is unaffected (FR-022).
- Phase 2 (Kafka) will add at-least-once retry + DLQ; the rule layer is already idempotent on `(recipientUserId, referenceType, referenceId, eventType)` semantically, but there is no unique index enforcing that (legitimate duplicates exist per [data-model.md §3](../data-model.md)). The bridge therefore checks `findFirst({ where: { recipientUserId, referenceType, referenceId, eventType }})` before insert when processing replayed events; this check is skipped in Phase 1 (no replays).
