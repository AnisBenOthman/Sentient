# Feature Specification: Announcements Module

**Feature Branch**: `013-announcements-module`
**Created**: 2026-05-21
**Status**: Draft
**Input**: User description: "013-announcements-module — Simple CRUD, good starter to validate the scaffold. Announcement CRUD: POST /announcements (MANAGER+), GET /announcements (audience-filtered by JWT claims), PATCH /:id (author or HR_ADMIN), DELETE /:id. Audience filtering: ALL → everyone, DEPARTMENT → JWT departmentId match, TEAM → JWT teamId match. isPinned toggle endpoint for HR_ADMIN. Expiry: filter out expiresAt < now() on GET. Domain event: announcement.published. Frontend: announcements.tsx page (list + detail, pinned at top, role-gated publish button). Sequencing: builds on 012-social-scaffold."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Managers and HR Admins Publish Audience-Scoped Announcements (Priority: P1)

A MANAGER or HR_ADMIN composes a short company communication (title + body), selects an audience (Company-wide, their Department, or their Team), and publishes it. The announcement is persisted in the Social service, immediately visible to every employee whose JWT claims match the chosen audience, and a `announcement.published` domain event is emitted so AI Agentic and other consumers can react. The author can later edit or delete their own announcement; HR_ADMIN can edit or delete any announcement.

**Why this priority**: This is the smallest end-to-end vertical slice that exercises the freshly scaffolded Social service — Prisma model, REST controller, RBAC guards, audience scope filtering, the `HrCoreClient` employee lookup, and the EventBus emission. Without it, the scaffold is theoretical; with it, every later Social feature (Events, Documents, Feedback, Exit Surveys) has a working template to copy.

