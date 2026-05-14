# Quickstart: Notification Module

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Audience**: A developer (Claude or human) sitting down on `010-notifications` for the first time.

The goal of this walkthrough is to bring the whole loop up locally — from event emission to bell-icon update — in under 15 minutes.

---

## 0. Prerequisites

- `pnpm` installed, repo bootstrapped (`pnpm install` already run).
- Docker Desktop running with the Sentient `pgvector/pgvector:pg16` container (`docker compose up -d`).
- `.env` files in `apps/hr-core/`, `apps/web/`, etc. populated per `.env.example`.
- HR Core IAM module is already in place — there are real users to sign in as (Codex/Claude have already seeded HR_ADMIN, MANAGER, EMPLOYEE roles).

---

## 1. Add the new shared enums

```bash
pnpm --filter @sentient/shared build
```

Three new enums are exported: `NotificationCategory`, `NotificationEventType`, `NotificationStatus`. The build step regenerates the package's `dist/` so HR Core can `import { NotificationCategory } from '@sentient/shared'`.

---

## 2. Run the Prisma migration

```bash
cd apps/hr-core
npx prisma migrate dev --name add_notifications
```

This:

1. Creates the three Postgres enums in schema `hr_core`.
2. Creates table `hr_core.notifications` with four indexes.
3. Appends the `ck_notif_no_self` CHECK constraint (manual SQL inside the generated migration — already authored in [data-model.md §2](./data-model.md)).
4. Adds the `Notification[]` back-relation on `User`.

Verify:

```bash
psql "$HR_CORE_DATABASE_URL" -c "\d hr_core.notifications"
```

You should see the four indexes and the CHECK constraint.

---

## 3. Start the backend and the frontend

From the repo root:

```bash
turbo dev --filter=hr-core --filter=web
```

HR Core listens on `:3001` and serves `/api/notifications/*`. Web on `:3000` proxies `/api` → `:3001`.

---

## 4. Smoke-test the leave loop (P1, US1)

In two browser windows (one per role):

### Window A — sign in as an Employee

1. `POST /api/auth/login` with an EMPLOYEE account → land on `/dashboard`.
2. Navigate to `/leaves` and submit a new leave request (Annual, Jul 1–Jul 5).

### Window B — sign in as their Manager

1. The bell icon top-right shows a `1` badge within ~2 seconds (SSE push). If SSE is blocked, the polling fallback fills it within 60 seconds.
2. Open the drawer — the new row reads: *"New leave request from <employee name> — Annual Leave, Jul 1 – Jul 5."*
3. Click the row → routes to `/leave-management?requestId=<id>`.
4. Approve the request.

### Window A — verify the closing notification

1. The Employee's bell badge increments by one.
2. The row reads: *"Your leave request was approved by <manager name> — Annual Leave, Jul 1 – Jul 5."*

### Reject path

Repeat with a rejection — the Employee row body includes the rejection reason verbatim (FR-003).

---

## 5. Smoke-test the promotion loop (P1, US2)

### Window B (Manager)

1. Open `/positions` (or `/promotions` if that route was added by `feat(performance-review)`).
2. Submit a promotion request for one of the manager's direct reports.

### Window C — sign in as an HR Admin

1. Bell shows `1`. Drawer reads: *"Promotion request from <manager name> for <employee name>: Engineer L2 → Engineer L3 (+12% salary)."*
2. Open it, approve.

### Window B verifies

The manager's bell shows the approval notification.

### Window C (other HR admin)

If a second HR admin was online at the time of submission, their original "promotion request" notification is now resolved (greyed out / shows "Approved by <other admin>") and a paired `RESOLVED` row sits below it (FR-008).

---

## 6. Run the tests

```bash
# Unit + controller tests
turbo test --filter=hr-core

# Integration tests (real Prisma, hr_core test schema)
turbo test:integration --filter=hr-core

# Routing-rule tests are run as part of the unit suite — look for
# notifications/events/routing-rules/*.spec.ts
```

