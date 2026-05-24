# Contract — Environment Variables (Social)

Every env var Social reads, where it is read from, what happens if it is missing, and how it is documented.

---

## 1. Required (fail-fast on absence)

These MUST be present in `apps/social/.env`. Loading uses `ConfigService.getOrThrow(...)`. Absence prints a clear error and exits within 5 s (SC-007).

| Variable | Type | Used by | Notes |
|---|---|---|---|
| `SOCIAL_DATABASE_URL` | string (PG connection URL) | `PrismaService` (Social) | Must point at the `social` schema (`?schema=social`). |
| `JWT_SECRET` | string ≥ 32 chars | `SharedJwtGuard` | MUST be the same value as HR Core's `JWT_SECRET`. |
| `SYSTEM_JWT_SECRET` | string ≥ 32 chars | `SharedJwtGuard` (SYSTEM tokens) | MUST be the same value as HR Core's `SYSTEM_JWT_SECRET`. |
| `HR_CORE_URL` | URL | `HrCoreClient` | e.g. `http://localhost:3001` in dev. |

## 2. Optional (defaulted)

These have safe defaults via `ConfigService.get(name, default)`.

| Variable | Default | Used by |
|---|---|---|
| `SOCIAL_PORT` | `3002` | `main.ts` listen port |
| `HR_CORE_EMPLOYEE_CACHE_TTL_MS` | `60000` | `HrCoreClient` cache TTL |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowlist |
| `THROTTLE_TTL` | `60000` | `ThrottlerModule` window (ms) |
| `THROTTLE_LIMIT` | `100` | `ThrottlerModule` requests per window |
| `REQUEST_TIMEOUT_MS` | `30000` | `TimeoutInterceptor` |
| `JWT_EXPIRY` | `15m` | Reserved for future Social-side mint scenarios (none today) |

## 3. NEVER read directly via `process.env`

Every variable above MUST be read through `ConfigService`. A grep of `apps/social/src/` for `process\.env` SHOULD return only the test fixtures and possibly `main.ts` bootstrap startup banner (HR Core's pattern). Production code paths MUST go through `ConfigService`.

## 4. Documentation surfaces

Both files MUST list the variables in §1 and §2:

- **Root `.env.example`** — under the existing `── Social Service (apps/social/.env) ──` section. Add `HR_CORE_EMPLOYEE_CACHE_TTL_MS` if not yet present.
- **`apps/social/.env.example`** (NEW file) — a Social-only template a developer can `cp` directly into `apps/social/.env`.

Both files MUST be committed (the actual `.env` files remain git-ignored).

## 5. Missing-var behavior contract

| Missing variable | Behavior |
|---|---|
| `SOCIAL_DATABASE_URL` | `PrismaService.onModuleInit()` throws; process exits with code `1`. |
| `JWT_SECRET` | `SharedJwtGuard` (via its `forRoot` factory or constructor) throws on module compile; Nest bootstrap aborts. |
| `SYSTEM_JWT_SECRET` | Same as `JWT_SECRET`. |
| `HR_CORE_URL` | `HrCoreClient.getOrThrow` raises at first call site if the env was absent at construction; ideally fails at construction via `getOrThrow`. |
| `SOCIAL_PORT` | Falls back to `3002`. No error. |
| `HR_CORE_EMPLOYEE_CACHE_TTL_MS` | Falls back to `60_000`. No error. |

The error message MUST name the missing variable so the developer can fix it without grepping.

## 6. Out of scope

- Secret rotation / Vault integration: out of scope for this scaffold.
- Per-environment overrides (staging / production `.env` files): out of scope; the FYP runs locally only.
