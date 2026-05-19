# Feature Specification: Social Microservice Scaffold

**Feature Branch**: `012-social-scaffold`
**Created**: 2026-05-19
**Status**: Draft
**Input**: User description: "the seconde microservice : 012-social-scaffold — Prisma schema: all 8 entities (Announcement, Event, EventAttendee, Document, Feedback, EngagementSnapshot, ExitSurvey, ExitSurveyResponse) + all enums (Audience, EventType, RsvpStatus, DocumentCategory, SentimentLabel, FeedbackType, ExitSurveyStatus, ExitSurveyQuestionKey); HrCoreClient — Social needs employee validation for authorId, organizerId, uploadedById (REST GET against HR Core, cached); Wire SharedJwtGuard + RbacGuard into the social app; EventBusModule registration; AppModule barrel, health endpoint, SOCIAL_DATABASE_URL env var"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Social Service Has Its Full Persistence Foundation (Priority: P1)

A backend developer adding the first Social feature module (Announcements, Events, Documents, Feedback, Engagement Snapshots, or Exit Surveys) finds the complete Social persistence layer already in place: all 8 domain tables exist in the `social` schema, all 8 Social-specific enum types are defined as both Prisma enums and shared TypeScript enums, and migrations are committed and applied. No subsequent feature implementer has to re-design the data model or argue about table shape — they only add module code on top of an established schema.

**Why this priority**: This is the foundation for every Social feature that follows (Announcements, Events, Document/RAG ingestion, Feedback, Engagement, Exit Surveys). Without the schema and shared enums, no Social module can start. Putting all 8 tables in one initial migration also guarantees consistent naming, schema-level constraints, and index conventions across the entire Social bounded context.

**Independent Test**: After this scaffold lands, a developer can run `cd apps/social && npx prisma migrate dev` against a clean database and end up with 8 tables under the `social` schema (`announcements`, `events`, `event_attendees`, `documents`, `feedback`, `engagement_snapshots`, `exit_surveys`, `exit_survey_responses`), 8 Postgres enums on those tables, and a generated Prisma client at `apps/social/src/generated/prisma`. The 8 shared TypeScript enums import cleanly from `@sentient/shared` in any service or in the frontend.

**Acceptance Scenarios**:

1. **Given** the `social` schema is empty, **When** `npx prisma migrate dev --name init_social_scaffold` is run in `apps/social/`, **Then** all 8 Social tables are created under the `social` schema with `@@map` snake_case names, UUID primary keys, and `createdAt` / `updatedAt` audit columns where appropriate.
2. **Given** the migration has been applied, **When** any service imports `Audience`, `EventType`, `RsvpStatus`, `DocumentCategory`, `SentimentLabel`, `FeedbackType`, `ExitSurveyStatus`, or `ExitSurveyQuestionKey` from `@sentient/shared`, **Then** the import resolves and the values match the Postgres enum types created by the migration exactly (same identifiers, same casing, same set).
3. **Given** a developer needs cross-service references, **When** they look at `Announcement.authorId`, `Event.organizerId`, `EventAttendee.employeeId`, `Document.uploadedById`, `Feedback.employeeId`, `EngagementSnapshot.scopeId`, `ExitSurvey.respondentId`, and `ExitSurveyResponse.surveyId`, **Then** all references to HR Core entities (`Employee`) are plain `String` (UUID) fields with no Prisma relation and no database-level foreign key — only `ExitSurveyResponse.surveyId` has an intra-schema relation back to `ExitSurvey`.
4. **Given** the migration is run a second time against an already-migrated database, **Then** Prisma reports no pending changes — the migration is deterministic and stable.

---

### User Story 2 — Social Authenticates and Authorizes Requests Like HR Core (Priority: P1)

A frontend or another backend service sends a request to a (future) Social endpoint with a JWT issued by HR Core. The Social service validates the JWT using the same shared secret, decodes the same `JwtPayload` shape, and enforces the same `@Roles(...)` + `RbacGuard` contract as HR Core. SYSTEM-role calls minted by AI Agentic for scheduled tasks (exit survey dispatch, engagement snapshots) are accepted only on endpoints that explicitly opt in. Authentication is uniform across the platform from day one of Social development.

