# Phase 0 — Research: Notification Module

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Date**: 2026-05-12

This document resolves the open technical questions called out in `plan.md` before Phase 1 design. Every entry is `Decision / Rationale / Alternatives considered`.

---

## R1. Realtime delivery channel — SSE vs WebSocket vs long-poll

**Decision**: **Server-Sent Events (SSE)** via NestJS `@Sse()` decorator. Frontend uses native `EventSource`. Polling fallback (`GET /api/notifications/unread-count` every 60 s) kicks in when the browser blocks SSE or the connection dies repeatedly.

**Rationale**:
- Notifications are strictly server→client. WebSocket's bidirectional channel is unused weight.
- `EventSource` is built into every modern browser, auto-reconnects on transient network failures, and survives the Vite dev proxy without configuration.
- NestJS ships `@Sse()` returning `Observable<MessageEvent>` — no extra library or transport server needed.
- SC-001 / SC-002 (≤ 60 s) can be met by the polling fallback alone, so SSE is purely an improvement, not a correctness dependency.

**Alternatives considered**:
- **WebSocket** (`@WebSocketGateway`): rejected. Bidirectional, requires `socket.io` or `ws`, harder to authenticate per-message, more complex reconnect.
- **Long-polling**: rejected. Higher latency, more open connections, worse UX than SSE.
- **Pure 60 s polling**: viable for SC-001 / SC-002 but feels sluggish in the inbox drawer compared to SSE. Kept as the documented fallback.

---

## R2. SSE authentication

**Decision**: The SSE endpoint accepts the JWT in **either** the `Authorization: Bearer` header (server-to-server tools that can set it) **or** an `?accessToken=` query parameter (browser `EventSource`, which cannot set custom headers). A thin `SseAuthGuard` extracts whichever is present, runs the same verification logic as `SharedJwtGuard`, and rejects with `401` on failure. Tokens never appear in URL history because the React provider attaches the SSE stream programmatically — the user never navigates to `/api/notifications/stream`.

**Rationale**:
- `EventSource` has no `headers` option in the standard API. Putting the token in a query parameter is the documented industry pattern when SSE is the chosen transport.
- The token is short-lived (15 min per `JWT_EXPIRY` in `security.md`), and access to server logs is already restricted — log scrubbing for query strings is the same risk surface as for headers.
- A separate guard class (vs. modifying `SharedJwtGuard`) keeps the existing guard's behaviour identical and isolates the SSE-specific concession.

**Alternatives considered**:
- **Cookie-based auth**: rejected. The platform uses pure bearer tokens with no cookies (`security.md` §1). Adding a cookie for one endpoint is a regression.
- **One-time SSE ticket endpoint** (`POST /api/notifications/sse-ticket` → short-lived UUID, then `GET /stream?ticket=...`): cleaner but adds a round-trip on every reconnect. Worth revisiting in Phase 2 if security review flags the query parameter; not justified for the FYP scope.

---

## R3. Post-commit emission contract

**Decision**: Every domain service that wants to drive a notification MUST emit its `DomainEvent` **outside** its Prisma transaction, i.e. after `await this.prisma.$transaction(...)` returns. The notification bridge subscribes to events on `IEventBus`, so notifications are inherently post-commit. Documented in `contracts/event-subscriptions.md` and verified by integration tests that force a rollback and assert zero notifications are created.

**Rationale**:
- The existing `LeavesService.create` already does exactly this — see `apps/hr-core/src/modules/leaves/requests/requests.service.ts:148-166`, where `eventBus.emit` is the line after the transaction returns. The new code follows the established pattern.
- A transactional outbox (insert a row inside the tx, drain after commit) is the textbook solution for at-least-once semantics across instances, but it is **out of scope**: the FYP runs a single backend instance and an `InMemoryEventBus`, so handlers run in the same process after commit. Phase 2 (Kafka EventBus) will need the outbox; this plan flags it as a known follow-up.

**Alternatives considered**:
- **Emit inside the transaction**: rejected. Notifications could appear for state that was rolled back (FR-020 violation).
- **Tx-aware outbox now**: rejected as over-engineering. Documented as the Phase 2 path.

---

## R4. Recipient resolution under stale data

**Decision**: Routing rules resolve recipients **at event-handle time**, by querying the current `Employee` / `User` records inside the rule using the bridge-provided `PrismaService`. The rule receives the original event's `metadata.userId` as the actor identifier. No data is cached.

**Rationale**:
- FR-009 demands resolution from current state ("not from a stale cache").
- The volume is low (one resolution per notification, < 100/min peak), so reading `Employee.managerId` per event is cheap and avoids cache-invalidation bugs.
- Routing rules are pure functions over `(event, deps)` — easy to unit-test by injecting a fake Prisma.

**Alternatives considered**:
- **Cache manager-id pairs in the event payload**: rejected. Producers (Leave service) would have to be aware of the notification routing rules — leaks notification concerns into unrelated services.
- **Cache in Redis with short TTL**: rejected. No Redis in the stack today; adding it for this is over-budget.

---

## R5. Multi-recipient deduplication + no-self-notification

**Decision**: The router computes a recipient list per event, then applies a final pipeline step `recipients.filter(r => r !== event.metadata.userId)` before insert. Within a single event, recipients are also deduplicated by `userId`.

**Rationale**:
- FR-011 forbids self-notifications regardless of category.
- Putting the filter in the bridge (one place) rather than each rule (nine places) keeps rules small and removes a class of "the rule author forgot the filter" bugs.
- A unique partial index `(reference_type, reference_id, recipient_user_id, event_type)` is **not** added: legitimate duplicates can exist across event types (e.g. one SUBMITTED, one RESOLVED for the same leave-request id). De-dup at the router level is sufficient.

