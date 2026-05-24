---
description: "Task list for 011-okr-module — OKR (Objectives & Key Results) module"
---

# Tasks: OKR (Objectives & Key Results) Module

**Input**: Design documents from `/specs/011-okr-module/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md, contracts/event-subscriptions.md, contracts/career-agent-tools.md, quickstart.md

**Tests**: Tests are included sparingly — one focused unit-test task per pure-function utility (`kr-score.util.ts`, `okr-rbac.util.ts`, `okr.rules.ts`), one integration test per P1 user story (cycle lifecycle, check-in approval loop, personal-OKR auto-approval), and one rollback-safety integration test for FR-035. The project's `.claude/rules/testing.md` informs this; broad E2E is out of scope.

**Organization**: Tasks are grouped by user story. Phases 1 and 2 are shared infrastructure; Phases 3–6 deliver US1, US2, US3, US4 independently; Phase 7 adds Career Agent tools, the reminder cron, and project bookkeeping.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no incomplete-task dependencies — safe to run in parallel.
- **[Story]**: US1 / US2 / US3 / US4 maps to the user stories in [spec.md](./spec.md).
- File paths are absolute project paths (relative to repo root `C:\Users\Anis\Downloads\Sentient\`).

## Path Conventions

- Backend (HR Core): `apps/hr-core/src/modules/okrs/`
- Notifications routing rule: `apps/hr-core/src/modules/notifications/events/routing-rules/okr.rules.ts`
- Shared types: `packages/shared/src/enums/`
- Frontend pages: `apps/web/src/pages/`
- Frontend components: `apps/web/src/components/okrs/`
- Frontend API client: `apps/web/src/lib/api/hr-core.ts` (extended; no new file)
- AI Agentic tools: `apps/ai-agentic/src/tools/okr-tools/`
- Migrations: `apps/hr-core/prisma/migrations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ship the seven new shared enums and extend `NotificationCategory` so HR Core, AI Agentic, and the frontend can import them.

- [X] T001 [P] Add `OkrCycleType` enum at `packages/shared/src/enums/okr-cycle-type.enum.ts` (values: `ANNUAL`, `QUARTERLY`) per [data-model.md §1](./data-model.md)
- [X] T002 [P] Add `OkrCycleStatus` enum at `packages/shared/src/enums/okr-cycle-status.enum.ts` (values: `DRAFT`, `ACTIVE`, `CLOSED`)
- [X] T003 [P] Add `ObjectiveLevel` enum at `packages/shared/src/enums/objective-level.enum.ts` (values: `COMPANY`, `DEPARTMENT`, `EMPLOYEE`)
- [X] T004 [P] Add `ObjectiveStatus` enum at `packages/shared/src/enums/objective-status.enum.ts` (values: `DRAFT`, `ACTIVE`, `CLOSED`, `CANCELLED`)
- [X] T005 [P] Add `KeyResultMetricType` enum at `packages/shared/src/enums/key-result-metric-type.enum.ts` (values: `PERCENTAGE`, `NUMBER`, `CURRENCY`, `BOOLEAN`)
- [X] T006 [P] Add `KeyResultStatus` enum at `packages/shared/src/enums/key-result-status.enum.ts` (values: `ON_TRACK`, `AT_RISK`, `BEHIND`, `ACHIEVED`, `CANCELLED`)
- [X] T007 [P] Add `OkrCheckInStatus` enum at `packages/shared/src/enums/okr-check-in-status.enum.ts` (values: `PENDING`, `APPROVED`, `REJECTED`)
- [X] T008 Append the seven new exports to `packages/shared/src/enums/index.ts` (alphabetical order beside the existing entries)
- [X] T009 Add `OKR` value to the existing `NotificationCategory` enum at `packages/shared/src/enums/notification-category.enum.ts` (research R5; after `EXIT_SURVEY`, before `SYSTEM`)
- [X] T010 Build `@sentient/shared` so the new enums are emitted to `packages/shared/dist/`: run `pnpm --filter @sentient/shared build` and verify `dist/enums/okr-cycle-type.enum.js` and the updated `dist/enums/notification-category.enum.js` exist

**Checkpoint**: New enums are importable from `@sentient/shared` by HR Core, AI Agentic, and the React app.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, module wiring, DTOs, scoring utility, and RBAC predicate — everything every user story depends on. NO user-story behaviour is implemented here.

**⚠️ CRITICAL**: No work in Phases 3–6 may begin until this phase is green.

### Database

- [X] T011 Add the seven Prisma enums and the five models (`OkrCycle`, `Objective`, `KeyResult`, `OkrCheckIn`, `KeyResultStatusHistory`) to `apps/hr-core/prisma/schema.prisma` exactly as specified in [data-model.md §2](./data-model.md), including all twelve indexes and the back-relations on `User` and `Department`. Audit columns required (FR-034): `OkrCycle.{activatedAt, activatedById, closedAt, closedById, createdById}`; `Objective.{activatedAt, activatedById, closedById, cancelledById}` (in addition to existing `createdById/closedAt/cancelledAt`)
- [X] T012 Append the ten back-relations to the existing `User` model in `apps/hr-core/prisma/schema.prisma` (full list in [data-model.md §2](./data-model.md)): `ownedObjectives`, `createdObjectives`, `activatedObjectives`, `closedObjectives`, `cancelledObjectives`, `createdOkrCycles`, `activatedOkrCycles`, `closedOkrCycles`, `reviewedOkrCheckIns`, `changedKeyResultStatuses`
- [X] T013 Append the back-relation to the existing `Department` model: `objectives Objective[] @relation("DepartmentObjectives")`
- [X] T014 Run `cd apps/hr-core && npx prisma migrate dev --name add_okrs` to generate `apps/hr-core/prisma/migrations/<timestamp>_add_okrs/migration.sql`
- [X] T015 Manually append the **seven** CHECK constraints (`ck_kr_score_range`, `ck_checkin_score_range`, `ck_kr_current_value_nonneg`, `ck_kr_target_positive`, `ck_cycle_quarter_range`, `ck_cycle_parent_type`, `ck_objective_level_invariants`) AND the `ALTER TYPE "hr_core"."notification_category" ADD VALUE 'OKR'` statement (must be the last line in the file — Postgres `ADD VALUE` cannot run inside a transaction) at the bottom of the generated `migration.sql` per [data-model.md §2](./data-model.md), then re-run `npx prisma migrate dev` to apply
- [X] T016 Run `cd apps/hr-core && npx prisma generate` to refresh the generated Prisma client at `apps/hr-core/src/generated/prisma`

### Pure utilities

- [X] T017 [P] Create `apps/hr-core/src/modules/okrs/util/kr-score.util.ts` exporting `computeScore(metricType, currentValue, targetValue): Decimal` per [research.md R2](./research.md) — handles all four `KeyResultMetricType` values, clamps to `[0, 1]`
- [X] T018 [P] Unit test `apps/hr-core/src/modules/okrs/util/kr-score.util.spec.ts` — assert all four metric types (PERCENTAGE clamp to 1.0, NUMBER linear, CURRENCY linear, BOOLEAN binary), zero/negative targets return 0, currentValue > targetValue clamps to 1.0
- [X] T019 [P] Create `apps/hr-core/src/modules/okrs/util/okr-rbac.util.ts` exporting `canCreateObjective(roles, level, body, user)`, `canEditObjective(...)`, `canApproveCheckIn(roles, departmentId, userDepartmentId)` per [spec.md RBAC matrix](./spec.md) and [data-model.md §6](./data-model.md)
- [X] T020 [P] Unit test `apps/hr-core/src/modules/okrs/util/okr-rbac.util.spec.ts` — assert every cell of the RBAC matrix (EMPLOYEE blocked from COMPANY/DEPARTMENT creation; MANAGER blocked from cross-department; HR_ADMIN unrestricted; EXECUTIVE limited to read+COMPANY-create + AI-tool read)
- [X] T020a [P] Create `apps/hr-core/src/modules/okrs/util/kr-status-history.util.ts` exporting `appendKrStatusHistory(tx, { keyResultId, fromStatus, toStatus, changedById, reason }): Promise<void>` — a single `tx.keyResultStatusHistory.create(...)` wrapper accepting a `Prisma.TransactionClient` so callers can persist the audit row inside the same transaction as the status change (FR-034). `changedById = null` signals a system-induced change (cascade cancel, score auto-flip to ACHIEVED)
- [X] T020b [P] Unit test `apps/hr-core/src/modules/okrs/util/kr-status-history.util.spec.ts` — mock the transaction client; assert `create` is called with the right payload including null `changedById` for system changes

