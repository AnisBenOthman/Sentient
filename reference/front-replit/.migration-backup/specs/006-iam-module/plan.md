# Implementation Plan: Identity & Access Management (IAM) Module

**Branch**: `006-iam-module` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-iam-module/spec.md`

## Summary

Ship the IAM module inside HR Core so the platform can finally authenticate users and enforce per-user authorization across all three microservices. The module owns `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Session`, `PasswordResetToken`, and `SecurityEvent`; it is the only service that issues tokens and also mints SYSTEM tokens (separate signing secret, 5-minute TTL) used by scheduled AI tasks.

The biggest design decision — confirmed with the user before planning — is the **scope model**. Scope levels form a strict ladder **OWN ⊂ TEAM ⊂ DEPARTMENT ⊂ BUSINESS_UNIT ⊂ GLOBAL**, and scope attaches to a specific `UserRole` row (not to the `User` table, not derived from `Employee`). Each `UserRole` carries `scope` plus an optional `scopeEntityId` pointing to the specific Team / Department / BusinessUnit the assignment is pinned to. This lets a single person simultaneously hold, e.g., `MANAGER` scoped to Team T and `HR_ADMIN` scoped to Business Unit B. The strict ladder means granting BU scope implicitly includes every department and team within that BU — no per-department fan-out needed.

Role semantics that follow from the ladder + per-assignment scope:

- `EMPLOYEE` → always `OWN`.
- `MANAGER` → scope-polymorphic per assignment: **team managers** get `TEAM` scope (see only their team's members), **department managers** get `DEPARTMENT` scope (see all teams within their department). Same role code, different scope on different `UserRole` rows.
- `EXECUTIVE` → always `BUSINESS_UNIT`, `businessUnitId` required.
- `HR_ADMIN` → default `BUSINESS_UNIT`, `businessUnitId` required. A separate role `GLOBAL_HR_ADMIN` carries `GLOBAL` scope for platform-wide HR (cross-BU benefits, audit).
- `SYSTEM_ADMIN` → always `GLOBAL`, no `scopeEntityId`.
- `SYSTEM` (scheduled-task-only) → always `GLOBAL`, with a `taskType` claim bounded by an allowlist.

The JWT payload now carries a `roleAssignments[]` array (`{ role, scope, scopeEntityId }`), letting every downstream service compute the exact filter per permission without round-tripping to HR Core. A `buildScopeFilter(user, resource, action)` helper exported from `@sentient/shared` consumes those assignments plus the caller's `employeeId`, `teamId`, `departmentId`, `businessUnitId` claims and returns the right Prisma `where` fragment for each of the 4 scope types. Users with multiple role-assignments applicable to the same permission get the UNION of their individual scope filters (widest applies).

The release also finally removes the `// TODO(iam)` comments that disable `@UseGuards(SharedJwtGuard, RbacGuard)` across HR Core, Social, and AI Agentic, enabling real authenticated access on every endpoint except `/health` and the survey-token-gated exit-survey response endpoint.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: NestJS 10, Prisma 5 (multiSchema), `jsonwebtoken` (HS256 for both user and SYSTEM secrets, distinct keys), `argon2` (password hashing), class-validator, class-transformer, @nestjs/swagger, @nestjs/throttler (already installed — used for login rate-limit), @nestjs/schedule (session-cleanup cron + lockout-clear sweep), @nestjs/config, `crypto.randomBytes` (refresh + reset token generation)
**Storage**: PostgreSQL 16, schema `hr_core`. No pgvector requirement.
**Testing**: Jest (unit + integration + contract). **Cross-service RBAC contract suite** — new `test/contracts/rbac-matrix.contract.spec.ts` at repo root iterates every row in `rules/security.md` and drives each of the 3 services. Unit tests for `buildScopeFilter`, token signing/validation, Argon2 wrapper, session state machine.
**Target Platform**: Node.js server (NestJS microservice on port 3001 — HR Core). JWT validation logic is shared to Social (:3002) and AI Agentic (:3003) via `@sentient/shared` package.
**Project Type**: Web service (REST API) + shared-package update (validation guard, DTOs, enums, scope-filter helper consumed by all three services).
**Performance Goals**: access-token validation <10ms P95 in-memory with no DB hit (SC-002); login → first protected page <3s including DB round-trip for user fetch + role assignments + Argon2 verify (SC-001); user-status freshness ≤60s lag between deactivate → token failure (SC-004); `buildScopeFilter` resolution <2ms (pure function on claims).
**Constraints**: Zero plaintext passwords anywhere (DB rows, logs, API responses); at least one active SYSTEM_ADMIN enforced; SYSTEM and user tokens use separate signing secrets; Argon2id params calibrated to ~200ms on target hardware to resist offline attacks; all security events append-only; clock skew tolerance ≤60s on `exp`; user-status cache never exceeds 60s staleness; one active session per `(userId, channel)` pair; repository-wide grep for `TODO(iam)` returns zero at release (SC-011); no cross-schema FKs (user's `employeeId` is a logical string pointer).
**Scale/Scope**: ~10k active Users at peak; 7 built-in roles + N custom roles created by GLOBAL_HR_ADMIN at runtime; ~40 seeded permissions (catalog fixed); ~20k `UserRole` rows (~2 per user); ~30k live `Session` rows at peak (3 channels × 10k users, but most will have 1); ~200 rows/sec peak write to `SecurityEvent` during morning login spike; ~500 rows/day on `PasswordResetToken`. Adds 8 new entities, 2 new enums (`UserStatus`, `SecurityEventType`), a `RoleCode` reference enum (seed/type-safety only — `Role.code` is a free string at runtime), ~30 REST endpoints including role-catalog management.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is an unfilled template. Governing constraints are the project's conventions in `.claude/CLAUDE.md`, `.claude/rules/code-style.md`, `.claude/rules/security.md`, and `.claude/rules/testing.md`. Gate evaluated against those.

**Pre-Phase 0 gate**:
- Strict TypeScript (no `any`, explicit returns) — planned ✅
- NestJS modular layout (`apps/hr-core/src/modules/iam/`) with sub-areas for auth / users / roles / sessions / audit ✅
- Prisma with `@@schema("hr_core")` on every model ✅
- `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles(...)` on every endpoint (except `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, and `/health` — anonymous by design) ✅
- DTOs with class-validator; services trust their inputs ✅
- Centralized auth stays in HR Core; Social and AI Agentic import `SharedJwtGuard` from `@sentient/shared` only ✅
- No cross-service imports from `apps/hr-core/` into `apps/social/` or `apps/ai-agentic/` — JWT validation logic lives in the shared package, not in HR Core ✅
- Register `PrismaExceptionFilter` globally (already done in prior features) ✅
- No feature flags, backwards-compat shims, or stubs with TODOs — this release actively removes the existing `TODO(iam)` comments ✅
- Password hashing uses Argon2id per `rules/security.md` (NOT bcrypt) ✅

**Security gate** (mandatory for this module):
- Password hashes stored only; plaintext never logged or returned ✅
- JWT payload carries only `sub, employeeId, roles[], departmentId, teamId, businessUnitId, channel, roleAssignments[], iat, exp` — no PII (name, email, salary) ✅
- Refresh tokens stored only as hashes; raw value returned to client exactly once ✅
- `SystemJwtPayload` signed with `SYSTEM_JWT_SECRET` (distinct env var), max 5-minute `exp`, `taskType` claim validated against allowlist ✅
- Anonymous endpoints limited to: `GET /health` (per service), `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /exit-surveys/:id/respond` (survey-token-gated, out of this module's scope) ✅
- Rate limits: login 10/min/IP + 5/min/email; forgot-password 5/min/IP; reset-password 10/min/IP (FR-050) ✅

**Post-Phase 1 re-check** (see artifacts):
- Prisma unique-index pitfall (memory `feedback_prisma_migration_constraints`): `UserRole` adds a **partial unique index** on `(userId, roleId, scopeEntityId) WHERE revokedAt IS NULL` — fresh index, no `DROP INDEX` concern in the migration ✅
- `Session` adds a **partial unique index** on `(userId, channel) WHERE revokedAt IS NULL` — single active session per channel (FR-035) ✅
- `User.email` uses `CITEXT` extension for case-insensitive uniqueness, or lowercase-on-write pattern with regular unique — we pick lowercase-on-write (no extension install) ✅
- The `ScopeFilterBuilder` is pure TypeScript (no DB access on hot path) — consistent with SC-002 ✅
- Seed script (`prisma/seed.ts`) runs **before** any other module's seed so downstream modules can reference `Role` rows — documented in quickstart ✅
- Guards removal PR: unblocks all `TODO(iam)` sites; contract test (`rbac-matrix.contract.spec.ts`) fails CI if any new endpoint is added without matrix coverage ✅

No violations. No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-iam-module/
├── plan.md                 # This file
├── spec.md                 # Feature specification
├── research.md             # Phase 0: research decisions (R-001..R-014)
├── data-model.md           # Phase 1: entity definitions, state machines, indexes
├── quickstart.md           # Phase 1: implementation guide, migration order, env, seed
├── contracts/
│   └── iam-api.md          # Phase 1: REST API contract for /auth, /users, /sessions, /roles, /audit
├── checklists/
│   └── requirements.md     # Spec quality checklist (done in /speckit.specify)
└── tasks.md                # Phase 2 (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/hr-core/
├── prisma/
│   ├── schema.prisma                                 # Modified: add UserStatus, SecurityEventType,
│   │                                                   #   RoleCode enums (in ../packages/shared);
│   │                                                   #   add User, Role, Permission, UserRole,
│   │                                                   #   RolePermission, Session, PasswordResetToken,
│   │                                                   #   SecurityEvent models; add User.employeeId
│   │                                                   #   logical pointer; extend Employee with
│   │                                                   #   opposite-side relation userId (optional).
│   └── migrations/
│       └── <timestamp>_add_iam_module/
│           └── migration.sql                         # Prisma-generated
├── src/
│   ├── modules/
│   │   └── iam/                                       # NEW module
│   │       ├── iam.module.ts
│   │       ├── auth/
│   │       │   ├── auth.controller.ts                 # /auth/login, /refresh, /logout,
│   │       │   │                                       #   /change-password, /forgot-password,
│   │       │   │                                       #   /reset-password, /sessions (self)
│   │       │   ├── auth.service.ts
│   │       │   ├── auth.service.spec.ts
│   │       │   └── token.service.ts                   # Issues access + refresh + SYSTEM tokens
│   │       ├── users/
│   │       │   ├── users.controller.ts                # /users, /users/:id, role ops, activate/deactivate
│   │       │   ├── users.service.ts
│   │       │   └── users.service.spec.ts
│   │       ├── roles/
│   │       │   ├── roles.controller.ts                # GET /roles, GET /roles/:id,
│   │       │   │                                       #   POST /roles (GLOBAL_HR_ADMIN),
│   │       │   │                                       #   DELETE /roles/:id (GLOBAL_HR_ADMIN),
│   │       │   │                                       #   POST /roles/:id/permissions,
│   │       │   │                                       #   DELETE /roles/:id/permissions/:permId
│   │       │   ├── roles.service.ts
│   │       │   └── roles.service.spec.ts              # isSystem/isEditable guard logic
│   │       ├── sessions/
│   │       │   ├── sessions.controller.ts             # /users/:id/sessions (HR_ADMIN)
│   │       │   ├── sessions.service.ts
│   │       │   └── sessions.service.spec.ts
│   │       ├── audit/
│   │       │   ├── audit.controller.ts                # /security-events (SYSTEM_ADMIN read)
│   │       │   └── audit.service.ts                   # writes SecurityEvent rows
│   │       ├── listeners/
│   │       │   └── employee-terminated.listener.ts    # Consumes employee.terminated → disable User
│   │       ├── cron/
│   │       │   ├── session-cleanup.cron.ts            # Daily: remove sessions past expiresAt
│   │       │   └── lockout-clear.cron.ts              # Every 5 min: clear lockedUntil < now
│   │       ├── password/
│   │       │   ├── argon2.service.ts                  # hash + verify wrapper
│   │       │   ├── password-policy.service.ts         # FR-006 enforcement
│   │       │   └── argon2.service.spec.ts
│   │       └── dto/
│   │           ├── login.dto.ts
│   │           ├── refresh.dto.ts
│   │           ├── change-password.dto.ts
│   │           ├── forgot-password.dto.ts
│   │           ├── reset-password.dto.ts
│   │           ├── create-user.dto.ts
│   │           ├── update-user.dto.ts
│   │           ├── assign-role.dto.ts                 # { roleCode, scope, scopeEntityId }
│   │           ├── revoke-role.dto.ts
│   │           ├── create-role.dto.ts                 # { code, name, description }
│   │           └── assign-role-permission.dto.ts      # { permissionId }
│   ├── common/
│   │   └── middleware/
│   │       └── correlation-id.middleware.ts           # If not already present — adds x-correlation-id
│   └── app.module.ts                                  # Modified: imports IamModule, registers
│                                                       #   global ScheduleModule, Throttler config,
│                                                       #   PrismaExceptionFilter (existing).
├── src/prisma/
│   └── seed.ts                                        # Modified: seeds Permissions → Roles →
│                                                       #   RolePermissions → SYSTEM_ADMIN user
│                                                       #   (idempotent). Seed runs BEFORE other
│                                                       #   module seeds.
└── test/
    └── integration/
        └── iam.integration.spec.ts                    # Login + refresh + revoke flow against real DB

apps/social/
└── src/app.module.ts                                  # Modified: remove TODO(iam) guard comments;
                                                       #   actually apply SharedJwtGuard globally or
                                                       #   per-controller as declared.

apps/ai-agentic/
└── src/app.module.ts                                  # Modified: same removal as Social.

packages/shared/
└── src/
    ├── auth/
    │   ├── jwt-payload.interface.ts                   # { sub, employeeId, roles[],
    │   │                                                 #   roleAssignments[], ... }
    │   ├── system-jwt-payload.interface.ts            # { sub:'system', roles:['SYSTEM'], taskType, ... }
    │   ├── shared-jwt.guard.ts                        # NEW: imported by all 3 services
    │   ├── user-status.guard.ts                       # NEW: 60s-cached user-status recheck
    │   ├── roles.decorator.ts                         # NEW: @Roles(...) reflector key
    │   ├── rbac.guard.ts                              # NEW: role membership check
    │   ├── scope-filter.builder.ts                    # NEW: buildScopeFilter(user, resource, action)
    │   ├── agent-context.interface.ts                 # MOVED HERE from conceptual definition in CLAUDE.md
    │   ├── agent-context.factory.ts                   # forRequest() + forSystemTask()
    │   └── current-user.decorator.ts                  # @CurrentUser() param decorator
    ├── enums/
    │   ├── user-status.enum.ts                        # NEW: PENDING_ACTIVATION, ACTIVE, LOCKED, DISABLED
    │   ├── security-event-type.enum.ts                # NEW: 17 values (FR-045 + role catalog events)
    │   ├── role-code.enum.ts                          # NEW: EMPLOYEE, MANAGER, HR_ADMIN, EXECUTIVE,
    │   │                                                 #   SYSTEM_ADMIN, GLOBAL_HR_ADMIN, SYSTEM
    │   │                                                 #   (reference only — Role.code is a free
    │   │                                                 #   string at runtime; enum used for seed +
    │   │                                                 #   type-safe isSystem/isEditable defaults)
    │   ├── permission-action.enum.ts                  # NEW: CREATE, READ, UPDATE, DELETE, APPROVE
    │   ├── permission-scope.enum.ts                   # Modified: add BUSINESS_UNIT between
    │   │                                                 #   DEPARTMENT and GLOBAL
    │   └── index.ts                                   # Modified: re-export new enums
    └── dto/
        └── login-response.dto.ts                       # { accessToken, refreshToken, user }
```

**Structure Decision**: One `iam` NestJS module with five sub-areas (auth, users, roles, sessions, audit), plus a significant expansion of `packages/shared/src/auth/` that centralizes all cross-service auth contracts. Rationale:

- **Sub-areas mirror the HTTP route layout**, keeping each controller focused on one resource family. Auth is the busiest (7 endpoints) — it gets its own sub-tree.
- **`token.service.ts` stays separate from `auth.service.ts`** because it's used by both the login flow AND the `forSystemTask` factory in `@sentient/shared`; keeping signing logic isolated simplifies secret-rotation refactors later.
- **Shared package owns `SharedJwtGuard`, `RbacGuard`, `ScopeFilterBuilder`, and the payload interfaces** — not HR Core. This is the critical dependency decision: Social and AI Agentic must validate JWTs without importing anything from HR Core (CLAUDE.md rule: "apps/ai-agentic/ NEVER imports from apps/hr-core/"). The shared package becomes the contract.
- **`UserStatusGuard` is distinct from `SharedJwtGuard`** and applied AFTER it. The JWT guard is a hot-path, DB-free signature verify. The status guard does a 60s-cached DB lookup (FR-017). Separating them means most requests (hot path) never touch the DB for auth; only the periodic freshness check does.
- **`listeners/employee-terminated.listener.ts`** subscribes to the existing `IEventBus` — emitted by the Employees module (003-employee-module). The listener file, not a cross-module call, implements FR-029 per CLAUDE.md's event-driven rule.
- **`cron/session-cleanup.cron.ts` and `cron/lockout-clear.cron.ts`** use `@nestjs/schedule` (already brought in by 005-leave-module for monthly accrual) — no new dep.
- Mirrors the granularity of `modules/leaves/` (types + balances + requests + accrual + util under one module).

## Complexity Tracking

No constitution violations — no entries needed.