**Why this priority**: Without `SharedJwtGuard` and `RbacGuard` wired globally, any Social endpoint added later will either be unprotected (security risk) or invent its own auth scheme (drift risk). All three RBAC matrices in `.claude/rules/security.md` for the Social service assume these guards are in place. We block any Social feature from being shipped before its auth boundary is reliable.

**Independent Test**: Add a temporary protected route `GET /scaffold-ping` decorated with `@Roles('EMPLOYEE')`. A request with no `Authorization` header returns 401. A request with a tampered token returns 401. A valid JWT for an `EMPLOYEE` returns 200. A valid JWT for a `SYSTEM` role on the same endpoint returns 403 (no SYSTEM role allowed). After this verification, the route is removed — only the guard wiring remains.

**Acceptance Scenarios**:

1. **Given** the Social service is running, **When** a request hits any controller (except `/health`) without a `Bearer` token, **Then** Social responds 401 Unauthorized.
2. **Given** the Social service is running, **When** a request arrives with a JWT signed by `JWT_SECRET` and validates against the shared `SharedJwtGuard`, **Then** the request reaches the controller and `request.user` is populated with the decoded `JwtPayload` (`sub`, `employeeId`, `roles`, `departmentId`, `teamId`, `channel`).
3. **Given** a controller is decorated `@Roles('HR_ADMIN')`, **When** an `EMPLOYEE`-only token calls it, **Then** `RbacGuard` returns 403 Forbidden before the handler runs.
4. **Given** the SYSTEM JWT path exists, **When** a SYSTEM-role token issued by `AgentContextFactory.forSystemTask()` reaches an endpoint that does NOT list `'SYSTEM'` in `@Roles`, **Then** the request is rejected with 403.
5. **Given** the `/health` endpoint, **When** any unauthenticated request hits it, **Then** it returns 200 — the health check is the only endpoint exempt from `SharedJwtGuard`.

---

### User Story 3 — Social Can Validate Employee References Against HR Core (Priority: P2)

When a (future) Social service creates an `Announcement`, `Event`, `Document`, `Feedback`, or `EngagementSnapshot`, it must confirm that the referenced `employeeId` (as `authorId`, `organizerId`, `uploadedById`, etc.) exists and is active in HR Core. The Social service does not own the `Employee` table — it stores only logical UUID references — so it queries HR Core over REST. To avoid hammering HR Core on every write, the lookup is cached in-process for a short TTL. The scaffold installs the `HrCoreClient` (typed, injectable, cached) so subsequent feature modules call `hrCoreClient.getEmployeeRef(id, context)` without re-inventing it.

**Why this priority**: Without this client in place, every Social feature would either skip referential validation (data integrity gap) or implement its own ad-hoc HTTP call (drift, no caching, inconsistent error mapping). Putting it in the scaffold means every later module uses the same contract.

**Independent Test**: Inject `HrCoreClient` into a temporary diagnostic controller. Call `getEmployeeRef(<known emp id>, context)` — verify it returns `{ id, firstName, lastName, departmentId, teamId, employmentStatus }`. Call it twice in 30 seconds — verify HR Core receives only one HTTP request (cache hit on the second call). Call it with a non-existent id — verify a `NotFoundException` is thrown with a clear message naming HR Core as the source.

**Acceptance Scenarios**:

1. **Given** the Social service starts up, **When** `HrCoreClient` is resolved by the Nest DI container, **Then** it reads `HR_CORE_URL` from `ConfigService` (never `process.env` directly) and exposes at minimum `getEmployeeRef(id, context)` returning a typed `EmployeeRef` shape.
2. **Given** Social calls `getEmployeeRef('emp-1', context)` for the first time within the TTL window, **When** HR Core responds 200 with the employee, **Then** the response is cached keyed by employee id and returned to the caller.
3. **Given** the same `getEmployeeRef('emp-1', context)` is called again within the TTL window, **When** the cache is consulted, **Then** the cached value is returned and no HTTP request is made to HR Core.
4. **Given** HR Core returns 404 for an unknown employee, **When** `getEmployeeRef('emp-unknown', context)` runs, **Then** the client throws `NotFoundException` (`"Employee emp-unknown not found in HR Core"`) — never a raw Axios error.
5. **Given** HR Core is unreachable (connection refused / DNS / 5xx), **When** the client attempts a call, **Then** the client throws `ServiceUnavailableException` so callers can wrap it in a graceful 503 response.
6. **Given** the client is asked to forward the caller's authority, **When** a controller passes the request's `AgentContext` (or just `{ jwt, claims }`) to the client, **Then** the JWT is forwarded as `Authorization: Bearer` and an `x-correlation-id` header is propagated from the incoming request.

---

### User Story 4 — Social Can Publish and Consume Domain Events (Priority: P2)

The Social service must emit events when (future) features fire (`announcement.published`, `event.created`, `feedback.submitted`, `document.uploaded`, `exit_survey.sent`, `exit_survey.completed`, `exit_survey.expired`) and must subscribe to events from HR Core and AI Agentic (`employee.terminated`, `probation.decision.terminated`, `agent.snapshot_generated`, `exit_survey.results_ready`). The scaffold wires the `EventBusModule` from `@sentient/shared` exactly as HR Core does, so subsequent feature work emits and listens via the same `IEventBus` abstraction.

**Why this priority**: The whole platform assumes that the three services talk by REST (Phase 1) and by events. Without `EventBusModule` registered on the Social app, no Social feature can hook into the catalog defined in CLAUDE.md §3.4 — and adding it ad-hoc later means every module reimports/reinitializes it.

**Independent Test**: Inject `IEventBus` (`@Inject('IEventBus')` or the documented token used by HR Core) in a temporary diagnostic service. Call `eventBus.emit({ id: uuid, type: 'scaffold.ping', source: 'social', timestamp: new Date(), payload: { ok: true }, metadata: { correlationId } })`. Verify the call resolves and the bus's REST or in-memory transport accepts the payload without throwing. After verification, remove the diagnostic call — only the module registration remains.

**Acceptance Scenarios**:

1. **Given** the Social `AppModule` loads, **When** `EventBusModule` is among its imports, **Then** the Nest container resolves the `IEventBus` token using the same provider symbol HR Core uses — no Social-local fork of the interface.
2. **Given** a future Social feature emits a domain event, **When** it constructs the `DomainEvent`, **Then** `source` is set to `'social'`, `metadata.userId` is read from the request's JWT claims, and `metadata.correlationId` is propagated from the incoming `x-correlation-id` header.
3. **Given** a Social subscriber is registered for an HR Core event, **When** the event fires in the Phase 1 in-process bus, **Then** the subscriber callback receives the event with the same payload shape as the publisher emitted — types resolve via shared `DomainEvent<T>` interfaces.

---

### User Story 5 — Social Service Boots, Reports Health, and Documents Itself (Priority: P3)

The Social service runs in dev (`turbo dev --filter=social`), binds to its configured port, logs its startup, exposes a `/health` endpoint that requires no auth, and serves an OpenAPI/Swagger document at `/api/docs` listing the (initially empty) controller surface and the standard `BearerAuth` security scheme. The `AppModule` is the single barrel — when a feature module is added, it's imported here, not in `main.ts`.

**Why this priority**: Health checks make local development, Docker Compose, and CI smoke checks predictable. The Swagger doc is the front-end / AI Agentic contract reference. Both must exist from the first commit so they're not retrofitted under deadline pressure.

**Independent Test**: Run `turbo dev --filter=social`. The process logs "Social service listening on port 3002" (or `SOCIAL_PORT`). `GET http://localhost:3002/health` returns 200 with `{ status: 'ok', service: 'social', timestamp: <ISO> }` without any auth header. `GET http://localhost:3002/api/docs` returns the Swagger UI HTML.

**Acceptance Scenarios**:

1. **Given** `SOCIAL_DATABASE_URL`, `SOCIAL_PORT`, `JWT_SECRET`, and `HR_CORE_URL` are present in `apps/social/.env`, **When** Social boots, **Then** it logs a single line "Social service listening on port <port>" and starts accepting connections.
2. **Given** the `/health` endpoint is hit without an Authorization header, **When** the request reaches the controller, **Then** the response is 200 with `{ status, service: 'social', timestamp }` — the global `SharedJwtGuard` does not block this route (the route is decorated `@Public()`).
3. **Given** Swagger is mounted at `/api/docs`, **When** a developer loads the page, **Then** they see the `BearerAuth` security scheme defined globally and an (initially empty) tag list — feature modules will populate tags as they're added.
4. **Given** a required env var is missing (e.g., `SOCIAL_DATABASE_URL`), **When** Social tries to boot, **Then** it fails fast with a clear error message naming the missing variable — it never starts in a half-configured state.

---

### Edge Cases

- What happens when HR Core is down at Social startup? Social must still boot — `HrCoreClient` only fails at call time. The dependency is runtime, not startup.
- What happens when a `Document.uploadedById` references an employee that was terminated yesterday? The scaffold's `HrCoreClient.getEmployeeRef` returns the employee with `employmentStatus = 'TERMINATED'`; the calling feature decides whether to allow the operation. The scaffold does not enforce this policy.
- What happens when an `ExitSurvey.respondentId` is later nulled for anonymization (per CLAUDE.md §10)? The Prisma column is nullable from the start. The scaffold does not implement the nulling logic — it only guarantees the column shape.
- What happens when a cached `EmployeeRef` is requested after its TTL expires? The next call refetches from HR Core. Stale entries are not served beyond the TTL.
- What happens when the Postgres enum values in the migration diverge from the TypeScript enum values in `@sentient/shared`? CI must fail — every enum referenced by a Prisma model must have identical values (string equality, case sensitive) to its `@sentient/shared` counterpart.
- What happens when a feature module is added to a sub-folder but not imported in `AppModule`? Its controllers are never registered. The scaffold establishes `AppModule` as the single point of feature wiring.
- What happens when `init-schemas.sql` has not been run on a fresh database? Prisma migrate fails because the `social` schema does not exist. This is the developer's responsibility, not the scaffold's.

---

## Requirements *(mandatory)*

### Functional Requirements

**Prisma Schema (8 Entities + 8 Enums)**

