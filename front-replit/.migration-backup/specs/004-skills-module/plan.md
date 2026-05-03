# Implementation Plan: Skills Module

**Branch**: `004-skills-module` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-skills-module/spec.md`

## Summary

Add a Skills domain to HR Core: a global skill catalog, per-employee current proficiency snapshots, and an immutable audit journal of every proficiency change. Managers and HR administrators author assessments (employees never self-edit); reads are scope-filtered (OWN / TEAM / GLOBAL). Same-level assessments are no-ops so the history contains only real transitions. Soft-delete on the current-proficiency row preserves history and allows a later clean re-assignment. Domain events are emitted for future Career/Analytics agent consumption but no consumer is wired in this feature.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/config
**Storage**: PostgreSQL 16, schema `hr_core`
**Testing**: Jest (unit + integration) — contract tests deferred (no inter-service client added)
**Target Platform**: Node.js server (NestJS microservice on port 3001)
**Project Type**: Web service (REST API microservice)
**Performance Goals**: <500ms p95 for current portfolio reads, <800ms p95 for full-history reads (up to 50 skills × 200 history entries per employee), <2s p95 for department-wide audit queries up to 500 employees
**Constraints**: Strict RBAC scope filtering on every read and write, no self-edit of proficiency, no cross-schema writes, history append-only, soft-delete on current entries preserves audit integrity
**Scale/Scope**: Up to ~10k employees × ~100 catalog skills = ~100k potential `EmployeeSkill` rows, ~500k `SkillHistory` rows over project lifetime; 2 enums, 3 entities, 11 REST endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is an unfilled template. The governing constraints are the project's existing conventions in `CLAUDE.md` and `.claude/rules/`. Gate evaluated against those:

**Pre-Phase 0 gate**:
- Strict TypeScript (no `any`, explicit returns) — planned ✅
- NestJS modular layout (Module → Controller → Service + DTOs) — planned ✅
- Prisma with `@@schema("hr_core")` on every model — planned ✅
- `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles()` on every endpoint — planned ✅
- DTOs with class-validator; services trust their inputs — planned ✅
- Domain events via existing `IEventBus` abstraction — planned ✅
- No cross-service imports (entirely inside `apps/hr-core/`) — planned ✅
- No feature flags or backwards-compat shims — nothing to preserve ✅

**Post-Phase 1 re-check** (see Phase 1 artifacts):
- Partial unique index on `EmployeeSkill(employeeId, skillId) WHERE deletedAt IS NULL` — added via raw SQL fragment in the Prisma migration (documented in `research.md` R-004 and `quickstart.md` Step 1) ✅
- No new shared package additions beyond two enums (`ProficiencyLevel`, `SourceLevel`) — minimal surface ✅
- Existing `buildScopeFilter` helper pattern reused for team/department scope queries — no new security primitives ✅
- Prisma unique-index/migration pitfall (from `feedback_prisma_migration_constraints.md` memory) — no `@@unique` change to existing tables in this feature; only additive indexes on new tables ✅

No violations. No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-skills-module/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: implementation guide
├── contracts/
│   └── skills-api.md    # Phase 1: REST API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2: implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/hr-core/
├── prisma/
│   ├── schema.prisma                               # Modified: add Skill, EmployeeSkill,
│   │                                                #           SkillHistory, ProficiencyLevel,
│   │                                                #           SourceLevel; add skills[] and
│   │                                                #           assessedSkillHistories[] on Employee
│   └── migrations/
│       └── <timestamp>_add_skills_module/
│           └── migration.sql                       # Prisma-generated + raw partial unique index
├── src/
│   ├── modules/
│   │   └── skills/                                 # NEW module
│   │       ├── skills.module.ts
│   │       ├── catalog/
│   │       │   ├── catalog.controller.ts          # /skills  (catalog CRUD)
│   │       │   ├── catalog.service.ts
│   │       │   └── catalog.service.spec.ts
│   │       ├── employee-skills/
│   │       │   ├── employee-skills.controller.ts  # /employees/:id/skills
│   │       │   ├── employee-skills.service.ts
│   │       │   └── employee-skills.service.spec.ts
│   │       ├── history/
│   │       │   ├── history.controller.ts          # /skills/history
│   │       │   ├── history.service.ts
│   │       │   └── history.service.spec.ts
│   │       └── dto/
│   │           ├── create-skill.dto.ts
│   │           ├── update-skill.dto.ts
│   │           ├── skill-query.dto.ts
│   │           ├── upsert-employee-skill.dto.ts
│   │           ├── remove-employee-skill.dto.ts
│   │           └── history-query.dto.ts
│   └── app.module.ts                                # Modified: import SkillsModule

packages/shared/src/
└── enums/
    ├── proficiency-level.enum.ts                   # NEW: BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
    ├── source-level.enum.ts                        # NEW: RECRUITMENT, TRAINING, CERTIFICATION,
    │                                                #      MANAGER, PEER_REVIEW
    └── index.ts                                    # Modified: export the two new enums
```

**Structure Decision**: A single `skills` Nest module with three sub-controllers (catalog, employee-skills, history) because the three surfaces have distinct URL shapes and distinct RBAC matrices, but they share the same domain invariants and one Prisma transactional path (assessment → history append). Keeping them in one module keeps the transactional boundary local and avoids circular imports between sub-modules. Mirrors the granularity of `modules/organization/` which hosts departments + teams + positions under one module.

## Complexity Tracking

No constitution violations — no entries needed.
