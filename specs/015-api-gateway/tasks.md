# Tasks: API Gateway Service

**Input**: Design documents from `/specs/015-api-gateway/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/gateway-api.yaml](./contracts/gateway-api.yaml), [quickstart.md](./quickstart.md)

**Tests**: Included because each user story defines independent test criteria and the gateway is a cross-cutting edge component.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after shared setup/foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase because it touches different files or has no dependency on incomplete tasks.
- **[Story]**: Maps to user stories from [spec.md](./spec.md): `[US1]` through `[US6]`.
- Every task includes exact repository-relative file paths.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the API Gateway app shell, workspace wiring, and environment configuration.

- [x] T001 Create the NestJS gateway package manifest with scripts and dependencies in `apps/api-gateway/package.json`
- [x] T002 [P] Create gateway TypeScript configs in `apps/api-gateway/tsconfig.json` and `apps/api-gateway/tsconfig.app.json`
- [x] T003 [P] Create gateway Nest CLI config in `apps/api-gateway/nest-cli.json`
- [x] T004 [P] Create gateway Jest config in `apps/api-gateway/package.json` or `apps/api-gateway/jest.config.ts`
- [x] T005 Add API Gateway environment variables and defaults to `.env.example`
- [x] T006 Add `apps/api-gateway` workspace/package references to `pnpm-workspace.yaml` and verify Turborepo picks up the package through `turbo.json`
- [x] T007 Create empty gateway source entry files in `apps/api-gateway/src/main.ts` and `apps/api-gateway/src/app.module.ts`
- [x] T008 [P] Create gateway test support directory and upstream test server helper stub in `apps/api-gateway/src/test-support/upstream-test-server.ts`
- [x] T009 Update development run documentation for the gateway port in `README.md`

**Checkpoint**: Gateway app shell exists and can be targeted by `pnpm --filter @sentient/api-gateway`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core typed config, shared error/context models, and app bootstrap needed before user-story implementation.

**CRITICAL**: No user story work should begin until this phase is complete.

- [x] T010 Define route, public route, rate-limit, health, and gateway config types in `apps/api-gateway/src/config/route-config.types.ts`
- [x] T011 Implement environment parsing and validation helpers in `apps/api-gateway/src/config/validation.ts`
- [x] T012 Implement gateway route configuration factory for HR, Social, and AI upstreams in `apps/api-gateway/src/config/gateway.config.ts`
- [x] T013 [P] Define standard error envelope interfaces and code constants in `apps/api-gateway/src/common/errors/error-envelope.ts`
- [x] T014 [P] Define JWT claims interface in `apps/api-gateway/src/common/auth/jwt-claims.interface.ts`
- [x] T015 [P] Define correlation context request augmentation in `apps/api-gateway/src/common/correlation/correlation-context.ts`
- [x] T016 Implement global gateway exception filter scaffold in `apps/api-gateway/src/common/errors/gateway-exception.filter.ts`
- [x] T017 Implement bootstrap with config, helmet, CORS, validation pipe, global filter, and port binding in `apps/api-gateway/src/main.ts`
- [x] T018 Wire `ConfigModule`, global providers, and initial module imports in `apps/api-gateway/src/app.module.ts`
- [x] T019 Add minimal app bootstrap/e2e smoke test in `apps/api-gateway/test/app.e2e-spec.ts`

**Checkpoint**: Foundation compiles, starts, and can emit gateway-owned error envelopes.

---

## Phase 3: User Story 1 - Single Public Entry Point for the Frontend (Priority: P1) MVP

**Goal**: Route all browser-facing `/api/hr/*`, `/api/social/*`, and `/api/ai/*` traffic through one gateway host while preserving upstream response body/status shape.

**Independent Test**: Point the SPA/dev proxy to the gateway and verify login, employee list, dashboard analytics, leave requests, announcements, documents upload/download, and AI conversation calls use one browser origin and still reach the correct downstream service.

### Tests for User Story 1

- [x] T020 [P] [US1] Add proxy contract/e2e tests for `/api/hr/*`, `/api/social/*`, `/api/ai/*`, response status/body preservation, and unmatched-route 404 in `apps/api-gateway/test/proxy.e2e-spec.ts`
- [x] T021 [P] [US1] Add frontend base-origin regression tests or type checks around API client base URLs in `apps/web/src/lib/api/client.ts`, `apps/web/src/lib/api/social.ts`, and `apps/web/src/lib/api/ai.ts`

### Implementation for User Story 1

- [x] T022 [P] [US1] Implement upstream response header allow-list policy in `apps/api-gateway/src/modules/proxy/header-policy.ts`
- [x] T023 [US1] Implement streaming proxy creation, prefix stripping, upstream timeout settings, and no-upstream 404 behavior in `apps/api-gateway/src/modules/proxy/proxy.service.ts`
- [x] T024 [US1] Implement catch-all proxy controller for `/api/hr/*`, `/api/social/*`, and `/api/ai/*` in `apps/api-gateway/src/modules/proxy/proxy.controller.ts`
- [x] T025 [US1] Wire proxy module exports/providers in `apps/api-gateway/src/modules/proxy/proxy.module.ts`
- [x] T026 [US1] Register `ProxyModule` in `apps/api-gateway/src/app.module.ts`
- [x] T027 [US1] Update HR API client to use the gateway base URL and `/api/hr` prefix in `apps/web/src/lib/api/client.ts`
- [x] T028 [US1] Update Social API client to use the gateway base URL and `/api/social` prefix in `apps/web/src/lib/api/social.ts`
- [x] T029 [US1] Update AI API client to use the gateway base URL and `/api/ai` prefix in `apps/web/src/lib/api/ai.ts`
- [x] T030 [US1] Update notification SSE client to use the gateway HR prefix in `apps/web/src/lib/notifications/sse-client.ts`
- [x] T031 [US1] Update Vite dev proxy to forward `/api/*` to the gateway on port 3004 in `apps/web/vite.config.ts`

**Checkpoint**: User Story 1 is fully functional and testable independently as the MVP.

---

## Phase 4: User Story 2 - Central JWT Validation with Consistent Rejection (Priority: P1)

**Goal**: Reject missing, malformed, expired, or invalid JWTs at the gateway before downstream services receive authenticated traffic, while forwarding valid tokens unchanged and allowing configured public routes.

**Independent Test**: Send missing, malformed, expired, invalid-signature, and valid JWTs to sampled authenticated routes; verify rejected requests return consistent 401 envelopes and never reach downstream services, while public routes forward without JWTs.

### Tests for User Story 2

- [x] T032 [P] [US2] Add JWT validation e2e tests for missing, malformed, expired, invalid-signature, valid-token, and public-route bypass cases in `apps/api-gateway/test/auth.e2e-spec.ts`
- [x] T033 [P] [US2] Add public route matcher unit tests for signin, refresh, forgot-password, health, docs, and exit-survey scoped-token patterns in `apps/api-gateway/src/common/auth/public-route.matcher.spec.ts`

### Implementation for User Story 2

- [x] T034 [US2] Implement method/path public route matching in `apps/api-gateway/src/common/auth/public-route.matcher.ts`
- [x] T035 [US2] Implement JWT verification, auth error-code mapping, user id extraction, and original header preservation in `apps/api-gateway/src/common/auth/gateway-jwt.guard.ts`
- [x] T036 [US2] Register the gateway JWT guard before proxy forwarding for authenticated routes in `apps/api-gateway/src/app.module.ts`
- [x] T037 [US2] Add default public allow-list entries to gateway config in `apps/api-gateway/src/config/gateway.config.ts`
- [x] T038 [US2] Centralize frontend 401 handling through the gateway HR refresh route in `apps/web/src/lib/api/client.ts`
- [x] T039 [US2] Remove duplicate Social refresh handling by routing Social 401s through the shared gateway-aware auth flow in `apps/web/src/lib/api/social.ts`

**Checkpoint**: User Stories 1 and 2 work independently, with central auth rejection at the edge.

---

## Phase 5: User Story 3 - Request Correlation ID Across Services (Priority: P2)

**Goal**: Generate or preserve one correlation id per request, forward it downstream, echo it on responses, and include it in gateway request logs.

**Independent Test**: Trigger a gateway request with and without `x-correlation-id`; verify the response header and upstream request header match, then grep gateway/downstream logs for the same id.

### Tests for User Story 3

- [x] T040 [P] [US3] Add correlation e2e tests for generated ids, preserved inbound ids, forwarded upstream ids, and response headers in `apps/api-gateway/test/correlation.e2e-spec.ts`
- [x] T041 [P] [US3] Add request logging tests that assert correlation id, method, path, route key, status, and latency fields in `apps/api-gateway/src/common/logging/request-logging.interceptor.spec.ts`

### Implementation for User Story 3

- [x] T042 [US3] Implement correlation middleware that creates request context and response headers in `apps/api-gateway/src/common/correlation/correlation.middleware.ts`
- [x] T043 [US3] Register correlation middleware for all routes in `apps/api-gateway/src/app.module.ts`
- [x] T044 [US3] Forward `x-correlation-id` from request context to upstream requests in `apps/api-gateway/src/modules/proxy/proxy.service.ts`
- [x] T045 [US3] Implement structured request logging interceptor in `apps/api-gateway/src/common/logging/request-logging.interceptor.ts`
- [x] T046 [US3] Register request logging interceptor globally in `apps/api-gateway/src/app.module.ts`

**Checkpoint**: Correlation is observable at the gateway and downstream boundaries.

---

## Phase 6: User Story 4 - Per-Client Rate Limiting at the Edge (Priority: P2)

**Goal**: Enforce configurable per-user and per-IP rate limits at the gateway with route-specific overrides and standard 429 responses.

**Independent Test**: Burst beyond the configured limit from one authenticated user and one unauthenticated public-route IP; verify 429 plus `Retry-After`, and verify throttled requests never reach downstream services.

### Tests for User Story 4

- [x] T047 [P] [US4] Add throttling e2e tests for authenticated per-user limits, public per-IP limits, route override limits, `Retry-After`, and downstream non-forwarding in `apps/api-gateway/test/throttling.e2e-spec.ts`
- [x] T048 [P] [US4] Add rate-limit key factory unit tests for user, IP, route key, and override key combinations in `apps/api-gateway/src/common/throttling/rate-limit-key.factory.spec.ts`

### Implementation for User Story 4

- [x] T049 [US4] Implement rate-limit key derivation in `apps/api-gateway/src/common/throttling/rate-limit-key.factory.ts`
- [x] T050 [US4] Implement gateway throttler guard with in-memory counters, route override lookup, and 429 envelope generation in `apps/api-gateway/src/common/throttling/gateway-throttler.guard.ts`
- [x] T051 [US4] Add default and override rate-limit config for signin, upload, and AI streaming routes in `apps/api-gateway/src/config/gateway.config.ts`
- [x] T052 [US4] Register throttling guard in the gateway request pipeline after JWT context extraction in `apps/api-gateway/src/app.module.ts`

**Checkpoint**: Rate limits are enforced before proxying and do not require persistent storage.

---

## Phase 7: User Story 5 - Consistent Structured Error Responses (Priority: P2)

**Goal**: Ensure gateway-generated failures, upstream connection failures, upstream timeouts, and non-conforming downstream errors all return the standard `{ code, message, correlationId, details? }` envelope.

**Independent Test**: Trigger 400, 401, 403, 404, 409, 413, 429, 500, 502, and 504 scenarios and confirm one response envelope shape with stable codes and correlation ids.

### Tests for User Story 5

- [x] T053 [P] [US5] Add gateway error envelope e2e tests for gateway-owned 404/413/500, upstream 502/504, and conforming downstream error preservation in `apps/api-gateway/test/errors.e2e-spec.ts`
- [x] T054 [P] [US5] Add upstream error mapper unit tests for conforming envelopes, non-conforming bodies, connection failures, and timeout failures in `apps/api-gateway/src/common/errors/upstream-error.mapper.spec.ts`
- [x] T055 [P] [US5] Add frontend gateway error extraction tests/type checks in `apps/web/src/lib/api/gateway-error.typecheck.ts`

### Implementation for User Story 5

- [x] T056 [US5] Implement upstream error classification and envelope mapping in `apps/api-gateway/src/common/errors/upstream-error.mapper.ts`
- [x] T057 [US5] Complete global gateway exception filter for standard envelopes and safe `details` handling in `apps/api-gateway/src/common/errors/gateway-exception.filter.ts`
- [x] T058 [US5] Add proxy error and timeout callbacks that emit 502/504 envelopes in `apps/api-gateway/src/modules/proxy/proxy.service.ts`
- [x] T059 [US5] Add request body size enforcement with 413 envelopes and upload route exceptions in `apps/api-gateway/src/modules/proxy/proxy.service.ts`
- [x] T060 [US5] Implement centralized frontend gateway error helper in `apps/web/src/lib/api/gateway-error.ts`
- [x] T061 [US5] Replace duplicated frontend service error extraction with the gateway error helper in `apps/web/src/lib/api/client.ts` and `apps/web/src/lib/api/social.ts`

**Checkpoint**: Frontend error handling can rely on one gateway-aware envelope parser.

---

## Phase 8: User Story 6 - Operational Visibility (Health + Aggregated API Docs) (Priority: P3)

**Goal**: Provide a public gateway health endpoint with downstream statuses and an aggregated documentation surface grouped by downstream service.

**Independent Test**: Call `/health` with all services up and with one downstream stopped, then open `/api/docs` and verify HR Core, Social, and AI Agentic docs are discoverable or marked unavailable.

### Tests for User Story 6

- [x] T062 [P] [US6] Add health e2e tests for healthy, degraded, unreachable downstream, and correlation header cases in `apps/api-gateway/test/health.e2e-spec.ts`
- [x] T063 [P] [US6] Add docs aggregation tests for available and unavailable downstream OpenAPI JSON sources in `apps/api-gateway/test/docs.e2e-spec.ts`

### Implementation for User Story 6

- [x] T064 [US6] Implement downstream health probe service with short timeouts and safe failure messages in `apps/api-gateway/src/modules/health/downstream-health.service.ts`
- [x] T065 [US6] Implement public health controller returning aggregate and per-service status in `apps/api-gateway/src/modules/health/health.controller.ts`
- [x] T066 [US6] Wire health module in `apps/api-gateway/src/modules/health/health.module.ts` and `apps/api-gateway/src/app.module.ts`
- [x] T067 [US6] Implement OpenAPI aggregation service that fetches and groups downstream docs JSON in `apps/api-gateway/src/modules/docs/openapi-aggregation.service.ts`
- [x] T068 [US6] Implement docs controller for `/api/docs` and `/api/docs-json` in `apps/api-gateway/src/modules/docs/docs.controller.ts`
- [x] T069 [US6] Wire docs module and Swagger setup in `apps/api-gateway/src/modules/docs/docs.module.ts` and `apps/api-gateway/src/main.ts`

**Checkpoint**: Operators and developers can inspect gateway/downstream status and docs from one public surface.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation, packaging, docs, and handoff updates across all stories.

- [x] T070 [P] Add API Gateway Dockerfile following existing service patterns in `apps/api-gateway/Dockerfile`
- [x] T071 Update `docker-compose.yml` to include the API Gateway service and expose port 3004
- [x] T072 [P] Update gateway quickstart and smoke instructions in `specs/015-api-gateway/quickstart.md`
- [x] T073 [P] Update API Gateway planning handoff in `AGENTS.md`
- [x] T074 Run gateway verification commands `pnpm --filter @sentient/api-gateway type-check`, `pnpm --filter @sentient/api-gateway test`, and `pnpm --filter @sentient/api-gateway build`
- [x] T075 Run frontend verification command `pnpm --filter @sentient/web type-check`
- [x] T076 Run downstream regression tests if shared auth/error helpers changed: `pnpm --filter @sentient/hr-core test`, `pnpm --filter @sentient/social test`, and `pnpm --filter @sentient/ai-agentic test` (not required; shared auth/error helpers unchanged)
- [ ] T077 Execute quickstart smoke flows for health, unknown route, missing JWT, public signin, authenticated proxy, rate limit, upload, SSE, and AI streaming from `specs/015-api-gateway/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundation; recommended MVP.
- **User Story 2 (Phase 4)**: Depends on Foundation and can be implemented alongside US1, but full browser validation benefits from US1 routing.
- **User Story 3 (Phase 5)**: Depends on Foundation; integrates with proxy/logging once US1 exists.
- **User Story 4 (Phase 6)**: Depends on Foundation and US2 user context for authenticated buckets.
- **User Story 5 (Phase 7)**: Depends on Foundation and should integrate with US1/US2/US4 error paths.
- **User Story 6 (Phase 8)**: Depends on Foundation; can run independently of proxy internals after config exists.
- **Polish (Phase 9)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: MVP entry-point routing; no dependency on other stories after Foundation.
- **US2 (P1)**: Central auth; no dependency on other stories after Foundation, but validates most naturally through US1 proxy routes.
- **US3 (P2)**: Correlation; can start after Foundation, then attach to US1 proxy.
- **US4 (P2)**: Rate limiting; depends on US2 for authenticated user ids, supports public IP buckets independently.
- **US5 (P2)**: Error envelope; builds on gateway errors plus proxy/auth/throttle errors from US1/US2/US4.
- **US6 (P3)**: Health/docs; can start after Foundation and route config.

### Within Each User Story

- Tests are listed before implementation tasks and should fail before implementation.
- Typed config/models before guards/services/controllers.
- Services before module wiring and frontend integration.
- Each checkpoint should be validated before moving to the next priority story.

### Parallel Opportunities

- Setup tasks T002, T003, T004, and T008 can run in parallel.
- Foundational interface/context tasks T013, T014, and T015 can run in parallel.
- Tests within each user story marked `[P]` can be written in parallel.
- US3 and US6 can proceed in parallel after Foundation because they touch distinct modules.
- US4 and US5 should coordinate on error envelope behavior but their initial tests and helpers can be drafted in parallel.

---

## Parallel Examples

### User Story 1

```bash
Task: "T020 [US1] Add proxy contract/e2e tests in apps/api-gateway/test/proxy.e2e-spec.ts"
Task: "T021 [US1] Add frontend base-origin regression tests/type checks in apps/web/src/lib/api/*.ts"
Task: "T022 [US1] Implement upstream response header allow-list policy in apps/api-gateway/src/modules/proxy/header-policy.ts"
```

### User Story 2

```bash
Task: "T032 [US2] Add JWT validation e2e tests in apps/api-gateway/test/auth.e2e-spec.ts"
Task: "T033 [US2] Add public route matcher unit tests in apps/api-gateway/src/common/auth/public-route.matcher.spec.ts"
```

### User Story 3

```bash
Task: "T040 [US3] Add correlation e2e tests in apps/api-gateway/test/correlation.e2e-spec.ts"
Task: "T041 [US3] Add request logging tests in apps/api-gateway/src/common/logging/request-logging.interceptor.spec.ts"
```

### User Story 4

```bash
Task: "T047 [US4] Add throttling e2e tests in apps/api-gateway/test/throttling.e2e-spec.ts"
Task: "T048 [US4] Add rate-limit key factory unit tests in apps/api-gateway/src/common/throttling/rate-limit-key.factory.spec.ts"
```

### User Story 5

```bash
Task: "T053 [US5] Add error envelope e2e tests in apps/api-gateway/test/errors.e2e-spec.ts"
Task: "T054 [US5] Add upstream error mapper unit tests in apps/api-gateway/src/common/errors/upstream-error.mapper.spec.ts"
Task: "T055 [US5] Add frontend gateway error extraction tests in apps/web/src/lib/api/gateway-error.test.ts"
```

### User Story 6

```bash
Task: "T062 [US6] Add health e2e tests in apps/api-gateway/test/health.e2e-spec.ts"
Task: "T063 [US6] Add docs aggregation tests in apps/api-gateway/test/docs.e2e-spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundation.
3. Complete Phase 3: US1 single public entry point.
4. Validate the SPA uses one browser origin and routes HR/Social/AI requests through the gateway.
5. Stop and demo the MVP before adding auth/rate/error polish.

### Security Increment (US2 Next)

1. Add central JWT validation and public-route bypasses.
2. Verify rejected auth requests never reach downstream services.
3. Confirm valid requests still forward the original `Authorization` header.

### Operational Hardening

1. Add correlation (US3), then rate limiting (US4), then full error normalization (US5).
2. Add health/docs visibility (US6).
3. Run the full quickstart smoke suite and package the gateway for local Compose.

### Parallel Team Strategy

With multiple implementers:

1. One engineer completes Setup/Foundation.
2. Engineer A implements US1 proxy/frontend migration.
3. Engineer B implements US2 auth and US4 throttling after auth context is available.
4. Engineer C implements US3 correlation and US6 health/docs.
5. Engineers coordinate on US5 error envelope integration before final verification.

---

## Summary

- **Total tasks**: 77
- **Setup tasks**: 9
- **Foundational tasks**: 10
- **US1 tasks**: 12
- **US2 tasks**: 8
- **US3 tasks**: 7
- **US4 tasks**: 6
- **US5 tasks**: 9
- **US6 tasks**: 8
- **Polish tasks**: 8
- **MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1)