- **FR-001**: The `apps/social/prisma/schema.prisma` file MUST declare 8 models under the `social` schema: `Announcement`, `Event`, `EventAttendee`, `Document`, `Feedback`, `EngagementSnapshot`, `ExitSurvey`, `ExitSurveyResponse`. Each MUST have `@@schema("social")` and `@@map(<snake_case>)` annotations.
- **FR-002**: Each model MUST have a UUID primary key (`@id @default(uuid())`), a `createdAt` (`@default(now())`), and an `updatedAt` (`@updatedAt`) column — except `EventAttendee` and `ExitSurveyResponse`, which MUST have `createdAt` only (they are immutable join / response records).
- **FR-003**: The schema MUST declare 8 Prisma enums whose values match the corresponding `@sentient/shared` TypeScript enums exactly (string identifiers, case sensitive): `Audience`, `EventType`, `RsvpStatus`, `DocumentCategory`, `SentimentLabel`, `FeedbackType`, `ExitSurveyStatus`, `ExitSurveyQuestionKey`.
- **FR-004**: `Announcement` MUST include: `title`, `body`, `authorId` (logical FK to HR Core `Employee`), `audience: Audience`, `publishedAt` (nullable — null means draft), `pinnedUntil` (nullable timestamp).
- **FR-005**: `Event` MUST include: `title`, `description`, `eventType: EventType`, `organizerId` (logical FK to HR Core `Employee`), `startAt`, `endAt`, `location` (nullable), `audience: Audience`, `capacity` (nullable int).
- **FR-006**: `EventAttendee` MUST include: `eventId` (FK to `Event` with `onDelete: Cascade`), `employeeId` (logical FK to HR Core `Employee`), `rsvpStatus: RsvpStatus`, `respondedAt`. A composite unique constraint MUST prevent the same employee RSVPing twice to the same event.
- **FR-007**: `Document` MUST include: `title`, `description` (nullable), `category: DocumentCategory`, `sourceUrl` (string — storage location), `mimeType`, `sizeBytes` (BigInt), `uploadedById` (logical FK to HR Core `Employee`), `version` (int, default 1). The `Document.category` value `INTERNAL_POLICY` is the trigger for the AI Agentic RAG ingestion pipeline (CLAUDE.md §11) — the scaffold makes the column exist; ingestion is implemented by later features.
- **FR-008**: `Feedback` MUST include: `feedbackType: FeedbackType`, `subjectType` (string — e.g., `'EVENT'`, `'ANNOUNCEMENT'`, `'GENERAL'`), `subjectId` (nullable UUID — the entity feedback targets), `content` (text), `rating` (nullable int 1-5), `sentiment: SentimentLabel` (nullable — AI may fill later), `isAnonymous` (boolean default false), `employeeId` (nullable logical FK — MUST be null when `isAnonymous = true`).
- **FR-009**: `EngagementSnapshot` MUST include: `scopeType` (string — `'COMPANY' | 'DEPARTMENT' | 'TEAM'`), `scopeId` (nullable UUID — null for company-wide), `periodStart`, `periodEnd`, `metrics` (Json — produced by Engagement Agent), `generatedById` (nullable — Engagement Agent runs may have null author).
- **FR-010**: `ExitSurvey` MUST include: `respondentId` (nullable UUID — populated at dispatch, nulled on completion per §10 anonymization contract), `terminationReference` (nullable string — opaque HR Core reference, NOT a hard FK), `status: ExitSurveyStatus` (default `PENDING`), `surveyTokenHash` (string — Argon2/SHA hash of the scoped token, never the plain token), `sentAt`, `expiresAt`, `completedAt` (nullable), `channel: ChannelType`.
- **FR-011**: `ExitSurveyResponse` MUST include: `surveyId` (FK to `ExitSurvey` with `onDelete: Cascade`), `questionKey: ExitSurveyQuestionKey`, `answerText` (nullable), `answerRating` (nullable int), `submittedAt`. The model MUST NOT include any `employeeId` or `respondentId` column — anonymity is enforced by schema shape, not application code.
- **FR-012**: Indexes MUST be added for the common query patterns: `Announcement(audience, publishedAt desc)`, `Event(eventType, startAt desc)`, `EventAttendee(eventId)`, `Document(category, createdAt desc)`, `Feedback(subjectType, subjectId)`, `Feedback(isAnonymous)`, `EngagementSnapshot(scopeType, scopeId, periodStart)`, `ExitSurvey(status)`, `ExitSurvey(expiresAt)`, `ExitSurveyResponse(surveyId, questionKey)`.
- **FR-013**: The schema MUST contain NO Prisma `relation` fields pointing to entities in `hr_core` or `ai_agent` schemas — only the intra-`social` relation between `ExitSurvey` and `ExitSurveyResponse`.
- **FR-014**: A single migration named `init_social_scaffold` MUST be generated and committed. Re-running `prisma migrate dev` on a fresh database MUST produce identical output (no further migrations, no drift).

**Shared Enum Additions**

