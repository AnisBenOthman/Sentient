# Phase 0 Research — IAM Module

This document resolves open technical questions before schema design. Each entry is a single decision with rationale and what was rejected.

---

## R-001: Scope ladder semantics and BUSINESS_UNIT addition

**Decision**: Five scope levels form a strict, linearly ordered ladder: `OWN ⊂ TEAM ⊂ DEPARTMENT ⊂ BUSINESS_UNIT ⊂ GLOBAL`. Granting a user BUSINESS_UNIT scope automatically includes all departments and teams within that BU — no per-department fan-out, no explicit wildcard needed. `packages/shared/src/enums/permission-scope.enum.ts` gains `BUSINESS_UNIT` between `DEPARTMENT` and `GLOBAL`:

```typescript
export enum PermissionScope {
  OWN        = 'OWN',
  TEAM       = 'TEAM',
  DEPARTMENT = 'DEPARTMENT',
  BUSINESS_UNIT = 'BUSINESS_UNIT',
  GLOBAL     = 'GLOBAL',
}
```

The `buildScopeFilter` helper (in `@sentient/shared`) maps each level to a Prisma `where` fragment:

| Level | Prisma fragment |
|---|---|
| OWN | `{ id: user.employeeId }` |
| TEAM | `{ OR: [{ managerId: user.employeeId }, { id: user.employeeId }] }` |
| DEPARTMENT | `{ departmentId: user.departmentId }` |
| BUSINESS_UNIT | `{ department: { businessUnitId: user.businessUnitId } }` |
| GLOBAL | `{}` |

When multiple UserRole rows grant overlapping permissions, `buildScopeFilter` returns the `OR`-union of the individual fragments (widest scope wins). This is a pure TypeScript function with no DB access on the hot path — consistent with SC-002 (<10ms auth path).

**Rationale**: The four-level model (OWN/TEAM/DEPARTMENT/GLOBAL) already existed in prior modules. Inserting BUSINESS_UNIT between DEPARTMENT and GLOBAL cleanly models multi-BU organisations where HR_ADMIN should see their BU without seeing the whole platform. The implicit inclusion property eliminates fan-out — an HR_ADMIN with BU scope does not need explicit rows per department.

**Alternatives rejected**:
- Keeping four levels (skip BUSINESS_UNIT): `HR_ADMIN` would need GLOBAL scope and would see all BUs, breaking multi-BU isolation.
- Non-linear scopes (e.g., `PROJECT`, `LOCATION`): Would require a lattice rather than a ladder and make `buildScopeFilter` unpredictably complex.
- Bit-flag scopes: Efficient to store but impossible to reason about per-assignment semantics clearly.

---

## R-002: UserRole.scopeEntityId design and partial unique index

**Decision**: Scope lives on the `UserRole` join row, not on `User` or `Employee`. Each `UserRole` carries two fields beyond `roleId`:

```prisma
model UserRole {
  id            String         @id @default(uuid())
  userId        String
  roleId        String
  scope         PermissionScope
  scopeEntityId String?        // teamId | departmentId | businessUnitId; null for OWN/GLOBAL

  assignedBy    String
  assignedAt    DateTime       @default(now())
  revokedAt     DateTime?

  user  User @relation(fields: [userId], references: [id])
  role  Role @relation(fields: [roleId], references: [id])

  @@schema("hr_core")
  @@map("user_roles")
}
```

The active-assignment uniqueness constraint is a **partial unique index** — `(userId, roleId, scopeEntityId) WHERE revokedAt IS NULL` — preventing duplicate active assignments. Prisma's `@@unique()` does not support `WHERE` natively, so this must be added as raw SQL in the migration:

```sql
CREATE UNIQUE INDEX "user_roles_active_assignment_uidx"
  ON hr_core.user_roles (user_id, role_id, COALESCE(scope_entity_id, ''))
  WHERE revoked_at IS NULL;
```

`COALESCE(scope_entity_id, '')` collapses nulls so that two OWN-scope rows for the same (user, role) pair still collide — without it, two NULL scopeEntityId rows would not violate uniqueness (SQL NULL ≠ NULL). The Prisma migration file must contain this statement verbatim after Prisma generates the table DDL.

**Rationale**: Attaching scope to the assignment (not the user) lets one person simultaneously hold MANAGER-TEAM and HR_ADMIN-BU without schema duplication. The partial unique index prevents accidental double-assignment while still allowing the same (userId, roleId, scopeEntityId) to exist in history (old revoked row + new active row).

