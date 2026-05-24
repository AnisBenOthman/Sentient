# Research: API Gateway Service

## Decision: Implement the gateway as a dedicated NestJS app

**Rationale**: HR Core, Social, and AI Agentic are already NestJS services. A dedicated `apps/api-gateway` service keeps the public edge concern separate from domain logic while reusing the repo's TypeScript, NestJS, Jest, Swagger, and Turborepo conventions.

**Alternatives considered**:
- Add gateway behavior to HR Core: rejected because HR Core would become both a domain service and edge router.
- Use Kong, Traefik, or Nginx only: rejected for v1 because the spec requires central JWT validation, standardized JSON envelopes, typed config, and tests inside the monorepo.
- Use a paid gateway/SaaS: rejected by the "free open source tools" constraint.

## Decision: Use a Node `http`/`https` streaming proxy inside the Nest Express app

**Rationale**: The gateway must pass multipart uploads, SSE, chunked responses, and AI streams without buffering. The implementation uses Node's built-in proxy primitives directly so the feature stays self-contained in the current lockfile while still rewriting `/api/hr/*` to downstream paths, preserving request streams, forwarding selected response headers, and attaching proxy error/timeout handling.

**Alternatives considered**:
- Axios/fetch forwarding: rejected because naive request/response body handling tends to buffer payloads and is risky for 50 MB uploads and SSE.
- `http-proxy-middleware`: accepted during planning, but replaced during implementation to avoid introducing a new dependency when the required streaming behavior is small and covered by focused e2e tests.
- Fastify adapter: rejected to minimize framework changes across the monorepo.

## Decision: Validate JWTs centrally with `jsonwebtoken`, then forward the original `Authorization` header

**Rationale**: Existing services already rely on JWT validation semantics and `jsonwebtoken` is already present in the workspace. The gateway performs the first validation pass, returns one standardized 401 envelope for missing/malformed/expired/invalid tokens, and forwards the original bearer token so downstream guards and RBAC continue unchanged.

**Alternatives considered**:
- Mint a new gateway token: rejected because FR-027 says token issuance remains in HR Core.
- Trust downstream guards only: rejected because the feature explicitly requires edge rejection and consistent frontend auth handling.

## Decision: Use a config-driven public route allow-list

**Rationale**: Public routes are a security-sensitive exception set. Keeping them in typed config makes signin/refresh/forgot-password/health/exit-survey scoped-token routes explicit and testable. Matchers should support method + path pattern so public POST signin does not accidentally imply broad public access to a whole service.

**Alternatives considered**:
- Controller decorators only: rejected because most proxied routes are not implemented as gateway controllers.
- Hard-code strings inside the guard: rejected because tests and environment-specific additions become brittle.

## Decision: Apply rate limits at the gateway with in-memory counters for v1

**Rationale**: A small Nest guard with in-memory counters satisfies the spec's v1 no-storage requirement without needing an extra store. The guard keys authenticated requests by JWT `sub` plus route bucket, and unauthenticated public requests by client IP plus route bucket. Per-route overrides are part of gateway route config.

**Alternatives considered**:
- Redis-backed throttling: deferred because FR-028 says optional shared cache later, not required for v1.
- Downstream per-service throttling: rejected because throttled traffic would still reach downstream services.

## Decision: Generate/preserve one correlation id per request in middleware

**Rationale**: A middleware runs before auth, throttling, proxying, and error filters. It can accept inbound `x-correlation-id` when valid, generate a UUID otherwise, attach it to request context, forward it upstream, echo it on responses, and include it in logs and envelopes.

**Alternatives considered**:
- Generate ids in interceptors only: rejected because proxy errors and early auth/rate-limit rejections need the id too.

## Decision: Normalize only gateway-originated failures and non-conforming upstream errors

**Rationale**: FR-003 requires upstream successful response shape to remain unchanged, and FR-018 requires preserving downstream HTTP status when the downstream already follows the standard envelope. The gateway should wrap gateway 401/404/413/429/502/504 responses and non-conforming downstream errors into `{ code, message, correlationId, details? }`, while leaving conforming downstream envelopes and all 2xx bodies intact.

**Alternatives considered**:
- Wrap every response: rejected because it would break existing frontend data contracts.
- Pass all upstream errors through raw: rejected because the feature requires one frontend error shape.

## Decision: Health probes downstream `/health` endpoints without fail-fast startup

**Rationale**: FR-025 says startup must succeed even if a downstream is temporarily unreachable. The gateway health endpoint can perform short-timeout probes to configured downstream health URLs and report `healthy` or `degraded` with per-service detail. Route requests to an unhealthy service should return 502/504 until recovery.

**Alternatives considered**:
- Fail startup when downstream URL is unreachable: rejected by FR-025.
- Cache health for long periods: rejected because local dev and recovery feedback should be quick.

## Decision: Aggregate API docs by fetching downstream OpenAPI JSON

**Rationale**: Existing services expose Swagger UIs at `api/docs`; Nest's Swagger setup also conventionally exposes JSON at `api/docs-json`. The gateway can provide a gateway docs page plus a `GET /api/docs-json` endpoint that merges or groups downstream specs by service. If a downstream docs JSON is unavailable, the page should still load and mark that service unavailable.

**Alternatives considered**:
- Manually maintain gateway OpenAPI for every downstream endpoint: rejected because it would drift.
- Skip docs aggregation: rejected by FR-023.

## Decision: Frontend uses one gateway base URL and one gateway-aware error extractor

**Rationale**: SC-001 and SC-008 require one backend origin and one error mapping site. `apps/web/src/lib/api/client.ts`, `social.ts`, `ai.ts`, notification SSE, and Vite proxy should all point to the gateway. A shared gateway error helper should understand `{ code, message, correlationId, details? }` and preserve typed service-level error code maps where needed.

**Alternatives considered**:
- Keep per-service env vars and rely on Vite proxy: rejected because distinct origins/configs remain.
- Page-level error parsing: rejected because the spec explicitly asks for frontend auth/error consistency.
