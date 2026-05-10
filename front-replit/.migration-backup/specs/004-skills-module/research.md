# Research: Skills Module

**Branch**: `004-skills-module` | **Date**: 2026-04-17

## R-001: Module layout inside HR Core

**Decision**: Add a single `apps/hr-core/src/modules/skills/` module containing three sub-controllers (`catalog`, `employee-skills`, `history`) under one `SkillsModule`, sharing one `PrismaService` and one domain service that owns the assessment-plus-history transaction.

**Rationale**: The three surfaces (catalog admin, per-employee assessments, audit queries) have distinct route shapes and distinct RBAC rules, but they share one transactional invariant: writing a proficiency change and appending a history row must be atomic. Putting them in one module keeps the transaction local and avoids cross-module imports for a single invariant. The `modules/organization/` module already hosts departments + teams + positions under a single module using the same sub-controller pattern — this mirrors it.

**Alternatives considered**:
- Three separate modules (`skills-catalog`, `employee-skills`, `skill-history`): rejected — creates circular-ish dependencies (employee-skills needs the history writer; history needs the catalog for joins) and scatters the transaction across modules.
- Fold everything into the existing `employees` module: rejected — skill catalog has nothing to do with the employee record itself, and the module would balloon. CLAUDE.md explicitly names `skills/` as a distinct HR Core module.

## R-002: ProficiencyLevel and SourceLevel enum placement

**Decision**:
- Add both enums in Prisma (`apps/hr-core/prisma/schema.prisma`, each `@@schema("hr_core")`).
- Add matching TypeScript enums in `packages/shared/src/enums/proficiency-level.enum.ts` and `source-level.enum.ts`, exported from the shared barrel.
- `ProficiencyLevel`: `BEGINNER, INTERMEDIATE, ADVANCED, EXPERT`.
- `SourceLevel`: `RECRUITMENT, TRAINING, CERTIFICATION, MANAGER, PEER_REVIEW`.

**Rationale**: Matches the pattern established for every other enum in the project (`ContractType`, `EmploymentStatus`, `SalaryChangeReason`, etc.): Prisma owns the DB representation; the shared package owns the TypeScript surface used by DTOs, services, and any future consumers (frontend, Career Agent). The diagram typo `RECRUITEMENT` is fixed to `RECRUITMENT` per Q4 of the spec.

**Alternatives considered**:
- Keep enums only in the HR Core Prisma-generated client: rejected — frontend and future agent tooling need them too, and the shared package is the single source of truth per CLAUDE.md.
- Accept the `RECRUITEMENT` typo and migrate later: rejected — adding the typo first and fixing it later means two enum migrations and breaks any already-written code. Fix now before any row exists.

## R-003: Delta-based history (no-op on same-level assessment)

**Decision**: The assessment service compares the incoming proficiency against the current row's level. If they are equal, it returns `200 OK` with a body flag `{ changed: false }` and writes nothing (no update to `EmployeeSkill.updatedAt`, no `SkillHistory` row). If they differ, it updates `EmployeeSkill` and appends one `SkillHistory` row inside a single `prisma.$transaction`.

**Rationale**: Spec FR-012 and FR-013 require history to contain only true transitions, and the reconciliation success criterion (SC-004) depends on it. Returning `200` with a `changed` flag keeps the client idempotent-friendly (re-sending the same assessment is safe). Using a single transaction guarantees the history row can never diverge from the current level under concurrency.

**Alternatives considered**:
- Event-based history (write on every assessment even when level is unchanged): rejected — user chose delta-based; also inflates the history table with noise that hurts audit queries.
- Return `204 No Content` on no-op: rejected — the caller needs to know the current state and whether the action had an effect; `200` with a body is more useful.
- Application-level locking around the transaction: rejected — Prisma's serializable transaction + the partial unique index (R-004) give us the needed guarantees without an external lock.

## R-004: One current row per (employee, skill) with soft delete — partial unique index

**Decision**: Add a partial unique index on `hr_core.employee_skills (employee_id, skill_id) WHERE deleted_at IS NULL`, authored as a raw SQL fragment appended to the Prisma migration file. Reads in application code always apply `deletedAt: null`. Re-assigning a previously soft-deleted skill creates a brand-new row with `deletedAt = null`, not a resurrection of the old row.