### DTOs — cycles

- [X] T021 [P] Create `apps/hr-core/src/modules/okrs/dto/cycles/create-okr-cycle.dto.ts` per [contracts/rest-api.md §1](./contracts/rest-api.md), importing `OkrCycleType` from `@sentient/shared`
- [X] T022 [P] Create `apps/hr-core/src/modules/okrs/dto/cycles/okr-cycle-query.dto.ts` with optional `type`, `year`, `status`, `parentCycleId`, `cursor`, `limit`

### DTOs — objectives

- [X] T023 [P] Create `apps/hr-core/src/modules/okrs/dto/objectives/create-objective.dto.ts` with class-validator decorators per the level-dependent rules in [contracts/rest-api.md §2](./contracts/rest-api.md)
- [X] T024 [P] Create `apps/hr-core/src/modules/okrs/dto/objectives/update-objective.dto.ts` with optional `title`, `description`, `status`
- [X] T025 [P] Create `apps/hr-core/src/modules/okrs/dto/objectives/objective-query.dto.ts` with `cycleId`, `level`, `departmentId`, `ownerId`, `status`, `cursor`, `limit`

### DTOs — key results

- [X] T026 [P] Create `apps/hr-core/src/modules/okrs/dto/key-results/create-key-result.dto.ts` per [contracts/rest-api.md §3](./contracts/rest-api.md), validating `targetValue` as decimal string with `@IsDecimal({ decimal_digits: '0,4' })`
- [X] T027 [P] Create `apps/hr-core/src/modules/okrs/dto/key-results/update-key-result.dto.ts` with optional `title`, `targetValue`, `assigneeIds`, `dueDate`, `status`

### DTOs — check-ins

- [X] T028 [P] Create `apps/hr-core/src/modules/okrs/dto/check-ins/submit-check-in.dto.ts` with `keyResultId`, `value` (decimal string), optional `comment` — explicitly excludes `score` (computed server-side per [contracts/rest-api.md §4](./contracts/rest-api.md))
- [X] T029 [P] Create `apps/hr-core/src/modules/okrs/dto/check-ins/reject-check-in.dto.ts` with required `reason` (1..2000 chars)

### Response DTOs

- [X] T030 [P] Create `apps/hr-core/src/modules/okrs/dto/response/okr-cycle-response.dto.ts` per [contracts/rest-api.md DTOs](./contracts/rest-api.md) with `@ApiProperty` decorators
- [X] T031 [P] Create `apps/hr-core/src/modules/okrs/dto/response/objective-response.dto.ts` with all 13 fields
- [X] T032 [P] Create `apps/hr-core/src/modules/okrs/dto/response/key-result-response.dto.ts` including the computed `isAtRisk: boolean` field
- [X] T033 [P] Create `apps/hr-core/src/modules/okrs/dto/response/okr-check-in-response.dto.ts`

### Module skeleton

- [X] T034 Create `apps/hr-core/src/modules/okrs/cycles/okr-cycles.service.ts` skeleton: constructor injects `PrismaService` and `EVENT_BUS`; expose method stubs `create(dto, user)`, `list(query, user)`, `findOne(id, user)`, `activate(id, user)`, `close(id, user)` — bodies implemented in story phases
- [X] T035 Create `apps/hr-core/src/modules/okrs/cycles/okr-cycles.controller.ts` skeleton with `@Controller('hr/okr-cycles')`, `@UseGuards(SharedJwtGuard, RbacGuard)`, Swagger `@ApiTags('OKR Cycles')`; declare empty handlers for the four REST endpoints returning `null` for now
- [X] T036 Create `apps/hr-core/src/modules/okrs/objectives/objectives.service.ts` skeleton with stubs `create`, `list`, `findOneWithKrsAndAlignment`, `update`, `softDelete`
- [X] T037 Create `apps/hr-core/src/modules/okrs/objectives/objectives.controller.ts` skeleton at `@Controller('hr/objectives')`
- [X] T038 Create `apps/hr-core/src/modules/okrs/key-results/key-results.service.ts` skeleton with stubs `create`, `update`, `listByObjective`
- [X] T039 Create `apps/hr-core/src/modules/okrs/key-results/key-results.controller.ts` skeleton at `@Controller('hr/key-results')`
- [X] T040 Create `apps/hr-core/src/modules/okrs/check-ins/okr-check-ins.service.ts` skeleton with stubs `submit`, `listByKeyResult`, `approve`, `reject`
- [X] T041 Create `apps/hr-core/src/modules/okrs/check-ins/okr-check-ins.controller.ts` skeleton at `@Controller('hr/okr-check-ins')`
- [X] T042 Create `apps/hr-core/src/modules/okrs/analytics/okr-analytics.service.ts` skeleton with stubs `getCycleSummary(cycleId, user)`, `getEmployeePortfolio(employeeId, cycleId, user)`
- [X] T043 Create `apps/hr-core/src/modules/okrs/analytics/okr-analytics.controller.ts` skeleton at `@Controller('hr/okr-analytics')`
- [X] T044 Create `apps/hr-core/src/modules/okrs/okrs.module.ts` wiring `controllers: [OkrCyclesController, ObjectivesController, KeyResultsController, OkrCheckInsController, OkrAnalyticsController]`, `providers: [OkrCyclesService, ObjectivesService, KeyResultsService, OkrCheckInsService, OkrAnalyticsService, { provide: EVENT_BUS, useExisting: EVENT_BUS }]`, `imports: [PrismaModule]`, `exports: [OkrCheckInsService]` (exported for the bridge to query in routing rules)
- [X] T045 Register `OkrsModule` in `apps/hr-core/src/app.module.ts` `imports` array (alphabetical with other domain modules)

**Checkpoint**: HR Core compiles, boots, exposes `/api/hr/okr-cycles`, `/api/hr/objectives`, `/api/hr/key-results`, `/api/hr/okr-check-ins`, `/api/hr/okr-analytics` with 200 OK on `list` endpoints returning empty pages. Foundation is ready.

---

## Phase 3: User Story 1 — HR Admin Runs Strategic Cycles End-to-End (Priority: P1) 🎯 MVP

**Goal**: HR Admin creates an annual cycle, the quarterly children, activates a cycle (which emits `okr.cycle_activated` and broadcasts a notification to every active employee), and creates company-level Objectives inside an active cycle. The cycle list UI shows everything with parent-link pills (FR-001 to FR-005, FR-006).

**Independent Test**: Sign in as HR_ADMIN, create `FY 2026` (ANNUAL), then `Q1 2026` (QUARTERLY, parent = FY 2026); activate Q1 2026 and verify (a) status flips DRAFT → ACTIVE, (b) every other test user's bell shows +1 with the cycle-activated notification, (c) creating two company Objectives in Q1 2026 persists them with `level=COMPANY`, `parentObjectiveId=null`. Close Q1 2026 and verify status flips to CLOSED.

### Backend — cycle service implementation

