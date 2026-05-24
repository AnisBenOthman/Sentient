# Data Model: API Gateway Service

This feature introduces no persistent database entities. The gateway model is runtime configuration plus per-request context.

## RouteConfig

Represents one upstream routing rule.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `key` | `'hr' | 'social' | 'ai'` | yes | Stable route key used in logs, rate-limit buckets, and health output. |
| `inboundPrefix` | string | yes | Public prefix, e.g. `/api/hr`. |
| `targetBaseUrl` | string URL | yes | Downstream service URL from env, e.g. `http://localhost:3001`. |
| `stripPrefix` | boolean | yes | `true` for `/api/hr/employees` -> `/employees`. |
| `timeoutMs` | number | yes | Upstream request timeout; timeout maps to 504. |
| `maxBodyBytes` | number | yes | Default max body size before 413. |
| `publicRoutes` | PublicRouteRule[] | yes | Route exceptions that bypass JWT validation. |
| `rateLimit` | RateLimitPolicy | yes | Default policy for this upstream route. |
| `rateLimitOverrides` | RateLimitOverride[] | no | More specific policies for signin, uploads, AI streams, etc. |

Validation rules:
- `inboundPrefix` must start with `/api/` and must not end with `/*`.
- `targetBaseUrl` must be a valid absolute HTTP(S) URL.
- `timeoutMs`, `maxBodyBytes`, and rate-limit values must be positive integers.
- Route keys must be unique.

## PublicRouteRule

Defines an auth bypass for a proxied or gateway-owned endpoint.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `method` | HTTP method or `'*'` | yes | Match method before path. |
| `pathPattern` | string | yes | Gateway-visible path pattern, e.g. `/api/hr/auth/signin`. |
| `reason` | string | yes | Human-readable reason for auditability. |

Validation rules:
- Patterns must be anchored to gateway-visible paths.
- Wildcards should be suffix-only unless a test proves the narrower case.
- Public allow-list defaults include health, docs, auth signin/refresh/forgot-password, and exit survey scoped-token responses.

## RateLimitPolicy

Controls throttling for a route bucket.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `windowMs` | number | yes | Rolling/fixed window duration. |
| `limit` | number | yes | Maximum requests per key per window. |
| `keyMode` | `'authenticated-user' | 'ip' | 'auto'` | yes | `auto` means JWT `sub` when present, IP otherwise. |

Validation rules:
- `windowMs` and `limit` must be positive.
- Authenticated routes use user id; public routes use client IP.
- Overrides inherit unspecified values from the route default.

## RateLimitBucket

Short-lived in-memory counter managed by throttling.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `bucketKey` | string | yes | `{routeKey}:{keyMode}:{subjectOrIp}:{overrideKey}`. |
| `count` | number | yes | Requests observed in current window. |
| `resetAt` | Date | yes | Used to compute `Retry-After`. |

Lifecycle:
1. Created when first request arrives in a window.
2. Incremented while under limit.
3. Rejected with 429 when count exceeds `limit`.
4. Expired automatically after `resetAt`.

## ErrorEnvelope

The standard gateway error response shape.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `code` | string | yes | Stable machine-readable code. |
| `message` | string | yes | Human-readable message safe for clients. |
| `correlationId` | string | yes | Current request correlation id. |
| `details` | unknown | no | Validation details or upstream metadata when safe. |

Rules:
- Gateway-owned errors always use this shape.
- Downstream non-2xx responses that already match this shape preserve status and body, with `correlationId` added if absent.
- Downstream connection failures map to 502 `UpstreamUnavailable`.
- Downstream timeouts map to 504 `UpstreamTimeout`.
- Unknown gateway exceptions map to 500 `GatewayInternalError`.

## CorrelationContext

Per-request context created at the edge.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `correlationId` | string UUID-like | yes | Inbound valid `x-correlation-id` or generated UUID. |
| `userId` | string | no | JWT `sub` after successful auth. |
| `roleHints` | string[] | no | Optional JWT role claims for logs only; downstream remains authoritative. |
| `routeKey` | string | no | Matched upstream route. |
| `startedAt` | number | yes | Used for request latency logs. |

Rules:
- Correlation id is available before auth and throttling.
- The gateway forwards `x-correlation-id` to downstream services and echoes it on every response.

## UpstreamHealth

Runtime health probe result for one downstream.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `key` | `'hr' | 'social' | 'ai'` | yes | Downstream identifier. |
| `url` | string | yes | Probe URL, normally `{targetBaseUrl}/health`. |
| `status` | `'healthy' | 'unhealthy'` | yes | Last probe result for the current request. |
| `latencyMs` | number | no | Present when probe completes. |
| `error` | string | no | Safe failure message. |

Aggregate health status:
- `healthy` when gateway and all downstreams are healthy.
- `degraded` when gateway is healthy but at least one downstream is unhealthy.

## RequestLogEvent

Structured request log emitted for each forwarded or gateway-rejected request.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `correlationId` | string | yes | Matches response header. |
| `method` | string | yes | HTTP method. |
| `path` | string | yes | Gateway-visible path. |
| `routeKey` | string | no | Missing for unmatched 404. |
| `target` | string | no | Downstream target URL when forwarded. |
| `statusCode` | number | yes | Final response status. |
| `latencyMs` | number | yes | Request duration. |
| `userId` | string | no | Present after auth. |
