# Tasks: Organization Structure Module (Departments, Teams, Positions)

**Input**: Design documents from `/specs/001-org-structure-module/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested — test tasks are omitted per task generation rules. Unit test stubs are included as Polish phase tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([US1]–[US5])
- Paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the directory structure and database schema that all user stories depend on.

- [ ] T001 Add Department, Team, and Position models to `apps/hr-core/prisma/schema.prisma` (see data-model.md for exact Prisma model definitions including `@@schema("hr_core")`, `@@map()`, indexes, and the `Team → Department` relation)
- [ ] T002 Run `npx prisma migrate dev --name add_organization_module` from `apps/hr-core/` to generate and apply the migration
- [ ] T003 [P] Create directory structure: `apps/hr-core/src/modules/organization/` with sub-folders `departments/dto/`, `teams/dto/`, `positions/dto/`, `org-chart/`
- [ ] T004 [P] Create test fixture file `apps/hr-core/test/fixtures/organization.fixture.ts` with `buildDepartment()`, `buildTeam()`, and `buildPosition()` factory functions following the pattern in `apps/hr-core/test/fixtures/` (uuid-based random IDs, sensible defaults, `Partial<>` overrides)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire up the NestJS module so all sub-domains can register their controllers and services. Must be complete before any user story endpoint is reachable.

**⚠️ CRITICAL**: No user story controllers or services will be injectable until this phase is complete.

- [ ] T005 Create `apps/hr-core/src/modules/organization/organization.module.ts` — declare `OrganizationModule` as a NestJS `@Module` that imports `PrismaModule` and declares the four controllers (`DepartmentsController`, `TeamsController`, `PositionsController`, `OrgChartController`) and four services (`DepartmentsService`, `TeamsService`, `PositionsService`, `OrgChartService`); export all four services
- [ ] T006 Register `OrganizationModule` in `apps/hr-core/src/app.module.ts` imports array

**Checkpoint**: `turbo dev --filter=hr-core` starts without errors — module wires up even with empty controller/service stubs.

---

## Phase 3: User Story 1 — HR Admin Manages Departments (Priority: P1) 🎯 MVP

**Goal**: Full CRUD lifecycle for the Department entity — create, list, get by ID, update, and soft-deactivate — enforced to HR Admin role only (except GET by ID which also allows MANAGER and EXECUTIVE).

**Independent Test**: `POST /api/hr/departments` → `GET /api/hr/departments` → `PATCH /api/hr/departments/:id` → `DELETE /api/hr/departments/:id` with an HR Admin JWT. Attempt the same POST with an EMPLOYEE JWT and receive 403. Attempt a duplicate `code` and receive 409.

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create `apps/hr-core/src/modules/organization/departments/dto/create-department.dto.ts` — `CreateDepartmentDto` with `@IsString()`, `@Length()`, `@IsOptional()`, `@IsUUID()` decorators for `name` (required, 1–100), `code` (required, 2–10), `description` (optional, max 500), `headId` (optional UUID); add `@ApiProperty` on each field
- [ ] T008 [P] [US1] Create `apps/hr-core/src/modules/organization/departments/dto/update-department.dto.ts` — `UpdateDepartmentDto` as `PartialType(CreateDepartmentDto)` plus `@IsOptional() @IsBoolean() isActive?: boolean`
- [ ] T009 [P] [US1] Create `apps/hr-core/src/modules/organization/departments/dto/department-query.dto.ts` — `DepartmentQueryDto` with optional `isActive: boolean` (`@Transform(() => Boolean)`), `cursor: string`, `limit: number` (`@IsOptional() @IsInt() @Min(1) @Max(100) @Transform(({ value }) => value ?? 20)`)
- [ ] T010 [US1] Implement `apps/hr-core/src/modules/organization/departments/departments.service.ts` — `DepartmentsService` with: `create(dto)` (validates unique name/code via `prisma.department.findFirst`, validates `headId` via `prisma.employee.findUnique`, throws `ConflictException` on duplicate, `NotFoundException` for missing head), `findAll(query, roles)` (defaults `isActive:true` for non-admin callers), `findById(id)` (includes `teams: { select: { id, name, isActive } }`; if `headId` is set, attempts `prisma.employee.findUnique({ where: { id: headId }, select: { id, firstName, lastName } })` and maps result to `head: EmployeeRef | null` — returns `null` without throwing if the employee no longer exists; throws `NotFoundException` only if the department itself is missing — this satisfies the edge-case contract for stale headId references), `update(id, dto)` (re-validates uniqueness and headId if changed), `deactivate(id)` (sets `isActive:false`, idempotent)
- [ ] T011 [US1] Implement `apps/hr-core/src/modules/organization/departments/departments.controller.ts` — `DepartmentsController` at route `'departments'` with `@UseGuards(SharedJwtGuard, RbacGuard)` and `@ApiTags('Organization')` on the class; wire all five endpoints per `contracts/departments-api.md` (`POST @Roles('HR_ADMIN')`, `GET @Roles('HR_ADMIN','EXECUTIVE')`, `GET /:id @Roles('HR_ADMIN','EXECUTIVE','MANAGER')`, `PATCH /:id @Roles('HR_ADMIN')`, `DELETE /:id @Roles('HR_ADMIN')`); use `@CurrentUser()` decorator to pass user to service for `isActive` filter enforcement
- [ ] T012 [US1] Add Department seed data to `apps/hr-core/prisma/seed.ts` — `createMany` for at least 3 departments (`ENG`, `HR`, `PRD`) using `skipDuplicates: true`

**Checkpoint**: HR Admin can create a department, list it, update it, and soft-delete it. EMPLOYEE role receives 403 on mutations. Duplicate `code` returns 409.

---

## Phase 4: User Story 2 — HR Admin Manages Teams (Priority: P2)

**Goal**: Full CRUD lifecycle for the Team entity — creation validates that the target department is active; updates support lead reassignment; soft-deactivation is idempotent. HR Admin list endpoint shows all teams; GET by ID includes `leadVacant` resolution.

**Independent Test**: Create a Team under an active Department, list it filtered by `departmentId`, update its `projectFocus`, then soft-deactivate it. Attempt to create a Team under an inactive Department and receive 400. Assign a terminated employee as lead and receive `leadVacant: true` on GET.

### Implementation for User Story 2

- [ ] T013 [P] [US2] Create `apps/hr-core/src/modules/organization/teams/dto/create-team.dto.ts` — `CreateTeamDto` with validators for `name` (required, 1–100), `code` (optional, 2–20), `description` (optional, max 500), `departmentId` (required UUID), `leadId` (optional UUID), `projectFocus` (optional, max 200)
- [ ] T014 [P] [US2] Create `apps/hr-core/src/modules/organization/teams/dto/update-team.dto.ts` — `UpdateTeamDto` as `PartialType(CreateTeamDto)` plus optional `isActive: boolean`
- [ ] T015 [P] [US2] Create `apps/hr-core/src/modules/organization/teams/dto/team-query.dto.ts` — `TeamQueryDto` with optional `departmentId: string`, `isActive: boolean`, `cursor: string`, `limit: number` (`@IsOptional() @IsInt() @Min(1) @Max(100) @Transform(({ value }) => value ?? 20)`)
- [ ] T016 [US2] Implement `apps/hr-core/src/modules/organization/teams/teams.service.ts` — `TeamsService` with: `create(dto)` (validates `departmentId` is active via `prisma.department.findFirst({ where: { id, isActive: true } })`, validates `leadId` existence, validates unique `code`, throws `BadRequestException` for inactive dept, `ConflictException` for duplicate code), `findAll(query, user)` (scope-filtered: MANAGER sees only `{ id: user.teamId }`, HR_ADMIN/EXECUTIVE see all; enforces `isActive:true` for non-admin), `findById(id, user)` (resolves `leadVacant` by checking `lead.employmentStatus === EmploymentStatus.TERMINATED`), `update(id, dto)` (re-validates dept/lead/code if changed), `deactivate(id)` (sets `isActive:false`)
- [ ] T017 [US2] Implement `apps/hr-core/src/modules/organization/teams/teams.controller.ts` — `TeamsController` at route `'teams'` with five endpoints per `contracts/teams-api.md`; `POST @Roles('HR_ADMIN')`, `GET @Roles('HR_ADMIN','EXECUTIVE','MANAGER')`, `GET /:id @Roles('HR_ADMIN','EXECUTIVE','MANAGER')`, `PATCH /:id @Roles('HR_ADMIN')`, `DELETE /:id @Roles('HR_ADMIN')`; pass `@CurrentUser()` to `findAll` and `findById` for scope resolution
- [ ] T018 [US2] Add Team seed data to `apps/hr-core/prisma/seed.ts` — after departments seed, create at least 2 teams per seeded department using `skipDuplicates: true`

**Checkpoint**: HR Admin can create a team under an active department, list by `departmentId`, update, and soft-deactivate. Creating a team under an inactive department returns 400. `leadVacant` is `true` when lead employee is TERMINATED.

---

## Phase 5: User Story 3 — HR Admin Manages Job Positions (Priority: P3)

**Goal**: Full CRUD lifecycle for the Position catalog — global to the organization, not department-scoped. All authenticated users can read positions; only HR Admin can mutate.

**Independent Test**: As an HR Admin, create a `"Software Engineer - Senior"` position, list all positions, update its level, and soft-deactivate it. As an EMPLOYEE, list positions and receive 200. As an HR Admin, attempt a duplicate title and receive 409.

### Implementation for User Story 3

- [ ] T019 [P] [US3] Create `apps/hr-core/src/modules/organization/positions/dto/create-position.dto.ts` — `CreatePositionDto` with `title` (required, 1–100) and `level` (optional, 1–50)
- [ ] T020 [P] [US3] Create `apps/hr-core/src/modules/organization/positions/dto/update-position.dto.ts` — `UpdatePositionDto` as `PartialType(CreatePositionDto)` plus optional `isActive: boolean`
- [ ] T021 [P] [US3] Create `apps/hr-core/src/modules/organization/positions/dto/position-query.dto.ts` — `PositionQueryDto` with optional `isActive: boolean`, `cursor: string`, `limit: number` (`@IsOptional() @IsInt() @Min(1) @Max(200) @Transform(({ value }) => value ?? 50)`)
- [ ] T022 [US3] Implement `apps/hr-core/src/modules/organization/positions/positions.service.ts` — `PositionsService` with: `create(dto)` (validates unique title, throws `ConflictException`), `findAll(query, roles)` (non-admin callers always receive `isActive:true` regardless of query param — enforced in the service, not the controller), `findById(id)` (throws `NotFoundException`), `update(id, dto)` (re-validates unique title if changed), `deactivate(id)` (sets `isActive:false`)
- [ ] T023 [US3] Implement `apps/hr-core/src/modules/organization/positions/positions.controller.ts` — `PositionsController` at route `'positions'` with `@UseGuards(SharedJwtGuard)` on the class; `POST @UseGuards(RbacGuard) @Roles('HR_ADMIN')`, `GET` and `GET /:id` (all authenticated — no RbacGuard beyond SharedJwtGuard), `PATCH /:id @UseGuards(RbacGuard) @Roles('HR_ADMIN')`, `DELETE /:id @UseGuards(RbacGuard) @Roles('HR_ADMIN')`; pass `@CurrentUser()` roles to `findAll` for `isActive` enforcement
- [ ] T024 [US3] Add Position seed data to `apps/hr-core/prisma/seed.ts` — create at least 5 positions (`"Software Engineer - Junior"`, `"Software Engineer - Senior"`, `"HR Generalist"`, `"Product Manager"`, `"DevOps Engineer"`) using `skipDuplicates: true`

**Checkpoint**: EMPLOYEE can list positions (200). HR Admin can create, update, and soft-deactivate. Duplicate title returns 409. Inactive positions are hidden from non-admin list responses.

---

## Phase 6: User Story 4 — Manager Views Team Composition (Priority: P4)

**Goal**: Ensure a MANAGER JWT can access only their own team's detail via `GET /api/hr/teams` and `GET /api/hr/teams/:id`, enforced by the TEAM scope filter already wired in Phase 4 (TeamsService). This phase validates and tests the scope boundary — no new files are created; it is a verification and hardening phase.

**Independent Test**: Log in as a MANAGER with `teamId: "team-abc"` in JWT. Call `GET /api/hr/teams` → response contains only the one team they lead. Call `GET /api/hr/teams/team-xyz` (a team they do not lead) → 403. Call `GET /api/hr/teams/team-abc` → full team detail with `leadVacant` resolved.

### Implementation for User Story 4

- [ ] T025 [US4] Harden MANAGER scope enforcement in `apps/hr-core/src/modules/organization/teams/teams.service.ts`: ensure `findAll()` returns an empty array (not 403) when MANAGER's `user.teamId` is null or undefined (team not yet assigned); ensure `findById()` throws `ForbiddenException` (not `NotFoundException`) when a MANAGER requests a team with an ID that does not match `user.teamId` — the distinction matters for security (do not leak whether the team exists)
- [ ] T026 [US4] Add `@HttpCode(200)` and `@ApiResponse({ status: 403, description: 'Manager accessing another team' })` Swagger annotation to `GET /api/hr/teams/:id` in `apps/hr-core/src/modules/organization/teams/teams.controller.ts` to document the MANAGER scope boundary
- [ ] T027 [US4] Add a MANAGER-role integration smoke test entry to `apps/hr-core/test/integration/teams.integration.spec.ts` — the test creates a team, generates a MANAGER JWT scoped to that team, calls `GET /teams/:id`, asserts 200; then calls `GET /teams/:other-id`, asserts 403

**Checkpoint**: A MANAGER JWT scoped to team A cannot see team B. A MANAGER with no assigned team receives an empty list (not an error).

---

## Phase 7: User Story 5 — Org Chart Read for Analytics and AI Agents (Priority: P5)

**Goal**: Single `GET /api/hr/org-chart` endpoint that returns the full active hierarchy (departments → teams → employee counts). Restricted to HR_ADMIN, EXECUTIVE, and SYSTEM role (Analytics Agent SYSTEM JWT).

**Independent Test**: As an HR Admin, call `GET /api/hr/org-chart` and receive a JSON array of departments, each with nested teams and `employeeCount`. As an EMPLOYEE or MANAGER, receive 403. As a SYSTEM JWT caller, receive 200.

### Implementation for User Story 5

- [ ] T028 [US5] Implement `apps/hr-core/src/modules/organization/org-chart/org-chart.service.ts` — `OrgChartService` with a single `getOrgChart(): Promise<OrgChartResponse>` method; query using `prisma.department.findMany({ where: { isActive: true }, include: { teams: { where: { isActive: true }, include: { _count: { select: { employees: { where: { employmentStatus: { not: 'TERMINATED' } } } } }, lead: { select: { employmentStatus: true } } } } }, orderBy: { name: 'asc' } })`; resolve `leadVacant` as `team.lead?.employmentStatus === EmploymentStatus.TERMINATED` (lead is fetched in the same query — no additional round-trip); map `_count.employees` to `employeeCount`; return typed `OrgChartDepartment[]` per `data-model.md` response shape
- [ ] T029 [US5] Implement `apps/hr-core/src/modules/organization/org-chart/org-chart.controller.ts` — `OrgChartController` at route `'org-chart'` with a single `GET /` endpoint; `@UseGuards(SharedJwtGuard, RbacGuard)` and `@Roles('HR_ADMIN', 'EXECUTIVE', 'SYSTEM')` (SYSTEM role allows Analytics Agent SYSTEM JWT); add `@ApiOperation({ summary: 'Get full organizational hierarchy' })` and `@ApiResponse` per `contracts/org-chart-api.md`
- [ ] T030 [US5] Define `OrgChartDepartment` and `OrgChartTeam` response interfaces locally in `apps/hr-core/src/modules/organization/org-chart/org-chart.types.ts` and use them as the return type of `OrgChartService.getOrgChart()` — these types are used internally by HR Core only at this stage; T034 will promote them to `@sentient/shared` for AI Agentic consumption
- [ ] T034 [US5] Add `OrgChartDepartment` and `OrgChartTeam` interfaces to `packages/shared/src/interfaces/org-chart.interface.ts` and export them from the shared package barrel (`packages/shared/src/index.ts`); update `org-chart.types.ts` in HR Core to re-export from `@sentient/shared` rather than defining locally — this is the cross-service contract boundary that allows AI Agentic's `HrCoreClient` to import a typed response shape without importing from `apps/hr-core/`

**Checkpoint**: `GET /api/hr/org-chart` with HR Admin JWT returns a hierarchical array. EMPLOYEE JWT returns 403. Response includes correct `employeeCount` and `leadVacant` flag. `OrgChartDepartment` is importable from `@sentient/shared`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, documentation, and seed validation that apply across all user stories.

- [ ] T031 [P] Add Swagger `@ApiTags('Organization — Departments')`, `@ApiTags('Organization — Teams')`, `@ApiTags('Organization — Positions')`, `@ApiTags('Organization — Org Chart')` to the respective controllers and verify all endpoints appear correctly in the Swagger UI at `http://localhost:3001/api/docs`
- [ ] T032 Add unit test stubs for the three services and OrgChartService in `apps/hr-core/src/modules/organization/departments/departments.service.spec.ts`, `teams/teams.service.spec.ts`, `positions/positions.service.spec.ts`, `org-chart/org-chart.service.spec.ts` — stub files with `describe` blocks for each public method (empty `it` blocks with descriptive names); ensures CI does not fail on missing spec files
- [ ] T033 Validate the full quickstart.md smoke test sequence manually: seed → `POST /departments` → `POST /teams` → `POST /positions` → `GET /org-chart` → confirm hierarchy is correct; document any seed ordering issues in `apps/hr-core/prisma/seed.ts` comments
- [ ] T035 [P] Create `apps/hr-core/test/integration/departments.integration.spec.ts` — cover US1 acceptance scenarios AC4 and AC5: (AC4) create a department with a duplicate `code`, assert 409 Conflict; (AC5) generate an EMPLOYEE JWT, attempt `POST /departments` and `PATCH /departments/:id`, assert 403 Forbidden on both — validates the RBAC boundary that was explicitly stated in the spec but had no automated test coverage

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on T001 (schema) and T002 (migration) completing — BLOCKS all user stories
- **Phase 3 (US1 Departments)**: Depends on Phase 2 completion
- **Phase 4 (US2 Teams)**: Depends on Phase 2 completion; US1 department seed data must exist for smoke testing team creation (T012 before T018 seed run)
- **Phase 5 (US3 Positions)**: Depends on Phase 2 completion only — fully independent of US1 and US2
- **Phase 6 (US4 Manager view)**: Depends on Phase 4 (US2) completion — validates and hardens existing TeamsService scope logic
- **Phase 7 (US5 Org chart)**: Depends on Phase 3 (US1) and Phase 4 (US2) for meaningful data — service logic itself is independent; T034 depends on T030 (local types must exist before moving to shared)
- **Phase 8 (Polish)**: Depends on all user story phases completing

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — start immediately after Phase 2
- **US2 (P2)**: Depends on Foundational; needs US1 seed data for team-creation smoke tests (not a code dependency — a data dependency)
- **US3 (P3)**: Depends on Foundational only — fully parallel with US1 and US2
- **US4 (P4)**: Depends on US2 (TeamsService must exist) — validation and hardening pass
- **US5 (P5)**: Depends on Foundational — code is independent; needs US1+US2 data for meaningful test results