**Alternatives considered**:
- **DB-level CHECK on `actor_user_id IS DISTINCT FROM recipient_user_id`**: kept as a defence-in-depth net (in `data-model.md`) but is not the primary enforcement layer.

---

## R6. Retention

**Decision**: 90-day hard delete via a daily `@Cron('0 3 * * *')` job (`RetentionScheduler`) running on HR Core. Deletes rows where `created_at < now() - interval '90 days'`. No archive table. `dismissed_at` is preserved on rows until they age out and is unrelated to retention purge.

**Rationale**:
- FR-021 permits "archive or purge". Hard delete is the simplest, satisfies SC requirements, and keeps the inbox query fast.
- 3:00 AM (server time) is outside business hours.
- Index on `(created_at)` makes the purge a fast range scan.

**Alternatives considered**:
- **Archive to a separate table**: rejected. No business need to query archived notifications; the audit trail for the underlying request (leave/promotion) is preserved in those domains.
- **Soft delete with `deleted_at`**: rejected. Adds query-time `WHERE deleted_at IS NULL` overhead to every inbox query for no business gain.

---

## R7. Reference column shape — polymorphic pair vs nine nullable FKs

**Decision**: Polymorphic pair `(reference_type text, reference_id uuid)` with an index `(reference_type, reference_id)`. No FK constraints (forbidden by project rules anyway, since events from Social would point to social-schema ids).

**Rationale**:
- The notifications table is read by **one query shape**: "by recipient, optionally filtered by status / category, ordered by created_at desc". The reverse lookup ("find notifications for leave request X" to mark resolved on cancel) is the only secondary access pattern, and a single composite index covers it.
- Nine nullable FK columns would balloon row width, add nine indexes most of which are rarely used, and still leave Social-side references unconstrained.
- Polymorphic pairs are the standard pattern for activity-feed / notification tables in Rails, Django, and Phoenix codebases — well-understood and self-documenting.

**Alternatives considered**:
- **One FK column per domain**: rejected per above.
- **Single `reference_url` string**: rejected. The frontend can construct the URL from `(reference_type, reference_id)` and avoid coupling the backend to frontend routes.

---

## R8. Promotion event emission

**Decision**: This feature adds three `eventBus.emit()` calls to `PromotionRequestsService`:

- `promotion.requested` after `create()` returns from its (non-transactional) Prisma call.
- `promotion.approved` after the approval method commits (the approval method does not yet exist in `promotion-requests.service.ts` — it will be added by feature 010 alongside the emissions; if approval/reject is already shipped by Codex by the time this lands, the emission is appended to the existing methods and the corresponding integration test is added).
- `promotion.rejected` after the rejection method commits.

The bridge subscribes to these three event types and routes accordingly.

**Rationale**:
- Without this, the spec's P1 promotion loop has no source of truth.
- The leave service already follows this pattern; the promotion service should match.
- All other domain services (skills, performance, probation, contract amendments, complaints) will emit their own events as those features ship — the bridge is already subscribed to the canonical event names listed in `contracts/event-subscriptions.md`.

**Alternatives considered**:
- **Call `NotificationsService` directly from `PromotionRequestsService`**: rejected. Violates the EventBus abstraction (`security.md` §4 and the architecture rules in `CLAUDE.md`). Couples promotion logic to notifications and makes the promotion module untestable without notifications.

---

## R9. SSE fan-out across multiple backend instances

**Decision**: Out of scope for v1. The `NotificationsSseRegistry` is an in-process `Map<userId, Set<Subject>>`. A user connected to instance A will not receive realtime pushes for an event handled on instance B; the 60-second polling fallback ensures eventual delivery and SC-001 / SC-002 are still met.

**Rationale**:
- The FYP runs a single backend instance per service. Horizontal scaling is a Phase 2 concern.
- Phase 2 will swap the in-process registry for a Redis Pub/Sub-backed registry. Documented in plan.md complexity tracking and CLAUDE.md.

**Alternatives considered**:
- **Build Redis fan-out now**: rejected as over-engineering for the FYP. Polling fallback delivers SC compliance without it.

---

## R10. Frontend reconnect & polling-fallback strategy

**Decision**: The React `NotificationsProvider` opens an `EventSource` on mount. On `error` it:

1. Increments a backoff counter.
2. Closes the failed stream.
3. Starts a 60-second polling loop hitting `GET /api/notifications/unread-count` and `GET /api/notifications?status=UNREAD&limit=20` (the latter only when the badge increments).
4. After ten polling cycles (10 minutes), attempts to re-open the SSE stream.
5. On successful SSE re-open, cancels the polling loop.

**Rationale**:
- `EventSource` already retries automatically on transient drops (every ~3 seconds by default), so the explicit fallback only triggers when the SSE pathway is genuinely unavailable (corporate proxy, server misconfiguration).
- The polling cadence matches SC-001 / SC-002's 60-second window.
- TanStack Query handles the cache merge for both push and pull updates — same `queryKey: ['notifications']` for both paths, so React components do not need to know which path delivered the data.

**Alternatives considered**:
- **Polling only, no SSE**: rejected. Worse UX in the inbox drawer; the user would see a 60s lag for every action.
- **SSE only, no fallback**: rejected. Some networks block `text/event-stream`; without a fallback the inbox would silently stall.
