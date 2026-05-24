---
description: "Task list for feature 012-social-scaffold"
---

# Tasks: Social Microservice Scaffold

**Input**: Design documents in `specs/012-social-scaffold/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/*`, `quickstart.md`

**Tests**: Generated where the spec explicitly requires diagnostic assertions (US2 negative-path matrix, US3 unit-test contract, US4 smoke test, US5 health e2e). No domain test suite — feature modules will add their own.

**Organization**: 5 user stories from `spec.md`. US1 & US2 are P1 (MVP). US3 & US4 are P2. US5 is P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different file, no dependency on an incomplete task)
- **[Story]**: maps to user story from `spec.md`
- Every task names exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Workspace-level preconditions for the Social scaffold.

- [x] T001 Verify `axios` ≥ 1.x is resolvable from `apps/social/` — if missing, add `"axios": "^1.7.0"` to `apps/social/package.json` dependencies and run `pnpm install` from repo root
- [x] T002 [P] Confirm the repo-root `.gitignore` already covers generated Prisma clients via a `**/generated/**` rule; if absent, add it so `apps/social/src/generated/prisma/` is never committed

**Checkpoint**: Workspace is ready to host the Social scaffold.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-story prerequisites — env-var documentation surfaces consumed by US3 (cache TTL var) and US5 (startup wiring). Must complete before US3 or US5.

- [x] T003 [P] Update root `.env.example` to add `HR_CORE_EMPLOYEE_CACHE_TTL_MS=60000` under the existing `# ── Social Service (apps/social/.env) ──` section and confirm `SOCIAL_DATABASE_URL`, `SOCIAL_PORT=3002`, `JWT_SECRET`, `SYSTEM_JWT_SECRET`, `HR_CORE_URL`, `FRONTEND_URL`, `THROTTLE_TTL`, `THROTTLE_LIMIT`, `REQUEST_TIMEOUT_MS` are present per `contracts/environment-vars.md`
- [x] T004 [P] Create new `apps/social/.env.example` mirroring the Social subset of the root template (every variable in `contracts/environment-vars.md` §1 + §2), so a developer can `cp apps/social/.env.example apps/social/.env` directly

**Checkpoint**: Env contract is documented in both surfaces. User-story phases can begin.

---

## Phase 3: User Story 1 — Social Service Has Its Full Persistence Foundation (Priority: P1) 🎯 MVP

**Goal**: Land the 8-entity Prisma schema, 8 Prisma enums, 10 indexes, and 4 new shared TypeScript enums so that every future Social feature module finds its persistence layer already in place.

**Independent Test** (per `spec.md` US1): After this story, `cd apps/social && npx prisma migrate dev` against a clean DB produces 8 tables under the `social` schema with snake_case names, 8 Postgres enums, and the generated client at `apps/social/src/generated/prisma`. Importing any of the 8 Social enums from `@sentient/shared` resolves in TypeScript.

### Implementation for User Story 1