**Rationale**: Prisma's `@@unique([employeeId, skillId])` would produce a full unique index that blocks multiple soft-deleted rows from coexisting, which defeats the spec's "later re-assignment starts a fresh entry with previousLevel = null again" rule (spec Edge Cases). PostgreSQL partial indexes are the canonical solution. Prisma 5 does not yet emit partial indexes from the schema DSL, so we finish the migration file by hand — a pattern already used in the project (migrations are hand-edited after `prisma migrate dev`).

**Alternatives considered**:
- Full unique index + "resurrect and re-zero" on re-assignment: rejected — violates the spec requirement that `previousLevel` be `null` on a fresh first assessment (resurrection would either falsely chain previousLevel to the old value, or require erasing history, which is worse).
- Drop uniqueness entirely and enforce in service code: rejected — loses DB-level protection against race conditions; not aligned with the project's defense-in-depth posture.
- Use `citext` or a generated column to hold soft-deleted rows separately: rejected — needlessly complex for a constraint a partial index solves cleanly.

## R-005: Skill.name uniqueness — case-insensitive + trimmed at service layer, exact-match at DB layer

**Decision**: Store `Skill.name` as the trimmed user-entered display value with a plain `@unique` constraint. In `CatalogService.create` and `update`, normalize incoming names with `name.trim()` and perform a case-insensitive lookup (`where: { name: { equals: input, mode: 'insensitive' } }`) before writing; reject on duplicate before the DB constraint fires.

**Rationale**: Keeps display casing as HR admins typed it ("React Native", not "react native") while preventing "react", "React", "REACT" from coexisting. Avoids `citext` extension and avoids storing a second `nameKey` column. The DB-level exact-match unique is a safety net for the race where two identically-cased names are inserted simultaneously.

**Alternatives considered**:
- `citext` column type: rejected — adds a Postgres extension not currently enabled in `scripts/init-schemas.sql`; overkill for one column.
- Separate `nameKey` normalized column with a unique index on it: rejected — extra column to keep in sync for no ergonomic gain; service-level check is simpler and testable.
- Rely on DB collation: rejected — the database's default collation is not reliably case-insensitive across environments.

## R-006: Authorship recording — `assessedBy` is the acting user, `source` is the origin label

**Decision**: On every assessment write, the service sets `SkillHistory.assessedBy` to the `employeeId` of the JWT's current user (manager or HR_ADMIN). The `source` field is set from the DTO and can be any `SourceLevel` value including `PEER_REVIEW`. The service does NOT attempt to verify who the "peer" was — peer-review workflow tooling is out of scope. If `source = MANAGER` and the caller is HR_ADMIN (not the employee's manager), the write is still allowed under GLOBAL scope.

