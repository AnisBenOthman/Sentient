# Feature Specification: Identity & Access Management (IAM) Module

**Feature Branch**: `006-iam-module`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "IAM module"

## Summary

The IAM module is the authentication and authorization foundation for the entire Sentient platform. It owns identities (User), credentials, roles, permissions, sessions, and the tokens that every other module — HR Core, Social, AI Agentic — uses to authenticate and authorize requests. Until this module ships, every other module has role guards commented out with `TODO(iam)`; Swagger and all endpoints are effectively open. Shipping this module closes that security gap and unlocks real RBAC across the three microservices.

This is the only module that issues tokens. The Social and AI Agentic services validate tokens but do not create them. The module also mints short-lived SYSTEM tokens used by scheduled AI tasks (e.g., monthly leave accrual, exit-survey dispatch) and guarantees that an AI agent acting on behalf of a user inherits — and cannot exceed — that user's permissions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User signs in and accesses authenticated resources (Priority: P1)

A provisioned user opens the web app, enters their email and password, and signs in. The system verifies the credentials, creates a session, and returns a short-lived access token plus a longer-lived refresh token. The client attaches the access token as a bearer credential to every subsequent request. Protected endpoints across HR Core, Social, and AI Agentic all accept the same token and identify the caller consistently. When the access token expires, the client uses the refresh token to obtain a new one without re-prompting for credentials. The user can sign out to terminate the session immediately.

**Why this priority**: This is the MVP. Without sign-in and token-validated access, no other module can enforce who a caller is, and the platform cannot expose any protected endpoint. It's also the smallest independently demonstrable slice — seed one user, log in, call `GET /employees/me`.

**Independent Test**: Seed one ACTIVE user linked to an Employee. POST `/auth/login` with the user's email and password → receive access token + refresh token. Call `GET /employees/me` on HR Core with the access token → 200 with that employee's data. Call the same endpoint on Social (e.g., `GET /announcements`) with the same token → 200. Wait for the access token to expire (or simulate), POST `/auth/refresh` with the refresh token → receive a new access token. POST `/auth/logout` → subsequent refresh attempts with the old refresh token return 401.

**Acceptance Scenarios**:

1. **Given** a user with email `alice@sentient.dev` and a known password, **When** they POST valid credentials to `/auth/login`, **Then** the response includes `accessToken`, `refreshToken`, and the authenticated user's public profile; a Session row is created with `channel=WEB`, `expiresAt` equal to the refresh-token lifetime from now.
2. **Given** a valid access token, **When** the client calls any protected endpoint in HR Core, Social, or AI Agentic, **Then** the endpoint validates the token using the shared signing secret and resolves the same `userId`, `employeeId`, `roles`, `departmentId`, `teamId`, and `channel` claims on all three services.
3. **Given** an invalid, tampered, or expired access token, **When** the client calls any protected endpoint, **Then** the service returns 401 Unauthorized with no data leakage in the error body.
4. **Given** a user who entered the wrong password, **When** they POST to `/auth/login`, **Then** the response is 401 with a generic "Invalid credentials" message (no distinction between "wrong email" and "wrong password" to prevent account enumeration); the failure is recorded in the security audit log.
5. **Given** a valid refresh token, **When** the client POSTs it to `/auth/refresh`, **Then** a new access token is issued, the refresh token's last-used timestamp is updated, and the session remains open.
6. **Given** a user who has signed out (POST `/auth/logout`), **When** they later POST the same refresh token to `/auth/refresh`, **Then** the response is 401 and the session is recorded as REVOKED.
7. **Given** a client that reuses an already-consumed refresh token (replay attempt), **When** it POSTs to `/auth/refresh`, **Then** the system revokes the entire session chain and returns 401 — forcing the legitimate owner to re-authenticate.

---

### User Story 2 - Role and scope enforcement protects every endpoint (Priority: P2)

Once a user is authenticated, every endpoint consults the user's roles and the endpoint's declared role requirement. An EMPLOYEE can only see their own records; a MANAGER sees their direct reports; HR_ADMIN and EXECUTIVE see everyone; unauthorized roles get 403. The same rules apply regardless of which service the request lands on, and regardless of whether the caller is a human browser session or an AI agent forwarding the user's token.

**Why this priority**: Authentication without authorization is a data leak. This story activates the previously-commented guards across HR Core, Social, and AI Agentic (`TODO(iam)` lines) and makes the role matrix real. It must ship in the same release as P1; without it, signed-in users see everything.

**Independent Test**: Seed three users — E (EMPLOYEE), M (MANAGER of a team containing E), A (HR_ADMIN). All three hit `GET /employees`: E gets only their own record; M gets their direct reports plus themselves; A gets all active employees. All three hit `GET /salary-history`: E and M get 403; A gets data. Attempts by E to POST `/announcements` return 403. Every wrong-role × endpoint pair in the test matrix returns 403 with no data leak.

**Acceptance Scenarios**:

1. **Given** a user with role EMPLOYEE and scope OWN on `employee`, **When** they GET `/employees`, **Then** the response contains exactly one row — their own — regardless of how many employees exist in the database.
2. **Given** a user with role MANAGER managing a team of 4, **When** they GET `/employees`, **Then** the response contains those 4 direct reports plus themselves (5 total), filtered by `employee.managerId = self.employeeId`.
3. **Given** a user with role HR_ADMIN and scope GLOBAL, **When** they GET any resource across any of the three services, **Then** no scope filter is applied.
4. **Given** a user with role EXECUTIVE, **When** they POST to any mutating endpoint (create, update, delete), **Then** the response is 403 — EXECUTIVE is read-only by role matrix.
5. **Given** a user with role EMPLOYEE, **When** they attempt to call any endpoint restricted to SYSTEM_ADMIN or HR_ADMIN (e.g., `POST /leave-types`, `GET /task-logs`), **Then** the response is 403 with no side effects and a security audit entry is written.
6. **Given** the full RBAC matrix defined in `rules/security.md` for HR Core, Social, and AI Agentic, **When** the contract test suite iterates every (role, endpoint) pair, **Then** allowed pairs return 2xx and denied pairs return 403 — 100% match.
7. **Given** an AI agent request in AI Agentic that forwards the original user's token to HR Core, **When** HR Core receives the call, **Then** it applies the same scope filter as if the user had called directly (no elevation).

---

### User Story 3 - HR Admin provisions, updates, and deactivates user accounts (Priority: P3)

An HR_ADMIN needs to bring new joiners online and offboard leavers. They create a User account linked to an existing Employee record, assign initial roles (usually just EMPLOYEE, sometimes MANAGER), and trigger the new user's first-login flow. Later, they can assign or revoke roles (e.g., a promoted employee becomes a MANAGER), temporarily lock an account (e.g., during an investigation), or deactivate it permanently (e.g., on termination). They can list users with filters for status and role.

