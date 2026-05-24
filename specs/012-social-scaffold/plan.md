# Implementation Plan: Social Microservice Scaffold

**Branch**: `012-social-scaffold` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-social-scaffold/spec.md`

## Summary

Promote `apps/social/` from a bare NestJS skeleton to a fully wired microservice ready to host the eight Social domains (Announcements, Events, Documents, Feedback, Engagement, Exit Surveys). The scaffold delivers four pillars:

1. **Prisma persistence** — one migration `init_social_scaffold` creates 8 tables under the `social` Postgres schema, 8 Postgres enums whose values mirror four new + four existing `@sentient/shared` TypeScript enums exactly.
2. **Cross-service plumbing** — an injectable, JWT-forwarding, in-process-cached `HrCoreClient` (`getEmployeeRef`) so Social can validate `authorId` / `organizerId` / `uploadedById` / `respondentId` against HR Core without hammering it.
3. **Platform-wide auth contract** — `SharedJwtGuard` + `RbacGuard` mounted as global `APP_GUARD`s, with `@Public()` opt-out honored (used by `/health` and later by the survey-token endpoint).
4. **EventBus availability** — a local `EventBusModule` mirroring HR Core's, providing the shared `EVENT_BUS` token with an `InMemoryEventBus` Phase 1 implementation so subsequent Social feature modules can emit / subscribe via the catalog in CLAUDE.md §3.4.

Zero business logic ships in this feature. No controllers beyond the existing `/health`, no DTOs for any domain, no domain event emissions, no frontend wiring. The scaffold establishes registration points; feature modules plug in afterwards.

## Technical Context

**Language/Version**: TypeScript 5.x strict — repo-wide `tsconfig.base.json` enforces `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames`. Social inherits.
**Primary Dependencies**: NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, @nestjs/throttler, axios 1.x, `@sentient/shared` workspace package (`SharedJwtGuard`, `RbacGuard`, `EVENT_BUS`, `IEventBus`, `DomainEvent`, `JwtPayload`, `Public`/`Roles`/`CurrentUser` decorators, enums barrel).
**Storage**: PostgreSQL 16, schema `social`. Eight new tables (`announcements`, `events`, `event_attendees`, `documents`, `feedback`, `engagement_snapshots`, `exit_surveys`, `exit_survey_responses`), eight new Postgres enums, ten new indexes. The `social` schema and `social_svc` role already exist from feature 002 (`scripts/init-schemas.sql`); this feature only adds tables, never schema-level DDL.
**Testing**: Jest unit (Nest test module with mocked `ConfigService` and mocked `axios`). One Supertest smoke test boots `AppModule` and asserts `GET /health → 200` + an unauthenticated `GET /scaffold-ping → 401` (the diagnostic route is removed before commit; the negative-path assertion lives in a test that targets a tagged probe route added solely under `process.env.NODE_ENV === 'test'`). No integration tests against a real `social_test` schema in this feature — feature modules will add them.
**Target Platform**: Node 20 LTS on Linux/Windows dev; Docker Compose Postgres 16 + pgvector. Social listens on `:3002` (env `SOCIAL_PORT`).
**Project Type**: Web-service (NestJS microservice). No frontend changes in this feature.
**Performance Goals**: `GET /health` p95 < 100 ms. `HrCoreClient.getEmployeeRef` cache hit < 1 ms (in-process Map). Cold start to first request accepted < 10 s.
**Constraints**:
- No cross-schema Prisma relations (only `ExitSurveyResponse → ExitSurvey`).
- No `process.env` reads outside `ConfigService`.
- No JWT minting in Social — it only forwards.
- In-process cache only (no Redis). Cache is per-instance and may go stale across a horizontally scaled deploy; acceptable at Phase 1.
- Migration must be idempotent: re-running `prisma migrate dev` against an already-migrated database produces no diff.
**Scale/Scope**: 1 Prisma schema file, 1 migration, 4 new shared enum files, 2 new `apps/social/src/common/` subdirectories (`clients/`, `event-bus/`), 3 new module-level files (`clients.module.ts`, `event-bus.module.ts`, `in-memory-event-bus.ts`), `app.module.ts` + `app.controller.ts` updates, plus `apps/social/.env.example` and root `.env.example` additions. Estimate ~25 file changes.

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template. The de-facto constitution lives in `.claude/CLAUDE.md`, `.claude/rules/code-style.md`, `.claude/rules/security.md`, `.claude/rules/testing.md`, and `.claude/rules/frontend-backend-coherence.md`. Plan checked against those gates:

| Gate (from `.claude/rules/*` & CLAUDE.md) | Status | Notes |
|---|---|---|
| Modular design: no source-level cross-service imports | PASS | `HrCoreClient` calls HR Core via REST through `ConfigService.get('HR_CORE_URL')`. No `import ... from '../../../hr-core/...'`. |
| Strict TypeScript; explicit return types; no `any` | PASS | `HrCoreClient.getEmployeeRef(...): Promise<EmployeeRef>`; axios responses narrowed with type guards before return. |
| `@@schema()` + `@@map()` on every Prisma model; snake_case tables | PASS | All 8 models carry both annotations. Enums also receive `@@schema("social")`. |
| Every endpoint guarded by `SharedJwtGuard` + `RbacGuard` (except `/health` and survey-respond) | PASS | Both guards bound as `APP_GUARD` in `AppModule`. `/health` uses `@Public()`. No survey endpoint in this scaffold. |
| Validation at boundary; services trust inputs | N/A this feature | No new DTOs / controllers beyond `/health` and the test-only diagnostic ping. |
| No cross-schema queries; cross-service via REST or events | PASS | `HrCoreClient` is REST-only. EventBus uses shared `EVENT_BUS` token. |
| EventBus abstraction (no direct REST or Kafka in business logic) | PASS | `EVENT_BUS` token mirrored from HR Core via `InMemoryEventBus`; Phase 2 Kafka swap requires no caller change. |
| No `process.env` outside `ConfigService` | PASS | `HrCoreClient` and `EventBusModule` read everything via `ConfigService`. |
| RBAC: `@Roles` enforced; SYSTEM role gated | PASS | `RbacGuard` global; SYSTEM JWTs validated by `SharedJwtGuard` (which already understands `SYSTEM_JWT_SECRET`) and accepted only when `@Roles('SYSTEM')` is declared. Scaffold adds no such endpoint — contract is preserved for later. |
| Prisma migrations: `DROP INDEX` for renames | N/A | This is the initial migration; no constraint renames. |
| Anonymization contract for exit surveys (CLAUDE.md §10) | PASS | `ExitSurveyResponse` has no `employeeId` column. `ExitSurvey.respondentId` nullable from day one. |
| Frontend↔backend coherence | N/A this feature | No frontend wiring. Future Social pages will add `lib/api/social.ts` clients against the eventual controllers. |
| No comments that describe WHAT; only WHY when non-obvious | PASS | Only the `WHY:` comments around `HrCoreClient` cache TTL and the `EVENT_BUS` provider symbol are warranted. |
| No `any`; no `as unknown as X` escape hatches | PASS | `HrCoreClient` narrows axios responses via a `isEmployeeRef(raw: unknown): raw is EmployeeRef` guard. |

**Verdict**: ALL PASS. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/012-social-scaffold/
├── plan.md              # This file (/speckit.plan output)
├── spec.md              # Feature spec (already written)
├── research.md          # Phase 0 — decisions + alternatives
├── data-model.md        # Phase 1 — 8 entities, enums, indexes, migration
├── quickstart.md        # Phase 1 — local dev walkthrough
├── contracts/
│   ├── prisma-schema.md         # Prisma model + enum contract (canonical shape)
│   ├── hr-core-client.md        # HrCoreClient method signatures, headers, errors, cache
│   ├── auth-wiring.md           # Global guards, @Public opt-out, SYSTEM role behavior
│   ├── event-bus.md             # EVENT_BUS token, InMemoryEventBus contract
│   ├── health-endpoint.md       # GET /health response shape
│   └── environment-vars.md      # Required + optional env vars for Social
├── checklists/
│   └── requirements.md          # Quality checklist (already green)
└── tasks.md                     # Phase 2 — created by /speckit.tasks
```

### Source Code (repository root)

```text
apps/social/                                            # Microservice :3002
├── prisma/
│   ├── schema.prisma                                   # +8 models, +8 enums, +indexes
│   └── migrations/
│       └── 20260520000000_init_social_scaffold/
│           └── migration.sql                           # CREATE TYPE × 8, CREATE TABLE × 8, CREATE INDEX × 10
├── src/
│   ├── main.ts                                         # UNCHANGED (already wired: helmet, morgan, validation, swagger, CORS)
│   ├── app.module.ts                                   # +ClientsModule, +EventBusModule, +APP_GUARD ×2 (SharedJwtGuard, RbacGuard)
│   ├── app.controller.ts                               # /health remains @Public(); GET / removed if present
│   ├── app.service.ts                                  # unchanged
│   ├── common/
│   │   ├── filters/                                    # unchanged
│   │   ├── interceptors/                               # unchanged
│   │   ├── middleware/                                 # unchanged (CorrelationIdMiddleware)
│   │   ├── clients/
│   │   │   ├── clients.module.ts                       # NEW — exports HrCoreClient
│   │   │   ├── hr-core.client.ts                       # NEW — getEmployeeRef + in-process cache
│   │   │   ├── hr-core.client.spec.ts                  # NEW — unit tests (axios mocked)
│   │   │   └── employee-ref.interface.ts               # NEW — local mirror or re-export of shared EmployeeRef
│   │   └── event-bus/
│   │       ├── event-bus.module.ts                     # NEW — provides EVENT_BUS (mirrors HR Core)
│   │       └── in-memory-event-bus.ts                  # NEW — same logger-tagged impl as HR Core
│   └── prisma/                                         # PrismaModule/PrismaService already present
│
├── .env.example                                        # NEW — Social-specific template (or update if exists)
└── package.json                                        # +axios dependency if not already present at workspace level

packages/shared/
└── src/
    └── enums/
        ├── audience.enum.ts                            # NEW
        ├── rsvp-status.enum.ts                         # NEW
        ├── sentiment-label.enum.ts                     # NEW
        ├── feedback-type.enum.ts                       # NEW
        └── index.ts                                    # +4 re-exports

.env.example                                            # +HR_CORE_EMPLOYEE_CACHE_TTL_MS, ensure SOCIAL_*  & HR_CORE_URL present
```

**Structure Decision**: Standard Sentient microservice layout. The new code lands in two `apps/social/src/common/` subdirectories (`clients/`, `event-bus/`) — both intentionally mirror HR Core's conventions so a developer who knows HR Core can read Social without re-learning the wiring. Four new shared enums live in `packages/shared/src/enums/` so any future caller — Social controllers, the AI Agentic engagement agent, or the React frontend — uses the same string values.

## Phase 0: Outline & Research

Research questions to resolve in `research.md` before Phase 1:

1. **Where does `EventBusModule` actually live?** — The spec calls it "the `EventBusModule` from `@sentient/shared`", but inspection shows `@sentient/shared` exposes only the `IEventBus` interface, `DomainEvent`, and the `EVENT_BUS = Symbol('IEventBus')` token. The Nest module + `InMemoryEventBus` implementation is **local to each app** (`apps/hr-core/src/common/event-bus/`). **Decision**: mirror HR Core — create `apps/social/src/common/event-bus/event-bus.module.ts` + `in-memory-event-bus.ts`, both pointed at the shared `EVENT_BUS` token. Alternative considered: extract the implementation to `@sentient/shared` so both services import one module — rejected for this scaffold because it would touch HR Core (out of scope for a Social feature) and risks breaking HR Core's already-shipped behavior. The extraction is a clean follow-up task once both services run on the local mirror.

2. **HTTP client: `@nestjs/axios` vs raw `axios`** — HR Core has no `HrCoreClient` precedent (Social is the first to need cross-service REST). **Decision**: raw `axios` instance configured at module construction time. Rationale: smallest dependency surface, full control over interceptors (correlation id, JWT forwarding, error mapping), and `@nestjs/axios` adds an RxJS layer the codebase otherwise does not use. Alternative considered: `HttpModule` from `@nestjs/axios` — rejected because every method would return `Observable<>` then be `firstValueFrom`'d, adding noise without benefit.

3. **Cache implementation: in-process `Map<string, { value, expiresAt }>` vs `cache-manager`** — The spec requires in-process only, default TTL 60 s. **Decision**: plain `Map` with `Date.now() + ttlMs` expiry checked on read. Rationale: zero new dependency; the cardinality is bounded by active employees (≤ 500 for the FYP scale) so memory is irrelevant; entries are evicted lazily on next access. Alternative considered: `cache-manager` with in-memory store — rejected because it adds a dependency to support a single key shape. We may revisit when we need TTL on a second client method.

4. **JWT validation entry point** — Should Social mint or refresh tokens? **Decision**: no. Social only **validates** JWTs (HR Core remains the issuer per `.claude/rules/security.md` §1). `SharedJwtGuard` from `@sentient/shared` reads `JWT_SECRET` and `SYSTEM_JWT_SECRET` from `ConfigService` and verifies the signature; Social's responsibility ends there. Alternative considered: a local "introspect-on-HR-Core" path — rejected because it doubles every request's latency and breaks during HR Core outages.

5. **Global guard ordering** — Order of `APP_GUARD` providers matters: throttle first, auth second, RBAC last. **Decision**: bind in this order in `AppModule.providers`: `ThrottlerGuard` (already there), `SharedJwtGuard`, `RbacGuard`. Rationale: rate-limit cheap rejections before crypto, then authenticate, then authorize. No `UserStatusGuard` equivalent in Social because Social does not own the `User` table — HR Core enforces deactivated/locked-out status at token issue time, and revocation is via short JWT lifetime + refresh-token revocation in HR Core's IAM module.

6. **`/health` exempt — `@Public()` vs route-level guard exclusion** — Two ways to skip auth: decorate the handler `@Public()` or check `request.url === '/health'` inside the guard. **Decision**: `@Public()` decorator (already supported by `SharedJwtGuard` in `@sentient/shared`). Rationale: declarative, co-located with the handler, identical to HR Core's `IAM /auth/login` opt-out pattern. Alternative considered: URL allowlist in the guard — rejected as opaque and brittle (one rename and `/health` is silently protected).

7. **Migration timing and naming** — Single migration vs split per entity? **Decision**: one migration `init_social_scaffold` covering all 8 tables + 8 enums + 10 indexes. Rationale: per the spec FR-014, the migration must be idempotent and committed as a single unit; splitting would invite partial-rollout footguns. Alternative considered: one migration per entity — rejected; this is the schema's birth, not an incremental evolution.

8. **Polymorphic `Feedback.subjectType` / `subjectId`** — `Feedback` targets events, announcements, managers, peers, or nothing in particular. **Decision**: `subjectType: text` (free-form, recommended values `'EVENT' | 'ANNOUNCEMENT' | 'GENERAL'`) + `subjectId: uuid NULL`. No Prisma relation. Rationale: matches the polymorphic pattern HR Core's `Notification.referenceType / referenceId` already uses (010-notifications data-model.md). Alternative considered: a discriminator enum on `subjectType` — rejected because `Feedback.feedbackType` (the `FeedbackType` enum) already encodes the channel; double-encoding invites drift.

9. **Exit survey anonymity column shape** — The CLAUDE.md §10 contract: `ExitSurveyResponse` has no `employeeId`; `ExitSurvey.respondentId` is nullable and nulled on completion. **Decision**: schema-level enforcement. `ExitSurveyResponse` simply does not define an `employeeId` column. `ExitSurvey.respondentId String?` (no Prisma relation). Rationale: trust contract — anonymity that depends on application filters is one bug away from a leak. Alternative considered: keep the column but soft-redact in API responses — rejected; the schema is the strongest guarantee.

10. **Where to document Social-specific env vars** — Root `.env.example` already includes `SOCIAL_DATABASE_URL`, `SOCIAL_PORT`, `HR_CORE_URL`. The new var is `HR_CORE_EMPLOYEE_CACHE_TTL_MS`. **Decision**: add the cache TTL var to the root `.env.example` under the existing Social section AND create `apps/social/.env.example` mirroring the Social subset of the root file. Rationale: matches HR Core's convention (it has `apps/hr-core/.env.example` too — see IAM feature) so a developer can copy directly into the service folder. Alternative considered: skip the per-service file — rejected; new developers expect a per-app template.

11. **Diagnostic routes for verification, then delete** — Spec stories US2 and US4 instruct a temporary `GET /scaffold-ping` route + a temporary `eventBus.emit('scaffold.ping')` call to prove the wiring. **Decision**: implement both as a Jest test, not in production source. The Jest test boots `AppModule` via `Test.createTestingModule`, registers a one-shot controller decorated `@Roles('EMPLOYEE')`, hits it with three tokens (none, employee, system) and asserts 401 / 200 / 403 respectively. EventBus emit lives in the same test. Rationale: zero production-source pollution; verifies the same invariants. Alternative considered: ship and then revert the diagnostic route in a follow-up commit — rejected as fragile (git history would carry the dead code and a hurried revert could leave it in).

12. **Generated Prisma client output path & `.gitignore`** — HR Core generates to `apps/hr-core/src/generated/prisma`. **Decision**: identical pattern for Social — `apps/social/src/generated/prisma/`. Verified that `**/generated/**` is already ignored at the repo root. Rationale: parity, and the existing ignore covers Social by glob.

13. **Migration baseline against a non-empty DB** — Developers may have a dev DB that already has `social` schema from feature 002 but no Social tables. **Decision**: the migration creates tables but never touches the schema itself (the `social` schema is assumed to exist; `init-schemas.sql` created it). If a developer somehow ran a pre-migration `CREATE TABLE social.*` by hand, `prisma migrate dev` will detect drift and refuse. Rationale: Prisma's drift detection is the correct safety net. Alternative considered: `CREATE TABLE IF NOT EXISTS` in the SQL — rejected; Prisma owns the migration.

**Output**: `research.md` carrying these 13 decisions in Decision / Rationale / Alternatives form.

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete.

### 1.1 Data model → `data-model.md`

Single file `apps/social/prisma/schema.prisma` declares:

- **8 models**, all `@@schema("social")` with `@@map` snake_case names:
  `Announcement` → `announcements`,
  `Event` → `events`,
  `EventAttendee` → `event_attendees`,
  `Document` → `documents`,
  `Feedback` → `feedback`,
  `EngagementSnapshot` → `engagement_snapshots`,
  `ExitSurvey` → `exit_surveys`,
  `ExitSurveyResponse` → `exit_survey_responses`.

- **8 Prisma enums** (also `@@schema("social")`):
  `Audience`, `EventType`, `RsvpStatus`, `DocumentCategory`, `SentimentLabel`, `FeedbackType`, `ExitSurveyStatus`, `ExitSurveyQuestionKey`.

- **Audit columns**: `id String @id @default(uuid())`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` on every model **except** `EventAttendee` and `ExitSurveyResponse` (which keep only `createdAt` — immutable join / response rows).

- **Exactly one intra-schema relation**: `ExitSurveyResponse.surveyId → ExitSurvey.id` with `onDelete: Cascade`. All HR Core references (`authorId`, `organizerId`, `employeeId`, `uploadedById`, `generatedById`, `respondentId`) are plain `String` UUIDs with no Prisma relation and no DB-level FK.

- **Indexes** (10):
  1. `@@index([audience, publishedAt(sort: Desc)])` on `Announcement`
  2. `@@index([eventType, startAt(sort: Desc)])` on `Event`
  3. `@@index([eventId])` on `EventAttendee` (plus `@@unique([eventId, employeeId])`)
  4. `@@index([category, createdAt(sort: Desc)])` on `Document`
  5. `@@index([subjectType, subjectId])` on `Feedback`
  6. `@@index([isAnonymous])` on `Feedback`
  7. `@@index([scopeType, scopeId, periodStart])` on `EngagementSnapshot`
  8. `@@index([status])` on `ExitSurvey`
  9. `@@index([expiresAt])` on `ExitSurvey`
 10. `@@index([surveyId, questionKey])` on `ExitSurveyResponse`

- **One migration** `20260520000000_init_social_scaffold/migration.sql` carrying the `CREATE TYPE`s and `CREATE TABLE`s in dependency order (`ExitSurvey` before `ExitSurveyResponse`).

State transitions documented for `ExitSurveyStatus`:
```
PENDING → SENT → COMPLETED   (happy path, respondentId nulled at COMPLETED)
PENDING → CANCELLED          (HR admin cancels before SENT)
SENT    → EXPIRED            (cron flips after expiresAt elapses)
SENT    → CANCELLED          (HR admin cancels after SENT — rare)
COMPLETED / CANCELLED / EXPIRED → (terminal)
```
Enforcement of these transitions is feature-module responsibility — the scaffold only provides the column shape.

### 1.2 HrCoreClient contract → `contracts/hr-core-client.md`

```ts
// apps/social/src/common/clients/employee-ref.interface.ts
export interface EmployeeRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  departmentId: string;
  teamId: string | null;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'PROBATION' | 'TERMINATED';
}

// apps/social/src/common/clients/hr-core.client.ts
@Injectable()
export class HrCoreClient {
  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.getOrThrow<string>('HR_CORE_URL');
    this.cacheTtlMs = this.config.get<number>('HR_CORE_EMPLOYEE_CACHE_TTL_MS') ?? 60_000;
    this.http = axios.create({ baseURL: this.baseUrl, timeout: 5_000 });
  }

  async getEmployeeRef(
    id: string,
    context: { jwt: string; correlationId?: string },
  ): Promise<EmployeeRef> { /* ... */ }
}
```

Behavior contracts (verified by unit tests):

| Scenario | Behavior |
|---|---|
| First call for id `X` within TTL | Issues `GET ${HR_CORE_URL}/employees/X` with headers `Authorization: Bearer <jwt>` + `x-correlation-id: <id>`; caches the response. |
| Second call for id `X` within TTL | Returns cached value; **no** outbound HTTP. |
| First call for id `X` after TTL elapsed | Refetches and updates cache. |
| HR Core returns `200` with body not matching `EmployeeRef` shape | Throws `InternalServerErrorException('HrCoreClient: unexpected /employees/:id response shape')`. |
| HR Core returns `401` | Throws `UnauthorizedException` (re-thrown — caller's JWT was rejected). |
| HR Core returns `403` | Throws `ForbiddenException`. |
| HR Core returns `404` | Throws `NotFoundException('Employee <id> not found in HR Core')`. |
| HR Core returns `5xx` or `axios` network error | Throws `ServiceUnavailableException('HR Core unreachable')`. The original error is logged via `Logger.error()` with the correlation id. |

The client never logs the JWT body. It logs only the `(method, url, correlationId, status, durationMs)` tuple.

### 1.3 Auth wiring → `contracts/auth-wiring.md`

`apps/social/src/app.module.ts` providers (in this order):

```ts
providers: [
  AppService,
  { provide: APP_GUARD, useClass: ThrottlerGuard },   // existing
  { provide: APP_GUARD, useClass: SharedJwtGuard },   // NEW — global JWT verification
  { provide: APP_GUARD, useClass: RbacGuard },        // NEW — @Roles enforcement
],
```

`@Public()` from `@sentient/shared` is honored by `SharedJwtGuard` and exempts the decorated route. The only public route in this scaffold is `/health`. `RbacGuard` short-circuits when no `@Roles` decorator is present on the handler (i.e., RBAC opts-in via the decorator).

SYSTEM-JWT acceptance is delegated entirely to `SharedJwtGuard`'s existing logic, which already validates against `SYSTEM_JWT_SECRET` when the token carries `roles: ['SYSTEM']`. `RbacGuard` then enforces that only handlers declaring `@Roles('SYSTEM')` (none in this scaffold) admit such tokens.

### 1.4 EventBus contract → `contracts/event-bus.md`

```ts
// apps/social/src/common/event-bus/event-bus.module.ts
@Global()
@Module({
  providers: [{ provide: EVENT_BUS, useClass: InMemoryEventBus }],
  exports: [EVENT_BUS],
})
export class EventBusModule {}

