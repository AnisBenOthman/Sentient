# Tasks: 013-Announcements Module

**Input**: Design documents from `/specs/013-announcements-module/`
**Branch**: `013-announcements-module`
**Date**: 2026-05-21
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Prerequisites confirmed**:
- `plan.md` ✅ — 12 implementation tasks T-01 through T-12
- `spec.md` ✅ — 5 user stories (US1–US2: P1, US3–US5: P2), 32 FRs
- `research.md` ✅ — 8 decisions resolved
- `data-model.md` ✅ — Prisma diff, response shapes, DTO shapes
- `contracts/rest-endpoints.md` ✅ — 6 endpoint contracts
- `contracts/domain-events.md` ✅ — `announcement.published` event schema

**Tests**: Included — SC-002, SC-005, SC-006, SC-007, SC-008 explicitly require Jest tests; plan T-08 mandates unit tests.

**Organization**: Grouped by user story. Each story is independently testable.

**Spec note**: `spec.md FR-007` and `US2 scenario 6` both confirm that `audience`, `targetDepartmentId`, and `targetTeamId` ARE updatable via PATCH (with consistency enforcement). This overrides the conflicting note in `contracts/rest-endpoints.md` — spec is the requirements source.

## Format: `[ID] [P?] [US#?] Description with file path`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[US#]**: Which user story (US1–US5, maps to spec.md)
- Exact file paths in every description

---

## Phase 1: Setup

**Purpose**: Create the new module directory skeleton in the Social service.

- [x] T001 Create `apps/social/src/modules/announcements/` directory with empty barrel stubs: `announcements.module.ts`, `announcements.service.ts`, `announcements.controller.ts`, and empty `dto/` folder — all files must export an empty class so the TypeScript project compiles without error

**Checkpoint**: `turbo build --filter=social` passes with the new empty files in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration, inter-service interfaces, and module wiring that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `targetDepartmentId String?`, `targetTeamId String?`, `expiresAt DateTime?` and `@@index([targetDepartmentId])`, `@@index([targetTeamId])` to `Announcement` model in `apps/social/prisma/schema.prisma`; run `npx prisma migrate dev --name announcements_audience_targets_and_expiry` from `apps/social/` to generate `apps/social/prisma/migrations/20260521_announcements_audience_targets_and_expiry/migration.sql`
- [x] T003 [P] Create `apps/social/src/common/clients/department-ref.interface.ts` (exports `DepartmentRef { id: string; name: string }`) and `apps/social/src/common/clients/team-ref.interface.ts` (exports `TeamRef { id: string; name: string; departmentId: string }`)
- [x] T004 [P] Extend `apps/social/src/common/clients/hr-core.client.ts` with `getDepartmentRef(id: string, context: AgentContext): Promise<DepartmentRef | null>` and `getTeamRef(id: string, context: AgentContext): Promise<TeamRef | null>` — same in-process Map TTL-cache pattern as `getEmployeeRef`; map 404 to `null`, 5xx to re-throw `ServiceUnavailableException`
- [x] T005 [P] Complete `apps/social/src/modules/announcements/announcements.module.ts` (imports `PrismaModule`, `ClientsModule`, `EventBusModule`; provides `AnnouncementsService`; exports `AnnouncementsService`); add `AnnouncementsModule` to `imports[]` in `apps/social/src/app.module.ts`

**Checkpoint**: `turbo build --filter=social` passes. `\d social.announcements` shows three new nullable columns. `AppModule` imports `AnnouncementsModule`.

---

## Phase 3: User Story 1 — Publish + List (Priority: P1) 🎯 MVP

**Goal**: MANAGER and HR_ADMIN can publish announcements scoped to COMPANY, DEPARTMENT, or TEAM audiences. Any authenticated user can list and retrieve announcements filtered by their JWT claims. `announcement.published` is emitted on every successful publish.

**Independent Test**: `POST /announcements` with `audience: 'DEPARTMENT'` as MANAGER → 201 with `targetDepartmentId` auto-filled from JWT `departmentId`. `GET /announcements` as same-department EMPLOYEE → announcement appears. `GET /announcements` as different-department EMPLOYEE → announcement absent. A Jest spy on the in-process EventBus receives `announcement.published` with `source: 'SOCIAL'`, correct payload fields, and `metadata.correlationId` propagated from the request header.