**Alternatives rejected**:
- Scope on `User`: Forces one scope per user — breaks multi-role, multi-scope scenarios (e.g., a person who manages a team AND is a department manager).
- Scope on `Permission`: Would bloat the permission catalog and make runtime grant/revoke impossible without schema changes.
- Full unique index without `WHERE`: Would prevent re-assigning a role after revocation — unusable.
- Standard `@@unique([userId, roleId, scopeEntityId])` in Prisma without raw SQL override: Doesn't support partial uniqueness; revoked + active rows would collide on re-assignment.

---

## R-003: MANAGER scope-polymorphism

**Decision**: `MANAGER` is a single role code. Its effective reach is determined entirely by the `scope` and `scopeEntityId` on the `UserRole` row, not by a separate role code:

| Assignment | scope | scopeEntityId | Effect |
|---|---|---|---|
| Team manager of team T | `TEAM` | `teamId=T` | Sees employees where `managerId = self.employeeId` |
| Department manager of dept D | `DEPARTMENT` | `departmentId=D` | Sees employees where `departmentId = D` |

A person can hold both simultaneously (two `UserRole` rows). `buildScopeFilter` detects multiple applicable MANAGER rows and returns the union of their fragments. No special-case logic in the service layer — scope resolution is entirely within `buildScopeFilter`.

The `roleAssignments[]` array in the JWT carries both rows:
```json
[
  { "roleCode": "MANAGER", "scope": "TEAM",       "scopeEntityId": "team-uuid-T" },
  { "roleCode": "MANAGER", "scope": "DEPARTMENT",  "scopeEntityId": "dept-uuid-D" }
]
```

**Rationale**: Avoids separate `TEAM_MANAGER` and `DEPT_MANAGER` role codes that would diverge over time in permission configuration. Keeps the role catalog flat and small. Scope polymorphism is the documented design decision from plan.md and spec.md.

**Alternatives rejected**:
- Separate `TEAM_MANAGER` and `DEPT_MANAGER` role codes: Doubles role catalog entries; two sets of `RolePermission` rows to maintain independently.
- A `managerType` field on `UserRole`: Adds a domain column to a generic join table; the same information is conveyed by `scope`.

---

## R-004: HR_ADMIN split — BU-default and GLOBAL_HR_ADMIN

**Decision**: Two distinct role codes:

| Role | Code | Default scope | scopeEntityId |
|---|---|---|---|
| Business-unit HR admin | `HR_ADMIN` | `BUSINESS_UNIT` | Required (businessUnitId) |
| Platform-wide HR admin | `GLOBAL_HR_ADMIN` | `GLOBAL` | Null |

`HR_ADMIN` assignment **requires** `scopeEntityId` to be a valid `businessUnitId`. The assignment endpoint validates this:

```typescript
if (dto.roleCode === RoleCode.HR_ADMIN && !dto.scopeEntityId) {
  throw new BadRequestException('HR_ADMIN assignment requires a businessUnitId scopeEntityId');
}
```

`GLOBAL_HR_ADMIN` is a separate seeded role (`isSystem=true, isEditable=true`) and the sole role that may create, delete, or permission-tune custom roles (FR-051..FR-056). No user can hold GLOBAL_HR_ADMIN without an explicit assignment; it is not auto-upgraded from HR_ADMIN at any threshold.

**Rationale**: Single `HR_ADMIN` with nullable scope would require the service to assume GLOBAL when scopeEntityId is absent — creating a silent privilege escalation risk. Two explicit role codes make the privilege boundary a code-time assertion, not a runtime if-branch.

**Alternatives rejected**:
- Single `HR_ADMIN` with nullable `scopeEntityId` (null = GLOBAL): Silent privilege escalation if scopeEntityId is accidentally omitted.
- `HR_ADMIN` with `GLOBAL` scope: Gives all HR admins cross-BU visibility — breaks multi-BU tenant isolation.
- An `isGlobal` boolean on the `UserRole` row: Adds a field whose semantics duplicate what scope=GLOBAL already expresses.

---

## R-005: JWT payload — roleAssignments[] array and widest-scope union semantics

**Decision**: The access token payload carries a `roleAssignments[]` array rather than a single flattened `scope` claim:

```typescript
interface JwtPayload {
  sub: string;
  employeeId: string | null;
  roles: string[];            // ['EMPLOYEE', 'MANAGER'] — deduplicated role codes
  departmentId: string | null;
  teamId: string | null;
  businessUnitId: string | null;
  channel: ChannelType;
  roleAssignments: RoleAssignmentClaim[];
  iat: number;
  exp: number;
}

interface RoleAssignmentClaim {
  roleCode: string;
  scope: PermissionScope;
  scopeEntityId: string | null;
}
```