### Within Each User Story

- DTOs (T007–T009, T013–T015, T019–T021) → Service → Controller → Seed
- DTOs marked [P] can be written in parallel since they are separate files with no inter-dependency

### Parallel Opportunities

- T003 and T004 can run in parallel with T001–T002 only if the directory structure doesn't depend on the migration completing (it doesn't — create dirs first)
- All three DTO tasks within each user story are [P] — three separate files with no shared state
- US1 (T007–T012), US2 (T013–T018), and US3 (T019–T024) can all proceed in parallel after Phase 2 completes (with the caveat that US2 smoke tests need US1 seed data)
- T031 and T032 in Polish are [P] — different files, different concerns

---

## Parallel Example: User Story 1 (Departments)

```
After Phase 2 completes:

Parallel batch:
  Task T007: "Create CreateDepartmentDto in .../departments/dto/create-department.dto.ts"
  Task T008: "Create UpdateDepartmentDto in .../departments/dto/update-department.dto.ts"
  Task T009: "Create DepartmentQueryDto in .../departments/dto/department-query.dto.ts"

Then sequential:
  Task T010: "Implement DepartmentsService (depends on DTOs)"
  Task T011: "Implement DepartmentsController (depends on T010)"
  Task T012: "Add Department seed data (depends on T011 — needs model in scope)"
```

