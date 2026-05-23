# Implementation Plan: API Gateway Service

**Branch**: `015-api-gateway` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-api-gateway/spec.md`

## Summary

Build a new stateless NestJS API Gateway service as the only public HTTP entry point for frontend and external traffic. The gateway routes `/api/hr/*`, `/api/social/*`, and `/api/ai/*` to HR Core, Social, and AI Agentic respectively; validates JWTs before forwarding authenticated requests; applies correlation ids and edge rate limits; normalizes gateway-originated and upstream-failure errors into one envelope; and keeps uploads/SSE/streaming responses unbuffered by using an Express-compatible streaming proxy.

The frontend migration is intentionally mechanical: web API clients use one gateway base URL and Vite dev proxy targets the gateway instead of direct service ports. Existing downstream service auth guards remain in place as defense-in-depth, and inter-service REST clients stay direct and out of scope.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode on Node.js 22-compatible runtime  
**Primary Dependencies**: NestJS 10, Express adapter, `http-proxy-middleware`/`http-proxy` for streaming proxying, `jsonwebtoken` for JWT verification, `@nestjs/throttler` for in-memory rate limiting, `@nestjs/config`, `@nestjs/swagger`, `helmet`, `morgan`, `rxjs`  
**Storage**: N/A - no database or persistent store; v1 rate-limit counters are in process memory  
**Testing**: Jest + `@nestjs/testing`, Supertest for HTTP contracts, Nock or local test HTTP servers for upstream proxy behavior, existing Turborepo `pnpm --filter` commands  
**Target Platform**: Node.js service in the existing pnpm/Turborepo monorepo; local dev on Windows with downstream Nest services on ports 3001-3003 and gateway default port 3004 to avoid Vite's 3000 dev server  
**Project Type**: Web service plus small frontend API-client/proxy configuration migration  
**Performance Goals**: Gateway overhead below 50ms p95 for normal JSON requests in local smoke tests; 50 MB multipart upload succeeds without full-body buffering; SSE/chunked responses are forwarded chunk-by-chunk  
**Constraints**: Single public `/api/*` entry point; no new database; no paid/proprietary gateway product; downstream response body/status preserved when already valid; `x-correlation-id` echoed on every response; request body default limit configurable, with larger route-specific upload limits; no inter-service traffic through the gateway  
**Scale/Scope**: Three downstream services in v1 (HR Core, Social, AI Agentic), one SPA client, public route allow-list for auth/health/scoped-token endpoints, configurable route and rate-limit rules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution file still contains placeholder principles, so there are no formal constitution gates to evaluate. The applicable project gates come from `AGENTS.md` and existing service conventions:

- **Strict TypeScript**: PASS - plan uses TypeScript 5.x strict mode, explicit DTO/interface contracts, and avoids `any`.
- **NestJS consistency**: PASS - gateway is a NestJS 10 app following the existing service pattern.
- **No incomplete placeholders**: PASS - implementation tasks must cover module wiring, config, middleware/guards/interceptors/filters, tests, Docker/package wiring, and frontend migration.
- **Endpoint security rule**: PASS WITH JUSTIFICATION - gateway-owned public endpoints (`/health`, docs, configured public proxy routes) are intentionally public; all other proxied routes run central JWT validation before forwarding. Downstream services keep their own `SharedJwtGuard`/RBAC as defense-in-depth.
- **DTO validation and service trust boundary**: PASS - gateway config and health/admin DTOs validate at boundaries; proxy services operate on typed config.
- **No persistent gateway state**: PASS - aligns with FR-028.

Post-design re-check: PASS. Phase 0/1 decisions keep the same constraints and add no complexity that violates project rules.

## Project Structure

### Documentation (this feature)

```text
specs/015-api-gateway/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- gateway-api.yaml
|-- checklists/
`-- tasks.md             # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/api-gateway/
|-- package.json
|-- nest-cli.json
|-- tsconfig.app.json
|-- tsconfig.json
|-- src/
|   |-- main.ts
|   |-- app.module.ts
|   |-- config/
|   |   |-- gateway.config.ts
|   |   |-- route-config.types.ts
|   |   `-- validation.ts
|   |-- common/
|   |   |-- correlation/
|   |   |   |-- correlation.middleware.ts
|   |   |   `-- correlation-context.ts
|   |   |-- errors/
|   |   |   |-- error-envelope.ts
|   |   |   |-- gateway-exception.filter.ts
|   |   |   `-- upstream-error.mapper.ts
|   |   |-- logging/
|   |   |   `-- request-logging.interceptor.ts
|   |   |-- auth/
|   |   |   |-- gateway-jwt.guard.ts
|   |   |   |-- public-route.matcher.ts
|   |   |   `-- jwt-claims.interface.ts
|   |   `-- throttling/
|   |       |-- gateway-throttler.guard.ts
|   |       `-- rate-limit-key.factory.ts
|   |-- modules/
|   |   |-- proxy/
|   |   |   |-- proxy.module.ts
|   |   |   |-- proxy.controller.ts
|   |   |   |-- proxy.service.ts
|   |   |   `-- header-policy.ts
|   |   |-- health/
|   |   |   |-- health.module.ts
|   |   |   |-- health.controller.ts
|   |   |   `-- downstream-health.service.ts
|   |   `-- docs/
|   |       |-- docs.module.ts
|   |       |-- docs.controller.ts
|   |       `-- openapi-aggregation.service.ts
|   `-- test-support/
|       `-- upstream-test-server.ts
|-- test/
|   |-- proxy.e2e-spec.ts
|   |-- auth.e2e-spec.ts
|   |-- throttling.e2e-spec.ts
|   |-- streaming.e2e-spec.ts
|   `-- health.e2e-spec.ts
apps/web/
|-- vite.config.ts
`-- src/lib/api/
    |-- client.ts
    |-- social.ts
    |-- ai.ts
    `-- gateway-error.ts
```

**Structure Decision**: Add a fourth NestJS app under `apps/api-gateway` because this is an independently deployed edge service, not an HR/Social/AI module. Keep gateway-owned modules small: config, correlation, auth, throttling, proxy, health, and docs. Frontend changes stay limited to the API client base URL/error normalization and Vite proxy target.

## Complexity Tracking

No constitution violations require justification. The additional app is inherent to the requested "one public entry point" gateway boundary and is simpler than embedding proxy behavior in an existing domain service.
