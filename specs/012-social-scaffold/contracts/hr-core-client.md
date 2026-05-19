# Contract — `HrCoreClient`

The cross-service REST client Social uses to validate employee references against HR Core. Owned by `apps/social/src/common/clients/`. The implementation MUST satisfy every promise below.

---

## 1. Class & DI

```ts
// apps/social/src/common/clients/hr-core.client.ts
@Injectable()
export class HrCoreClient {
  constructor(private readonly config: ConfigService) { /* ... */ }
}
```

- Decorated `@Injectable()`.
- Exported from `apps/social/src/common/clients/clients.module.ts` (which is `@Global()` or imported by `AppModule`).
- Constructor reads everything via `ConfigService.getOrThrow(...)` or `ConfigService.get(..., default)`. NEVER `process.env.*`.

## 2. Public surface (minimum)

```ts
export interface HrCoreCallContext {
  jwt: string;
  correlationId?: string;
}

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

class HrCoreClient {
  getEmployeeRef(id: string, context: HrCoreCallContext): Promise<EmployeeRef>;
}
```

- `EmployeeRef` is exported from `apps/social/src/common/clients/employee-ref.interface.ts` and re-exported by `clients.module.ts`.
- The return type MUST be exactly `Promise<EmployeeRef>`, never `Promise<EmployeeRef | null>` (missing employee → exception, not null).
- Additional methods (e.g., `searchEmployees`) MAY be added by later features but MUST NOT be added in this scaffold.

## 3. Configuration

| Setting | Source | Required | Default |
|---|---|---|---|
| Base URL | `HR_CORE_URL` via `getOrThrow` | Yes | — |
| Cache TTL (ms) | `HR_CORE_EMPLOYEE_CACHE_TTL_MS` via `get` | No | `60000` |
| Request timeout (ms) | hard-coded inside `axios.create({ timeout })` | No | `5000` |

## 4. HTTP behavior

For every outbound request the client MUST:

| Header | Value |
|---|---|
| `Authorization` | `Bearer ${context.jwt}` |
| `x-correlation-id` | `context.correlationId` (set only when provided) |
| `Accept` | `application/json` |

The request URL is `GET ${HR_CORE_URL}/employees/${encodeURIComponent(id)}`.

The client MUST NOT:

- Log the `Authorization` header value.
- Persist the JWT anywhere (no module-level capture, no caching keyed on JWT).
- Add custom retry logic (Phase 1: fail fast on 5xx; resilience patterns are out of scope).

## 5. Caching contract

- In-process `Map<string, { value: EmployeeRef; expiresAt: number }>`.
- Cache key: `employee.id` (NOT JWT-scoped — `EmployeeRef` is identical for every caller).
- On read: if `entry.expiresAt > Date.now()` return `entry.value`; otherwise delete entry and refetch.
- TTL is read once at construction; runtime config changes require restart.
- The cache MUST be reset-able by tests via a `__resetCache()` method tagged `@internal` (not exported through `clients.module.ts`).

## 6. Error mapping

| Source | Thrown exception | Message |
|---|---|---|
| HR Core `401` | `UnauthorizedException` | `'HR Core rejected the caller JWT'` |
| HR Core `403` | `ForbiddenException` | `'HR Core forbade access to employee <id>'` |
| HR Core `404` | `NotFoundException` | `'Employee <id> not found in HR Core'` |
| HR Core `5xx` | `ServiceUnavailableException` | `'HR Core unreachable (status <code>)'` |
| `axios` network error (`ECONNREFUSED`, DNS, timeout) | `ServiceUnavailableException` | `'HR Core unreachable (<code>)'` |
| HR Core `200` with body that does not match `EmployeeRef` shape | `InternalServerErrorException` | `'HrCoreClient: unexpected /employees/:id response shape'` |

The original axios error MUST be logged at `Logger.error()` with `{ method, url, correlationId, statusOrCode, durationMs }`, but MUST NOT be re-thrown as-is — callers always see a Nest exception.

## 7. Type narrowing

```ts
function isEmployeeRef(raw: unknown): raw is EmployeeRef {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as Record<string, unknown>).id === 'string' &&
    typeof (raw as Record<string, unknown>).firstName === 'string' &&
    typeof (raw as Record<string, unknown>).lastName === 'string' &&
    typeof (raw as Record<string, unknown>).email === 'string' &&
    typeof (raw as Record<string, unknown>).employeeCode === 'string' &&
    typeof (raw as Record<string, unknown>).departmentId === 'string' &&
    ((raw as Record<string, unknown>).teamId === null ||
      typeof (raw as Record<string, unknown>).teamId === 'string') &&
    typeof (raw as Record<string, unknown>).employmentStatus === 'string'
  );
}
```

The implementation MUST call `isEmployeeRef(response.data)` before caching or returning — no `as unknown as EmployeeRef` casts.

## 8. Module registration

```ts
// apps/social/src/common/clients/clients.module.ts
@Global()
@Module({
  providers: [HrCoreClient],
  exports: [HrCoreClient],
})
export class ClientsModule {}
```

- `AppModule.imports` MUST include `ClientsModule`.
- Feature modules NEVER instantiate `HrCoreClient` directly — they inject it via Nest DI.

## 9. Unit-test contract

The companion test file `hr-core.client.spec.ts` MUST cover at minimum:

- Happy path: returns the parsed `EmployeeRef` on `200`.
- Cache hit: a second call within the TTL makes zero new HTTP requests (verified by `jest.fn()` call count on the mocked axios).
- Cache expiry: a second call after the TTL elapses (use `jest.useFakeTimers()` + `jest.advanceTimersByTime`) issues a second HTTP request.
- Error mapping for 401 / 403 / 404 / 500 / network error.
- Header forwarding: the mocked axios receives `Authorization: Bearer <jwt>` and `x-correlation-id: <id>` exactly once.
- Shape rejection: a `200` response with a missing `email` field throws `InternalServerErrorException`.
- JWT redaction: the test's `Logger.error` spy receives no string containing the JWT body.