`buildScopeFilter(user: JwtPayload, resource: string, action: PermissionAction)` iterates `user.roleAssignments`, finds all assignments whose role grants `(resource, action)` permission (resolved from the seeded RolePermission catalog baked into the shared package at build time), and returns the `OR`-union of their Prisma fragments. The function never touches the DB; it compares `roleAssignments` to a static permission map imported from `@sentient/shared`.

Token size: 7 built-in roles × 1 row average = ~7 assignments per typical user; at most ~20 for a multi-role administrator. Base64url-encoded JSON overhead is acceptable for HS256 JWT on HTTP/1.1.

**Rationale**: A single flattened `scope` claim (e.g., just `"scope": "DEPARTMENT"`) cannot express that a user is simultaneously OWN-scoped as EMPLOYEE and TEAM-scoped as MANAGER. Flattening to the widest scope only at token-issue time would mean a MANAGER with a TEAM-scoped assignment would always see all employees at TEAM scope even when exercising EMPLOYEE-only endpoints — leaking peer data. The `roleAssignments[]` array keeps assignments distinct so `buildScopeFilter` can apply the correct scope per endpoint permission.

**Alternatives rejected**:
- Single `scope` claim (widest assignment at issue time): Cannot distinguish "I am EMPLOYEE (OWN) AND MANAGER (TEAM)" — always applies team scope even to self-only endpoints.
- Separate `roles[]` + `scopes[]` parallel arrays: No way to associate role code with its scope without an index — fragile and unreadable.
- DB round-trip on every request to resolve permissions: Violates SC-002 (<10ms, no DB on hot path).
- Encoding assignments as a map `{ roleCode: scope }`: Breaks when the same role code has multiple scope assignments (two MANAGER rows for team + dept).

---

## R-006: Token algorithm — HS256 + separate SYSTEM_JWT_SECRET

**Decision**: Both user tokens and SYSTEM tokens use HS256 (symmetric HMAC-SHA256) from the `jsonwebtoken` npm package. They use **two distinct signing keys**:

| Token type | Env var | TTL | Audience |
|---|---|---|---|
| User access token | `JWT_SECRET` | 15 min (configurable via `JWT_EXPIRY`) | All three services |
| SYSTEM task token | `SYSTEM_JWT_SECRET` | ≤5 min (hard-coded max) | Specific SYSTEM-allowlisted endpoints |

The `SharedJwtGuard` validates only with `JWT_SECRET`. A separate thin guard (used only on SYSTEM-allowlisted endpoints) validates with `SYSTEM_JWT_SECRET`. This means a forged user token with `roles: ['SYSTEM']` is rejected by the SYSTEM-endpoint guard because it was not signed with `SYSTEM_JWT_SECRET`, and a leaked SYSTEM token is rejected by `SharedJwtGuard` because it was not signed with `JWT_SECRET`.

Clock-skew leeway: `clockTolerance: 60` seconds passed to `jwt.verify()` on both guards.

**Rationale**: Key separation ensures the SYSTEM token is structurally different from user tokens — not just a role claim difference. Rotating `SYSTEM_JWT_SECRET` invalidates all in-flight SYSTEM tokens without affecting user sessions. HS256 is sufficient for a single-operator FYP platform; RS256 is deferred (requires key management infrastructure).

**Alternatives rejected**:
- Single `JWT_SECRET` for both token types: A SYSTEM token leak could be mistaken for a user token by the guard — guards must compare secret to distinguish, which creates a secret-comparison branch that is easy to get wrong.
- RS256 (asymmetric): Correct choice long-term but requires a PKI setup (private key for HR Core, public key distributed to Social/AI Agentic) — operational complexity not justified for MVP.
- JWE (encrypted JWTs): Hides payload claims from clients but adds complexity; for internal services on a private network, signing alone is sufficient.

---

## R-007: Argon2id parameters calibrated to ~200ms

**Decision**: The `argon2` npm package is used with the following explicit parameters:

```typescript
import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type:        argon2.argon2id,
  memoryCost:  19456,   // 19 MiB — OWASP minimum for Argon2id (2024 rec)
  timeCost:    2,       // 2 iterations
  parallelism: 1,       // single thread (Node.js is single-threaded per worker)
};

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

These parameters target ~200ms on a 2024-era development laptop (Intel/AMD x64, 8GB RAM). On production hardware (faster CPU, more RAM), timing will be slightly lower — this is acceptable; the goal is a lower bound of ~100ms to resist offline cracking, not an exact target. Parameters are module-level constants in `argon2.service.ts` and are NOT configurable via env vars (to prevent accidental downgrade in production).

The `Argon2Service` is `@Injectable()` and lives in `modules/iam/password/argon2.service.ts`. It is only ever imported by `AuthService` and `PasswordPolicyService` — no other module calls it directly.

**Rationale**: OWASP 2024 recommends Argon2id with memoryCost=19456, timeCost=2, parallelism=1 as a minimum. Argon2id is resistant to both side-channel attacks (Argon2i strength) and GPU parallelism (Argon2d strength). bcrypt is limited to 72-byte effective key length and is not memory-hard. The 200ms target balances login UX (within SC-001's 3s budget) against attacker cost (each guess costs ~200ms × CPU on their side too).

**Alternatives rejected**:
- `bcrypt` (10 rounds): Not memory-hard; GPU parallelism breaks it at scale. 72-byte truncation is a foot-gun for long passphrases.
- `scrypt` via Node crypto: Correct choice but no npm-level argon2 FFI; less ecosystem support; OWASP recommends Argon2id over scrypt.
- Configurable Argon2 params via env vars: Risk of `memoryCost=1` in production; constants in code are the only safe option.

---

## R-008: Session per-channel uniqueness via partial unique index

**Decision**: The `Session` table enforces **at most one active session per (userId, channel)** via a raw-SQL partial unique index — Prisma `@@unique` does not support `WHERE` predicates, so the migration must add it explicitly:

```sql
CREATE UNIQUE INDEX "sessions_active_channel_uidx"
  ON hr_core.sessions (user_id, channel)
  WHERE revoked_at IS NULL;
```

When a user signs in on a channel that already has an active session, the existing session is revoked before the new session is inserted:

```typescript
// Inside a $transaction([...], { isolationLevel: 'Serializable' })
await prisma.session.updateMany({
  where: { userId, channel, revokedAt: null },
  data:  { revokedAt: new Date() },
});
const session = await prisma.session.create({ data: { userId, channel, ... } });
```

The partial unique index is fresh — no DROP INDEX concern from the `feedback_prisma_migration_constraints` memory, since this table did not exist in prior migrations.

`refreshTokenHash` is the SHA-256 hex digest of the opaque random token (32 bytes from `crypto.randomBytes(32).toString('hex')`). The raw token is returned to the client exactly once at login/refresh; only the hash is stored.

**Rationale**: Single-active-session-per-channel prevents a user from being signed in to the same Slack workspace or web app twice from different devices — a deliberate MVP constraint (FR-035). Revoke-before-insert rather than upsert ensures the old session is audited (revokedAt set) and the security event is emitted before the new row is created.

**Alternatives rejected**:
- Multiple active sessions per channel per user (full device granularity): Requires device fingerprinting to be meaningful, deferred to post-MVP.
- `@@unique([userId, channel])` without `WHERE` in Prisma schema: Prevents re-creation of a session after the old one is revoked — unusable.
- Unique constraint in Prisma `schema.prisma` using `@@unique`: Prisma 5 does not support partial unique indexes in the DSL; raw SQL in the migration is the only path.

---

## R-009: User-status freshness strategy — 60s cache and UserStatusGuard

**Decision**: `SharedJwtGuard` validates the token signature in-memory with no DB access. A **separate** `UserStatusGuard`, applied after `SharedJwtGuard`, performs a DB lookup to check the user's current `status`:

```typescript
@Injectable()
export class UserStatusGuard implements CanActivate {
  private readonly cache = new Map<string, { status: UserStatus; cachedAt: number }>();
  private readonly TTL_MS = 60_000;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user: JwtPayload = context.switchToHttp().getRequest().user;
    const now = Date.now();
    const cached = this.cache.get(user.sub);

    if (cached && now - cached.cachedAt < this.TTL_MS) {
      return cached.status === UserStatus.ACTIVE;
    }