## Parallel Example: US1 + US3 Simultaneously (different developers)

```
Developer A → Phase 3 (US1 Departments): T007 → T008 → T009 → T010 → T011 → T012
Developer B → Phase 5 (US3 Positions):  T019 → T020 → T021 → T022 → T023 → T024
```
Both streams are completely independent at the code level.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T006) — **CRITICAL blocker**
3. Complete Phase 3: US1 Departments (T007–T012)
4. **STOP and VALIDATE**: `POST /api/hr/departments`, `GET /api/hr/departments`, `PATCH`, `DELETE` work end-to-end with JWT
5. Department CRUD is live — MVP delivered

### Incremental Delivery

1. Setup + Foundational → NestJS module wires up (0 endpoints live yet)
2. US1 (Departments) → 5 endpoints live ✅
3. US2 (Teams) → 5 more endpoints live ✅ — team CRUD operational
4. US3 (Positions) → 5 more endpoints live ✅ — position catalog operational
5. US4 (Manager view) → RBAC hardening on existing team endpoints ✅
6. US5 (Org chart) → 1 endpoint live ✅ — Analytics Agent can now query
7. Polish → Swagger docs, test stubs, seed validation ✅

### Parallel Team Strategy (if applicable)

With multiple developers after Phase 2 completes:

- **Developer A**: Phase 3 (US1 Departments) → Phase 6 (US4 Manager hardening, after US2 done)
- **Developer B**: Phase 4 (US2 Teams) → Phase 7 (US5 Org chart)
- **Developer C**: Phase 5 (US3 Positions) → Phase 8 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [US1]–[US5] labels map directly to user story priorities in spec.md
- Each user story phase ends with a Checkpoint — validate before moving to the next story
- The `leadVacant` flag is resolved at read time in TeamsService — no scheduled job or trigger needed
- `EmploymentStatus` enum is imported from `@sentient/shared/src/enums/` — do not redefine locally
- `SharedJwtGuard` and `RbacGuard` already exist in `apps/hr-core/src/common/guards/` — import, don't recreate
- `@CurrentUser()` decorator already exists in `apps/hr-core/src/common/decorators/` — use it consistently
- Prisma `_count` on `employees` in the org-chart query requires `Employee` to have a relation back to `Team` in the schema — verify `Employee.teamId → Team` relation exists; if not, use `prisma.employee.count({ where: { teamId: team.id, employmentStatus: { not: 'TERMINATED' } } })` per team as a fallback (N+1 tradeoff acceptable for < 100 teams)
- Total task count: **36 tasks** across 8 phases (T001–T035 + T034; T034 inserted after T030 in Phase 7)
