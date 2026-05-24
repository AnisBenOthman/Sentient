---
description: "Task list for IAM module implementation (006-iam-module)"
---

# Tasks: Identity & Access Management (IAM) Module

**Feature**: 006-iam-module | **Branch**: `006-iam-module`
**Input**: Design documents from `/specs/006-iam-module/`
**Prerequisites**: plan.md, spec.md (research.md, data-model.md, contracts/, quickstart.md to be generated AFTER tasks.md per plan workflow)

**Tests**: Included. The spec calls out an RBAC matrix contract test (FR-049, SC-003), Argon2 wrapper unit tests, `buildScopeFilter` unit tests, session state-machine unit tests, and an end-to-end IAM integration suite. Test tasks are generated accordingly.

**Organization**: Tasks are grouped by user story so each slice — MVP sign-in (US1), RBAC activation (US2), provisioning (US3), role catalog (US7), password self-service (US4), multi-channel sessions (US5), and SYSTEM tokens + agent delegation (US6) — can be implemented, tested, and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependencies — can run in parallel
- **[Story]**: US1..US7 maps to the spec's user stories; Setup/Foundational/Polish have no story label

## Path Conventions

Monorepo (pnpm + Turborepo). Backend = NestJS in `apps/hr-core/`, shared contracts in `packages/shared/`. No frontend work in this feature — UI integration is out of scope until Month 3.

## Cross-Cutting Constraints (read before starting)

- **No `isActive` booleans anywhere.** The spec deliberately uses `UserStatus` enum (`PENDING_ACTIVATION | ACTIVE | LOCKED | DISABLED`) for `User`, and a nullable `revokedAt` timestamp for `UserRole` and `Session`. Do NOT add `isActive`, `active`, `enabled`, or similar boolean shortcuts. Every "is it live?" check reads `status === 'ACTIVE'` (User) or `revokedAt IS NULL` (UserRole, Session). This is called out explicitly because it is easy to retrofit and breaks downstream filter semantics (partial unique indexes depend on `revokedAt IS NULL`).
- **Role.code is a free string at runtime.** `RoleCode` enum in `@sentient/shared` exists only for seed data + type-safe defaults. Do NOT constrain `Role.code` to the enum in Prisma — it's `String @unique`.
- **Do NOT import from `apps/hr-core/` inside Social or AI Agentic.** All shared auth primitives live in `packages/shared/src/auth/`.
- **JWT payload carries no PII.** Only `sub, employeeId, roles, departmentId, teamId, businessUnitId, channel, roleAssignments, iat, exp`. No email, no name, no salary.
- **Password hashing is Argon2id.** Never bcrypt. ~200ms calibration on target hardware.
- **SYSTEM tokens use a separate secret.** `SYSTEM_JWT_SECRET`, not `JWT_SECRET`. 5-minute max TTL.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install runtime dependencies and declare the new shared-package surface that every subsequent phase depends on.

- [ ] T001 Add `argon2` and `jsonwebtoken` (with `@types/jsonwebtoken`) to `apps/hr-core/package.json` `dependencies`; run `pnpm install` at repo root. Verify `@nestjs/throttler` and `@nestjs/schedule` are already present (installed in 005-leave-module).
- [ ] T002 [P] Add new env vars to `.env.example`: `JWT_SECRET`, `JWT_EXPIRY=15m`, `REFRESH_TOKEN_EXPIRY_DAYS=7`, `SYSTEM_JWT_SECRET`, `SYSTEM_JWT_EXPIRY=5m`, `PASSWORD_RESET_TOKEN_TTL_MIN=60`, `LOGIN_LOCKOUT_THRESHOLD=5`, `LOGIN_LOCKOUT_WINDOW_MIN=15`, `LOGIN_LOCKOUT_DURATION_MIN=15`, `SEED_SYSTEM_ADMIN_EMAIL`, `SEED_SYSTEM_ADMIN_PASSWORD`.
- [ ] T003 [P] Create enum file `packages/shared/src/enums/user-status.enum.ts` exporting `UserStatus` with values `PENDING_ACTIVATION | ACTIVE | LOCKED | DISABLED`.
- [ ] T004 [P] Create enum file `packages/shared/src/enums/security-event-type.enum.ts` exporting `SecurityEventType` with 17 values: `LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, PASSWORD_CHANGED, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED, ROLE_GRANTED, ROLE_REVOKED, ROLE_CREATED, ROLE_DELETED, ROLE_PERMISSION_ADDED, ROLE_PERMISSION_REMOVED, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED, USER_DEACTIVATED, SESSION_REVOKED, SYSTEM_TOKEN_ISSUED`.
- [ ] T005 [P] Create enum file `packages/shared/src/enums/role-code.enum.ts` exporting `RoleCode` with values `EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE, GLOBAL_HR_ADMIN, SYSTEM_ADMIN, SYSTEM` plus a one-line JSDoc noting it is reference-only (Role.code is free string).
- [ ] T006 [P] Create enum file `packages/shared/src/enums/permission-action.enum.ts` exporting `PermissionAction` with values `CREATE, READ, UPDATE, DELETE, APPROVE`.
- [ ] T007 Modify `packages/shared/src/enums/permission-scope.enum.ts` to insert `BUSINESS_UNIT` between `DEPARTMENT` and `GLOBAL`. Final order: `OWN, TEAM, DEPARTMENT, BUSINESS_UNIT, GLOBAL`.
- [ ] T008 Update `packages/shared/src/enums/index.ts` barrel to re-export `UserStatus`, `SecurityEventType`, `RoleCode`, `PermissionAction`, and the updated `PermissionScope`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Everything every user story needs — Prisma schema with all 8 new entities, shared-package auth primitives (guards, factories, ScopeFilterBuilder), IAM module skeleton, Argon2 + token services, security audit writer, and the seed that populates Permissions/Roles/RolePermissions + SYSTEM_ADMIN.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Prisma schema & migration

- [ ] T009 Modify `apps/hr-core/prisma/schema.prisma` to add all 8 IAM models. Use `status: UserStatus`, `revokedAt: DateTime?` patterns — no `isActive` booleans. Models:
  - `User { id, employeeId String? @unique, email String @unique, passwordHash, status UserStatus @default(PENDING_ACTIVATION), mustChangePassword Boolean @default(true), failedLoginCount Int @default(0), lockedUntil DateTime?, lastLoginAt DateTime?, createdAt, updatedAt, deletedAt DateTime? }`
  - `Role { id, code String @unique, name, description String?, isSystem Boolean @default(false), isEditable Boolean @default(true), createdAt }`
  - `Permission { id, resource, action PermissionAction, scope PermissionScope, @@unique([resource, action, scope]) }`
  - `UserRole { id, userId, roleId, scope PermissionScope, scopeEntityId String?, assignedBy String, assignedAt, revokedAt DateTime? }` — partial unique index on `(userId, roleId, scopeEntityId) WHERE revokedAt IS NULL` added via raw SQL in migration (see T011).
  - `RolePermission { id, roleId, permissionId, @@unique([roleId, permissionId]) }`
  - `Session { id, userId, channel ChannelType, refreshTokenHash, userAgent, ipAddress, createdAt, lastUsedAt, expiresAt, revokedAt DateTime? }` — partial unique on `(userId, channel) WHERE revokedAt IS NULL` added via raw SQL.
  - `PasswordResetToken { id, userId, tokenHash @unique, expiresAt, consumedAt DateTime?, createdAt }`
  - `SecurityEvent { id, userId String?, eventType SecurityEventType, channel ChannelType?, ipAddress String?, userAgent String?, correlationId String?, outcome String, metadata Json?, occurredAt DateTime @default(now()), @@index([userId, occurredAt(sort: Desc)]), @@index([eventType, occurredAt(sort: Desc)]) }`
  - All models annotated `@@schema("hr_core")` and `@@map("snake_case_plural")`.
  - Add opposite-side relations: `User.roles UserRole[]`, `User.sessions Session[]`, `User.events SecurityEvent[]`, `User.passwordResets PasswordResetToken[]`, `Employee.user User?` (optional 1:1 via logical employeeId).