- [X] T046 [US1] Implement `OkrCyclesService.create(dto, user)` in `apps/hr-core/src/modules/okrs/cycles/okr-cycles.service.ts`: validate `name` uniqueness (throws `BadRequestException('CycleNameTaken')`), validate `quarter` rules (throws `InvalidQuarter`), validate `parentCycleId.type === 'ANNUAL'` when set (throws `ParentMustBeAnnual`), validate `endDate > startDate` (throws `EndBeforeStart`), insert via `prisma.okrCycle.create` setting `createdById = user.sub` (FR-034 audit)
- [X] T047 [US1] Implement `OkrCyclesService.list(query, user)` with cursor pagination (base64url JSON `{ createdAt, id }`); filter by `type`, `year`, `status`, `parentCycleId`; ORDER BY `created_at DESC, id DESC`
- [X] T048 [US1] Implement `OkrCyclesService.activate(id, user)`: load cycle, throw `BadRequestException('CycleNotDraft')` if status != DRAFT, throw `EndDateInPast` if `endDate < today`, update inside transaction (`prisma.$transaction`) setting `status='ACTIVE'`, `activatedAt=now()`, `activatedById=user.sub` (FR-034). **After commit** emit `okr.cycle_activated` on `EVENT_BUS` with payload `{ cycleId, cycleName, type, startDate, endDate }` per [contracts/event-subscriptions.md](./contracts/event-subscriptions.md)
- [X] T049 [US1] Implement `OkrCyclesService.close(id, user)`: inside `prisma.$transaction`, (a) cascade-update all `ACTIVE` Objectives in the cycle to `CLOSED` (set `closedAt=now()`, `closedById=user.sub`) and capture their ids and final scores, (b) cascade-cancel any KRs whose Objective was just closed via `appendKrStatusHistory(tx, ..., changedById=null)` per FR-034 (no — re-check: closing the Objective does NOT cascade-cancel KRs; that happens only on Objective CANCEL. Skip this sub-step for close path), (c) auto-reject all `PENDING` check-ins in the cycle (set `status='REJECTED'`, `rejectionReason='Cycle closed before review'`, `reviewedAt=now()`, `reviewedById=null` — explicit null per FR-021), (d) update the cycle to `status='CLOSED'`, `closedAt=now()`, `closedById=user.sub` (FR-034); **after commit** emit one `okr.objective_closed` per Objective transitioned. **Do NOT emit `okr.checkin_rejected`** for the cascade-rejected check-ins (FR-021 explicit decision — see [event-subscriptions.md `okr.checkin_rejected`](./contracts/event-subscriptions.md))

### Backend — cycle controller

- [X] T050 [US1] Implement `POST /api/hr/okr-cycles` in `apps/hr-core/src/modules/okrs/cycles/okr-cycles.controller.ts` with `@Roles('HR_ADMIN')`, Swagger `@ApiOperation`/`@ApiResponse(201, OkrCycleResponseDto)`, body `CreateOkrCycleDto`, returns the created cycle
- [X] T051 [US1] Implement `GET /api/hr/okr-cycles` with `@Roles('EMPLOYEE','MANAGER','HR_ADMIN','EXECUTIVE')` (any authenticated user), Swagger pagination response
- [X] T052 [US1] Implement `PATCH /api/hr/okr-cycles/:id/activate` with `@Roles('HR_ADMIN')`, returns updated `OkrCycleResponseDto`
- [X] T053 [US1] Implement `PATCH /api/hr/okr-cycles/:id/close` with `@Roles('HR_ADMIN')`, returns updated `OkrCycleResponseDto`

### Backend — Objective service (COMPANY-level subset for US1)

- [X] T054 [US1] Implement `ObjectivesService.create(dto, user)` in `apps/hr-core/src/modules/okrs/objectives/objectives.service.ts` — full level-aware validation per FR-006/FR-007/FR-008/FR-009 (US1 only exercises the COMPANY path; US2/US3 exercise DEPARTMENT/EMPLOYEE). Use `okr-rbac.util.ts` for role checks. Throw `CycleNotActive`, `ParentNotFound`, `ParentWrongLevel`, `ParentNotActive`, `CrossDepartmentAlignment`, `LevelMismatch` as appropriate. Default `status='DRAFT'`, `createdById=user.sub`. For `EMPLOYEE` level, denormalise `departmentId` from `Employee.departmentId` at creation time per R12. **After commit**, when `level === 'EMPLOYEE'` only, emit `okr.objective_created` on `EVENT_BUS`
- [X] T055 [US1] Implement `ObjectivesService.list(query, user)` applying the scope filter from [data-model.md §6](./data-model.md) (`scopeForObjectiveList(user)` returns a `Prisma.ObjectiveWhereInput` merged with query filters), cursor pagination, default excludes `CANCELLED`
- [X] T056 [US1] Implement `ObjectivesService.findOneWithKrsAndAlignment(id, user)` — single Prisma query with `include: { keyResults: true, parentObjective: true, childObjectives: { select: { id, title, level, ownerId } } }`; throws `NotFoundException` (intentionally ambiguous when outside scope per contract)

### Backend — Objective controller (the bits needed by US1)

- [X] T057 [US1] Implement `POST /api/hr/objectives` in `apps/hr-core/src/modules/okrs/objectives/objectives.controller.ts` — RBAC delegated entirely to `ObjectivesService.create` via `okr-rbac.util.ts`. Top-level `@Roles('EMPLOYEE','MANAGER','HR_ADMIN','EXECUTIVE')` (allow all; service refines)
- [X] T058 [US1] Implement `GET /api/hr/objectives` — same RBAC
- [X] T059 [US1] Implement `GET /api/hr/objectives/:id` — same RBAC; returns `ObjectiveDetailResponseDto` shape

### Backend — notification routing rule for cycle activation

- [X] T060 [US1] Create `apps/hr-core/src/modules/notifications/events/routing-rules/okr.rules.ts` with `onCycleActivated`: queries `prisma.user.findMany({ where: { status: 'ACTIVE' } })` and returns one `NotificationDraft` per user with `category: 'OKR'`, `eventType: 'INFO'`, `referenceType: 'okr_cycle'`, `referenceId: payload.cycleId`, `actorUserId: null` (system-emitted), title/body per [contracts/event-subscriptions.md "Title and body templates"](./contracts/event-subscriptions.md). Add stub exports for the other four rules (`onCheckInSubmitted`, `onCheckInApproved`, `onCheckInRejected`, `onReminderDue`) — bodies implemented in later phases
- [X] T061 [US1] Add `(OKR, INFO)` template entry to the existing `apps/hr-core/src/modules/notifications/notifications.renderers.ts` with the cycle-activated title/body per the contract
- [X] T062 [US1] Register `okr.cycle_activated` event-type → `okr.rules.ts → onCycleActivated` mapping in `apps/hr-core/src/modules/notifications/events/notifications-events.bridge.ts` (add to the existing rule map)

### Backend — tests for US1

- [ ] T063 [US1] Integration test `apps/hr-core/test/integration/okrs-cycle-lifecycle.integration.spec.ts`: create FY 2026 + Q1 2026 + activate; assert (a) `OkrCycle` row count and statuses, (b) on activate: `activatedAt` and `activatedById` are populated (FR-034), (c) `okr.cycle_activated` event was published (spy on EVENT_BUS), (d) a notification row exists for every active user with `category='OKR'`, `eventType='INFO'`, `referenceType='okr_cycle'`. Then close the cycle and assert all in-cycle Objectives transitioned to `CLOSED` with `closedAt`+`closedById` set, the cycle row itself has `closedAt`+`closedById` set, any in-flight `PENDING` check-ins are now `REJECTED` with `reviewedById=null` and system reason, AND **no `okr.checkin_rejected` events were emitted for the cascade rejections** (FR-021 explicit decision)

### Frontend — cycle management page

