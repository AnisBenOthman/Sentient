---
description: "Task list for 010-notifications — generic in-app notification module"
---

# Tasks: Notification Module

**Input**: Design documents from `/specs/010-notifications/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md, contracts/event-subscriptions.md, quickstart.md

**Tests**: Tests are included sparingly — one unit-test task per routing-rule file (rules are small, pure functions and are easiest to certify by exhaustive unit tests) and one rollback-safety integration test for FR-020. The Sentient project's `.claude/rules/testing.md` informs this; full E2E coverage is out of scope for this feature's tasks.

**Organization**: Tasks are grouped by user story. The first two phases are shared infrastructure; Phases 3–5 deliver US1, US2, US3 independently; Phase 6 adds real-time SSE, retention, and rollback-safety hardening.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no incomplete-task dependencies — safe to run in parallel.
- **[Story]**: US1 / US2 / US3 maps to the user stories in [spec.md](./spec.md).
- File paths are absolute project paths (relative to repo root `C:\Users\Anis\Downloads\Sentient\`).

## Path Conventions

- Backend: `apps/hr-core/src/modules/notifications/`
- Shared types: `packages/shared/src/enums/`, `packages/shared/src/dto/notifications/`
- Frontend: `apps/web/src/components/notifications/`, `apps/web/src/lib/api/`, `apps/web/src/lib/notifications/`
- Migrations: `apps/hr-core/prisma/migrations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ship the three new shared enums so HR Core and the frontend can import them.

- [x] T001 [P] Add `NotificationCategory` enum at `packages/shared/src/enums/notification-category.enum.ts` (values per [data-model.md §1](./data-model.md): LEAVE, PROMOTION, SKILL, PERFORMANCE, PROBATION, CONTRACT_AMENDMENT, COMPLAINT, ENGAGEMENT, EXIT_SURVEY, SYSTEM)
- [x] T002 [P] Add `NotificationEventType` enum at `packages/shared/src/enums/notification-event-type.enum.ts` (REQUEST_SUBMITTED, REQUEST_APPROVED, REQUEST_REJECTED, REQUEST_CANCELLED, DECISION_PENDING, RESOLVED, INFO)
- [x] T003 [P] Add `NotificationStatus` enum at `packages/shared/src/enums/notification-status.enum.ts` (UNREAD, READ, DISMISSED)
- [x] T004 Append the three new exports to `packages/shared/src/enums/index.ts` (alphabetical order beside the existing notification-adjacent entries)
- [x] T005 Build `@sentient/shared` so the new enums are emitted to `packages/shared/dist/`: run `pnpm --filter @sentient/shared build` and verify `dist/enums/notification-category.enum.js` exists

**Checkpoint**: New enums are importable from `@sentient/shared` by HR Core and the React app.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, module wiring, DTOs, and the empty event bridge — everything every user story depends on. NO user-story behaviour is implemented here.

**⚠️ CRITICAL**: No work in Phases 3–5 may begin until this phase is green.

### Database

- [x] T006 Add the three Prisma enums and the `Notification` model to `apps/hr-core/prisma/schema.prisma` exactly as specified in [data-model.md §2](./data-model.md), including the four indexes (`idx_notif_recipient_status_created`, `idx_notif_recipient_category_created`, `idx_notif_reference`, `idx_notif_created_at`) and the `recipient User @relation("UserNotifications")` field
- [x] T007 Append the back-relation `notifications Notification[] @relation("UserNotifications")` to the existing `User` model in `apps/hr-core/prisma/schema.prisma`
- [x] T008 Run `cd apps/hr-core && npx prisma migrate dev --name add_notifications` to generate `apps/hr-core/prisma/migrations/<timestamp>_add_notifications/migration.sql`
- [x] T009 Manually append the `ck_notif_no_self` CHECK constraint at the bottom of the generated `migration.sql` (SQL block in [data-model.md §2](./data-model.md)), then re-run `npx prisma migrate dev` to apply
- [x] T010 Run `cd apps/hr-core && npx prisma generate` to refresh the generated Prisma client at `apps/hr-core/src/generated/prisma`