- [ ] T010 Run `cd apps/hr-core && npx prisma migrate dev --name add_iam_module --create-only` to generate the migration SQL under `apps/hr-core/prisma/migrations/<timestamp>_add_iam_module/`.
- [ ] T011 Append raw SQL to the generated migration.sql for the two partial unique indexes that Prisma cannot express declaratively: `CREATE UNIQUE INDEX "user_roles_active_assignment_key" ON "hr_core"."user_roles"("user_id", "role_id", "scope_entity_id") WHERE "revoked_at" IS NULL;` and `CREATE UNIQUE INDEX "sessions_active_channel_key" ON "hr_core"."sessions"("user_id", "channel") WHERE "revoked_at" IS NULL;`. Verify no `DROP CONSTRAINT` vs `DROP INDEX` hazard (fresh indexes, no prior equivalents).
- [ ] T012 Run `npx prisma migrate dev` in `apps/hr-core/` to apply the migration to the local dev DB and regenerate the Prisma client under `apps/hr-core/src/generated/prisma`.

### Shared-package auth contracts

- [ ] T013 [P] Create `packages/shared/src/auth/jwt-payload.interface.ts` exporting `JwtPayload { sub: string; employeeId: string | null; roles: string[]; departmentId: string | null; teamId: string | null; businessUnitId: string | null; channel: ChannelType; roleAssignments: RoleAssignmentClaim[]; iat: number; exp: number }` and `RoleAssignmentClaim { roleCode: string; scope: PermissionScope; scopeEntityId: string | null }`.
- [ ] T014 [P] Create `packages/shared/src/auth/system-jwt-payload.interface.ts` exporting `SystemJwtPayload { sub: 'system'; roles: ['SYSTEM']; scope: 'GLOBAL'; taskType: string; iat: number; exp: number }`.
- [ ] T015 [P] Create `packages/shared/src/auth/agent-context.interface.ts` exporting `AgentContext { jwt: string; claims: JwtPayload | SystemJwtPayload; isSystemContext: boolean; taskLogId: string }`.
- [ ] T016 [P] Create `packages/shared/src/auth/roles.decorator.ts` exporting `@Roles(...roles: string[])` via `SetMetadata('roles', roles)`.
- [ ] T017 [P] Create `packages/shared/src/auth/current-user.decorator.ts` exporting `@CurrentUser()` param decorator that extracts `request.user: JwtPayload`.
- [ ] T018 Create `packages/shared/src/auth/shared-jwt.guard.ts` — `SharedJwtGuard` that verifies the bearer token against `JWT_SECRET` (HS256, ≤60s clock-skew leeway), attaches `request.user = payload`, and throws `UnauthorizedException` on any failure. No DB access. Handles both user JWTs and rejects tokens that claim `roles: ['SYSTEM']` but are signed with `JWT_SECRET` (FR-040).
- [ ] T019 [P] Create `packages/shared/src/auth/rbac.guard.ts` — `RbacGuard` that reads the `@Roles(...)` metadata via `Reflector` and allows the request when `request.user.roles` intersects the required set. 403 on mismatch. Depends on T016.
- [ ] T020 Create `packages/shared/src/auth/scope-filter.builder.ts` — pure function `buildScopeFilter(user: JwtPayload, resource: string, action: PermissionAction): Prisma.WhereInput`. Implements the ladder `OWN ⊂ TEAM ⊂ DEPARTMENT ⊂ BUSINESS_UNIT ⊂ GLOBAL` with widest-scope union semantics across the user's `roleAssignments`. Depends on T013.
- [ ] T021 Create `packages/shared/src/auth/user-status.guard.ts` — `UserStatusGuard` applied AFTER `SharedJwtGuard`. Uses a 60-second in-memory cache keyed by `userId` to call back into HR Core (`GET /internal/users/:id/status` — see T058) and reject when `status !== 'ACTIVE'`. Does NOT reject on cache miss — only on confirmed non-ACTIVE status.
- [ ] T022 [P] Create `packages/shared/src/auth/agent-context.factory.ts` — `AgentContextFactory` with `fromRequest(request: Request, taskLogId: string): AgentContext` (reads Authorization header, decodes claims) and `forSystemTask({ taskType }): AgentContext` (mints a SystemJwtPayload, signs with `SYSTEM_JWT_SECRET`, TTL 5 min). Validates `taskType` against an allowlist constant exported from this same file.
- [ ] T023 Update `packages/shared/src/index.ts` barrel to export everything from `auth/` and the new enums.
- [ ] T024 Create `packages/shared/src/dto/login-response.dto.ts` exporting `LoginResponseDto { accessToken: string; refreshToken: string; user: PublicUserDto }` and `PublicUserDto { id, email, status, mustChangePassword, employeeId, roles, roleAssignments }`.

### HR Core IAM module scaffolding