- [X] T064 [P] [US1] Add typed Axios functions `getOkrCycles(params)`, `createOkrCycle(body)`, `activateCycle(id)`, `closeCycle(id)` to `apps/web/src/lib/api/hr-core.ts` returning `OkrCycleResponse` interface mirroring the DTO (define the interface in the same file)
- [X] T065 [P] [US1] Add typed functions `getObjectives(params)`, `getObjective(id)`, `createObjective(body)`, `updateObjective(id, body)`, `softDeleteObjective(id)` to `apps/web/src/lib/api/hr-core.ts`
- [X] T066 [P] [US1] Create `apps/web/src/components/okrs/cycle-selector.tsx`: shadcn `Select` listing cycles filtered by `status='ACTIVE'`; props `{ value, onChange, cycles }`; default selection per [research.md R11](./research.md)
- [X] T067 [P] [US1] Create `apps/web/src/components/okrs/objective-form.tsx`: shadcn `Dialog` with form (React Hook Form + Zod) — level-aware fields shown/hidden based on selection (COMPANY: title+description only; DEPARTMENT: +parent +department; EMPLOYEE: +parent +owner). Uses `TanStack Query` to fetch parent candidates. **Frontend `onError` mapping** (per `.claude/rules/frontend-backend-coherence.md` §3 — every backend code MUST map): `CycleNotActive` → "Cannot create an OKR in a closed or draft cycle.", `ParentNotFound` → "Parent OKR no longer exists.", `ParentWrongLevel` → "Parent OKR is not at the expected level.", `ParentNotActive` → "Cannot align to a closed or cancelled parent OKR.", `CrossDepartmentAlignment` → "Employee OKRs must align to your own department's OKRs.", `LevelMismatch` → "Invalid OKR level configuration."
- [X] T068 [US1] Create `apps/web/src/pages/okr-cycle-management.tsx`: TanStack Query for `getOkrCycles()`; shadcn `Table` of cycles with `name`, `type`, `status`, parent-link pill, action buttons (Activate / Close); "Create cycle" button opens a `CreateCycleDialog`; "Create Objective" button opens `<ObjectiveForm initialLevel="COMPANY">` scoped to the selected cycle. Frontend `onError` handler maps `CycleNameTaken`, `InvalidQuarter`, `ParentMustBeAnnual`, `EndBeforeStart`, `CycleNotDraft`, `EndDateInPast` per [contracts/rest-api.md](./contracts/rest-api.md)
- [X] T069 [US1] Register the new route in `apps/web/src/App.tsx`: `<Route path="/okr-cycle-management"><ProtectedRoute><Layout><OkrCycleManagement /></Layout></ProtectedRoute></Route>` and add "OKR Cycles" link in `apps/web/src/components/layout.tsx` sidebar visible only to HR_ADMIN

**Checkpoint**: US1 is shippable. HR Admins can create + activate + close cycles. Activating Q1 2026 broadcasts the in-app notification to every active employee. Company-level Objectives can be created and listed.

---

## Phase 4: User Story 2 — Manager Cascades Strategy + Reviews Check-ins (Priority: P1)

**Goal**: Managers create department-level Objectives aligned to company Objectives, add Key Results with assignees, and approve/reject check-ins logged by their team. Cross-department alignment is rejected. Check-in approval updates the KR's `currentValue` and `score`; rejection routes a notification with the reason verbatim. (FR-007, FR-009, FR-011 to FR-014, FR-017 to FR-020, FR-023 to FR-025)

**Independent Test**: Sign in as a Manager during the active Q1 2026 cycle (US1 must have shipped). Create a DEPARTMENT Objective aligned to a company Objective; add a KR with two assignees; have one assignee submit a check-in via `POST /api/hr/okr-check-ins`; confirm the Manager receives an `ACTION_REQUIRED` notification; approve via `PATCH /:id/approve` and confirm (a) KR `currentValue` + `score` update, (b) submitter receives an `INFO` notification, (c) the `okr.checkin_approved` event was emitted. Repeat with rejection + reason and confirm the reason appears in the submitter's notification body verbatim.

### Backend — Objective service (DEPARTMENT level)

- [X] T070 [US2] Extend `ObjectivesService.create` (already created in T054) to handle the DEPARTMENT path: enforce `parentObjectiveId.level === 'COMPANY'` AND `parentObjective.status === 'ACTIVE'` AND parent is in the same cycle OR the parent annual cycle (when `body.cycleId.parentCycleId === parentObjective.cycleId`). Verify the level-invariant CHECK is satisfied (parent + department non-null, owner null). MANAGER role: `body.departmentId === user.departmentId`; HR_ADMIN: any department
- [X] T071 [US2] Implement `ObjectivesService.update(id, dto, user)` per [contracts/rest-api.md §2 PATCH](./contracts/rest-api.md): RBAC via `okr-rbac.util.ts`; validate status transition per [data-model.md §4](./data-model.md); when transitioning DRAFT → ACTIVE set `activatedAt=now()`, `activatedById=user.sub`; when transitioning to `CLOSED` set `closedAt=now()`, `closedById=user.sub` and **after commit** emit `okr.objective_closed` with `finalScore` = `AVG(score)` of the Objective's KRs (FR-034 audit)
- [X] T072 [US2] Implement `ObjectivesService.softDelete(id, user)` — inside `prisma.$transaction`, set Objective status to `CANCELLED` + `cancelledAt=now()`, `cancelledById=user.sub` (FR-034); cascade-update all KRs to `status='CANCELLED'` AND for each KR call `appendKrStatusHistory(tx, { keyResultId, fromStatus: prev, toStatus: 'CANCELLED', changedById: null, reason: 'Objective cancelled' })` (FR-034 system-induced change with null actor); auto-reject all `PENDING` check-ins on those KRs (set `reviewedById=null`, `rejectionReason='Objective cancelled'`)
- [X] T073 [US2] Implement `PATCH /api/hr/objectives/:id` in the controller; map all `BadRequestException` codes
- [X] T074 [US2] Implement `DELETE /api/hr/objectives/:id` in the controller returning `204 No Content`

### Backend — Key Result service

- [X] T075 [US2] Implement `KeyResultsService.create(dto, user)`: verify parent Objective is `ACTIVE` (throws `ObjectiveNotActive`); validate `metricType + targetValue` invariants (throws `BooleanTargetMustBeOne`, `TargetMustBePositive`); verify each `assigneeId` exists and is an active Employee (throws `AssigneeNotFound`); insert with `currentValue=0`, `score=0`, `status='ON_TRACK'`
- [X] T076 [US2] Implement `KeyResultsService.update(id, dto, user)` inside `prisma.$transaction`: RBAC mirrors parent Objective's edit permission; when `targetValue` changes, recompute `score` for the existing `currentValue` via `kr-score.util.ts`; **when `status` changes** (any transition), call `appendKrStatusHistory(tx, { keyResultId, fromStatus, toStatus, changedById: user.sub, reason: dto.statusReason ?? null })` so the audit row is committed atomically with the status change (FR-034). When `status` is explicitly set to `ACHIEVED`, no event is emitted (descriptive status)
- [X] T077 [US2] Implement `KeyResultsService.listByObjective(objectiveId, user)`: read-access via the parent Objective's scope filter
- [X] T078 [US2] Implement `POST /api/hr/key-results` in `apps/hr-core/src/modules/okrs/key-results/key-results.controller.ts`
- [X] T079 [US2] Implement `PATCH /api/hr/key-results/:id` in the controller
- [X] T080 [US2] Implement `GET /api/hr/key-results/objective/:objectiveId` in the controller

### Backend — Check-in service (PENDING path for US2)

- [X] T081 [US2] Implement `OkrCheckInsService.submit(dto, user)`: verify `keyResultId` exists (throws `KrNotFound`), verify `user.employeeId IN keyResult.assigneeIds` (throws `NotAssigned`), verify KR + parent Objective + parent cycle are all `ACTIVE` (throws `KrNotActive`), validate BOOLEAN value (throws `BooleanValueInvalid`). Compute `score` server-side via `kr-score.util.ts`. Determine auto-approval per FR-016 (full owner-on-own-personal-Objective check) — for US2 the DEPARTMENT-level path is `PENDING`. Insert the check-in. **If PENDING**, after commit emit `okr.checkin_submitted` with full payload per [contracts/event-subscriptions.md](./contracts/event-subscriptions.md)
- [X] T082 [US2] Implement `OkrCheckInsService.approve(id, user)`: verify status === 'PENDING' (throws `CheckInNotPending` → 409 Conflict), verify caller is Manager of the parent Objective's department OR HR_ADMIN (throws `WrongDepartment`). Inside `prisma.$transaction`: (a) transition check-in to `APPROVED` with `reviewedById=user.sub`, `reviewedAt=now()`, (b) update parent KR `currentValue = checkIn.value`, `score = computeScore(...)`, (c) if new score >= 1.0 AND current KR status NOT IN (`ACHIEVED`, `CANCELLED`), set KR status to `ACHIEVED` AND call `appendKrStatusHistory(tx, { keyResultId, fromStatus: prev, toStatus: 'ACHIEVED', changedById: null, reason: 'score-auto-flip-on-approve' })` — `changedById=null` because the auto-flip is system-induced even though the approve action had an actor (FR-034). **After commit** emit `okr.checkin_approved`
- [X] T083 [US2] Implement `OkrCheckInsService.reject(id, dto, user)`: same RBAC as approve; require `dto.reason` (throws `ReasonRequired` if validation fails); transition check-in to `REJECTED` with `rejectionReason`, `reviewedById`, `reviewedAt`; do NOT update KR `currentValue`/`score`. **After commit** emit `okr.checkin_rejected` with the reason verbatim
- [X] T084 [US2] Implement `OkrCheckInsService.listByKeyResult(keyResultId, user)` applying the scope filter from [data-model.md §6](./data-model.md)