**Independent Test**: Sign in as a MANAGER with `departmentId = 'dept-eng'` and `teamId = 'team-platform'`. `POST /announcements` with `{ title, body, audience: 'DEPARTMENT' }`. The response is 201 with the new announcement (author resolved to MANAGER's `employeeId`, `targetDepartmentId = 'dept-eng'`, `publishedAt` set to now). Sign in as a different EMPLOYEE in the same department: `GET /announcements` returns the announcement. Sign in as an EMPLOYEE in another department: the same `GET` does NOT return it. A subscriber to `announcement.published` on the in-process EventBus receives the event with `{ announcementId, audience, authorId }` payload.

**Acceptance Scenarios**:

1. **Given** an authenticated MANAGER, **When** they `POST /announcements` with `{ title, body, audience: 'COMPANY' }`, **Then** the announcement is created with `authorId` set from the JWT `employeeId`, `publishedAt` set to `now()`, `targetDepartmentId` and `targetTeamId` both `null`, and the response is 201 with the full announcement.
2. **Given** an authenticated MANAGER with `departmentId = 'dept-eng'`, **When** they `POST /announcements` with `{ audience: 'DEPARTMENT' }` and do NOT include any `targetDepartmentId` in the body, **Then** the service sets `targetDepartmentId = 'dept-eng'` (the author's department) automatically.
3. **Given** an authenticated MANAGER with `teamId = 'team-platform'`, **When** they `POST /announcements` with `{ audience: 'TEAM' }`, **Then** `targetTeamId = 'team-platform'` is set automatically. If their JWT has `teamId = null`, the request is rejected with 400 `MissingTeamForTeamAudience`.
4. **Given** an authenticated EMPLOYEE (no MANAGER or HR_ADMIN role), **When** they `POST /announcements`, **Then** the request is rejected with 403 `Forbidden` — only MANAGER+ may publish.
5. **Given** a `COMPANY` announcement exists, **When** any authenticated EMPLOYEE calls `GET /announcements`, **Then** the announcement appears in the list, ordered by `pinnedUntil > now()` first, then by `publishedAt` descending.
6. **Given** a `DEPARTMENT` announcement with `targetDepartmentId = 'dept-eng'` exists, **When** an EMPLOYEE with `departmentId = 'dept-hr'` calls `GET /announcements`, **Then** the announcement does NOT appear.
7. **Given** a `TEAM` announcement with `targetTeamId = 'team-platform'` exists, **When** an EMPLOYEE with `teamId = 'team-mobile'` calls `GET /announcements`, **Then** the announcement does NOT appear.
8. **Given** an authenticated HR_ADMIN, **When** they call `GET /announcements?scope=all`, **Then** every announcement is returned regardless of audience (administrative view).
9. **Given** the announcement was successfully persisted with `publishedAt != null`, **When** the database transaction commits, **Then** a `DomainEvent` of type `announcement.published` is emitted on the shared EventBus with `source: 'social'`, `payload: { announcementId, authorId, audience, targetDepartmentId, targetTeamId }`, and `metadata.correlationId` propagated from the request.

---

### User Story 2 — Authors and HR Admins Edit or Delete Announcements (Priority: P1)

The author of an announcement can correct typos, refine wording, change the audience, or delete the announcement entirely. HR_ADMIN can do the same on behalf of any author (e.g., to remove an inappropriate post). Non-authors cannot modify or delete announcements they do not own.

**Why this priority**: Editing and deletion are the second half of CRUD. Without them, the only way to fix a typo is to delete via SQL — which breaks the audit trail and the `announcement.published` semantic. This must ship together with publishing to count as a usable feature.

**Independent Test**: Author A creates an announcement. Author A `PATCH /announcements/:id` with `{ title: 'new title' }` succeeds (200). Author B `PATCH /announcements/:id` returns 403. HR_ADMIN `PATCH /announcements/:id` on either succeeds. Author A `DELETE /announcements/:id` succeeds (204). HR_ADMIN can `DELETE /announcements/:id` of any author.

**Acceptance Scenarios**:

1. **Given** an announcement authored by `emp-1`, **When** `emp-1` (MANAGER) calls `PATCH /announcements/:id` with a partial update, **Then** the announcement is updated, `updatedAt` advances, and the response is 200.
2. **Given** an announcement authored by `emp-1`, **When** `emp-2` (also MANAGER, but not the author) calls `PATCH /announcements/:id`, **Then** the response is 403 `NotAnnouncementAuthor`.
3. **Given** any announcement, **When** an HR_ADMIN calls `PATCH /announcements/:id`, **Then** the update succeeds regardless of authorship.
4. **Given** an announcement authored by `emp-1`, **When** `emp-1` calls `DELETE /announcements/:id`, **Then** the row is hard-deleted, the response is 204, and a subsequent `GET /announcements/:id` returns 404.
5. **Given** a non-author EMPLOYEE, **When** they call `DELETE /announcements/:id`, **Then** the response is 403 — the row is not removed.
6. **Given** an announcement with `audience: 'TEAM'` and `targetTeamId: 'team-platform'`, **When** the author PATCHes `audience` to `'COMPANY'`, **Then** `targetTeamId` is cleared to `null` (audience-target consistency is enforced by the service).

---

### User Story 3 — HR Admins Pin Important Announcements (Priority: P2)

HR_ADMIN can highlight a critical announcement (e.g., office closure, security incident, policy update) by pinning it. Pinned announcements appear at the top of every employee's list until the pin expires. Pinning is a privileged action — only HR_ADMIN may set or clear a pin.

**Why this priority**: Pinning is a UX feature, not a correctness feature — the list still works without it. It also has a clean, isolated endpoint surface (one PATCH route, one guard) that can be added after CRUD is verified.

**Independent Test**: HR_ADMIN calls `PATCH /announcements/:id/pin` with `{ pinnedUntil: '2026-06-30T00:00:00Z' }`. The announcement's `pinnedUntil` is updated and the row now sorts first in `GET /announcements`. A MANAGER (non-HR_ADMIN) attempting the same endpoint receives 403. HR_ADMIN calls `PATCH /announcements/:id/pin` with `{ pinnedUntil: null }` — the pin is cleared and the row sorts back into chronological order.

**Acceptance Scenarios**:

1. **Given** an HR_ADMIN, **When** they call `PATCH /announcements/:id/pin` with `{ pinnedUntil: <ISO timestamp> }` in the future, **Then** the announcement is pinned until that timestamp; subsequent `GET /announcements` calls sort it before non-pinned announcements.
2. **Given** an HR_ADMIN, **When** they call `PATCH /announcements/:id/pin` with `{ pinnedUntil: null }`, **Then** the pin is cleared and the announcement returns to chronological order.
3. **Given** a non-HR_ADMIN (MANAGER, EMPLOYEE), **When** they call the pin endpoint, **Then** the response is 403 — pinning is HR_ADMIN-only even for the author.
4. **Given** an HR_ADMIN, **When** they call `PATCH /announcements/:id/pin` with `{ pinnedUntil: <past timestamp> }`, **Then** the request is rejected with 400 `PinExpiryInPast`.
5. **Given** an announcement with `pinnedUntil` set to a past timestamp (the pin expired), **When** any user lists announcements, **Then** the announcement is treated as not-pinned (no special sort position) — it does NOT disappear, it just loses its pinned status.

---

### User Story 4 — Expired Announcements Drop Out of the Default List (Priority: P2)

A publisher can set an `expiresAt` on an announcement (e.g., "Office is closed Friday" — auto-hide after Friday). Once `expiresAt` is in the past, the announcement is excluded from default `GET /announcements` results for regular employees. HR_ADMIN's administrative view can still see expired announcements for audit and cleanup.

**Why this priority**: Expiry keeps the list relevant without requiring HR Admin to manually delete old posts. It's a high-value UX improvement but not blocking — announcements without an `expiresAt` simply behave as today (visible until deleted).

**Independent Test**: HR_ADMIN publishes an announcement with `expiresAt = now() + 2 days`. Verify it appears in `GET /announcements` for every audience-matched user. Advance time (or set `expiresAt` to a past value via a direct PATCH). Verify the announcement no longer appears in default list calls for EMPLOYEE/MANAGER. Verify HR_ADMIN's `GET /announcements?includeExpired=true` still returns it.

**Acceptance Scenarios**:

1. **Given** an announcement with `expiresAt > now()`, **When** any audience-matched user lists announcements, **Then** it appears as normal.
2. **Given** an announcement with `expiresAt < now()`, **When** an EMPLOYEE or MANAGER lists announcements, **Then** it is filtered out (the response array does NOT include it).
3. **Given** an HR_ADMIN, **When** they call `GET /announcements?includeExpired=true`, **Then** expired announcements appear in the response with the same audience filter rules as fresh ones.
4. **Given** an announcement with `expiresAt = null`, **When** any user lists announcements, **Then** it appears (null `expiresAt` means "never expires").
5. **Given** an announcement is fetched directly by id (`GET /announcements/:id`) by its author or HR_ADMIN, **When** `expiresAt < now()`, **Then** the response still returns the announcement (single-fetch ignores expiry for these roles — only the default list filters it).

---

### User Story 5 — Frontend Announcements Page Shows the Live Feed (Priority: P2)

An authenticated user opens the Announcements page from the sidebar. They see a paginated list of announcements ordered by pin status then publish date, each card showing title, body excerpt, author name, audience badge, publish date, and a pinned indicator when applicable. MANAGER+ users see a "New announcement" button that opens a publish form (title, body textarea, audience radio, optional expiry date). HR_ADMIN users see additional pin/unpin and delete controls on each card. Clicking a card opens its detail view (full body, full metadata).

**Why this priority**: The page makes the feature visible to real users. A backend without UI exists only for AI agents and tests. But it ships independently of the backend — the empty-state UI is testable even before any data is wired.

**Independent Test**: Navigate to `/announcements` while signed in. The page renders, calls `GET /announcements`, and shows the resulting list (or an empty state if none exist). Sign in as a MANAGER — the "New announcement" button is visible. Click it, fill the form, submit — a new card appears at the top of the list within one second (TanStack Query invalidation). Sign in as an EMPLOYEE — the "New announcement" button is not rendered.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they navigate to `/announcements`, **Then** the Announcements page renders inside the standard authenticated layout, with a header, list area, and (for MANAGER+) a publish button.
2. **Given** a MANAGER signed in, **When** they click "New announcement", fill the form, and submit, **Then** the request reaches `POST /announcements` and on success the list invalidates and re-fetches; the new announcement appears at the top.
3. **Given** an HR_ADMIN signed in, **When** they hover over an announcement card, **Then** pin/unpin and delete controls become available; clicking pin opens a small date picker and calls `PATCH /announcements/:id/pin`.
4. **Given** an EMPLOYEE signed in (no MANAGER role), **When** they view the page, **Then** the "New announcement" button is not rendered (UI gate matches backend RBAC).
5. **Given** the list contains a pinned announcement, **When** the page renders, **Then** the pinned card appears at the top with a visible "Pinned" badge and any expired announcements are absent.
6. **Given** the backend returns an error code (e.g., 403 `NotAnnouncementAuthor` on PATCH), **When** the user attempts the action, **Then** the page shows a human-readable inline error sourced from the error code mapping in `apps/web/src/lib/api/social.ts`.

---

### Edge Cases

- What happens when a MANAGER with `teamId = null` selects `audience: 'TEAM'`? The service rejects with 400 `MissingTeamForTeamAudience` — TEAM scope is only meaningful when the author belongs to a team.
- What happens when an HR_ADMIN with `teamId = null` publishes a TEAM announcement? They must supply an explicit `targetTeamId` in the body — HR_ADMIN can target any team, but the target must exist (validated via `HrCoreClient`).
- What happens when an HR_ADMIN publishes a DEPARTMENT announcement with `targetDepartmentId` that does not exist in HR Core? The `HrCoreClient.getDepartmentRef` call returns 404, the service translates that to 400 `UnknownTargetDepartment`, and the announcement is NOT persisted.
- What happens when an author is terminated after publishing? Their announcements remain visible (the row is not deleted). The author's name is still resolvable via `HrCoreClient` (HR Core returns the employee with `employmentStatus: 'TERMINATED'`).
- What happens when the `audience` enum value is `ROLE` or `INDIVIDUAL`? Both exist in the shared `Audience` enum (per 012 scaffold) but are out of scope for this iteration — the controller rejects `POST` requests with these values with 400 `UnsupportedAudienceInThisRelease`. Read paths ignore any rows with these audiences (a defensive filter).
- What happens when a user lists a department that has been renamed or restructured in HR Core? The `targetDepartmentId` is an opaque UUID, not a name — it remains valid even after a rename. The display name is resolved from `HrCoreClient` at read time.
- What happens when an announcement's `targetDepartmentId` references a department that was deleted in HR Core? The announcement still exists, but no one matches the audience filter — it becomes effectively orphaned. HR_ADMIN's `scope=all` view still surfaces it for cleanup.
- What happens when two HR_ADMINs pin the same announcement concurrently with different `pinnedUntil` values? Standard "last write wins" — the more recent PATCH wins because the table has no version column. Acceptable for this iteration; optimistic concurrency is out of scope.
- What happens when a published announcement is PATCHed to set `publishedAt = null` (effectively un-publishing)? Not supported in this release — `publishedAt` is set once at create time and is immutable. A draft workflow is out of scope.
- What happens when the EventBus subscriber for `announcement.published` throws? The publish call still returns 201 — event delivery failures must not roll back the database transaction. Failed deliveries are logged but not retried (Phase 1 in-process bus best-effort semantics).
- What happens when `expiresAt` is set in the past at create time? The service rejects with 400 `ExpiryInPast`.
- What happens when `expiresAt` is set before `publishedAt`? Same rejection — `expiresAt` must be strictly later than the implicit `publishedAt = now()`.
- What happens when a paginated `GET /announcements` is called with `pageSize > 100`? The service caps it at 100 silently — no error, just bounded.

---

## Requirements *(mandatory)*

### Functional Requirements

**Schema Additions to the Announcement Model**

- **FR-001**: The `Announcement` Prisma model in `apps/social/prisma/schema.prisma` MUST gain three new nullable columns: `targetDepartmentId String?`, `targetTeamId String?`, and `expiresAt DateTime?`. A migration named `announcements_audience_targets_and_expiry` MUST add the columns and the supporting indexes.
- **FR-002**: Two new indexes MUST be added: `@@index([targetDepartmentId])` and `@@index([targetTeamId])` to keep audience-scoped reads cheap as the table grows. The pre-existing `@@index([audience, publishedAt(sort: Desc)])` from the 012 scaffold MUST be preserved unchanged.
- **FR-003**: A CHECK-style application invariant MUST be enforced by the service (not by the database): if `audience = COMPANY`, both `targetDepartmentId` and `targetTeamId` MUST be `null`; if `audience = DEPARTMENT`, `targetDepartmentId` MUST be non-null and `targetTeamId` MUST be `null`; if `audience = TEAM`, `targetTeamId` MUST be non-null and `targetDepartmentId` MUST be `null`. The service rejects any inconsistent input with 400 `InconsistentAudienceTarget`.

**REST Surface**

- **FR-004**: `POST /announcements` MUST be guarded by `@Roles('MANAGER', 'HR_ADMIN')`. Body: `{ title: string (1-200 chars), body: string (1-10000 chars), audience: Audience, targetDepartmentId?: string, targetTeamId?: string, expiresAt?: ISO8601 string }`. On success it returns 201 with the persisted announcement.
- **FR-005**: `GET /announcements` MUST be guarded by `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`. Query: `{ page?: number (default 1), pageSize?: number (default 20, max 100), audience?: Audience (HR_ADMIN-only filter), includeExpired?: boolean (HR_ADMIN-only), scope?: 'all' | 'mine' (HR_ADMIN-only escape hatch for the admin view) }`. Default response is audience-filtered by the caller's JWT claims.
- **FR-006**: `GET /announcements/:id` MUST return a single announcement provided the caller is in the announcement's audience OR the caller is the author OR the caller is HR_ADMIN. Otherwise it returns 404 (NOT 403 — leaks fewer existence facts).
- **FR-007**: `PATCH /announcements/:id` MUST be guarded so that only the author (compared by JWT `employeeId === announcement.authorId`) or an HR_ADMIN may update. Allowed updatable fields: `title`, `body`, `audience`, `targetDepartmentId`, `targetTeamId`, `expiresAt`. Disallowed: `id`, `authorId`, `publishedAt`, `pinnedUntil`, `createdAt`, `updatedAt`. Disallowed fields in the body are silently ignored (or 400 if `forbidNonWhitelisted` is enforced by the global ValidationPipe).
- **FR-008**: `DELETE /announcements/:id` MUST be guarded so that only the author or HR_ADMIN may delete. Deletion is a hard delete (the row is removed); no soft-delete column is added in this iteration. Response is 204 No Content.
- **FR-009**: `PATCH /announcements/:id/pin` MUST be guarded by `@Roles('HR_ADMIN')`. Body: `{ pinnedUntil: ISO8601 string | null }`. `null` clears the pin. A future `pinnedUntil` sets the pin. A past `pinnedUntil` is rejected with 400 `PinExpiryInPast`.

**Audience Scope Enforcement**

- **FR-010**: The service MUST construct a Prisma `where` filter for the default `GET /announcements` such that each row matches at least one of: `audience = 'COMPANY'`, OR `audience = 'DEPARTMENT' AND targetDepartmentId = <JWT.departmentId>`, OR `audience = 'TEAM' AND targetTeamId = <JWT.teamId>`. Rows where the caller does not match are excluded by the DB query, not by post-fetch filtering.
- **FR-011**: When the caller is HR_ADMIN and passes `?scope=all`, the audience filter is bypassed and every announcement is returned (subject to expiry filter unless `includeExpired=true`).
- **FR-012**: Rows whose `audience` is `ROLE` or `INDIVIDUAL` (legacy/future enum values not supported in this release) MUST be excluded from every default list response — defensive filter independent of caller role.
- **FR-013**: The expiry filter MUST exclude rows where `expiresAt IS NOT NULL AND expiresAt < now()` unless the caller is HR_ADMIN and passes `includeExpired=true`. `expiresAt IS NULL` rows are always retained ("never expires").

**Author Enrichment**

- **FR-014**: The list and single-fetch endpoints MUST enrich each announcement with `author: { id, firstName, lastName, employeeCode }` resolved via the `HrCoreClient.getEmployeeRef` introduced by 012. Author resolution MUST use the request's `AgentContext`/JWT forwarding pattern, MUST go through the in-process cache, and MUST never trigger more than one HR Core call per unique `authorId` per page (batch or de-duplicate before resolving).
- **FR-015**: If HR Core returns 404 for an `authorId` (e.g., the employee record was deleted entirely — distinct from `TERMINATED`), the response field `author` is set to `null` and the announcement is still returned. The list endpoint MUST NOT fail because of a single missing author.
- **FR-016**: Target-department and target-team validation on `POST /announcements` MUST be performed via `HrCoreClient.getDepartmentRef` and `HrCoreClient.getTeamRef` respectively. If either call returns 404, the service rejects with 400 (`UnknownTargetDepartment` or `UnknownTargetTeam`). If the HR Core service is unreachable (5xx / network), the `POST` returns 503 `ServiceUnavailable` and no row is persisted.

**Domain Event Emission**

- **FR-017**: After a successful `POST /announcements` transaction commits, the `AnnouncementsService` MUST emit a `DomainEvent` of type `announcement.published` on the shared `IEventBus`. The event MUST conform to `DomainEvent<{ announcementId: string; authorId: string; audience: Audience; targetDepartmentId: string | null; targetTeamId: string | null; expiresAt: string | null; publishedAt: string; title: string }>` with `source: 'social'`, `metadata.userId = jwt.sub`, and `metadata.correlationId` propagated from the request's `x-correlation-id` header.
- **FR-018**: Event emission MUST be performed AFTER the database write commits — never inside the same transactional boundary. If event emission throws, the HTTP response remains 201 and the failure is logged. The Phase 1 in-process bus has best-effort delivery semantics; no retry queue is added in this feature.
- **FR-019**: `PATCH /announcements/:id`, `DELETE /announcements/:id`, and `PATCH /announcements/:id/pin` MUST NOT emit domain events in this release. Only the initial publication fires `announcement.published`. Update/delete events are deferred to a later iteration.

**Sort Order & Pagination**

- **FR-020**: The default `GET /announcements` MUST sort results by: first, "currently pinned" (rows where `pinnedUntil IS NOT NULL AND pinnedUntil > now()`) before "not pinned"; second, by `publishedAt DESC`. Ties on `publishedAt` are broken by `id` ascending for deterministic pagination.
- **FR-021**: Pagination MUST be page-based with `page` (1-indexed) and `pageSize` (default 20, max 100). The response shape MUST be `{ items: Announcement[], total: number, page: number, pageSize: number }`.

**Frontend (apps/web/src/pages/announcements.tsx)**

- **FR-022**: A new page MUST be added at `apps/web/src/pages/announcements.tsx`, registered as the route `/announcements` in `App.tsx` inside the authenticated `<Layout>` wrapper. The sidebar MUST gain an "Announcements" link visible to every authenticated user.
- **FR-023**: The page MUST fetch announcements via `useQuery({ queryKey: ['announcements', { page, pageSize }], queryFn: () => listAnnouncements({ page, pageSize }) })` where `listAnnouncements` is added to `apps/web/src/lib/api/social.ts` with the full TypeScript interface mirroring the backend DTO.
- **FR-024**: The publish button (label "New announcement") MUST be rendered only when the current user's roles include `MANAGER` or `HR_ADMIN` (checked via `useAuth()`'s `user.roles`). Hiding the button is the UI half of the backend's RBAC gate.
- **FR-025**: The pin/unpin and delete controls MUST be rendered only on cards where the current user is HR_ADMIN. The edit control is rendered when the current user is the author OR HR_ADMIN.
- **FR-026**: The `social.ts` API client MUST export at minimum: `listAnnouncements`, `getAnnouncement`, `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `pinAnnouncement`. Every function MUST be typed end-to-end (no `any`) and the response interface MUST exactly mirror what the backend returns, per the frontend/backend coherence rule.
- **FR-027**: The page's `onError` handler MUST map every backend error code to a user-facing message. At minimum: `MissingTeamForTeamAudience`, `InconsistentAudienceTarget`, `UnknownTargetDepartment`, `UnknownTargetTeam`, `ExpiryInPast`, `PinExpiryInPast`, `NotAnnouncementAuthor`, `UnsupportedAudienceInThisRelease`. Unmapped codes fall through to a generic "Failed to complete the action" message.
- **FR-028**: The page MUST show a pinned-section visual treatment (e.g., a card border + "Pinned" badge) for any returned announcement whose `pinnedUntil > now()`. Rendering trusts the backend's sort order — the frontend does not re-sort.

**Module Registration**

- **FR-029**: A new NestJS module `AnnouncementsModule` MUST live at `apps/social/src/modules/announcements/`. It MUST contain `announcements.module.ts`, `announcements.controller.ts`, `announcements.service.ts`, and a `dto/` folder with `create-announcement.dto.ts`, `update-announcement.dto.ts`, `pin-announcement.dto.ts`, and `list-announcements-query.dto.ts`. The module MUST be imported into `AppModule.imports`.
- **FR-030**: The module MUST NOT register its own `PrismaModule` instance — it MUST inject the global `PrismaService` from `apps/social/src/prisma/`. It MUST also inject `HrCoreClient` from the existing `ClientsModule` and the `IEventBus` token from the shared event-bus module.

**Documentation & OpenAPI**

- **FR-031**: Every controller method MUST be annotated with `@ApiOperation`, `@ApiResponse` (for 200/201, 400, 403, 404, 503), and `@ApiTags('Announcements')`. The Swagger doc served at `/api/docs` MUST expose the Announcements tag with all six endpoints.
- **FR-032**: DTO classes MUST use `class-validator` decorators (`@IsString`, `@IsUUID`, `@IsEnum(Audience)`, `@IsISO8601`, `@IsOptional`, `@MaxLength`) so that the global `ValidationPipe` rejects malformed bodies at the boundary before the service runs.

### Key Entities

- **Announcement** (existing in 012 scaffold, extended here): A company-, department-, or team-targeted message authored by a MANAGER+ employee. Carries title, body, audience scope, optional pin window, optional expiry, publication timestamp, and (added in this feature) target-department and target-team identifiers when the audience narrows the scope. Source of truth for the "/announcements" feed.
- **AnnouncementAuthor** (read-only projection): The author identity returned alongside each announcement in API responses. Resolved at read time from HR Core via `HrCoreClient` — never stored on the row beyond the opaque `authorId` UUID. Shape: `{ id, firstName, lastName, employeeCode }`. `null` when the author no longer exists in HR Core.
- **AnnouncementListResponse**: The pagination envelope returned by `GET /announcements`. Shape: `{ items: Announcement[], total: number, page: number, pageSize: number }`. Used by the frontend's TanStack Query hook and by any AI agent that lists announcements via REST.
- **AnnouncementPublishedEvent**: The `DomainEvent<AnnouncementPublishedPayload>` emitted on the EventBus after a successful publish. Lets AI Agentic (HR Assistant for citations, Engagement Agent for activity tracking) react without polling.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A MANAGER can publish a new COMPANY announcement and see it appear in the live list within 1 second on every signed-in browser session — verified by a manual two-tab test.
- **SC-002**: A DEPARTMENT-scoped announcement created by a MANAGER in department X is visible to every EMPLOYEE in department X and invisible to every EMPLOYEE in any other department — verified by integration test running against a real `social_test` schema with three seeded employees in two departments.
- **SC-003**: An HR_ADMIN can pin an announcement and the same row appears first in every subsequent `GET /announcements` response across all matching audiences, with the "Pinned" badge rendered by the frontend — verified by a manual signed-in test on the announcements page.
- **SC-004**: Publishing 100 announcements and listing them returns the first page in under 200 ms on a developer laptop (warm cache) — measured via a simple `curl -w` timing or a Jest perf assertion. Author enrichment for 20 announcements (one page) results in at most 20 HR Core calls on a cold cache and 0 calls on a warm cache within the TTL.
- **SC-005**: A subscriber registered to `announcement.published` receives the event payload within 100 ms of the `POST /announcements` HTTP response — verified by an integration test that subscribes a Jest spy to the in-process bus and asserts call count + payload shape after a publish.
- **SC-006**: Every error code documented in FR-027 (`MissingTeamForTeamAudience`, `InconsistentAudienceTarget`, `UnknownTargetDepartment`, `UnknownTargetTeam`, `ExpiryInPast`, `PinExpiryInPast`, `NotAnnouncementAuthor`, `UnsupportedAudienceInThisRelease`) is reachable via at least one Jest test case that asserts the exact code string in the response body.
- **SC-007**: A non-author, non-HR_ADMIN MANAGER attempting to PATCH or DELETE an announcement they did not author always receives 403 — verified by a Jest test that signs in as a second MANAGER and confirms the assertion.
- **SC-008**: An expired announcement is invisible to EMPLOYEE/MANAGER default list calls and visible to HR_ADMIN list calls with `includeExpired=true` — verified by an integration test that creates a row with `expiresAt = past timestamp` and runs both list calls.
- **SC-009**: The frontend Announcements page renders an empty state (zero list items) without any console errors or 500 responses on a fresh database — verified by running `turbo dev` against a clean schema and loading `/announcements` as a logged-in EMPLOYEE.
- **SC-010**: The migration `announcements_audience_targets_and_expiry` is reversible (or at least re-runnable on a fresh DB) and re-running `npx prisma migrate dev` on a freshly migrated database reports "no pending migrations" — verified by a manual round-trip on a developer laptop.

---

## Assumptions

- The 012-social-scaffold feature is fully delivered and merged: the `Announcement` model, the `Audience` Prisma enum, the `HrCoreClient`, `SharedJwtGuard`, `RbacGuard`, and `EventBusModule` registration are all in place. This feature extends the scaffold; it does NOT bootstrap any of these.
- `HrCoreClient` exposes `getEmployeeRef` today; this feature additionally requires `getDepartmentRef(id, context)` and `getTeamRef(id, context)`. If these methods do not yet exist on `HrCoreClient`, they must be added as part of this feature with the same caching and error-mapping semantics as `getEmployeeRef` (per CLAUDE.md §3.2 and 012-social-scaffold FR-018 through FR-024).
- HR Core's `GET /api/hr/employees/:id`, `GET /api/hr/departments/:id`, and `GET /api/hr/teams/:id` endpoints already exist and return JSON shapes compatible with `EmployeeRef`, a `DepartmentRef` (`{ id, name, code }`), and a `TeamRef` (`{ id, name, departmentId }`). If the team/department endpoints do not exist yet, they must be exposed as a prerequisite (out of scope for this spec — track as a dependency).
- POST creates the announcement as immediately published (`publishedAt = now()`). A draft workflow (`publishedAt = null`, separate `publish` action) is out of scope for this iteration.
- `audience = 'ROLE'` and `audience = 'INDIVIDUAL'` enum values exist in the shared `Audience` enum but are NOT supported as publish targets in this release. Targeting a specific role or specific individual is deferred until a later feature.
- Pin behavior reuses the existing `pinnedUntil` column from 012. There is no separate `isPinned` boolean — "is pinned" is derived as `pinnedUntil > now()`. The pin endpoint accepts either an explicit ISO timestamp or `null` to clear.
- Hard delete (no soft-delete column) is the chosen deletion semantic. Audit trail for deletions is intentionally out of scope; the `announcement.published` event captures publication, and the absence of a row indicates deletion.
- Author enrichment via `HrCoreClient` is a backend concern. The frontend does NOT make a second round trip to fetch author names — the backend embeds `author: { id, firstName, lastName, employeeCode }` in every list/detail response.
- The frontend page uses TanStack Query (already a dependency) and wouter routing (already configured) — no new dependencies are added to `apps/web/`.
- Inter-service authentication continues to forward the caller's JWT (Phase 1, REST). No new SYSTEM endpoints are introduced — `announcement.published` is consumed by future AI Agentic features over the EventBus, not over REST.
- Rate limiting on `POST /announcements` reuses the existing `@nestjs/throttler` global config from 012-social-scaffold — no per-endpoint throttle override is added.
- Integration tests against a real Postgres `social_test` schema are the testing standard for this feature, with unit tests covering audience-scope-filter construction and DTO validation. Contract tests against HR Core endpoints (`getEmployeeRef`, `getDepartmentRef`, `getTeamRef`) are required per `.claude/rules/testing.md` §5.
- The `apps/web/src/lib/api/social.ts` file is currently a stub (`export const socialApi = {}`) — this feature replaces the stub with the typed function exports listed in FR-026.