- [ ] T025 Create `apps/hr-core/src/modules/iam/iam.module.ts` declaring the IAM NestJS module. Imports: `PrismaModule`, `ConfigModule`, `ScheduleModule.forRoot()` (if not already registered at app-module level), `ThrottlerModule`. Exports the services needed by other HR Core modules (`TokenService`, `AuditService`).
- [ ] T026 [P] Create `apps/hr-core/src/modules/iam/password/argon2.service.ts` — `Argon2Service { hash(plaintext): Promise<string>; verify(hash, plaintext): Promise<boolean> }` using `argon2.argon2id` with memoryCost/timeCost/parallelism calibrated to ~200ms on target hardware. Parameters sourced from env vars with sensible defaults.
- [ ] T027 [P] Create `apps/hr-core/src/modules/iam/password/argon2.service.spec.ts` — unit tests: hash produces distinct salts for same input; verify returns true for correct plaintext; verify returns false for wrong plaintext; timing sanity check.
- [ ] T028 Create `apps/hr-core/src/modules/iam/password/password-policy.service.ts` — `PasswordPolicyService.validate(plaintext, userContext): { valid: boolean; violations: string[] }`. Enforces FR-006: ≥12 chars, one each of upper/lower/digit/symbol, not equal to email local-part, not equal to any of the user's last 5 passwords (reuse history in `User.passwordHistory` column? — store last 5 hashes in a new `password_history` JSON column on User OR a separate table; pick JSON column for MVP simplicity). Update T009 schema before merging to add `passwordHistory Json? @default("[]")` to User.
- [ ] T029 Create `apps/hr-core/src/modules/iam/auth/token.service.ts` — `TokenService { signAccess(payload): string; signRefresh(): { raw: string; hash: string }; signSystem(taskType): string; verifyAccess(token): JwtPayload; verifyRefreshHash(raw, storedHash): boolean; verifySystem(token): SystemJwtPayload }`. Access + user tokens use `JWT_SECRET`; SYSTEM tokens use `SYSTEM_JWT_SECRET`. Refresh token is `crypto.randomBytes(32).toString('hex')`, hashed with SHA-256 before storage.
- [ ] T030 Create `apps/hr-core/src/modules/iam/audit/audit.service.ts` — `AuditService.record({ userId, eventType, channel, ipAddress, userAgent, correlationId, outcome, metadata }): Promise<void>`. Writes a `SecurityEvent` row. Append-only (no update/delete methods exposed).
- [ ] T031 [P] Create `apps/hr-core/src/modules/iam/audit/audit.controller.ts` — `GET /security-events` (filters: userId, eventType, date range, pagination). Guarded by `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles('SYSTEM_ADMIN')`. Returns newest first.
- [ ] T032 Modify `apps/hr-core/src/app.module.ts` to import `IamModule`, register `ScheduleModule.forRoot()` if not already, register global `ThrottlerModule` with defaults `{ttl: 60, limit: 100}`, and ensure `PrismaExceptionFilter` is registered globally (likely already done from prior features — verify only). Verify `CorrelationIdMiddleware` at `apps/hr-core/src/common/middleware/correlation-id.middleware.ts` is wired globally.

### Seed (runs before all other module seeds)

