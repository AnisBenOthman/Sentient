# Phase 0 Research — 012-social-scaffold

Captures the 13 decisions that close every "NEEDS CLARIFICATION" in the technical context.

---

## R-01. Location of the EventBus implementation

**Decision**: Create a Social-local `EventBusModule` at `apps/social/src/common/event-bus/event-bus.module.ts` plus an `InMemoryEventBus` class that is byte-identical to `apps/hr-core/src/common/event-bus/in-memory-event-bus.ts`. Both bind the shared `EVENT_BUS = Symbol('IEventBus')` token from `@sentient/shared/event-bus`.

**Rationale**: `@sentient/shared` exposes only the **interface** (`IEventBus`, `DomainEvent`, `EVENT_BUS` token). The Nest `@Global() @Module(...)` provider and the in-memory implementation live inside each app. Mirroring HR Core keeps the Social wiring familiar to anyone who has read HR Core's bootstrap.

**Alternatives considered**:

- *Promote `EventBusModule` + `InMemoryEventBus` into `@sentient/shared`*. Cleaner long-term, but it forces a coordinated change touching HR Core's already-shipped behavior. Out of scope for a Social-feature ticket. Tracked as a follow-up after both services run on the local mirror.
- *Skip the bus for now*. Rejected — feature modules (announcements, exit-survey dispatch, engagement snapshots) would each have to wire their own; the spec explicitly calls for the bus to be in place from day one (FR-030).

---

## R-02. HTTP client for `HrCoreClient`

**Decision**: Raw `axios` instance, constructed once per `HrCoreClient` lifetime:

```ts
this.http = axios.create({ baseURL: this.config.getOrThrow('HR_CORE_URL'), timeout: 5_000 });
```

Methods return `Promise<T>`. Errors are mapped to Nest exceptions inside a single `try/catch`.

**Rationale**: Smallest dependency surface. The repository otherwise uses zero RxJS, so adopting `@nestjs/axios` (which returns `Observable<>`) would either pollute every consumer with `firstValueFrom(...)` or force an RxJS learning curve. Raw `axios` is two lines and trivially mockable with `jest.mock('axios')`.

**Alternatives considered**:

- *`@nestjs/axios` `HttpModule`*. Rejected — adds RxJS friction without payoff.
- *`undici` / `fetch`*. Rejected — Nest middleware-style interceptors (correlation id, logging) are easier with `axios` interceptors than with raw `fetch` wrappers. The added bundle weight is negligible because `axios` is already in HR Core's tree.

---

## R-03. Cache implementation

**Decision**: A private `Map<string, { value: EmployeeRef; expiresAt: number }>` field on `HrCoreClient`. On read, check `expiresAt > Date.now()`; if expired, delete and refetch. TTL read once at construction from `HR_CORE_EMPLOYEE_CACHE_TTL_MS` (default `60_000`).

**Rationale**: Zero new dependency. Bounded by active employee cardinality (~500 for the FYP). Lazy eviction is fine — entries never grow stale beyond TTL because they are checked on read, and orphaned entries cost a few hundred bytes each. The cache is per-instance; multi-instance staleness is documented in the spec under Assumptions.

**Alternatives considered**:

- *`cache-manager` with in-memory store*. Rejected — single key shape, single method; not worth the dependency. May revisit when a second cached method appears.
- *Process-wide singleton (module-level `Map`)*. Rejected — breaks per-test isolation; harder to reset between tests.
- *External Redis*. Rejected — adds an infra dependency the Phase 1 architecture does not need. Documented in spec assumptions as acceptable.

---

## R-04. JWT issuance vs. validation

**Decision**: Social **validates** JWTs only — it never mints, refreshes, or issues tokens. `SharedJwtGuard` (from `@sentient/shared`) reads `JWT_SECRET` and `SYSTEM_JWT_SECRET` from `ConfigService` at construction time and verifies the signature; that is the entire authentication surface in Social.

**Rationale**: `.claude/rules/security.md` §1 explicitly designates HR Core as the only issuer. Social must trust the JWT but never extend or replace it.