// apps/social/src/common/event-bus/in-memory-event-bus.ts
// Same implementation as apps/hr-core/src/common/event-bus/in-memory-event-bus.ts.
```

Consumers inject `@Inject(EVENT_BUS) eventBus: IEventBus`. The `source` field on every Social-emitted `DomainEvent` MUST be the literal `'social'` (per FR-031, future feature modules respect this). The scaffold itself emits no real events.

### 1.5 Health endpoint contract → `contracts/health-endpoint.md`

```ts
@Controller()
export class AppController {
  @Get('health')
  @Public()
  health(): { status: 'ok'; service: 'social'; timestamp: string } {
    return { status: 'ok', service: 'social', timestamp: new Date().toISOString() };
  }
}
```

Response body (status `200`):
```json
{ "status": "ok", "service": "social", "timestamp": "2026-05-19T12:00:00.000Z" }
```

### 1.6 Environment vars contract → `contracts/environment-vars.md`

| Variable | Required | Default | Source | Used by |
|---|---|---|---|---|
| `SOCIAL_DATABASE_URL` | Yes | — | `apps/social/.env` | `PrismaService` (Social) |
| `SOCIAL_PORT` | No | `3002` | `apps/social/.env` | `main.ts` |
| `JWT_SECRET` | Yes | — | `apps/social/.env` | `SharedJwtGuard` |
| `SYSTEM_JWT_SECRET` | Yes | — | `apps/social/.env` | `SharedJwtGuard` (SYSTEM tokens) |
| `HR_CORE_URL` | Yes | — | `apps/social/.env` | `HrCoreClient` |
| `HR_CORE_EMPLOYEE_CACHE_TTL_MS` | No | `60000` | `apps/social/.env` | `HrCoreClient` cache |
| `FRONTEND_URL` | No | `http://localhost:3000` | `apps/social/.env` | CORS allowlist |
| `THROTTLE_TTL` | No | `60000` | `apps/social/.env` | `ThrottlerModule` |
| `THROTTLE_LIMIT` | No | `100` | `apps/social/.env` | `ThrottlerModule` |
| `REQUEST_TIMEOUT_MS` | No | `30000` | `apps/social/.env` | `TimeoutInterceptor` |

