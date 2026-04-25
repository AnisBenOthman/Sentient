---

description: "Implementation task list for 004-skills-module"
---

# Tasks: Skills Module

**Input**: Design documents from `/specs/004-skills-module/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/skills-api.md, quickstart.md

**Tests**: Automated tests are intentionally out of scope for this pass. Validation in this iteration is manual, performed through Swagger UI at `http://localhost:3001/api`. Automated unit/integration tests are planned as a follow-up after the IAM module lands.

**Organization**: Tasks are grouped by user story from spec.md so each story is independently implementable and testable through Swagger.

**Pre-IAM convention**: Every `@UseGuards(SharedJwtGuard, RbacGuard)`, `@Roles(...)`, and scope-filter call in this feature MUST be written as a commented-out line suffixed with `// TODO: re-enable when IAM module is implemented`, matching the exact marker string already used in `apps/hr-core/src/modules/employees/employees.controller.ts`. Swagger remains fully open; endpoints execute without a JWT so the database can be seeded and exercised manually.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to a user story (US1, US2, US3, US4)
- Paths are absolute from the repo root

## Path Conventions

- Backend service: `apps/hr-core/`
- Shared enums: `packages/shared/src/enums/`
- New module root: `apps/hr-core/src/modules/skills/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Directory scaffolding and the two shared enums consumed by the Prisma schema and DTOs.

- [ ] T001 Create module directory structure: `apps/hr-core/src/modules/skills/`, `apps/hr-core/src/modules/skills/catalog/`, `apps/hr-core/src/modules/skills/employee-skills/`, `apps/hr-core/src/modules/skills/history/`, `apps/hr-core/src/modules/skills/dto/`
- [ ] T002 [P] Create `packages/shared/src/enums/proficiency-level.enum.ts` exporting `enum ProficiencyLevel { BEGINNER, INTERMEDIATE, ADVANCED, EXPERT }`
- [ ] T003 [P] Create `packages/shared/src/enums/source-level.enum.ts` exporting `enum SourceLevel { RECRUITMENT, TRAINING, CERTIFICATION, MANAGER, PEER_REVIEW }`
- [ ] T004 Update `packages/shared/src/enums/index.ts` to re-export `ProficiencyLevel` and `SourceLevel` (blocks downstream imports; must follow T002+T003)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prisma schema extension, migration, and module wiring that every user story depends on.

**CRITICAL**: No user-story task can begin until this phase is complete.

- [ ] T005 Add `enum ProficiencyLevel` and `enum SourceLevel` to `apps/hr-core/prisma/schema.prisma` with `@@schema("hr_core")` on each
- [ ] T006 Add `model Skill` to `apps/hr-core/prisma/schema.prisma` per `data-model.md` (fields, `@@index([category])`, `@@index([isActive])`, `@@map("skills")`, `@@schema("hr_core")`, relations `employeeSkills` and `history`)
- [ ] T007 Add `model EmployeeSkill` to `apps/hr-core/prisma/schema.prisma` per `data-model.md` (fields including `deletedAt`, `@@index([employeeId])`, `@@index([skillId])`, `@@index([deletedAt])`, `@@map("employee_skills")`, `@@schema("hr_core")`, relations to `Employee` and `Skill`). Do NOT add `@@unique([employeeId, skillId])` — the partial unique index is added by raw SQL in T011.
- [ ] T008 Add `model SkillHistory` to `apps/hr-core/prisma/schema.prisma` per `data-model.md` (fields, `@@index([employeeId, effectiveDate])`, `@@index([skillId, effectiveDate])`, `@@index([effectiveDate])`, `@@index([source])`, `@@index([assessedById])`, `@@map("skill_history")`, `@@schema("hr_core")`, relations to `Employee` via `employeeId` and `Employee? @relation("AssessedSkillHistories")` via `assessedById`, and to `Skill`)
- [ ] T009 Add back-reference relations to the existing `model Employee` in `apps/hr-core/prisma/schema.prisma`: `skills EmployeeSkill[]`, `skillHistory SkillHistory[]`, and `assessedSkillHistory SkillHistory[] @relation("AssessedSkillHistories")`
- [ ] T010 Generate the migration by running `cd apps/hr-core && npx prisma migrate dev --create-only --name add_skills_module`, then verify the generated SQL in `apps/hr-core/prisma/migrations/<timestamp>_add_skills_module/migration.sql` creates exactly three tables (`skills`, `employee_skills`, `skill_history`), two enum types, and the declared indexes — no `ALTER TABLE hr_core.employees` column changes
- [ ] T011 Append a partial unique index to the migration file created in T010. At the end of the file add:

  ```sql
  -- Partial unique: at most one non-deleted row per (employeeId, skillId)
  CREATE UNIQUE INDEX "employee_skills_employeeId_skillId_active_unique"
    ON "hr_core"."employee_skills" ("employeeId", "skillId")
    WHERE "deletedAt" IS NULL;
  ```

- [ ] T012 Apply the migration and regenerate the Prisma client: `cd apps/hr-core && npx prisma migrate dev && npx prisma generate`
- [ ] T013 Create `apps/hr-core/src/modules/skills/skills.module.ts` — declare `SkillsModule`, import `PrismaModule` and the `EVENT_BUS` provider from the app's common event-bus module, register all three services and all three controllers (services will be added in later tasks — create the module shell now with empty `providers`/`controllers` arrays and fill them in at the end of each user-story phase)
- [ ] T014 Register `SkillsModule` in `apps/hr-core/src/app.module.ts` (add the import and include it in the `imports` array)
- [ ] T015 Verify Swagger UI in `apps/hr-core/src/main.ts` is unauthenticated and reachable on `/api`; the project convention is `SwaggerModule.setup('api', app, document)` with no bearer-auth requirement. No change expected — only confirm, and flag in the commit message if adjustments were needed.

**Checkpoint**: Prisma schema, migration, and empty `SkillsModule` are in place. All user-story phases can now proceed.

---

## Phase 3: User Story 1 — Record proficiency and auto-audit (Priority: P1) 🎯 MVP

**Goal**: Manager or HR admin can record/update an employee's skill proficiency, and each real level change writes one `SkillHistory` row automatically. Soft-deletion of a skill on an employee is part of this story because it is a write on the same resource.

**Independent Test (via Swagger)**: POST `/employees/{employeeId}/skills` with a new `(employee, skill)` pair produces `{ changed: true, current, history }` with `history.previousLevel = null`. A second POST with the same level produces `{ changed: false, history: null }` and no new DB row. A third POST with a different level produces `{ changed: true }` with `history.previousLevel = <prior level>`. DELETE soft-deletes the row and a subsequent POST re-creates a fresh first-assessment row.

### DTOs

- [ ] T016 [P] [US1] Create `apps/hr-core/src/modules/skills/dto/upsert-employee-skill.dto.ts` — `skillId` (`@IsUUID`), `proficiency` (`@IsEnum(ProficiencyLevel)`), `source` (`@IsEnum(SourceLevel)`), `note` (`@IsOptional @IsString @MaxLength(1000)`), `acquiredDate` (`@IsOptional @IsDateString`), `effectiveDate` (`@IsOptional @IsDateString`). Include Swagger `@ApiProperty` annotations on every field.

### Service

- [ ] T017 [US1] Create `apps/hr-core/src/modules/skills/employee-skills/employee-skills.service.ts` with an `EmployeeSkillsService` injecting `PrismaService` and `EVENT_BUS`. Implement:
  - `upsert(employeeId: string, dto: UpsertEmployeeSkillDto): Promise<{ changed: boolean; current: EmployeeSkill; history: SkillHistory | null }>` — wraps the logic in `prisma.$transaction`, handles the three cases in `data-model.md` "Assessment write path" (first assessment, no-op, level change), sets `SkillHistory.assessedById = null` until IAM ships (see T018; add `// TODO: re-enable when IAM module is implemented` next to the line that would read the caller's `employeeId` from the JWT).
  - `remove(employeeId: string, skillId: string): Promise<void>` — sets `deletedAt = new Date()` on the active row; `404` if none exists.
  - Termination guard: before either write, `SELECT employmentStatus FROM hr_core.employees WHERE id = $1`; throw `ConflictException('Employee is terminated or resigned — writes blocked')` if the status is `TERMINATED` or `RESIGNED`. This check is NOT auth and stays enabled.
  - Skill existence + `isActive` guard on first assignment; existing non-deleted rows may receive level changes on a deactivated skill.
  - Event emission: after a successful assess-with-change, emit `skill.assessed` with `{ employeeId, skillId, previousLevel, newLevel, source, assessedById, isFirstAssessment }`; after a successful remove, emit `skill.removed` with `{ employeeId, skillId, lastLevel }`. Use the injected `IEventBus`.