### Backend — Check-in controller

- [X] T085 [US2] Implement `POST /api/hr/okr-check-ins` in `apps/hr-core/src/modules/okrs/check-ins/okr-check-ins.controller.ts` with `@Roles('EMPLOYEE','MANAGER','HR_ADMIN')`
- [X] T086 [US2] Implement `GET /api/hr/okr-check-ins/key-result/:keyResultId` in the controller
- [X] T087 [US2] Implement `PATCH /api/hr/okr-check-ins/:id/approve` with `@Roles('MANAGER','HR_ADMIN')`
- [X] T088 [US2] Implement `PATCH /api/hr/okr-check-ins/:id/reject` with `@Roles('MANAGER','HR_ADMIN')` and body `RejectCheckInDto`

### Backend — notification routing rules for check-in events

- [X] T089 [US2] Implement `onCheckInSubmitted` in `apps/hr-core/src/modules/notifications/events/routing-rules/okr.rules.ts`: query active users with `MANAGER` role assigned to `payload.departmentId` via `prisma.user.findMany({ where: { status: 'ACTIVE', roles: { some: { role: { code: 'MANAGER' } } }, departmentId: payload.departmentId } })`; return one `NotificationDraft` per Manager with `category: 'OKR'`, `eventType: 'DECISION_PENDING'`, `referenceType: 'okr_check_in'`, `referenceId: payload.checkInId`, `actorUserId: payload.submitterId`
- [X] T090 [US2] Implement `onCheckInApproved` in `okr.rules.ts`: resolve `payload.submitterId` (Employee.id) → `User.id`; return single `NotificationDraft` to the submitter with `category: 'OKR'`, `eventType: 'INFO'`, `referenceType: 'okr_check_in'`, `referenceId: payload.checkInId`
- [X] T091 [US2] Implement `onCheckInRejected` in `okr.rules.ts`: same recipient resolution as `onCheckInApproved`; body MUST include `payload.reason` verbatim (truncate to 400 chars with `…` suffix to fit `body VARCHAR(600)` column); `category: 'OKR'`, `eventType: 'DECISION_PENDING'`
- [X] T092 [US2] Add three template entries to `apps/hr-core/src/modules/notifications/notifications.renderers.ts`: `(OKR, DECISION_PENDING)` (used by submitted + rejected — body differs by payload shape detected at render time), `(OKR, INFO)` already exists from T061 (extend to handle both cycle-activated and check-in-approved payload shapes via discriminator). Title/body templates per [contracts/event-subscriptions.md](./contracts/event-subscriptions.md)
- [X] T093 [US2] Register `okr.checkin_submitted`, `okr.checkin_approved`, `okr.checkin_rejected` in `notifications-events.bridge.ts` mapping to the three rule functions added in T089–T091

### Backend — tests for US2

- [ ] T094 [P] [US2] Unit test `apps/hr-core/src/modules/notifications/events/routing-rules/okr.rules.spec.ts`: mock `PrismaService`; assert `onCheckInSubmitted` returns one draft per dept Manager / skips submitter (actor filter happens in router but rule should NOT include submitter); `onCheckInApproved` returns one draft to submitter; `onCheckInRejected` body contains reason verbatim and is truncated at 400 chars when reason exceeds it
- [ ] T095 [US2] Integration test `apps/hr-core/test/integration/okrs-checkin-loop.integration.spec.ts`: seed Q1 2026 ACTIVE + company Objective ACTIVE + dept Objective ACTIVE + KR with two assignees + a Manager of the dept. Call `OkrCheckInsService.submit` as one assignee; assert (a) check-in row with `status='PENDING'`, (b) `okr.checkin_submitted` event emitted, (c) notification row exists for the Manager. Call `approve`; assert (a) check-in `APPROVED`, (b) KR `currentValue` and `score` updated correctly, (c) submitter notification with `eventType='INFO'`. Submit another, call `reject` with a reason; assert submitter notification body contains the reason

### Frontend — Manager-side UI

- [X] T096 [P] [US2] Add typed functions `getKeyResults(objectiveId)`, `createKeyResult(body)`, `updateKeyResult(id, body)` to `apps/web/src/lib/api/hr-core.ts`
- [X] T097 [P] [US2] Add typed functions `submitCheckIn(body)`, `getCheckIns(keyResultId)`, `approveCheckIn(id)`, `rejectCheckIn(id, { reason })` to `apps/web/src/lib/api/hr-core.ts`
- [X] T098 [P] [US2] Create `apps/web/src/components/okrs/kr-row.tsx`: compact KR list row showing `title`, `metricType`, `currentValue/targetValue + unit`, `score` as a horizontal `Progress` bar, status badge, assignee avatars
- [X] T099 [P] [US2] Create `apps/web/src/components/okrs/kr-progress-bar.tsx`: shared `Progress` component with at-risk styling (red bar when `isAtRisk === true`)
- [X] T100 [P] [US2] Create `apps/web/src/components/okrs/check-in-review-queue.tsx`: TanStack Query for pending check-ins in the Manager's department (`GET /api/hr/okr-check-ins?status=PENDING` — extend backend query DTO if needed, OR fetch per-KR via `getCheckIns`); each row shows submitter, value, comment, KR title; `Approve` and `Reject` buttons; `Reject` opens a `Dialog` for the reason. **Full frontend `onError` mapping**: `CheckInNotPending` → "This check-in was already reviewed.", `WrongDepartment` → "You can only review check-ins for your own department.", `ReasonRequired` → "A reason is required to reject a check-in."
- [X] T101 [US2] Extend `apps/web/src/pages/okr-cycle-management.tsx` (Manager view) to surface department Objectives + their KRs and a "Create department Objective" button using `<ObjectiveForm initialLevel="DEPARTMENT">`. Mount the `<CheckInReviewQueue />` in a sidebar tab on the same page. **KR-creation `onError` mapping** for the Add-KR dialog (per `.claude/rules/frontend-backend-coherence.md` §3): `ObjectiveNotActive` → "Cannot add a Key Result to a closed or cancelled Objective.", `BooleanTargetMustBeOne` → "Boolean Key Results must have a target of 1.", `TargetMustBePositive` → "Target value must be greater than 0.", `AssigneeNotFound` → "One or more assignees could not be found."

**Checkpoint**: US2 is shippable. Both P1 user stories' notification loops (cycle activation from US1, check-in review from US2) flow through `okr.rules.ts`. Managers can cascade strategy and review check-ins; check-in approval updates KR scores and notifies the submitter.

---

## Phase 5: User Story 3 — Employee Owns Personal OKRs + Auto-Approval Path (Priority: P1)

**Goal**: Employees create personal Objectives aligned to their department, add Key Results, and log check-ins. Check-ins on personal KRs (parent Objective is EMPLOYEE-level owned by submitter) auto-approve; check-ins on shared department KRs go through the US2 PENDING flow. Cross-department employee Objectives are rejected. (FR-008, FR-015, FR-016, FR-029)

**Independent Test**: Sign in as Employee Alice during the active Q1 2026 cycle (US1 + US2 shipped). Open `/my-okrs`; create a personal EMPLOYEE Objective aligned to her department Objective; add a personal KR; log a check-in on the personal KR — confirm `status='APPROVED'` immediately AND no notification fires for any reviewer AND no `okr.checkin_submitted` / `okr.checkin_approved` event is emitted. Log a check-in on a department KR she is assigned to — confirm `status='PENDING'` and the Manager receives the notification (US2 path). Attempt to create a personal Objective aligned to a department Objective in a different department — confirm 400 `CrossDepartmentAlignment`.

### Backend — Objective service (EMPLOYEE level)