Missing-var behavior: `SOCIAL_DATABASE_URL`, `JWT_SECRET`, `SYSTEM_JWT_SECRET`, `HR_CORE_URL` use `ConfigService.getOrThrow(...)` so absence fails fast at startup (SC-007). Defaults above use `config.get(...)` with a literal fallback.

### 1.7 Quickstart → `quickstart.md`

A short walkthrough:

1. From repo root: `pnpm install` (axios already at workspace level via HR Core).
2. `pnpm --filter @sentient/shared build` (so the 4 new enums are visible to apps).
3. Ensure `docker compose up -d` is running and `scripts/init-schemas.sql` has been applied (creates the `social` schema).
4. `cp .env.example apps/social/.env` and fill `SOCIAL_DATABASE_URL`, `JWT_SECRET`, `SYSTEM_JWT_SECRET`, `HR_CORE_URL`.
5. `cd apps/social && npx prisma generate && npx prisma migrate dev --name init_social_scaffold`.
6. `cd ../.. && turbo dev --filter=social` — expect "Social service listening on port 3002".
7. `curl http://localhost:3002/health` → `200 { status: 'ok', service: 'social', timestamp: ... }`.
8. `curl -i http://localhost:3002/some-protected-route` → `401` (any non-existent route under the global guard returns 401 before reaching the 404 handler — proves the guard is active).
9. `turbo test --filter=social` — Jest suite passes (`HrCoreClient` unit tests + `AppController` smoke test).

