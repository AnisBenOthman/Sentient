# IAM Module — Data Model
**Schema:** `hr_core` | **New Prisma enums:** 5 | **New models:** 9 | **Modified models:** 1

---

## 1. New Prisma Enums

These enums are declared in `schema.prisma` (not TypeScript-only). They map to actual
PostgreSQL `ENUM` types in the `hr_core` schema.

### `UserStatus`
```prisma
enum UserStatus {
  PENDING_ACTIVATION  // Created; first-login password change not yet done
  ACTIVE              // Normal operational state
  LOCKED              // Temporary lockout after 5 failed logins in 15 min (auto-cleared)
  DISABLED            // Deactivated by admin or employee.terminated event

  @@schema("hr_core")
}
```

### `SecurityEventType`
```prisma
enum SecurityEventType {
  LOGIN_SUCCESS
  LOGIN_FAILED
  LOGOUT
  PASSWORD_CHANGED
  PASSWORD_RESET_REQUESTED
  PASSWORD_RESET_COMPLETED
  ROLE_GRANTED
  ROLE_REVOKED
  ROLE_CREATED
  ROLE_DELETED
  ROLE_PERMISSION_ADDED
  ROLE_PERMISSION_REMOVED
  ACCOUNT_LOCKED
  ACCOUNT_UNLOCKED
  USER_DEACTIVATED
  SESSION_REVOKED
  SYSTEM_TOKEN_ISSUED

  @@schema("hr_core")
}
```

### `PermissionAction`
```prisma
enum PermissionAction {
  CREATE
  READ
  UPDATE
  DELETE
  APPROVE

  @@schema("hr_core")
}
```

### `PermissionScope`
```prisma
enum PermissionScope {
  OWN           // Row belongs to the requesting user
  TEAM          // Within the user's team (managerId-based)
  DEPARTMENT    // Within the user's department
  BUSINESS_UNIT // Within the user's business unit
  GLOBAL        // No filter — unrestricted

  @@schema("hr_core")
}
```
**Scope ladder:** `OWN ⊂ TEAM ⊂ DEPARTMENT ⊂ BUSINESS_UNIT ⊂ GLOBAL`

### `ChannelType`
```prisma
enum ChannelType {
  WEB
  SLACK
  WHATSAPP
  EMAIL
  IN_APP

  @@schema("hr_core")
}
```
> **WHY:** `ChannelType` was previously TypeScript-only in `@sentient/shared`. Session
> tracks `channel: ChannelType` at the DB level so the session-cleanup cron and
> per-channel revocation queries can filter without application-layer decoding.

---

## 2. TypeScript-Only: `RoleCode`

`Role.code` is a free `String` in Prisma — NOT a Prisma enum. This allows tenants to
create custom roles without schema migrations.

```typescript
// packages/shared/src/enums/role-code.enum.ts
export enum RoleCode {
  EMPLOYEE      = 'EMPLOYEE',
  MANAGER       = 'MANAGER',
  HR_ADMIN      = 'HR_ADMIN',
  EXECUTIVE     = 'EXECUTIVE',
  GLOBAL_HR_ADMIN = 'GLOBAL_HR_ADMIN',
  SYSTEM_ADMIN  = 'SYSTEM_ADMIN',
  SYSTEM        = 'SYSTEM',  // Reserved for system JWTs only
}
```

---

## 3. New Prisma Models

### `User`
```prisma
model User {
  id                 String     @id @default(uuid())
  // WHY nullable @unique: PG16 NULLS DISTINCT default allows multiple NULL values.
  // Enforces 1:1 when non-null (e.g. SYSTEM_ADMIN users may have no Employee row).
  employeeId         String?    @unique
  // WHY no CITEXT: Service lowercases before write; @unique enforces exact match.
  // Avoids adding the citext extension to the schema.
  email              String     @unique
  passwordHash       String
  status             UserStatus @default(PENDING_ACTIVATION)
  mustChangePassword Boolean    @default(true)
  failedLoginCount   Int        @default(0)
  lockedUntil        DateTime?
  lastLoginAt        DateTime?
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
  deletedAt          DateTime?

  employee            Employee?            @relation(fields: [employeeId], references: [id])
  userRoles           UserRole[]
  sessions            Session[]
  securityEvents      SecurityEvent[]
  passwordHistory     PasswordHistory[]
  passwordResetTokens PasswordResetToken[]

  @@schema("hr_core")
  @@map("users")
  @@index([status])
  @@index([deletedAt])
}
```