### DTOs

- [x] T011 [P] Create `apps/hr-core/src/modules/notifications/dto/notification-response.dto.ts` per [contracts/rest-api.md → DTOs](./contracts/rest-api.md), importing enum types from `@sentient/shared`
- [x] T012 [P] Create `apps/hr-core/src/modules/notifications/dto/notification-query.dto.ts` with `status`, `category`, `referenceType`, `cursor`, `limit` (class-validator decorators per contract)
- [x] T013 [P] Create `apps/hr-core/src/modules/notifications/dto/mark-all-read.dto.ts` with optional `category` field
- [x] T014 [P] Create `apps/hr-core/src/modules/notifications/dto/notification-draft.interface.ts` exporting the `NotificationDraft` interface used by routing rules ([contracts/event-subscriptions.md → Wiring overview](./contracts/event-subscriptions.md))

### Module skeleton

- [x] T015 [P] Create `apps/hr-core/src/modules/notifications/events/routing-rules/routing-rule.interface.ts` exporting `type RoutingRule<T> = (event: DomainEvent<T>, deps: { prisma: PrismaService; renderers: NotificationRenderers }) => Promise<NotificationDraft[]>;`
- [x] T016 [P] Create `apps/hr-core/src/modules/notifications/notifications.renderers.ts` exporting `NotificationRenderers` — a map keyed on `${category}:${eventType}` returning `(payload) => { title, body }`. Start empty; rule phases populate entries
- [x] T017 Create `apps/hr-core/src/modules/notifications/notification-router.ts` implementing the no-self filter (R5) and recipient dedup; exposes `route(event, drafts): Promise<NotificationDraft[]>`
- [x] T018 Create `apps/hr-core/src/modules/notifications/notifications.service.ts` skeleton: constructor injects `PrismaService`; expose method stubs `bulkCreate(drafts)`, `list(userId, query)`, `getUnreadCount(userId)`, `markRead(id, userId)`, `markAllRead(userId, category?)`, `dismiss(id, userId)`, `purgeOlderThan(date)`, `findOpenByReference(referenceType, referenceId, userId?)` — bodies implemented in story phases
- [x] T019 Create `apps/hr-core/src/modules/notifications/notifications.controller.ts` skeleton with `@Controller('notifications')`, `@UseGuards(SharedJwtGuard, RbacGuard)`, Swagger `@ApiTags('Notifications')`; declare empty handlers for the five REST endpoints (returns `null` for now — implemented in story phases)
- [x] T020 Create `apps/hr-core/src/modules/notifications/events/notifications-events.bridge.ts`: `@Injectable()` class implementing `OnApplicationBootstrap`; injects `EVENT_BUS`, `NotificationRouter`, `NotificationsService`, `PrismaService`; on bootstrap, subscribes to **all** event types listed in [contracts/event-subscriptions.md](./contracts/event-subscriptions.md) but dispatches to an empty rule map (rules wired in story phases). The dispatch function (a) looks up the rule, (b) calls it with `{ prisma, renderers }`, (c) sends the draft list through `NotificationRouter.route`, (d) calls `NotificationsService.bulkCreate`
- [x] T021 Create `apps/hr-core/src/modules/notifications/notifications.module.ts` wiring `controllers: [NotificationsController]`, `providers: [NotificationsService, NotificationRouter, NotificationRenderers, NotificationsEventsBridge, { provide: EVENT_BUS, useExisting: EVENT_BUS }]`, `imports: [PrismaModule]`, `exports: [NotificationsService]`
- [x] T022 Register `NotificationsModule` in `apps/hr-core/src/app.module.ts` `imports` array (alphabetical with other domain modules)

**Checkpoint**: HR Core compiles, boots, and exposes `/api/notifications` with 200 OK on `list` returning an empty page; the bridge subscribes silently and does nothing on emit. Foundation is ready.

---

## Phase 3: User Story 1 — Leave-Request Notification Loop (Priority: P1) 🎯 MVP

**Goal**: Manager is notified the moment an employee submits a leave request; the employee is notified when the manager approves or rejects; manager's pending notification is resolved when the employee cancels (FR-001 to FR-004, FR-009 to FR-013).