- [ ] T018 [US1] In `employee-skills.service.ts`, add the commented-out scope-filter placeholders near `upsert` and `remove`: lines importing `buildScopeFilter` and checking that the caller has MANAGER scope over `employeeId` or is HR_ADMIN, each suffixed with `// TODO: re-enable when IAM module is implemented`. During Swagger-first seeding, writes proceed unconditionally after the termination guard.

### Controller

- [ ] T019 [US1] Create `apps/hr-core/src/modules/skills/employee-skills/employee-skills.controller.ts` with `@Controller('employees/:employeeId/skills')` and class-level commented guards (`// @UseGuards(SharedJwtGuard, RbacGuard) // TODO: re-enable when IAM module is implemented`). Endpoints:
  - `POST /` → `upsert(employeeId, dto)` with `@ApiOperation`, `@ApiBody`, `@ApiResponse(200)` / `@ApiResponse(400)` / `@ApiResponse(404)` / `@ApiResponse(409)`. Commented `@Roles('MANAGER', 'HR_ADMIN')`.
  - `DELETE /:skillId` → `remove(employeeId, skillId)` returning `204`. Commented `@Roles('MANAGER', 'HR_ADMIN')`.
- [ ] T020 [US1] Register `EmployeeSkillsController` and `EmployeeSkillsService` in `apps/hr-core/src/modules/skills/skills.module.ts` (add to `controllers` and `providers` arrays). `SkillsModule` must also export `EmployeeSkillsService` only if a later story imports it — currently, no cross-controller sharing required, so no export needed.

