# Contract: Health Endpoint (All 3 Services)

**Applied to**: HR Core (:3001), Social (:3002), AI Agentic (:3003)  
**Auth**: None — public endpoint, no JWT required

---

## GET /health

Returns the service liveness status. Used by developers, Docker health checks, and future load balancer probes.

### Response — 200 OK

```json
{
  "status": "ok",
  "service": "hr-core",
  "timestamp": "2026-04-06T12:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` | Always `"ok"` when the service is running (no complex health logic in scaffold) |
| `service` | string | Service name: `"hr-core"`, `"social"`, or `"ai-agentic"` |
| `timestamp` | ISO 8601 string | Server time at the moment of the request |

### Error Responses

| Status | Condition |
|--------|-----------|
| 503 | Service is starting up or crashed (NestJS not yet accepting connections — TCP-level failure, not an HTTP 503 from the app) |

### Notes

- This endpoint deliberately has no database check in the scaffold — a DB connectivity check is added to the health endpoint when the IAM/Prisma modules are fully wired in a subsequent feature.
- No `@UseGuards()` on this endpoint — it must remain public so Docker and CI systems can probe it without credentials.
- Response time SLA: < 500ms from service start.