**Independent Test**: Sign in as an employee, submit a leave request; switch to the direct manager — the notification appears within 60 s with the correct payload. Approve it; switch back to the employee — the approval notification appears. Reject with a reason; verify the rejection notification body contains the reason verbatim. Cancel a pending request as the submitter and verify the manager's pending notification is marked resolved.

### Backend — service implementation

- [x] T023 [US1] Implement `NotificationsService.bulkCreate(drafts)` in `apps/hr-core/src/modules/notifications/notifications.service.ts` using `prisma.notification.createMany({ data: drafts })` then return the inserted rows (re-fetch by `correlationId` + `recipientUserId`)
- [x] T024 [US1] Implement `NotificationsService.list(userId, query)` with cursor pagination per [data-model.md §5](./data-model.md) (decode base64url cursor, apply `(created_at, id) <` filter, ORDER BY `created_at DESC, id DESC`)
- [x] T025 [US1] Implement `NotificationsService.getUnreadCount(userId)` as `prisma.notification.count({ where: { recipientUserId: userId, status: 'UNREAD' } })`
- [x] T026 [US1] Implement `NotificationsService.markRead(id, userId)`: enforces ownership (`where: { id, recipientUserId: userId }`), throws `NotFoundException` when not found, `ConflictException` if `status='DISMISSED'`, otherwise `UPDATE status='READ', read_at=now()` and returns the row
- [x] T027 [US1] Implement `NotificationsService.findOpenByReference(referenceType, referenceId, recipientUserId?)` — used by cancel/decision rules to flip status to READ on pending broadcast notifications

### Backend — controller (list + unread + markRead)

- [x] T028 [US1] Implement `GET /api/notifications` in `notifications.controller.ts` calling `NotificationsService.list`, Swagger annotated, scope is hardcoded to `user.sub`
- [x] T029 [US1] Implement `GET /api/notifications/unread-count` returning `{ unreadCount }`
- [x] T030 [US1] Implement `PATCH /api/notifications/:id/read` calling `markRead`

### Backend — leave routing rule

- [x] T031 [US1] Create `apps/hr-core/src/modules/notifications/events/routing-rules/leave.rules.ts` exporting `onRequested`, `onApproved`, `onRejected`, `onCancelled` — each is a `RoutingRule`. Implementations per [contracts/event-subscriptions.md → Leave domain](./contracts/event-subscriptions.md):
  - `onRequested`: look up `Employee.managerId` from `event.payload.employeeId` via `deps.prisma`; if null, look up all active users holding role code `HR_ADMIN` or `GLOBAL_HR_ADMIN` and broadcast (FR-010); render title/body via `deps.renderers`; set `referenceType='leave_request'`, `referenceId=event.payload.leaveRequestId`
  - `onApproved` / `onRejected`: single recipient = original requester resolved from `Employee.id → User.id`; rejection body includes `payload.reviewNote`
  - `onCancelled`: (a) find open `(reference_type='leave_request', reference_id=...)` notifications via `NotificationsService.findOpenByReference`, (b) flip those to READ via a service method `markResolved(ids, recipientUserId)`, (c) emit one paired `LEAVE / RESOLVED` notification with `payload.originalNotificationId`
- [x] T032 [US1] Add `(LEAVE, REQUEST_SUBMITTED)`, `(LEAVE, REQUEST_APPROVED)`, `(LEAVE, REQUEST_REJECTED)`, `(LEAVE, RESOLVED)` template entries to `notifications.renderers.ts` (copy strings per [data-model.md §4](./data-model.md))
- [x] T033 [US1] Register the four leave event types (`leave.requested`, `leave.approved`, `leave.rejected`, `leave.cancelled`) in `notifications-events.bridge.ts` mapping to the four rule functions
- [x] T034 [US1] Add `eventBus.emit('leave.cancelled', …)` to `apps/hr-core/src/modules/leaves/requests/requests.service.ts` `cancel()` method, **after** the Prisma transaction commits, mirroring the existing `leave.requested` emission pattern at line 152. Payload: `{ leaveRequestId, employeeId, cancelledAt: new Date().toISOString() }`. If the cancel method does not yet exist, add it (RBAC: requester only) before adding the emission
- [x] T035 [US1] Add `NotificationsService.markResolved(ids, recipientUserId)` — bulk update `status='READ', read_at=now()` for the given IDs scoped to recipient

