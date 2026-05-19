# Contract — Auth Wiring (Social)

How `SharedJwtGuard` and `RbacGuard` are bound globally inside `apps/social/src/app.module.ts`, and what every consumer of Social can rely on.

---

## 1. Global guard registration

Inside `AppModule.providers`, the `APP_GUARD` tokens MUST be declared in **this order** and ONLY these:

```ts
providers: [
  AppService,
  { provide: APP_GUARD, useClass: ThrottlerGuard },   // pre-existing
  { provide: APP_GUARD, useClass: SharedJwtGuard },   // NEW
  { provide: APP_GUARD, useClass: RbacGuard },        // NEW
],
```

Both guards are imported from `@sentient/shared`. There is NO Social-local guard file. `UserStatusGuard` is intentionally absent — Social does not own the `User` table.

## 2. `@Public()` decorator

The `@Public()` decorator (also from `@sentient/shared`) marks a handler as exempt from `SharedJwtGuard`. The scaffold uses it on exactly one handler:

```ts
@Get('health')
@Public()
health() { /* ... */ }
```

Future endpoints that need to be reachable without authentication (e.g., the survey-token endpoint per CLAUDE.md §10) MUST use `@Public()` and document the bypass in the feature's plan.

## 3. RBAC behavior

- `RbacGuard` short-circuits with `true` when the handler has no `@Roles(...)` decorator. Consequence: an authenticated request to a controller method without `@Roles` is allowed.
- When `@Roles(...)` is present, `RbacGuard` requires `request.user.roles` to intersect the declared set. `SYSTEM` is treated as a normal role — it MUST be listed explicitly to be admitted (no implicit "SYSTEM bypasses RBAC").
- The scaffold ships NO `@Roles(...)` annotations (the only handler is `@Public()`). Feature modules add their own.

## 4. SYSTEM JWT behavior

`SharedJwtGuard` already accepts tokens signed with either `JWT_SECRET` (user JWT) or `SYSTEM_JWT_SECRET` (system JWT minted by AI Agentic for scheduled tasks). The scaffold inherits this without modification — it only ensures the guard is on the request path.

A request bearing a `SYSTEM` JWT reaching a handler whose `@Roles` does NOT include `'SYSTEM'` MUST receive a `403 Forbidden` from `RbacGuard`. The scaffold provides no such handler; the contract applies to all future feature handlers.

## 5. Negative-path assertions (test-only diagnostic)

Inside `apps/social/src/common/__smoke__/auth-wiring.spec.ts` the implementation MUST verify, via a `Test.createTestingModule` that imports `AppModule` and registers a test-only `@Controller('scaffold-ping')` with one `@Roles('EMPLOYEE')` `@Get()` handler:

| Request | Expected status |
|---|---|
| `GET /scaffold-ping` (no `Authorization`) | `401` |
| `GET /scaffold-ping` (`Authorization: Bearer <tampered>`) | `401` |
| `GET /scaffold-ping` (`Authorization: Bearer <employee JWT>`) | `200` |
| `GET /scaffold-ping` (`Authorization: Bearer <system JWT>`) | `403` |
| `GET /health` (no `Authorization`) | `200` |

The test-only controller MUST live in the test file (not in `apps/social/src/`).

## 6. Token verification source

`SharedJwtGuard` reads the secrets and the trusted issuer/audience claims via `ConfigService`. Social MUST NOT shadow this lookup with local config. The required environment variables (`JWT_SECRET`, `SYSTEM_JWT_SECRET`) are listed in [`environment-vars.md`](./environment-vars.md).

## 7. What the scaffold does NOT do

- It does not implement role hierarchy ("MANAGER implies EMPLOYEE"). `@Roles()` is a flat allowlist as defined by `@sentient/shared`.
- It does not implement scope-based row filtering. `buildScopeFilter()` exists in `@sentient/shared` for feature modules to call inside service methods; the scaffold neither calls it nor wraps it.
- It does not implement `@CurrentUser()` extraction. The decorator is available via `@sentient/shared` and feature modules use it directly.