**Alternatives considered**:

- *Social-side token introspection against HR Core on every request*. Rejected — doubles latency for every protected call and creates a hard dependency on HR Core uptime for any Social request.

---

## R-05. Global guard ordering

**Decision**: Bind `APP_GUARD`s in this order inside `AppModule.providers`:
1. `ThrottlerGuard` (existing — rate-limit cheap rejections first)
2. `SharedJwtGuard` (new — authenticate)
3. `RbacGuard` (new — authorize on `@Roles(...)`)

**Rationale**: Throttling before crypto avoids burning CPU on flood traffic. `SharedJwtGuard` populates `request.user` so `RbacGuard` has claims to read. `RbacGuard` short-circuits with `true` when the handler has no `@Roles` decorator, so undecorated handlers remain authenticated-only without extra config.

**Alternatives considered**:

- *Combine auth + RBAC into a single guard*. Rejected — `@sentient/shared` already ships them as two separate, composable guards mirroring HR Core's pattern. Two small guards beat one large one.
- *Skip `UserStatusGuard` (HR Core has it)*. Confirmed — Social does not own the `User` table; HR Core enforces status at token issue time and via short JWT lifetime. Social inherits the consequence.

---

## R-06. `/health` exemption mechanism

**Decision**: Decorate the `health()` handler with `@Public()` from `@sentient/shared`. The `SharedJwtGuard` honors the decorator and short-circuits to `true` for that route.

**Rationale**: Declarative, co-located with the handler, identical to HR Core's IAM `@Public()` opt-outs (e.g., `POST /auth/login`). One annotation, no URL allowlists.

**Alternatives considered**:

- *URL allowlist (`if (req.path === '/health') return true`) inside the guard*. Rejected — opaque, brittle under any rename, and breaks if a feature module adds a sub-route under `/health`.
- *`forRoutes()` exclusion in `AppModule.configure`*. Rejected — `APP_GUARD` providers always run; route-level exclusion via middleware would require restructuring the guard as middleware.

---

## R-07. Migration scope: single vs. split

**Decision**: One migration `20260520000000_init_social_scaffold/migration.sql` carrying:
- 8 `CREATE TYPE ... AS ENUM (...)` statements
- 8 `CREATE TABLE ...` statements (in dependency order: `exit_surveys` before `exit_survey_responses`)
- 10 `CREATE INDEX` statements

**Rationale**: This is the schema's birth, not an evolution. Splitting into one-per-entity migrations would invite partial-rollout footguns (`event_attendees` exists but `events` does not, etc.) and clutter the migrations folder. The whole scaffold is one atomic commit.

**Alternatives considered**:

- *One migration per entity*. Rejected as above.
- *Use `prisma db push` instead of `migrate dev`*. Rejected — `db push` skips the migrations folder, defeating the source-of-truth role of `prisma/migrations/*` and breaking the FR-014 requirement that the migration be committed.

---

## R-08. Polymorphic `Feedback.subjectType` / `subjectId`

**Decision**: `Feedback.subjectType: String` (free-form text, recommended values `'EVENT' | 'ANNOUNCEMENT' | 'GENERAL'`) + `subjectId: String?` (nullable UUID). No Prisma relation. Indexed `@@index([subjectType, subjectId])`.

**Rationale**: Matches HR Core `Notification.referenceType` / `referenceId` (010-notifications). `Feedback` targets entities across schemas (events, announcements, employees) — a discriminated Prisma relation is impossible (cross-schema FKs are forbidden) and an enum discriminator duplicates information already encoded in `feedbackType`. Free-form `subjectType` keeps the schema flat while allowing future targets without a migration.

**Alternatives considered**:

- *Add a discriminator enum*. Rejected — `FeedbackType` already encodes whether the feedback is event/announcement/manager/peer/general. Two discriminators invite drift.
- *Separate tables per target type*. Rejected — explosion (`event_feedback`, `announcement_feedback`, `manager_feedback`, …), all with identical columns.

---

## R-09. Exit-survey anonymity at the schema level

