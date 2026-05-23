# Feature Specification: API Gateway Service

**Feature Branch**: `015-api-gateway`
**Created**: 2026-05-23
**Status**: Draft
**Input**: User description: "api gateway service, one public entry point, central JWT validation/request correlation/ rate limiting. cleaner routing, easy frontend auth/error handling consistency. nestjs app. always simple architecture and free open source tools"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single public entry point for the frontend (Priority: P1)

As a frontend application (and any external client), I need exactly ONE base URL to reach the entire Sentient platform. Today the SPA talks directly to three different services (HR Core, Social, AI Agentic) on three different ports, which means three CORS configurations, three sets of error shapes, and three URLs to keep in sync across environments. After the gateway lands, every browser request hits a single host and the gateway routes it to the correct downstream service.

**Why this priority**: This is the foundational change. Without a single entry point, every other gateway capability (central auth, central rate limiting, central error shape) becomes optional polish instead of an enforced guarantee. It also unlocks production deployment behind a single TLS certificate / domain name.

**Independent Test**: Reconfigure the frontend to use the gateway base URL only. Every existing page that previously worked against the three direct service URLs must continue to work without functional regression — login, employee list, dashboard analytics, leave requests, announcements, documents upload/download, AI conversations.

**Acceptance Scenarios**:

1. **Given** the gateway is running and HR Core / Social / AI Agentic are reachable behind it, **When** the frontend issues `GET /api/hr/employees`, **Then** the gateway forwards the call to HR Core and returns the upstream response unmodified in shape.
2. **Given** the gateway is running, **When** the frontend issues `GET /api/social/announcements`, **Then** the request reaches the Social service and returns its response.
3. **Given** the gateway is running, **When** the frontend issues `POST /api/ai/conversations`, **Then** the request reaches AI Agentic.
4. **Given** the frontend points only at the gateway host, **When** the developer inspects the Network tab, **Then** every request has the same origin (no per-service ports leaking into the browser).
5. **Given** a route is not mapped to any downstream service, **When** a client requests it, **Then** the gateway returns a structured 404 with a clear "no upstream" message and a correlation id.

---

### User Story 2 - Central JWT validation with consistent rejection (Priority: P1)

As a security-conscious platform owner, I want every authenticated request to be rejected at the edge if its token is missing, malformed, or expired — before it ever reaches a downstream service. Today each service runs its own `SharedJwtGuard`; the validation rules are correct but the rejection shape varies subtly and an expired token wastes one round-trip into the service before bouncing. Moving the first validation pass to the gateway means clients get a single, predictable 401 shape and downstreams only see traffic that already cleared the auth bar.

**Why this priority**: Authentication is the single most-touched cross-cutting concern in the platform — every page in the SPA depends on a consistent 401 → redirect-to-signin behavior. Centralizing it removes a whole class of "why does the dashboard handle 401 differently from the leaves page?" bugs.

**Independent Test**: Send requests with (a) no `Authorization` header, (b) a malformed token, (c) an expired token, (d) a valid token to any authenticated route. Verify the gateway returns 401 with an identical error body for (a)/(b)/(c) and forwards (d) to the correct downstream. Verify the downstream service never logs the rejected requests.

**Acceptance Scenarios**:

1. **Given** a request to an authenticated route with no `Authorization` header, **When** the gateway processes it, **Then** the gateway responds 401 with a standardized error body and the downstream service receives nothing.
2. **Given** a request with an expired JWT, **When** the gateway processes it, **Then** the response is 401 with the same error shape as case (1) and includes a code distinguishing "expired" from "missing".
3. **Given** a request with a valid JWT, **When** the gateway forwards it, **Then** the downstream service receives the original `Authorization` header and the request succeeds.
4. **Given** a public route (signin, exit-survey-respond by token, health), **When** a client calls it without a JWT, **Then** the gateway forwards the call without rejection.
5. **Given** the JWT-signing secret is rotated, **When** old tokens arrive, **Then** the gateway rejects them centrally and the SPA sees one redirect-to-signin trigger.

---

### User Story 3 - Request correlation ID across services (Priority: P2)

As an engineer debugging a multi-service workflow (for example, the AI Leave Agent calling HR Core, which emits an event to the notification bridge), I want every log line and every downstream call tied to one correlation id that the gateway generates at the edge. Today each service generates its own correlation id middleware, which means a single user action produces three uncorrelated id chains.

**Why this priority**: Correlation makes multi-service debugging tractable. It is not blocking for shipping the gateway but pays for itself the first time an incident spans two services. Pairs naturally with central auth.

**Independent Test**: Trigger any cross-service action (e.g., AI agent processes a leave request). Grep all three service logs for the correlation id returned in the response `x-correlation-id` header. All log lines for that action should share the id.

**Acceptance Scenarios**:

1. **Given** a client request without `x-correlation-id`, **When** the gateway processes it, **Then** the gateway generates one, attaches it to the upstream call, and echoes it back on the response.
2. **Given** a client request that already includes `x-correlation-id` (rare, for replay/debugging), **When** the gateway processes it, **Then** the gateway preserves and forwards that id.
3. **Given** an upstream service calls a second upstream service while handling the request, **When** the second service logs activity, **Then** the same correlation id appears in those logs.

---

### User Story 4 - Per-client rate limiting at the edge (Priority: P2)

As a platform operator, I want to cap how fast any single client can hammer the backend, without each downstream service having to bolt on its own throttler. One bad actor (or one runaway frontend retry loop) should be throttled at the gateway before it can degrade HR Core or AI Agentic for everyone else.

**Why this priority**: Rate limiting prevents a single misbehaving client from causing cascading failures. Today only the Social service has `@nestjs/throttler` enabled (per `CLAUDE.md` active technologies); moving it to the gateway covers the whole platform with one knob.

**Independent Test**: Send a burst of authenticated requests from one client exceeding the configured limit. Verify the gateway responds 429 with `Retry-After` and the downstream service never sees the throttled requests.

**Acceptance Scenarios**:

1. **Given** a user under the configured request limit, **When** they make calls, **Then** every call is forwarded normally.
2. **Given** a user exceeds the per-user rate limit, **When** they make another call, **Then** the gateway returns 429 with a `Retry-After` header and no downstream call is made.
3. **Given** an unauthenticated client (no JWT) hitting public routes, **When** they exceed the per-IP rate limit, **Then** they receive 429.
4. **Given** the rate-limit window passes, **When** the same client retries, **Then** requests succeed again without manual intervention.

---

### User Story 5 - Consistent, structured error responses (Priority: P2)

As a frontend developer, I want every error response — whether it came from the gateway itself, from a downstream service, or from a downstream service being unreachable — to follow ONE shape. Today the SPA has to handle slightly different error bodies depending on which service produced them; the rules in `.claude/rules/frontend-backend-coherence.md` even require mapping per-service error codes by hand.

**Why this priority**: Error consistency directly reduces frontend bug rate and matches the user's stated goal of "easy frontend auth/error handling consistency."

**Independent Test**: Trigger errors of every category (400 validation, 401 auth, 403 RBAC, 404 not found, 409 conflict, 429 throttled, 500 internal, 502/504 upstream unreachable) and confirm the response body matches the same JSON shape with `correlationId` and stable error `code` strings.

**Acceptance Scenarios**:

1. **Given** any downstream service throws an HTTP error, **When** the gateway proxies the response, **Then** the body conforms to the standard error envelope (`code`, `message`, `correlationId`, optional `details`).
2. **Given** a downstream service is unreachable, **When** the gateway tries to forward, **Then** the gateway returns 502 (bad gateway) or 504 (timeout) with the same envelope — not a raw connection-refused stack trace.
3. **Given** the gateway itself rejects a request (401, 429), **When** the client inspects the response, **Then** the shape matches the downstream-error shape.

---

### User Story 6 - Operational visibility (health + aggregated API docs) (Priority: P3)

As an operator, I want one health endpoint that tells me the status of the platform — the gateway plus each downstream — and one Swagger surface that lets a new developer browse every public endpoint in one place.

**Why this priority**: Quality-of-life improvement, not blocking. Becomes valuable as the team grows and as deployment moves out of `pnpm dev`.

**Independent Test**: Call the gateway health endpoint with all services up, then with one downstream stopped. Verify the response reflects per-service status. Open the aggregated Swagger UI and confirm endpoints from all three services are browsable.

**Acceptance Scenarios**:

1. **Given** all three downstream services are running, **When** an operator calls `GET /health`, **Then** the response shows gateway = healthy and each downstream = healthy.
2. **Given** one downstream is down, **When** an operator calls `GET /health`, **Then** the response shows that downstream as unhealthy and overall status as degraded.
3. **Given** a developer opens the gateway's API docs page, **When** they browse it, **Then** they see endpoints grouped by service (HR Core / Social / AI Agentic).

---

### Edge Cases

