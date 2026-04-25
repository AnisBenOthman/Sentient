# IAM Module — REST API Contract

**Service**: HR Core (:3001) | **Router prefix**: `/api`
**Auth**: `SharedJwtGuard` + `RbacGuard` on all endpoints except where marked **[PUBLIC]**

---

## 1. Shared Types

### `AccessTokenResponse`
```typescript
{
  accessToken:  string;   // signed JWT, 15-min TTL
  refreshToken: string;   // opaque random, 7-day TTL — returned ONCE, never again
  expiresIn:    number;   // seconds until access token expires (e.g. 900)
  tokenType:    'Bearer';
  user: {
    id:               string;
    email:            string;
    status:           UserStatus;
    mustChangePassword: boolean;
    employeeId:       string | null;
    roles:            string[];       // e.g. ['EMPLOYEE', 'MANAGER']
  };
}
```

### `JwtPayload` (inside access token)
```typescript
{
  sub:              string;           // User.id
  employeeId:       string | null;
  roles:            string[];
  departmentId:     string | null;
  teamId:           string | null;
  businessUnitId:   string | null;
  channel:          ChannelType;
  roleAssignments: Array<{
    roleCode:      string;
    scope:         PermissionScope;
    scopeEntityId: string | null;
  }>;
  iat: number;
  exp: number;
}
```
**No PII in token payload** — no email, name, salary.

### `UserPublicProfile`
```typescript
{
  id:                string;
  email:             string;
  status:            UserStatus;
  mustChangePassword: boolean;
  employeeId:        string | null;
  roles:             string[];
  failedLoginCount:  number;
  lockedUntil:       string | null;  // ISO 8601
  lastLoginAt:       string | null;
  createdAt:         string;
  updatedAt:         string;
}
```

### `SessionPublic`
```typescript
{
  id:          string;
  channel:     ChannelType;
  ipAddress:   string | null;
  userAgent:   string | null;
  createdAt:   string;
  lastUsedAt:  string;
  expiresAt:   string;
  revokedAt:   string | null;
  // refreshTokenHash NEVER included in responses
}
```

### `RolePublic`
```typescript
{
  id:          string;
  code:        string;
  name:        string;
  description: string | null;
  isSystem:    boolean;
  isEditable:  boolean;
  createdAt:   string;
  permissions: Array<{
    id:       string;
    resource: string;
    action:   PermissionAction;
    scope:    PermissionScope;
  }>;
}
```

### `SecurityEventPublic`
```typescript
{
  id:            string;
  userId:        string | null;
  eventType:     SecurityEventType;
  channel:       ChannelType | null;
  ipAddress:     string | null;
  correlationId: string | null;
  outcome:       'SUCCESS' | 'FAILURE';
  metadata:      Record<string, unknown>;
  occurredAt:    string;
  // userAgent NEVER returned (fingerprinting risk)
}
```

---

## 2. Auth Endpoints

### `POST /auth/login` **[PUBLIC]**

Authenticate a user and open a new session.

**Rate limit**: 10 requests/min/IP + 5 requests/min/email (FR-050)