### Tests for User Story 1

> **Write FIRST — ensure they FAIL before implementation begins**

- [x] T006 [P] [US1] Write failing unit tests for audience-filter WHERE clause construction: COMPANY → no department/team filter; DEPARTMENT → `targetDepartmentId = jwt.departmentId`; TEAM → `targetTeamId = jwt.teamId`; HR_ADMIN `scope=all` bypasses audience filter — in `apps/social/src/modules/announcements/announcements.service.spec.ts`
- [x] T007 [P] [US1] Write failing unit tests for: ROLE/INDIVIDUAL audience → 400 `UnsupportedAudienceInThisRelease`; `announcement.published` event shape (`source: 'SOCIAL'`, `type: 'announcement.published'`, all payload fields, `metadata.correlationId`); author enrichment de-duplication (20 items with 5 unique authors → exactly 5 HR Core calls) — in `apps/social/src/modules/announcements/announcements.service.spec.ts`
- [x] T008 [P] [US1] Write failing contract tests verifying `HrCoreClient.getEmployeeRef`, `getDepartmentRef`, `getTeamRef` response shapes using nock — in `apps/social/test/contracts/hr-core-client.contract.spec.ts`

### Implementation for User Story 1

- [x] T009 [P] [US1] Implement `CreateAnnouncementDto` with `@IsString() @MinLength(1) @MaxLength(200)` on `title`; `@IsString() @MinLength(1) @MaxLength(10000)` on `body`; `@IsEnum(Audience)` on `audience`; `@IsOptional() @IsUUID()` on `targetDepartmentId` and `targetTeamId`; `@IsOptional() @IsISO8601()` on `expiresAt`; `@IsOptional() @IsISO8601()` on `publishedAt` — in `apps/social/src/modules/announcements/dto/create-announcement.dto.ts`
- [x] T010 [P] [US1] Implement initial `ListAnnouncementsQueryDto` with `@IsOptional() @Type(() => Number) @IsInt() @Min(1)` on `page` (default 1) and `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)` on `pageSize` (default 20) — in `apps/social/src/modules/announcements/dto/list-announcements-query.dto.ts`
- [x] T011 [US1] Implement `AnnouncementsService` with: `create(user, dto, correlationId)` — audience auto-fill from JWT for MANAGER; InconsistentAudienceTarget validation; ROLE/INDIVIDUAL rejection; `getDepartmentRef`/`getTeamRef` validation (→ UnknownTargetDepartment / UnknownTargetTeam on 404; ServiceUnavailableException on 5xx); Prisma insert with `publishedAt: new Date()`; emit `announcement.published` after commit (best-effort, 201 even if EventBus throws); `findAll(user, query)` — audience-filtered WHERE + expiry stub (`expiresAt IS NULL OR expiresAt > now()`) + sort (`pinnedUntil > now()` first, then `publishedAt DESC`) + pagination; `findOne(user, id)` — audience guard for non-HR_ADMIN → throw 404 (not 403); `enrichWithAuthor(items)` — de-duplicate `authorId` values, batch `getEmployeeRef` calls, set `author: null` on 404 — in `apps/social/src/modules/announcements/announcements.service.ts`
- [x] T012 [US1] Implement `AnnouncementsController` with `POST /announcements` (`@Roles('MANAGER', 'HR_ADMIN')`), `GET /announcements` (`@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`), `GET /announcements/:id` (`@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`); add `@ApiTags('Announcements')` on the class; `@ApiOperation`, `@ApiResponse(201/400/403)`, `@ApiResponse(200/404)` on each method; inject `correlationId` from `request['correlationId']` for the create call — in `apps/social/src/modules/announcements/announcements.controller.ts`

**Checkpoint**: US1 independently testable. `POST /announcements` returns 201 with resolved author. `GET /announcements` applies audience filter. EventBus spy asserts `announcement.published` payload. All T006–T008 tests pass.

---

## Phase 4: User Story 2 — Edit + Delete (Priority: P1)

**Goal**: Authors can update their own announcements (including audience and targeting) and delete them. HR_ADMIN can manage any announcement. Non-authors receive 403 `NotAnnouncementAuthor`.