### Backend — tests

- [ ] T036 [US1] Unit test `apps/hr-core/src/modules/notifications/events/routing-rules/leave.rules.spec.ts`: mock `PrismaService`; assert onRequested routes to manager / fallback to HR Admin when manager null / skips self-notification; onApproved/onRejected resolve original requester; rejection body contains reason; onCancelled resolves pending + emits paired RESOLVED
- [ ] T037 [US1] Integration test `apps/hr-core/test/integration/notifications-leave.integration.spec.ts`: seed Employee + Manager + LeaveType + LeaveBalance; call `LeavesService.create`; assert exactly one notification row exists for the manager with the right payload; approve via `LeavesService.approve`; assert the employee has a row with `eventType='REQUEST_APPROVED'`; reject another request with reason; assert reason appears in body

### Frontend — API client + minimal inbox

- [x] T038 [P] [US1] Add `listNotifications`, `getUnreadCount`, `markAsRead` typed Axios functions to `apps/web/src/lib/api/hr-core.ts` (import `NotificationResponseDto` mirror types from `@sentient/shared` or define a local mirror)
- [x] T039 [P] [US1] Create `apps/web/src/lib/notifications/notifications-store.ts` exposing TanStack Query keys (`['notifications', filters]`, `['notifications', 'unread-count']`) and helper invalidators
- [x] T040 [P] [US1] Create `apps/web/src/components/notifications/notifications-provider.tsx`: TanStack Query context provider that polls `getUnreadCount` every 30 s and `listNotifications({ status: 'UNREAD', limit: 20 })` every 30 s when the drawer is open
- [x] T041 [P] [US1] Create `apps/web/src/components/notifications/notification-row.tsx`: renders one row (icon by category, title, body, relative timestamp); on click calls `markAsRead` then navigates to deep link constructed from `(referenceType, referenceId)` — `leave_request` → `/leave-management?requestId=...` for managers, `/leaves?requestId=...` for employees
- [x] T042 [US1] Create `apps/web/src/components/notifications/notifications-drawer.tsx`: shadcn `Sheet` with a list of rows from the provider; empty state when no notifications
- [x] T043 [US1] Create `apps/web/src/components/notifications/notifications-bell.tsx`: shadcn `Button` with a `Bell` icon + numeric badge (uses `unreadCount` from the provider); on click opens the drawer
- [x] T044 [US1] Mount `<NotificationsProvider>` near the top of the React tree in `apps/web/src/App.tsx` and add `<NotificationsBell />` to the top bar in `apps/web/src/components/layout.tsx`

**Checkpoint**: US1 (P1) is shippable. The leave loop works end-to-end with 30 s polling; manager and employee both see and act on notifications.

---

## Phase 4: User Story 2 — Promotion-Request Notification Loop (Priority: P1)

**Goal**: HR Admins are notified of incoming promotion requests; the submitting manager is notified of the decision; other HR Admins' pending broadcast notifications are resolved when one of them decides (FR-005 to FR-008, FR-009, FR-011, FR-013).

**Independent Test**: Sign in as a manager and submit a promotion request — all active HR Admins receive a notification within 60 s (minus the actor if the actor happens to be an HR Admin themselves). Approve as one HR Admin; the submitting manager receives the approval. Other HR Admins' original notifications are now marked resolved with `payload.decision='APPROVED'`. Repeat with rejection and a reason — manager sees the reason.

### Backend — emit promotion events