### `Role`
```prisma
model Role {
  id          String  @id @default(uuid())
  // Uppercase snake_case convention (EMPLOYEE, HR_ADMIN).
  // Free String — custom roles possible without schema migration.
  code        String  @unique
  name        String
  description String?
  isSystem    Boolean @default(false)   // System roles cannot be deleted
  isEditable  Boolean @default(true)    // false for SYSTEM-reserved roles
  createdAt   DateTime @default(now())

  userRoles       UserRole[]
  rolePermissions RolePermission[]

  @@schema("hr_core")
  @@map("roles")
  @@index([isSystem])
}
```

### `Permission`
```prisma
model Permission {
  id       String          @id @default(uuid())
  resource String          // e.g. 'employee', 'leave_request', 'complaint'
  action   PermissionAction
  scope    PermissionScope

  rolePermissions RolePermission[]

  @@unique([resource, action, scope])
  @@schema("hr_core")
  @@map("permissions")
  @@index([resource])
}
```

### `UserRole`
```prisma
model UserRole {
  id            String          @id @default(uuid())
  userId        String
  roleId        String
  scope         PermissionScope
  // teamId | departmentId | businessUnitId; null for OWN-scope or GLOBAL-scope assignments
  scopeEntityId String?
  // WHY logical String: UserRole.assignedBy references User.id but is NOT a @relation.
  // Avoids a self-referential join on the User table in the UserRole join table.
  // Validated at the application layer.
  assignedBy    String
  assignedAt    DateTime  @default(now())
  revokedAt     DateTime?

  user User @relation(fields: [userId], references: [id])
  role Role @relation(fields: [roleId], references: [id])

  @@schema("hr_core")
  @@map("user_roles")
  @@index([userId])
  @@index([roleId])
  @@index([revokedAt])
}
// Partial unique index — enforces one active assignment per (user, role, scopeEntityId):
// Cannot be expressed in Prisma DSL; added in migration via raw SQL:
//
// CREATE UNIQUE INDEX "user_roles_active_assignment_uidx"
//   ON hr_core.user_roles (user_id, role_id, COALESCE(scope_entity_id, ''))
//   WHERE revoked_at IS NULL;
//
// WHY COALESCE: Two NULL scopeEntityId rows would not collide under standard UNIQUE;
// COALESCE(scope_entity_id, '') maps NULL → '' so two OWN/GLOBAL rows DO collide.
```

### `RolePermission`
```prisma
model RolePermission {
  id           String @id @default(uuid())
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id])
  permission Permission @relation(fields: [permissionId], references: [id])

  @@unique([roleId, permissionId])
  @@schema("hr_core")
  @@map("role_permissions")
  @@index([permissionId])
}
```

### `Session`
```prisma
model Session {
  id                String      @id @default(uuid())
  userId            String
  channel           ChannelType
  refreshTokenHash  String
  // R-010: Prior hash kept for 30 s to survive concurrent-refresh races.
  // If this hash is presented within 30 s of previousRotatedAt, return current
  // token idempotently. If presented after 30 s, treat as replay → revoke chain.
  previousTokenHash String?
  previousRotatedAt DateTime?
  userAgent         String?
  ipAddress         String?
  createdAt         DateTime    @default(now())
  lastUsedAt        DateTime    @default(now())
  expiresAt         DateTime
  revokedAt         DateTime?

  user User @relation(fields: [userId], references: [id])

  @@schema("hr_core")
  @@map("sessions")
  @@index([userId])
  @@index([expiresAt])
  @@index([revokedAt])
}
// Partial unique index — enforces one active session per (user, channel):
// Cannot be expressed in Prisma DSL; added in migration via raw SQL:
//
// CREATE UNIQUE INDEX "sessions_active_channel_uidx"
//   ON hr_core.sessions (user_id, channel)
//   WHERE revoked_at IS NULL;
//
// WHY: A new login on the same channel revokes the prior session before insert,
// so only one active row per (user, channel) should ever exist.
```