**Independent Test**: Author A creates announcement. Author A `PATCH /announcements/:id` with `{ title: 'updated' }` → 200. Author B (different MANAGER) `PATCH /announcements/:id` → 403 `NotAnnouncementAuthor`. HR_ADMIN `PATCH /announcements/:id` → 200 regardless of authorship. Author A `DELETE /announcements/:id` → 204. Subsequent `GET /announcements/:id` → 404.

### Tests for User Story 2

> **Write FIRST — ensure they FAIL before implementation begins**

- [x] T013 [P] [US2] Write failing unit tests for: non-author MANAGER → 403 `NotAnnouncementAuthor` on both PATCH and DELETE; HR_ADMIN override succeeds on both; PATCHing `audience: 'COMPANY'` clears `targetTeamId` to null (audience-target consistency, spec US2 scenario 6); PATCHing `audience: 'DEPARTMENT'` with no `targetDepartmentId` when caller is HR_ADMIN → 400 `TargetDepartmentRequired` — in `apps/social/src/modules/announcements/announcements.service.spec.ts`

### Implementation for User Story 2

- [x] T014 [P] [US2] Implement `UpdateAnnouncementDto` with `@IsOptional()` on all fields: `title` (`@IsString @MinLength(1) @MaxLength(200)`), `body` (`@IsString @MinLength(1)`), `audience` (`@IsEnum(Audience)`), `targetDepartmentId` (`@IsUUID`), `targetTeamId` (`@IsUUID`), `expiresAt` (`@IsISO8601`); use `@IsNotIn(['id','authorId','publishedAt','pinnedUntil','createdAt','updatedAt'])` via `forbidNonWhitelisted` ValidationPipe already global — in `apps/social/src/modules/announcements/dto/update-announcement.dto.ts`
- [x] T015 [US2] Add `update(user, id, dto)` (fetch announcement, ownership check via `jwt.employeeId === ann.authorId || isHrAdmin`, run audience-target consistency logic matching create path, Prisma `update`) and `remove(user, id)` (ownership check, Prisma `delete`, return void) to `apps/social/src/modules/announcements/announcements.service.ts`
- [x] T016 [US2] Add `PATCH /announcements/:id` (`@Roles('MANAGER', 'HR_ADMIN')`) and `DELETE /announcements/:id` (`@Roles('MANAGER', 'HR_ADMIN')`, `@HttpCode(204)`) with `@ApiOperation`, `@ApiResponse(200/400/403/404)` and `@ApiResponse(204/403/404)` respectively to `apps/social/src/modules/announcements/announcements.controller.ts`

**Checkpoint**: US1 + US2 independently testable. All 5 CRUD curl tests from quickstart.md §4 pass. T013 tests pass.

---

## Phase 5: User Story 3 — HR Admins Pin Important Announcements (Priority: P2)

**Goal**: HR_ADMIN can pin an announcement until a specified future date (sorts it first in all list responses) or clear the pin (`pinnedUntil: null`). Non-HR_ADMIN users receive 403. Past `pinnedUntil` values are rejected with 400 `PinExpiryInPast`.

**Independent Test**: HR_ADMIN `PATCH /announcements/:id/pin` with future `pinnedUntil` → 200, `isPinned: true` in response; announcement appears first in `GET /announcements`. HR_ADMIN clears pin with `pinnedUntil: null` → 200, `isPinned: false`; announcement returns to chronological order. MANAGER calls pin endpoint → 403. Past `pinnedUntil` → 400 `PinExpiryInPast`.

### Tests for User Story 3

> **Write FIRST — ensure they FAIL before implementation begins**

- [x] T017 [P] [US3] Write failing unit tests for: past `pinnedUntil` → 400 `PinExpiryInPast`; non-HR_ADMIN calling `pin()` → 403 (service-level guard after `@Roles('HR_ADMIN')` guard handles the controller level); `pinnedUntil: null` → clears field to null; announcement with active `pinnedUntil` → `isPinned: true` in response — in `apps/social/src/modules/announcements/announcements.service.spec.ts`

### Implementation for User Story 3