- [x] T045 [US2] In `apps/hr-core/src/modules/promotion-requests/promotion-requests.service.ts`, add `eventBus.emit('promotion.requested', …)` **after** the `prisma.promotionRequest.create` in `create()` returns. Payload: `{ promotionRequestId, employeeId, requestedById, currentRole, newRole, currentGrossSalary, newGrossSalary, salaryDelta, salaryDeltaPercentage }`
- [x] T046 [US2] Add `approve(id, dto, user)` and `reject(id, dto, user)` methods to `PromotionRequestsService` if they do not exist (mirroring `LeavesService.approve/reject`). Each must (a) verify caller has `HR_ADMIN` scope, (b) flip `status` inside a Prisma transaction, (c) record the approver, (d) **after commit**, emit `promotion.approved` or `promotion.rejected` with payload `{ promotionRequestId, employeeId, requestedById, decidedById, decidedAt, reason? }`. The corresponding REST endpoints `PATCH /api/promotion-requests/:id/approve|reject` must be added to `promotion-requests.controller.ts` with `@Roles('HR_ADMIN', 'GLOBAL_HR_ADMIN')` guards
- [x] T047 [US2] Inject `IEventBus` (token `EVENT_BUS`) into `PromotionRequestsService` via its constructor (mirroring `LeavesService`) and add the import to `apps/hr-core/src/modules/promotion-requests/promotion-requests.module.ts` provider list

### Backend — promotion routing rule

- [x] T048 [US2] Create `apps/hr-core/src/modules/notifications/events/routing-rules/promotion.rules.ts` exporting `onRequested`, `onApproved`, `onRejected`:
  - `onRequested`: query active HR Admins (`role.code IN ('HR_ADMIN', 'GLOBAL_HR_ADMIN') AND user.status='ACTIVE'`); produce one draft per admin; the router's no-self filter (T017) drops the actor if they are themselves an admin
  - `onApproved` / `onRejected`: (a) main draft addressed to `requestedById → User.id`, (b) call `NotificationsService.markResolved` for all open `(reference_type='promotion_request', reference_id=event.payload.promotionRequestId)` UNREAD notifications belonging to *other* HR Admins, (c) emit paired `PROMOTION / RESOLVED` notifications carrying `payload.decision` for each of those admins (FR-008)
- [x] T049 [US2] Add `(PROMOTION, REQUEST_SUBMITTED)`, `(PROMOTION, REQUEST_APPROVED)`, `(PROMOTION, REQUEST_REJECTED)`, `(PROMOTION, RESOLVED)` template entries to `notifications.renderers.ts`
- [x] T050 [US2] Register `promotion.requested`, `promotion.approved`, `promotion.rejected` in `notifications-events.bridge.ts` mapping to the three rule functions

### Backend — tests

- [ ] T051 [US2] Unit test `apps/hr-core/src/modules/notifications/events/routing-rules/promotion.rules.spec.ts`: mock Prisma; assert onRequested broadcasts to all admins / skips actor / produces zero drafts when no admins; onApproved and onRejected produce one main draft + N resolved drafts for other admins; rejection body contains reason
- [ ] T052 [US2] Integration test `apps/hr-core/test/integration/notifications-promotion.integration.spec.ts`: seed 2 HR Admins + 1 Manager + 1 Employee; call `PromotionRequestsService.create`; assert both admins have an UNREAD notification (manager actor excluded); approve as one admin; assert (a) manager has the approval row, (b) the other admin's original row is now READ, (c) a paired RESOLVED row exists for them

### Frontend — promotion deep link

- [x] T053 [US2] Extend `notification-row.tsx`'s reference-to-URL mapping with a `promotion_request` case → `/promotions?requestId=<id>` (route name confirmed against `apps/web/src/pages/promotions.tsx`; fall back to `/positions?requestId=<id>` if `promotions.tsx` does not exist yet)

**Checkpoint**: Both P1 user stories work. The platform's two most common HR approval loops have closed-loop notifications.

---

## Phase 5: User Story 3 — Inbox Management (Priority: P2)

**Goal**: Users can browse, filter, mark-as-read, mark-all-as-read, and dismiss their notifications (FR-014 to FR-019).

**Independent Test**: Seed an inbox with mixed read/unread leave and promotion notifications. Open the drawer — items in reverse chronological order, badge matches unread count, single mark-as-read decrements the badge, mark-all-as-read zeroes it, filter chips Leave/Promotion show only matching items, dismiss removes an item from the list permanently for the caller.