- [x] T005 [P] [US1] Create `packages/shared/src/enums/audience.enum.ts` exporting `enum Audience` with values `COMPANY`, `DEPARTMENT`, `TEAM`, `ROLE`, `INDIVIDUAL` (string equality with the Prisma enum)
- [x] T006 [P] [US1] Create `packages/shared/src/enums/rsvp-status.enum.ts` exporting `enum RsvpStatus` with values `INVITED`, `ACCEPTED`, `DECLINED`, `TENTATIVE`, `ATTENDED`, `NO_SHOW`
- [x] T007 [P] [US1] Create `packages/shared/src/enums/sentiment-label.enum.ts` exporting `enum SentimentLabel` with values `POSITIVE`, `NEUTRAL`, `NEGATIVE`, `MIXED`
- [x] T008 [P] [US1] Create `packages/shared/src/enums/feedback-type.enum.ts` exporting `enum FeedbackType` with values `EVENT_FEEDBACK`, `ANNOUNCEMENT_FEEDBACK`, `GENERAL_FEEDBACK`, `MANAGER_FEEDBACK`, `PEER_FEEDBACK`
- [x] T009 [US1] Update `packages/shared/src/enums/index.ts` to re-export the four new enum files (`audience.enum`, `rsvp-status.enum`, `sentiment-label.enum`, `feedback-type.enum`); leave existing exports untouched
- [x] T010 [US1] Run `pnpm --filter @sentient/shared build` from repo root so `@sentient/shared` dist artifacts include the new enums and consuming apps can resolve them
- [x] T011 [US1] Replace the contents of `apps/social/prisma/schema.prisma` with the canonical schema from `data-model.md`: datasource block (`schemas = ["social"]`, `url = env("SOCIAL_DATABASE_URL")`), generator block (`output = "../src/generated/prisma"`, `previewFeatures = ["multiSchema"]`), 8 `@@schema("social")` enums (`Audience`, `EventType`, `RsvpStatus`, `DocumentCategory`, `SentimentLabel`, `FeedbackType`, `ExitSurveyStatus`, `ExitSurveyQuestionKey`), and 8 models with `@@schema("social")` + `@@map(<snake_case>)` (`Announcement`, `Event`, `EventAttendee`, `Document`, `Feedback`, `EngagementSnapshot`, `ExitSurvey`, `ExitSurveyResponse`) — including the two intra-schema relations (`EventAttendee.event`, `ExitSurveyResponse.survey`, both `onDelete: Cascade`), the 10 indexes per `data-model.md` §"Index summary", and the audit columns (`createdAt`/`updatedAt` on all models except `EventAttendee` and `ExitSurveyResponse` which keep only `createdAt`)
- [x] T012 [US1] From `apps/social/`, run `npx prisma generate` and confirm the Prisma client compiles into `apps/social/src/generated/prisma/` without errors
- [x] T013 [US1] From `apps/social/`, run `npx prisma migrate dev --name init_social_scaffold` against a database where the `social` schema and `social_svc` role already exist; confirm exactly one new migration directory `apps/social/prisma/migrations/<timestamp>_init_social_scaffold/migration.sql` is created and committed
- [x] T014 [US1] Open `apps/social/prisma/migrations/<timestamp>_init_social_scaffold/migration.sql` and grep the `CREATE TABLE "social"."exit_survey_responses"` block for `employee_id|respondent_id|user_id`; verify zero hits (anonymity-by-shape per `contracts/prisma-schema.md` §7); also verify no `CREATE SCHEMA` or `GRANT`/`REVOKE` statements are present (those belong to feature 002)

**Checkpoint**: User Story 1 is complete. A future feature module can `import { LeaveStatus, Audience, FeedbackType } from '@sentient/shared'` and `prisma.announcement.create({ … })` without further wiring.

---

## Phase 4: User Story 2 — Social Authenticates and Authorizes Requests Like HR Core (Priority: P1) 🎯 MVP

**Goal**: Bind `SharedJwtGuard` + `RbacGuard` globally so every controller is authenticated by default; `/health` opts out via `@Public()`; SYSTEM JWTs validate via the existing `SharedJwtGuard` logic and are gated by `@Roles('SYSTEM')`.

**Independent Test** (per `spec.md` US2): Boot Social, hit any non-`/health` route without `Authorization` → 401. With a tampered token → 401. With a valid `EMPLOYEE` token against a `@Roles('EMPLOYEE')` test route → 200. With a SYSTEM token against the same test route → 403.

### Implementation for User Story 2

- [x] T015 [US2] Edit `apps/social/src/app.module.ts` to register two new `APP_GUARD` providers AFTER the existing `ThrottlerGuard` provider — first `{ provide: APP_GUARD, useClass: SharedJwtGuard }`, then `{ provide: APP_GUARD, useClass: RbacGuard }` (both imported from `@sentient/shared`); leave `ThrottlerGuard` in its current position so guard order is Throttler → SharedJwt → Rbac per `contracts/auth-wiring.md` §1
- [x] T016 [US2] Edit `apps/social/src/app.controller.ts` so the existing `/health` handler is decorated with `@Public()` from `@sentient/shared` (in addition to its existing `@Get('health')` decorator) — this is the single opt-out the scaffold ships
- [x] T017 [P] [US2] Create `apps/social/src/common/__smoke__/auth-wiring.spec.ts` that uses `Test.createTestingModule({ imports: [AppModule] })` plus a test-only inline `@Controller('scaffold-ping')` with one `@Get() @Roles('EMPLOYEE')` handler, and asserts the matrix in `contracts/auth-wiring.md` §5: no `Authorization` → 401, tampered token → 401, valid `EMPLOYEE` JWT → 200, SYSTEM JWT → 403, `GET /health` (no auth) → 200