- [X] T102 [US3] Extend `ObjectivesService.create` (T054) to handle the EMPLOYEE path: require `parentObjectiveId` referencing a DEPARTMENT Objective whose `departmentId == owner.departmentId` (throws `CrossDepartmentAlignment` otherwise); require `ownerId`; denormalise `departmentId` from `Employee.departmentId` at creation time per R12. RBAC: EMPLOYEE can only create with `body.ownerId === user.sub`; MANAGER can create for direct reports (verify `Employee.managerId === user.employeeId`); HR_ADMIN can create for any active Employee. **After commit** emit `okr.objective_created` with full payload (verified by Career Agent path in Phase 7 — no notification consumer for now)

### Backend — Check-in service (auto-approval path)

- [X] T103 [US3] Extend `OkrCheckInsService.submit` (T081) auto-approval branch: when parent Objective `level === 'EMPLOYEE'` AND `ownerId === user.sub`, insert the check-in with `status='APPROVED'`, `reviewedAt=now()`, `reviewedById=null` (FR-016 — null actor = auto-approved by system), AND inside the same transaction update KR `currentValue + score` (same logic as the approve path in T082). If the auto-recompute pushes the KR's score to ≥ 1.0 and status is not already `ACHIEVED`/`CANCELLED`, flip it to `ACHIEVED` AND call `appendKrStatusHistory(tx, ..., changedById=null, reason='score-auto-flip-on-auto-approve')` (FR-034). **Do NOT emit** `okr.checkin_submitted` or `okr.checkin_approved` — auto-approval is silent by design (spec.md edge cases + FR-024 silent path)

### Backend — tests for US3

- [ ] T104 [US3] Integration test `apps/hr-core/test/integration/okrs-employee-personal.integration.spec.ts`: seed cycle + dept Objective + employee + dept KR assigned to employee. Submit a check-in on the dept KR; assert `status='PENDING'` AND `okr.checkin_submitted` was emitted (US2 path verified). Then create an EMPLOYEE Objective owned by the same employee + a personal KR. Submit a check-in on the personal KR; assert (a) `status='APPROVED'` immediately, (b) KR `currentValue` updated in the same transaction, (c) `reviewedById === null`, (d) NO `okr.checkin_submitted` event was emitted, (e) NO `okr.checkin_approved` event was emitted, (f) no notification rows were created. Attempt to create an EMPLOYEE Objective whose parent is a DEPARTMENT Objective in a different department; assert 400 with code `CrossDepartmentAlignment`
- [ ] T105 [US3] Integration test `apps/hr-core/test/integration/okrs-rollback.integration.spec.ts` (FR-035 rollback safety): monkey-patch `OkrCyclesService.activate` to throw AFTER the Prisma transaction commits but BEFORE `eventBus.emit` — assert NO notifications were created (the bridge runs synchronously off the event, so no event = no notification). Then monkey-patch to throw INSIDE the transaction — assert NO cycle state change AND NO notifications. Documents the post-commit emission contract
- [ ] T105a Integration test `apps/hr-core/test/integration/okrs-audit-trail.integration.spec.ts` (FR-034 audit-trail completeness). Walk each transition and assert the audit row is correct: (a) cycle activate → `activatedAt`+`activatedById=user.sub`; cycle close → `closedAt`+`closedById=user.sub`; (b) Objective activate → `activatedAt`+`activatedById`; close → `closedAt`+`closedById`; cancel → `cancelledAt`+`cancelledById`; (c) KR PATCH status MANUAL change → exactly one new row in `key_result_status_history` with `changedById=user.sub`; KR cascade-cancel from Objective cancel → one row with `changedById=null` and `reason='Objective cancelled'`; KR auto-flip to ACHIEVED on approve → one row with `changedById=null` and `reason='score-auto-flip-on-approve'`; (d) check-in approve → `reviewedById=user.sub`+`reviewedAt`; manual reject → same + `rejectionReason`; auto-approve (personal-Objective owner) → `reviewedById=null`; cycle-close cascade reject → `reviewedById=null`+`rejectionReason='Cycle closed before review'`

### Frontend — Employee workspace

- [X] T106 [P] [US3] Create `apps/web/src/components/okrs/check-in-form.tsx`: shadcn `Dialog` with form (React Hook Form + Zod) for `value` (decimal) + optional `comment`; auto-computes a preview `score` based on the KR's `targetValue` and `metricType` (calls a small mirror of `kr-score.util.ts` in the frontend OR reads the score back from the server response). `onError` maps `KrNotFound`, `NotAssigned`, `KrNotActive`, `BooleanValueInvalid`
- [X] T107 [P] [US3] Create `apps/web/src/components/okrs/check-in-history.tsx`: TanStack Query for `getCheckIns(keyResultId)`; chronological list with status badges (`PENDING` yellow, `APPROVED` green, `REJECTED` red with reason inline)
- [X] T108 [US3] Create `apps/web/src/pages/my-okrs.tsx`: two sections — "My personal Objectives" (TanStack Query for `getObjectives({ ownerId: user.sub, cycleId })`) with create / edit / cancel actions via `<ObjectiveForm initialLevel="EMPLOYEE">`, and "KRs assigned to me" (compute from `getEmployeeOkrPortfolio(user.employeeId, cycleId)` — Phase 6 — or temporarily use `getObjectives({ cycleId })` filtered client-side by `assigneeIds.includes(user.employeeId)` until the analytics endpoint ships). Each KR row hosts `<CheckInForm>` and `<CheckInHistory>`. `onError` for create-Objective maps `CrossDepartmentAlignment` → "Personal OKRs must align to your own department's OKRs"
- [X] T109 [US3] Register the new route in `apps/web/src/App.tsx`: `<Route path="/my-okrs">...</Route>` and add "My OKRs" link in `apps/web/src/components/layout.tsx` sidebar visible to all authenticated users

**Checkpoint**: All three P1 user stories ship together as the MVP. Cycle creation, cascade, personal goal tracking, and the dual-track contribution model are all live. Notifications fire for cycle activation, check-in submission to manager, approve/reject; auto-approval is silent.

---

## Phase 6: User Story 4 — Role-Aware OKR Dashboard (Priority: P2)

**Goal**: A single OKR Dashboard whose content adapts to the caller's role and shows cycle-wide health: cycle selector, per-department progress bars, at-risk KR count, top-level alignment tree. EXECUTIVE / HR_ADMIN see all departments; MANAGER sees own; EMPLOYEE sees own + own department. (FR-031, FR-032, SC-007)

**Independent Test**: With Q1 2026 active and US1/US2/US3 having produced data (≥1 company Objective + ≥2 department Objectives + ≥3 employee Objectives + ≥5 approved check-ins across them), sign in as each of the four roles. Verify each sees the correct subset per RBAC, the at-risk KR count is accurate (`score < 0.3` AND `EXISTS approved check-in` AND `status NOT IN (ACHIEVED, CANCELLED)`), and switching the cycle selector re-queries.

### Backend — analytics service

