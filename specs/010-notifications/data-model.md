# Phase 1 — Data Model: Notification Module

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)
**Date**: 2026-05-12

One new table (`hr_core.notifications`) and three new enums. No changes to existing tables. No cross-schema relationships.

---

## 1. Enums (shared package + Prisma)

All three live in `packages/shared/src/enums/` (single source of truth) and are mirrored in `apps/hr-core/prisma/schema.prisma` with `@@schema("hr_core")` so they exist as PostgreSQL types in the `hr_core` schema.

### `NotificationCategory`

```ts
export enum NotificationCategory {
  LEAVE = 'LEAVE',
  PROMOTION = 'PROMOTION',
  SKILL = 'SKILL',
  PERFORMANCE = 'PERFORMANCE',
  PROBATION = 'PROBATION',
  CONTRACT_AMENDMENT = 'CONTRACT_AMENDMENT',
  COMPLAINT = 'COMPLAINT',
  ENGAGEMENT = 'ENGAGEMENT',
  EXIT_SURVEY = 'EXIT_SURVEY',
  SYSTEM = 'SYSTEM',
}
```

`SYSTEM` is reserved for platform-level notices (e.g. "your password expires in 7 days") and is not wired by this feature, but the value is reserved now to avoid an enum migration later.

### `NotificationEventType`

```ts
export enum NotificationEventType {
  REQUEST_SUBMITTED = 'REQUEST_SUBMITTED',   // Approver-side: "X submitted Y"
  REQUEST_APPROVED = 'REQUEST_APPROVED',     // Requester-side: "Your Y was approved"
  REQUEST_REJECTED = 'REQUEST_REJECTED',     // Requester-side: "Your Y was rejected (reason)"
  REQUEST_CANCELLED = 'REQUEST_CANCELLED',   // Approver-side: original notification of a now-cancelled request
  DECISION_PENDING = 'DECISION_PENDING',     // Generic "action needed" (e.g. probation evaluation due)
  RESOLVED = 'RESOLVED',                     // Paired with an earlier SUBMITTED/DECISION_PENDING; closes the loop
  INFO = 'INFO',                             // No action required (announcements, cycle launched, etc.)
}
```

### `NotificationStatus`

```ts
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  DISMISSED = 'DISMISSED',
}
```

Allowed transitions: `UNREAD → READ`, `UNREAD → DISMISSED`, `READ → DISMISSED`. No transition out of `DISMISSED`. Enforced in `NotificationsService.markRead` / `dismiss` with a precondition check.

---

## 2. Prisma model

```prisma
enum NotificationCategory {
  LEAVE
  PROMOTION
  SKILL
  PERFORMANCE
  PROBATION
  CONTRACT_AMENDMENT
  COMPLAINT
  ENGAGEMENT
  EXIT_SURVEY
  SYSTEM

  @@schema("hr_core")
}

enum NotificationEventType {
  REQUEST_SUBMITTED
  REQUEST_APPROVED
  REQUEST_REJECTED
  REQUEST_CANCELLED
  DECISION_PENDING
  RESOLVED
  INFO

  @@schema("hr_core")
}

enum NotificationStatus {
  UNREAD
  READ
  DISMISSED

  @@schema("hr_core")
}

model Notification {
  id              String                @id @default(uuid()) @db.Uuid
  recipientUserId String                @map("recipient_user_id") @db.Uuid
  category        NotificationCategory
  eventType       NotificationEventType @map("event_type")
  title           String                @db.VarChar(160)
  body            String                @db.VarChar(600)
  payload         Json                  @default("{}")
  referenceType   String?               @map("reference_type") @db.VarChar(64)
  referenceId     String?               @map("reference_id") @db.Uuid
  status          NotificationStatus    @default(UNREAD)
  actorUserId     String?               @map("actor_user_id") @db.Uuid
  correlationId   String                @map("correlation_id") @db.Uuid
  createdAt       DateTime              @default(now()) @map("created_at") @db.Timestamptz(6)
  readAt          DateTime?             @map("read_at") @db.Timestamptz(6)
  dismissedAt     DateTime?             @map("dismissed_at") @db.Timestamptz(6)

  recipient User @relation("UserNotifications", fields: [recipientUserId], references: [id], onDelete: Cascade)

  @@index([recipientUserId, status, createdAt(sort: Desc)], name: "idx_notif_recipient_status_created")
  @@index([recipientUserId, category, createdAt(sort: Desc)], name: "idx_notif_recipient_category_created")
  @@index([referenceType, referenceId], name: "idx_notif_reference")
  @@index([createdAt], name: "idx_notif_created_at")
  @@map("notifications")
  @@schema("hr_core")
}
```