**Checkpoint**: User Story 2 is complete. The auth wall is in place; future feature modules add their `@Roles(...)` decorators on their own controllers and inherit the guard chain.

---

## Phase 5: User Story 3 — Social Can Validate Employee References Against HR Core (Priority: P2)

**Goal**: Provide a typed, injectable, JWT-forwarding, in-process-cached `HrCoreClient` so future Social modules call `getEmployeeRef(id, context)` instead of reinventing the HTTP call.

**Independent Test** (per `spec.md` US3): `getEmployeeRef(known-id, context)` returns the `EmployeeRef` shape; called twice within 60 s only one outbound HTTP request lands on HR Core; called with an unknown id throws `NotFoundException` naming the id and HR Core as the source.

### Implementation for User Story 3

- [x] T018 [P] [US3] Create `apps/social/src/common/clients/employee-ref.interface.ts` exporting `interface EmployeeRef` (id, firstName, lastName, email, employeeCode, departmentId, teamId nullable, employmentStatus union) and `interface HrCoreCallContext` (jwt, optional correlationId) per `contracts/hr-core-client.md` §2
- [x] T019 [US3] Create `apps/social/src/common/clients/hr-core.client.ts` declaring `@Injectable() class HrCoreClient` with: constructor reading `HR_CORE_URL` via `ConfigService.getOrThrow` and `HR_CORE_EMPLOYEE_CACHE_TTL_MS` via `ConfigService.get(..., 60_000)`; an `axios.create({ baseURL, timeout: 5_000 })` instance; an in-process `Map<string, { value: EmployeeRef; expiresAt: number }>` cache; an `isEmployeeRef(raw: unknown): raw is EmployeeRef` type guard (no `as unknown as` casts); a public `getEmployeeRef(id, context)` method that forwards `Authorization: Bearer ${context.jwt}`, propagates `x-correlation-id` when provided, sets `Accept: application/json`, maps responses 401→`UnauthorizedException`, 403→`ForbiddenException`, 404→`NotFoundException`, 5xx/network→`ServiceUnavailableException`, shape mismatch→`InternalServerErrorException`, logs `(method, url, correlationId, statusOrCode, durationMs)` via `Logger.error()` (NEVER the JWT body), and a `__resetCache()` `@internal` test hook
- [x] T020 [US3] Create `apps/social/src/common/clients/clients.module.ts` as `@Global() @Module({ providers: [HrCoreClient], exports: [HrCoreClient] })` with `export class ClientsModule {}` per `contracts/hr-core-client.md` §8
- [x] T021 [US3] Edit `apps/social/src/app.module.ts` to add `ClientsModule` to its `imports` array (keep alphabetical/grouped ordering consistent with the existing imports)
- [x] T022 [P] [US3] Create `apps/social/src/common/clients/hr-core.client.spec.ts` covering every scenario in `contracts/hr-core-client.md` §9: happy path returns parsed `EmployeeRef`, cache hit issues zero new HTTP calls (assert with `jest.fn().mock.calls.length`), cache expiry refetches after TTL elapses (`jest.useFakeTimers()` + `jest.advanceTimersByTime`), error mapping for 401/403/404/500/network (`ECONNREFUSED`), header forwarding (`Authorization: Bearer <jwt>` + `x-correlation-id: <id>` received exactly once), shape rejection (200 with missing `email` throws `InternalServerErrorException`), JWT-redaction (`Logger.error` spy receives no string containing the JWT body)

**Checkpoint**: User Story 3 is complete. Any feature module can `constructor(private hrCore: HrCoreClient)` and validate cross-service employee references.

---

## Phase 6: User Story 4 — Social Can Publish and Consume Domain Events (Priority: P2)

**Goal**: Bind the shared `EVENT_BUS` token to a Social-local `InMemoryEventBus` that mirrors HR Core's implementation, so future feature modules `@Inject(EVENT_BUS) eventBus: IEventBus` and emit / subscribe via the catalog in CLAUDE.md §3.4.

