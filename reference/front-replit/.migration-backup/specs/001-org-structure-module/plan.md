# Implementation Plan: Organization Structure Module (Departments, Teams, Positions)

**Branch**: `001-org-structure-module` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-org-structure-module/spec.md`

## Summary

Implement the `organization` module within the HR Core microservice (port 3001, schema `hr_core`). This module exposes CRUD management for three foundational org-structure entities — **Department**, **Team**, and **Position** — plus a read-only **org-chart** endpoint. All mutations are restricted to HR Admins; read access is scope-filtered per role. The module is consumed by the AI Agentic service's Analytics Agent, by the Leave Agent (team availability), and by the Contract Amendment module (position/department/team reassignment on approval).

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode — `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`)  
**Primary Dependencies**: NestJS 10, Prisma 5, class-validator, class-transformer, @nestjs/swagger  
**Storage**: PostgreSQL 16, schema `hr_core` (shared instance, service-isolated via DB role `hr_core_svc`)  
**Testing**: Jest — unit (mocked Prisma), integration (real `hr_core` schema on test DB), contract (Nock)  
**Target Platform**: Node.js 20 LTS — Linux container (Docker Compose), accessed via HTTP on port 3001  
**Project Type**: NestJS microservice module (not a standalone service — extends HR Core)  
**Performance Goals**: Org-chart endpoint responds in < 1 second for an org of 500 employees across 20 departments  
**Constraints**: No cross-schema DB queries; no direct imports from `apps/social/` or `apps/ai-agentic/`; soft-delete only (no hard deletes)  
**Scale/Scope**: ~20–100 departments, ~50–500 teams, ~30–200 positions for a mid-size organization

---

## Constitution Check

*Constitution.md is a blank template — principles are derived directly from CLAUDE.md.*

| Gate | Rule (from CLAUDE.md) | Status |
|------|----------------------|--------|
| Modular design | Organization module must be a self-contained NestJS feature module; no business logic in controllers | PASS |
| Data privacy / RBAC | Every endpoint must have `@UseGuards(SharedJwtGuard, RbacGuard)` and `@Roles()` decorator | PASS |
| No cross-schema queries | Department/Team/Position entities stay within `hr_core` schema; Employee references are logical IDs only | PASS |
| Strict TypeScript | All public methods have explicit return types; no `any` | PASS |
| Soft-delete only | `isActive: Boolean` flag used; no `DELETE` at DB level | PASS |
| EventBus abstraction | No domain events emitted by this module in Phase 1 (org structure mutations don't trigger downstream events per CLAUDE.md event catalog — Contract Amendment handles that) | PASS |
| AgentContext for inter-service | N/A for this module — it is the *target* of cross-service calls, not the caller | PASS |

**Gate result: ALL PASS. Proceeding to Phase 0.**

*Post-design re-check: see bottom of plan.*

---

## Project Structure

### Documentation (this feature)

```text
specs/001-org-structure-module/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── departments-api.md
│   ├── teams-api.md
│   ├── positions-api.md
│   └── org-chart-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/hr-core/
├── src/
│   └── modules/
│       └── organization/               # New feature module
│           ├── organization.module.ts  # Barrel module — imports Departments, Teams, Positions, OrgChart
│           ├── departments/
│           │   ├── departments.controller.ts
│           │   ├── departments.service.ts
│           │   ├── departments.service.spec.ts
│           │   └── dto/
│           │       ├── create-department.dto.ts
│           │       ├── update-department.dto.ts
│           │       └── department-query.dto.ts
│           ├── teams/
│           │   ├── teams.controller.ts
│           │   ├── teams.service.ts
│           │   ├── teams.service.spec.ts
│           │   └── dto/
│           │       ├── create-team.dto.ts
│           │       ├── update-team.dto.ts
│           │       └── team-query.dto.ts
│           ├── positions/
│           │   ├── positions.controller.ts
│           │   ├── positions.service.ts
│           │   ├── positions.service.spec.ts
│           │   └── dto/
│           │       ├── create-position.dto.ts
│           │       ├── update-position.dto.ts
│           │       └── position-query.dto.ts
│           └── org-chart/
│               ├── org-chart.controller.ts
│               ├── org-chart.service.ts
│               └── org-chart.service.spec.ts
│
├── prisma/
│   └── schema.prisma                   # Add Department, Team, Position models
│
└── test/
    ├── integration/
    │   ├── departments.integration.spec.ts
    │   ├── teams.integration.spec.ts
    │   └── positions.integration.spec.ts
    ├── contracts/
    │   └── org-structure.contract.spec.ts   # Validates API shapes for AI Agentic client
    └── fixtures/
        └── organization.fixture.ts
```

**Structure Decision**: Single NestJS feature module (`OrganizationModule`) with four sub-domains (departments, teams, positions, org-chart), co-located unit tests, and a shared `PrismaModule` already provided by HR Core.

---

## Complexity Tracking

No constitution violations. No complexity justification needed.

---

## Post-Design Constitution Re-check

After Phase 1 design, all gates continue to pass:

- The Prisma schema uses `@@schema("hr_core")` and `@@map()` on every model — confirmed.
- `headId` and `leadId` are plain `String` fields (logical FKs) — no cross-schema Prisma relations.
- The org-chart service resolves employee counts using `prisma.employee.count()` within the same `hr_core` schema — no cross-service call needed.
- All endpoints have explicit role guards defined in contracts.
- No new dependencies beyond what HR Core already uses.