**Why this priority**: Without provisioning, only seeded users can sign in. The module ships with a seed SYSTEM_ADMIN and a few demo users so P1 and P2 can be demonstrated; the provisioning UI/APIs let HR scale the platform to real headcount. It ships right after the core auth/RBAC slice.

**Independent Test**: Seed an HR_ADMIN and an Employee record with no linked User. HR_ADMIN POSTs `/users` with `{ employeeId, email, initialPassword, roles: ['EMPLOYEE'] }` → a User row is created in PENDING_ACTIVATION status, linked 1:1 to the Employee, with exactly one UserRole assigned. The new user signs in with the initial password → status flips to ACTIVE, they are required to change the password on first login. HR_ADMIN POSTs `/users/:id/roles` adding MANAGER → next token issued includes both roles. HR_ADMIN POSTs `/users/:id/deactivate` → the user's active sessions are revoked and future sign-in attempts return 401.

**Acceptance Scenarios**:

1. **Given** an Employee record `emp-123` with no associated User, **When** HR_ADMIN POSTs `/users` with that `employeeId`, a unique email, a temporary password, and `roles: ['EMPLOYEE']`, **Then** a User is created with status=PENDING_ACTIVATION, `mustChangePassword=true`, and exactly one UserRole row.
2. **Given** an Employee already linked to a User, **When** HR_ADMIN tries to create another User for the same `employeeId`, **Then** the system returns 409 Conflict — the Employee↔User link is strictly 1:1.
3. **Given** a user with status=PENDING_ACTIVATION and `mustChangePassword=true`, **When** they sign in with the temporary password, **Then** the response includes a flag forcing password change before any other endpoint responds with 2xx; the status flips to ACTIVE only after a successful password change.
4. **Given** HR_ADMIN POSTs `/users/:id/roles` adding `MANAGER` to user U, **When** U next signs in or refreshes, **Then** the new access token's `roles` array includes both `EMPLOYEE` and `MANAGER`.
5. **Given** HR_ADMIN POSTs `/users/:id/deactivate`, **When** the action succeeds, **Then** user status becomes DISABLED, all Session rows for that user are revoked with `revokedAt=now`, and the next access-token validation for that user returns 401 even if the token has not yet expired (see FR-028 for session-invalidation enforcement).
6. **Given** HR_ADMIN attempts to revoke the SYSTEM_ADMIN role from the last remaining SYSTEM_ADMIN account, **When** they submit the request, **Then** the system returns 409 — at least one active SYSTEM_ADMIN must exist at all times.
7. **Given** a non-HR_ADMIN user, **When** they attempt any `/users` or `/users/:id/roles` action, **Then** the response is 403 (SYSTEM_ADMIN also permitted per matrix).

---

### User Story 4 - Users manage their own password (change and reset) (Priority: P4)

A signed-in user can change their password by supplying the current password and a new one. A user who has forgotten their password can request a reset: they enter their email, receive an email containing a single-use reset link, click it, and set a new password without needing the old one. Password policy is enforced on both flows (minimum length, complexity). Password reset tokens are short-lived, single-use, and invalidated on password change or expiry.

**Why this priority**: Essential for self-service security but strictly after the module is functional for admins. HR_ADMIN can manually reset passwords in the provisioning flow before this ships, so it can be slotted in fourth.

**Independent Test**: Signed-in user POSTs `/auth/change-password` with current + new → success; old password no longer works; new one does. User POSTs `/auth/forgot-password` with their email → a PasswordResetToken is persisted with an expiry 1 hour in the future, an email is dispatched via the Notifications event; the raw token is never returned in the API response. User POSTs `/auth/reset-password` with that token + new password → password updates, all active sessions for that user are revoked, the reset token is marked consumed. A second attempt with the same token returns 400 "Token already used".

**Acceptance Scenarios**:

1. **Given** a signed-in user with password `P1`, **When** they POST `/auth/change-password` with `currentPassword=P1, newPassword=P2`, **Then** the password hash is updated, a security event is logged, and existing sessions other than the current one are revoked (current session stays active so the user isn't forced to re-login in the same tab).
2. **Given** a signed-in user, **When** they POST `/auth/change-password` with a wrong `currentPassword`, **Then** the response is 400 "Invalid current password" and no hash change occurs.
3. **Given** any new password submitted (change or reset flow), **When** it fails the policy (length, character classes, not in the last-N reuse list), **Then** the response is 400 with the specific policy violation and no change is persisted.
4. **Given** an unauthenticated user, **When** they POST `/auth/forgot-password` with an email, **Then** the response is always 200 with a generic "If the address exists, a reset link has been sent" message — no account-existence leak; the email is only actually sent for a real ACTIVE user.
5. **Given** a valid, unexpired, unconsumed PasswordResetToken, **When** the user POSTs `/auth/reset-password` with it plus a policy-compliant password, **Then** the user's password is updated, all the user's Session rows are revoked, the token is marked consumed with `consumedAt=now`, and the user is prompted to log in fresh.
6. **Given** an expired or already-consumed reset token, **When** the user POSTs `/auth/reset-password` with it, **Then** the response is 400 and no password change occurs.
7. **Given** a user whose status is DISABLED or LOCKED, **When** they request a password reset, **Then** no reset email is sent — the generic 200 response is still returned to prevent enumeration.

---

### User Story 5 - Multi-channel sessions and termination cascade (Priority: P5)

A user can have simultaneous sessions on different channels — web browser, Slack, WhatsApp — each tracked as a distinct Session row with its own refresh token. HR_ADMIN can see a user's active sessions, revoke any individual one, or revoke all of them. When an Employee is marked TERMINATED by the Employees module, every Session for the associated User is revoked immediately and the User is set to DISABLED.

**Why this priority**: Not blocking for initial launch — the default WEB channel works fine on its own — but essential for offboarding security and for the multi-channel AI interactions scheduled for Month 4 and later. Ship after password self-service.

**Independent Test**: User signs in on web → Session A created with `channel=WEB`. The user also signs in via a Slack OAuth bot → Session B created with `channel=SLACK`. HR_ADMIN calls `GET /users/:id/sessions` → both rows are returned with channel, createdAt, lastSeenAt, expiresAt, revokedAt=null. HR_ADMIN POSTs `/users/:id/sessions/:sessionId/revoke` → Session A is revoked, Session B still active. The Employees module fires an `employee.terminated` event → the IAM event handler flips the User to DISABLED and revokes all remaining sessions; the user cannot sign in again.

**Acceptance Scenarios**:

1. **Given** a user already signed in via `WEB`, **When** the same user signs in via `SLACK`, **Then** a second Session row is created with `channel=SLACK` and both sessions are independently valid.
2. **Given** a user with three active sessions across three channels, **When** HR_ADMIN GETs `/users/:id/sessions`, **Then** the response lists exactly three rows with channel, createdAt, lastSeenAt, and expiresAt; refresh-token hashes are never exposed in the response.
3. **Given** one specific session, **When** HR_ADMIN POSTs `/users/:id/sessions/:sessionId/revoke`, **Then** that Session's `revokedAt` is set, its refresh token stops working, but the user's other channel sessions continue.
4. **Given** an Employee record, **When** its `employmentStatus` transitions to TERMINATED (via the Employees module), **Then** the IAM module consumes the `employee.terminated` event, sets the linked User's status to DISABLED, and revokes every active Session — any currently-issued access token stops validating on the next scope check (per FR-028).
5. **Given** a Session whose `expiresAt` has passed, **When** the refresh token is presented, **Then** the response is 401 and the session is cleaned up (no indefinite validity).
6. **Given** a deactivated or terminated user, **When** a past access token that has not yet expired by timestamp is presented, **Then** validation still fails — the system rechecks user status on a lightweight cache with a max 60-second staleness guarantee.

---

### User Story 6 - System tokens for scheduled AI tasks and agent-delegated actions (Priority: P5)

AI agent scheduled tasks — monthly leave accrual, exit-survey dispatch, engagement snapshots, regulation seeding — run without a human user in the loop but still need to call HR Core and Social endpoints. A dedicated `AgentContextFactory.forSystemTask()` mints a separate category of token (SYSTEM) signed with its own secret, scoped only to the specific task, and valid for at most 5 minutes. Conversely, when a human user interacts with an AI agent, the agent forwards the user's existing token to downstream services so the user's own scope — not a superuser bypass — governs what the agent can do. Every tool call (human or system) is recorded in `AgentTaskLog` with the acting identity.

**Why this priority**: The AI Agentic service's scheduled features ship in Months 4–5; this story delivers the auth foundation they need. It ships with the same release as the module overall so the scheduler work in later features is not blocked, but in terms of priority of user-visible effect it comes last.

**Independent Test**: Call `AgentContextFactory.forSystemTask({ taskType: 'exit_survey_dispatch' })` in AI Agentic → receive a SYSTEM token signed with `SYSTEM_JWT_SECRET`, expiring in ≤5 minutes, with `roles: ['SYSTEM']`. Call Social's `POST /exit-surveys` with that token → 201 because the endpoint allows the SYSTEM role. Call HR Core's `GET /employees` with the same SYSTEM token → 401 if that endpoint is not in the SYSTEM-allowlist. In a separate flow, a human EMPLOYEE interacts with the Leave Agent; the agent calls HR Core's `GET /leave-balances` using the forwarded user token → HR Core applies the OWN scope and returns only the user's own balance, never a teammate's.

**Acceptance Scenarios**:

1. **Given** a scheduled job in AI Agentic, **When** it requests a SYSTEM token for `taskType=exit_survey_dispatch`, **Then** `AgentContextFactory.forSystemTask()` returns a signed token with `sub='system'`, `roles=['SYSTEM']`, the embedded `taskType`, and `exp` no more than 5 minutes in the future.
2. **Given** a SYSTEM token, **When** it is presented to any endpoint not in the SYSTEM-role allowlist declared in the RBAC matrix, **Then** the response is 403 — SYSTEM is not a superuser.
3. **Given** a token signed with the user-JWT secret, **When** presented to an endpoint that only accepts SYSTEM role, **Then** the response is 403; SYSTEM tokens are minted with a separate secret so forgery via the user-JWT path is impossible.
4. **Given** an AI agent handling a human user's message, **When** the agent calls HR Core via the REST client, **Then** the client sends the same `Authorization: Bearer <userToken>` header the user sent in, and HR Core applies the user's own scope filter — no elevation.
5. **Given** an AI agent call that receives 403 from a downstream service (e.g., an EMPLOYEE asking the Leave Agent to check team availability), **When** the degradation handler intercepts the response, **Then** it returns an `AgentDegradationResult`, the `AgentTaskLog` is written with `status=DEGRADED`, the graph continues without throwing, and the user gets a graceful explanation.
6. **Given** every tool call (user-delegated or SYSTEM), **When** the call is made, **Then** an `AgentTaskLog` row is written with `actorUserId` = the user ID (or null for SYSTEM) and `parentLogId` linking to the top-level agent invocation for that conversation or scheduled task.

---

### User Story 7 - GLOBAL_HR_ADMIN configures platform roles (Priority: P3)

A GLOBAL_HR_ADMIN needs to tailor the permission landscape to the organisation's structure without deploying code. They can create a custom role (e.g., `REGIONAL_HR_SPECIALIST`) from the platform's fixed permission catalog, assign the specific capabilities it needs, and later assign it to users. They can also adjust the default permission sets of the five editable built-in roles (EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE, GLOBAL_HR_ADMIN). Infrastructure roles (SYSTEM, SYSTEM_ADMIN) are permanently locked and cannot be changed by anyone.

**Why this priority**: Without this, every permission-tuning requires a code deployment. Shipping alongside provisioning (P3) lets HR configure roles immediately after the platform launches and before Month 3 features add new endpoints that may need tuned permissions.

**Independent Test**: GLOBAL_HR_ADMIN POSTs `/roles` with `{ code: 'REGIONAL_HR_SPECIALIST', name: 'Regional HR Specialist' }` → Role created with `isSystem=false, isEditable=true`, zero permissions. GLOBAL_HR_ADMIN POSTs `/roles/:id/permissions` adding a `permissionId` from the seeded catalog → RolePermission row created. A user is assigned that role → their next token includes it. GLOBAL_HR_ADMIN DELETEs the SYSTEM role → 409 "System roles cannot be deleted". GLOBAL_HR_ADMIN attempts to add a permission to SYSTEM_ADMIN → 403 "Role permissions are locked". GLOBAL_HR_ADMIN DELETEs the custom role while a user holds it → 409 "Role has active assignments". After the last assignment is revoked, DELETE succeeds.

**Acceptance Scenarios**:

1. **Given** GLOBAL_HR_ADMIN POSTs `/roles` with a unique `code` (uppercase snake_case) and `name`, **Then** a Role is created with `isSystem=false`, `isEditable=true`, and zero permissions by default; the `code` is stored exactly as provided.
2. **Given** a valid custom or editable built-in role (`isEditable=true`), **When** GLOBAL_HR_ADMIN POSTs `/roles/:id/permissions` with a `permissionId` present in the seeded catalog, **Then** a RolePermission row is created and takes effect at the next token issuance for users holding that role.
3. **Given** a role where `isEditable=false` (SYSTEM or SYSTEM_ADMIN), **When** GLOBAL_HR_ADMIN attempts POST or DELETE on `/roles/:id/permissions`, **Then** the response is 403 "Role permissions are locked".
4. **Given** a custom role (`isSystem=false`) with no active UserRole assignments, **When** GLOBAL_HR_ADMIN DELETEs `/roles/:id`, **Then** the role and all its RolePermission rows are hard-deleted; any tokens already issued that referenced this role retain the stale claims until natural expiry (≤15 min).
5. **Given** a custom role that has one or more active UserRole assignments (`revokedAt IS NULL`), **When** GLOBAL_HR_ADMIN attempts DELETE `/roles/:id`, **Then** the response is 409 "Role has active assignments — revoke all assignments before deleting".
6. **Given** any role with `isSystem=true` (EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE, GLOBAL_HR_ADMIN, SYSTEM_ADMIN, SYSTEM), **When** any caller attempts DELETE `/roles/:id`, **Then** the response is 409 "System roles cannot be deleted".
7. **Given** a user who is not GLOBAL_HR_ADMIN or SYSTEM_ADMIN, **When** they attempt any role-catalog endpoint (POST `/roles`, DELETE `/roles/:id`, POST/DELETE `/roles/:id/permissions`), **Then** the response is 403.

---

### Edge Cases

- **Account enumeration**: Error messages for login, forgot-password, and reset must never distinguish between "email doesn't exist" and "wrong password / unknown state" — single generic response.
- **Brute-force login**: After N consecutive failed logins against the same account (see assumptions for N), the account is soft-locked for a fixed duration. The lock is lifted automatically; the user does not need admin intervention unless the lock is escalated (repeat offenders).
- **Token replay after logout**: A refresh token used after the session was revoked must immediately revoke the entire session chain (defensive — treat as compromise) rather than simply returning 401.
- **Role revocation mid-session**: If HR_ADMIN removes a role from a user, the change does not appear in already-issued access tokens until they expire (max 15 minutes). Scope-filter rechecks use the token's claims, so the window is bounded and documented. For faster revocation, the user's sessions can be fully revoked.
- **Clock skew between services**: Access-token `exp` claim is checked with a small leeway (≤60 seconds) to tolerate NTP drift between microservices; beyond that, the token is invalid.
- **Concurrent refresh**: Two tabs of the same client attempt to refresh simultaneously using the same refresh token. One request wins and rotates the token; the other presents a stale refresh token, which must NOT trigger the replay-revocation path for a defined short window (e.g., 30 s) — otherwise legitimate users get logged out of every tab.
- **Employee deletion vs. termination**: The platform uses soft-delete/termination only; an Employee is never hard-deleted while a User references it. If an Employee is nonetheless hard-deleted (data migration), the linked User is also cascade-deleted and all sessions revoked.
- **Password reset while logged in**: If a signed-in user requests a reset and then uses the reset link, the reset flow revokes all active sessions including the one where the request was made — the user must log in fresh.
- **User without Employee linkage**: SYSTEM_ADMIN bootstrap user may not be tied to an Employee. The JWT payload includes `employeeId: null` for such users; endpoints that require an employeeId gracefully return 403 rather than 500.
- **Disabled user mid-agent-call**: An AI agent invokes a 10-second workflow that makes multiple tool calls on behalf of user U; mid-call, HR_ADMIN disables U. The first downstream call after the disablement sees the revoked-session response and returns 401; the agent's degradation handler maps this to a terminal failure and the AgentTaskLog captures the interruption cleanly.
- **Promotion race**: A user is a MANAGER of team T, has an active session, and at T-minus-0 they are demoted (MANAGER role revoked) AND they try to approve a leave request. The approve call passes token validation (cached token still has MANAGER), but the eventual row-level policy check can be designed to reject based on latest role set; MVP accepts the bounded 15-minute window risk and logs the approval with the acting token's claims for audit.
- **SYSTEM token leak**: A SYSTEM token is at most 5 minutes old; leakage is a narrow window, but if detected (e.g., unexpected `taskType` in logs), `SYSTEM_JWT_SECRET` can be rotated — all in-flight SYSTEM tokens invalidate immediately, user sessions unaffected.

## Requirements *(mandatory)*

### Functional Requirements

**Identity & Account**

- **FR-001**: The module MUST maintain a `User` entity with the following fields: `id` (UUID), `employeeId` (nullable UUID reference; 1:1 with Employee when set), `email` (unique, case-insensitive), `passwordHash`, `status` (`UserStatus` enum: PENDING_ACTIVATION, ACTIVE, LOCKED, DISABLED), `mustChangePassword` (boolean), `failedLoginCount` (integer), `lockedUntil` (nullable timestamp), `lastLoginAt` (nullable timestamp), `createdAt`, `updatedAt`, `deletedAt` (soft-delete).
- **FR-002**: A `User` record, when `employeeId` is non-null, MUST be 1:1 with an `Employee` record. The system MUST reject creation of a second `User` for an Employee that already has one.
- **FR-003**: `User.email` MUST be unique across the entire platform (case-insensitive). Collisions at creation return 409 Conflict.
- **FR-004**: The module MUST support a bootstrap seed that creates at least one SYSTEM_ADMIN User with no `employeeId` linkage so the platform can be administered before any Employee records exist.

**Password Storage & Policy**

- **FR-005**: Passwords MUST be stored only as hashes produced by a memory-hard, GPU-resistant algorithm (Argon2id in the implementation). Plaintext passwords MUST NOT be written to the database, logs, response bodies, or analytics streams.
- **FR-006**: The module MUST enforce a password policy on all password-set operations (initial provisioning, change, reset): minimum 12 characters, at least one uppercase, one lowercase, one digit, one symbol; must not equal the email local-part; must not equal any of the user's last 5 passwords (reuse guard).
- **FR-007**: Violation of any policy rule MUST return 400 with a specific message indicating which rule failed and MUST NOT persist any state change.

**Authentication**

- **FR-008**: The module MUST expose `POST /auth/login` accepting `{ email, password, channel }` where `channel` is a `ChannelType` (default WEB). On success it MUST issue an access token and a refresh token, create a Session row, return the public user profile, and increment `User.lastLoginAt`.
- **FR-009**: `POST /auth/login` with invalid credentials MUST return 401 with a generic "Invalid credentials" message, increment `failedLoginCount`, and emit a `auth.login_failed` security audit event.
- **FR-010**: After the `failedLoginCount` threshold (5 within 15 minutes) is reached for a User, the module MUST lock the account (set `status=LOCKED`, `lockedUntil=now+15min`). A LOCKED user's login attempts MUST return 401 even with correct credentials; the lock MUST auto-clear when `lockedUntil < now`.
- **FR-011**: Access tokens MUST be signed JWTs with payload `{ sub, employeeId, roles, departmentId, teamId, businessUnitId, channel, roleAssignments, iat, exp }` — no PII (no email, no name, no salary). `roleAssignments` is an array of `{ roleCode, scope, scopeEntityId }` objects representing the user's active UserRole rows, enabling per-assignment scope resolution without a database round-trip. Where a user holds the same permission at multiple scopes, the widest scope wins (`buildScopeFilter` union semantics). Access-token TTL is 15 minutes; configurable via `JWT_EXPIRY` env var.
- **FR-012**: Refresh tokens MUST be opaque, cryptographically-random, and persisted only as hashes on the `Session` row; raw refresh tokens MUST be returned to the client exactly once at login/refresh and never retrievable again. Default refresh-token TTL is 7 days.
- **FR-013**: `POST /auth/refresh` MUST accept a refresh token, verify its hash matches an un-revoked un-expired Session, issue a new access token, rotate the refresh token (old hash invalidated, new hash stored), and update `Session.lastUsedAt`.
- **FR-014**: If a refresh token is presented that matches an already-rotated (i.e., consumed) Session hash, the module MUST treat this as a replay attack: revoke the entire Session chain for that `(user, channel)` and return 401.
- **FR-015**: `POST /auth/logout` MUST accept the current access token, mark the corresponding Session as revoked (`revokedAt=now`), and return 204. Subsequent use of either the access or refresh token for that Session MUST return 401.

**Token Validation (Shared Across Services)**

- **FR-016**: The `@sentient/shared` package MUST expose a `SharedJwtGuard` that every NestJS service uses to validate access tokens; validation MUST use the shared signing secret (`JWT_SECRET`) and a bounded clock-skew leeway of ≤60 seconds on the `exp` claim.
- **FR-017**: The `SharedJwtGuard` MUST NOT query the database on the hot path; it MUST rely on the signed claims. A separate, cached `UserStatusGuard` (or equivalent periodic check, max 60 s stale) MUST reject tokens for users whose status has flipped to LOCKED or DISABLED.
- **FR-018**: The `/health` endpoint on every service (and the exit-survey token-gated `POST /exit-surveys/:id/respond`) MUST remain anonymous — no other endpoint in any service is anonymous.

**Role & Permission Model**

- **FR-019**: The module MUST maintain `Role`, `Permission`, `UserRole`, and `RolePermission` entities.
  - `Role` has: `code` (unique String, uppercase snake_case — not enum-constrained), `name`, `description`, `isSystem` (Boolean — true for the seven platform-seeded roles; system roles cannot be deleted), `isEditable` (Boolean — true for all roles except SYSTEM and SYSTEM_ADMIN, whose permission sets are permanently locked). Built-in seeded roles and their flags: `EMPLOYEE` (isSystem=true, isEditable=true), `MANAGER` (isSystem=true, isEditable=true), `HR_ADMIN` (isSystem=true, isEditable=true), `EXECUTIVE` (isSystem=true, isEditable=true), `GLOBAL_HR_ADMIN` (isSystem=true, isEditable=true), `SYSTEM_ADMIN` (isSystem=true, isEditable=false), `SYSTEM` (isSystem=true, isEditable=false).
  - `Permission` has: `resource` (string), `action` (`PermissionAction`: CREATE, READ, UPDATE, DELETE, APPROVE), `scope` (`PermissionScope`: OWN, TEAM, DEPARTMENT, BUSINESS_UNIT, GLOBAL). Unique on `(resource, action, scope)`. The permission catalog is seeded at deployment and is not modifiable at runtime — only role↔permission assignments change.
  - `UserRole` stores scope per-assignment: `scope: PermissionScope` and optional `scopeEntityId: String` (teamId / departmentId / businessUnitId). One person may hold multiple UserRole rows with different scopes simultaneously. Partial unique index: `(userId, roleId, scopeEntityId) WHERE revokedAt IS NULL`.
- **FR-020**: The module MUST seed the full role matrix and role↔permission mapping defined in `.claude/rules/security.md` on bootstrap. Seed order: Permissions → Roles → RolePermissions → SYSTEM_ADMIN User + UserRole. Re-running the seed MUST be idempotent.
- **FR-021**: `UserRole` rows MUST be additive: a user with roles `{EMPLOYEE, MANAGER}` receives the union of permissions granted to both roles. When the same permission is granted at multiple scopes (e.g., a DEPARTMENT-scoped MANAGER also has an OWN-scoped EMPLOYEE assignment), `buildScopeFilter` applies the widest scope.
- **FR-022**: Role assignment/revocation endpoints (`POST /users/:id/roles`, `DELETE /users/:id/roles/:roleId`) MUST be restricted to HR_ADMIN, GLOBAL_HR_ADMIN, and SYSTEM_ADMIN. Role catalog management endpoints (POST/DELETE `/roles`, POST/DELETE `/roles/:id/permissions`) MUST be restricted to GLOBAL_HR_ADMIN and SYSTEM_ADMIN.
- **FR-023**: The system MUST ensure at least one ACTIVE User with the SYSTEM_ADMIN role exists at all times. Any operation that would leave zero active SYSTEM_ADMINs (role revocation, deactivation, deletion) MUST return 409 Conflict.

**Scope Enforcement**

- **FR-024**: Every protected endpoint MUST declare its required role(s) via the `@Roles(...)` decorator and be gated by the `RbacGuard`. Missing decorators on a protected endpoint MUST be caught by an automated static check (lint rule or unit test) during CI.
- **FR-025**: For resources scoped below GLOBAL, services MUST apply a row-level `buildScopeFilter(user, resource, action)` to every query. The scope ladder is strictly inclusive: OWN ⊂ TEAM ⊂ DEPARTMENT ⊂ BUSINESS_UNIT ⊂ GLOBAL. The resolved filter is:
  - `OWN` → records belonging to `user.employeeId` only
  - `TEAM` → records where the target employee's `managerId = user.employeeId` OR is `user.employeeId` itself
  - `DEPARTMENT` → records within `user.departmentId`
  - `BUSINESS_UNIT` → records within `user.businessUnitId` (covers all departments and teams in that BU — no per-department fan-out)
  - `GLOBAL` → no filter
  When a user has multiple UserRole rows applicable to the same permission, `buildScopeFilter` returns the widest scope across those rows.
- **FR-026**: Scope filtering MUST apply equally to HTTP requests originating from a human browser and to HTTP requests forwarded by AI Agentic on behalf of a user — i.e., forwarding a token does not grant elevation.

**User Lifecycle (HR Admin)**

- **FR-027**: HR_ADMIN and SYSTEM_ADMIN MUST be able to create, read, list, update, activate, deactivate, and soft-delete users. Endpoints: `POST /users`, `GET /users`, `GET /users/:id`, `PATCH /users/:id`, `POST /users/:id/activate`, `POST /users/:id/deactivate`, `DELETE /users/:id` (soft-delete).
- **FR-028**: Deactivating a user (`status → DISABLED`) MUST immediately revoke every Session for that user (`revokedAt=now`) and the user's cached status MUST propagate to validation within 60 seconds across all services.
- **FR-029**: The module MUST consume the `employee.terminated` event emitted by HR Core's Employees module: on receipt, set the linked User to DISABLED and revoke all sessions in a single transaction.

**Password Self-Service**

- **FR-030**: `POST /auth/change-password` MUST require a valid access token, a correct `currentPassword`, and a new password meeting FR-006. On success it MUST update the hash, reset `failedLoginCount=0`, revoke all Sessions for the user EXCEPT the session that issued the current access token (so the user stays signed in on the current device), and emit `auth.password_changed`.
- **FR-031**: `POST /auth/forgot-password` MUST accept an email, always return 200 with a generic message (no enumeration), and, if a matching ACTIVE User exists, create a `PasswordResetToken` (single-use, 1-hour TTL, stored as hash) and emit a `notification.password_reset_requested` event carrying the raw token for email dispatch by the Notifications module.
- **FR-032**: `POST /auth/reset-password` MUST accept `{ token, newPassword }`; on a match to an unexpired unconsumed `PasswordResetToken`, it MUST update the password hash, mark the token consumed, revoke every Session for the user, set `status=ACTIVE` (unblocking a LOCKED state), and emit `auth.password_reset`.
- **FR-033**: `POST /auth/reset-password` with an expired, already-consumed, or unknown token MUST return 400 with a generic "Invalid or expired token" message and no state change.

**Sessions**

- **FR-034**: The `Session` entity MUST store: `id`, `userId`, `channel` (ChannelType), `refreshTokenHash`, `createdAt`, `lastUsedAt`, `expiresAt`, `revokedAt` (nullable), `userAgent`, `ipAddress`.
- **FR-035**: A single user MAY have multiple concurrent sessions — at most one active session per `(userId, channel)` pair. A new login on the same channel MUST revoke the prior session for that channel (single-device-per-channel policy for MVP).
- **FR-036**: HR_ADMIN and SYSTEM_ADMIN MUST be able to list a user's sessions (`GET /users/:id/sessions`) and revoke a specific session (`POST /users/:id/sessions/:sessionId/revoke`) or all of them (`POST /users/:id/sessions/revoke-all`). Refresh-token hashes MUST NOT appear in any response.
- **FR-037**: Users MUST be able to list and revoke their OWN sessions via `GET /auth/sessions` and `DELETE /auth/sessions/:sessionId`.
- **FR-038**: Expired sessions (`expiresAt < now`) MUST be treated as revoked at validation time and cleaned up by a periodic maintenance job at least once per day.

**System Tokens (AI Scheduled Tasks)**

- **FR-039**: The module MUST expose a shared `AgentContextFactory.forSystemTask({ taskType })` utility (in `@sentient/shared`) that mints a SYSTEM token signed with a separate `SYSTEM_JWT_SECRET` (not `JWT_SECRET`), with payload `{ sub: 'system', roles: ['SYSTEM'], scope: 'GLOBAL', taskType, iat, exp }` and `exp ≤ iat + 5 min`.
- **FR-040**: SYSTEM tokens MUST NOT be interchangeable with user JWTs: the `SharedJwtGuard` MUST reject a SYSTEM-secret-signed token on user endpoints, and the SYSTEM role handlers MUST reject user-secret-signed tokens claiming `roles: ['SYSTEM']`.
- **FR-041**: Endpoints that accept SYSTEM tokens MUST explicitly declare it (`@Roles('SYSTEM')`). The default policy is that SYSTEM is NOT a superuser — endpoints must opt in.
- **FR-042**: The set of `taskType` values accepted for SYSTEM tokens MUST be enumerated (e.g., `exit_survey_dispatch`, `engagement_snapshot`, `leave_accrual`, `regulation_seed`, `org_scenario_amendment`). A SYSTEM token with an unknown `taskType` MUST be rejected.

**Agent-Delegated Actions**

- **FR-043**: When AI Agentic calls HR Core or Social on behalf of a human user, it MUST forward the user's original access token on the `Authorization` header — never substitute, never elevate. The REST clients (`HrCoreClient`, `SocialClient`) MUST accept an `AgentContext` (defined in `@sentient/shared`) rather than a raw `jwt: string`, so the token source is explicit.
- **FR-044**: On HTTP 403 from any downstream call during an agent-delegated action, the agent's `GracefulDegradationHandler` MUST return an `AgentDegradationResult` (no exception thrown), and the corresponding `AgentTaskLog` entry MUST be persisted with `status=DEGRADED` and the 403 response details.

**Audit & Security Events**

- **FR-045**: The module MUST persist a `SecurityEvent` row for each of: successful login, failed login, logout, password change, password reset request, password reset completion, role grant, role revoke, role created, role deleted, role permission added, role permission removed, account lock, account unlock, user deactivate, session revoke. Each row captures `userId` (nullable for pre-auth events), `eventType`, `channel`, `ipAddress`, `userAgent`, `correlationId`, `outcome`, `metadata` (JSON), `occurredAt`.
- **FR-046**: The `SecurityEvent` table MUST be append-only. No update or delete endpoints exist. SYSTEM_ADMIN can read; others get 403.
- **FR-047**: Every inbound HTTP request across all three services MUST carry or be assigned an `x-correlation-id` header via middleware; the ID MUST be attached to every `SecurityEvent` and `AgentTaskLog` row it causes, enabling end-to-end tracing.

**Cross-Cutting Activation**

- **FR-048**: On release, every `// TODO(iam)` comment that currently disables `@UseGuards(SharedJwtGuard, RbacGuard)` or `@Roles(...)` across HR Core, Social, and AI Agentic MUST be removed and the guards restored. A repository-wide grep for `TODO(iam)` MUST return zero matches as an acceptance gate.
- **FR-049**: The RBAC matrix in `.claude/rules/security.md` is the contract. For every row in that matrix, a contract test MUST verify that allowed roles receive 2xx and denied roles receive 403 on the corresponding endpoint.

**Rate Limiting & Abuse Control**

- **FR-050**: `/auth/login`, `/auth/forgot-password`, and `/auth/reset-password` MUST each be throttled (`@Throttle`) to a conservative limit (e.g., 10/min per IP, 5/min per email on login). Violations return 429.

**Role Catalog Management (GLOBAL_HR_ADMIN)**

- **FR-051**: GLOBAL_HR_ADMIN and SYSTEM_ADMIN MUST be able to create custom roles via `POST /roles`. The `code` MUST be unique across the platform (case-insensitive), consist only of uppercase letters and underscores, be non-empty, and must not collide with any existing role code. Created roles have `isSystem=false`, `isEditable=true`, and start with zero permissions.
- **FR-052**: GLOBAL_HR_ADMIN and SYSTEM_ADMIN MUST be able to assign any permission from the seeded permission catalog to any role where `isEditable=true` via `POST /roles/:id/permissions`. Assigning a permission that is already assigned to the role MUST be idempotent (200 OK, no duplicate RolePermission row created).
- **FR-053**: GLOBAL_HR_ADMIN and SYSTEM_ADMIN MUST be able to remove a permission from a role where `isEditable=true` via `DELETE /roles/:id/permissions/:permId`. Attempting to remove a permission not currently assigned to the role MUST return 404.
- **FR-054**: GLOBAL_HR_ADMIN and SYSTEM_ADMIN MUST be able to delete a custom role (`isSystem=false`) via `DELETE /roles/:id` if and only if there are zero active UserRole rows for that role (`revokedAt IS NULL`). Deletion with active assignments MUST return 409 "Role has active assignments — revoke all assignments before deleting".
- **FR-055**: Roles with `isSystem=true` MUST NOT be deletable by any caller or endpoint. Any delete attempt on a system role MUST return 409 "System roles cannot be deleted".
- **FR-056**: Roles with `isEditable=false` (SYSTEM and SYSTEM_ADMIN) MUST reject `POST /roles/:id/permissions` and `DELETE /roles/:id/permissions/:permId` with 403 "Role permissions are locked". Attempts to programmatically change `isEditable` or `isSystem` flags via any API MUST return 400 — these fields are set at seed time only and are immutable thereafter.

### Key Entities

- **User** — The authenticated identity. Fields: `id`, `employeeId` (nullable, 1:1 FK logical reference), `email` (unique, lowercased), `passwordHash`, `status` (UserStatus), `mustChangePassword`, `failedLoginCount`, `lockedUntil`, `lastLoginAt`, `createdAt`, `updatedAt`, `deletedAt`. One-to-many with UserRole and Session. One-to-many with SecurityEvent.

- **Role** — A named bundle of permissions. Fields: `id`, `code` (unique String, uppercase snake_case — e.g., `HR_ADMIN`, `REGIONAL_HR_SPECIALIST`), `name`, `description`, `isSystem` (Boolean — true for the seven platform-seeded roles; system roles cannot be deleted), `isEditable` (Boolean — true for all roles except `SYSTEM` and `SYSTEM_ADMIN`; if false, the role's permission set is permanently locked), `createdAt`. Many-to-many with Permission via RolePermission.

- **Permission** — A single capability. Fields: `id`, `resource` (string, e.g., `employee`, `leave_request`, `announcement`), `action` (PermissionAction: CREATE, READ, UPDATE, DELETE, APPROVE), `scope` (PermissionScope: OWN, TEAM, DEPARTMENT, BUSINESS_UNIT, GLOBAL). Unique on `(resource, action, scope)`. Catalog is seeded at deployment; not modifiable at runtime.

- **UserRole** — Per-assignment scope join. Fields: `id`, `userId`, `roleId`, `scope` (PermissionScope — the scope at which this assignment applies), `scopeEntityId` (nullable String — teamId, departmentId, or businessUnitId corresponding to the scope), `assignedBy` (userId), `assignedAt`, `revokedAt` (nullable). Active if `revokedAt IS NULL`. Partial unique index: `(userId, roleId, scopeEntityId) WHERE revokedAt IS NULL`.

- **RolePermission** — Join. Fields: `id`, `roleId`, `permissionId`. Seeded idempotently from the RBAC matrix.

- **Session** — One row per active refresh-token grant. Fields: `id`, `userId`, `channel` (ChannelType), `refreshTokenHash` (never returned in responses), `userAgent`, `ipAddress`, `createdAt`, `lastUsedAt`, `expiresAt`, `revokedAt` (nullable). Unique active session per `(userId, channel)` — enforced by conditional unique index on `(userId, channel) WHERE revokedAt IS NULL`.

- **PasswordResetToken** — Single-use reset grant. Fields: `id`, `userId`, `tokenHash` (never returned), `expiresAt`, `consumedAt` (nullable), `createdAt`. Lookup by hash.

- **SecurityEvent** — Append-only audit log. Fields: `id`, `userId` (nullable for pre-auth events), `eventType` (SecurityEventType enum), `channel`, `ipAddress`, `userAgent`, `correlationId`, `outcome` (SUCCESS / FAILURE), `metadata` (JSON), `occurredAt`. Indexed on `(userId, occurredAt DESC)` and `(eventType, occurredAt DESC)`.

- **UserStatus (enum)** — PENDING_ACTIVATION, ACTIVE, LOCKED, DISABLED.

- **SecurityEventType (enum)** — LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, PASSWORD_CHANGED, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED, ROLE_GRANTED, ROLE_REVOKED, ROLE_CREATED, ROLE_DELETED, ROLE_PERMISSION_ADDED, ROLE_PERMISSION_REMOVED, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, USER_DEACTIVATED, SESSION_REVOKED, SYSTEM_TOKEN_ISSUED.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from unauthenticated to authenticated (email + password submit → first protected page loaded) in under 3 seconds on a standard broadband connection, including token issuance and first-page render.
- **SC-002**: Access-token validation on every protected endpoint takes under 10 milliseconds at P95 (measured in isolation from database queries) — achieved by verifying the signed claims in-memory rather than round-tripping to the database on the hot path.
- **SC-003**: For the full RBAC matrix defined in `rules/security.md`, 100% of (role × endpoint) pairs return the expected outcome: allowed pairs return 2xx, denied pairs return 403. Zero silent data leaks are observed in automated role-sweeping tests.
- **SC-004**: When HR_ADMIN deactivates a user or the `employee.terminated` event fires, 100% of that user's active sessions are revoked within 60 seconds across all three services. Measured by end-to-end test: deactivate → wait ≤60s → old access token returns 401.
- **SC-005**: Password reset tokens are single-use 100% of the time. An automated test that uses the same token twice succeeds exactly once. No test run in the suite produces two successful uses from one token.
- **SC-006**: Account lockout engages after 5 failed logins within 15 minutes and auto-clears after the configured duration. Verified by an automated brute-force simulation — the 6th attempt at minute 14 returns 401-locked; the 1st attempt at minute 30 proceeds normally.
- **SC-007**: Zero plaintext passwords appear anywhere in: the database (verified by row scan), the application logs (verified by log pattern scan across a full e2e test run), or API response bodies (verified by Supertest response-payload inspection on every auth endpoint).
- **SC-008**: SYSTEM tokens are valid for at most 5 minutes and are rejected outside the declared SYSTEM-endpoint allowlist 100% of the time. Verified by a contract test that presents a SYSTEM token to every non-SYSTEM endpoint in all three services.
- **SC-009**: Agent-delegated calls inherit the user's scope — a test where an EMPLOYEE asks an agent to fetch team data returns a graceful degradation message and zero teammate records, on 100% of runs.
- **SC-010**: Every security-significant action (FR-045 event list) produces exactly one `SecurityEvent` row. A test suite that exercises each event type verifies a 1:1 action-to-row ratio with correct `correlationId` propagation.
- **SC-011**: A repository-wide search for `TODO(iam)` returns zero results at release. Guards and `@Roles(...)` are live on every protected endpoint in HR Core, Social, and AI Agentic.

## Assumptions

- **Authentication method**: Email + password is the sole first-party authentication method for MVP. Social SSO (Google, Microsoft), SAML, and enterprise IdP integration are out of scope and deferred.
- **MFA**: Multi-factor authentication (TOTP, SMS, email OTP) is out of scope for MVP. The data model leaves room (`User` can grow a `mfaSecret` field later) but no MFA flow ships in this module.
- **Password reset delivery**: Reset tokens are delivered by email only, via the Notifications module consuming the `notification.password_reset_requested` event. SMS/WhatsApp reset delivery is deferred.
- **Access token format**: JWT (signed with HS256 and `JWT_SECRET`) for user tokens; JWT (HS256, `SYSTEM_JWT_SECRET`) for SYSTEM tokens. Asymmetric (RS256) signing is deferred until a key-rotation story is scoped.
- **Access token TTL**: 15 minutes. **Refresh token TTL**: 7 days. **Password reset token TTL**: 1 hour. **System token TTL**: 5 minutes. All configurable via environment variables but these are the defaults.
- **Lockout policy**: 5 failed logins within 15 minutes triggers a 15-minute automatic lock. Repeat offenders (>3 lockouts in 24h) escalate to admin-review status out of scope for MVP.
- **Password policy**: 12-char minimum, one each of upper/lower/digit/symbol, no reuse of last 5 passwords, not equal to email local-part. Fully configurable via env vars.
- **Role model**: Seven platform-seeded roles: EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE, GLOBAL_HR_ADMIN, SYSTEM_ADMIN, SYSTEM. All are `isSystem=true` (cannot be deleted). SYSTEM and SYSTEM_ADMIN are `isEditable=false` (permission sets locked). The other five are `isEditable=true` — GLOBAL_HR_ADMIN can adjust their permission sets. GLOBAL_HR_ADMIN can additionally create platform-global custom roles (`isSystem=false`, `isEditable=true`) and assign any seeded permission to them. The permission catalog itself is fixed (seeded at deployment, not configurable at runtime). Dynamic permission creation (new resources or actions) is out of scope.
- **Scope model**: Five scope levels — OWN ⊂ TEAM ⊂ DEPARTMENT ⊂ BUSINESS_UNIT ⊂ GLOBAL — with strict implicit inclusion: granting BUSINESS_UNIT scope covers all departments and teams in that BU without per-department fan-out. Scope lives on UserRole (per-assignment via `scope` + `scopeEntityId`), not on the User or Employee entities. MANAGER is scope-polymorphic: the same role code, but a TEAM-scoped UserRole makes someone a team manager; a DEPARTMENT-scoped UserRole makes them a department manager. HR_ADMIN defaults to BUSINESS_UNIT scope with a required `scopeEntityId`; the GLOBAL_HR_ADMIN role covers cross-BU and platform-wide HR operations.
- **Session model**: One active session per `(user, channel)` pair. Multiple device tabs of the same browser share a single WEB session. Device-level granularity is deferred.
- **Role change latency**: Role grants and revocations take effect no later than the next access-token issuance (≤15 min) for existing sessions. Immediate global invalidation (e.g., `userVersion` in JWT) is not implemented in MVP; HR_ADMIN can force immediate effect by revoking the user's sessions.
- **Channel support**: Only WEB login is fully exercised in MVP. The `Session.channel` column accepts SLACK/WHATSAPP/EMAIL/IN_APP but those login flows are implemented by the respective channel modules in Months 4+.
- **SYSTEM_ADMIN bootstrap**: The seed script creates exactly one SYSTEM_ADMIN user at first run, seeded from env vars (`SEED_SYSTEM_ADMIN_EMAIL`, `SEED_SYSTEM_ADMIN_PASSWORD`); the password must be rotated on first login (`mustChangePassword=true`). This user has no `employeeId` linkage.
- **Shared JWT secret**: `JWT_SECRET` is known to all three services via environment variables and is symmetric (HS256). Secret rotation is a manual operator task for MVP; zero-downtime rotation is deferred.
- **Cross-service trust**: The three services implicitly trust each other's validated JWTs. mTLS between services is deferred; Phase 2 (Kafka + multi-node) would introduce service-to-service authentication.
- **Rate limits**: Login 10/min/IP + 5/min/email; forgot-password 5/min/IP; reset-password 10/min/IP. Backed by `@nestjs/throttler` already installed on HR Core.
- **Email for password reset**: The IAM module emits `notification.password_reset_requested` with the raw token — it does NOT send email itself. The Notifications module consumes the event and dispatches. If Notifications is down, reset emails are delayed but the token is still valid until its TTL.
- **Employee ↔ User relationship**: Strictly 1:1 for human employees. SYSTEM_ADMIN accounts that do not represent a person have `employeeId = null`.
- **Bootstrap order**: Seed order is: (1) Permissions, (2) Roles, (3) RolePermissions, (4) SYSTEM_ADMIN User + UserRole. All idempotent. Later modules' seeds (Departments, Teams, Positions, Employees, LeaveTypes…) run after IAM seed completes.
- **Testing**: Contract tests live in `test/contracts/rbac-matrix.contract.spec.ts` and iterate every row of the security matrix in `rules/security.md`. Any future endpoint added without matrix coverage MUST cause this suite to fail.