    const fresh = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { status: true },
    });
    const status = fresh?.status ?? UserStatus.DISABLED;
    this.cache.set(user.sub, { status, cachedAt: now });
    return status === UserStatus.ACTIVE;
  }
}
```

The in-memory Map is per-process; for single-instance MVP this is sufficient. Cache invalidation: when HR_ADMIN deactivates a user, the `UsersService` explicitly calls `userStatusCache.invalidate(userId)` — since both guards live in the same process, direct invalidation works. This guarantees the 60-second window is a maximum, not a minimum.

`UserStatusGuard` is **not applied globally** — it is applied per-controller at the endpoint level, after `SharedJwtGuard`. High-throughput read endpoints that don't involve sensitive data may opt to apply only `SharedJwtGuard` (acceptable latency trade-off documented in each controller with a comment).

**Rationale**: Full DB check on every request would destroy SC-002 (<10ms auth P95). Pure JWT (no freshness check) violates SC-004 (≤60s propagation of DISABLED status). The two-guard split lets the hot path remain DB-free while termination events propagate within the SLA. Direct cache invalidation on deactivation brings the effective propagation time to <1s for the same process, with the 60s bound as a worst-case for deployments with multiple replicas.

**Alternatives rejected**:
- Embed `UserStatus` in the JWT: Requires token reissuance to propagate status change — maximum 15-minute propagation, far exceeding SC-004.
- Redis-backed distributed cache: Correct for multi-replica deployments; adds operational dependency not justified for MVP single-node.
- DB check on every request (no cache): SC-002 violation; adds 10–20ms per request at the DB round-trip.
- `jti` (JWT ID) revocation list: Append-only blacklist grows unboundedly; still needs external store for multi-replica.

---

## R-010: Refresh-token rotation and replay detection with concurrent-refresh grace window

**Decision**: Refresh-token rotation follows the **detect-and-revoke-chain** pattern from RFC 6819 §5.2.2.3 (token chain revocation on replay), with one modification: a **30-second concurrent-refresh grace window** to handle the multi-tab race condition.

The `Session` row carries:

```prisma
refreshTokenHash    String    // SHA-256 hex of the current valid refresh token
previousTokenHash   String?   // SHA-256 hex of the immediately prior token (kept 30s)
previousRotatedAt   DateTime? // when the prior token was rotated out
```

On `POST /auth/refresh`:

1. Compute `inputHash = SHA256(providedToken)`.
2. Look up session by `refreshTokenHash = inputHash`.
   - **Found (normal path)**: rotate — store old hash in `previousTokenHash`, set `previousRotatedAt = now`, issue new token with new hash, update `lastUsedAt`.
3. If not found by current hash, check `previousTokenHash = inputHash` AND `previousRotatedAt > now - 30s`.
   - **Found in grace window**: return the **same current token** (no new rotation) — the second tab's request arrived within 30s and was de-duplicated. This is idempotent: same response, no state change.
4. If not found at all (or grace window expired): treat as **replay attack**.
   - Revoke the entire `(userId, channel)` session chain: `UPDATE sessions SET revokedAt = now WHERE userId = X AND channel = Y AND revokedAt IS NULL`.
   - Emit `SecurityEvent(SESSION_REVOKED, outcome='FAILURE', metadata: { reason: 'replay_detected' })`.
   - Return 401.

This reconciles FR-014 (strict replay revocation) with the edge case in spec.md (two tabs refreshing simultaneously within 30s must NOT log out all sessions).

**Rationale**: Strict replay-only detection (no grace window) logs out legitimate multi-tab users who race to refresh — a UX failure that causes support tickets. The 30-second grace window is short enough that a real attacker cannot rely on it (they'd need to steal the token AND race against the legitimate client within 30s of the same rotation). Storing `previousTokenHash` adds one column and zero joins on the happy path.

**Alternatives rejected**:
- No grace window (pure detect-and-revoke): Logs out all tabs when two refresh simultaneously — unacceptable UX for multi-tab web apps.
- Refresh-token family (linked list of all prior tokens): More complete but requires a separate table per rotation; adds complexity for a narrow edge case.
- Nonce/counter approach: Requires client cooperation (counter storage) and adds clock-sync complexity.

---

## R-011: Password policy and reuse history guard

**Decision**: Password policy is enforced by `PasswordPolicyService.validate(password: string, user: UserForPolicy): PolicyViolation[]`:

```typescript
interface UserForPolicy {
  email: string;
  passwordHashes: string[]; // last 5 hashes from PasswordHistory table
}

