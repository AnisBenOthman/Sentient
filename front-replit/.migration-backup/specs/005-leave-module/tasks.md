# Tasks: Leave Management Module

**Input**: Design documents from `/specs/005-leave-module/`
**Branch**: `005-leave-module`
**Service**: `apps/hr-core` (port 3001, schema `hr_core`)
**Tech stack**: NestJS 10, Prisma 5 multiSchema, TypeScript 5.x strict, class-validator, @nestjs/schedule

**Organization**: Tasks are grouped by user story. Phases 1–2 are blocking prerequisites. Phases 3–7 map to US1–US5 and can be started in priority order once Phase 2 completes. Phase 8 is polish/cross-cutting.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the module structure and shared enum before any entity or service is written.

- [X] T001 Create `apps/hr-core/src/modules/leaves/` directory tree: `leave-types/`, `holidays/`, `balances/`, `requests/`, `accrual/`, `util/`, `dto/`
- [X] T002 [P] Create `packages/shared/src/enums/half-day.enum.ts` exporting `HalfDay { MORNING, AFTERNOON }`
- [X] T003 [P] Create `packages/shared/src/enums/accrual-frequency.enum.ts` exporting `AccrualFrequency { MONTHLY, YEARLY }`
- [X] T004 Export `HalfDay` and `AccrualFrequency` from `packages/shared/src/enums/index.ts`

**Checkpoint**: Shared package builds cleanly with new enums.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prisma schema, migration, pure utilities, and DTOs MUST be done before any service is written.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Add `HalfDay`, `LeaveStatus`, `AccrualFrequency` enums and `LeaveType`, `LeaveBalance`, `LeaveRequest`, `Holiday`, `LeaveBalanceAdjustment`, `LeaveAccrualRun` models to `apps/hr-core/prisma/schema.prisma` (follow data-model.md exactly; add `leaveTypes[]`/`holidays[]` reverse relations on `BusinessUnit`; add `leaveBalances[]`/`leaveRequests[]`/`reviewedLeaves[]` on `Employee`)
- [X] T006 Run `npx prisma migrate dev --name add_leave_module` inside `apps/hr-core`; manually append `CHECK (end_date >= start_date)` constraint on `leave_requests` to the generated migration SQL; run `npx prisma generate`
- [X] T007 [P] Create `apps/hr-core/src/modules/leaves/util/bu-resolver.util.ts` — pure function `resolveEmployeeBusinessUnitId(employee)` returning `team.businessUnit.id ?? department.businessUnit.id ?? null`; cover with `bu-resolver.util.spec.ts` (team-first, dept fallback, null when neither)
- [X] T008 [P] Create `apps/hr-core/src/modules/leaves/util/business-day.util.ts` — pure function `countBusinessDays(startDate, endDate, startHalfDay, endHalfDay, holidays: Set<string>): Decimal` per R-001; cover with `business-day.util.spec.ts` (full week, half-day start, half-day end, holiday excluded, all-weekend → 0, single day full, single day half)
- [X] T009 [P] Create all DTOs in `apps/hr-core/src/modules/leaves/dto/`:
  - `create-leave-type.dto.ts` — `@IsUUID() businessUnitId`, `@IsString() name`, `@IsEnum(AccrualFrequency) @IsOptional() accrualFrequency`, `@Min(0) @Max(366) defaultDaysPerYear`, `@Min(0) maxCarryoverDays`, `@IsBoolean() requiresApproval`, `@IsOptional() @IsHexColor() color`; custom `@IsCarryoverWithinDefault()` validator
  - `update-leave-type.dto.ts` — `PartialType(CreateLeaveTypeDto)` omitting `businessUnitId` and `accrualFrequency`
  - `create-holiday.dto.ts` — `@IsUUID() businessUnitId`, `@IsString() name`, `@IsDateString() date`, `@IsBoolean() isRecurring`; custom `@IsValidHolidayYear()` enforcing `isRecurring=true → year null`
  - `update-holiday.dto.ts` — `PartialType(CreateHolidayDto)` omitting `businessUnitId`
  - `create-leave-request.dto.ts` — `@IsUUID() leaveTypeId`, `@IsDateString() startDate/endDate`, `@IsOptional() @IsEnum(HalfDay) startHalfDay/endHalfDay`, `@IsOptional() @MaxLength(500) reason`; custom `@IsValidLeaveRange()` enforcing endDate ≥ startDate and single-day half-day rules (R-007)
  - `review-leave-request.dto.ts` — `@IsOptional() @MaxLength(500) reviewNote`
  - `adjust-balance.dto.ts` — `@IsNumber() newTotalDays`, `@IsNotEmpty() @MaxLength(255) reason`
  - `leave-query.dto.ts` — `@IsOptional()` filters: `status`, `employeeId`, `leaveTypeId`, `year`
  - `patch-agent-assessment.dto.ts` — `@IsOptional() @IsObject() agentRiskAssessment`, `@IsOptional() @IsObject() agentSuggestedDates`
