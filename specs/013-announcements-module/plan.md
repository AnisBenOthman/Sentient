# Implementation Plan: Announcements Module

**Branch**: `013-announcements-module` | **Date**: 2026-05-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-announcements-module/spec.md`

---

## Summary

Add a fully-functional Announcements module to the Social service (port 3002). The 012-social-scaffold already created the `Announcement` Prisma model and wired all global guards (SharedJwtGuard, RbacGuard, ThrottlerGuard). This feature extends the schema with three nullable columns (`targetDepartmentId`, `targetTeamId`, `expiresAt`), implements CRUD endpoints with JWT-based audience filtering, a pin toggle for HR_ADMIN, and emits the `announcement.published` domain event. The frontend delivers an `announcements.tsx` page wired to the new Social API.

---

## Technical Context

**Language/Version**: TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames` via repo-wide `tsconfig.base.json`)
**Primary Dependencies**: NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, `@sentient/shared` (SharedJwtGuard, RbacGuard, Roles, CurrentUser, Public, IEventBus, EVENT_BUS, DomainEvent, Audience enum, JwtPayload)
**Storage**: PostgreSQL 16, schema `social` — one existing table `announcements` (3 new columns + 2 indexes added by migration)
**Testing**: Jest unit (co-located `.spec.ts`), contract tests with nock, integration tests with real Prisma (test schema)
**Target Platform**: Linux server / Docker Compose (local dev)
**Project Type**: NestJS microservice (Social, port 3002) + React 18 Vite SPA frontend (port 3000)
**Performance Goals**: GET /announcements p95 < 200ms (with HrCoreClient TTL cache warm); GET with cold cache ≤ N×HR-Core latency where N = unique author count per page
**Constraints**: Audience filtering is server-enforced — no client-side trust. `ROLE`/`INDIVIDUAL` audience values rejected with 400. Cross-schema: no direct SQL access to hr_core; REST only via HrCoreClient.
**Scale/Scope**: Single organization, up to 500 employees; announcement volume ~10-50/month; no pagination beyond page/limit needed at this scale.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is a template (not yet project-specific). No gates defined. Proceeding under standard CLAUDE.md engineering rules:

- ✅ Every endpoint has `@UseGuards` (via AppModule global guards) + `@Roles(...)`
- ✅ No `any` types
- ✅ DTOs validated with class-validator
- ✅ Cross-service = REST only via HrCoreClient
- ✅ Domain events emitted after successful write
- ✅ Additive-only Prisma migration (no DROP operations)

---

## Project Structure

### Documentation (this feature)

```text
specs/013-announcements-module/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── rest-endpoints.md    # 6 endpoint contracts
│   └── domain-events.md     # announcement.published event
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
apps/social/
├── prisma/
│   ├── schema.prisma          # Add 3 columns + 2 indexes to Announcement model
│   └── migrations/
│       └── 20260521_announcements_audience_targets_and_expiry/
│           └── migration.sql
└── src/
    ├── modules/
    │   └── announcements/           # NEW — first module in social/src/modules/
    │       ├── announcements.module.ts
    │       ├── announcements.controller.ts
    │       ├── announcements.service.ts
    │       ├── announcements.service.spec.ts   # unit tests
    │       └── dto/
    │           ├── create-announcement.dto.ts
    │           ├── update-announcement.dto.ts
    │           ├── pin-announcement.dto.ts
    │           └── announcement-query.dto.ts
    ├── common/
    │   └── clients/
    │       ├── hr-core.client.ts          # Add getDepartmentRef + getTeamRef methods
    │       ├── department-ref.interface.ts # NEW
    │       └── team-ref.interface.ts       # NEW
    └── app.module.ts              # Import AnnouncementsModule

apps/web/
└── src/
    ├── pages/
    │   └── announcements.tsx          # NEW — full list + detail + publish form
    ├── lib/
    │   └── api/
    │       └── social.ts              # Replace stub with typed API functions
    └── App.tsx                        # Register /announcements route
```