- **File uploads (multipart)**: Document uploads (feature 014) and any future file endpoint must stream through the gateway without buffering the full file in memory. A 50 MB upload should not OOM the gateway.
- **Long-running responses (SSE / streaming)**: The notifications module (feature 010) may use Server-Sent Events; the AI Agentic service streams LLM tokens. The gateway must NOT buffer these — it must pipe them through.
- **Public scoped-token endpoints**: The exit-survey-response endpoint authenticates via a one-time scoped token (NOT a JWT). The gateway must let it through without JWT enforcement.
- **System-to-system traffic**: AI Agentic minting a SYSTEM JWT to call Social (e.g., for exit survey dispatch) currently goes service-to-service. The gateway is OUT OF SCOPE for inter-service traffic — services keep their direct REST clients. The gateway handles **public/frontend traffic only**.
- **Backend latency spikes**: If a downstream takes longer than the configured upstream timeout, the gateway must return 504 with the standard error envelope (not hang indefinitely).
- **Body size limits**: Configurable per-route max body size, with a sane default (e.g., 10 MB for JSON, larger explicit limit for upload routes).
- **CORS preflight**: The gateway is the only origin the browser talks to, so CORS configuration lives only at the gateway. Downstream services no longer need permissive CORS.
- **Per-user vs per-IP rate limits**: Authenticated requests are limited per user (from JWT sub); unauthenticated are limited per IP. Both buckets must be tracked.
- **Misconfigured downstream URL**: If a service URL env var is missing or unreachable at startup, the gateway should log loudly and either fail-fast or refuse to forward to that route (configurable), never silently return 500s.

## Requirements *(mandatory)*

### Functional Requirements

**Routing & entry point**

- **FR-001**: System MUST expose a single public HTTP host as the only entry point for browser/SPA traffic, with all routes prefixed `/api/*`.
- **FR-002**: System MUST route `/api/hr/*` requests to the HR Core service, `/api/social/*` to the Social service, and `/api/ai/*` to the AI Agentic service, configurable via environment variables.
- **FR-003**: System MUST forward the upstream response body, status code, and a controlled set of headers (e.g., `content-type`, `content-disposition`, `cache-control`) back to the client unchanged in shape.
- **FR-004**: System MUST return a structured 404 response when a request path does not match any configured upstream route, including a correlation id.

**Authentication**

- **FR-005**: System MUST validate the JWT on every authenticated route before forwarding to any downstream service.
- **FR-006**: System MUST forward the original `Authorization` header to the downstream service so downstream guards remain in place as defense-in-depth.
- **FR-007**: System MUST allow a configurable allow-list of public routes that bypass JWT validation (at minimum: signin, refresh, forgot-password, exit-survey response endpoint, health).
- **FR-008**: System MUST reject missing, malformed, expired, or invalid-signature JWTs with HTTP 401 and a standardized error envelope that distinguishes the cause via a stable `code` field.

**Request correlation**

- **FR-009**: System MUST generate a correlation id for every incoming request, using the inbound `x-correlation-id` header when present and otherwise generating a new UUID.
- **FR-010**: System MUST propagate the correlation id to downstream services via the `x-correlation-id` request header and echo it on every response.
- **FR-011**: System MUST include the correlation id in every gateway log line tied to a request.

**Rate limiting**

- **FR-012**: System MUST enforce a per-authenticated-user request rate limit (default and override values configurable via environment).
- **FR-013**: System MUST enforce a per-IP request rate limit on unauthenticated routes.
- **FR-014**: System MUST respond with HTTP 429, a `Retry-After` header, and the standardized error envelope when a limit is exceeded.
- **FR-015**: System MUST permit per-route override of rate-limit values for endpoints with different traffic profiles (e.g., looser for `/api/ai/conversations/*/messages` streaming, stricter for `/api/hr/auth/signin`).

**Error envelope**

- **FR-016**: System MUST wrap every non-2xx response in a JSON envelope of the form `{ code: string, message: string, correlationId: string, details?: unknown }`.
- **FR-017**: System MUST translate downstream connection failures into HTTP 502 with the standardized envelope and translate downstream timeouts into HTTP 504.
- **FR-018**: System MUST preserve the original downstream HTTP status code when the downstream produces a non-2xx that already follows the standard envelope.

**Streaming, uploads, and large payloads**

- **FR-019**: System MUST stream multipart file uploads to the downstream service without buffering the full body in memory.
- **FR-020**: System MUST proxy streaming responses (Server-Sent Events, chunked transfer) through to the client without buffering.
- **FR-021**: System MUST enforce a configurable maximum request body size with a sane default, returning HTTP 413 with the standard envelope when exceeded.

**Operability**

- **FR-022**: System MUST expose a `GET /health` endpoint that returns the status of the gateway and each downstream service.
- **FR-023**: System MUST expose an aggregated API documentation page that surfaces endpoints from each downstream service.
- **FR-024**: System MUST log every forwarded request with method, path, downstream target, status code, latency, and correlation id, at a level suitable for production observation.
- **FR-025**: System MUST start successfully even if a downstream service is temporarily unreachable, returning 502 for that downstream's routes until it recovers (no fail-fast on startup).

**Scope boundaries**

- **FR-026**: System MUST NOT proxy inter-service calls; services continue to call each other directly via their existing REST clients.
- **FR-027**: System MUST NOT issue, refresh, or sign JWTs; token issuance remains a HR Core (IAM) responsibility.
- **FR-028**: System MUST NOT introduce a database or persistent storage of its own; all state (rate-limit counters) lives in process memory or an optional shared cache, configurable but not required for v1.