- **FR-015**: `packages/shared/src/enums/` MUST gain four new TypeScript enum files: `audience.enum.ts`, `rsvp-status.enum.ts`, `sentiment-label.enum.ts`, `feedback-type.enum.ts`. The pre-existing `document-category.enum.ts`, `event-type.enum.ts`, `exit-survey-status.enum.ts`, and `exit-survey-question-key.enum.ts` MUST be reused unchanged.
- **FR-016**: `Audience` values MUST be: `COMPANY`, `DEPARTMENT`, `TEAM`, `ROLE`, `INDIVIDUAL`. `RsvpStatus` values MUST be: `INVITED`, `ACCEPTED`, `DECLINED`, `TENTATIVE`, `ATTENDED`, `NO_SHOW`. `SentimentLabel` values MUST be: `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `MIXED`. `FeedbackType` values MUST be: `EVENT_FEEDBACK`, `ANNOUNCEMENT_FEEDBACK`, `GENERAL_FEEDBACK`, `MANAGER_FEEDBACK`, `PEER_FEEDBACK`.
- **FR-017**: All 8 Social-relevant enums MUST be re-exported from `packages/shared/src/enums/index.ts` and reachable from any service or the frontend via `import { … } from '@sentient/shared'`.

**HrCoreClient (Inter-Service Employee Validation)**

- **FR-018**: `apps/social/src/common/clients/hr-core.client.ts` MUST declare an `@Injectable()` class `HrCoreClient` that reads `HR_CORE_URL` from `ConfigService` at construction time and never reads `process.env` directly.
- **FR-019**: `HrCoreClient` MUST expose at minimum `getEmployeeRef(id: string, context: { jwt: string; correlationId?: string }): Promise<EmployeeRef>` where `EmployeeRef` is the shared interface (or a Social-local type alias of it) covering `{ id, firstName, lastName, email, departmentId, teamId, employmentStatus, employeeCode }`.
- **FR-020**: `HrCoreClient` MUST forward the caller's JWT in the `Authorization: Bearer` header on every outgoing request — Social NEVER mints its own JWT for HR Core calls and NEVER calls HR Core anonymously.
- **FR-021**: `HrCoreClient` MUST propagate the incoming request's `x-correlation-id` header to HR Core so that traces remain stitched across services.
- **FR-022**: `HrCoreClient` MUST cache successful `getEmployeeRef` responses keyed by employee id with a configurable TTL (default 60 seconds). The TTL value MUST come from `ConfigService` (env var name: `HR_CORE_EMPLOYEE_CACHE_TTL_MS`, default `60000`). The cache MUST be in-process (no Redis dependency in this scaffold).
- **FR-023**: `HrCoreClient` MUST map HR Core HTTP error responses to Nest exceptions: 401 → re-throws as `UnauthorizedException`, 403 → `ForbiddenException`, 404 → `NotFoundException`, 5xx / network errors → `ServiceUnavailableException`. The original error message MUST be wrapped, never swallowed.
- **FR-024**: `HrCoreClient` MUST be registered in a `common/clients/clients.module.ts` (or equivalent module exported by `CommonModule`) so feature modules import a single module to gain the client. No feature module instantiates the client directly.

**Auth Wiring (SharedJwtGuard + RbacGuard)**

- **FR-025**: `SharedJwtGuard` from `@sentient/shared` MUST be registered as the global `APP_GUARD` in `AppModule`, so every controller is authenticated by default. The `@Public()` decorator MUST be honored to opt out (used by `/health` and by future survey-token endpoints).
- **FR-026**: `RbacGuard` from `@sentient/shared` MUST be registered as a second global `APP_GUARD` running after `SharedJwtGuard`, so `@Roles(...)` decorators are enforced on every protected controller.
- **FR-027**: The `JWT_SECRET` value MUST be loaded from `ConfigService` and MUST be identical to HR Core's, so tokens issued by HR Core validate on Social with the same secret.
- **FR-028**: SYSTEM JWTs (signed with `SYSTEM_JWT_SECRET` per CLAUDE.md §9) MUST be accepted by `SharedJwtGuard` and pass `RbacGuard` only on endpoints whose `@Roles` includes `'SYSTEM'`. The scaffold itself adds no such endpoints — it only ensures the guards' shared logic is wired correctly to handle them when later modules opt in.
- **FR-029**: A negative test MUST confirm that a request to a non-`/health` route without an `Authorization` header is rejected with 401 — proving the global guard is active and not bypassed by a misconfigured `forRoutes`.

**EventBus Registration**

- **FR-030**: `AppModule` MUST import the `EventBusModule` (Phase 1 REST/in-memory transport) from `@sentient/shared` exactly as HR Core does. The `IEventBus` provider token used in Social MUST match the one used in HR Core so cross-service event types resolve from the same shared package.
- **FR-031**: A diagnostic call `eventBus.emit({ id, type: 'scaffold.ping', source: 'social', timestamp, payload: {}, metadata: { correlationId } })` MUST succeed against the registered bus during a smoke test, then be removed. No production code in this feature emits real domain events.
- **FR-032**: The scaffold MUST NOT implement any of the Social domain events from CLAUDE.md §3.4 (`announcement.published`, `event.created`, `feedback.submitted`, etc.). Their emission is the responsibility of the feature modules that add the business logic. The scaffold only guarantees the bus is available.

**App Bootstrap, Health, Config**

- **FR-033**: `AppModule` MUST be the single composition root — it MUST import: `ConfigModule.forRoot({ isGlobal: true })`, `ThrottlerModule` (already wired), `PrismaModule`, `CommonModule` (exposing `HrCoreClient` and middleware), `EventBusModule` (from shared), and bind two global guards (`SharedJwtGuard`, `RbacGuard`). Subsequent features add their feature modules here.
- **FR-034**: `main.ts` MUST mount a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform: true`), `helmet`, `morgan`, the global `HttpExceptionFilter`, the global `TimeoutInterceptor`, CORS (`origin: FRONTEND_URL`, `credentials: true`), and Swagger at `/api/docs` with `BearerAuth`. (All of these already exist — the scaffold preserves them.)
- **FR-035**: The `/health` endpoint MUST be decorated `@Public()` so the global `SharedJwtGuard` allows it through. Its response shape MUST be `{ status: 'ok', service: 'social', timestamp: <ISO 8601> }`.
- **FR-036**: All required env vars (`SOCIAL_DATABASE_URL`, `SOCIAL_PORT`, `JWT_SECRET`, `SYSTEM_JWT_SECRET`, `HR_CORE_URL`, `FRONTEND_URL`, `HR_CORE_EMPLOYEE_CACHE_TTL_MS`) MUST be documented in the root `.env.example` and `apps/social/.env.example` (creating the latter if missing). Missing vars at startup MUST fail fast with a clear error message naming the variable.
- **FR-037**: An `apps/social/src/generated/prisma/` path MUST be `.gitignore`d (or already covered by the root `.gitignore`) — generated client artifacts are not committed.