- [x] T018 [US3] Implement `PinAnnouncementDto` with `pinnedUntil` typed as `string | null`; when non-null: `@IsISO8601()`; when null: accept explicitly (use `@Allow()` or custom validator) — in `apps/social/src/modules/announcements/dto/pin-announcement.dto.ts`
- [x] T019 [US3] Add `pin(user, id, dto)` to `AnnouncementsService`: fetch announcement (404 if missing), future-date validation when `dto.pinnedUntil` is non-null (throw 400 `PinExpiryInPast` if `new Date(dto.pinnedUntil) <= new Date()`), Prisma `update({ pinnedUntil })`, return enriched response — in `apps/social/src/modules/announcements/announcements.service.ts`
- [x] T020 [US3] Add `PATCH /announcements/:id/pin` with `@Roles('HR_ADMIN')` and `@ApiOperation`, `@ApiResponse(200/400/403/404)` to `apps/social/src/modules/announcements/announcements.controller.ts`

**Checkpoint**: US1–US3 testable. Quickstart.md §4.4 pin curl test passes. T017 tests pass.

---

## Phase 6: User Story 4 — Expired Announcements Drop Out of the Default List (Priority: P2)

**Goal**: Announcements with `expiresAt < now()` are filtered from default `GET /announcements` for EMPLOYEE/MANAGER. HR_ADMIN can pass `?includeExpired=true` to retrieve them. Creating an announcement with a past `expiresAt` is rejected with 400 `ExpiryInPast`.

**Independent Test**: Publish announcement with `expiresAt = past_timestamp` (set directly in DB or via backdated PATCH). `GET /announcements` as EMPLOYEE → not returned. `GET /announcements?includeExpired=true` as HR_ADMIN → returned. `POST /announcements` with `expiresAt` in the past → 400 `ExpiryInPast`.

### Tests for User Story 4

> **Write FIRST — ensure they FAIL before implementation begins**

- [x] T021 [P] [US4] Write failing integration test: seed three announcements (never-expires, future-expiry, past-expiry); assert EMPLOYEE `GET /announcements` returns 2, excludes the expired one; assert HR_ADMIN `GET /announcements?includeExpired=true` returns all 3 (SC-008) — in `apps/social/test/integration/announcements.integration.spec.ts`

### Implementation for User Story 4

- [x] T022 [P] [US4] Extend `ListAnnouncementsQueryDto` with: `includeExpired?: boolean` (`@IsOptional() @Transform(({ value }) => value === 'true')`) and `scope?: 'all'` (`@IsOptional() @IsIn(['all'])`) — in `apps/social/src/modules/announcements/dto/list-announcements-query.dto.ts`
- [x] T023 [US4] In `AnnouncementsService`: add `ExpiryInPast` guard to `create()` (throw 400 when `dto.expiresAt` is non-null and `new Date(dto.expiresAt) <= new Date()`); extend `findAll()` expiry WHERE — default excludes `expiresAt < now()`, bypass when `user.roles.includes('HR_ADMIN') && query.includeExpired`; add `scope=all` bypass to audience filter (HR_ADMIN only — service throws 403 if non-HR_ADMIN passes `scope=all`) — in `apps/social/src/modules/announcements/announcements.service.ts`

**Checkpoint**: US1–US4 testable. SC-008 integration test passes. All 6 backend endpoints match quickstart.md §4–§5.

---

## Phase 7: User Story 5 — Frontend Announcements Page (Priority: P2)

**Goal**: The `/announcements` route shows a live-data list with pin badges, role-gated publish form, and HR_ADMIN pin/delete controls. All backend error codes map to user-facing messages.

**Independent Test**: Navigate to `/announcements` as EMPLOYEE → page renders with empty-state (SC-009). As MANAGER → "New announcement" button visible; submit form → new card appears within 1 second (TanStack Query cache invalidation). As HR_ADMIN → pin and delete controls visible; clicking pin opens date picker and calls `PATCH /:id/pin`. Pinned card appears first with "Pinned" badge.

*No Jest unit tests required — correctness verified by running the page as each role.*

### Implementation for User Story 5

