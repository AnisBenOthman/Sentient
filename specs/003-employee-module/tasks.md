# Tasks: Employee Module

**Input**: Design documents from `/specs/003-employee-module/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Paths are relative to repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Enum synchronization and shared package update — required before Prisma migration.

- [x] T001 Add `RESIGNED` to `EmploymentStatus` enum in `packages/shared/src/enums/employment-status.enum.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prisma schema extension and migration — MUST be complete before any service or controller work begins.

**⚠️ CRITICAL**: No user story implementation can begin until T002–T005 are complete.

- [x] T002 Extend `Employee` model in `apps/hr-core/prisma/schema.prisma` — add fields: `employeeCode`, `email`, `phone`, `dateOfBirth`, `hireDate`, `contractType`, `currentSalary`, `positionId`, `managerId`, `createdAt`, `updatedAt`; add self-referencing `manager`/`directReports` relations and `position` relation
- [x] T003 Add `ContractType` Prisma enum to `apps/hr-core/prisma/schema.prisma` with values: `FULL_TIME`, `PART_TIME`, `INTERN`, `CONTRACTOR`, `FIXED_TERM`
- [x] T004 Add `SalaryHistory` model to `apps/hr-core/prisma/schema.prisma` with fields: `id`, `employeeId`, `previousSalary`, `newSalary`, `effectiveDate`, `reason`, `changedById`, `createdAt`; with `@@schema("hr_core")` and `@@map("salary_history")`
- [x] T005 Run `cd apps/hr-core && npx prisma db push && npx prisma generate` — schema pushed and client regenerated to `src/generated/prisma`

**Checkpoint**: Prisma client is generated with extended Employee and new SalaryHistory types. ✅

---

## Phase 3: User Story 1 — HR Admin Creates Employee (Priority: P1) 🎯 MVP

**Goal**: HR Admin can create a complete employee record via `POST /employees`. Auto-generates employee code if omitted. Validates referenced entities (department, team, position, manager). Enforces email uniqueness. Returns full profile.

**Independent Test**: `POST /employees` with HR_ADMIN JWT and valid body → 201 with auto-generated `employeeCode`. Repeat with same email → 409. Use EMPLOYEE JWT → 403.

### Implementation

- [x] T006 [P] [US1] Create `apps/hr-core/src/modules/employees/dto/create-employee.dto.ts` — class-validator decorators for all creation fields: `firstName`, `lastName`, `email`, `phone`, `dateOfBirth`, `hireDate`, `contractType`, `currentSalary`, `positionId`, `departmentId`, `teamId`, `managerId`, `employeeCode`
- [x] T007 [US1] Create `apps/hr-core/src/modules/employees/employees.service.ts` — `EmployeesService` class with constructor injecting `PrismaService`; implement `create(dto, actorUserId)`: validate email uniqueness (ConflictException), validate positionId/departmentId/teamId/managerId existence (NotFoundException), auto-generate `employeeCode` using `EMP-` prefix + sequential counter, persist employee, return created record
- [x] T008 [US1] Create `apps/hr-core/src/modules/employees/employees.controller.ts` — `EmployeesController` with `@Controller('employees')`, `@UseGuards(SharedJwtGuard, RbacGuard)`, `@ApiTags('Employees')`; implement `POST /` with `@Roles('HR_ADMIN')`, `@ApiOperation`, `@CurrentUser`, delegates to `employeesService.create()`
- [x] T009 [US1] Create `apps/hr-core/src/modules/employees/employees.module.ts` — `EmployeesModule` importing `PrismaModule`, declaring `EmployeesController` and `EmployeesService`
- [x] T010 [US1] Register `EmployeesModule` in `apps/hr-core/src/app.module.ts` imports array

**Checkpoint**: `POST /employees` works end-to-end. US1 fully functional. ✅

---

## Phase 4: User Story 2 — View Employee Profile (Priority: P1)

**Goal**: Users can retrieve an employee profile. RBAC scope filtering enforced: EMPLOYEE sees only own profile, MANAGER sees team-scoped profiles, HR_ADMIN/EXECUTIVE see all. Salary and DOB stripped from response for non-privileged roles.

**Independent Test**: `GET /employees/:ownId` with EMPLOYEE JWT → 200 (no salary). `GET /employees/:otherId` with EMPLOYEE JWT → 403. `GET /employees/:id` with HR_ADMIN JWT → 200 with salary. `GET /employees/:id` with MANAGER JWT for non-team member → 403.

### Implementation

- [x] T011 [US2] Add `buildScopeFilter(user: JwtPayload): Prisma.EmployeeWhereInput` private method to `apps/hr-core/src/modules/employees/employees.service.ts`
- [x] T012 [US2] Add `findById(id: string, user: JwtPayload): Promise<EmployeeProfile>` to `apps/hr-core/src/modules/employees/employees.service.ts`
- [x] T013 [US2] Add `stripSensitiveFields(employee: EmployeeProfile, roles: string[]): EmployeeProfile` private method to `apps/hr-core/src/modules/employees/employees.service.ts`
- [x] T014 [US2] Add `GET /:id` endpoint to `apps/hr-core/src/modules/employees/employees.controller.ts`

