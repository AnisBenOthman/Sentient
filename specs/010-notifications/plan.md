# Implementation Plan: Notification Module

**Branch**: `010-notifications` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-notifications/spec.md`

## Summary

Deliver a **generic, event-driven in-app notification module** in HR Core that:

1. Subscribes to existing `DomainEvent`s on the in-memory `IEventBus` (leave, promotion, skills, performance, probation, contract amendments, complaints, plus Social-side announcements/exit surveys when those services come online).
2. Resolves each event to one or more concrete recipients via a small, testable **routing-rule registry** (e.g. "leave.requested → direct manager, fallback HR admins").
3. Persists notifications in `hr_core.notifications` and exposes them through five REST endpoints behind `SharedJwtGuard` + scope filtering (own-only).
4. Streams unread updates to the React frontend over **Server-Sent Events** (`GET /api/notifications/stream`) with a 60-second polling fallback, materialised as a bell icon + drawer in the top bar of every authenticated page.

Even though the user-visible MVP is the leave loop (P1 in spec) and the promotion loop (P1 in spec), the **persistence schema, routing registry, REST shape, and frontend surface are designed once to cover every feature in the platform** (skills, performance reviews, probation, contract amendments, complaints, engagement, exit surveys, etc.). Adding a new notification type later is one new rule entry + one event subscription — not a schema migration or a controller change.

## Technical Context

**Language/Version**: TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` on)
**Primary Dependencies**: NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, existing `@sentient/shared` (`IEventBus`, `DomainEvent`, `JwtPayload`, `PermissionScope`). Frontend: React 18 + Vite 7, TanStack Query v5, wouter, Tailwind CSS v4, shadcn/ui.
**Storage**: PostgreSQL 16, schema `hr_core`, one new table `notifications` plus three new enums (`notification_category`, `notification_event_type`, `notification_status`).
**Testing**: Jest unit (service + routing rules), Jest integration (with real Prisma against `hr_core` test schema), Supertest for controller and SSE smoke tests. Targets: ≥80% line coverage on `NotificationsService` and `NotificationRouter`, 100% branch coverage on routing rules.
**Target Platform**: Linux/Windows dev (Node 20+), single PostgreSQL instance via existing docker-compose. Backend on `:3001` (HR Core). Frontend on `:3000` (Vite SPA).
**Project Type**: Web application (NestJS backend + React SPA, monorepo / Turborepo).
**Performance Goals**: P95 notification create-to-visible latency ≤ 60s (spec SC-001/SC-002); P95 SSE deliver-after-emit ≤ 2s on a warm connection; inbox listing P95 ≤ 200ms for inboxes ≤ 200 notifications (spec SC-007).
**Constraints**: In-app delivery only for v1 (FR-024); no email/Slack/WhatsApp. 90-day retention (FR-021). No self-notifications (FR-011). Notification must not survive a rolled-back triggering transaction (FR-020). Multi-channel `ChannelType` lives in `@sentient/shared` but is intentionally stored as a future-proof column without dispatch logic.
**Scale/Scope**: Internal HRIS. Realistic upper bound for the FYP scope: ~500 active users, ~50 notifications/user/month, peak burst ~50 notifications/minute across the platform. Single backend instance; in-memory SSE registry is acceptable. Multi-instance horizontal scaling (Phase 2 with Kafka EventBus and Redis pub/sub for SSE fan-out) is out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository's `.specify/memory/constitution.md` is the unfilled template (no ratified principles). The de-facto constitution lives in `.claude/CLAUDE.md`, `.claude/rules/code-style.md`, `.claude/rules/security.md`, and `.claude/rules/testing.md`. The plan is checked against those gates:

| Gate (from `.claude/rules/*`) | Status | Notes |
|---|---|---|
| No `any`; strict TS; explicit return types | PASS | All new code typed against generated Prisma types + shared enums. |
| Modular NestJS: Module → Controller → Service | PASS | New `NotificationsModule` with `NotificationsController`, `NotificationsService`, `NotificationRouter`, and `NotificationsEventsBridge`. |
| `@@schema()` + `@@map()` on every Prisma model | PASS | `Notification @@schema("hr_core") @@map("notifications")`. |
| Every endpoint guarded by `SharedJwtGuard` + `RbacGuard` + `@Roles()` | PASS | All five endpoints + SSE stream guarded. SSE token check explicitly documented in research.md. |
| No cross-service DB queries; cross-service via REST or events | PASS | Module lives in HR Core. Social-side events (announcements, exit surveys) arrive via `IEventBus` only — no Prisma into other schemas. |
| EventBus abstraction (no direct REST or Kafka in business logic) | PASS | Notification creation is **only** triggered by `eventBus.subscribe()` handlers, never by direct calls from `LeavesService` or `PromotionRequestsService`. |
| DTOs validate at boundary, services trust inputs | PASS | `NotificationQueryDto`, `MarkAsReadDto` use class-validator. |
| Prisma migrations: `DROP INDEX` for `@@unique` renames | N/A | This feature only adds new tables/indexes; no constraint renames. Rule noted for future migrations. |
| Self-notifications forbidden | PASS | Enforced in `NotificationRouter.resolveRecipients()` with unit tests. |
| Notification durable only after commit (FR-020) | PASS | Triggering services emit events **after** their transaction commits (existing leave service already does this — see `requests.service.ts:152`). Notification creation is therefore implicitly post-commit. Documented as a contract in research.md. |

**Verdict**: PASS. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/010-notifications/
├── plan.md              # This file (/speckit.plan output)
├── spec.md              # Feature spec (already written)
├── research.md          # Phase 0 — decisions + alternatives
├── data-model.md        # Phase 1 — Notification entity, enums, indexes
├── quickstart.md        # Phase 1 — local dev walkthrough
├── contracts/
│   ├── rest-api.md       # 5 REST endpoints + SSE stream + DTOs
│   └── event-subscriptions.md  # Domain events consumed → routing rules → notification types
├── checklists/
│   └── requirements.md  # Quality checklist (already written, all green)
└── tasks.md             # Phase 2 — created by /speckit.tasks
```

### Source Code (repository root)

```text
apps/hr-core/
├── prisma/
│   ├── schema.prisma                                # +Notification model, +3 enums
│   └── migrations/
│       └── 20260513000000_add_notifications/
│           └── migration.sql                        # CREATE TABLE + indexes
└── src/modules/notifications/
    ├── notifications.module.ts                      # Module wiring + EventsBridge bootstrap
    ├── notifications.controller.ts                  # 5 endpoints + SSE stream
    ├── notifications.service.ts                     # Inbox queries, mark-read, retention purge
    ├── notification-router.ts                       # Event → recipients (routing-rule registry)
    ├── notification-router.spec.ts                  # Unit tests for every rule
    ├── notifications.service.spec.ts
    ├── notifications.controller.spec.ts
    ├── events/
    │   ├── notifications-events.bridge.ts           # subscribes to IEventBus, calls Router + Service
    │   ├── notifications-events.bridge.spec.ts
    │   └── routing-rules/
    │       ├── leave.rules.ts                        # leave.requested / leave.approved / leave.rejected / leave.cancelled
    │       ├── promotion.rules.ts                    # promotion.requested / promotion.approved / promotion.rejected
    │       ├── skills.rules.ts                       # skill.endorsement_requested / skill.review_due
    │       ├── performance.rules.ts                  # performance.review_assigned / performance.review_submitted / performance.cycle_launched
    │       ├── probation.rules.ts                    # probation.started / probation.evaluation_due / probation.decision.*
    │       ├── contract-amendment.rules.ts           # contract.amendment_submitted / contract.amendment_approved / contract.amendment_rejected
    │       ├── complaint.rules.ts                    # complaint.submitted / complaint.resolved
    │       ├── engagement.rules.ts                   # announcement.published / event.created (Social → HR Core via EventBus)
    │       ├── exit-survey.rules.ts                  # exit_survey.sent / exit_survey.completed
    │       └── routing-rule.interface.ts             # type RoutingRule = (event, deps) => Promise<NotificationDraft[]>
    ├── sse/
    │   ├── notifications-sse.controller.ts          # GET /api/notifications/stream (Observable<MessageEvent>)
    │   └── notifications-sse.registry.ts            # in-process Map<userId, Set<Subject>>
    ├── dto/
    │   ├── notification-response.dto.ts
    │   ├── notification-query.dto.ts
    │   ├── mark-as-read.dto.ts
    │   └── notification-payload.dto.ts              # Discriminated union (Leave | Promotion | Skill | …)
    ├── retention/
    │   ├── retention.scheduler.ts                   # @Cron daily purge of >90-day items
    │   └── retention.scheduler.spec.ts
    └── README.md                                    # Short module-level doc

