# Implementation Plan: Employee Module

**Branch**: `003-employee-module` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-employee-module/spec.md`

## Summary

Extend the existing minimal Employee table in HR Core with full employee lifecycle management — personal/professional details, RBAC-scoped CRUD, salary history tracking, employment status transitions with domain events, and paginated search. This is a foundational module that all other HR Core modules (leaves, performance, probation, complaints) depend on.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/config
**Storage**: PostgreSQL 16, schema `hr_core`
**Testing**: Jest (unit + integration)
**Target Platform**: Node.js server (NestJS microservice on port 3001)
**Project Type**: Web service (REST API microservice)
**Performance Goals**: < 500ms single profile, < 1s paginated list for 10k records
**Constraints**: Strict RBAC scope filtering, no PII leakage, no cross-schema queries
**Scale/Scope**: Up to 10,000 employees, 6 API endpoints, 2 entities

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is an unfilled template — no project-specific gates defined. Proceeding with the project's existing conventions from `CLAUDE.md` and `rules/` as the governing constraints.

**Post-design re-check**: All design decisions align with:
- Strict TypeScript (no `any`, explicit returns) ✅
- NestJS modular architecture (Module → Controller → Service) ✅
- Prisma with `@@schema("hr_core")` on all models ✅
- `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles()` on all endpoints ✅
- Domain events via `IEventBus` abstraction ✅
- No cross-service imports ✅
- DTOs with class-validator ✅

## Project Structure

### Documentation (this feature)

```text
specs/003-employee-module/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: implementation guide
├── contracts/
│   └── employees-api.md # Phase 1: REST API contract
└── tasks.md             # Phase 2: implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/hr-core/
├── prisma/
│   └── schema.prisma                          # Modified: extend Employee, add SalaryHistory
├── src/
│   ├── modules/
│   │   └── employees/                         # NEW module
│   │       ├── employees.module.ts
│   │       ├── employees.controller.ts
│   │       ├── employees.service.ts
│   │       ├── employees.service.spec.ts
│   │       └── dto/
│   │           ├── create-employee.dto.ts
│   │           ├── update-employee.dto.ts
│   │           ├── update-employee-status.dto.ts
│   │           └── employee-query.dto.ts
│   └── app.module.ts                          # Modified: import EmployeesModule

packages/shared/src/
└── enums/
    └── employment-status.enum.ts              # Modified: add RESIGNED
```

**Structure Decision**: Follows the established HR Core module pattern (mirrors `modules/organization/departments/`). Single module with controller, service, DTOs co-located. No new packages or services needed.

## Complexity Tracking

No constitution violations — no entries needed.