**Request**
```typescript
{
  email:    string;   // case-insensitive; service lowercases before lookup
  password: string;
  channel?: ChannelType;  // default: WEB
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 201    | Valid credentials, user ACTIVE | `AccessTokenResponse` |
| 201    | Valid credentials, user PENDING_ACTIVATION | `AccessTokenResponse` with `mustChangePassword: true` — client must redirect to change-password before any other call |
| 401    | Invalid credentials OR account LOCKED | `{ message: 'Invalid credentials' }` — identical response (no enumeration) |
| 429    | Rate limit exceeded | `{ message: 'Too many login attempts' }` |

**Side effects**:
- Creates or replaces `Session` row for `(userId, channel)` — if an active session exists for that channel, it is revoked first
- Increments `User.failedLoginCount` on failure; resets to 0 on success
- Sets `User.lastLoginAt` on success
- Flips `status=LOCKED` + sets `lockedUntil=now+15min` when `failedLoginCount` hits 5
- Writes `SecurityEvent(LOGIN_SUCCESS)` or `SecurityEvent(LOGIN_FAILED)`

---

### `POST /auth/refresh` **[PUBLIC]**

Rotate a refresh token and issue a new access token.

**Request**
```typescript
{
  refreshToken: string;  // raw opaque token (never hashed by client)
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 200    | Valid, un-revoked, un-expired session | `AccessTokenResponse` (new tokens; old refresh token invalidated) |
| 200    | Token matches `previousTokenHash` within 30 s grace window | `AccessTokenResponse` with current token (idempotent, no rotation — see R-010) |
| 401    | Token not found, session revoked, or session expired | `{ message: 'Invalid or expired token' }` |
| 401    | Replay detected (token matches `previousTokenHash` after 30 s) | `{ message: 'Session revoked' }` — entire `(userId, channel)` chain is revoked |

**Side effects**:
- On successful rotation: stores new `refreshTokenHash`, moves old hash to `previousTokenHash` with `previousRotatedAt=now`, updates `Session.lastUsedAt`
- On replay (>30 s): sets `revokedAt=now` on ALL sessions for that `(userId, channel)`
- Never issues new tokens for LOCKED or DISABLED users (returns 401)

---

### `POST /auth/logout`

Revoke the current session immediately.

**Guards**: `SharedJwtGuard`

**Request**: Empty body. Session is identified from the `Authorization: Bearer` token.

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 204    | Session successfully revoked | (empty) |
| 401    | Access token invalid or already revoked | `{ message: 'Unauthorized' }` |

**Side effects**:
- Sets `revokedAt=now` on the session matching the token's `sub` + `channel` claims
- Writes `SecurityEvent(LOGOUT)`
- Subsequent refresh with the paired refresh token returns 401

---

### `POST /auth/change-password`

Change the authenticated user's password.

**Guards**: `SharedJwtGuard` | **Roles**: any authenticated user (own resource only)

**Request**
```typescript
{
  currentPassword: string;
  newPassword:     string;
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 204    | Password changed | (empty) |
| 400    | Wrong `currentPassword` | `{ message: 'Invalid current password' }` |
| 400    | `newPassword` fails policy (length, complexity, reuse) | `{ message: string; violations: string[] }` |
| 401    | Unauthenticated | standard 401 |

**Side effects**:
- Updates `User.passwordHash`
- Appends old hash to `PasswordHistory`
- Sets `mustChangePassword=false` (clears first-login requirement)
- Revokes all sessions **except** the current one (keeps caller's tab active)
- Writes `SecurityEvent(PASSWORD_CHANGED)`

---

### `POST /auth/forgot-password` **[PUBLIC]**

Initiate a self-service password reset.

**Rate limit**: 5 requests/min/IP (FR-050)

**Request**
```typescript
{
  email: string;
}
```

**Response**

| Status | Condition | Body |
|--------|-----------|------|
| 200    | Always (prevents account enumeration) | `{ message: 'If the address exists, a reset link has been sent.' }` |

**Side effects (only when user is found AND status=ACTIVE)**:
- Creates `PasswordResetToken` row with `expiresAt=now+1h`
- Fires `notification.dispatch` event so the Notifications module sends the reset email
- Writes `SecurityEvent(PASSWORD_RESET_REQUESTED)`
- No email is sent for LOCKED, DISABLED, or PENDING_ACTIVATION users

---

### `POST /auth/reset-password` **[PUBLIC]**

Complete a self-service password reset using a single-use token.

**Rate limit**: 10 requests/min/IP (FR-050)

**Request**
```typescript
{
  token:       string;  // raw opaque token from reset email
  newPassword: string;
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 204    | Password reset | (empty) — user must sign in fresh |
| 400    | `newPassword` fails policy | `{ message: string; violations: string[] }` |
| 400    | Token expired or already consumed | `{ message: 'Invalid or expired reset token' }` |

**Side effects**:
- Verifies token hash matches an unexpired, unconsumed `PasswordResetToken`
- Updates `User.passwordHash`
- Appends old hash to `PasswordHistory`
- Sets `PasswordResetToken.consumedAt=now`
- Revokes ALL active sessions for the user
- Writes `SecurityEvent(PASSWORD_RESET_COMPLETED)`

---

### `GET /auth/sessions`

List the caller's own active sessions.

**Guards**: `SharedJwtGuard` | **Roles**: any authenticated user (own sessions only)

**Query parameters**: none

**Response 200**
```typescript
SessionPublic[]
// filtered: only sessions for the calling user's userId
// ordered: most recent createdAt first
```

---

## 3. User Management Endpoints

All endpoints in this section require **HR_ADMIN** or **SYSTEM_ADMIN** unless noted.

### `GET /users`

List users with optional filters.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Query parameters**
```
status?:  UserStatus
roleCode?: string
search?:  string    // partial match on email
page?:    number    // default 1
limit?:   number    // default 20, max 100
```

**Response 200**
```typescript
{
  data:  UserPublicProfile[];
  total: number;
  page:  number;
  limit: number;
}
```

---

### `POST /users`

Provision a new user account.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Request**
```typescript
{
  email:           string;         // must be unique; service lowercases
  initialPassword: string;         // must pass FR-006 policy
  employeeId?:     string;         // UUID — if provided, must exist and have no User yet
  roles:           string[];       // at least one RoleCode; e.g. ['EMPLOYEE']
  scopeAssignments?: Array<{
    roleCode:      string;
    scope:         PermissionScope;
    scopeEntityId: string | null;  // required when scope is TEAM | DEPARTMENT | BUSINESS_UNIT
  }>;
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 201    | Created | `UserPublicProfile` |
| 400    | `initialPassword` fails policy | `{ message: string; violations: string[] }` |
| 404    | `employeeId` not found | `{ message: 'Employee not found' }` |
| 409    | `email` already taken | `{ message: 'Email already in use' }` |
| 409    | `employeeId` already has a User | `{ message: 'Employee already linked to a user account' }` |

**Side effects**:
- Creates `User` with `status=PENDING_ACTIVATION`, `mustChangePassword=true`
- Creates one `UserRole` row per entry in `roles`/`scopeAssignments`
- Writes `SecurityEvent(ROLE_GRANTED)` for each role

---

### `GET /users/:id`

Retrieve a single user's profile.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Response 200**: `UserPublicProfile`
**Response 404**: `{ message: 'User not found' }`

---

### `PATCH /users/:id`

Update a user's mutable fields (email only in MVP; password via dedicated endpoints).

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Request**
```typescript
{
  email?: string;   // service lowercases; must be unique if changed
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 200    | Updated | `UserPublicProfile` |
| 404    | User not found | `{ message: 'User not found' }` |
| 409    | Email already in use | `{ message: 'Email already in use' }` |

---

### `DELETE /users/:id`

Soft-delete a user (sets `deletedAt`, disables the account, revokes sessions).

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `SYSTEM_ADMIN`

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 204    | Deleted | (empty) |
| 409    | Last SYSTEM_ADMIN — cannot delete | `{ message: 'Cannot delete the last active SYSTEM_ADMIN' }` |

**Side effects**: Revokes all active sessions; writes `SecurityEvent(USER_DEACTIVATED)`

---

### `POST /users/:id/activate`

Set a LOCKED or DISABLED user back to ACTIVE.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Request**: Empty body.

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 200    | Activated | `UserPublicProfile` |
| 404    | User not found | `{ message: 'User not found' }` |
| 409    | User already ACTIVE or PENDING_ACTIVATION | `{ message: 'User is already active' }` |

**Side effects**: Resets `failedLoginCount=0`, clears `lockedUntil`; writes `SecurityEvent(ACCOUNT_UNLOCKED)`

---

### `POST /users/:id/deactivate`

Disable a user account and revoke all their sessions.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Request**: Empty body.

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 200    | Deactivated | `UserPublicProfile` |
| 404    | User not found | `{ message: 'User not found' }` |
| 409    | Last active SYSTEM_ADMIN | `{ message: 'Cannot deactivate the last active SYSTEM_ADMIN' }` |

**Side effects**: Sets `status=DISABLED`; revokes all active sessions; writes `SecurityEvent(USER_DEACTIVATED)`

---

### `POST /users/:id/roles`

Assign a role (with scope) to a user.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Request**
```typescript
{
  roleCode:      string;           // must exist in Role catalog
  scope:         PermissionScope;
  scopeEntityId: string | null;    // required when scope is TEAM | DEPARTMENT | BUSINESS_UNIT
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 201    | Assigned | `{ userRoleId: string; roleCode: string; scope: PermissionScope; scopeEntityId: string | null; assignedAt: string }` |
| 404    | User or role not found | `{ message: 'User not found' }` / `{ message: 'Role not found' }` |
| 409    | Active assignment already exists for `(userId, roleId, COALESCE(scopeEntityId,''))` | `{ message: 'Role already assigned with the same scope' }` |

**Side effects**: Creates `UserRole` row; writes `SecurityEvent(ROLE_GRANTED)`

---

### `DELETE /users/:id/roles/:userRoleId`

Revoke an active role assignment.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 204    | Revoked | (empty) |
| 404    | UserRole not found or already revoked | `{ message: 'Assignment not found' }` |
| 409    | Would remove last SYSTEM_ADMIN role from last active SYSTEM_ADMIN | `{ message: 'Cannot revoke the last SYSTEM_ADMIN assignment' }` |

**Side effects**: Sets `UserRole.revokedAt=now`; writes `SecurityEvent(ROLE_REVOKED)`

---

### `GET /users/:id/sessions`

List all sessions for a specific user.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Query parameters**
```
activeOnly?: boolean  // default false — returns all including revoked/expired
```

**Response 200**: `SessionPublic[]` ordered by `createdAt DESC`

---

### `POST /users/:id/sessions/:sessionId/revoke`

Revoke a specific session (any channel).

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `SYSTEM_ADMIN`

**Request**: Empty body.

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 204    | Revoked | (empty) |
| 404    | Session not found for this user | `{ message: 'Session not found' }` |
| 409    | Session already revoked | `{ message: 'Session already revoked' }` |

**Side effects**: Sets `Session.revokedAt=now`; writes `SecurityEvent(SESSION_REVOKED)`

---

## 4. Role Catalog Endpoints

### `GET /roles`

List all roles with their permissions.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `GLOBAL_HR_ADMIN`, `SYSTEM_ADMIN`

**Query parameters**
```
isSystem?: boolean
```

**Response 200**: `RolePublic[]`

---

### `GET /roles/:id`

Get a single role by ID.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `GLOBAL_HR_ADMIN`, `SYSTEM_ADMIN`

**Response 200**: `RolePublic`
**Response 404**: `{ message: 'Role not found' }`

---

### `POST /roles`

Create a custom role.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `GLOBAL_HR_ADMIN`, `SYSTEM_ADMIN`

**Request**
```typescript
{
  code:         string;   // uppercase snake_case; must be unique
  name:         string;
  description?: string;
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 201    | Created | `RolePublic` (no permissions yet) |
| 409    | `code` already exists | `{ message: 'Role code already in use' }` |

**Side effects**: Creates `Role` with `isSystem=false, isEditable=true`; writes `SecurityEvent(ROLE_CREATED)`

---

### `DELETE /roles/:id`

Delete a custom role.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `GLOBAL_HR_ADMIN`, `SYSTEM_ADMIN`

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 204    | Deleted | (empty) |
| 404    | Role not found | `{ message: 'Role not found' }` |
| 409    | Role has active UserRole assignments (`revokedAt IS NULL`) | `{ message: 'Role has active assignments — revoke all assignments before deleting' }` |
| 409    | Role is a system role (`isSystem=true`) | `{ message: 'System roles cannot be deleted' }` |

**Side effects**: Hard-deletes `Role` + cascades to `RolePermission` rows; writes `SecurityEvent(ROLE_DELETED)`

---

### `POST /roles/:id/permissions`

Add a permission to a role.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `GLOBAL_HR_ADMIN`, `SYSTEM_ADMIN`

**Request**
```typescript
{
  permissionId: string;  // must exist in seeded Permission catalog
}
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 201    | Added | `{ rolePermissionId: string; permissionId: string }` |
| 403    | Role has `isEditable=false` | `{ message: 'Role permissions are locked' }` |
| 404    | Role or permission not found | standard 404 |
| 409    | Permission already assigned to role | `{ message: 'Permission already assigned to this role' }` |

**Side effects**: Creates `RolePermission` row; writes `SecurityEvent(ROLE_PERMISSION_ADDED)`

---

### `DELETE /roles/:id/permissions/:permId`

Remove a permission from a role.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `GLOBAL_HR_ADMIN`, `SYSTEM_ADMIN`

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 204    | Removed | (empty) |
| 403    | Role has `isEditable=false` | `{ message: 'Role permissions are locked' }` |
| 404    | Role, permission, or assignment not found | standard 404 |

**Side effects**: Hard-deletes `RolePermission` row; writes `SecurityEvent(ROLE_PERMISSION_REMOVED)`

---

### `GET /permissions`

List all seeded permissions (read-only catalog).

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `HR_ADMIN`, `GLOBAL_HR_ADMIN`, `SYSTEM_ADMIN`

**Response 200**
```typescript
Array<{
  id:       string;
  resource: string;
  action:   PermissionAction;
  scope:    PermissionScope;
}>
```

---

## 5. Audit Endpoint

### `GET /security-events`

Query the security audit log.

**Guards**: `SharedJwtGuard` + `RbacGuard` | **Roles**: `SYSTEM_ADMIN`

**Query parameters**
```
userId?:    string          // filter by user
eventType?: SecurityEventType
outcome?:   'SUCCESS' | 'FAILURE'
from?:      string          // ISO 8601 datetime
to?:        string          // ISO 8601 datetime
page?:      number          // default 1
limit?:     number          // default 50, max 200
```

**Response 200**
```typescript
{
  data:  SecurityEventPublic[];
  total: number;
  page:  number;
  limit: number;
}
```

---

## 6. Rate Limits Summary

| Endpoint                  | Limit               | Key         |
|---------------------------|---------------------|-------------|
| `POST /auth/login`        | 10/min + 5/min      | IP + email  |
| `POST /auth/forgot-password` | 5/min            | IP          |
| `POST /auth/reset-password`  | 10/min           | IP          |
| `POST /auth/refresh`      | 60/min              | IP          |
| All mutation endpoints    | 100/min             | userId      |

---

## 7. Anonymous Endpoint Summary

Only these endpoints have **no `SharedJwtGuard`**:

| Endpoint | Reason |
|----------|--------|
| `GET /health` | Liveness probe — no auth data |
| `POST /auth/login` | Bootstraps the session |
| `POST /auth/refresh` | Rotates tokens (verified via refresh token hash, not JWT) |
| `POST /auth/forgot-password` | Pre-auth self-service |
| `POST /auth/reset-password` | Pre-auth self-service |
| `POST /exit-surveys/:id/respond` | Survey-token-gated (Social service, out of IAM scope) |

All other endpoints MUST be decorated with `@UseGuards(SharedJwtGuard, RbacGuard)`.

---

## 8. SYSTEM Token Contract

SYSTEM tokens are not issued via a REST endpoint — they are minted in-process by
`AgentContextFactory.forSystemTask()` in the AI Agentic service.

**Token payload**
```typescript
interface SystemJwtPayload {
  sub:      'system';
  roles:    ['SYSTEM'];
  scope:    'GLOBAL';
  taskType: string;   // e.g. 'exit_survey_dispatch' — validated against allowlist
  iat:      number;
  exp:      number;   // at most now + 5 minutes
}
```

**Signing secret**: `SYSTEM_JWT_SECRET` — distinct from `JWT_SECRET` used for user tokens.
Rotating one secret does not affect the other.

**Endpoints that accept `SYSTEM` role** (per `rules/security.md` RBAC matrix):

| Service    | Endpoint                          |
|------------|-----------------------------------|
| Social     | `POST /exit-surveys`              |
| Social     | `PATCH /exit-surveys/:id/send`    |
| HR Core    | *(no HR Core endpoints accept SYSTEM role in Phase 1)* |

All other endpoints return 403 when the SYSTEM role is the sole claim.