- [x] T024 [P] [US5] Replace the stub in `apps/web/src/lib/api/social.ts` with 6 typed Axios functions — `listAnnouncements(params: ListAnnouncementsParams): Promise<AnnouncementListResponse>`, `getAnnouncement(id: string): Promise<AnnouncementResponse>`, `createAnnouncement(dto: CreateAnnouncementDto): Promise<AnnouncementResponse>`, `updateAnnouncement(id: string, dto: UpdateAnnouncementDto): Promise<AnnouncementResponse>`, `deleteAnnouncement(id: string): Promise<void>`, `pinAnnouncement(id: string, dto: PinAnnouncementDto): Promise<AnnouncementResponse>`; add `AnnouncementResponse`, `AnnouncementListResponse`, `AnnouncementAuthor` TypeScript interfaces exactly mirroring backend DTOs (no `any`); add `extractApiError` mapping for all FR-027 codes: `MissingTeamForTeamAudience`, `InconsistentAudienceTarget`, `UnknownTargetDepartment`, `UnknownTargetTeam`, `ExpiryInPast`, `PinExpiryInPast`, `NotAnnouncementAuthor`, `UnsupportedAudienceInThisRelease`
- [x] T025 [US5] Implement `apps/web/src/pages/announcements.tsx`: `useQuery(['announcements', { page, pageSize }], listAnnouncements)` list; pinned card treatment (card border + "Pinned" badge) when `new Date(ann.pinnedUntil) > new Date()`; "New announcement" button gated on `user.roles.includes('MANAGER') || user.roles.includes('HR_ADMIN')`; publish `Dialog` with title input, body `Textarea`, audience `RadioGroup` (COMPANY / DEPARTMENT / TEAM), optional `expiresAt` date picker, optional `targetDepartmentId`/`targetTeamId` inputs shown only when `user.roles.includes('HR_ADMIN')`; `useMutation(createAnnouncement)` with `onSuccess: () => queryClient.invalidateQueries(['announcements'])`; detail `Sheet` on card click (full body, author `firstName + lastName`, audience badge, publish date); pin control (`useMutation(pinAnnouncement)`) rendered only when `user.roles.includes('HR_ADMIN')`; delete control (`useMutation(deleteAnnouncement)`) and edit control rendered when `user.employeeId === ann.author?.id || user.roles.includes('HR_ADMIN')`; `onError` mapping for all FR-027 codes with generic fallback "Failed to complete the action. Please try again."
- [x] T026 [US5] Register `<Route path="/announcements" component={AnnouncementsPage} />` inside the authenticated `<Layout>` wrapper in `apps/web/src/App.tsx`
- [x] T027 [US5] Add `{ label: 'Announcements', href: '/announcements', icon: Megaphone }` to `ALL_MAIN_NAV` array in `apps/web/src/components/layout.tsx` (no `minTier` gate — visible to all authenticated users)

**Checkpoint**: SC-001, SC-003, SC-009 pass manual browser test. Role-gate scenarios verified at `/announcements` for all three tiers (EMPLOYEE, MANAGER, HR_ADMIN).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, coherence audit, and smoke-test sign-off.

- [x] T028 [P] Audit Swagger doc — start Social service (`turbo dev --filter=social`), open `http://localhost:3002/api/docs`, confirm `Announcements` tag contains exactly 6 endpoints (POST, GET list, GET/:id, PATCH/:id, DELETE/:id, PATCH/:id/pin) each with correct `@ApiResponse` codes (400/403/404/503 where applicable); fix any missing `@ApiResponse` decorators in `apps/social/src/modules/announcements/announcements.controller.ts`
- [x] T029 [P] Audit `apps/web/src/lib/api/social.ts` error-code mapping: confirm every FR-027 code has a test case via `grep` through `apps/social/src/modules/announcements/announcements.service.spec.ts` — at minimum one assertion per code that the exact string appears in the thrown exception message (SC-006)
- [ ] T030 Run quickstart.md curl smoke-tests §4.1–§4.6 end-to-end; verify SC-001 (publish appears in second browser within 1 s via TanStack Query), SC-004 (cold `GET /announcements` with 20 items ≤ 20 HR Core calls, warm cache = 0 calls), SC-010 (re-running `npx prisma migrate dev` from `apps/social/` reports "no pending migrations")

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) — immediate start
    ↓
Phase 2 (Foundational) — blocks ALL stories
    T002 (migration) → T003, T004, T005 [parallel]
    ↓
Phase 3 (US1) — core service/controller scaffolding
    ↓
Phase 4 (US2) — extends service + controller from US1
    ↓ (US2 and US4 can run in parallel after US1)
Phase 5 (US3) — adds pin to same service/controller
Phase 6 (US4) — adds expiry to same service + new query DTO
    ↓
Phase 7 (US5) — depends on all backend phases (or at minimum US1 for read-only)
    ↓