- [ ] T033 Modify `apps/hr-core/src/prisma/seed.ts` to run IAM seed FIRST (before Departments/Teams/Positions/Employees seed already present). Order: (1) seed `Permission` catalog — ~40 rows covering every (resource, action, scope) tuple from the RBAC matrices in `rules/security.md`; (2) seed 7 `Role` rows (`EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `EXECUTIVE`, `GLOBAL_HR_ADMIN`, `SYSTEM_ADMIN`, `SYSTEM`) with correct `isSystem=true` and `isEditable` flags per FR-019 (SYSTEM + SYSTEM_ADMIN isEditable=false; others isEditable=true); (3) seed `RolePermission` rows mapping each built-in role to its permissions per `rules/security.md`; (4) seed one `User` with email from `SEED_SYSTEM_ADMIN_EMAIL`, password hash from `SEED_SYSTEM_ADMIN_PASSWORD` via `Argon2Service`, status=PENDING_ACTIVATION, mustChangePassword=true, employeeId=null; (5) seed one `UserRole` linking that user to `SYSTEM_ADMIN` with `scope=GLOBAL, scopeEntityId=null`. Every `prisma.upsert` — idempotent.

### Internal status endpoint (for UserStatusGuard)

- [ ] T034 Create `apps/hr-core/src/modules/iam/users/users.controller.ts` stub with `GET /internal/users/:id/status` endpoint returning `{ status: UserStatus; lastStatusChangeAt: Date }`. Guarded by a service-to-service auth mechanism: accepts either (a) a valid SYSTEM token, or (b) a shared `INTERNAL_SERVICE_SECRET` header. Used by `UserStatusGuard` in the other two services. (Full users CRUD arrives in US3.)

**Checkpoint**: Foundation ready — all 8 entities migrated, shared auth primitives exported, seed populates the RBAC matrix, IAM module is wired. User story implementation can now begin.

---

## Phase 3: User Story 1 - Sign-in and authenticated access (Priority: P1) 🎯 MVP

**Goal**: A provisioned user can `POST /auth/login`, get access + refresh tokens, hit a protected endpoint on any of the 3 services, refresh an expired access token, and log out. Session rows track per-channel grants.

**Independent Test**: Seed one ACTIVE user (manually promote the SYSTEM_ADMIN seed user to ACTIVE + clear mustChangePassword). POST `/auth/login` → receive `{accessToken, refreshToken, user}`. Call `GET /employees/me` on HR Core with the access token → 200. Call `GET /announcements` on Social → 200. POST `/auth/refresh` → new access token. POST `/auth/logout` → subsequent refresh with old refresh token → 401.

### Tests for User Story 1

- [ ] T035 [P] [US1] Contract test `apps/hr-core/test/integration/iam.integration.spec.ts` (new file) — scenario: login success, login wrong password (401 + LOGIN_FAILED SecurityEvent), login locked after 5 failures within 15 min, refresh rotation, refresh replay → full session chain revoked (FR-014), logout. Uses real Prisma + `hr_core` test schema per `rules/testing.md`.
- [ ] T036 [P] [US1] Unit test `apps/hr-core/src/modules/iam/auth/auth.service.spec.ts` — covers: Argon2 verify called on login; `failedLoginCount` increments on wrong password; account lock engages at threshold; refresh-token hash comparison; session creation sets `expiresAt` correctly from env TTL.
- [ ] T037 [P] [US1] Unit test `packages/shared/src/auth/scope-filter.builder.spec.ts` — `OWN` filter returns `{ id: user.employeeId }`, `TEAM` returns `{ OR: [{ managerId: user.employeeId }, { id: user.employeeId }] }`, `DEPARTMENT` returns `{ departmentId: user.departmentId }`, `BUSINESS_UNIT` returns `{ businessUnitId: user.businessUnitId }`, `GLOBAL` returns `{}`; widest-scope union works when user has both OWN and DEPARTMENT assignments.

### Implementation for User Story 1

- [ ] T038 [US1] Create `apps/hr-core/src/modules/iam/dto/login.dto.ts` — `LoginDto { @IsEmail email: string; @IsString @MinLength(1) password: string; @IsEnum(ChannelType) @IsOptional channel?: ChannelType }` (default `WEB` in service).
- [ ] T039 [P] [US1] Create `apps/hr-core/src/modules/iam/dto/refresh.dto.ts` — `RefreshDto { @IsString refreshToken: string }`.
- [ ] T040 [US1] Create `apps/hr-core/src/modules/iam/auth/auth.service.ts` implementing `login(dto, req)`, `refresh(dto, req)`, `logout(userId, sessionId)`. Business rules:
  - `login`: lowercase email; load User by email; if `status === LOCKED && lockedUntil > now` → 401 locked; verify Argon2; on failure → increment `failedLoginCount`, if threshold reached set `status=LOCKED, lockedUntil=now+15min`, emit `LOGIN_FAILED` audit, throw 401; on success → reset `failedLoginCount=0`, update `lastLoginAt`, resolve UserRoles + role codes + roleAssignments claim array, build JWT payload, sign access + refresh, revoke any prior active Session for `(userId, channel)` (per FR-035 partial unique index), insert new Session with `refreshTokenHash`, emit `LOGIN_SUCCESS` audit, return `LoginResponseDto`.
  - `refresh`: load Session by `refreshTokenHash`; if `revokedAt !== null` OR `expiresAt < now` → revoke ALL sessions in the chain (FR-014 replay path), throw 401; else rotate — generate new refresh, hash, update Session (`refreshTokenHash`, `lastUsedAt=now`), re-sign access token with fresh claims (re-read roleAssignments in case of mid-session role changes), return new pair.
  - `logout`: mark the session `revokedAt=now`, emit `LOGOUT` audit.
- [ ] T041 [US1] Create `apps/hr-core/src/modules/iam/auth/auth.controller.ts` with endpoints:
  - `POST /auth/login` — anonymous (no guards), `@Throttle({ default: { limit: 10, ttl: 60000 } })`, `@ApiOperation`, accepts `LoginDto`, returns `LoginResponseDto`.
  - `POST /auth/refresh` — anonymous, `@Throttle` 30/min/IP, accepts `RefreshDto`, returns new `{ accessToken, refreshToken }`.
  - `POST /auth/logout` — `@UseGuards(SharedJwtGuard)`, no body, returns 204.
  - All three endpoints emit audit events via `AuditService`.
- [ ] T042 [US1] Wire `AuthService`, `AuthController`, `TokenService`, `Argon2Service`, `AuditService` into `IamModule` providers/controllers. Export `TokenService` and `AuditService`.
- [ ] T043 [US1] Verify the SYSTEM_ADMIN seed user can POST `/auth/login` after manually flipping their status to ACTIVE + mustChangePassword=false in the dev DB, and the returned access token is accepted by a protected HR Core endpoint (e.g., existing `GET /employees` once US2 reinstates guards — for now verify on `GET /security-events`).

**Checkpoint**: MVP sign-in works end-to-end. User Story 1 is independently testable and demoable.

---

## Phase 4: User Story 2 - Role and scope enforcement (Priority: P2)

**Goal**: Activate RBAC on every existing endpoint across all 3 services. Remove every `// TODO(iam)` marker. The RBAC matrix in `.claude/rules/security.md` becomes enforced by a contract test that fails CI if any row is wrong.

**Independent Test**: Seed 3 users (EMPLOYEE E, MANAGER M of E's team, HR_ADMIN A). Hit `GET /employees` on each: E → 1 row (self), M → 5 rows (self + 4 reports), A → all. Hit `GET /salary-history`: E and M → 403, A → data. Run the `rbac-matrix.contract.spec.ts` suite — 100% pass. Run `git grep "TODO(iam)"` at repo root → zero matches.

### Tests for User Story 2

- [ ] T044 [P] [US2] Create `test/contracts/rbac-matrix.contract.spec.ts` at repo root. Drives all 3 services via Supertest. Data-driven from a JSON fixture (`test/contracts/rbac-matrix.fixture.json`) derived mechanically from the 3 matrices in `.claude/rules/security.md` (one row per `role × endpoint × expected-status`). Fails if any row returns unexpected status. Depends on all 3 app modules booting cleanly.
- [ ] T045 [P] [US2] Unit test `packages/shared/src/auth/rbac.guard.spec.ts` — user with roles `['EMPLOYEE']` denied on `@Roles('HR_ADMIN')`; allowed on `@Roles('EMPLOYEE', 'HR_ADMIN')`; missing `@Roles()` metadata → guard allows (handled by `SharedJwtGuard` authentication layer).

### Implementation for User Story 2

- [ ] T046 [US2] HR Core: remove every `// TODO(iam)` comment block that disables `@UseGuards(SharedJwtGuard, RbacGuard)` or `@Roles(...)`. Scan `apps/hr-core/src/modules/**/*.controller.ts`. For each controller, restore the guards at the class level and `@Roles(...)` per the HR Core RBAC matrix in `rules/security.md`. Ensure `/health` stays anonymous.
- [ ] T047 [US2] Social: same as T046 but in `apps/social/src/modules/**/*.controller.ts`. Use `SharedJwtGuard` + `RbacGuard` from `@sentient/shared`. Ensure `/health` and `POST /exit-surveys/:id/respond` (survey-token gated) stay anonymous.
- [ ] T048 [US2] AI Agentic: same as T046 but in `apps/ai-agentic/src/**/*.controller.ts`. Ensure `/health` stays anonymous.
- [ ] T049 [US2] Apply `buildScopeFilter` in every Prisma query that returns records scoped below GLOBAL. Minimum set to update for this release: `EmployeesService.findAll/findOne`, `LeavesService.findAllRequests`, `SkillsService.findAll`. Each service reads `@CurrentUser() user: JwtPayload`, calls `buildScopeFilter(user, 'employee', 'READ')` (or equivalent), and spreads the returned `WhereInput` into its Prisma query.
- [ ] T050 [US2] Apply `@UseGuards(SharedJwtGuard, UserStatusGuard, RbacGuard)` globally in each of the 3 app modules via `APP_GUARD` providers (keeps endpoint-level `@Roles(...)` untouched). Confirm `/health` uses `@Public()` decorator or skip-guard metadata — add a `@Public()` decorator in `packages/shared/src/auth/public.decorator.ts` if one does not already exist, and make `SharedJwtGuard` honor it.
- [ ] T051 [US2] Run `git grep -n "TODO(iam)"` at repo root and confirm zero matches. Lock this into CI: add a script `scripts/check-no-todo-iam.sh` that exits 1 if any match found; invoke from `turbo lint`.

**Checkpoint**: All protected endpoints on all 3 services enforce RBAC. No `TODO(iam)` remains. Contract test passes.

---

## Phase 5: User Story 3 - HR Admin provisions users (Priority: P3)

**Goal**: HR_ADMIN and SYSTEM_ADMIN can create users linked to Employees, list/filter, assign/revoke roles, activate/deactivate, and soft-delete. New users land in PENDING_ACTIVATION and flip to ACTIVE on first password change.

**Independent Test**: HR_ADMIN POSTs `/users` with `{employeeId, email, initialPassword, roles: [{roleCode: 'EMPLOYEE', scope: 'OWN'}]}` → User row created, status=PENDING_ACTIVATION, one UserRole linked. New user logs in with initial password → first response forces password change; after change, status=ACTIVE. HR_ADMIN POSTs `/users/:id/roles` adding MANAGER/TEAM/team-X → token after next login includes both role assignments. HR_ADMIN POSTs `/users/:id/deactivate` → all sessions revoked, next token validation on any service returns 401 within 60s. Attempting to revoke the last SYSTEM_ADMIN → 409.

### Tests for User Story 3

- [ ] T052 [P] [US3] Unit test `apps/hr-core/src/modules/iam/users/users.service.spec.ts` — covers: duplicate email → 409; duplicate employeeId → 409; create user sets mustChangePassword=true; role assignment with scope=TEAM requires scopeEntityId; last-SYSTEM_ADMIN guard rejects revocation.
- [ ] T053 [P] [US3] Integration test in `apps/hr-core/test/integration/iam.integration.spec.ts` — create user flow, role assign/revoke flow, deactivate flow (verifies all Sessions revoked in single transaction).

### Implementation for User Story 3

- [ ] T054 [P] [US3] Create `apps/hr-core/src/modules/iam/dto/create-user.dto.ts` — `CreateUserDto { @IsUUID employeeId: string | null; @IsEmail email: string; @IsString @MinLength(12) initialPassword: string; @ValidateNested({each:true}) @Type(()=>AssignRoleDto) roles: AssignRoleDto[] }`.
- [ ] T055 [P] [US3] Create `apps/hr-core/src/modules/iam/dto/update-user.dto.ts` — `UpdateUserDto { @IsEmail @IsOptional email?: string; @IsOptional @IsBoolean mustChangePassword?: boolean }`. Status transitions go through dedicated endpoints, not PATCH.
- [ ] T056 [P] [US3] Create `apps/hr-core/src/modules/iam/dto/assign-role.dto.ts` — `AssignRoleDto { @IsString roleCode: string; @IsEnum(PermissionScope) scope: PermissionScope; @IsUUID @IsOptional scopeEntityId?: string | null }` with custom validator rejecting `scope ∈ {TEAM, DEPARTMENT, BUSINESS_UNIT}` when `scopeEntityId` is null, and rejecting `scope ∈ {OWN, GLOBAL}` when `scopeEntityId` is provided.
- [ ] T057 [P] [US3] Create `apps/hr-core/src/modules/iam/dto/revoke-role.dto.ts` — `RevokeRoleDto { @IsUUID userRoleId: string }` OR path param only — prefer path param `DELETE /users/:userId/roles/:userRoleId`, so this DTO may be omitted.
- [ ] T058 [US3] Extend `apps/hr-core/src/modules/iam/users/users.controller.ts` (created stub in T034) with full CRUD:
  - `POST /users` (`@Roles('HR_ADMIN','SYSTEM_ADMIN')`)
  - `GET /users` (list, filters: `status`, `roleCode`, pagination)
  - `GET /users/:id`
  - `PATCH /users/:id`
  - `POST /users/:id/activate` / `POST /users/:id/deactivate`
  - `DELETE /users/:id` (soft-delete, sets `deletedAt`)
  - `POST /users/:id/roles` (body: `AssignRoleDto`) / `DELETE /users/:userId/roles/:userRoleId`
  - Keep the `GET /internal/users/:id/status` endpoint from T034.
  - All decorated with Swagger operation + response schemas.
- [ ] T059 [US3] Create `apps/hr-core/src/modules/iam/users/users.service.ts`:
  - `create(dto, actorUserId)` — hash password via Argon2, validate against `PasswordPolicyService`, check duplicate email + duplicate employeeId (1:1), insert User + UserRole rows in a transaction, emit `ROLE_GRANTED` audit per role.
  - `assignRole(userId, dto, actorUserId)` — idempotent on active assignment (existing `(userId, roleId, scopeEntityId) WHERE revokedAt IS NULL` → 200 no-op); emit `ROLE_GRANTED`.
  - `revokeRole(userId, userRoleId, actorUserId)` — set `revokedAt=now`; if revoking SYSTEM_ADMIN role, count remaining active SYSTEM_ADMIN UserRoles and reject with 409 if this would be the last; emit `ROLE_REVOKED`.
  - `deactivate(userId, actorUserId)` — in one transaction: set `status=DISABLED`, mark all active Sessions `revokedAt=now`, emit `USER_DEACTIVATED` + one `SESSION_REVOKED` per session.
  - `activate(userId, actorUserId)` — only allowed from LOCKED or PENDING_ACTIVATION; set `status=ACTIVE`, emit `ACCOUNT_UNLOCKED`.
  - `softDelete(userId, actorUserId)` — guard: cannot delete if the user is the last active SYSTEM_ADMIN; set `deletedAt=now`, revoke all sessions.
  - All methods take an `actorUserId` for audit metadata.
- [ ] T060 [US3] First-login forced password change: modify `AuthService.login` from T040 to check `user.mustChangePassword`; if true, return `LoginResponseDto` with a `requiresPasswordChange: true` flag and issue an access token whose only permitted action is `POST /auth/change-password` (enforced by a guard + decorator, OR a short-lived 5-min token with a restrictive claim). On successful password change via T077, flip `status=ACTIVE` and `mustChangePassword=false`.
- [ ] T061 [US3] Wire `UsersService` + `UsersController` into `IamModule`.

**Checkpoint**: HR_ADMIN can fully manage user lifecycle. US3 is independently demoable.

---

## Phase 6: User Story 7 - GLOBAL_HR_ADMIN configures platform roles (Priority: P3)

**Goal**: GLOBAL_HR_ADMIN (and SYSTEM_ADMIN) can create custom roles from the fixed permission catalog, assign/remove permissions to/from editable roles, and delete custom roles that have zero active assignments. SYSTEM + SYSTEM_ADMIN remain permanently locked.

**Independent Test**: GLOBAL_HR_ADMIN POSTs `/roles` with `{code: 'REGIONAL_HR_SPECIALIST', name: 'Regional HR Specialist'}` → Role created, `isSystem=false, isEditable=true`, zero permissions. POST `/roles/:id/permissions` with a valid `permissionId` → RolePermission row created. Idempotent repeat → 200 no-op. DELETE `/roles/SYSTEM_ADMIN/permissions/:permId` → 403. DELETE `/roles/SYSTEM` → 409. Assign the custom role to a user, then DELETE the role → 409 active assignments. Revoke assignment, DELETE again → 204.

### Tests for User Story 7

- [ ] T062 [P] [US7] Unit test `apps/hr-core/src/modules/iam/roles/roles.service.spec.ts` — code validation (uppercase snake_case, unique case-insensitive); delete system role → 409; delete role with active assignments → 409; assign permission to `isEditable=false` role → 403; idempotent permission assignment; remove permission not currently assigned → 404.

### Implementation for User Story 7

- [ ] T063 [P] [US7] Create `apps/hr-core/src/modules/iam/dto/create-role.dto.ts` — `CreateRoleDto { @Matches(/^[A-Z][A-Z0-9_]*$/) code: string; @IsString @MinLength(1) name: string; @IsString @IsOptional description?: string }`.
- [ ] T064 [P] [US7] Create `apps/hr-core/src/modules/iam/dto/assign-role-permission.dto.ts` — `AssignRolePermissionDto { @IsUUID permissionId: string }`.
- [ ] T065 [US7] Create `apps/hr-core/src/modules/iam/roles/roles.service.ts`:
  - `listRoles()` — returns all Role rows with permission counts.
  - `getRole(id)` — returns role + its permissions.
  - `createRole(dto, actorUserId)` — enforce uppercase-snake-case regex, case-insensitive uniqueness via lowercase comparison, insert with `isSystem=false, isEditable=true`, emit `ROLE_CREATED`.
  - `deleteRole(id, actorUserId)` — guard: `isSystem=true` → 409; else count active UserRole rows for roleId (`revokedAt IS NULL`) → 409 if >0; else hard-delete Role + cascade its RolePermission rows in a transaction; emit `ROLE_DELETED`.
  - `addPermission(roleId, permissionId, actorUserId)` — guard: `isEditable=false` → 403; verify permission exists in catalog; idempotent insert; emit `ROLE_PERMISSION_ADDED`.
  - `removePermission(roleId, permissionId, actorUserId)` — guard: `isEditable=false` → 403; delete row; if row didn't exist → 404; emit `ROLE_PERMISSION_REMOVED`.
- [ ] T066 [US7] Create `apps/hr-core/src/modules/iam/roles/roles.controller.ts`:
  - `GET /roles` (`@Roles('HR_ADMIN','GLOBAL_HR_ADMIN','SYSTEM_ADMIN')`)
  - `GET /roles/:id` (same)
  - `POST /roles` (`@Roles('GLOBAL_HR_ADMIN','SYSTEM_ADMIN')`)
  - `DELETE /roles/:id` (`@Roles('GLOBAL_HR_ADMIN','SYSTEM_ADMIN')`)
  - `POST /roles/:id/permissions` (`@Roles('GLOBAL_HR_ADMIN','SYSTEM_ADMIN')`)
  - `DELETE /roles/:id/permissions/:permId` (`@Roles('GLOBAL_HR_ADMIN','SYSTEM_ADMIN')`)
  - Swagger-documented.
- [ ] T067 [US7] Wire `RolesService` + `RolesController` into `IamModule`.
- [ ] T068 [US7] Update `test/contracts/rbac-matrix.fixture.json` to include the role-catalog endpoints (GLOBAL_HR_ADMIN/SYSTEM_ADMIN allowed; everyone else denied).

**Checkpoint**: Platform-global role catalog is fully configurable by GLOBAL_HR_ADMIN. System roles remain locked.

---

## Phase 7: User Story 4 - Password self-service (Priority: P4)

**Goal**: Signed-in users change their password; anonymous users request a reset and use a single-use, 1-hour-TTL, hash-stored reset token to set a new password. Policy (length, complexity, reuse guard) enforced on both flows.

**Independent Test**: Signed-in user POSTs `/auth/change-password` with `{currentPassword, newPassword}` → 204, old password rejected on next login, new accepted, all other sessions revoked, current session kept. User POSTs `/auth/forgot-password` with email → always 200 (no enumeration); if email matches ACTIVE User, a `PasswordResetToken` row is inserted and `notification.password_reset_requested` event emitted with the raw token. POST `/auth/reset-password` with `{token, newPassword}` → 204, token marked consumed, all sessions revoked. Second attempt with same token → 400.

### Tests for User Story 4

- [ ] T069 [P] [US4] Integration test in `apps/hr-core/test/integration/iam.integration.spec.ts` — change-password happy path, wrong-current-password 400, reset-password single-use (200 once, 400 second time), forgot-password generic 200 for unknown email, password-policy violations return 400 with specific message.
- [ ] T070 [P] [US4] Unit test `apps/hr-core/src/modules/iam/password/password-policy.service.spec.ts` — each rule fails independently; reuse-guard rejects when newPassword matches any of last 5 hashes.

### Implementation for User Story 4

- [ ] T071 [P] [US4] Create `apps/hr-core/src/modules/iam/dto/change-password.dto.ts` — `ChangePasswordDto { @IsString currentPassword: string; @IsString @MinLength(12) newPassword: string }`.
- [ ] T072 [P] [US4] Create `apps/hr-core/src/modules/iam/dto/forgot-password.dto.ts` — `ForgotPasswordDto { @IsEmail email: string }`.
- [ ] T073 [P] [US4] Create `apps/hr-core/src/modules/iam/dto/reset-password.dto.ts` — `ResetPasswordDto { @IsString token: string; @IsString @MinLength(12) newPassword: string }`.
- [ ] T074 [US4] Extend `AuthService` (from T040) with `changePassword(userId, currentSessionId, dto)`, `forgotPassword(email, ipAddress)`, `resetPassword(dto)`:
  - `changePassword` — verify currentPassword via Argon2, run policy check, update passwordHash, append previous hash to `User.passwordHistory` (keep last 5), revoke all Sessions EXCEPT `currentSessionId` (FR-030), emit `PASSWORD_CHANGED`.
  - `forgotPassword` — always return void (anonymous caller gets generic 200); if User exists and status=ACTIVE, create `PasswordResetToken` with `tokenHash = sha256(raw)`, `expiresAt = now + 1h`; emit `notification.password_reset_requested` event with raw token (caught by Notifications module for email dispatch); emit `PASSWORD_RESET_REQUESTED` audit.
  - `resetPassword` — look up PasswordResetToken by sha256(token) hash; reject if `expiresAt < now` OR `consumedAt !== null` OR not found (all return 400 with generic message); run policy check; hash new password; update User (reset `failedLoginCount=0`, if status=LOCKED flip to ACTIVE, clear `lockedUntil`); revoke all Sessions for user; mark token `consumedAt=now`; emit `PASSWORD_RESET_COMPLETED`.
- [ ] T075 [US4] Extend `AuthController` with:
  - `POST /auth/change-password` (`@UseGuards(SharedJwtGuard)`, reads current sessionId from `request.user` or a claim; returns 204).
  - `POST /auth/forgot-password` (anonymous, `@Throttle` 5/min/IP, always returns 200).
  - `POST /auth/reset-password` (anonymous, `@Throttle` 10/min/IP, returns 204).
- [ ] T076 [US4] Extend `TokenService` with refresh-token-chain awareness for password-change + reset flows: expose `revokeAllSessionsForUser(userId, keepSessionId?)`.
- [ ] T077 [US4] Wire: `AuthService` needs `PasswordPolicyService` + `Argon2Service` + Prisma access to `PasswordResetToken` model (regenerate types if not already covered by T012). Add these to `IamModule` providers.
- [ ] T078 [US4] Add current sessionId to JWT payload: modify `JwtPayload` (T013) to include `sessionId: string`; update `TokenService.signAccess` and `AuthService.login/refresh` to embed it. This is how `changePassword` knows which session to keep.

**Checkpoint**: Password self-service is fully functional. US4 ships independently.

---

## Phase 8: User Story 5 - Multi-channel sessions and termination cascade (Priority: P5)

**Goal**: Users can hold one active session per channel (WEB, SLACK, WHATSAPP, …). HR_ADMIN can list + revoke individual or all sessions. `employee.terminated` event → DISABLE User + revoke every Session in one transaction.

**Independent Test**: Log in on WEB → Session A. Log in on SLACK for same user → Session B (A still valid). GET `/users/:id/sessions` as HR_ADMIN → both rows, no refreshTokenHash exposed. Revoke A → A.revokedAt set, B still works. Trigger `employee.terminated` event → User.status=DISABLED, both sessions revoked. User can still hit a cached token for ≤60s (UserStatusGuard cache) but ≤60s later all services reject.

### Tests for User Story 5

- [ ] T079 [P] [US5] Unit test `apps/hr-core/src/modules/iam/sessions/sessions.service.spec.ts` — revoke-one, revoke-all, list excludes refreshTokenHash in response shape, partial unique index enforcement on re-login same channel.
- [ ] T080 [P] [US5] Integration test in `apps/hr-core/test/integration/iam.integration.spec.ts` — `employee.terminated` event handler flips User + revokes all sessions in one DB transaction; simulate stale access token returning 401 via `UserStatusGuard` within 60s.

### Implementation for User Story 5

- [ ] T081 [US5] Create `apps/hr-core/src/modules/iam/sessions/sessions.service.ts` — `listUserSessions(userId)` (omits refreshTokenHash from response), `revokeSession(userId, sessionId, actorUserId)` (sets `revokedAt`, emits `SESSION_REVOKED` audit), `revokeAllUserSessions(userId, actorUserId, keepSessionId?)`, `listOwnSessions(userId)` (same shape, no admin privilege check), `revokeOwnSession(userId, sessionId)`.
- [ ] T082 [US5] Create `apps/hr-core/src/modules/iam/sessions/sessions.controller.ts` with:
  - `GET /users/:userId/sessions` (`@Roles('HR_ADMIN','SYSTEM_ADMIN')`)
  - `POST /users/:userId/sessions/:sessionId/revoke`
  - `POST /users/:userId/sessions/revoke-all`
  - `GET /auth/sessions` (`@Roles('EMPLOYEE','MANAGER','HR_ADMIN','EXECUTIVE','GLOBAL_HR_ADMIN','SYSTEM_ADMIN')` — anyone signed in can see their own)
  - `DELETE /auth/sessions/:sessionId` (self-revoke)
  - Swagger documented. All responses stripped of `refreshTokenHash`.
- [ ] T083 [US5] Create `apps/hr-core/src/modules/iam/listeners/employee-terminated.listener.ts` — subscribes to `employee.terminated` domain event via the existing `IEventBus` in `packages/shared/src/event-bus/`. Handler: in one transaction, set User.status=DISABLED (for the User with matching `employeeId`), revoke all active Sessions, emit `USER_DEACTIVATED` + one `SESSION_REVOKED` per session. Idempotent (no-op if User already DISABLED).
- [ ] T084 [US5] Create `apps/hr-core/src/modules/iam/cron/session-cleanup.cron.ts` — `@Cron(CronExpression.EVERY_DAY_AT_3AM)` method that marks expired Sessions (`expiresAt < now AND revokedAt IS NULL`) as revoked. No hard-delete — audit trail stays.
- [ ] T085 [US5] Create `apps/hr-core/src/modules/iam/cron/lockout-clear.cron.ts` — `@Cron(CronExpression.EVERY_5_MINUTES)` method that flips `User.status=LOCKED → ACTIVE` when `lockedUntil < now`, clears `lockedUntil` and `failedLoginCount`, emits `ACCOUNT_UNLOCKED`.
- [ ] T086 [US5] Wire `SessionsService`, `SessionsController`, `EmployeeTerminatedListener`, `SessionCleanupCron`, `LockoutClearCron` into `IamModule`.

**Checkpoint**: Multi-channel sessions + termination cascade live. US5 independently testable via event simulation.

---

## Phase 9: User Story 6 - SYSTEM tokens + agent delegation (Priority: P5)

**Goal**: `AgentContextFactory.forSystemTask()` mints 5-min SYSTEM tokens with task-type allowlist. Agent-delegated calls forward the user's token unchanged. On 403 from downstream, `GracefulDegradationHandler` returns an `AgentDegradationResult` and writes an `AgentTaskLog` with `status=DEGRADED`.

**Independent Test**: Call `AgentContextFactory.forSystemTask({taskType: 'exit_survey_dispatch'})` → signed SYSTEM token, `exp ≤ iat+5min`. Call Social `POST /exit-surveys` with it → 201. Call HR Core `GET /employees` with it → 403 (not in SYSTEM allowlist). Call same endpoint with a user JWT claiming `roles: ['SYSTEM']` → 403 (secret mismatch). EMPLOYEE user invokes Leave Agent asking "What's my team's availability?" → agent's `checkTeamAvailability` tool call returns 403 → `GracefulDegradationHandler` returns a graceful message; `AgentTaskLog.status=DEGRADED`; conversation continues.

### Tests for User Story 6

- [ ] T087 [P] [US6] Unit test `packages/shared/src/auth/agent-context.factory.spec.ts` — `forSystemTask` rejects unknown taskType; token exp ≤ 5 min; `fromRequest` extracts claims from Authorization header; `isSystemContext` flag correct in both paths.
- [ ] T088 [P] [US6] Contract test `test/contracts/system-token-allowlist.contract.spec.ts` — presents a SYSTEM token to every endpoint in all 3 services; the only 2xx responses come from the endpoints that declare `@Roles('SYSTEM')` in the RBAC matrix; everything else returns 403.

### Implementation for User Story 6

- [ ] T089 [US6] Export the SYSTEM task-type allowlist from `packages/shared/src/auth/agent-context.factory.ts` as `SYSTEM_TASK_TYPES = ['exit_survey_dispatch', 'engagement_snapshot', 'leave_accrual', 'regulation_seed', 'org_scenario_amendment'] as const`. `forSystemTask` rejects anything not in this set.
- [ ] T090 [US6] Update `SharedJwtGuard` (T018) to accept BOTH `JWT_SECRET`- and `SYSTEM_JWT_SECRET`-signed tokens, but record which secret verified the token in `request.authSource: 'user' | 'system'`. The guard MUST reject a `JWT_SECRET`-signed token whose payload claims `roles: ['SYSTEM']` (FR-040 forgery protection).
- [ ] T091 [US6] Add `@SystemOnly()` helper decorator in `packages/shared/src/auth/` that composes `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles('SYSTEM')`. Apply to the specific endpoints in the allowlist:
  - Social: `POST /exit-surveys`, `PATCH /exit-surveys/:id/send`, `POST /engagement-snapshots`
  - HR Core: endpoints consumed by `leave_accrual` system task (list to be identified from 005-leave-module — at least the accrual-orchestration endpoint if one exists, otherwise none)
  - AI Agentic: `POST /vector-documents/seed-regulations`
- [ ] T092 [US6] Update the existing `HrCoreClient` and `SocialClient` in `apps/ai-agentic/src/common/clients/` to accept `AgentContext` instead of `jwt: string`. Every method signature changes from `(args..., jwt: string)` to `(args..., context: AgentContext)`. The client reads `context.jwt` internally. This is a breaking change to every call site in the ai-agentic app — audit and update.
- [ ] T093 [US6] Verify/extend `GracefulDegradationHandler` in `apps/ai-agentic/src/common/` to convert HTTP 403 responses into `AgentDegradationResult` objects and write `AgentTaskLog` rows with `status=DEGRADED`. (Per CLAUDE.md, this class already exists; this task is a verification + extension with task-log `parentLogId` chain population from `AgentContext.taskLogId`.)
- [ ] T094 [US6] Add `SYSTEM_TOKEN_ISSUED` audit event emission in `AgentContextFactory.forSystemTask()` — the factory calls into a shared audit logger (write to `AgentTaskLog` directly in ai-agentic; HR Core-side SYSTEM token minting on scheduled jobs writes `SecurityEvent`).

**Checkpoint**: SYSTEM tokens and agent-delegation both work with correct scope inheritance and graceful degradation.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Lock down remaining SC-* acceptance criteria, confirm no boolean `isActive` leaked in, and make the release production-ready.

- [ ] T095 [P] Verify zero `isActive` / `active: Boolean` / `enabled: Boolean` occurrences in `apps/hr-core/prisma/schema.prisma`. Run `grep -E "^\s*(isActive|active|enabled)\s+Boolean" apps/hr-core/prisma/schema.prisma` — expect no matches. Same check on existing modules (employees, leaves, skills) to confirm no regression.
- [ ] T096 [P] Verify zero plaintext passwords in logs/responses by running the full integration suite with log capture and grepping for the fixture plaintexts (`grep -i "testpass" logs/*.log` → zero) (SC-007).
- [ ] T097 [P] Performance validation: benchmark `SharedJwtGuard` in isolation — 1000 requests with valid tokens should complete with P95 ≤ 10 ms (SC-002). Add a microbench under `apps/hr-core/test/perf/jwt-guard.perf.spec.ts`.
- [ ] T098 [P] Performance validation: benchmark `buildScopeFilter` — 10,000 invocations, P95 ≤ 2 ms.
- [ ] T099 End-to-end brute-force test (SC-006): POST `/auth/login` 5× wrong password within 15 min → 6th attempt returns 401-locked; wait for `LOGIN_LOCKOUT_DURATION_MIN`; next attempt proceeds.
- [ ] T100 End-to-end deactivation-propagation test (SC-004): HR_ADMIN deactivates a user; within ≤60s, the user's cached access token is rejected on all 3 services.
- [ ] T101 [P] Swagger: ensure every new endpoint has `@ApiOperation`, `@ApiResponse`, and `@ApiBearerAuth()` where appropriate. Run the HR Core app and verify `/api/docs` renders the full IAM section cleanly.
- [ ] T102 [P] Update `.claude/CLAUDE.md` "Recent Changes" block and the root `CLAUDE.md` technology roster via `.specify/scripts/bash/update-agent-context.sh claude`.
- [ ] T103 Final grep: `git grep -n "TODO(iam)"` at repo root MUST return zero matches (SC-011). `scripts/check-no-todo-iam.sh` from T051 runs in CI and fails if any match surfaces.
- [ ] T104 Run the full `rbac-matrix.contract.spec.ts` suite one more time against all 3 booted services and confirm 100% pass (SC-003).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1. BLOCKS every user story.
- **Phase 3 (US1 – P1 MVP)**: Depends on Phase 2.
- **Phase 4 (US2 – P2)**: Depends on Phase 3 (login must work for guards to mean anything in tests).
- **Phase 5 (US3 – P3)**: Depends on Phase 2. Can run in parallel with Phase 4 on a separate branch, but US3's deactivate-cascade test needs US5's session-revoke plumbing if full e2e — plan for US3 and US5 integration test to be finalized after both ship.
- **Phase 6 (US7 – P3)**: Depends on Phase 2. Fully parallel with Phase 5 (different controller file, different service file).
- **Phase 7 (US4 – P4)**: Depends on Phase 3 (AuthService already exists, extends it). Can run in parallel with Phases 5/6/8/9.
- **Phase 8 (US5 – P5)**: Depends on Phase 3 (Sessions table populated by login).
- **Phase 9 (US6 – P5)**: Depends on Phase 2. The `AgentContextFactory` work is largely in `@sentient/shared` — fully parallel with 5/6/7/8.
- **Phase 10 (Polish)**: Depends on all user-story phases being done.

### User Story Dependencies

- **US1 (P1, MVP)**: No story dependencies beyond Foundational.
- **US2 (P2)**: Depends on US1 — needs a login flow to exist before RBAC activation has anything to enforce.
- **US3 (P3)**: Independent of US2; can ship parallel. Re-uses AuthService's password-hashing path.
- **US7 (P3)**: Independent. Different files (`roles/` sub-area).
- **US4 (P4)**: Extends US1's AuthService but in new controller methods; no breaking change.
- **US5 (P5)**: Independent. Reads the Session table US1 populates; adds listener + admin endpoints.
- **US6 (P5)**: Independent of US3/US4/US5/US7. Integrates with US2's guard activation (the same guards honor SYSTEM role).

### Within Each User Story

- Tests (where included) written alongside implementation — unit-test-first on services with pure logic (Argon2, PasswordPolicy, ScopeFilterBuilder); integration-test-alongside on endpoint flows.
- DTOs → services → controllers → module wiring → Swagger.
- Never commit a controller without its guards.

### Parallel Opportunities

- **Phase 1**: T002–T007 all parallel (different files, independent enums).
- **Phase 2**: T013–T017 and T022, T024 all parallel (independent shared-package files). T026–T028 parallel. T030–T031 parallel.
- **Phase 3**: T035–T037 parallel. T038–T039 parallel.
- **Phase 4**: T044–T045 parallel. T046/T047/T048 parallel (one per service).
- **Phase 5**: T052–T053 parallel. T054–T057 parallel (DTOs).
- **Phase 6**: T063–T064 parallel.
- **Phase 7**: T069–T070 parallel. T071–T073 parallel.
- **Phase 8**: T079–T080 parallel.
- **Phase 9**: T087–T088 parallel.
- **Phase 10**: T095–T098, T101–T102 all parallel.

Each user-story phase is safe to assign to a separate developer once Phase 2 lands.

---

## Parallel Example: User Story 1 (MVP)

```bash
# After T034 (Foundational done), launch in parallel:
Task: "T035 [P] [US1] Integration test for login + refresh + logout in apps/hr-core/test/integration/iam.integration.spec.ts"
Task: "T036 [P] [US1] Unit test for AuthService in apps/hr-core/src/modules/iam/auth/auth.service.spec.ts"
Task: "T037 [P] [US1] Unit test for ScopeFilterBuilder in packages/shared/src/auth/scope-filter.builder.spec.ts"

# Then DTOs in parallel:
Task: "T038 [P] [US1] Create LoginDto"
Task: "T039 [P] [US1] Create RefreshDto"

# Then sequentially: T040 (service) → T041 (controller) → T042 (wiring) → T043 (demo check)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1: Setup (T001–T008).
2. Complete Phase 2: Foundational (T009–T034) — the 8-entity migration + shared auth primitives + seed.
3. Complete Phase 3: US1 (T035–T043).
4. **STOP and VALIDATE** — Sign in as the seed SYSTEM_ADMIN. Hit a protected endpoint. Demo.

### Incremental Delivery

1. MVP → Phase 4 (US2) → RBAC live on every endpoint → Demo.
2. Phase 5 (US3) OR Phase 6 (US7) → platform-admin flows → Demo.
3. Phase 7 (US4) → password self-service → Demo.
4. Phase 8 (US5) + Phase 9 (US6) → termination cascade + SYSTEM tokens → Demo.
5. Phase 10 polish → release.

### Parallel Team Strategy

With 3 developers after Phase 2:

- Dev A: US1 → US2 → US5 (all depend on Sessions/Login).
- Dev B: US3 → US4 (both on the users/auth axis).
- Dev C: US7 → US6 (roles catalog → SYSTEM tokens + shared-package).

Polish phase is a team sprint after all stories land.

---

## Notes

- `[P]` = different files, no dependencies.
- `[Story]` = maps to a spec user story for traceability.
- Every user-story phase is independently demoable.
- Run `pnpm --filter hr-core test:integration` to exercise DB-backed tests; use the test DB per `rules/testing.md`.
- On any migration rewrite, re-read `.claude/rules/code-style.md` §3 "DROP INDEX vs DROP CONSTRAINT" before touching an existing unique constraint.
- Commit per-task or per-logical-group. A good commit boundary: after each DTO batch, after each service, after wiring into the module.
