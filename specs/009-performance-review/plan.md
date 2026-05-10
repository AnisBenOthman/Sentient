# Implementation Plan: Performance Review

**Branch**: `009-performance-review` | **Date**: 2026-05-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-performance-review/spec.md`

## Summary

Add a full performance review workflow to Sentient: HR admins create review cycles, active eligible employees receive one review assignment per cycle, employees submit self-review satisfaction/rating inputs from the core HRIS class diagram, reviewers complete manager ratings/comments, and HR tracks outcomes, rating gaps, overdue work, reopen reasons, and salary follow-up. The implementation spans the HR Core REST service, Prisma `hr_core` schema, shared enums, and the existing React performance review surface, replacing the current local-only review store with API-backed workflows.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode via `tsconfig.base.json`; package versions currently use TypeScript 5.7.x  
**Primary Dependencies**: NestJS 10, Prisma client/runtime packages currently 7.7.x with the existing multi-schema `hr_core` schema pattern, class-validator, class-transformer, @nestjs/swagger, @nestjs/config, React 18, Vite 7, TanStack Query, existing @sentient/shared auth/RBAC utilities  
**Storage**: PostgreSQL 16, schema `hr_core`  
**Testing**: Jest unit tests in `apps/hr-core`, focused service/controller tests, integration tests against HR Core database where existing harness supports it, React component/API integration tests where available  
**Target Platform**: Node.js HR Core service on port 3001 and React/Vite web app on port 3000  
**Project Type**: Full-stack web application feature backed by HR Core REST API  
**Performance Goals**: Initiate review cycle for 500 eligible employees in under 5 minutes; HR review list/filter reads under 400ms p95 for normal filtered pages; manager summary under 400ms p95; self-review and manager-review submissions under 600ms p95  
**Constraints**: Every endpoint is guarded by `SharedJwtGuard`, `UserStatusGuard`, and `RbacGuard` through global guards plus explicit `@Roles(...)`; services enforce employee/reviewer/HR scope; no duplicate review assignment for the same employee and cycle; completed reviews are immutable unless HR reopens with a reason; preserve prior historical reviews; no cross-schema writes  
**Scale/Scope**: Around 10k employees, 1-2 review cycles per year, approximately 20k review records/year, 4 new domain tables, 4 new Prisma enums or enum updates, 1 HR Core module, 1 API contract, and replacement of the existing web localStorage review workflow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file is still an unfilled template, so there are no project-specific constitutional gates to enforce from `.specify/memory/constitution.md`. The gate is evaluated against the repository instructions in `AGENTS.md` and the existing implementation patterns.

**Pre-Phase 0 gate**:
- Strict TypeScript, no `any`, explicit public return types: planned pass.
- NestJS modular layout with module, controllers, services, DTOs, and Prisma-backed persistence: planned pass.
- Prisma models and enums use `@@schema("hr_core")` and mapped snake_case table names: planned pass.
- Endpoints use auth/RBAC guards and role decorators, with scope enforced in services: planned pass.
- DTOs validate with class-validator and services trust validated DTOs: planned pass.
- Sensitive review comments and ratings remain role/scope limited: planned pass.
- No unrelated refactors or changes outside HR Core, shared enums/interfaces, and the existing web review surface: planned pass.

**Post-Phase 1 re-check**:
- Data model includes uniqueness on `(employeeId, cycleId)` to prevent duplicate assignments: pass.
- State transitions keep submitted/completed reviews immutable unless reopened by HR with an audit reason: pass.
- Rating-gap and overdue queries are index-backed and do not require derived tables for MVP scale: pass.
- Existing `PerformanceRating` and `ReviewStatus` shared enums are reconciled deliberately in research instead of silently drifting from the core HRIS class diagram: pass.
- Web changes replace the current local-only mock store with API-backed operations while preserving the current route surface: pass.

No gate violations. No entries are required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/009-performance-review/
|-- plan.md
|-- spec.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- performance-review-api.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
apps/hr-core/
|-- prisma/
|   |-- schema.prisma
|   `-- migrations/
|       `-- <timestamp>_add_performance_reviews/
|           `-- migration.sql
`-- src/
    |-- app.module.ts
    `-- modules/
        `-- performance-reviews/
            |-- performance-reviews.module.ts
            |-- cycles/
            |   |-- review-cycles.controller.ts
            |   |-- review-cycles.service.ts
            |   `-- review-cycles.service.spec.ts
            |-- reviews/
            |   |-- performance-reviews.controller.ts
            |   |-- performance-reviews.service.ts
            |   `-- performance-reviews.service.spec.ts
            |-- dto/
            |   |-- create-review-cycle.dto.ts
            |   |-- initiate-review-cycle.dto.ts
            |   |-- submit-self-review.dto.ts
            |   |-- submit-manager-review.dto.ts
            |   |-- reopen-review.dto.ts
            |   |-- review-query.dto.ts
            |   |-- record-salary-follow-up.dto.ts
            |   `-- reassign-reviewer.dto.ts
            `-- util/
                |-- rating-gap.util.ts
                `-- review-status.util.ts

apps/web/src/
|-- lib/
|   |-- api/hr-core.ts
|   `-- performance-review-store.ts
`-- pages/
    `-- performance-reviews.tsx

packages/shared/src/
|-- enums/
|   |-- performance-rating.enum.ts
|   |-- review-status.enum.ts
|   |-- review-type.enum.ts
|   |-- satisfaction-level.enum.ts
|   `-- index.ts
`-- interfaces/
    `-- performance-review.interface.ts
```

**Structure Decision**: One `performance-reviews` HR Core module with two controller/service areas: `cycles` for HR cycle creation and assignment management, and `reviews` for self-review, manager review, HR filtering, reopen, reassign, and salary follow-up actions. The web feature keeps the existing `performance-reviews` route and replaces local-only storage with API calls through `apps/web/src/lib/api/hr-core.ts`. Shared package changes are limited to enums/interfaces needed by both HR Core and the web client.

## Complexity Tracking

No constitution violations. No complexity exceptions required.