### Backend

- [x] T054 [US3] Implement `NotificationsService.markAllRead(userId, category?)` in `notifications.service.ts`: bulk `UPDATE … SET status='READ', read_at=now() WHERE recipient_user_id=$1 AND status='UNREAD' [AND category=$2]`; return `{ updatedCount }`
- [x] T055 [US3] Implement `NotificationsService.dismiss(id, userId)`: ownership check, `UPDATE … SET status='DISMISSED', dismissed_at=now()`; idempotent (return same `204` on subsequent calls)
- [x] T056 [US3] Implement `PATCH /api/notifications/mark-all-read` and `DELETE /api/notifications/:id` in `notifications.controller.ts` per [contracts/rest-api.md](./contracts/rest-api.md)
- [x] T057 [US3] Verify `GET /api/notifications` honours the `category`, `status`, `referenceType` filters and `cursor` pagination from `NotificationQueryDto` (extend the service `list()` if any branch is missing)

### Frontend

- [x] T058 [P] [US3] Add `markAllAsRead(category?)` and `dismissNotification(id)` to `apps/web/src/lib/api/hr-core.ts`
- [x] T059 [P] [US3] Create `apps/web/src/components/notifications/notifications-filter-chips.tsx`: row of shadcn `Toggle` chips for `All` and each `NotificationCategory`; selecting one updates a `category` state held by the drawer
- [x] T060 [US3] Extend `notifications-drawer.tsx` to host the filter chips, a "Mark all as read" button (calls `markAllAsRead(activeFilter)` and invalidates the TanStack Query cache), and a per-row `Dismiss` action (calls `dismissNotification` and removes from cache)
- [x] T061 [US3] Visual states in `notification-row.tsx`: unread rows render with a stronger contrast + a leading dot; dismissed rows are excluded from the list response by default (the service already filters)

### Tests

- [ ] T062 [US3] Unit test `apps/hr-core/src/modules/notifications/notifications.service.spec.ts`: mock Prisma; assert `markAllRead` respects category filter, returns count; `dismiss` rejects when notification belongs to another user; `list` cursor pagination round-trips; query DTO filters apply correctly

**Checkpoint**: All three user stories are independently testable and demoable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Real-time SSE upgrade (replaces 30 s polling), retention scheduler, rollback-safety integration test (FR-020), and project bookkeeping. None of these block the user stories above — they harden the module for production-style usage.

### Real-time (SSE)

- [x] T063 Create `apps/hr-core/src/modules/notifications/sse/notifications-sse.registry.ts` — `@Injectable()` holding an in-process `Map<userId, Set<Subject<MessageEvent>>>` with `subscribe(userId): Observable<MessageEvent>`, `unsubscribe(userId, subject)`, `push(userId, event)`. Subjects are cleaned up on `complete`/`error`
- [x] T064 Create `apps/hr-core/src/modules/notifications/sse/sse-auth.guard.ts` — extends `SharedJwtGuard`'s verifier logic but reads JWT from `Authorization` header OR `?accessToken=` query param (per [research.md §R2](./research.md))
- [ ] T065 Create `apps/hr-core/src/modules/notifications/sse/notifications-sse.controller.ts` with `@Sse('stream')` returning `Observable<MessageEvent>` from the registry; emit a `: keep-alive` comment every 30 s; close with `event: auth.expired` on JWT expiry
- [x] T066 In `notification-router.ts` (or a thin wrapper called by the bridge), after `NotificationsService.bulkCreate` completes, call `NotificationsSseRegistry.push(recipientUserId, { event: 'notification.created', data: <NotificationResponseDto> })` for each row
- [x] T067 Register `NotificationsSseController` in `notifications.module.ts` controllers array and `NotificationsSseRegistry` in providers
- [x] T068 [P] Create `apps/web/src/lib/notifications/sse-client.ts`: opens an `EventSource` with `?accessToken=<jwt>`; auto-reconnects with backoff; on repeated failure (≥3 consecutive errors) switches to polling fallback for 10 cycles, then retries SSE ([research.md §R10](./research.md))
- [x] T069 In `notifications-provider.tsx`, swap the 30 s polling primary path for the SSE client; on SSE message types `notification.created` and `notification.updated`, merge into the TanStack Query cache via `setQueryData`. Keep the polling fallback path active when SSE is unavailable