Expected coverage thresholds (informational, not blocking the FYP):

- `NotificationsService`: ≥ 80 % lines.
- `NotificationRouter` and every rule file: ~100 % branch coverage (rules are small pure functions).
- `NotificationsEventsBridge`: ≥ 80 % lines, with an explicit rollback-safety integration test that confirms zero notifications survive a forced transaction rollback (FR-020).

---

## 7. Tour of the source

| Path | Purpose |
|---|---|
| `apps/hr-core/src/modules/notifications/notifications.module.ts` | Wiring. Imports `PrismaModule` and the `EVENT_BUS` provider, registers the bridge at module init. |
| `apps/hr-core/src/modules/notifications/notifications.controller.ts` | 5 REST endpoints + Swagger decorators. |
| `apps/hr-core/src/modules/notifications/sse/notifications-sse.controller.ts` | `@Sse('stream')` endpoint, JWT validated by `SseAuthGuard`. |
| `apps/hr-core/src/modules/notifications/notifications.service.ts` | List / mark / bulk-create / dismiss + retention helper. |
| `apps/hr-core/src/modules/notifications/notification-router.ts` | Reads the bridge's rule map, applies the no-self filter, calls bulk-create + SSE push. |
| `apps/hr-core/src/modules/notifications/events/notifications-events.bridge.ts` | Subscribes to all event types on `IEventBus` at module init and dispatches to routing rules. |
| `apps/hr-core/src/modules/notifications/events/routing-rules/<domain>.rules.ts` | One file per domain. Pure functions over `(event, deps)`. |
| `apps/hr-core/src/modules/notifications/retention/retention.scheduler.ts` | `@Cron('0 3 * * *')` daily purge of >90-day rows. |
| `apps/web/src/components/notifications/notifications-bell.tsx` | Top-bar bell icon + unread count. |
| `apps/web/src/components/notifications/notifications-drawer.tsx` | Slide-out list with category filter chips. |
| `apps/web/src/components/notifications/notifications-provider.tsx` | Context: SSE EventSource + TanStack Query cache + polling fallback. |
| `apps/web/src/lib/api/hr-core.ts` | New functions: `listNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `dismissNotification`. |

---

## 8. Adding a notification for a new feature

When a future feature (e.g. probation) needs notifications, the developer:

1. Emits a `DomainEvent` from the new service after its transaction commits (mirroring `LeavesService.create`).
2. Adds (or extends) a rule file in `events/routing-rules/<domain>.rules.ts` exporting a `RoutingRule`.
3. Registers the event type → rule mapping in `notifications-events.bridge.ts`.
4. Adds an `(category, eventType) → {title, body}` renderer entry in `notifications.renderers.ts`.
5. Adds a Jest unit test for the rule.
6. Updates `contracts/event-subscriptions.md` to flip the row from 🔜 to 🟡.

No schema migration, no controller change, no DTO change. This was the central design goal of the plan.

---

## 9. Troubleshooting

- **Bell never updates** — Check the browser DevTools Network tab for `/api/notifications/stream`. If it's `401`, the SSE access-token query parameter is missing or expired (see [research.md §R2](./research.md)). Look for the SSE-auth log line in HR Core.
- **Notification appears, then disappears on refresh** — likely a rollback / non-post-commit emission. Verify the producing service calls `eventBus.emit` **after** `await this.prisma.$transaction(...)` returns, not inside it (FR-020).
- **Two notifications for the same event** — most often the bridge subscribed twice (e.g. duplicate `subscribe()` calls during hot-reload). The bridge's `onApplicationBootstrap` is the only legal subscription site; double-check it isn't also called from a test setup.
- **Manager sees the request but employee never gets the approval notification** — the routing rule's recipient lookup uses `Employee.id → User.id`. If the employee has no `userId` link, the rule logs `skipped: no user for employee <id>`. Seed data must link every employee to a user record.