- [X] T110 [US4] Implement `OkrAnalyticsService.getCycleSummary(cycleId, user)` in `apps/hr-core/src/modules/okrs/analytics/okr-analytics.service.ts`: single raw SQL query (`prisma.$queryRaw`) joining `objectives` + `key_results` + (EXISTS check-ins subquery) GROUPED BY `department_id`, returning per-department `objectiveCount`, `krCount`, `averageScore`, `atRiskCount` (computed inline per [research.md R8](./research.md)). Also fetch `topLevelObjectives` (level=COMPANY) and `atRiskKrs` flat list (max 50). Apply RBAC scope: MANAGER filtered to `user.departmentId`; EXECUTIVE/HR_ADMIN unfiltered
- [X] T111 [US4] Implement `OkrAnalyticsService.getEmployeePortfolio(employeeId, cycleId, user)`: RBAC check (self OR Manager-of-employee OR HR_ADMIN); query `objectivesOwned` (level=EMPLOYEE, ownerId=employee.userId, cycleId), `keyResultsAssigned` (KR's `assignee_ids @> ARRAY[employeeId]::uuid[]` AND objective.cycleId=cycleId), and `latestApprovedCheckIn` per KR via window function or subquery
- [X] T112 [US4] Implement `GET /api/hr/okr-analytics/cycle/:cycleId/summary` in `apps/hr-core/src/modules/okrs/analytics/okr-analytics.controller.ts` with `@Roles('MANAGER','HR_ADMIN','EXECUTIVE')`
- [X] T113 [US4] Implement `GET /api/hr/okr-analytics/employee/:employeeId/cycle/:cycleId` with `@Roles('EMPLOYEE','MANAGER','HR_ADMIN')`

### Frontend — dashboard page

- [X] T114 [P] [US4] Add typed functions `getOkrCycleSummary(cycleId)`, `getEmployeeOkrPortfolio(employeeId, cycleId)` to `apps/web/src/lib/api/hr-core.ts`
- [X] T115 [P] [US4] Create `apps/web/src/components/okrs/department-progress-card.tsx`: shadcn `Card` with department name, objective count, average score bar, at-risk count badge (red when > 0)
- [X] T116 [P] [US4] Create `apps/web/src/components/okrs/alignment-tree.tsx`: recursive component rendering `topLevelObjectives → childObjectives → grandchildren`; uses shadcn `Collapsible` for expand/collapse; clicking a leaf navigates to that Objective's detail drawer
- [X] T117 [US4] Create `apps/web/src/pages/okr-dashboard.tsx`: header with `<CycleSelector>`; KPI tiles (total Objectives, total KRs, at-risk count); `<DepartmentProgressCard>` grid (one per department in scope); `<AlignmentTree>` panel; for EMPLOYEE role: a "Your Portfolio" section calling `getEmployeeOkrPortfolio(user.employeeId, cycleId)`; closed cycles render a "CLOSED" badge in the header
- [X] T118 [US4] Register the new route in `apps/web/src/App.tsx`: `<Route path="/okr-dashboard">...</Route>` and add "OKR Dashboard" link in `apps/web/src/components/layout.tsx` sidebar visible to all authenticated users

**Checkpoint**: US4 ships. Leadership has a single page that answers "are we on track?" in under 30 seconds (SC-007).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Career Agent OKR tools, the 14-day reminder cron, contract tests, and project bookkeeping. None of these block the user stories above.

### Career Agent extensions (AI Agentic)

- [ ] T119 [P] Extend `apps/ai-agentic/src/common/clients/hr-core.client.ts` with new methods: `getObjective(id, context): Promise<ObjectiveDetailResponse>`, `getCycleSummary(cycleId, context): Promise<OkrCycleSummary>`, `listObjectives(query, context): Promise<PaginatedObjectives>` — all accepting `AgentContext` and forwarding the JWT per [.claude/rules/code-style.md §2](../../.claude/rules/code-style.md)
- [ ] T120 [P] Create `apps/ai-agentic/src/tools/okr-tools/suggest-objective-draft.tool.ts`: `DynamicStructuredTool` with `name='suggestObjectiveDraft'`, Zod input/output schemas per [contracts/career-agent-tools.md Tool 1](./contracts/career-agent-tools.md); implementation calls `HrCoreClient.getObjective(departmentOkrId, context)` + `HrCoreClient.getEmployee(employeeId, context)`, builds the LLM prompt template, invokes the LLM at temperature 0.3, parses + validates the JSON response with Zod; on HTTP 403 calls `GracefulDegradationHandler.handle()` and returns `AgentDegradationResult`; logs an `AgentTaskLog` row with `taskType='okr.suggest_objective_draft'`
- [ ] T121 [P] Create `apps/ai-agentic/src/tools/okr-tools/suggest-key-results.tool.ts`: same pattern, optional `HrCoreClient.getObjective` call when `objectiveId` provided; temperature 0.4; Zod output requires 2–4 KRs
- [ ] T122 [P] Create `apps/ai-agentic/src/tools/okr-tools/flag-at-risk-okrs.tool.ts`: NO LLM call; calls `HrCoreClient.getCycleSummary(cycleId, context)` and projects the `atRiskKrs` array into the tool output shape; on 403 returns degradation with the friendly message in the contract
- [ ] T123 Register the three new tools in `apps/ai-agentic/src/tools/tool-registry.ts` under a new `OkrTools` factory function; add `...OkrTools(deps)` to the Career Agent's `tools` array in `apps/ai-agentic/src/agents/career-agent/career-agent.graph.ts`
- [ ] T124 [P] Unit test `apps/ai-agentic/src/tools/okr-tools/okr-tools.spec.ts` covering all three tools: mock `HrCoreClient` + `mockLlm`; assert Zod input validation rejects bad input, happy path returns correctly-shaped output, 403 from `HrCoreClient` returns `AgentDegradationResult` with the right message, `AgentTaskLog` rows are created with the expected `taskType`
- [ ] T125 Create `apps/ai-agentic/src/agents/career-agent/career-agent.subscriptions.ts`: `@Injectable()` `OnApplicationBootstrap`; subscribes to `okr.objective_created` (logs hint to attach to next conversation with `ownerId`) and `okr.objective_closed` (creates `AgentTaskLog` row with `taskType='okr.performance_summary_ready'` keyed on `(objectiveId, ownerId)`) per [contracts/event-subscriptions.md → Career Agent subscriptions](./contracts/event-subscriptions.md). Register in `career-agent.module.ts` providers

### Reminder scheduler

- [X] T126 Create `apps/hr-core/src/modules/okrs/scheduler/okr-reminder.scheduler.ts`: `@Injectable()`; `@Cron('0 9 * * *')` daily handler queries active cycles with `endDate = (current_date + interval '14 days')::date` per [research.md R9](./research.md); for each, finds active assignees whose KR has no `APPROVED` check-in in the last 14 days; emits one `okr.checkin_reminder_due` per `(employeeId, cycleId)` pair via `EVENT_BUS`
- [X] T127 Implement `onReminderDue` in `apps/hr-core/src/modules/notifications/events/routing-rules/okr.rules.ts`: returns single `NotificationDraft` to `payload.userId` with `category: 'OKR'`, `eventType: 'DECISION_PENDING'`, `referenceType: 'okr_cycle'`, `referenceId: payload.cycleId`; body lists `payload.openKeyResultIds.length` open KRs + `payload.dueAt`
- [X] T128 Register `okr.checkin_reminder_due` event-type → `onReminderDue` in `notifications-events.bridge.ts`
- [X] T129 Register `OkrReminderScheduler` in `apps/hr-core/src/modules/okrs/okrs.module.ts` providers; verify `ScheduleModule.forRoot()` is already imported in `app.module.ts` (added by feature 005/010) — no-op if already imported
- [ ] T130 [P] Unit test `apps/hr-core/src/modules/okrs/scheduler/okr-reminder.scheduler.spec.ts`: mock `PrismaService` + `EVENT_BUS`; assert handler queries cycles with the right date arithmetic, emits one event per stale assignee, skips assignees with a recent approved check-in

### Cross-service notification integration test

- [ ] T131 Integration test `apps/hr-core/test/integration/okrs-notifications.integration.spec.ts`: end-to-end check-in submission produces a Manager notification within 60 seconds (poll-and-assert). Approve via the controller; assert submitter notification appears. Reject with a reason; assert submitter notification body contains the reason verbatim. Forces the FR-035 contract once more across the bridge: assert a forced `eventBus.emit` failure does not propagate back to the OKR service (handler is async fire-and-forget)

### Contract test extension (AI Agentic)

- [ ] T132 [P] Extend `apps/ai-agentic/test/contracts/hr-core-client.contract.spec.ts` with three new nock-stubbed cases: `GET /api/hr/objectives/:id`, `GET /api/hr/okr-analytics/cycle/:id/summary`, `GET /api/hr/employees/:id` (if not already covered) — assert each call shape and response parsing matches the OKR REST contract

### Performance & hardening

- [ ] T133 [P] Add Swagger response examples to all five OKR controllers (one `OkrCycleResponseDto`, `ObjectiveResponseDto`, `KeyResultResponseDto`, `OkrCheckInResponseDto`, `OkrCycleSummaryDto`) — improves the auto-generated API docs at `/api/docs`
- [ ] T134 Verify the EventBus contract: walk every `eventBus.emit` call in `apps/hr-core/src/modules/okrs/**/*.service.ts` and confirm each is OUTSIDE its `prisma.$transaction` block (FR-035 / [research.md R3 from feature 010 inherited](./research.md))
- [ ] T135 Verify index health: after migration, run `psql -c "\di hr_core.*okr*"` and `psql -c "\di hr_core.*objective*"` `psql -c "\di hr_core.*key_results*"` `psql -c "\di hr_core.*check_ins*"` and verify all eleven indexes exist; document expected sizes in a one-line note inside `apps/hr-core/prisma/migrations/<timestamp>_add_okrs/README.md`

### Documentation & coordination

- [X] T136 Update `AGENTS.md` → `## Recent Changes` with a one-liner: `011-okr-module: OKR module — 4 new entities + 7 enums in hr_core, 3-level cascading hierarchy (Company/Department/Employee), dual-track contribution (personal OKRs auto-approve + shared KR check-ins via Manager review), Career Agent extended with suggestObjectiveDraft + suggestKeyResults + flagAtRiskOkrs, notifications integration via okr.rules.ts + new OKR enum value, 14-day reminder cron, 3 React pages (okr-dashboard, okr-cycle-management, my-okrs)`
- [X] T137 Update `CLAUDE.md` § 6 (HR Core entity count) — bump from 24 to **28** to reflect the four new OKR domain entities (`OkrCycle`, `Objective`, `KeyResult`, `OkrCheckIn`); add an "OKRs" row to the entity table. Mention `KeyResultStatusHistory` as an auxiliary audit table (FR-034) explicitly NOT counted in the 28
- [ ] T138 Run the `quickstart.md` validation end-to-end manually (see [quickstart.md](./quickstart.md) §§4–8); fix any drift between the documented flow and the shipped implementation; commit a one-line note in the quickstart if minor wording changes are needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** — no deps; start immediately.
- **Phase 2 (Foundational)** — depends on Phase 1 (needs the seven shared enums). Blocks Phases 3–6.
- **Phase 3 (US1)** — depends on Phase 2.
- **Phase 4 (US2)** — depends on Phase 2 AND on Phase 3's `ObjectivesService.create` skeleton + COMPANY-level path (US2 extends create for DEPARTMENT). Best done after Phase 3 ships so an HR_ADMIN can prepare an active cycle + company Objective to demo Manager flows against.
- **Phase 5 (US3)** — depends on Phase 2 AND on Phase 4's `KeyResultsService` + `OkrCheckInsService` (US3 reuses `submit` + adds the auto-approve branch). Best done after Phase 4.
- **Phase 6 (US4)** — depends on Phase 2 + at least one of US1/US2/US3 having produced real data. Functionally only depends on Phase 2 — can be implemented earlier with seeded test data.
- **Phase 7 (Polish)** — Career Agent tools (T119–T125) depend on the OKR REST endpoints from Phases 3, 4, 6 being live. Reminder cron (T126–T130) depends on Phase 2 + US2 check-in path. Documentation tasks (T136–T138) depend on every other phase being green.

### User Story Dependencies

- **US1**: Standalone after Phase 2. Demoable as cycle management + company OKRs.
- **US2**: Builds on US1 (needs active cycle + company Objective to align against). Demoable as Manager cascade + review queue.
- **US3**: Builds on US2 (needs `submit` + dept Objective skeleton). Demoable as personal OKR workspace + auto-approval.
- **US4**: Builds on real data from US1/US2/US3 OR seeded test data. Functionally independent.

### Within Each User Story

- DTOs (Phase 2) → service methods → controller endpoints → notification routing rule (where applicable) → frontend wiring.
- Routing-rule unit tests should be written alongside the rule file (recommended; not strict TDD).
- Frontend `[P]` tasks are component files in distinct directories — safe in parallel.

### Parallel Opportunities

- **Phase 1**: T001–T007 in parallel (seven independent enum files); T009 in parallel after.
- **Phase 2**: T017+T018, T019+T020, T020a+T020b in parallel; T021–T033 (all DTO files) in parallel.
- **Phase 3 (US1)**: T064–T067 in parallel (different frontend files); T060 + T063 can be drafted in parallel.
- **Phase 4 (US2)**: T094 + T095 in parallel (unit + integration); T096–T100 in parallel (frontend components in different files).
- **Phase 5 (US3)**: T106 + T107 in parallel.
- **Phase 6 (US4)**: T114 + T115 + T116 in parallel.
- **Phase 7 (Polish)**: T119 + T120 + T121 + T122 + T124 + T130 + T132 + T133 in parallel.

---

## Parallel Example: User Story 1

```bash
# After T059 (Objective GET endpoint), launch the four frontend tasks in parallel:
Task: T064 — Add OKR cycle API functions to apps/web/src/lib/api/hr-core.ts
Task: T065 — Add OKR Objective API functions to apps/web/src/lib/api/hr-core.ts
Task: T066 — Create apps/web/src/components/okrs/cycle-selector.tsx
Task: T067 — Create apps/web/src/components/okrs/objective-form.tsx
```

```bash
# After T046–T053 (cycle backend complete), launch tests + frontend page in parallel:
Task: T063 — Integration test for cycle lifecycle
Task: T068 — Create apps/web/src/pages/okr-cycle-management.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — the three P1 user stories deliver the operating loop)

1. **Phase 1 (Setup)** — seven enum files + `NotificationCategory` extension + shared build. ~45 min.
2. **Phase 2 (Foundational)** — schema, migration, DTOs, scoring + RBAC utils, module skeleton. ~5–6 h.
3. **Phase 3 (US1)** — cycle lifecycle, company Objectives, cycle-activated notification, cycle management UI. ~5–6 h.
4. **STOP and VALIDATE**: walk through Quickstart §§1–4. HR Admin can run cycles end-to-end.
5. **Phase 4 (US2)** — department Objective path, KRs, check-in submit + review, three new routing rules, Manager UI. ~7–8 h.
6. **STOP and VALIDATE**: walk through Quickstart §5. Manager + Employee can submit/review check-ins.
7. **Phase 5 (US3)** — employee Objective path, auto-approval branch, `/my-okrs` page. ~3–4 h.
8. **STOP and VALIDATE**: walk through Quickstart §6. Personal OKRs ship. Whole dual-track loop works. **Ship the MVP.**

### Incremental Delivery

1. Ship MVP after US3.
2. Add US4 (dashboard). Ship.
3. Add Phase 7 polish (Career Agent tools, reminder cron, documentation). Ship.

### Parallel Team Strategy (Claude + Codex, sequential per `AGENTS.md`)

- Claude handles Phase 1 + Phase 2 + Phase 3 (US1) in one session.
- Codex handles Phase 4 (US2) — extends the same module Claude just built.
- Claude handles Phase 5 (US3).
- Codex handles Phase 6 (US4) — analytics work in parallel-style.
- Either agent handles Phase 7. Career Agent extensions live in a different service (`apps/ai-agentic/`) so can be done in isolation.
- Each agent updates `AGENTS.md → Recent Changes` and commits with the `[claude]` / `[codex]` prefix per [project agent-coordination memory](../../.claude/CLAUDE.md).

---

## Notes

- `[P]` tasks = different files, no incomplete dependencies — safe to parallelise.
- `[US#]` labels trace every task to a user story in [spec.md](./spec.md).
- Each user story is independently testable per the Independent Test criteria in its phase header.
- Tests are intentionally lean: pure-function units (kr-score, rbac, routing rules), one integration test per P1 story, plus the FR-035 rollback-safety test. Full E2E is out of scope.
- All Career Agent tool work in Phase 7 lives entirely in `apps/ai-agentic/` — touching HR Core only via `HrCoreClient`. Honours the project rule that AI Agentic NEVER imports from HR Core source.
- Commit prefix: `[claude]` per project's [agent coordination protocol](../../.claude/CLAUDE.md#16-agent-coordination-protocol).
- Avoid: same-file conflicts (T046–T049 all touch `okr-cycles.service.ts` — they are sequential), cross-story dependencies that break independence, and any direct `NotificationsService` call from `apps/hr-core/src/modules/okrs/` (every notification originates from an `eventBus.emit`, never a direct service call).