### Retention

- [x] T070 Create `apps/hr-core/src/modules/notifications/retention/retention.scheduler.ts`: `@Injectable()`; `@Cron('0 3 * * *')` daily method calls `NotificationsService.purgeOlderThan(new Date(Date.now() - 90 * 86400_000))`; logs purged row count
- [x] T071 Implement `NotificationsService.purgeOlderThan(date)`: `DELETE FROM notifications WHERE created_at < $1` via `prisma.notification.deleteMany`; return count
- [x] T072 Register `RetentionScheduler` in `notifications.module.ts` providers, import `ScheduleModule.forRoot()` in `app.module.ts` if not already imported
- [ ] T073 Unit test `apps/hr-core/src/modules/notifications/retention/retention.scheduler.spec.ts`: mocks `NotificationsService`; asserts the cron handler calls `purgeOlderThan` with a date ~90 days ago (±1 min tolerance)

### Rollback safety (FR-020)

- [ ] T074 Integration test `apps/hr-core/test/integration/notifications-rollback.integration.spec.ts`: monkey-patch `LeavesService.create` to throw after the transaction but **before** `eventBus.emit` (simulating a crash between commit and emit) — assert no notifications were created. Then monkey-patch to throw **inside** the transaction — assert no leave request was created AND no notification was created. Documents the post-commit contract and proves a forced rollback never leaves a dangling notification

### Performance & hardening

- [ ] T075 [P] Add Swagger response examples to `notifications.controller.ts` (one `NotificationResponseDto` per `(category, eventType)` listed in [data-model.md §4](./data-model.md)) — improves the auto-generated API docs at `/api/docs`
- [x] T076 [P] Add a `notifications` index size sanity check to the migration: after `prisma migrate dev`, run `psql -c "\di hr_core.*notif*"` and verify all four indexes exist; document expected sizes in a one-line note inside `apps/hr-core/prisma/migrations/<timestamp>_add_notifications/README.md`
- [x] T077 Verify the EventBus contract: walk `apps/hr-core/src/modules/leaves/requests/requests.service.ts` and `apps/hr-core/src/modules/promotion-requests/promotion-requests.service.ts` to confirm every `eventBus.emit` is outside its `prisma.$transaction` block. If any emit is inside, refactor (this should already be the case for leave; verify for promotion after T045–T046)

### Documentation & coordination

- [x] T078 Update `AGENTS.md` → `## Recent Changes` with a one-liner: `010-notifications: generic in-app notification module — Notification table + 3 enums in hr_core, event-bus subscriber wiring all domain events (leave + promotion live; skills/perf/probation/contract/complaint/engagement/exit-survey wired-but-inactive), bell + drawer in apps/web, SSE realtime + 30s polling fallback, 90-day retention`
- [x] T079 Update the top of `CLAUDE.md` § 6 (HR Core 24 entities) to mark Notification as implemented in this feature, and add the routing-rule registry pattern as a project-wide convention so future features know how to wire their notifications

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** — no deps; start immediately.
- **Phase 2 (Foundational)** — depends on Phase 1 (needs the new shared enums). Blocks Phases 3–5.
- **Phase 3 (US1)** — depends on Phase 2.
- **Phase 4 (US2)** — depends on Phase 2 and (only for the deep-link task T053) is best done after Phase 3 so a manager has a working bell to verify approvals. Otherwise independent.
- **Phase 5 (US3)** — depends on Phase 2 (and benefits from US1 already existing so there are real notifications to filter). Otherwise independent.
- **Phase 6 (Polish)** — every task here is independent of the others except T066/T069 (SSE push wiring + frontend SSE client must both land for SSE to work). Retention, rollback test, and docs can run in any order.

### User Story Dependencies