interface PolicyViolation {
  rule: 'MIN_LENGTH' | 'UPPERCASE' | 'LOWERCASE' | 'DIGIT' | 'SYMBOL' | 'EMAIL_LOCAL' | 'REUSE';
  message: string;
}
```

Rules (all configurable via env vars with the following defaults):

| Rule | Default | Env var |
|---|---|---|
| Minimum length | 12 chars | `PASSWORD_MIN_LENGTH` |
| Uppercase required | ≥1 | `PASSWORD_REQUIRE_UPPERCASE=true` |
| Lowercase required | ≥1 | `PASSWORD_REQUIRE_LOWERCASE=true` |
| Digit required | ≥1 | `PASSWORD_REQUIRE_DIGIT=true` |
| Symbol required | ≥1 | `PASSWORD_REQUIRE_SYMBOL=true` |
| Not equal to email local-part | enforced | — |
| Reuse guard (last N) | 5 | `PASSWORD_REUSE_HISTORY=5` |

The reuse guard requires a **`PasswordHistory`** table (not in the spec entity list but required by FR-006):

```prisma
model PasswordHistory {
  id           String   @id @default(uuid())
  userId       String
  passwordHash String
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@schema("hr_core")
  @@map("password_history")
  @@index([userId, createdAt(sort: Desc)])
}
```

On every password change or reset, the service:
1. Fetches the 5 most recent `PasswordHistory` rows for the user.
2. Calls `argon2.verify(storedHash, newPassword)` for each — if any match, emit `PolicyViolation('REUSE')`.
3. On success, inserts a new row and (if >5 rows exist) deletes the oldest beyond the 5-row window.

The `validate()` function returns all violations at once (not fail-fast) so the UI can display every violated rule in a single round-trip.

**Rationale**: The reuse guard requires persisting prior hashes — argon2 hashes are not reversible, so the only way to check "was this password used before?" is to attempt `argon2.verify()` against stored hashes. The separate `PasswordHistory` table avoids bloating `User` with an array column. All policy rules are checked together to reduce round-trips for the user correcting their password.

**Alternatives rejected**:
- Storing last 5 hashes as a JSON array on `User`: Works for small N but pollutes the user entity; makes migration harder if N changes.
- HMAC of password stored for fast comparison: Breaks with Argon2 (the whole point of Argon2 is slow, memory-hard hashing); fast comparison undermines the reuse guard's security.
- Policy rules hardcoded (no env vars): Correct for security-critical values like `MIN_LENGTH`, but user expects HR_ADMIN configurability eventually; env vars are the right escape hatch without a settings table.

---

## R-012: employee.terminated event listener wiring

**Decision**: `EmployeeTerminatedListener` lives at `apps/hr-core/src/modules/iam/listeners/employee-terminated.listener.ts` and subscribes to the `IEventBus` using the existing `@OnEvent('employee.terminated')` pattern from `@nestjs/event-emitter` (Phase 1 in-process bus, Phase 2 Kafka):

```typescript
@Injectable()
export class EmployeeTerminatedListener {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('employee.terminated')
  async handle(event: DomainEvent<EmployeeTerminatedPayload>): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { employeeId: event.payload.employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!user) return; // Employee had no User account — no-op

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data:  { status: UserStatus.DISABLED },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data:  { revokedAt: new Date() },
      }),
    ]);
    // Cache invalidation — immediate propagation
    this.userStatusCache.invalidate(user.id);
  }
}
```

The listener is registered in `IamModule`'s `providers` array. The transaction is atomic — either both writes succeed or neither does. If the Employees module fires the event in a transaction that rolls back, the listener's handler is called speculatively; but since the event is fired only on committed termination (current Employees module behavior), this is safe.

**Rationale**: The listener pattern keeps the IAM module decoupled from the Employees module — no cross-module Prisma query, no service import. `@OnEvent` is already the established pattern in this codebase (Phase 1 in-process). The `IamModule` is self-contained; the Employees module has no knowledge of IAM.

**Alternatives rejected**:
- Direct service call from `EmployeesService` into `UsersService`: Crosses module boundaries, creates circular dependency risk.
- Scheduled cleanup job that polls for terminated employees: Adds polling lag (up to job interval) — FR-029 requires immediate revocation.
- Separate microservice endpoint (`PATCH /users/terminate?employeeId=X`) called by Employees module: Viable but over-engineers Phase 1 inter-module communication; event is cleaner.

---

## R-013: Seed order and idempotency

**Decision**: The IAM seed runs as the **first** section of `apps/hr-core/prisma/seed.ts`, before all other module seeds (departments, teams, employees, leave types, holidays). Order within IAM seed:

```
1. Permissions   — upsert on (resource, action, scope) — ~40 rows
2. Roles         — upsert on (code) — 7 rows
3. RolePermissions — upsert on (roleId, permissionId) — ~80 rows
4. SYSTEM_ADMIN User — upsert on (email); sets mustChangePassword=true
5. SYSTEM_ADMIN UserRole — upsert on (userId, roleId, scopeEntityId=null) WHERE revokedAt IS NULL
```

All upserts use Prisma's `upsert()` with matching `where` clause so re-running the seed is idempotent:

```typescript
await prisma.permission.upsert({
  where:  { resource_action_scope: { resource, action, scope } },
  create: { resource, action, scope },
  update: {},  // no-op if exists
});
```

The `SYSTEM_ADMIN` bootstrap credentials are read from env vars `SEED_SYSTEM_ADMIN_EMAIL` and `SEED_SYSTEM_ADMIN_PASSWORD` (not committed to any file). The seed script hashes the password with the production Argon2id params before insert — the plaintext never touches the DB. After first successful login, `mustChangePassword=true` forces password rotation.

The permission catalog (`resource × action × scope` triples) is the authoritative RBAC matrix from `.claude/rules/security.md`. Any endpoint added after IAM ships must have a corresponding permission row in the catalog; the contract test suite (`rbac-matrix.contract.spec.ts`) fails if a permission-endpoint mapping is missing.

**Rationale**: Downstream seeds need `Role` rows to exist before they can seed employees with `UserRole` assignments. Idempotency via upsert (not truncate-and-reseed) preserves any runtime state that HR_ADMIN may have added — re-running the seed doesn't destroy custom roles or manually-assigned roles. Reading credentials from env vars ensures they never appear in git history.

**Alternatives rejected**:
- `createMany()` with `skipDuplicates: true`: Works for creation but doesn't let the update path be a no-op; upsert is cleaner for catalog items.
- Truncate-and-reseed pattern: Destroys runtime data (custom roles, user-role assignments); unsuitable for a production seed.
- Hardcoded SYSTEM_ADMIN password in seed: An obvious security violation — flagged in `rules/security.md` and `feedback_security_sql_scripts.md` memory.

---

## R-014: Removing TODO(iam) sites — CI enforcement mechanism

**Decision**: Removing `// TODO(iam)` comments (FR-048, SC-011) is enforced by a **Jest test step in CI**, not a lint rule, because the project's ESLint setup does not have a "no-todo" rule and adding a custom lint rule would require publishing a plugin. The enforcement mechanism:

```typescript
// test/contracts/rbac-matrix.contract.spec.ts — top of file
import { execSync } from 'child_process';

describe('TODO(iam) cleanup gate', () => {
  it('should have zero TODO(iam) markers in source code (SC-011)', () => {
    const result = execSync(
      'git grep --count "TODO(iam)" -- "*.ts" || true',
      { encoding: 'utf8' },
    ).trim();
    expect(result).toBe('');
  });
});
```

This test runs as part of `turbo test --filter=hr-core` in CI. A single failing assertion blocks the merge — no manual grep needed. The `|| true` prevents `git grep` from exiting with code 1 (not found = success) from being misread by `execSync`.

The removal itself is a mechanical operation: for each `TODO(iam)` comment that wraps `@UseGuards(SharedJwtGuard, RbacGuard)` or `@Roles(...)`:
1. Uncomment the decorator.
2. Ensure the guard is imported at the top of the file.
3. Verify the `@Roles(...)` value matches the endpoint row in `rules/security.md`.

The PR description for the IAM module notes that T037 (remove TODO(iam) markers from HR Core) and equivalent tasks for Social and AI Agentic are part of the same release.

**Rationale**: A contract test that literally runs `git grep` is proof that SC-011 is met at merge time — no human auditor needed. ESLint no-todo plugins exist but require project setup not yet in place; the grep test is simpler and just as authoritative. CI gate blocks the PR from merging with any stale marker.

**Alternatives rejected**:
- ESLint `no-warning-comments` rule: Would catch all TODO comments, not just `TODO(iam)`; too broad and would require suppressing other legitimate TODOs.
- Manual audit checklist in PR template: Relies on human diligence — fails when a maintainer skips it.
- Shell script in `package.json` pre-push hook: Not enforced in CI; can be bypassed locally.

---

## R-015: Role configurability — Option B (custom roles from fixed catalog, isSystem/isEditable flags)

**Decision**: Option B confirmed. The platform's permission catalog is **fixed** (seeded at deployment, not modifiable at runtime). `GLOBAL_HR_ADMIN` may create custom roles and assign any permission from the catalog to them. Built-in roles (except SYSTEM and SYSTEM_ADMIN) have their permission sets tuneable by GLOBAL_HR_ADMIN.

Two boolean flags on `Role` encode the invariants:

| Flag | Meaning | Who controls |
|---|---|---|
| `isSystem` | Seeded by platform; cannot be deleted | Immutable after seed |
| `isEditable` | Permission set can be tuned | Immutable after seed; false only for SYSTEM and SYSTEM_ADMIN |

