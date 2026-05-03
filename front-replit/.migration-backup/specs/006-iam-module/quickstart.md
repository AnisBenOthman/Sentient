# IAM Module — Implementation Quickstart

**Branch**: `006-iam-module` | **Service**: HR Core (:3001)
**Prerequisites**: All prior modules compiled (003-employee, 004-skills, 005-leave)

---

## 1. Environment Variables

Add to `apps/hr-core/.env` (and `.env.example`):

```env
# JWT — user sessions
JWT_SECRET=change-me-in-production
JWT_EXPIRY=15m

# JWT — SYSTEM tokens (scheduled tasks, AI agents)
SYSTEM_JWT_SECRET=change-me-system-secret
SYSTEM_JWT_EXPIRY=5m

# Refresh token config
REFRESH_TOKEN_EXPIRY_DAYS=7

# Password policy
PASSWORD_HISTORY_DEPTH=5   # reject last N passwords on change

# Lockout policy
MAX_FAILED_LOGINS=5        # before account is locked
LOCKOUT_DURATION_MINUTES=15

# Argon2id params — calibrate to ~200ms on target hardware
ARGON2_MEMORY_COST=65536   # KiB
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=1
```

---

## 2. Migration Order

### Step 1 — Generate the base migration

Run from `apps/hr-core/`:
```bash
npx prisma migrate dev --name add_iam_module
```

Prisma will generate the `CREATE TABLE` SQL for all 9 new models plus the 5 new enums.

### Step 2 — Append partial unique indexes

Open the generated migration file at:
```
apps/hr-core/prisma/migrations/<timestamp>_add_iam_module/migration.sql
```

Append at the **end** of the file (after all `CREATE TABLE` statements):

```sql
-- One active role assignment per (user, role, scope entity)
-- COALESCE maps NULL → '' so two GLOBAL/OWN rows collide correctly.
CREATE UNIQUE INDEX "user_roles_active_assignment_uidx"
  ON hr_core.user_roles (user_id, role_id, COALESCE(scope_entity_id, ''))
  WHERE revoked_at IS NULL;

-- One active session per (user, channel)
CREATE UNIQUE INDEX "sessions_active_channel_uidx"
  ON hr_core.sessions (user_id, channel)
  WHERE revoked_at IS NULL;
```

### Step 3 — Verify and apply

```bash
# Verify both indexes appear
psql -U hr_core_svc -d sentient -c \
  "SELECT indexname FROM pg_indexes WHERE schemaname = 'hr_core' AND indexname LIKE '%_uidx';"

# Apply in non-dev environments
npx prisma migrate deploy
```

### Step 4 — Re-generate Prisma client

```bash
npx prisma generate
```

---

## 3. Seed Execution Order

The IAM seed MUST run before all other module seeds because every other module's seed
may reference `Role` rows (e.g., to assign roles to demo employees).

The seed is idempotent — safe to re-run.

```typescript
// apps/hr-core/prisma/seed.ts — execution order
await seedIam();        // 1. Permissions → Roles → RolePermissions → SYSTEM_ADMIN user
await seedOrg();        // 2. BusinessUnits, Departments, Teams, Positions
await seedEmployees();  // 3. Employees (links to IAM users for demo accounts)
await seedLeaves();     // 4. LeaveTypes, LeaveBalances, etc.
```

### IAM Seed Contents (`seedIam`)

1. **Permissions** — 40 seeded rows covering every `(resource, action, scope)` triple
   used by the RBAC matrix in `rules/security.md`. Full list in `seed.ts`.

2. **Built-in Roles** — 7 roles; `isSystem=true` on all:

   | code             | isEditable | Seeded permissions        |
   |------------------|------------|---------------------------|
   | `EMPLOYEE`       | true       | OWN on employee, leave    |
   | `MANAGER`        | true       | TEAM on employee, leave   |
   | `HR_ADMIN`       | true       | BU-scoped on all HR resources |
   | `EXECUTIVE`      | true       | BU-scoped READ on all     |
   | `GLOBAL_HR_ADMIN`| true       | GLOBAL on role-catalog ops|
   | `SYSTEM_ADMIN`   | false      | GLOBAL on everything      |
   | `SYSTEM`         | false      | Subset needed by scheduled tasks |

3. **SYSTEM_ADMIN user** — `email=admin@sentient.dev`, randomly generated password
   (printed to stdout ONCE during seed; store it immediately). `employeeId=null`.
   `status=ACTIVE`, `mustChangePassword=true`.

---

## 4. Module Wiring — `IamModule`

```typescript
// apps/hr-core/src/modules/iam/iam.module.ts
@Module({
  imports: [
    PrismaModule,
    ThrottlerModule,     // already global in AppModule — no re-import needed
    ScheduleModule,      // for cron jobs inside IamModule
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRY', '15m') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, UsersController, RolesController, SessionsController, AuditController],
  providers: [
    AuthService, UsersService, RolesService, SessionsService, AuditService,
    TokenService, Argon2Service, PasswordPolicyService,
    SessionCleanupCron, LockoutClearCron,
    EmployeeTerminatedListener,
  ],
  exports: [UsersService, RolesService],  // consumed by seed.ts bootstrap check
})
export class IamModule {}
```

Register `IamModule` in `AppModule` **before** all other feature modules:
```typescript
// apps/hr-core/src/app.module.ts
@Module({
  imports: [
    // ... ConfigModule, ScheduleModule (global), ThrottlerModule (global)
    IamModule,      // ← first feature module
    OrganizationModule,
    EmployeesModule,
    SkillsModule,
    LeavesModule,
    // ...
  ],
})
export class AppModule {}
```

---

## 5. Shared Package Updates

Run in order after writing the new files:

```bash
# From monorepo root
pnpm --filter @sentient/shared build
pnpm --filter hr-core build   # picks up new shared types
```

### New files to create in `packages/shared/src/`:

| File | Content |
|------|---------|
| `enums/user-status.enum.ts` | `UserStatus` TypeScript enum |
| `enums/security-event-type.enum.ts` | `SecurityEventType` enum |
| `enums/permission-action.enum.ts` | `PermissionAction` enum |
| `enums/permission-scope.enum.ts` | `PermissionScope` enum |
| `enums/channel-type.enum.ts` | `ChannelType` enum |
| `enums/role-code.enum.ts` | `RoleCode` enum |
| `auth/jwt-payload.interface.ts` | `JwtPayload`, `RoleAssignmentClaim` |
| `auth/agent-context.interface.ts` | `AgentContext` (update: add `businessUnitId` claim) |
| `auth/system-jwt-payload.interface.ts` | `SystemJwtPayload` |
| `auth/shared-jwt.guard.ts` | `SharedJwtGuard` (move from stub to real impl) |
| `auth/rbac.guard.ts` | `RbacGuard` (move from stub to real impl) |
| `auth/user-status.guard.ts` | `UserStatusGuard` (max-60s cached status check) |
| `auth/scope-filter.ts` | `buildScopeFilter` pure function |

Update `packages/shared/src/enums/index.ts` to export all 6 new enums.
Update `packages/shared/src/auth/index.ts` to export all new auth types.

---

## 6. Removing `// TODO(iam)` Comments

After `IamModule` is functional and tests pass:

```bash
# Verify zero remaining TODO(iam) comments
grep -r "TODO(iam)" apps/ packages/
# Expected output: (empty)
```

All three services need their guards activated:

- `apps/hr-core/src/**` — uncomment all `@UseGuards(SharedJwtGuard, RbacGuard)` lines
- `apps/social/src/**` — same; also activate the `SharedJwtGuard` global import
- `apps/ai-agentic/src/**` — same

The activation sweep is tracked in task **T097** (from `tasks.md`).

---

## 7. Implementation Phase Sequence

Follow the task ordering from `tasks.md`. The critical path for auth to be functional:

```
T001 Update @sentient/shared enums
T002 JwtPayload + RoleAssignmentClaim interfaces
T003 SharedJwtGuard real implementation
T004 RbacGuard real implementation
T005 Prisma schema — 5 new enums
T006 Prisma schema — 9 new models
T007 Generate + append partial-index migration
T008 Argon2Service (hash + verify)
T009 PasswordPolicyService (FR-006)
T010 TokenService (access + refresh + SYSTEM)
T011 AuthService (login flow)
T012 AuthController POST /auth/login ← first endpoint that requires running E2E
T013 AuthService (refresh + logout)
T014 AuthController POST /auth/refresh, /auth/logout
T015 Session partial-unique-index guard in SessionsService
```

After T015, the core auth loop works: login → access token → protected call → refresh → logout.
All other tasks build on this foundation.

---

## 8. Key Implementation Notes

### Argon2id params
Calibrate `ARGON2_MEMORY_COST` to target hardware so hashing takes ~200ms. During tests
use lower params (memory=4096, time=1) via `TEST_ARGON2_FAST=true` env var to keep unit
tests under 2s.

### `User.email` lowercase-on-write
```typescript
// In AuthService and UsersService — always before DB write or lookup:
const normalizedEmail = dto.email.toLowerCase().trim();
```
No CITEXT extension needed. The `@unique` index on the column then enforces uniqueness
on the already-normalized value.

### `@unique` on nullable `User.employeeId`
PostgreSQL 16 NULLS DISTINCT default means `@unique` on a nullable column allows
multiple NULL rows but enforces uniqueness among non-null values. This is correct
behavior: multiple SYSTEM_ADMIN users can exist without Employee links.

### Session grace window (R-010)
```typescript
// In SessionsService.rotate():
const GRACE_WINDOW_MS = 30_000;

if (session.previousTokenHash && crypto.timingSafeEqual(...) {
  const age = Date.now() - session.previousRotatedAt!.getTime();
  if (age <= GRACE_WINDOW_MS) {
    return { idempotent: true, currentAccessToken: reissue(session) };
  }
  // Replay detected — revoke chain
  await this.revokeChannel(session.userId, session.channel);
  throw new UnauthorizedException('Session revoked');
}
```

### `buildScopeFilter` — widest scope wins
When a user holds multiple active UserRole rows applicable to the same resource+action
(e.g., EMPLOYEE on OWN and MANAGER on TEAM), return the widest matching scope:
```typescript
// Scope ladder rank: OWN=0, TEAM=1, DEPARTMENT=2, BUSINESS_UNIT=3, GLOBAL=4
const best = applicable.reduce((a, b) => SCOPE_RANK[b.scope] > SCOPE_RANK[a.scope] ? b : a);
```

### `UserStatusGuard` — 60-second cache
```typescript
// Cache key: userId — invalidated on deactivate/lock via event
// Implementation: NestJS CacheModule (in-memory, no Redis needed for MVP)
// TTL: 60 seconds (SC-004 requirement)
```
The guard runs AFTER `SharedJwtGuard` so the JWT signature and expiry are already
verified before the (slightly cheaper) status cache lookup.

---

## 9. Testing Commands

```bash
# Unit tests for IAM module
turbo test --filter=hr-core -- --testPathPattern=iam

# Integration test (needs hr_core schema in test DB)
turbo test:integration --filter=hr-core -- --testPathPattern=iam

# Full RBAC contract matrix (cross-service)
# Run from repo root after all 3 services are started
npm run test:rbac-matrix

# Verify no TODO(iam) remains
grep -r "TODO(iam)" apps/ packages/ && exit 1 || echo "Clean"
```