`User` model gets the inverse side appended (one line):

```prisma
notifications Notification[] @relation("UserNotifications")
```

### Migration SQL (the parts Prisma cannot express directly)

After `npx prisma migrate dev --name add_notifications`, append a `CHECK` constraint via raw SQL in the generated migration (Prisma's `@check` is not yet GA in 5.x, so this is appended at the bottom of `migration.sql`):

```sql
ALTER TABLE "hr_core"."notifications"
  ADD CONSTRAINT "ck_notif_no_self"
  CHECK ("actor_user_id" IS NULL OR "actor_user_id" <> "recipient_user_id");
```

No `DROP INDEX` / `DROP CONSTRAINT` operations are needed — this is a pure additive migration. The "DROP INDEX vs DROP CONSTRAINT" rule in `code-style.md` is preserved for future migrations that touch this table.

---

## 3. Field semantics & validation rules

| Field | Validation / invariant |
|---|---|
| `recipientUserId` | MUST exist in `users`. Cascade-delete on user removal (acceptable: a deleted user's inbox is irretrievable anyway). |
| `category` | Required. Constrained to enum. Used by the inbox category filter (FR-017). |
| `eventType` | Required. Constrained to enum. Drives icon / badge in the UI. |
| `title` | Required, ≤ 140 chars (column is 160 to leave headroom). Rendered server-side from a template keyed on `(category, eventType)`. Never contains PII like email; uses display names. |
| `body` | Required, ≤ 500 chars (column is 600). Contains the rejection reason verbatim when applicable (FR-003 / FR-007); rejection reason is truncated at 400 chars with `…` suffix to stay inside the column. |
| `payload` | JSONB, default `{}`. Shape depends on `(category, eventType)`. See section 4 below. |
| `referenceType` | Nullable string ≤ 64 chars (e.g. `'leave_request'`, `'promotion_request'`, `'performance_review'`). |
| `referenceId` | Nullable UUID. Together with `referenceType` identifies the row this notification points at. The UI uses the pair to construct the deep link. |
| `status` | Defaults to `UNREAD`. Transitions enforced in code (see §1). |
| `actorUserId` | The user whose action caused the event. Nullable for system-generated events (e.g. `probation.evaluation_due` cron). DB CHECK ensures `actorUserId <> recipientUserId` to belt-and-braces FR-011. |
| `correlationId` | UUID copied from `DomainEvent.metadata.correlationId`. Lets ops trace a notification back to the request that produced it. |
| `createdAt` | Auto. Drives ordering and the retention purge. |
| `readAt` | Set when status flips to `READ`. Null otherwise. |
| `dismissedAt` | Set when status flips to `DISMISSED`. Null otherwise. |

---

## 4. `payload` shape per `(category, eventType)`

Server-side render in routing rules. Frontend can show richer rows by reading `payload` directly.

| (category, eventType) | `payload` fields |
|---|---|
| `(LEAVE, REQUEST_SUBMITTED)` | `{ requesterId, requesterName, leaveTypeId, leaveTypeName, startDate, endDate, totalDays }` |
| `(LEAVE, REQUEST_APPROVED)` | `{ approverId, approverName, leaveTypeName, startDate, endDate, totalDays }` |
| `(LEAVE, REQUEST_REJECTED)` | `{ approverId, approverName, leaveTypeName, startDate, endDate, reason }` |
| `(LEAVE, RESOLVED)` *(cancel-by-submitter)* | `{ originalNotificationId, reason: 'CANCELLED_BY_REQUESTER' }` |
| `(PROMOTION, REQUEST_SUBMITTED)` | `{ requesterId, requesterName, employeeId, employeeName, currentRole, newRole, currentSalary, newSalary, salaryDelta, salaryDeltaPct }` |
| `(PROMOTION, REQUEST_APPROVED)` | `{ approverId, approverName, employeeId, employeeName, currentRole, newRole, salaryDelta, effectiveDate? }` |
| `(PROMOTION, REQUEST_REJECTED)` | `{ approverId, approverName, employeeId, employeeName, reason }` |
| `(PROMOTION, RESOLVED)` *(resolved-by-other-admin)* | `{ originalNotificationId, decidedById, decidedByName, decision: 'APPROVED' \| 'REJECTED' }` |
| `(SKILL, DECISION_PENDING)` | `{ skillId, skillName, requesterId, requesterName, level }` |
| `(PERFORMANCE, DECISION_PENDING)` | `{ reviewId, cycleId, cycleName, dueDate }` |
| `(PERFORMANCE, INFO)` | `{ cycleId, cycleName, startDate, endDate }` |
| `(PERFORMANCE, RESOLVED)` | `{ reviewId, overallRating, reviewerId, reviewerName }` |
| `(PROBATION, INFO)` | `{ periodId, startDate, endDate }` |
| `(PROBATION, DECISION_PENDING)` | `{ periodId, dueDate }` |
| `(PROBATION, RESOLVED)` | `{ periodId, decision: 'CONFIRMED' \| 'EXTENDED' \| 'TERMINATED', decidedById }` |
| `(CONTRACT_AMENDMENT, REQUEST_SUBMITTED)` | `{ amendmentId, requesterId, requesterName, employeeId, employeeName, amendmentType }` |
| `(CONTRACT_AMENDMENT, REQUEST_APPROVED \| REQUEST_REJECTED)` | `{ amendmentId, approverId, approverName, reason? }` |
| `(COMPLAINT, REQUEST_SUBMITTED)` | `{ complaintId, isAnonymous, severity }` *(submitter info redacted when anonymous)* |
| `(ENGAGEMENT, INFO)` | `{ announcementId \| eventId, title }` |
| `(EXIT_SURVEY, INFO)` | `{ surveyId, surveyToken }` *(one-shot link)* |
| `(EXIT_SURVEY, RESOLVED)` | `{ surveyId, completedAt }` *(no respondentId — anonymised per `security.md` §10)* |

The shape is **documented** rather than schema-enforced at the DB level — `payload` is a free-form JSONB so adding fields later is non-breaking. The router-rule implementations are the single source of truth for which fields each row actually contains; payload DTOs in `packages/shared/src/dto/notifications/` mirror these shapes for typed frontend consumption.

---

## 5. Query patterns and index justification

Five primary queries the table supports:

1. **List inbox (most common)** — `SELECT * FROM notifications WHERE recipient_user_id = $1 AND status <> 'DISMISSED' [AND category = $2] ORDER BY created_at DESC LIMIT 50 OFFSET 0`. Hits `idx_notif_recipient_status_created` (or `idx_notif_recipient_category_created` when category filter is applied).
2. **Unread badge count** — `SELECT COUNT(*) FROM notifications WHERE recipient_user_id = $1 AND status = 'UNREAD'`. Hits `idx_notif_recipient_status_created` (status filter is selective).
3. **Mark a single as read** — `UPDATE … WHERE id = $1 AND recipient_user_id = $2` — primary key + scope check; trivially fast.
4. **Resolve-by-reference on cancel** — `UPDATE notifications SET status='READ', read_at=now() WHERE reference_type='leave_request' AND reference_id=$1 AND status='UNREAD'` plus an INSERT of a paired `RESOLVED` notification. Hits `idx_notif_reference`.
5. **Retention purge** — `DELETE FROM notifications WHERE created_at < now() - interval '90 days'`. Hits `idx_notif_created_at`.

Indexes are kept to four — every one of them is justified by a query above. No speculative indexes.

---

## 6. Cross-schema integrity (deliberate non-relationships)

`(referenceType, referenceId)` deliberately has **no** FK constraint, even for in-schema references like `leave_request`. The reasons:

1. **Mixed schemas** — `engagement.announcement` and `exit_survey` references point to Social-schema rows. Cross-schema FKs are forbidden by `CLAUDE.md` §3.2.
2. **Cascade behaviour** — if the underlying request is hard-deleted (rare; most domains soft-delete), the notification should remain visible to the recipient as historical "this request happened". A FK would force `ON DELETE SET NULL` or cascade, neither of which matches that semantics cleanly.
3. **Read consistency** — the frontend constructs the deep link from `(referenceType, referenceId)` and lets the target page handle 404 gracefully. The notification table does not need to know whether the target still exists.

---

## 7. RBAC at the data layer

There is no scope filter beyond `recipient_user_id = $jwt.sub` on every query. A user can only see their own inbox; HR Admins have no privileged view (FR-013). The controller enforces this via `where: { recipientUserId: user.sub }` on **every** read path; no admin-wide endpoint is exposed.

The router (server-side) sees every notification it creates, but routing rules are isolated by domain — there is no API surface for routing decisions.