### 1.8 Agent context update

Run `.specify/scripts/bash/update-agent-context.sh claude` after `data-model.md` and `contracts/*` are written; this adds the Social scaffold technology row ("Social microservice scaffold — Prisma 8 entities, HrCoreClient, EventBus, global auth guards") to `CLAUDE.md`'s **Recent Changes** without overwriting manual sections.

**Output**: `research.md`, `data-model.md`, `contracts/prisma-schema.md`, `contracts/hr-core-client.md`, `contracts/auth-wiring.md`, `contracts/event-bus.md`, `contracts/health-endpoint.md`, `contracts/environment-vars.md`, `quickstart.md`, plus the agent context update.

## Complexity Tracking

No Constitution Check violations. Two design choices that may look like complexity but are intentional and worth recording:

| Choice | Why it's not over-engineering |
|---|---|
| Local `EventBusModule` mirror instead of extracting to `@sentient/shared` | The shared package today exposes only the **interface** (`IEventBus`, `EVENT_BUS`, `DomainEvent`). HR Core's `InMemoryEventBus` is local to that app. Extracting it would force a coordinated PR touching HR Core's already-shipped behavior — out of scope for a Social-feature ticket. The mirrored implementation in `apps/social/src/common/event-bus/` is ~30 LOC and bit-identical to HR Core's, so divergence risk is low. The extraction is a clean follow-up. |
| Raw `axios` instance instead of `@nestjs/axios` `HttpModule` | `@nestjs/axios` wraps every call in an `Observable<>`. The codebase otherwise has zero RxJS usage; adopting it here would force `firstValueFrom` everywhere or train every consumer on Rx. The raw `axios.create({ baseURL, timeout })` pattern is two lines, dependency-free beyond what HR Core already drags in, and trivially mockable in unit tests. |