### `PasswordResetToken`
```prisma
model PasswordResetToken {
  id         String    @id @default(uuid())
  userId     String
  tokenHash  String    @unique   // SHA-256 of the raw token sent to user
  expiresAt  DateTime
  consumedAt DateTime?           // Set on use; null = unconsumed
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@schema("hr_core")
  @@map("password_reset_tokens")
  @@index([userId])
  @@index([expiresAt])
}
```

### `PasswordHistory`
```prisma
model PasswordHistory {
  id           String   @id @default(uuid())
  userId       String
  passwordHash String   // Argon2id hash of the previous password
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@schema("hr_core")
  @@map("password_history")
  @@index([userId, createdAt(sort: Desc)])
}
// WHY: The service queries the last 5 hashes (ORDER BY createdAt DESC LIMIT 5)
// and rejects any new password that matches. Descending composite index makes
// this query an index scan, not a full table scan.
```

### `SecurityEvent`
```prisma
model SecurityEvent {
  id            String            @id @default(uuid())
  userId        String?           // null for pre-auth failures (unknown user)
  eventType     SecurityEventType
  channel       ChannelType?
  ipAddress     String?
  userAgent     String?
  correlationId String?
  // WHY String not enum: Two values only ('SUCCESS' | 'FAILURE').
  // Service validates at write time — a two-value enum offers no type safety benefit
  // worth the extra Prisma enum declaration.
  outcome       String
  metadata      Json              @default("{}")
  occurredAt    DateTime          @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@schema("hr_core")
  @@map("security_events")
  @@index([userId, occurredAt(sort: Desc)])
  @@index([eventType, occurredAt(sort: Desc)])
}
```

---

## 4. Modified Models

### `Employee` — add reverse relation (no new column)

```prisma
// ADD to Employee model relations block (no new DB column):
user User?
```

The `User` model holds `employeeId String? @unique` — Employee gains only the reverse
relation field for Prisma navigation. No migration required for the Employee table itself.

---

## 5. State Machines

### 5.1 `UserStatus` Transitions

```
                ┌─────────────────────────────────────────┐
                │                                         │
PENDING_ACTIVATION ──[first-login password change]──► ACTIVE
       │                                                   │
       │[admin deactivate]                  ┌──────────────┤
       ▼                                    │              │
   DISABLED ◄──────────────────────────────┤    [5 failed logins in 15 min]
       │                                    │              │
       │[admin activate]                    │              ▼
       └───────────────────────────────────►│           LOCKED
                                            │              │
                                            │  [lockedUntil < now (cron)]
                                            │  [admin activate]
                                            │              │
                                            └──────────────┘
```

| From                | To                  | Trigger                                                          |
|---------------------|---------------------|------------------------------------------------------------------|
| PENDING_ACTIVATION  | ACTIVE              | `POST /auth/change-password` with `mustChangePassword=true` path |
| PENDING_ACTIVATION  | DISABLED            | HR_ADMIN `POST /users/:id/deactivate`                            |
| ACTIVE              | LOCKED              | `failedLoginCount` reaches 5 within 15 minutes (FR-010)          |
| LOCKED              | ACTIVE (auto)       | `lockout-clear.cron` when `lockedUntil < now()`                  |
| LOCKED              | ACTIVE (manual)     | HR_ADMIN `POST /users/:id/activate`                              |
| ACTIVE              | DISABLED            | HR_ADMIN `POST /users/:id/deactivate` OR `employee.terminated`   |
| LOCKED              | DISABLED            | HR_ADMIN `POST /users/:id/deactivate` OR `employee.terminated`   |
| DISABLED            | ACTIVE              | HR_ADMIN `POST /users/:id/activate`                              |