packages/shared/
└── src/enums/
    ├── notification-category.enum.ts                # LEAVE | PROMOTION | SKILL | PERFORMANCE | PROBATION | CONTRACT_AMENDMENT | COMPLAINT | ENGAGEMENT | EXIT_SURVEY | SYSTEM
    ├── notification-event-type.enum.ts              # REQUEST_SUBMITTED | REQUEST_APPROVED | REQUEST_REJECTED | REQUEST_CANCELLED | DECISION_PENDING | RESOLVED | INFO
    └── notification-status.enum.ts                  # UNREAD | READ | DISMISSED

apps/web/
├── src/components/
│   ├── notifications/
│   │   ├── notifications-bell.tsx                   # Top-bar icon + unread badge
│   │   ├── notifications-drawer.tsx                 # Slide-out list with filters
│   │   ├── notification-row.tsx                     # Single row, click-through navigation
│   │   └── notifications-provider.tsx               # Context: SSE EventSource + TanStack Query cache
│   └── layout.tsx                                    # +mounts <NotificationsBell />
├── src/lib/api/
│   └── hr-core.ts                                   # +listNotifications / markAsRead / markAllAsRead
└── src/lib/notifications/
    ├── notifications-store.ts                       # Local cache helpers (TanStack Query keys)
    └── sse-client.ts                                # EventSource wrapper with reconnect + fallback poll