### Key Entities

This feature is infrastructure — it does not introduce new persistent domain entities. The conceptual entities involved are:

- **Route configuration**: A mapping from inbound path prefix to downstream service URL plus an optional `public` flag (skips JWT validation) and optional rate-limit override. Loaded from environment / config at startup.
- **Rate-limit bucket**: A short-lived in-memory counter keyed by either user id (authenticated) or client IP (unauthenticated) plus route key.
- **Error envelope**: The single JSON shape `{ code, message, correlationId, details? }` that every error response conforms to.
- **Correlation context**: The per-request `{ correlationId, userId?, roleHints? }` carried through the gateway's request pipeline.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The SPA configures exactly one backend base URL after the migration (down from three today), measured by counting distinct origins in `apps/web/src/lib/api/*.ts`.
- **SC-002**: Every authenticated route on the SPA reaches the right backend service through the gateway without functional regression — verified by running the existing manual smoke flows (signin, dashboard load, employee list, leave request submit, announcement create, document upload, AI conversation send).
- **SC-003**: An expired or missing JWT produces an identical error response body across at least 10 sampled authenticated endpoints; the SPA's 401-handling code path triggers in exactly one place.
- **SC-004**: A single request's correlation id appears in gateway logs plus at least one downstream service's logs for any multi-service action sampled during testing.
- **SC-005**: A burst of more than the configured per-user limit from a single client produces 429 responses at the gateway, with zero of the throttled requests reaching the downstream service (confirmed by downstream access logs).
- **SC-006**: A streaming upload of at least 50 MB completes successfully without the gateway process resident memory exceeding a fixed bound (configurable, target <200 MB above baseline).
- **SC-007**: With one downstream service stopped, the gateway's `/health` endpoint reports overall status `degraded` and identifies which service is down, while requests to the other services continue to succeed.
- **SC-008**: The frontend coherence rule (`.claude/rules/frontend-backend-coherence.md`) is satisfied: every backend error code documented in any service has exactly one mapping site on the frontend (the centralized gateway-aware error handler), down from per-page handlers today.

## Assumptions

- **Architectural scope**: The gateway is the entry point for **frontend / external traffic only**. Inter-service calls (e.g., AI Agentic → HR Core, Social → HR Core for employee enrichment) continue to use the existing direct REST clients in `apps/*/src/common/clients/`. Routing all traffic through the gateway is explicitly out of scope to keep latency and operational complexity low.
- **Auth model**: The gateway validates the JWT and **forwards the original `Authorization` header unchanged** to the downstream service. Downstream `SharedJwtGuard` continues to run as defense-in-depth, so the migration is transparent and can be rolled back by simply pointing the SPA back at direct service URLs.
- **Token issuance**: JWT signing and refresh remain a HR Core responsibility (the IAM module). The gateway only validates using the same shared `JWT_SECRET` defined in `.claude/rules/security.md`.
- **System-to-system tokens**: The SYSTEM JWT mint flow (`AgentContextFactory.forSystemTask()` in AI Agentic) continues to live in AI Agentic and is used only for service-to-service calls, which do not traverse the gateway.
- **Public endpoints**: The exit-survey-response endpoint (validates via scoped survey token, not JWT — per `.claude/CLAUDE.md §10`) is explicitly part of the public allow-list; the health endpoint is public.
- **No new persistent store**: The gateway is stateless. Rate-limit counters live in process memory for v1 and can be moved to a shared cache (e.g., Redis) later without behavior change.
- **Tech stack**: Implementation will use NestJS (consistency with the other three services) and only free / open-source libraries already in the monorepo's stack profile (no Kong, no Tyk Enterprise, no paid SaaS). Concrete library choices belong in `/speckit.plan`.
- **Existing services unchanged**: HR Core, Social, and AI Agentic require no code changes to adopt the gateway beyond optionally relaxing their own CORS configuration once they only ever receive traffic from the gateway in production.
- **Frontend changes are mechanical**: The migration on the SPA side is changing the `baseURL` in `apps/web/src/lib/api/client.ts` (and removing the per-service base URLs) plus updating the Vite dev proxy to point at the gateway port. No page-level code changes expected.
- **Deployment**: For v1, the gateway runs as a separate Node process on its own port (e.g., `:3000`) just like the other three services. Container packaging follows the existing `Dockerfile` pattern.
- **Sequencing**: Feature 013 (announcements) and 014 (documents) finish first. The gateway lands on top of a stable set of downstream APIs to avoid moving targets during integration.
- **Out of scope for this spec**: TLS termination (handled by the deployment environment / a reverse proxy in front), service discovery (downstream URLs come from config, not a registry), Kafka transport (still Phase 2), GraphQL federation (REST only).