**Decision**: `ExitSurveyResponse` has **no** `employeeId`, `respondentId`, or any other column that could re-link the response to a person. `ExitSurvey.respondentId: String?` is nullable from day one (will be nulled by the future "complete survey" feature, per CLAUDE.md §10).

**Rationale**: Anonymity that relies on application-layer filters is one bug away from a leak. The strongest guarantee is that the data simply does not exist in the row. The CLAUDE.md §10 contract is preserved structurally.

**Alternatives considered**:

- *Keep `employeeId` on the response and rely on API filters to omit it*. Rejected — every new endpoint then carries the burden of remembering the filter; one missed line equals a privacy incident.

---

## R-10. Env var documentation: root vs. per-service `.env.example`

**Decision**: Both. The root `.env.example` already includes a `── Social Service ──` section — add `HR_CORE_EMPLOYEE_CACHE_TTL_MS` there. Additionally, create `apps/social/.env.example` carrying only the Social-relevant subset so a developer can `cp apps/social/.env.example apps/social/.env` directly.

**Rationale**: HR Core has both (`.env.example` at root + `apps/hr-core/.env.example`). A new developer working in `apps/social/` expects to find the template next to the code, not only at the root. Drift risk is mitigated because the per-service file is a strict subset and the new variable is added to both.

**Alternatives considered**:

- *Only root*. Rejected — discoverability inside `apps/social/` matters.
- *Only per-service*. Rejected — root `.env.example` is the canonical platform-wide reference and the docker-compose target.

---

## R-11. Diagnostic verification: test-only routes, not production source

**Decision**: The spec's diagnostic verifications (a `@Roles('EMPLOYEE')` `GET /scaffold-ping` and a smoke `eventBus.emit('scaffold.ping')`) are implemented inside a Jest test using `Test.createTestingModule({ imports: [AppModule], controllers: [TestPingController] }).compile()`. No production source carries the diagnostic.

**Rationale**: Zero production-source pollution. The same invariants are asserted (401 without token, 200 with valid `EMPLOYEE` JWT, 403 with `SYSTEM` JWT on an `EMPLOYEE`-only route, `eventBus.emit` resolves). The test files live under `apps/social/src/common/__smoke__/auth-wiring.spec.ts` and `apps/social/src/common/__smoke__/event-bus.spec.ts`.

**Alternatives considered**:

- *Ship the diagnostic routes and revert in a follow-up commit*. Rejected — the dead code persists in git history regardless, and a hurried revert could leave it in. The test approach is permanent and asserts the same wiring.

---

## R-12. Generated Prisma client output

**Decision**: Generate to `apps/social/src/generated/prisma/`, matching HR Core's `apps/hr-core/src/generated/prisma/`. The repo-root `.gitignore` already covers `**/generated/**`.

**Rationale**: Parity with HR Core. Verified that the existing ignore globs catch the new path so no `.gitignore` change is needed.

**Alternatives considered**:

- *Generate to `node_modules/.prisma/social-client`*. Rejected — diverges from HR Core; the in-tree `src/generated/` makes typings discoverable and works with `tsc` paths.

---

## R-13. Migration drift against non-empty dev DBs

**Decision**: Rely on Prisma's built-in drift detection. The migration creates tables but never touches the `social` schema itself (created by `scripts/init-schemas.sql` in feature 002). If a developer's dev DB already contains `social.*` tables created by hand, `prisma migrate dev` refuses and surfaces the conflict — the developer must drop the rogue tables or run `prisma migrate reset`.

**Rationale**: Prisma's drift detection is the correct safety net. Trying to be clever with `CREATE TABLE IF NOT EXISTS` defeats the entire purpose of versioned migrations.

**Alternatives considered**:

- *`CREATE TABLE IF NOT EXISTS` in the migration SQL*. Rejected — Prisma owns migration state; hand-written idempotency hooks invite silent drift.
- *Document a "reset your dev DB" step in quickstart*. Acceptable as a fallback — added to `quickstart.md` step 3 as a note.

---

## Closing summary

All thirteen unknowns are resolved. The plan, data-model, contracts, and quickstart artifacts proceed without further clarifications.
