# Implementation Plan: Leave Management Module

**Branch**: `005-leave-module` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-leave-module/spec.md`

## Summary

Add the Leave domain to HR Core: a catalog of leave types, per-employee/leave-type/year balance ledgers, individual leave requests with a single-step direct-manager approval workflow, a holiday calendar resolved through the employee's BusinessUnit, and a monthly accrual scheduler with capped year-end carryover. Half-day granularity is supported via a `HalfDay { MORNING, AFTERNOON }` enum. Every accrual and HR adjustment is logged in an append-only `LeaveBalanceAdjustment` audit table. `LeaveRequest` persists nullable `agentRiskAssessment` and `agentSuggestedDates` JSON fields wired to a SYSTEM-JWT-protected internal PATCH endpoint so the future Leave Agent can attach its output without this module computing anything. Domain events (`leave.requested`, `.approved`, `.rejected`, `.cancelled`) are emitted for downstream consumers; no consumer is wired in this feature.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/schedule (for monthly accrual cron), @nestjs/config
**Storage**: PostgreSQL 16, schema `hr_core`
**Testing**: Jest (unit + integration). No inter-service contract tests (module is entirely inside HR Core; the Leave Agent contract in AI Agentic will add its own).
**Target Platform**: Node.js server (NestJS microservice on port 3001)
**Project Type**: Web service (REST API microservice)
**Performance Goals**: <400ms p95 for balance/history reads; <600ms p95 for submission (includes overlap check + balance check + insert); monthly accrual job completes for 10k employees × 5 leave types in <60s (SC-005)
**Constraints**: Strict RBAC scope filtering on every endpoint, no cross-schema reads/writes, append-only adjustment log, idempotent accrual runs, overlap-free approved/pending ranges per employee enforced at application + DB level
**Scale/Scope**: Up to ~10k employees × 5–8 leave types × 5 years retained = ~400k `LeaveBalance` rows; ~2M `LeaveRequest` rows over project lifetime; ~600k `LeaveBalanceAdjustment` rows/year (10k emp × 5 types × 12 months). 1 new enum, 5 new entities, 1 field addition to `BusinessUnit`, ~15 REST endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is an unfilled template. Governing constraints are the project's conventions in `CLAUDE.md` and `.claude/rules/`. Gate evaluated against those:

**Pre-Phase 0 gate**:
- Strict TypeScript (no `any`, explicit returns) — planned ✅
- NestJS modular layout (Module → Controller → Service + DTOs) — planned ✅
- Prisma with `@@schema("hr_core")` on every model — planned ✅
- `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles()` on every endpoint (guards stay commented until IAM lands — memory `feedback_pre_iam_rbac_comment_out`) ✅
- DTOs with class-validator; services trust their inputs — planned ✅
- Domain events via existing `IEventBus` abstraction — planned ✅
- No cross-service imports (entirely inside `apps/hr-core/`) ✅
- No feature flags or backwards-compat shims ✅
- Register `PrismaExceptionFilter` globally (already done in prior features — not a new concern) ✅

**Post-Phase 1 re-check** (see artifacts):
- Prisma unique-index/migration pitfall (memory `feedback_prisma_migration_constraints`) — new composite unique on `LeaveBalance(employeeId, leaveTypeId, year)` and on `LeaveAccrualRun(runMonth)` are created fresh, not migrated; no `DROP INDEX` concern ✅
- New field `BusinessUnit.country` ships with NOT NULL + `DEFAULT 'DZ'` then drop default (two-step migration to handle existing rows) — documented in `quickstart.md` Step 1 ✅
- No destructive index operations on existing tables ✅
- No new shared-package additions beyond one enum (`HalfDay`) and one event schema — minimal surface ✅
- Scope filtering reuses the same `buildScopeFilter` pattern from Employees/Skills modules ✅

No violations. No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-leave-module/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: implementation guide
├── contracts/
│   └── leave-api.md     # Phase 1: REST API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/hr-core/
├── prisma/
│   ├── schema.prisma                               # Modified: add HalfDay enum; LeaveType,
│   │                                                #           LeaveBalance, LeaveRequest,
│   │                                                #           Holiday, LeaveBalanceAdjustment,
│   │                                                #           LeaveAccrualRun; add country on
│   │                                                #           BusinessUnit; add leaveBalances[]
│   │                                                #           leaveRequests[] on Employee
│   └── migrations/
│       └── <timestamp>_add_leave_module/
│           └── migration.sql                       # Prisma-generated + BU.country backfill
├── src/
│   ├── modules/
│   │   └── leaves/                                 # NEW module
│   │       ├── leaves.module.ts
│   │       ├── leave-types/
│   │       │   ├── leave-types.controller.ts       # /leave-types
│   │       │   ├── leave-types.service.ts
│   │       │   └── leave-types.service.spec.ts
│   │       ├── holidays/
│   │       │   ├── holidays.controller.ts          # /holidays
│   │       │   ├── holidays.service.ts
│   │       │   └── holidays.service.spec.ts
│   │       ├── balances/
│   │       │   ├── balances.controller.ts          # /leave-balances
│   │       │   ├── balances.service.ts
│   │       │   └── balances.service.spec.ts
│   │       ├── requests/
│   │       │   ├── requests.controller.ts          # /leave-requests
│   │       │   ├── requests.service.ts
│   │       │   ├── requests.service.spec.ts
│   │       │   └── team-calendar.controller.ts     # /leave-requests/team-calendar
│   │       ├── accrual/
│   │       │   ├── accrual.service.ts              # Scheduled monthly job (FR-009/010/011)
│   │       │   └── accrual.service.spec.ts
│   │       ├── util/
│   │       │   ├── business-day.util.ts            # counts Mon-Fri excluding holidays
│   │       │   ├── business-day.util.spec.ts
│   │       │   └── country-resolver.util.ts        # resolves employee.department/team → BU.country
│   │       └── dto/
│   │           ├── create-leave-type.dto.ts
│   │           ├── update-leave-type.dto.ts
│   │           ├── create-holiday.dto.ts
│   │           ├── update-holiday.dto.ts
│   │           ├── create-leave-request.dto.ts
│   │           ├── review-leave-request.dto.ts
│   │           ├── cancel-leave-request.dto.ts
│   │           ├── patch-agent-assessment.dto.ts
│   │           ├── adjust-balance.dto.ts
│   │           └── leave-query.dto.ts
│   └── app.module.ts                                # Modified: import LeavesModule,
│                                                      ScheduleModule.forRoot()

packages/shared/src/
└── enums/
    ├── half-day.enum.ts                             # NEW: MORNING, AFTERNOON
    └── index.ts                                     # Modified: export HalfDay
```

**Structure Decision**: A single `leaves` NestJS module with five sub-areas (leave-types, holidays, balances, requests, accrual). Rationale:
- The five surfaces share one Prisma transactional boundary (submit request = insert request + update balance + emit event must be atomic), so one module avoids circular imports.
- Sub-directories keep controllers focused. `team-calendar.controller.ts` is split from `requests.controller.ts` because it has a completely different query shape and RBAC matrix (manager aggregate view vs. individual request CRUD).
- `accrual/` has no controller — it's a `@Cron` job exposed via an internal admin trigger endpoint for testing (HR_ADMIN only).
- Mirrors the granularity of `modules/organization/` (departments + teams + positions under one module) and `modules/skills/` (catalog + employee-skills + history under one module).

## Complexity Tracking

No constitution violations — no entries needed.