**Structure Decision**: Web application (Option 2 from template). Backend = Social microservice. Frontend = React + Vite SPA. All new backend code in `apps/social/src/modules/announcements/`; new frontend page in `apps/web/src/pages/`.

---

## Implementation Tasks (Phase 2 input)

### Backend

**T-01** — Prisma migration: add `targetDepartmentId String?`, `targetTeamId String?`, `expiresAt DateTime?` + two new indexes to `Announcement` model. Run `npx prisma migrate dev --name announcements_audience_targets_and_expiry` from `apps/social/`.

**T-02** — Add `DepartmentRef` and `TeamRef` interfaces (`apps/social/src/common/clients/`).

**T-03** — Extend `HrCoreClient` with `getDepartmentRef(id, context)` and `getTeamRef(id, context)` methods using the same TTL-cache pattern as `getEmployeeRef`. Both call `GET /departments/:id` and `GET /teams/:id` on HR Core.

**T-04** — Implement `CreateAnnouncementDto`, `UpdateAnnouncementDto`, `PinAnnouncementDto`, `AnnouncementQueryDto` (all with class-validator decorators).

**T-05** — Implement `AnnouncementsService`:
  - `create(user, dto, correlationId)` — builds row, validates audience targets, emits `announcement.published`
  - `findAll(user, query)` — audience-filtered query, sorts pinned first
  - `findOne(user, id)` — fetches single announcement (applies audience filter for non-HR_ADMIN)
  - `update(user, id, dto)` — author or HR_ADMIN guard, no audience change
  - `remove(user, id)` — author or HR_ADMIN guard, hard delete
  - `pin(user, id, dto)` — HR_ADMIN only, validates pinnedUntil is future or null
  - `enrichWithAuthor(ann)` — calls `HrCoreClient.getEmployeeRef`

**T-06** — Implement `AnnouncementsController` (all 6 endpoints, Swagger decorators, `@Roles`, `@CurrentUser`).

**T-07** — Wire `AnnouncementsModule` into `AppModule`.

**T-08** — Unit tests for `AnnouncementsService` (mock Prisma + HrCoreClient): audience filter logic, pin validation, ROLE/INDIVIDUAL rejection, NotAnnouncementAuthor guard, event emission.

### Frontend

**T-09** — Replace stub `apps/web/src/lib/api/social.ts` with typed Axios functions:
  - `getAnnouncements(params)` → `AnnouncementListResponse`
  - `getAnnouncement(id)` → `AnnouncementResponse`
  - `createAnnouncement(dto)` → `AnnouncementResponse`
  - `updateAnnouncement(id, dto)` → `AnnouncementResponse`
  - `deleteAnnouncement(id)` → `void`
  - `pinAnnouncement(id, dto)` → `AnnouncementResponse`

**T-10** — Implement `apps/web/src/pages/announcements.tsx`:
  - List view: pinned items at top (star/pin badge), `publishedAt` date, truncated body
  - Detail drawer/modal on item click: full body, author name, audience badge
  - Role-gated "New Announcement" button: visible to `getRoleTier(user) === 'hr_admin'` or `'dept_manager'`
  - Publish form: title, body, audience selector, optional expiresAt, optional targetDepartmentId/targetTeamId (HR_ADMIN only)
  - Pin controls: only rendered when `getRoleTier(user) === 'hr_admin'`
  - Edit/Delete actions on items authored by the current user or if HR_ADMIN
  - TanStack Query: `useQuery(['announcements', page])`, `useMutation` for create/update/delete/pin with cache invalidation

**T-11** — Register `/announcements` route in `apps/web/src/App.tsx`.

**T-12** — Add "Announcements" nav item to `ALL_MAIN_NAV` in `apps/web/src/components/layout.tsx` (visible to all tiers).

---

## Complexity Tracking

No violations. This feature is additive (one new NestJS module, one Prisma migration with only ADD operations, one new frontend page) and follows established 012-social-scaffold patterns exactly.