**Independent Test** (per `spec.md` US4): Resolving `EVENT_BUS` from `AppModule` returns a working `IEventBus`; calling `eventBus.emit({ id, type: 'scaffold.ping', source: 'social', timestamp: new Date(), payload: { ok: true }, metadata: { correlationId } })` resolves without throwing.

### Implementation for User Story 4

- [x] T023 [P] [US4] Create `apps/social/src/common/event-bus/in-memory-event-bus.ts` containing `@Injectable() class InMemoryEventBus implements IEventBus` with a private `Logger`, a private `Map<string, Array<(event: DomainEvent) => Promise<void>>> handlers`, an `async emit<T>(event: DomainEvent<T>): Promise<void>` that logs `[EVENT] ${event.type} | source=${event.source} | id=${event.id} | payload=${JSON.stringify(event.payload)}` and awaits all registered handlers, and a `subscribe<T>(eventType, handler)` that appends to the per-type handler list — byte-equivalent in behavior to `apps/hr-core/src/common/event-bus/in-memory-event-bus.ts`
- [x] T024 [US4] Create `apps/social/src/common/event-bus/event-bus.module.ts` as `@Global() @Module({ providers: [{ provide: EVENT_BUS, useClass: InMemoryEventBus }], exports: [EVENT_BUS] })` with `export class EventBusModule {}`, importing `EVENT_BUS` and `IEventBus` from `@sentient/shared` (no Social-local re-declaration of the symbol)
- [x] T025 [US4] Edit `apps/social/src/app.module.ts` to add `EventBusModule` (the local `./common/event-bus/event-bus.module` one) to its `imports` array
- [x] T026 [P] [US4] Create `apps/social/src/common/__smoke__/event-bus.spec.ts` that calls `Test.createTestingModule({ imports: [AppModule] }).compile()`, resolves `moduleRef.get<IEventBus>(EVENT_BUS)`, and asserts the diagnostic emit `bus.emit({ id: 'test-uuid', type: 'scaffold.ping', source: 'social', timestamp: new Date(), payload: { ok: true }, metadata: { correlationId: 'test-corr' } })` resolves to undefined per `contracts/event-bus.md` §5

**Checkpoint**: User Story 4 is complete. The EventBus is available across Social; subsequent feature modules emit `announcement.published`, `event.created`, `feedback.submitted`, etc. without further wiring.

---

## Phase 7: User Story 5 — Social Service Boots, Reports Health, and Documents Itself (Priority: P3)

**Goal**: Ensure Social boots predictably, logs a clear startup line, exposes `GET /health` with the canonical response shape (no auth required), serves Swagger at `/api/docs`, and fails fast when required env vars are missing.

**Independent Test** (per `spec.md` US5): `turbo dev --filter=social` logs "Social service listening on port 3002"; `curl http://localhost:3002/health` returns 200 + `{ status: 'ok', service: 'social', timestamp: <ISO> }` without `Authorization`; `http://localhost:3002/api/docs` renders Swagger UI; removing `SOCIAL_DATABASE_URL` causes a clear single-line startup error naming the missing variable within 5 s.

### Implementation for User Story 5

- [x] T027 [US5] Edit `apps/social/src/app.controller.ts` so the `/health` handler returns exactly `{ status: 'ok' as const, service: 'social' as const, timestamp: new Date().toISOString() }` with an explicit return type `{ status: 'ok'; service: 'social'; timestamp: string }` per `contracts/health-endpoint.md` (remove any pre-existing `GET /` greeter handler that would conflict with the global guard)
- [x] T028 [P] [US5] Create `apps/social/test/app.e2e-spec.ts` that boots `AppModule` via `Test.createTestingModule`, calls `supertest(app.getHttpServer()).get('/health')`, and asserts `status === 200`, `body.status === 'ok'`, `body.service === 'social'`, `typeof body.timestamp === 'string'`, and the `Date.parse(body.timestamp)` is finite
- [x] T029 [US5] Audit `apps/social/src/main.ts` to confirm: `helmet`, `morgan`, the global `ValidationPipe({ whitelist, forbidNonWhitelisted, transform: true })`, the global `HttpExceptionFilter`, the global `TimeoutInterceptor`, CORS with `origin: configService.get('FRONTEND_URL', 'http://localhost:3000')` + `credentials: true`, and Swagger at `/api/docs` with `BearerAuth` security scheme are all already wired; `app.listen(configService.get('SOCIAL_PORT', 3002))` and the startup log line are present; make no changes if the wiring matches `contracts/environment-vars.md` and the spec FR-034
- [x] T030 [P] [US5] Confirm `apps/social/src/prisma/prisma.service.ts` and `apps/social/src/main.ts` use `ConfigService.getOrThrow('SOCIAL_DATABASE_URL')`, `ConfigService.getOrThrow('JWT_SECRET')`, `ConfigService.getOrThrow('SYSTEM_JWT_SECRET')` (no `process.env.*` reads in production code); add a manual or test-driven smoke (run `SOCIAL_DATABASE_URL='' turbo dev --filter=social` once locally) to confirm the process exits with code 1 and prints a single clear error line naming the missing variable within 5 s per SC-007