**Rationale**: Spec FR-010 and FR-011 make the two fields orthogonal: one is accountability (who typed it in), the other is provenance (what informed the decision). Coupling them (e.g. rejecting `source=MANAGER` when author isn't the manager) would overfit the model and break HR corrections of manager-entered data.

**Alternatives considered**:
- Validate that `source = PEER_REVIEW` requires an extra `peerReviewerId` field: rejected — user explicitly scoped peer-review workflows out of this feature.
- Auto-derive `source` from the author's role: rejected — loses information (an HR admin entering a manager-delivered assessment still wants `source=MANAGER`).

## R-007: Scope filtering strategy (reads)

**Decision**: Reuse the existing `buildScopeFilter` pattern from the employees module. Add a thin helper `scopeEmployeeIdsFor(user)` that returns either `{ id: user.employeeId }` (OWN), `{ managerId: user.employeeId }` (TEAM), or `{}` (GLOBAL); every `EmployeeSkill` / `SkillHistory` read joins through `employeeId` and applies this filter. HR_ADMIN and EXECUTIVE roles get GLOBAL.

**Rationale**: Exact mirror of how `employees.service.ts` does it (see R-006 in specs/003-employee-module/research.md). No new security primitive; readers of the two new tables inherit the already-reviewed scope resolution logic. Employees may read their own history (spec FR-016) — handled by OWN scope + no extra rule.

**Alternatives considered**:
- Global `ScopeFilterInterceptor`: rejected — scope semantics are per-resource (what "OWN" means differs between employees, skills, leaves); interceptors centralize the generic parts but the per-resource where-clause still lives in the service.

## R-008: Domain events — two events, no consumer in this feature

**Decision**: Emit two events through the existing `IEventBus` abstraction:

| Event            | Payload                                                                               | When                                              |
|------------------|---------------------------------------------------------------------------------------|---------------------------------------------------|
| `skill.assessed` | `{ employeeId, skillId, previousLevel \| null, newLevel, source, assessedBy, isFirstAssessment }` | After a successful write that wrote a history row |
| `skill.removed`  | `{ employeeId, skillId, lastLevel }`                                                   | After a successful soft-delete                    |

No in-service subscriber. Events are fire-and-forget into the existing `InMemoryEventBus` stub so the wiring is in place for Career and Analytics agents to subscribe later without another HR Core release.

**Rationale**: CLAUDE.md §3.3 mandates the EventBus abstraction on all domain modules. Spec FR-025 explicitly asks for events without wiring a consumer in this feature. Two events is the minimum that covers the lifecycle; a single `skill.changed` event with a discriminator was considered but `isFirstAssessment` serves the same purpose while preserving explicit removal semantics.

**Alternatives considered**:
- One event with a `type` discriminator (`ASSESSED` / `REMOVED`): rejected — the project's catalog already uses verb-based event names (e.g. `employee.created`, `employee.terminated`); consistency wins.
- Emit a third event on catalog mutations (`skill.created`, `skill.deactivated`): rejected — catalog admin is a low-frequency HR action; consumers can poll the catalog if they need to. YAGNI until a consumer asks.

## R-009: History query pagination and ordering

**Decision**: History list endpoint is paginated (`page`/`limit`, default limit 50, max 200) and ordered by `effectiveDate DESC, createdAt DESC` by default, with an `order=asc|desc` toggle for audit exports. Filters are composed as a single `AND` across `employeeId`, `teamId` / `departmentId` (through the employee join), `skillId`, `source`, `fromDate`, `toDate`.

**Rationale**: Spec FR-021 and FR-022 mandate the filter surface and chronological ordering. Offset pagination matches the rest of HR Core (see 003 employees). The 200 max keeps a single response comfortably under the p95 target.

**Alternatives considered**:
- Cursor-based pagination: rejected — audit queries are typically one-shot reads by HR staff; offset is simpler and fine at the expected volume (SC-005 targets 500 employees / department).

## R-010: Terminated-employee write guard

**Decision**: Before every write (assessment, removal), the service fetches `Employee.employmentStatus` via a lightweight `select` and rejects with `409 Conflict` if the status is `TERMINATED` or `RESIGNED` (matching spec FR-023). Reads continue to return the existing rows.

**Rationale**: Keeps the terminal-state rule consistent with how `employees.service.updateStatus` handles it. The extra `SELECT` is cheap (PK lookup); an alternative using a DB-level check trigger was considered but would hide the rule from the application and complicates testing.

**Alternatives considered**:
- Database trigger: rejected — same reasoning as R-007 in 003-employee-module research; NestJS-native validation wins on testability.

## R-011: Prisma migration — additive only, no constraint changes to existing tables

**Decision**: The Prisma migration creates:
1. Two new enum types (`ProficiencyLevel`, `SourceLevel`).
2. Three new tables (`skills`, `employee_skills`, `skill_history`) under the `hr_core` schema with their own indexes.
3. No changes to the existing `employees` table schema beyond back-reference relations that do not emit DDL (Prisma relation declarations without foreign-key changes).
4. One appended raw SQL block creating the partial unique index described in R-004.

No `@@unique` on existing tables is touched, so the "DROP INDEX vs DROP CONSTRAINT" migration pitfall from project memory does not apply. The `@@index` declarations on the three new tables emit clean `CREATE INDEX` statements on first creation.

**Rationale**: Additive migrations are reversible and low-risk; the project memory on Prisma unique-constraint migrations flagged the danger specifically of renaming or replacing existing uniques, which we are not doing.

**Alternatives considered**: None — additive migration is the only correct path here.