Concrete flag values for seeded roles:

| Role | isSystem | isEditable |
|---|---|---|
| EMPLOYEE | true | true |
| MANAGER | true | true |
| HR_ADMIN | true | true |
| EXECUTIVE | true | true |
| GLOBAL_HR_ADMIN | true | true |
| SYSTEM_ADMIN | true | **false** |
| SYSTEM | true | **false** |

Custom roles created by GLOBAL_HR_ADMIN: `isSystem=false, isEditable=true`.

The guard logic for role-catalog endpoints:

```typescript
// In RolesService.updatePermissions(roleId, ...)
if (!role.isEditable) {
  throw new ForbiddenException('Role permissions are locked');
}

// In RolesService.deleteRole(roleId)
if (role.isSystem) {
  throw new ConflictException('System roles cannot be deleted');
}
const activeAssignments = await this.prisma.userRole.count({
  where: { roleId, revokedAt: null },
});
if (activeAssignments > 0) {
  throw new ConflictException('Role has active assignments — revoke all assignments before deleting');
}
```

The `RoleCode` enum in `packages/shared/src/enums/role-code.enum.ts` is a reference-only enum for seed scripts and type-safety; `Role.code` in Prisma is a plain `String` field at runtime, allowing custom role codes without schema changes.

**Rationale**: Option B matches the user's stated need: "GLOBAL_HR_ADMIN can create/delete custom roles from a fixed seeded permission catalog". The fixed catalog is important — dynamic permission creation (Option A) requires protecting every new permission with its own endpoint logic, which cannot be automated without code; it is a feature that generates bugs silently. Option C (no custom roles) was rejected because the user explicitly asked for role creation. Option B strikes the balance: catalog is safe (no new attack surface), roles are flexible (org-specific bundles).

**Alternatives rejected**:
- Option A (fully dynamic permissions — new resource/action pairs at runtime): Any misconfigured permission (e.g., `action: 'SUPERUSER'`) bypasses the RBAC matrix. The catalog would need a second-order authorization layer to protect it. Out of scope for FYP.
- Option C (read-only role catalog, no custom roles): Rejected by user — role configurability is an explicit requirement (US7, FR-051..FR-056).
- Storing `isSystem`/`isEditable` in code only (not in DB): Runtime checks would require a compile-time list of locked roles — fragile, breaks if new roles are added without updating the allowlist.

---

## Summary of decisions

| # | Topic | Key choice |
|---|---|---|
| R-001 | Scope ladder | OWN ⊂ TEAM ⊂ DEPARTMENT ⊂ BUSINESS_UNIT ⊂ GLOBAL; BU implicit inclusion; pure `buildScopeFilter` |
| R-002 | UserRole.scopeEntityId + partial unique index | Scope per-assignment; raw SQL `WHERE revoked_at IS NULL` with COALESCE |
| R-003 | MANAGER scope-polymorphism | Single role code, scope set per UserRole row; union in buildScopeFilter |
| R-004 | HR_ADMIN split | HR_ADMIN=BU-scoped (scopeEntityId required); GLOBAL_HR_ADMIN=GLOBAL |
| R-005 | JWT payload | `roleAssignments[]` array; widest-scope union; no DB round-trip on hot path |
| R-006 | Token algorithm | HS256; two secrets (JWT_SECRET / SYSTEM_JWT_SECRET); 60s clock leeway |
| R-007 | Argon2id params | memoryCost=19456, timeCost=2, parallelism=1; ~200ms; constants not env-configurable |
| R-008 | Session uniqueness | Partial unique index (userId, channel) WHERE revoked_at IS NULL; raw SQL migration |
| R-009 | User-status freshness | SharedJwtGuard (DB-free) + UserStatusGuard (60s in-memory Map + direct invalidation) |
| R-010 | Refresh-token rotation + replay | Detect-and-revoke-chain; 30s concurrent-refresh grace window via previousTokenHash |
| R-011 | Password policy + reuse history | PasswordHistory table; 5-hash reuse guard; validate all rules at once |
| R-012 | employee.terminated listener | @OnEvent in IamModule; single atomic transaction; direct cache invalidation |
| R-013 | Seed order + idempotency | Permissions → Roles → RolePermissions → SYSTEM_ADMIN; Prisma upsert; env-var credentials |
| R-014 | TODO(iam) removal gate | Jest test with git grep in CI; zero matches required to pass |
| R-015 | Role configurability | Option B — fixed catalog, custom roles; isSystem/isEditable flags on Role |