**Checkpoint**: `GET /employees/:id` fully scope-enforced. US2 fully functional. ✅

---

## Phase 5: User Story 3 — Update Employee Information (Priority: P2)

**Goal**: HR Admins update any employee field. When `currentSalary` changes, a `SalaryHistory` entry is created atomically in the same transaction. Emits `employee.updated` domain event after commit.

### Implementation

- [x] T015 [P] [US3] Create `apps/hr-core/src/modules/employees/dto/update-employee.dto.ts`
- [x] T016 [US3] Add `update(id: string, dto: UpdateEmployeeDto, actorUserId: string): Promise<EmployeeProfile>` to `apps/hr-core/src/modules/employees/employees.service.ts`
- [x] T017 [US3] Add `PATCH /:id` endpoint to `apps/hr-core/src/modules/employees/employees.controller.ts`
- [x] T018 [US3] Wire `IEventBus` — create `apps/hr-core/src/common/event-bus/in-memory-event-bus.ts` and provide in `EmployeesModule`

**Checkpoint**: Salary changes auto-create history. `employee.updated` event emits. US3 fully functional. ✅

---

## Phase 6: User Story 4 — List and Search Employees (Priority: P2)

**Goal**: Paginated, filterable, sortable employee list. Scope filtering from JWT. Partial name search. Salary/DOB stripped per role.

### Implementation

- [x] T019 [P] [US4] Create `apps/hr-core/src/modules/employees/dto/employee-query.dto.ts`
- [x] T020 [US4] Add `findAll(query: EmployeeQueryDto, user: JwtPayload): Promise<PaginatedEmployees>` to `apps/hr-core/src/modules/employees/employees.service.ts`
- [x] T021 [US4] Add `GET /` endpoint to `apps/hr-core/src/modules/employees/employees.controller.ts`

**Checkpoint**: Employee listing with filtering and scope enforcement works. US4 fully functional. ✅

---

## Phase 7: User Story 5 — Employee Lifecycle Transitions (Priority: P2)

**Goal**: HR Admins transition employment status. State machine enforced — terminal states block further transitions. Domain events emitted.

### Implementation

- [x] T022 [P] [US5] Create `apps/hr-core/src/modules/employees/dto/update-employee-status.dto.ts`
- [x] T023 [US5] Add `updateStatus(id: string, dto: UpdateEmployeeStatusDto, actorUserId: string): Promise<Employee>` to `apps/hr-core/src/modules/employees/employees.service.ts`
- [x] T024 [US5] Add `PATCH /:id/status` endpoint to `apps/hr-core/src/modules/employees/employees.controller.ts`

**Checkpoint**: Status transitions enforce state machine. Domain events emit correctly. US5 fully functional. ✅

---

## Phase 8: User Story 6 — Salary History Tracking (Priority: P3)

**Goal**: HR Admins and Executives retrieve the complete salary history for any employee, ordered by effectiveDate descending.

### Implementation

- [x] T025 [US6] Add `getSalaryHistory(employeeId: string, limit: number): Promise<SalaryHistory[]>` to `apps/hr-core/src/modules/employees/employees.service.ts`
- [x] T026 [US6] Add `GET /:id/salary-history` endpoint to `apps/hr-core/src/modules/employees/employees.controller.ts`

**Checkpoint**: Salary history retrieval role-gated and ordered. US6 fully functional. ✅

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T027 [P] Create `apps/hr-core/src/modules/employees/employees.service.spec.ts` — unit tests for scope filter, salary history, status transitions, email uniqueness, code auto-generation
- [x] T028 [P] Add `@ApiResponse` decorators to all endpoints in `apps/hr-core/src/modules/employees/employees.controller.ts`
- [x] T029 [P] Create `apps/hr-core/src/modules/employees/index.ts` barrel
- [x] T030 Run `turbo build --filter=@sentient/hr-core` — build passes ✅ (2 successful, 0 errors)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 completion — first story to implement
- **US2 (Phase 4)**: Depends on Phase 2 + US1 service exists (adds methods to same service file)
- **US3 (Phase 5)**: Depends on Phase 2 + US1 service exists
- **US4 (Phase 6)**: Depends on Phase 2 + US1 service exists
- **US5 (Phase 7)**: Depends on Phase 2 + US1 service exists + IEventBus wired (T018)
- **US6 (Phase 8)**: Depends on Phase 2 + salary history created by US3 (T016)
- **Polish (Phase 9)**: Depends on all desired stories complete

---

## Notes

- [P] tasks target different files and have no unresolved dependencies on incomplete tasks
- `buildScopeFilter` is foundational for US2, US4, and all future HR modules
- The `InMemoryEventBus` is a Phase 1 stub — Kafka replaces it in Phase 2
- Schema output path corrected to `../src/generated/prisma` to match existing import conventions