### Key Entities

- **Announcement**: A company / department / team / role-targeted communication authored by an employee (logical reference to HR Core), with publication state (draft vs. published) and optional pinning. Audience scope drives downstream visibility filters.
- **Event**: A scheduled gathering (meeting, training, social, all-hands) organized by an employee, with type, time window, audience, and optional capacity cap. Linked to attendance records.
- **EventAttendee**: A per-employee RSVP record for an event, capturing intent (`INVITED → ACCEPTED → ATTENDED`) and immutable history. Unique per (event, employee).
- **Document**: A source document uploaded by an employee (HR policy, handbook, regulation summary). Two roles: human-readable artifact AND raw material for the AI Agentic dual-namespace RAG pipeline when `category = INTERNAL_POLICY`.
- **Feedback**: A general or subject-scoped feedback record (event, announcement, manager, peer, or general). Anonymous-capable: when `isAnonymous = true`, `employeeId` is null at the schema level, not just hidden by API filters.
- **EngagementSnapshot**: A periodic, aggregated engagement metric set produced by the Engagement Agent. Scoped to company, department, or team. The shape of `metrics` is owned by the Engagement Agent and is intentionally `Json` to evolve without migrations.
- **ExitSurvey**: The metadata envelope for an exit interview survey dispatched to a terminating employee. Holds the hashed scoped token, dispatch channel, lifecycle status, and the (later-nulled) respondent reference. Anonymization on completion is a contract this scaffold prepares but does not yet enforce.
- **ExitSurveyResponse**: The actual answer rows for an exit survey, containing the question key, the answer text or rating, and the submission time. Carries no employee identifier — anonymity is structural.
- **EmployeeRef**: The cross-service contract returned by `HrCoreClient.getEmployeeRef`. Read-only projection of HR Core's `Employee` — used only as validation/display data, never as a source of truth.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can run `npx prisma migrate dev` against a fresh database from `apps/social/` and see the 8 tables created in the `social` schema in under 30 seconds, with zero errors.
- **SC-002**: A developer can import all 8 Social-relevant enum types from `@sentient/shared` in any service or in the frontend without TypeScript errors and without needing to rebuild any other package.
- **SC-003**: A request to `GET http://localhost:3002/health` returns 200 with `{ status: 'ok', service: 'social', timestamp: <ISO> }` within 100 ms, even with no `Authorization` header.
- **SC-004**: A request to any other route on Social without an `Authorization` header returns 401, and a request with a token bearing the wrong role for `@Roles(...)` returns 403 — verified by removing-and-restoring a temporary diagnostic route.
- **SC-005**: `HrCoreClient.getEmployeeRef(id, context)` called twice for the same id within 60 seconds results in exactly one outbound HTTP request to HR Core (verified by network log or test double) — proving the cache is active.
- **SC-006**: `HrCoreClient.getEmployeeRef('does-not-exist', context)` throws `NotFoundException` with a message that names the missing id, never a raw `AxiosError`.
- **SC-007**: When the Social service starts with `SOCIAL_DATABASE_URL` unset, the process fails within 5 seconds with a single clear error line naming the missing variable — it never starts in a partially-configured state.
- **SC-008**: Adding a stub feature module to `apps/social/src/modules/<domain>/` and importing it into `AppModule.imports` makes its controllers reachable on the next dev reload, without any additional Nest wiring — proving `AppModule` is the only barrel.
- **SC-009**: Every Postgres enum on the 8 Social tables has values identical (case sensitive, set equal) to its `@sentient/shared` TypeScript counterpart — verified by reading the migration SQL and the enum source files.
- **SC-010**: The Phase 1 EventBus `emit` call on Social resolves without throwing — verified by a smoke test that publishes a synthetic `scaffold.ping` event.

