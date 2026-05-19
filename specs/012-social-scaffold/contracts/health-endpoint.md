# Contract — `GET /health` (Social)

The single unauthenticated endpoint exposed by Social. Identical in spirit to HR Core's `/health` so docker-compose, CI, and reverse proxies treat all three services uniformly.

---

## Request

```
GET /health HTTP/1.1
Host: localhost:3002
```

No headers required. No `Authorization` accepted (or rejected — the route is `@Public()` and ignores any bearer header).

## Response

```
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "status": "ok",
  "service": "social",
  "timestamp": "2026-05-19T14:23:01.000Z"
}
```

Field promises:

| Field | Type | Value |
|---|---|---|
| `status` | string literal | always `"ok"` while the process is running |
| `service` | string literal | always `"social"` |
| `timestamp` | string | current time at handling, ISO 8601 with millisecond precision |

## Latency

- p95 < 100 ms on local dev hardware.
- p99 < 250 ms.

## Implementation

```ts
// apps/social/src/app.controller.ts
@Controller()
export class AppController {
  @Get('health')
  @Public()
  health(): { status: 'ok'; service: 'social'; timestamp: string } {
    return { status: 'ok', service: 'social', timestamp: new Date().toISOString() };
  }
}
```

## Anti-promises

- The endpoint does NOT check DB connectivity. A "deep" health check (DB ping, HR Core reachability) is out of scope for this scaffold — it would couple liveness to dependencies and produce false negatives when HR Core is restarting. A future readiness probe under `/ready` MAY be added; it is not part of this contract.
- The endpoint does NOT include version or build SHA. Adding them would couple the scaffold to a build pipeline that ships later.