- [X] T010 Create `apps/hr-core/src/modules/leaves/leaves.module.ts` declaring all sub-controllers and sub-services; import into `apps/hr-core/src/app.module.ts` alongside `ScheduleModule.forRoot()`

**Checkpoint**: `pnpm --filter hr-core build` compiles with new schema + DTOs. `npx prisma studio` shows all 6 new tables.

---

## Phase 3: User Story 1 — Employee submits leave and views balance/history (Priority: P1) 🎯 MVP

**Goal**: An employee can see their remaining leave balance, submit a new leave request (with business-day counting, holiday exclusion, overlap detection, balance check), and view their own request history.

**Independent Test**: Seed one BusinessUnit, one LeaveType (ANNUAL, MONTHLY), one employee with `totalDays=15`. Call `POST /leave-requests` for Mon–Fri (no holidays) → persisted as PENDING, `pendingDays=5`, `remainingDays=10`. Call `GET /leave-balances` → returns balance with computed `remainingDays`. Call `GET /leave-requests` → returns the one request.

### Implementation for User Story 1

- [X] T011 [P] [US1] Implement `apps/hr-core/src/modules/leaves/balances/balances.service.ts`
- [X] T012 [P] [US1] Implement `apps/hr-core/src/modules/leaves/holidays/holidays.service.ts`
- [X] T013 [US1] Implement `apps/hr-core/src/modules/leaves/requests/requests.service.ts` — `create(employeeId, dto)` method
- [X] T014 [US1] Add `findByEmployee(employeeId, query: LeaveQueryDto)` to `requests.service.ts` with OWN scope filter
- [X] T015 [US1] Implement `apps/hr-core/src/modules/leaves/balances/balances.controller.ts`
- [X] T016 [US1] Implement `apps/hr-core/src/modules/leaves/requests/requests.controller.ts`
- [X] T017 [US1] Write `requests.service.spec.ts`

**Checkpoint**: `POST /leave-requests` → 201 PENDING, `pendingDays` incremented, `GET /leave-balances` shows `remainingDays` computed correctly.

---

## Phase 4: User Story 2 — Manager reviews leave requests and views team calendar (Priority: P2)

**Goal**: A manager can approve or reject PENDING leave requests from their direct reports, and view an approved-leave calendar for their team over a date range.

### Implementation for User Story 2

- [X] T018 [US2] Add `approve(id, dto, reviewerId)` to `requests.service.ts`
- [X] T019 [US2] Add `reject(id, dto, reviewerId)` to `requests.service.ts`
- [X] T020 [US2] Add `teamCalendar(managerId, from, to, departmentId?, teamId?)` to `requests.service.ts`
- [X] T021 [US2] Add `POST /leave-requests/:id/approve` and `POST /leave-requests/:id/reject` to `requests.controller.ts`
- [X] T022 [US2] Create team calendar endpoint under `GET /leave-requests/team-calendar`

**Checkpoint**: Full approve/reject flow works; team calendar returns color-coded entries with no `reason` field.

---

## Phase 5: User Story 3 — HR Admin configures leave types, holidays, and balance credits (Priority: P3)

**Goal**: HR_ADMIN can create and update leave types (per BusinessUnit, with configurable accrual frequency and carryover cap), manage the BU-scoped holiday calendar, and manually adjust any employee's leave balance with an audit record.

### Implementation for User Story 3

- [X] T023 [P] [US3] Implement `apps/hr-core/src/modules/leaves/leave-types/leave-types.service.ts`
- [X] T024 [P] [US3] Implement `apps/hr-core/src/modules/leaves/holidays/holidays.service.ts` full CRUD
- [X] T025 [US3] Add `adjust(balanceId, dto, adjustedBy)` to `balances.service.ts`
- [X] T026 [US3] Add `findAdjustments(balanceId)` to `balances.service.ts`
- [X] T027 [US3] Implement `apps/hr-core/src/modules/leaves/leave-types/leave-types.controller.ts`
- [X] T028 [US3] Implement `apps/hr-core/src/modules/leaves/holidays/holidays.controller.ts`
- [X] T029 [US3] Add `POST /leave-balances/:id/adjust` and `GET /leave-balances/:id/adjustments` to `balances.controller.ts`

