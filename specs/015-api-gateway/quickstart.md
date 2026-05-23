# Quickstart: API Gateway Service

This quickstart describes how the completed implementation should run and how to smoke-test it.

## Prerequisites

- `pnpm install`
- PostgreSQL stack running when downstream services need it: `docker compose up -d`
- HR Core on `http://localhost:3001`
- Social on `http://localhost:3002`
- AI Agentic on `http://localhost:3003`
- API Gateway on `http://localhost:3004`
- Web dev server on `http://localhost:3000`

## Environment

Add gateway env values to `.env.example` and local `.env` as part of implementation:

```bash
API_GATEWAY_PORT=3004
API_GATEWAY_CORS_ORIGINS=http://localhost:3000
API_GATEWAY_TRUST_PROXY=false
API_GATEWAY_JWT_SECRET=change-me
API_GATEWAY_UPSTREAM_TIMEOUT_MS=15000
API_GATEWAY_DEFAULT_JSON_BODY_LIMIT_BYTES=10485760
API_GATEWAY_UPLOAD_BODY_LIMIT_BYTES=52428800
API_GATEWAY_AUTH_RATE_LIMIT_WINDOW_MS=60000
API_GATEWAY_AUTH_RATE_LIMIT_MAX=120
API_GATEWAY_PUBLIC_RATE_LIMIT_WINDOW_MS=60000
API_GATEWAY_PUBLIC_RATE_LIMIT_MAX=30
HR_CORE_URL=http://localhost:3001
SOCIAL_URL=http://localhost:3002
AI_AGENTIC_URL=http://localhost:3003
VITE_API_GATEWAY_URL=
```

The gateway JWT secret must match the HR Core IAM signing secret used by existing tokens.

## Run

```bash
pnpm --filter @sentient/hr-core dev
pnpm --filter @sentient/social dev
pnpm --filter @sentient/ai-agentic dev
pnpm --filter @sentient/api-gateway dev
pnpm --filter @sentient/web dev
```

After frontend migration, the Vite dev proxy forwards `/api/*` to `http://localhost:3004`; the browser should not call ports 3001, 3002, or 3003 directly. Set `VITE_API_GATEWAY_URL=http://localhost:3004` only when bypassing the Vite dev proxy.

## Smoke Tests

### Gateway health

```bash
curl -i http://localhost:3004/health
```

Expected:
- HTTP 200
- `status` is `healthy` when all downstream services are up
- `status` is `degraded` and one downstream is marked `unhealthy` if that service is stopped
- `x-correlation-id` response header is present

### Unknown route

```bash
curl -i http://localhost:3004/api/unknown/example
```

Expected HTTP 404 body:

```json
{
  "code": "NoUpstreamRoute",
  "message": "No upstream route is configured for this path.",
  "correlationId": "..."
}
```

### Missing JWT on authenticated route

```bash
curl -i http://localhost:3004/api/hr/employees
```

Expected:
- HTTP 401
- Standard error envelope
- Downstream HR Core receives no request

### Public signin route

```bash
curl -i http://localhost:3004/api/hr/auth/login \
  -H "content-type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"password\"}"
```

Expected:
- Request is forwarded without JWT validation
- Response shape matches HR Core signin response

### Authenticated proxy route

```bash
curl -i http://localhost:3004/api/social/announcements \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H "x-correlation-id: smoke-test-015"
```

Expected:
- Request reaches Social
- Response includes `x-correlation-id: smoke-test-015`
- Upstream response body and HTTP status are preserved

### Rate limit

Send more than the configured per-user limit to a low-limit test route or override.

Expected:
- HTTP 429
- `Retry-After` header present
- Standard error envelope with `code: "RateLimitExceeded"`
- Throttled request is not forwarded downstream

### Streaming and upload

- Upload a large document through `/api/social/documents`.
- Open notification SSE through the gateway.
- Send an AI streaming message through `/api/ai/*`.

Expected:
- Gateway does not buffer the full body/response.
- Upload succeeds for the configured 50 MB limit.
- SSE/chunked responses arrive progressively.

## Verification Commands

```bash
pnpm --filter @sentient/api-gateway type-check
pnpm --filter @sentient/api-gateway test
pnpm --filter @sentient/api-gateway build
pnpm --filter @sentient/web type-check
```

Run the existing downstream tests if gateway changes touch shared auth or error helpers:

```bash
pnpm --filter @sentient/hr-core test
pnpm --filter @sentient/social test
pnpm --filter @sentient/ai-agentic test
```