Phase 8 (Polish)
```

### User Story Dependencies

| Story | Depends on | Can parallel with |
|-------|-----------|-------------------|
| US1 (P1) | Phase 2 complete | — |
| US2 (P1) | US1 | — |
| US3 (P2) | US2 | US4 |
| US4 (P2) | US1 | US3 |
| US5 (P2) | US1 (at minimum) | — |

### Within Each User Story

- Test tasks (`T006–T008`, `T013`, `T017`, `T021`) **MUST** be written and FAIL before their corresponding implementation tasks
- DTOs marked `[P]` touch different files — run in parallel
- Service methods extend the same file — sequential within a story
- Controller methods extend the same file — sequential within a story

### Parallel Opportunities

- T003, T004, T005 in Phase 2 (different files — can run together after T002)
- T006, T007, T008 in US1 tests (different test concerns — can write simultaneously)
- T009, T010 in US1 DTOs (different files)
- T022 (US4 query DTO) can run in parallel with T013 (US2 test) after Phase 3 completes
- T024, T026, T027 in US5 can run in parallel with T025; T025 depends on T024

---

## Parallel Example: User Story 1

```bash
# Step 1 — Write all US1 tests together (let them fail):
T006: Audience-filter WHERE clause unit tests
T007: ROLE/INDIVIDUAL rejection + event emission unit tests
T008: HrCoreClient contract tests

# Step 2 — Once tests are failing, implement DTOs in parallel:
T009: CreateAnnouncementDto
T010: ListAnnouncementsQueryDto

# Step 3 — Service (T011) must complete before controller (T012)
T011: AnnouncementsService → T012: AnnouncementsController
```

---

## Implementation Strategy

### MVP First (P1 stories only — US1 + US2)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — CRITICAL
3. Complete Phase 3 (US1) — publish + list + event emission
4. Complete Phase 4 (US2) — edit + delete
5. **STOP and VALIDATE**: Run quickstart.md §4 curl tests; confirm all 5 CRUD endpoints + event emission working
6. Deployable MVP — 5 CRUD endpoints, audience filter, EventBus, Swagger

### Incremental Delivery

| Step | Phases | Deliverable |
|------|--------|-------------|
| 1 | 1–2 | Foundation + schema |
| 2 | 3–4 | P1 CRUD complete → **demo/deploy** |
| 3 | 5–6 | P2 pin + expiry → **demo/deploy** |
| 4 | 7 | Frontend page → **demo/deploy** |
| 5 | 8 | Polish → **feature sign-off** |

### Parallel Team Strategy

After Phase 2 (Foundational) completes:
- **Dev A**: US1 → US2 (P1 CRUD path)
- **Dev B**: US3 → US4 → frontend shell (US5 read-only) while Dev A finishes US2

---

## Task Count Summary

| Phase | Tasks | Tests | Impl |
|-------|-------|-------|------|
| 1: Setup | 1 | 0 | 1 |
| 2: Foundational | 4 | 0 | 4 |
| 3: US1 (P1) | 7 | 3 | 4 |
| 4: US2 (P1) | 4 | 1 | 3 |
| 5: US3 (P2) | 4 | 1 | 3 |
| 6: US4 (P2) | 3 | 1 | 2 |
| 7: US5 (P2) | 4 | 0 | 4 |
| 8: Polish | 3 | 0 | 3 |
| **Total** | **30** | **6** | **24** |

---

## Notes

- `[P]` tasks touch different files — no write conflicts when run in parallel
- Error codes use spec FR-027 names throughout (`UnknownTargetDepartment`, not `TargetDepartmentRequired` from contracts)
- `source: 'SOCIAL'` (uppercase) — confirmed per `ServiceName.SOCIAL` enum convention in `@sentient/shared`
- `getRoleTier(user)` is used for page-level layout gates; `user.roles.includes('HR_ADMIN')` is acceptable for per-card inline RBAC checks in the frontend
- Author enrichment: de-duplicate `authorId` values before calling `getEmployeeRef` — max 1 HR Core call per unique author per page (SC-004)
- `announcement.published` event emission is best-effort (Phase 1 in-process bus) — HTTP 201 returns even if EventBus subscriber throws
- `isPinned` is a derived field in the response shape: `pinnedUntil != null && new Date(pinnedUntil) > new Date()` — no new boolean DB column
- The `apps/social/src/modules/` directory does not yet exist; T001 creates the first module in it