### 5.2 Session Lifecycle

```
[POST /auth/login]
       │
       ▼
  ACTIVE ──[POST /auth/refresh (valid hash)]──► ROTATED
    │                 │
    │                 │ previousTokenHash set; 30 s grace window open
    │                 │
    │    ┌────────────┘
    │    │  prior hash presented within 30 s
    │    ▼
    │  GRACE (idempotent — return current token, no rotation)
    │
    │  prior hash presented after 30 s
    │    ▼
    │  REPLAY DETECTED → revoke entire (userId, channel) chain → 401
    │
    ├──[POST /auth/logout]──────────────────────────────────────────► REVOKED
    ├──[HR_ADMIN revoke]────────────────────────────────────────────► REVOKED
    ├──[new login on same channel → revoke prior before insert]─────► REVOKED
    ├──[employee.terminated event]──────────────────────────────────► REVOKED
    └──[expiresAt < now()]──────────────────────────────── treated as REVOKED
                                     (session-cleanup.cron removes expired rows daily)
```

---

## 6. Partial Unique Indexes (Raw SQL)

Both indexes MUST be added in the migration file — Prisma 5 DSL cannot express
`WHERE` predicates on partial indexes.

```sql
-- UserRole: one active assignment per (user, role, scopeEntityId)
-- COALESCE maps NULL → '' so two OWN/GLOBAL rows collide correctly.
CREATE UNIQUE INDEX "user_roles_active_assignment_uidx"
  ON hr_core.user_roles (user_id, role_id, COALESCE(scope_entity_id, ''))
  WHERE revoked_at IS NULL;

-- Session: one active session per (user, channel)
CREATE UNIQUE INDEX "sessions_active_channel_uidx"
  ON hr_core.sessions (user_id, channel)
  WHERE revoked_at IS NULL;
```

**Migration checklist:**
- [ ] Let `prisma migrate dev` generate the base DDL (CREATE TABLE statements)
- [ ] Append the two `CREATE UNIQUE INDEX` statements at the end of the generated SQL
- [ ] Run `prisma migrate deploy` and verify both indexes appear in `pg_indexes`
- [ ] Do NOT use `@@unique([userId, channel])` in Prisma DSL — it would create a
      non-partial unique index, blocking multiple revoked sessions for the same channel

---

## 7. Shared Package Expansions

### 7.1 `JwtPayload` (updated interface)

```typescript
// packages/shared/src/auth/jwt-payload.interface.ts

export interface RoleAssignmentClaim {
  roleCode: string;
  scope: PermissionScope;
  scopeEntityId: string | null;  // teamId | departmentId | businessUnitId
}

export interface JwtPayload {
  sub: string;                     // User.id
  employeeId: string | null;       // null for SYSTEM_ADMIN without an Employee row
  roles: string[];                 // ['EMPLOYEE', 'MANAGER'] — RoleCode values
  departmentId: string | null;
  teamId: string | null;
  businessUnitId: string | null;
  channel: ChannelType;
  roleAssignments: RoleAssignmentClaim[];  // Full assignment list for buildScopeFilter
  iat: number;
  exp: number;
}
```

### 7.2 `buildScopeFilter`