**Checkpoint**: Full HR_ADMIN CRUD for leave types and holidays; balance manual adjust writes audit row and returns `remainingDays`.

---

## Phase 6: User Story 4 — Monthly accrual and year-end carryover (Priority: P4)

**Goal**: The system automatically accrues leave balances on the 1st of every month.

### Implementation for User Story 4

- [X] T030 [US4] Implement `apps/hr-core/src/modules/leaves/accrual/accrual.service.ts`
- [X] T031 [US4] Add `POST /leave-balances/accrual/trigger` to `balances.controller.ts`
- [X] T032 [US4] Write `accrual.service.spec.ts`

**Checkpoint**: Cron registered (logs on service start). Trigger endpoint returns 202 on first call, 409 on repeat.

---

## Phase 7: User Story 5 — Employee cancels a PENDING leave request (Priority: P5)

**Goal**: An employee can cancel their own PENDING leave request. The `pendingDays` on the balance are restored.

### Implementation for User Story 5

- [X] T033 [US5] Add `cancel(id, ownerId)` to `requests.service.ts`
- [X] T034 [US5] Add `POST /leave-requests/:id/cancel` to `requests.controller.ts`

**Checkpoint**: Cancel flow works. Non-owner gets 403. Non-PENDING gets 409. Balance `pendingDays` is restored.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Agent hand-off endpoint, domain events, seed data, Swagger verification.

- [X] T035 [P] Add `patchAgentAssessment(id, dto)` to `requests.service.ts` + `PATCH /leave-requests/:id/agent-assessment`
- [X] T036 [P] Wire `IEventBus.emit()` calls for all four domain events (`leave.requested`, `leave.approved`, `leave.rejected`, `leave.cancelled`)
- [X] T037 Extend `apps/hr-core/prisma/seed.ts`: upsert 5 leave types + 8 holidays per BusinessUnit
- [X] T038 Write integration test `apps/hr-core/test/integration/leaves.integration.spec.ts`
- [ ] T039 Run `turbo dev --filter=hr-core`, open Swagger at `http://localhost:3001/api/docs`, confirm all 18 endpoints render under the "Leave Management" tag with correct request/response schemas and error codes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3–7 (User Stories)**: All depend on Phase 2; proceed in priority order (P1 → P2 → P3 → P4 → P5) or in parallel if capacity allows
- **Phase 8 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Depends on | Can run after |
|-------|-----------|--------------|
| US1 (P1) — Submit + Balance | Phase 2 only | Phase 2 |
| US2 (P2) — Review + Calendar | US1 (uses `requests.service`) | US1 |
| US3 (P3) — HR Config | Phase 2 only | Phase 2 (parallel with US1) |
| US4 (P4) — Accrual | US3 (needs leave types seeded) | US3 |
| US5 (P5) — Cancel | US1 (extends `requests.service`) | US1 |

### Within Each Phase

- DTOs before services; services before controllers
- `bu-resolver.util` and `business-day.util` (T007, T008) must pass tests before `requests.service.create` (T013)
- `holidays.service.listForBusinessUnit` (T012) must exist before `requests.service.create` (T013)

### Parallel Opportunities

Phase 2: T007, T008, T009 can run in parallel (different files)
Phase 3: T011, T012 can run in parallel; T013 needs both
Phase 5: T023, T024 can run in parallel
Phase 8: T035, T036 can run in parallel

---

## Task Count Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| Phase 1 Setup | 4 (T001–T004) | — |
| Phase 2 Foundational | 6 (T005–T010) | — |
| Phase 3 US1 Submit+Balance | 7 (T011–T017) | P1 |
| Phase 4 US2 Review+Calendar | 5 (T018–T022) | P2 |
| Phase 5 US3 HR Config | 7 (T023–T029) | P3 |
| Phase 6 US4 Accrual | 3 (T030–T032) | P4 |
| Phase 7 US5 Cancel | 2 (T033–T034) | P5 |
| Phase 8 Polish | 5 (T035–T039) | — |
| **Total** | **39 tasks** | |

**Parallel opportunities identified**: 8 task groups
**MVP scope**: Phases 1–3 (17 tasks, US1 fully functional)