---

## Assumptions

- The Social service already has a working NestJS bootstrap (`main.ts`, `app.module.ts`, `app.controller.ts`, `app.service.ts`, `prisma/schema.prisma` with only the datasource block, `common/` with filters/interceptors/middleware). This feature extends it; it does NOT create the service from zero.
- The `social` Postgres schema and the `social_svc` database role already exist from feature 002 (monorepo scaffold) via `scripts/init-schemas.sql`. This feature does not modify schema-level grants.
- The shared `JWT_SECRET` and `SYSTEM_JWT_SECRET` were minted in feature 002 and exposed through `.env.example`. This feature does not rotate or split them.
- `SharedJwtGuard`, `RbacGuard`, `@Roles`, `@Public`, `@CurrentUser`, `JwtPayload`, and the `IEventBus` token are already implemented in `packages/shared/src/auth/` and `packages/shared/src/event-bus/`. This feature consumes them as-is.
- The HR Core service already exposes `GET /employees/:id` returning a shape compatible with `EmployeeRef` (id, firstName, lastName, email, employeeCode, departmentId, teamId, employmentStatus). If the shape differs, that is an HR Core bug, not a Social scaffold bug — Social will mirror what HR Core actually returns.
- Phase 1 inter-service transport is REST (Axios). Kafka is Phase 2 and out of scope; the `EventBusModule` registered here is the REST/in-memory implementation already used by HR Core.
- The scaffold delivers schema + plumbing only. No Social controllers, services, or DTOs beyond `app.controller.ts` (health) are added. Announcements, Events, Documents, Feedback, Engagement, and Exit Surveys are subsequent features.
- The frontend wiring (Social pages in `apps/web/`, `lib/api/social.ts` typed client) is out of scope. The frontend continues to use mock data for any Social view until the corresponding feature module ships.
- Integration tests against a real Postgres `social_test` schema are out of scope for this scaffold. A migration round-trip and a single smoke boot are sufficient acceptance evidence — feature modules add their own integration tests later.
- Caching is in-process and per-instance. When Social runs more than one instance in production, employee data may be slightly stale on whichever instance has not yet cached a given id. This is acceptable at Phase 1 traffic levels.
- No business logic, audit logging, or domain event emission is added in this feature — only the registration points where future features will hook in.