```typescript
// packages/shared/src/auth/scope-filter.ts

/**
 * Pure function — no DB access. Consumes roleAssignments[] from the decoded JWT
 * and returns a Prisma-compatible where clause fragment for employee queries.
 * AI agents and HR Core use this identically (agents forward the user JWT).
 */
export function buildScopeFilter(
  payload: JwtPayload,
  resource: string,
  action: PermissionAction,
): { employeeId?: string; managerId?: string; departmentId?: string; businessUnitId?: string } | Record<string, never> {
  const best = resolveBestScope(payload.roleAssignments, resource, action);

  switch (best.scope) {
    case PermissionScope.OWN:
      return { id: payload.employeeId ?? '__no_match__' };
    case PermissionScope.TEAM:
      return { managerId: payload.employeeId ?? '__no_match__' };
    case PermissionScope.DEPARTMENT:
      return { departmentId: best.scopeEntityId ?? payload.departmentId ?? '__no_match__' };
    case PermissionScope.BUSINESS_UNIT:
      return { businessUnitId: best.scopeEntityId ?? payload.businessUnitId ?? '__no_match__' };
    case PermissionScope.GLOBAL:
      return {};
    default:
      throw new ForbiddenException('No permission for this resource/action');
  }
}
```

### 7.3 New enums exported from `@sentient/shared`

```typescript
// packages/shared/src/enums/index.ts — add exports:
export { UserStatus }        from './user-status.enum';
export { SecurityEventType } from './security-event-type.enum';
export { PermissionAction }  from './permission-action.enum';
export { PermissionScope }   from './permission-scope.enum';
export { ChannelType }       from './channel-type.enum';
export { RoleCode }          from './role-code.enum';
```

> All 6 enum files are new additions to `packages/shared/src/enums/`. The Prisma
> schema uses its own `enum` declarations (section 1 above); the TypeScript enums
> in `@sentient/shared` are the application-layer counterparts consumed by guards,
> services, and the frontend.

---

## 8. Index Summary

| Table                  | Index                                         | Type            | Purpose                                  |
|------------------------|-----------------------------------------------|-----------------|------------------------------------------|
| `users`                | `[status]`                                    | B-tree          | List by status (admin dashboards)        |
| `users`                | `[deletedAt]`                                 | B-tree          | Soft-delete filtering                    |
| `users`                | `email` (unique)                              | Unique B-tree   | Login lookup                             |
| `users`                | `employeeId` (unique)                         | Unique B-tree   | 1:1 guard + navigation                   |
| `roles`                | `[isSystem]`                                  | B-tree          | Filter seed vs custom roles              |
| `permissions`          | `[resource]`                                  | B-tree          | Permission lookup by resource            |
| `permissions`          | `[resource, action, scope]` (unique)          | Unique B-tree   | Dedup permission definitions             |
| `user_roles`           | `[userId]`                                    | B-tree          | User's role list                         |
| `user_roles`           | `[roleId]`                                    | B-tree          | Members of a role                        |
| `user_roles`           | `[revokedAt]`                                 | B-tree          | Active assignment queries                |
| `user_roles`           | `active_assignment_uidx` (partial unique)     | Partial unique  | One active assignment per user+role+scope|
| `role_permissions`     | `[roleId, permissionId]` (unique)             | Unique B-tree   | Dedup grants                             |
| `role_permissions`     | `[permissionId]`                              | B-tree          | Roles that have a permission             |
| `sessions`             | `[userId]`                                    | B-tree          | User's session list                      |
| `sessions`             | `[expiresAt]`                                 | B-tree          | Expiry cleanup cron                      |
| `sessions`             | `[revokedAt]`                                 | B-tree          | Active session queries                   |
| `sessions`             | `active_channel_uidx` (partial unique)        | Partial unique  | One active session per user+channel      |
| `password_reset_tokens`| `tokenHash` (unique)                          | Unique B-tree   | Token lookup on reset                    |
| `password_reset_tokens`| `[userId]`                                    | B-tree          | User's active reset tokens               |
| `password_reset_tokens`| `[expiresAt]`                                 | B-tree          | Expiry cleanup                           |
| `password_history`     | `[userId, createdAt DESC]`                    | Composite B-tree| Last-N hash reuse check                  |
| `security_events`      | `[userId, occurredAt DESC]`                   | Composite B-tree| User audit log (most recent first)       |
| `security_events`      | `[eventType, occurredAt DESC]`                | Composite B-tree| Event type analytics                     |