**Checkpoint**: User Story 5 is complete. Social boots cleanly, `/health` is exempt from auth, Swagger UI is reachable, and missing env vars produce a fail-fast startup error.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verify the scaffold across all stories before declaring `012-social-scaffold` shipped.

- [x] T031 [P] Run `turbo build --filter=@sentient/shared` and `turbo build --filter=social` from repo root; assert zero TypeScript errors (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` all on per `tsconfig.base.json`)
- [x] T032 [P] Run `turbo test --filter=social` from repo root; assert all unit, smoke (`auth-wiring.spec.ts`, `event-bus.spec.ts`, `hr-core.client.spec.ts`), and e2e (`app.e2e-spec.ts`) tests pass
- [x] T033 Execute the 11-step `quickstart.md` walkthrough end-to-end on a clean local DB (`docker compose down -v && docker compose up -d && psql -f scripts/init-schemas.sql && pnpm install && pnpm --filter @sentient/shared build && cd apps/social && npx prisma migrate dev --name init_social_scaffold && cd ../.. && turbo dev --filter=social`); assert `curl http://localhost:3002/health` returns 200 with the canonical body, `curl -i http://localhost:3002/anything-else` returns 401, and `http://localhost:3002/api/docs` renders Swagger UI
- [x] T034 [P] Update `AGENTS.md` → `## Recent Changes` with a single one-line entry for this feature (Social scaffold landed — Prisma 8-entity schema, HrCoreClient with in-process cache, SharedJwtGuard + RbacGuard global wiring, local EventBusModule mirror, /health endpoint, env templates) prefixed `[claude]` per `.claude/CLAUDE.md` §16

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 may block T013/T019/T022 if `axios` is genuinely missing; otherwise no blockers.
- **Phase 2 (Foundational)**: T003 + T004 must be done before T030's missing-var smoke is meaningful. Independent of T005–T026.
- **Phase 3 (US1 / Prisma)**: T011 depends on T009 + T010 (shared enums must be built so Prisma's enum-equality check passes when its values are later cross-referenced). T012 depends on T011. T013 depends on T012. T014 depends on T013.
- **Phase 4 (US2 / Auth)**: T015 modifies `app.module.ts`; T016 modifies `app.controller.ts`; T017 boots `AppModule` and so depends on T015 + T016.
- **Phase 5 (US3 / HrCoreClient)**: T019 depends on T018 (`EmployeeRef` interface). T020 depends on T019. T021 depends on T020. T022 depends on T019.
- **Phase 6 (US4 / EventBus)**: T024 depends on T023. T025 depends on T024. T026 depends on T025.
- **Phase 7 (US5 / Boot/Health)**: T028 depends on T027.
- **Phase 8 (Polish)**: All depend on Phases 3–7 being complete.

### User Story Dependencies

Stories US1, US2, US3, US4, US5 are **independent pillars** with one shared touchpoint: `apps/social/src/app.module.ts` (US2 adds 2 guards, US3 adds `ClientsModule` import, US4 adds `EventBusModule` import). If two developers work the same file simultaneously they must coordinate; otherwise stories ship in any order. The MVP-recommended order is US1 → US2 → US3 → US4 → US5 (matches `spec.md` priority).

### Within Each User Story

- US1: shared enums (T005–T009 parallel) → build (T010) → schema (T011) → generate (T012) → migrate (T013) → verify migration (T014).
- US2: providers (T015) + decorator (T016) parallelizable → smoke (T017).
- US3: interface (T018) → client (T019) → module (T020) → wire (T021) → unit tests (T022 parallel with T020/T021).
- US4: implementation (T023) → module (T024) → wire (T025) → smoke (T026).
- US5: controller (T027) → e2e (T028) + audits (T029, T030 parallel).

### Parallel Opportunities

- **Setup**: T002 in parallel with T001.
- **Foundational**: T003 ‖ T004.
- **US1**: T005 ‖ T006 ‖ T007 ‖ T008 (four different new files).
- **US3**: T018 first, then T019 + T022 can be authored concurrently (different files); T020 and T021 are linear after T019.
- **US4**: T023 standalone; T026 after T025.
- **US5**: T028 ‖ T029 ‖ T030 after T027.
- **Polish**: T031 ‖ T032 ‖ T034; T033 sequential after all others.

---

## Parallel Example: User Story 1 (Shared Enum Files)

```text
# Four developers / four agent slots can write these in parallel:
T005 [US1] packages/shared/src/enums/audience.enum.ts
T006 [US1] packages/shared/src/enums/rsvp-status.enum.ts
T007 [US1] packages/shared/src/enums/sentiment-label.enum.ts
T008 [US1] packages/shared/src/enums/feedback-type.enum.ts

# Then converge on the barrel + build:
T009 [US1] packages/shared/src/enums/index.ts  (re-exports)
T010 [US1] pnpm --filter @sentient/shared build
```

## Parallel Example: User Story 3 (HrCoreClient)

```text
# T018 first (shape definition), then:
T019 [US3] apps/social/src/common/clients/hr-core.client.ts
T022 [US3] apps/social/src/common/clients/hr-core.client.spec.ts
# T020 + T021 follow once T019 lands.
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 — both P1)

1. Phase 1 (Setup) + Phase 2 (Foundational) → `axios` resolvable, env templates documented.
2. Phase 3 (US1) → Prisma schema + migrations + shared enums.
3. Phase 4 (US2) → guards bound globally + `@Public()` opt-out + auth-wiring smoke.
4. **STOP and VALIDATE**: A future feature module can now (a) `prisma.announcement.create(…)` and (b) protect its controller with `@Roles('HR_ADMIN')` and get a 403 for `EMPLOYEE` callers. MVP shipped.

### Incremental Delivery

1. MVP (US1 + US2) → ship.
2. Add US3 (HrCoreClient) → Social can validate `authorId` / `organizerId` / `uploadedById` against HR Core.
3. Add US4 (EventBus) → Social can emit / subscribe domain events.
4. Add US5 (Boot/Health/Swagger polish) → operational story complete.
5. Phase 8 → run quickstart end-to-end, declare scaffold shipped.

### Parallel Team Strategy

- Dev A: US1 (Prisma + shared enums) — touches `apps/social/prisma/` and `packages/shared/src/enums/`.
- Dev B: US2 (auth wiring) + US5 (health endpoint polish) — both touch `app.module.ts` / `app.controller.ts`, so the same dev avoids merge conflicts.
- Dev C: US3 (HrCoreClient) — touches `apps/social/src/common/clients/`.
- Dev D: US4 (EventBus) — touches `apps/social/src/common/event-bus/`.

All four converge on `apps/social/src/app.module.ts` for module imports — order one final commit to merge them sequentially: ClientsModule → EventBusModule → APP_GUARD additions.

---

## Notes

- `[P]` tasks edit different files and have no incomplete-dependency relationship.
- Every task names exact file paths so an implementing LLM (or human) can act without further context.
- Tests in this feature exist **only** because each contract explicitly demands a diagnostic assertion (US2 negative-path matrix, US3 unit-test contract per `contracts/hr-core-client.md` §9, US4 smoke test per `contracts/event-bus.md` §5, US5 `/health` e2e per `contracts/health-endpoint.md`). No domain test suite ships with this scaffold; feature modules add their own.
- Commit prefix convention per `.claude/CLAUDE.md` §16: `[claude]` for Claude Code, `[codex]` for Codex. Apply to every commit produced for this feature.
- Stop at any checkpoint to validate the story independently before continuing.