### Swagger manual validation for US1

- [ ] T021 [US1] Boot the service with `turbo dev --filter=hr-core`, open `http://localhost:3001/api`, then through Swagger:
  1. Create a `Skill` row directly via Prisma Studio or a one-off `psql` insert (catalog endpoints don't exist until US3). A minimal row: `INSERT INTO hr_core.skills (id, name, "isActive", "createdAt") VALUES (gen_random_uuid(), 'React', true, NOW());`
  2. Use `GET /employees` (from the existing 003 module) to pick an existing `employeeId`.
  3. POST to `/employees/{employeeId}/skills` with `{ skillId, proficiency: "BEGINNER", source: "RECRUITMENT" }` → expect `changed: true`, `history.previousLevel = null`.
  4. Repeat the same POST → expect `changed: false`, `history = null`.
  5. POST again with `proficiency: "ADVANCED"` → expect `changed: true`, `history.previousLevel = "BEGINNER"`, `history.newLevel = "ADVANCED"`.
  6. DELETE `/employees/{employeeId}/skills/{skillId}` → expect `204`. Re-POST with any proficiency → expect `changed: true` with `history.previousLevel = null` (fresh start).

**Checkpoint**: US1 fully functional against Swagger. Stop and validate before moving to US2.

---

## Phase 4: User Story 2 — See current skill portfolios with scoped visibility (Priority: P2)

**Goal**: Anyone (pre-IAM: no restriction) can fetch an employee's active portfolio and can run reverse lookups by skill. Scope filtering is coded as commented-out hooks, ready to enable when IAM lands.

**Independent Test (via Swagger)**: After US1 seeded rows, GET `/employees/{employeeId}/skills` returns the active portfolio with the `skill` relation populated. GET `/skills/{skillId}/employees?minLevel=ADVANCED` returns the reverse-lookup page. Soft-deleted rows never appear in either response.

### DTOs

- [ ] T022 [P] [US2] Create `apps/hr-core/src/modules/skills/dto/employee-skill-query.dto.ts` — `minLevel` (`@IsOptional @IsEnum(ProficiencyLevel)`), `departmentId` (`@IsOptional @IsUUID`), `teamId` (`@IsOptional @IsUUID`), `page` (`@IsOptional @IsInt @Min(1)`, default 1), `limit` (`@IsOptional @IsInt @Min(1) @Max(100)`, default 20), with Swagger annotations.

### Service

- [ ] T023 [US2] Extend `apps/hr-core/src/modules/skills/employee-skills/employee-skills.service.ts` with:
  - `findForEmployee(employeeId: string, query: { minLevel?, includeDeactivated? }): Promise<EmployeeSkill[]>` — always filters `deletedAt: null`, applies `minLevel` via an enum-ordering map (`BEGINNER=0, INTERMEDIATE=1, ADVANCED=2, EXPERT=3`) because Prisma enum ordering in `where` isn't direct; implement with an `in: [...]` of levels ≥ the requested floor. Include `skill` relation.
  - `findByEmployeesForSkill(skillId: string, query: EmployeeSkillQueryDto): Promise<{ data; total; page; limit }>` — paginated reverse lookup. Join to `Employee` but `select` only `{ id, firstName, lastName, departmentId, teamId }` so salary/DOB never leak. Applies `departmentId` / `teamId` filters on the Employee side; `deletedAt: null` on EmployeeSkill.
- [ ] T024 [US2] In `employee-skills.service.ts`, add commented scope-filter hooks at the top of both read methods — `// const scope = buildScopeFilter(user, 'employee_skill', 'READ'); // TODO: re-enable when IAM module is implemented`. Do not apply any filter in this iteration.

### Controller

- [ ] T025 [US2] Extend `apps/hr-core/src/modules/skills/employee-skills/employee-skills.controller.ts`:
  - `GET /` on `@Controller('employees/:employeeId/skills')` → `findForEmployee(employeeId, query)` with Swagger decorators. Commented `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`.
- [ ] T026 [US2] Create `apps/hr-core/src/modules/skills/employee-skills/skill-reverse.controller.ts` (second controller in the same sub-module, using `@Controller('skills/:skillId/employees')` to avoid colliding with the catalog controller's `/skills/:id`):
  - `GET /` → `findByEmployeesForSkill(skillId, query)` with Swagger annotations. Commented `@Roles('HR_ADMIN', 'EXECUTIVE')`.
- [ ] T027 [US2] Register `SkillReverseController` in `apps/hr-core/src/modules/skills/skills.module.ts` `controllers` array. Declare it BEFORE `CatalogController` (T036) in the array so that the route matcher resolves `/skills/:skillId/employees` before any future `/skills/:id` pattern.

### Swagger manual validation for US2

- [ ] T028 [US2] Through Swagger:
  1. GET `/employees/{employeeId}/skills` → verify rows from US1 appear with the full `skill` object.
  2. GET `/employees/{employeeId}/skills?minLevel=ADVANCED` → confirm lower-level rows are filtered out.
  3. GET `/skills/{skillId}/employees` → verify the seeded employee appears.
  4. DELETE one row through US1 and re-GET the portfolio → confirm the deleted row is gone but remains in raw DB (`SELECT * FROM hr_core.employee_skills WHERE "deletedAt" IS NOT NULL`).

**Checkpoint**: Portfolio reads work end-to-end in Swagger.

---

## Phase 5: User Story 3 — Manage the global skill catalog (Priority: P3)

**Goal**: HR administrators (pre-IAM: anyone via Swagger) can CRUD the catalog. Deactivation is the "delete" operation — it never destroys rows.

**Independent Test (via Swagger)**: POST `/skills` creates a row; a second POST with the same name (any casing) returns 409; PATCH renames it; PATCH `/skills/{id}/deactivate` flips `isActive` without affecting any existing `EmployeeSkill`; PATCH `/skills/{id}/reactivate` flips it back.

### DTOs

- [ ] T029 [P] [US3] Create `apps/hr-core/src/modules/skills/dto/create-skill.dto.ts` — `name` (`@IsString @MinLength(1) @MaxLength(120) @Transform(({ value }) => value.trim())`), `category` (`@IsOptional @IsString @MaxLength(60)`), `description` (`@IsOptional @IsString @MaxLength(1000)`).
- [ ] T030 [P] [US3] Create `apps/hr-core/src/modules/skills/dto/update-skill.dto.ts` — all fields from `CreateSkillDto` marked optional (use `PartialType` from `@nestjs/mapped-types`).
- [ ] T031 [P] [US3] Create `apps/hr-core/src/modules/skills/dto/skill-query.dto.ts` — `page`, `limit` (max 100), `search`, `category`, `isActive` (default `true`), `sortBy` (`name` | `category` | `createdAt`, default `name`), `sortOrder` (`asc` | `desc`, default `asc`), all decorated and Swagger-annotated.

### Service

- [ ] T032 [US3] Create `apps/hr-core/src/modules/skills/catalog/catalog.service.ts` with `CatalogService` injecting `PrismaService`. Implement:
  - `create(dto: CreateSkillDto): Promise<Skill>` — normalize `name = dto.name.trim()`, run a case-insensitive existence check (`findFirst({ where: { name: { equals: normalized, mode: 'insensitive' } } })`), throw `ConflictException('Skill name already exists')` on hit, otherwise insert.
  - `findAll(query: SkillQueryDto): Promise<{ data; total; page; limit }>` — applies `search` via `contains` + `mode: 'insensitive'`, `category` exact match, `isActive` filter, `orderBy` from `sortBy` + `sortOrder`, offset pagination.
  - `findById(id: string): Promise<Skill>` — `NotFoundException` on miss.
  - `update(id: string, dto: UpdateSkillDto): Promise<Skill>` — same duplicate-name check as `create` when `name` is present, excluding the row being updated by id.
  - `deactivate(id: string): Promise<Skill>` — `ConflictException('Skill already inactive')` when `isActive` is already false.
  - `reactivate(id: string): Promise<Skill>` — mirror of `deactivate`.

### Controller

- [ ] T033 [US3] Create `apps/hr-core/src/modules/skills/catalog/catalog.controller.ts` with `@Controller('skills')` and commented class-level guards. Endpoints:
  - `POST /` → `create(dto)`; commented `@Roles('HR_ADMIN')`.
  - `GET /` → `findAll(query)`; commented `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`.
  - `GET /:id` → `findById(id)`; commented `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')`.
  - `PATCH /:id` → `update(id, dto)`; commented `@Roles('HR_ADMIN')`.
  - `PATCH /:id/deactivate` → `deactivate(id)`; commented `@Roles('HR_ADMIN')`.
  - `PATCH /:id/reactivate` → `reactivate(id)`; commented `@Roles('HR_ADMIN')`.
  - Full Swagger decorations per `contracts/skills-api.md`.
- [ ] T034 [US3] Register `CatalogController` and `CatalogService` in `apps/hr-core/src/modules/skills/skills.module.ts`. Order in the `controllers` array: `SkillReverseController` (T026), then `HistoryController` (T041 — placeholder until US4), then `CatalogController`. This guarantees that the more specific routes (`/skills/:skillId/employees`, `/skills/history`) win over `/skills/:id`.

### Swagger manual validation for US3

- [ ] T035 [US3] Through Swagger:
  1. POST `/skills` with `{ "name": "TypeScript" }` → 201.
  2. POST `/skills` with `{ "name": "typescript" }` → 409 (case-insensitive dedup).
  3. PATCH `/skills/{id}` to change `category` → 200.
  4. PATCH `/skills/{id}/deactivate` → 200 with `isActive: false`. Confirm any pre-existing `EmployeeSkill` referencing this skill still appears in `/employees/{employeeId}/skills`.
  5. PATCH `/skills/{id}/reactivate` → 200 with `isActive: true`.

**Checkpoint**: Catalog CRUD operational. At this point, US1 no longer needs a direct `psql` insert to bootstrap skills — Swagger can do the whole loop.

---

## Phase 6: User Story 4 — Audit skill evolution between two dates (Priority: P4)

**Goal**: Anyone (pre-IAM) can query `SkillHistory` by employee / team / department / skill / source within a date range, ordered chronologically. Date-range + paging correctness is the primary deliverable.

**Independent Test (via Swagger)**: After multiple US1 changes over different `effectiveDate`s, GET `/skills/history?employeeId=X&fromDate=...&toDate=...&order=asc` returns exactly the in-range rows, chronologically.

### DTO

- [ ] T036 [P] [US4] Create `apps/hr-core/src/modules/skills/dto/history-query.dto.ts` — `employeeId`, `teamId`, `departmentId`, `skillId` (all `@IsOptional @IsUUID`), `source` (`@IsOptional @IsEnum(SourceLevel)`), `fromDate`, `toDate` (`@IsOptional @IsDateString`), `page` (default 1), `limit` (default 50, max 200), `order` (`asc` | `desc`, default `desc`). Implement a `@ValidateIf` or class-level custom validator that rejects the request with `BadRequestException('At least one of employeeId, teamId, departmentId, skillId must be provided')` when all four scope IDs are absent. Also reject `fromDate > toDate`.

### Service

- [ ] T037 [US4] Create `apps/hr-core/src/modules/skills/history/history.service.ts` with `HistoryService` injecting `PrismaService`. Implement:
  - `query(dto: HistoryQueryDto): Promise<{ data; total; page; limit }>` — compose a `Prisma.SkillHistoryWhereInput`:
    - Direct filters: `employeeId`, `skillId`, `source`, `effectiveDate` between `fromDate` and `toDate` inclusive.
    - `teamId` / `departmentId` → via nested `employee: { teamId }` / `employee: { departmentId }` (requires declaring the `employee` relation on `SkillHistory`, already added in T008).
    - `orderBy: [{ effectiveDate: order }, { createdAt: order }]`.
    - Include `skill: { select: { id, name, category } }` and `assessedBy: { select: { id, firstName, lastName } }` relations.
  - Offset pagination via `skip` + `take`.
- [ ] T038 [US4] In `history.service.ts`, add the commented scope enforcement at the top of `query`: `// if (user.role === 'EMPLOYEE' && dto.employeeId !== user.employeeId) throw new ForbiddenException(); // TODO: re-enable when IAM module is implemented`. Pre-IAM: no scope check.

### Controller

- [ ] T039 [US4] Create `apps/hr-core/src/modules/skills/history/history.controller.ts` with `@Controller('skills/history')` (distinct root so it never collides with `/skills/:id`) and commented class-level guards. One endpoint:
  - `GET /` → `query(dto)` with full Swagger annotations, including every query param and example response.
  - Commented `@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'EXECUTIVE')` (pre-IAM pass).
- [ ] T040 [US4] Register `HistoryController` and `HistoryService` in `apps/hr-core/src/modules/skills/skills.module.ts`. Confirm the final `controllers` array order is: `SkillReverseController`, `HistoryController`, `EmployeeSkillsController`, `CatalogController`.

### Swagger manual validation for US4

- [ ] T041 [US4] Through Swagger:
  1. Build multiple history rows by running a sequence of US1 POSTs with different `effectiveDate` values (pass `effectiveDate` explicitly — e.g. `"2026-01-15"`, `"2026-02-20"`, `"2026-03-10"`).
  2. GET `/skills/history?employeeId={id}` (no dates) → expect all rows, `desc` order.
  3. GET `/skills/history?employeeId={id}&fromDate=2026-02-01&toDate=2026-02-28` → expect only the February row.
  4. GET `/skills/history?fromDate=2026-01-01&toDate=2026-12-31` without any scope ID → expect 400.
  5. GET `/skills/history?skillId={skillId}&source=CERTIFICATION` → expect only certification-origin rows.

**Checkpoint**: All four user stories are exercisable end-to-end in Swagger.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T042 Add a minimal catalog seed to `apps/hr-core/prisma/seed.ts` (or create it if absent): insert ~10 common skills with varied categories (`React`, `TypeScript`, `PostgreSQL`, `Docker`, `Kubernetes`, `English`, `French`, `Arabic`, `Communication`, `Leadership`). Idempotent — `upsert` by `name`. Run via `npx prisma db seed` (configure the seed command in `apps/hr-core/package.json` under `"prisma": { "seed": "ts-node prisma/seed.ts" }` if not already set).
- [ ] T043 Regenerate `CLAUDE.md` recent-changes entry if `.specify/scripts/bash/update-agent-context.sh claude` hasn't already been run post-plan (it was, but re-run at the end of implementation to capture any drift).
- [ ] T044 Grep the implemented module to confirm the TODO-marker sweep is consistent: `grep -rn "TODO: re-enable when IAM module is implemented" apps/hr-core/src/modules/skills/`. Every controller method with a commented `@Roles(...)` should surface; no method should be missing the marker. Capture the output in a comment appended to `specs/004-skills-module/quickstart.md` under a new "Pre-IAM re-enablement index" section so a future operator can find every line in one pass.
- [ ] T045 Manual performance sanity check in Swagger: seed ~100 skills and assign ~30 per employee for 5 employees; measure a GET `/skills/history?departmentId=...` query. Record the observed latency in the PR description as reference for the post-IAM load test.
- [ ] T046 Final commit and PR: ensure the branch `004-skills-module` has no stray `.env` changes, `schema.prisma` has the three new models + two enums + relations, `packages/shared/src/enums/index.ts` exports both new enums, and Swagger UI at `/api` lists all 11 skills endpoints.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup, T001–T004)**: no prerequisites; T004 depends on T002+T003.
- **Phase 2 (Foundational, T005–T015)**: depends on Phase 1. Blocks all user-story phases. T005–T009 happen in the schema file (sequential by necessity). T010 follows T005–T009. T011 follows T010 (hand-edit). T012 follows T011. T013–T014 follow T012. T015 is read-only.
- **Phase 3 (US1, T016–T021)**: depends on Phase 2 complete.
- **Phase 4 (US2, T022–T028)**: depends on Phase 2. Does NOT depend on Phase 3 functionally — portfolio reads work on any seeded data — but the Swagger validation in T028 is easier after US1 has created rows.
- **Phase 5 (US3, T029–T035)**: depends on Phase 2. Independent of US1/US2.
- **Phase 6 (US4, T036–T041)**: depends on Phase 2. Validation in T041 needs US1 rows, so run Phase 3 before Phase 6's Swagger test.
- **Phase 7 (Polish, T042–T046)**: depends on all user stories complete.

### Within Each Story

- DTOs before services (or in parallel if no shared type).
- Service before controller.
- Controller registered in `SkillsModule` immediately after creation (ordering matters for route resolution — see T034 and T040).
- Swagger manual validation task last.

### Parallel Opportunities

- T002 + T003 (enums, different files).
- T016 (US1 DTO) + T022 (US2 DTO) + T029 + T030 + T031 (US3 DTOs) + T036 (US4 DTO) — all different files, all independent, all can be written in one shot after Phase 2.
- T017 (US1 service) and T032 (US3 service) are in different subdirectories and can be drafted in parallel, but keep them to different sessions to avoid confusion.
- `SkillsModule` registration tasks (T020, T027, T034, T040) all touch the same file and MUST be sequential.

---

## Parallel Example: DTO creation after Foundational

```bash
# After Phase 2 finishes, all DTOs can be authored in parallel:
Task: "Create upsert-employee-skill.dto.ts"            # T016 [US1]
Task: "Create employee-skill-query.dto.ts"             # T022 [US2]
Task: "Create create-skill.dto.ts"                     # T029 [US3]
Task: "Create update-skill.dto.ts"                     # T030 [US3]
Task: "Create skill-query.dto.ts"                      # T031 [US3]
Task: "Create history-query.dto.ts"                    # T036 [US4]
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1: Setup (T001–T004)
2. Phase 2: Foundational (T005–T015)
3. Phase 3: US1 (T016–T021)
4. **STOP AND VALIDATE** — exercise steps 1–6 of T021 in Swagger. If the three-state assessment cycle and re-add-after-delete works, the MVP is green.
5. Decide: continue with US2/US3/US4, or branch off.

### Incremental Delivery

- After MVP: US3 removes the manual `psql` insert step from the loop (skills can now be created through Swagger).
- US2 then US4 round out reads and audit.
- Final polish (T042+) can be deferred until IAM-enablement work begins.

### Pre-IAM Re-enablement Preview

When the IAM module lands and RBAC is ready, a separate task will execute:

```bash
grep -rn "TODO: re-enable when IAM module is implemented" apps/hr-core/src/modules/skills/
```

Each surfaced line is an uncomment target. T044 ensures no commented guard goes missing from this index.

---

## Notes

- Tests are intentionally absent from this iteration (manual Swagger validation instead). Automated Jest tests will be added after IAM so the RBAC matrix can be exercised end-to-end. Plan artifact `quickstart.md` already lists the test files that should exist.
- Route-ordering matters because NestJS resolves controllers in registration order: `/skills/history`, `/skills/:skillId/employees`, `/skills/:id`. T013, T027, T034, T040 each touch `SkillsModule` to maintain this order.
- The termination guard (R-010) is a business rule, not an auth rule — it stays ON during pre-IAM. Employees with status `TERMINATED` or `RESIGNED` cannot receive new skill writes even through unauth'd Swagger.
- The partial unique index (T011) is hand-added SQL; do NOT replace it with a `@@unique` declaration in the Prisma schema, or subsequent migrations will drop and re-add it as a full unique index and break the soft-delete → re-add flow.
- Domain events (`skill.assessed`, `skill.removed`) are emitted today but have no consumer; the Career/Analytics agents will subscribe in a later feature without touching this module.