apps/hr-core/test/integration/
└── notifications.integration.spec.ts                # End-to-end: submit leave → notification appears → mark read
```

**Structure Decision**: This is the standard Sentient web-app layout — NestJS backend module under `apps/hr-core/src/modules/notifications/`, shared enums in `packages/shared/`, and a React feature folder under `apps/web/src/components/notifications/`. The module is **self-contained** — adding notifications for a new domain only touches `events/routing-rules/<new>.rules.ts` and registers the rule in `notifications-events.bridge.ts`. No other module changes its public surface.

## Phase 0: Outline & Research

Research questions to resolve in `research.md` before Phase 1:

1. **Realtime channel: SSE vs WebSocket vs long-poll** — single backend instance, server→client only, behind Vite dev proxy. Decision: **SSE** (simpler, native EventSource API, works through HTTP/1.1 + dev proxy, easy fallback to polling). WebSocket rejected (bidirectional overkill); long-poll rejected (worse UX).
2. **SSE auth** — `EventSource` cannot set `Authorization` header. Decision: support `?accessToken=...` query parameter validated by a thin SSE guard that re-uses `SharedJwtGuard`'s verify logic, since the React app already has the JWT in memory. Token is **not** persisted in URL history (the SSE component opens it and the route is never navigated to manually).
3. **Post-commit emission contract** — confirm the existing `LeavesService` emits **after** the Prisma transaction returns (verified at `apps/hr-core/src/modules/leaves/requests/requests.service.ts:152`). Add an explicit contract note: every domain service that wants to drive a notification MUST emit its `DomainEvent` outside its transaction. Document and lint via review for now; a tx-aware outbox is Phase 2.
4. **Recipient resolution under stale data** — when a leave request is approved hours after submission, the approver may differ from the original manager. Decision: resolve recipients **at event time**, using the recorded actor and the current Employee record (FR-009). The router accepts a small `RoutingRuleDeps` object with a `PrismaService` and a `JwtPayload`-equivalent (extracted from `event.metadata.userId`) so rules can query fresh data.
5. **Multi-recipient deduplication** — for `promotion.requested` (broadcast to all HR Admins) one of the admins may also be the requester. Decision: the router filters out actor=recipient pairs as a final step before insert, satisfying FR-011 without per-rule boilerplate.
6. **Retention strategy** — 90 days. Decision: nightly `@Cron('0 3 * * *')` job deletes `created_at < now() - interval '90 days'`. Hard delete (no archive table) per FR-021's "MAY be archived or purged". Soft-delete column `dismissed_at` exists for user-initiated dismissal, kept separate from the retention purge.
7. **Reference column shape** — every notification points to a domain object. Decision: a polymorphic `(reference_type, reference_id)` pair instead of nine nullable FKs. Cross-schema FKs are forbidden by `.claude/CLAUDE.md` regardless, and a polymorphic pair keeps the table flat. The pair is indexed `(reference_type, reference_id)` for the rare reverse lookup (e.g. cancel-time resolution: "find all notifications for leave request X").
8. **Promotion event emission** — `PromotionRequestsService` does **not** currently emit `promotion.requested` / `promotion.approved` / `promotion.rejected` events. Decision: this plan adds the emission code in those three methods as part of the feature scope (small surgical change, three `eventBus.emit()` calls). No other domain module needs new emissions — leave already emits; skills/performance/probation/etc. emissions come with those features as they are built. Until then, those routing rules sit unused but ready.
9. **SSE fan-out across instances** — out of scope (single instance for FYP). Documented as a Phase 2 follow-up: swap `NotificationsSseRegistry` for a Redis Pub/Sub-backed registry; events arriving on any instance fan out to the SSE registry on the connected instance.
10. **Frontend reconnect strategy** — `EventSource` auto-reconnects on network drop. Decision: on `error`, the React provider switches to a 60s polling fallback for ten cycles, then retries the SSE connection. Polling fallback also guarantees SC-001/SC-002 even if SSE is blocked by a corporate proxy.

**Output**: `research.md` with the 10 decisions above, each in Decision / Rationale / Alternatives form.

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete.

### 1.1 Data model → `data-model.md`

Single new table `hr_core.notifications`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK, default `gen_random_uuid()` | |
| `recipient_user_id` | uuid NOT NULL | FK → `hr_core.users.id` ON DELETE CASCADE |
| `category` | enum `notification_category` NOT NULL | LEAVE / PROMOTION / SKILL / PERFORMANCE / PROBATION / CONTRACT_AMENDMENT / COMPLAINT / ENGAGEMENT / EXIT_SURVEY / SYSTEM |
| `event_type` | enum `notification_event_type` NOT NULL | REQUEST_SUBMITTED / REQUEST_APPROVED / REQUEST_REJECTED / REQUEST_CANCELLED / DECISION_PENDING / RESOLVED / INFO |
| `title` | text NOT NULL | Rendered server-side, ≤ 140 chars |
| `body` | text NOT NULL | Rendered server-side, ≤ 500 chars; includes rejection reason when applicable |
| `payload` | jsonb NOT NULL DEFAULT '{}' | Structured details (requester, dates, salary delta, etc.) for the UI to render rich rows |
| `reference_type` | text NULL | e.g. `'leave_request'`, `'promotion_request'`, `'performance_review'`, `'skill_endorsement'` |
| `reference_id` | uuid NULL | The id of the referenced row in its own table |
| `status` | enum `notification_status` NOT NULL DEFAULT `'UNREAD'` | UNREAD / READ / DISMISSED |
| `actor_user_id` | uuid NULL | Who caused this event; used to enforce no-self-notification at insert time |
| `correlation_id` | uuid NOT NULL | Mirrored from `DomainEvent.metadata.correlationId` |
| `created_at` | timestamptz NOT NULL DEFAULT `now()` | |
| `read_at` | timestamptz NULL | Set when status flips UNREAD → READ |
| `dismissed_at` | timestamptz NULL | Set when user dismisses |

Indexes:
- `(recipient_user_id, status, created_at DESC)` — primary inbox query.
- `(recipient_user_id, category, created_at DESC)` — filter-by-category query (FR-017).
- `(reference_type, reference_id)` — reverse lookup for resolve-on-cancel (FR-004 / FR-008).
- `(created_at)` — retention purge.
- Check constraint: `actor_user_id IS DISTINCT FROM recipient_user_id`.

Three new shared enums exported from `@sentient/shared` and mirrored in Prisma:

- `NotificationCategory`: `LEAVE | PROMOTION | SKILL | PERFORMANCE | PROBATION | CONTRACT_AMENDMENT | COMPLAINT | ENGAGEMENT | EXIT_SURVEY | SYSTEM`
- `NotificationEventType`: `REQUEST_SUBMITTED | REQUEST_APPROVED | REQUEST_REJECTED | REQUEST_CANCELLED | DECISION_PENDING | RESOLVED | INFO`
- `NotificationStatus`: `UNREAD | READ | DISMISSED`

State transitions on `status`:

```
UNREAD → READ        (user opens / marks read)
UNREAD → DISMISSED   (user dismisses without reading; rare)
READ   → DISMISSED   (user clears)
*      (no transition out of DISMISSED)
```

A separate "resolved" state is **not** modelled as a `status` value — it is encoded by the existence of a **paired notification** for the same `reference_type` + `reference_id` carrying `event_type = RESOLVED`. This keeps the audit trail intact (FR-004, FR-008) while letting the inbox UI show the resolution badge.

### 1.2 REST contracts → `contracts/rest-api.md`

Five endpoints + one SSE stream, all mounted under `/api/notifications` in HR Core, all guarded by `SharedJwtGuard` + `RbacGuard` (every authenticated user — no `@Roles()` filter beyond authentication, since each user has access only to their own inbox).

| Method | Path | Purpose | Returns |
|---|---|---|---|
| `GET` | `/api/notifications` | List own notifications; supports `?status=UNREAD&category=LEAVE&limit=50&cursor=...` | `{ items: NotificationResponseDto[], nextCursor?: string, unreadCount: number }` |
| `GET` | `/api/notifications/unread-count` | Lightweight badge endpoint for polling fallback | `{ unreadCount: number }` |
| `PATCH` | `/api/notifications/:id/read` | Mark a single notification as read | `NotificationResponseDto` |
| `PATCH` | `/api/notifications/mark-all-read` | Bulk mark-all-read (optional filter by `category`) | `{ updatedCount: number }` |
| `DELETE` | `/api/notifications/:id` | Dismiss (sets `dismissed_at`) | `204 No Content` |
| `GET` | `/api/notifications/stream` | SSE stream (`text/event-stream`); accepts `?accessToken=` query param when `Authorization` header cannot be set by `EventSource` | streams `notification.created` and `notification.updated` events |

`NotificationResponseDto` shape:

```ts
{
  id: string;
  category: NotificationCategory;
  eventType: NotificationEventType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  referenceType: string | null;
  referenceId: string | null;
  status: NotificationStatus;
  createdAt: string;        // ISO
  readAt: string | null;
}
```

RBAC scope filter on **every** query: `where: { recipientUserId: user.sub }`. There is no admin-wide list endpoint (FR-013).

### 1.3 Event subscription map → `contracts/event-subscriptions.md`

Each row pairs a `DomainEvent.type` with its routing rule and the notification it produces. **All events flow through the existing `IEventBus` — no module is rewritten.** The first three rows are wired by this feature; the remainder are wired automatically by the bridge once their producing modules ship.

| Event Type | Source Service | Routing Rule | Recipients | Notification (category / event_type) |
|---|---|---|---|---|
| `leave.requested` | HR Core | `leave.rules.ts → onRequested` | Employee.managerId; fallback: active HR Admins | LEAVE / REQUEST_SUBMITTED |
| `leave.approved` | HR Core | `leave.rules.ts → onApproved` | Original requester | LEAVE / REQUEST_APPROVED |
| `leave.rejected` | HR Core | `leave.rules.ts → onRejected` | Original requester | LEAVE / REQUEST_REJECTED |
| `leave.cancelled` | HR Core (*new*) | `leave.rules.ts → onCancelled` | Manager who has the pending notification → RESOLVED notification + flip status of original | LEAVE / RESOLVED |
| `promotion.requested` | HR Core (*new*) | `promotion.rules.ts → onRequested` | All active HR Admins (minus the actor) | PROMOTION / REQUEST_SUBMITTED |
| `promotion.approved` | HR Core (*new*) | `promotion.rules.ts → onApproved` | Manager who submitted | PROMOTION / REQUEST_APPROVED |
| `promotion.rejected` | HR Core (*new*) | `promotion.rules.ts → onRejected` | Manager who submitted | PROMOTION / REQUEST_REJECTED |
| `skill.endorsement_requested` | HR Core (*future*) | `skills.rules.ts` | Endorser | SKILL / DECISION_PENDING |
| `performance.review_assigned` | HR Core (*future*) | `performance.rules.ts` | Reviewee + Reviewer | PERFORMANCE / DECISION_PENDING |
| `performance.cycle_launched` | HR Core (*future*) | `performance.rules.ts` | All participants | PERFORMANCE / INFO |
| `performance.review_completed` | HR Core | `performance.rules.ts` | Reviewee | PERFORMANCE / RESOLVED |
| `probation.started` | HR Core (*future*) | `probation.rules.ts` | Employee + Manager | PROBATION / INFO |
| `probation.evaluation_due` | HR Core (*future*) | `probation.rules.ts` | Manager | PROBATION / DECISION_PENDING |
| `probation.decision.*` | HR Core (*future*) | `probation.rules.ts` | Employee | PROBATION / RESOLVED |
| `contract.amendment_submitted` | HR Core (*future*) | `contract-amendment.rules.ts` | All active HR Admins | CONTRACT_AMENDMENT / REQUEST_SUBMITTED |
| `contract.amendment_approved` / `rejected` | HR Core (*future*) | `contract-amendment.rules.ts` | Submitting Manager | CONTRACT_AMENDMENT / REQUEST_APPROVED \| REQUEST_REJECTED |
| `complaint.submitted` | HR Core (*future*) | `complaint.rules.ts` | All active HR Admins | COMPLAINT / REQUEST_SUBMITTED |
| `announcement.published` | Social (*future*) | `engagement.rules.ts` | Targeted audience | ENGAGEMENT / INFO |
| `event.created` | Social (*future*) | `engagement.rules.ts` | Invitees | ENGAGEMENT / INFO |
| `exit_survey.sent` | Social (*future*) | `exit-survey.rules.ts` | The employee (one-shot link) | EXIT_SURVEY / INFO |
| `exit_survey.completed` | Social (*future*) | `exit-survey.rules.ts` | HR Admins (anonymous metadata only) | EXIT_SURVEY / RESOLVED |

The **first three rows** (`leave.*`) are already emitting and only need the routing rule + bridge. The **promotion rows** require adding `eventBus.emit()` calls in `PromotionRequestsService` (small, in-scope change). All other rows define the contract for future modules — they do not block this feature.

### 1.4 Quickstart → `quickstart.md`

A short walkthrough:

1. `pnpm install` (no new deps for backend; SSE uses NestJS `Sse()` decorator already available; frontend uses native `EventSource`).
2. `cd apps/hr-core && npx prisma migrate dev --name add_notifications` to create the table.
3. `pnpm --filter @sentient/shared build` (new enums).
4. `turbo dev` (HR Core on :3001, web on :3000).
5. Sign in as an employee → submit a leave request → switch to the manager account → verify bell badge increments and drawer shows the new item.
6. Approve the leave → switch back to employee → verify the approval notification arrives.
7. Submit a promotion request as a manager → sign in as HR admin → verify the notification.
8. Run `turbo test --filter=hr-core` and `turbo test:integration --filter=hr-core`.

### 1.5 Agent context update

Run `.specify/scripts/bash/update-agent-context.sh claude` after `data-model.md` and `contracts/` are written; this adds the new technology row ("Notifications module + SSE") to `CLAUDE.md`'s **Recent Changes** without overwriting manual sections.

**Output**: `data-model.md`, `contracts/rest-api.md`, `contracts/event-subscriptions.md`, `quickstart.md`, plus the agent context update.

## Complexity Tracking

No Constitution Check violations. Two design choices that may look like complexity but are intentional and worth recording:

| Choice | Why it's not over-engineering |
|---|---|
| Routing-rule registry (one file per domain) instead of inline `if (event.type === 'leave.requested')` logic | The spec is explicit about covering ALL features in the platform (skills, performance, probation, contract amendments, complaints, engagement, exit surveys). One file per domain is the lowest-friction way to keep each rule testable in isolation and to let other agents (Codex) add a rule without touching the bridge. The alternative — a 200-line switch statement — would explode within two features. |
| Polymorphic `(reference_type, reference_id)` instead of nine nullable FKs | Cross-schema FKs are forbidden by project rules; nine FKs would not pay for themselves on a notifications table that is read by exactly one query shape ("by recipient, by status, by category"). The polymorphic pair has one supporting index and is exactly what HR services typically use for activity-feed tables. |