- **US1**: Standalone. After Phase 2, can be fully implemented and shipped as MVP.
- **US2**: Standalone. Reuses `NotificationsService`, router, bridge, renderers, and `NotificationsProvider` shipped in US1/Phase 2. Adds promotion-domain emissions, rules, and renderer entries.
- **US3**: Builds on US1's drawer UI and adds bulk + filter actions; standalone backend work.

### Within Each User Story

- Service methods → controller endpoints → frontend wiring.
- Routing-rule unit test should be written alongside its rule file (recommended but not strict TDD).
- Frontend `[P]` tasks are component files in distinct directories — safe in parallel.

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 in parallel (three independent enum files).
- **Phase 2**: T011–T016 in parallel (DTO and interface files all in separate paths).
- **Phase 3 (US1)**: T038, T039, T040, T041 in parallel after T037 — they touch different frontend files.
- **Phase 5 (US3)**: T058, T059 in parallel.
- **Phase 6**: T068, T075, T076 in parallel.

---

## Parallel Example: User Story 1

```bash
# After T037 (integration test scaffolded), launch the four frontend tasks in parallel:
Task: T038 — Add API client functions to apps/web/src/lib/api/hr-core.ts
Task: T039 — Create apps/web/src/lib/notifications/notifications-store.ts
Task: T040 — Create apps/web/src/components/notifications/notifications-provider.tsx
Task: T041 — Create apps/web/src/components/notifications/notification-row.tsx
```

```bash
# After T030 (controller list endpoint), launch unit + integration tests in parallel:
Task: T036 — Unit test for leave routing rules
Task: T037 — Integration test for the leave loop
```

---

## Implementation Strategy

### MVP First (US1 only — leave loop)

1. Phase 1 (Setup) — three enum files + shared build. ~30 min.
2. Phase 2 (Foundational) — schema, migration, DTOs, module skeleton, empty bridge. ~3–4 h.
3. Phase 3 (US1) — leave rule, list/unread/markRead endpoints, frontend bell + drawer. ~6–8 h.
4. **STOP and VALIDATE**: walk through Quickstart §4. The leave loop works end-to-end. Ship this.

### Incremental Delivery

1. Ship MVP after US1.
2. Add US2 (promotion loop). Now both P1 stories work. Ship.
3. Add US3 (inbox management polish: filter chips, mark-all-read, dismiss). Ship.
4. Add Phase 6 polish (SSE, retention, rollback test, doc updates). Ship.

### Parallel Team Strategy (Claude + Codex, sequential per `AGENTS.md`)

- Claude handles Phase 1 + Phase 2 + Phase 3 (US1) in one session.
- Codex handles Phase 4 (US2) — promotion emissions touch a module Codex already knows.
- Claude handles Phase 5 (US3) + Phase 6 (Polish).
- Each agent updates `AGENTS.md → Recent Changes` and commits with the `[claude]` / `[codex]` prefix per [project agent-coordination memory](../../.claude/CLAUDE.md).

---

## Notes

- `[P]` tasks = different files, no incomplete dependencies — safe to parallelise.
- `[US#]` labels trace every task to a user story in [spec.md](./spec.md).
- Each user story is independently testable per the Independent Test criteria in its phase header.
- Tests are intentionally lean: unit tests where they catch the most defects (routing rules are pure functions), one integration test per story, plus the FR-020 rollback-safety test in Phase 6. Full E2E is out of scope for this feature.
- Skills / Performance / Probation / Contract Amendment / Complaint / Engagement / Exit Survey domains have their **routing rule scaffolding intentionally deferred** to the feature that adds each producer. Files like `skills.rules.ts` are created only when their producing events start firing — adding them now would be untestable dead code. The bridge in T020 logs `unsubscribed event ignored` for these until their feature lands.
- Commit prefix: `[claude]` per project's [agent coordination protocol](../../.claude/CLAUDE.md#16-agent-coordination-protocol).
- Avoid: same-file conflicts (the rules files are domain-scoped to prevent this), cross-story dependencies that break independence, and any direct `NotificationsService` call from outside the bridge (every notification must originate from a `DomainEvent`).
