# Implementation Plan: OKR (Objectives & Key Results) Module

**Branch**: `011-okr-module` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-okr-module/spec.md`

## Summary

Deliver a full **OKR module** in HR Core that adds a three-level cascading goal hierarchy (Company → Department → Employee), a dual-track contribution model (personal OKRs + shared Key Result check-ins), and annual + quarterly cycles. The module:

1. Persists four new physical entities (`OkrCycle`, `Objective`, `KeyResult`, `OkrCheckIn`) plus a small audit-only table `KeyResultStatusHistory` (FR-034) — and one conceptual entity, `OkrAlignment`, modelled via `Objective.parentObjectiveId` (**not** a separate table) — in the `hr_core` schema. After this feature the HR Core entity count rises from 24 to **28** (auxiliary audit table not counted).
2. Exposes ~20 REST endpoints behind `SharedJwtGuard` + `RbacGuard` for cycle management, Objective CRUD, Key Result CRUD, check-in submission/approval, and analytics.
3. Emits seven domain events on the existing `IEventBus` (`okr.cycle_activated`, `okr.objective_created`, `okr.objective_closed`, `okr.checkin_submitted`, `okr.checkin_approved`, `okr.checkin_rejected`, `okr.checkin_reminder_due`) **after** each respective Prisma transaction commits.
4. Adds one new routing-rule file `okr.rules.ts` to the existing notifications module (feature 010) so cycle activation, check-in submission, and check-in decisions reach the right recipient with the right category. **No new notification table, no new SSE wiring, no new bell.** The notifications feature already covers all of that.
5. Extends the existing **Career Agent** in AI Agentic with three new tools (`suggestObjectiveDraft`, `suggestKeyResults`, `flagAtRiskOkrs`) wired into the existing `ToolRegistry`. No new agent is created.
6. Ships three React pages (`okr-dashboard.tsx`, `okr-cycle-management.tsx`, `my-okrs.tsx`) under `apps/web/src/pages/`, role-aware via the existing `useAuth()` hook and `dashboard-scope-filter` pattern. API functions are added to the existing `apps/web/src/lib/api/hr-core.ts` — no new client file.

The MVP slice is **US1 (cycle + company Objectives) + US2 (department Objectives + check-in review) + US3 (personal Objectives + check-ins)** — these three priorities P1 stories deliver the complete operating loop and are the gating release. US4 (dashboard) is P2 and lands on top of the data the first three produce.

## Technical Context

**Language/Version**: TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` on)
**Primary Dependencies**: NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, @nestjs/schedule (for the 14-day check-in reminder cron — already imported by feature 005/010), existing `@sentient/shared` (`IEventBus`, `DomainEvent`, `JwtPayload`, `PermissionScope`, `NotificationCategory`, `NotificationEventType`). Frontend: React 18 + Vite 7, TanStack Query v5, wouter, Tailwind CSS v4, shadcn/ui, Recharts (already in use for the existing dashboard's `SwitchableChartCard`). AI side: existing LangGraph stack in `apps/ai-agentic/src/agents/career-agent/`, no new LLM dependency.
**Storage**: PostgreSQL 16, schema `hr_core`. Four new domain tables (`okr_cycles`, `objectives`, `key_results`, `okr_check_ins`), one new audit-only table (`key_result_status_history` — FR-034), and seven new enums (`okr_cycle_type`, `okr_cycle_status`, `objective_level`, `objective_status`, `key_result_metric_type`, `key_result_status`, `okr_check_in_status`). No new schemas. No cross-schema relations. KR `assigneeIds` stored as a `text[]` of logical employee ids (no FK — same pattern as `LeaveRequest.coveringEmployeeIds` and consistent with project rules).
**Testing**: Jest unit (services + scoring formula + RBAC scope filter), Jest integration with real Prisma against `hr_core` test schema for the cycle-lifecycle and check-in approval loops, Supertest for controller smoke tests. Career Agent tools are tested via the existing agent-test harness with a mocked LLM. Targets: ≥80% line coverage on `ObjectivesService`, `KeyResultsService`, `OkrCheckInsService`; 100% branch coverage on `okr.rules.ts` (routing rule file).
**Target Platform**: Linux/Windows dev (Node 20+), single PostgreSQL instance via existing docker-compose. Backend on `:3001` (HR Core). Frontend on `:3000` (Vite SPA). AI service on `:3003`.
**Project Type**: Web application — NestJS backend module + React SPA pages + AI Agentic tool extension. Monorepo via Turborepo.
**Performance Goals**: OKR Dashboard cycle-summary endpoint P95 ≤ 300 ms for a cycle with 20 departments × 5 OKRs × 3 KRs (~300 KRs). Check-in approve/reject P95 ≤ 150 ms (single transaction, one KR update + one event emit). Cycle list P95 ≤ 100 ms (small table, indexed by `(type, year, status)`). All endpoints satisfy spec SC-007 (≤30s to answer "which departments below 0.5?" via dashboard).
**Constraints**: All status transitions on Cycle/Objective/KeyResult/CheckIn MUST be logged with actor + timestamp (FR-034). Events MUST be emitted after-commit only (FR-035). Cross-department alignment forbidden (FR-008, edge case). Self-approval auto-pass strictly limited to `EMPLOYEE`-level Objectives owned by the submitter (FR-016, SC-006). `score` Decimal must be in [0.0, 1.0] — DB-level CHECK constraint as belt-and-braces. No new notification table (reuse feature 010); no new auth surface (reuse `SharedJwtGuard` + `RbacGuard`).
**Scale/Scope**: Internal HRIS. Realistic upper bound for FYP scope: ~500 active employees, ~20 departments, ~50 active OKRs per cycle (top-level), ~300 KRs per cycle, ~10 check-ins per employee per cycle (~5,000 check-ins/quarter). Total OKR row volume after 4 quarters ≈ 20k rows across all tables — comfortable for a single PostgreSQL instance with the planned indexes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository's `.specify/memory/constitution.md` is the unfilled template (no ratified principles). The de-facto constitution lives in `.claude/CLAUDE.md`, `.claude/rules/code-style.md`, `.claude/rules/security.md`, `.claude/rules/testing.md`, and `.claude/rules/frontend-backend-coherence.md`. The plan is checked against those gates:

| Gate (from `.claude/rules/*`) | Status | Notes |
|---|---|---|
| No `any`; strict TS; explicit return types | PASS | All new code typed against generated Prisma types + shared enums. Decimals exposed as `string` over the wire (consistent with `LeaveBalance.remainingDays`). |
| Modular NestJS: Module → Controller → Service | PASS | New `OkrsModule` contains four service+controller pairs (`OkrCyclesController/Service`, `ObjectivesController/Service`, `KeyResultsController/Service`, `OkrCheckInsController/Service`) and one analytics service. |
| `@@schema()` + `@@map()` on every Prisma model | PASS | All five tables and seven enums annotated `@@schema("hr_core")` with snake_case `@@map` names. |
| Every endpoint guarded by `SharedJwtGuard` + `RbacGuard` + `@Roles()` | PASS | All ~20 endpoints guarded. RBAC matrix in spec §RBAC matrix is the single source of truth; controller decorators mirror it 1:1. |
| No cross-service DB queries; cross-service via REST or events | PASS | Module is HR-Core-only on the persistence side. Career Agent (AI Agentic) reads OKR data via the new REST endpoints, not Prisma. |
| EventBus abstraction (no direct REST or Kafka in business logic) | PASS | All seven events emitted via `IEventBus.emit()` after-commit. No direct call from `OkrCheckInsService` into `NotificationsService` — the existing notifications bridge handles it. |
| DTOs validate at boundary, services trust inputs | PASS | Every controller method has a class-validator DTO. Numeric ranges (score [0,1]) validated at DTO and re-asserted by DB CHECK. |
| Prisma migrations: `DROP INDEX` for `@@unique` renames | N/A | This feature only adds new tables/indexes; no constraint renames. Rule noted for future migrations on this table. |
| No `apps/hr-core/` import from `apps/social/` or `apps/ai-agentic/` | PASS | The Career Agent tool extension lives entirely in `apps/ai-agentic/src/agents/career-agent/` and `apps/ai-agentic/src/tools/` — it talks to HR Core through the existing `HrCoreClient`. |
| Pre-IAM RBAC commented-out convention | N/A — IAM is already in place (per memory `project_iam_integration_progress.md`). RBAC guards stay active. |
| Notification routing convention (CLAUDE.md §Notification Routing Convention) | PASS | A single new file `okr.rules.ts` is added under `events/routing-rules/` in the existing notifications module. The OKR module never calls `NotificationsService` directly. |
| Frontend ↔ Backend coherence rule | PASS | Every backend `throw new BadRequestException('Code')` defined in the OKR services has a matching frontend `onError` mapping; every backend DTO field is mirrored in the typed Axios function. Documented in `contracts/rest-api.md` and enforced via tasks during /speckit.tasks. |

**Verdict**: PASS. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/011-okr-module/
├── plan.md                              # This file
├── spec.md                              # Feature spec (already written)
├── research.md                          # Phase 0 — decisions + alternatives
├── data-model.md                        # Phase 1 — 5 entities, 7 enums, indexes
├── quickstart.md                        # Phase 1 — local dev walkthrough
├── contracts/
│   ├── rest-api.md                      # REST endpoints + DTOs + RBAC
│   ├── event-subscriptions.md           # Domain events emitted + routing rule wiring
│   └── career-agent-tools.md            # Three new Career Agent tools (input/output schemas)
├── checklists/
│   └── requirements.md                  # Quality checklist (already written, all green)
└── tasks.md                             # Phase 2 — created by /speckit.tasks
```

### Source Code (repository root)

```text
apps/hr-core/
├── prisma/
│   ├── schema.prisma                                # +5 models, +7 enums
│   └── migrations/
│       └── 20260518000000_add_okrs/
│           └── migration.sql                        # CREATE TABLEs + indexes + CHECK constraints
└── src/modules/okrs/
    ├── okrs.module.ts                               # Module wiring; imports PrismaModule + EVENT_BUS
    ├── cycles/
    │   ├── okr-cycles.controller.ts                 # POST/GET / + PATCH /:id/activate /:id/close
    │   ├── okr-cycles.service.ts                    # Lifecycle, parent-cycle validation, cron auto-rejector
    │   └── okr-cycles.service.spec.ts
    ├── objectives/
    │   ├── objectives.controller.ts                 # CRUD + alignment-tree
    │   ├── objectives.service.ts                    # Level-aware RBAC, parent validation, cascade-cancel
    │   └── objectives.service.spec.ts
    ├── key-results/
    │   ├── key-results.controller.ts                # CRUD scoped to an objective
    │   ├── key-results.service.ts                   # Scoring formula, status auto-flip on score
    │   └── key-results.service.spec.ts
    ├── check-ins/
    │   ├── okr-check-ins.controller.ts              # Submit + approve + reject + list-per-KR
    │   ├── okr-check-ins.service.ts                 # Auto-approve owner case, manager review routing
    │   └── okr-check-ins.service.spec.ts
    ├── analytics/
    │   ├── okr-analytics.controller.ts              # GET /cycle/:id/summary + /employee/:id/cycle/:id
    │   ├── okr-analytics.service.ts                 # Aggregations, role-scoped query builder
    │   └── okr-analytics.service.spec.ts
    ├── scheduler/
    │   ├── okr-reminder.scheduler.ts                # @Cron('0 9 * * *') — checks every active cycle's endDate vs 14d window
    │   └── okr-reminder.scheduler.spec.ts
    ├── dto/
    │   ├── cycles/
    │   │   ├── create-okr-cycle.dto.ts
    │   │   └── okr-cycle-query.dto.ts
    │   ├── objectives/
    │   │   ├── create-objective.dto.ts
    │   │   ├── update-objective.dto.ts
    │   │   └── objective-query.dto.ts
    │   ├── key-results/
    │   │   ├── create-key-result.dto.ts
    │   │   └── update-key-result.dto.ts
    │   ├── check-ins/
    │   │   ├── submit-check-in.dto.ts
    │   │   └── reject-check-in.dto.ts
    │   └── response/
    │       ├── okr-cycle-response.dto.ts
    │       ├── objective-response.dto.ts
    │       ├── key-result-response.dto.ts
    │       └── okr-check-in-response.dto.ts
    └── util/
        ├── kr-score.util.ts                         # Pure scoring functions per metricType
        ├── kr-score.util.spec.ts
        ├── okr-rbac.util.ts                         # Per-level RBAC predicate (canCreateObjective(role, level, dept))
        └── okr-rbac.util.spec.ts

apps/hr-core/src/modules/notifications/events/routing-rules/
└── okr.rules.ts                                     # +new file — onCycleActivated/onCheckInSubmitted/approved/rejected/reminderDue

apps/hr-core/test/integration/
├── okrs-cycle-lifecycle.integration.spec.ts        # DRAFT → ACTIVE → CLOSED + child cascade
├── okrs-checkin-loop.integration.spec.ts           # Submit → manager approve → KR score update + event emitted
├── okrs-employee-personal.integration.spec.ts      # Auto-approve owner case
└── okrs-notifications.integration.spec.ts          # End-to-end: check-in submit → manager notification appears

apps/ai-agentic/src/
├── agents/career-agent/
│   └── career-agent.graph.ts                       # +three new tool bindings; no graph topology change
├── tools/
│   ├── tool-registry.ts                            # +OkrTools group with three tool definitions
│   └── okr-tools/
│       ├── suggest-objective-draft.tool.ts
│       ├── suggest-key-results.tool.ts
│       ├── flag-at-risk-okrs.tool.ts
│       └── okr-tools.spec.ts                       # All three tools with mocked HrCoreClient + mocked LLM
└── common/clients/
    └── hr-core.client.ts                           # +listObjectives / +getObjective / +listKeyResults / +flagAtRisk / +getCycleSummary methods

packages/shared/
└── src/enums/
    ├── okr-cycle-type.enum.ts                       # ANNUAL | QUARTERLY
    ├── okr-cycle-status.enum.ts                     # DRAFT | ACTIVE | CLOSED
    ├── objective-level.enum.ts                      # COMPANY | DEPARTMENT | EMPLOYEE
    ├── objective-status.enum.ts                     # DRAFT | ACTIVE | CLOSED | CANCELLED
    ├── key-result-metric-type.enum.ts               # PERCENTAGE | NUMBER | CURRENCY | BOOLEAN
    ├── key-result-status.enum.ts                    # ON_TRACK | AT_RISK | BEHIND | ACHIEVED | CANCELLED
    └── okr-check-in-status.enum.ts                  # PENDING | APPROVED | REJECTED

apps/web/
├── src/pages/
│   ├── okr-dashboard.tsx                            # Role-aware health view (US4)
│   ├── okr-cycle-management.tsx                     # HR_ADMIN cycle CRUD (US1)
│   └── my-okrs.tsx                                  # Employee workspace (US3)
├── src/components/okrs/
│   ├── alignment-tree.tsx                           # Recursive tree renderer
│   ├── kr-progress-bar.tsx                          # Score + at-risk styling
│   ├── kr-row.tsx                                   # Compact KR list row
│   ├── check-in-form.tsx                            # New-value input + comment
│   ├── check-in-history.tsx                         # Past check-ins per KR
│   ├── check-in-review-queue.tsx                    # Manager-side approve/reject UI
│   ├── objective-form.tsx                           # Create/edit Objective dialog
│   ├── cycle-selector.tsx                           # Shared cycle picker for all three pages
│   └── department-progress-card.tsx                 # Dashboard tile
├── src/lib/api/
│   └── hr-core.ts                                   # +cycles/objectives/keyResults/check-ins/analytics typed functions (in existing file)
└── src/App.tsx                                      # +three new routes wired into wouter
```

**Structure Decision**: Standard Sentient web-app layout. The OKR module is **a brand-new HR Core domain module** sitting beside `leaves/`, `promotions/`, `performance-reviews/`, etc. It is self-contained: notifications integration is a single new `okr.rules.ts` in the existing notifications module; AI integration is three tool files + a new `okr-tools/` directory in the existing `tools/` registry; frontend pages slot into the existing `pages/` and `components/` conventions. There is no cross-module structural change beyond the additive routing-rule file.

## Phase 0: Outline & Research

Research questions to resolve in `research.md` before Phase 1:

1. **Cycle hierarchy — annual + quarterly or also half-yearly?** — Decision: **Annual + Quarterly only** for v1. Half-yearly is rare in practice and adds a level of validation logic (which annual maps to which half) that does not earn its weight in the FYP scope. Quarterly cycles MAY have a `parentCycleId` pointing at an annual cycle, but the parent is optional (standalone quarterly is allowed; the UI flags it).
2. **Score formula — fixed or pluggable?** — Decision: **Fixed `currentValue / targetValue`** for PERCENTAGE/NUMBER/CURRENCY, special-cased for BOOLEAN. The formula lives in a pure utility (`kr-score.util.ts`) so a future per-KR override is a one-file change. Custom formulas are explicitly out of scope.
3. **Auto-approval scope** — Decision: **Strictly owner-on-own-personal-Objective**. Even HR Admins logging check-ins on their own personal OKRs follow the standard auto-approve path (they are the owner). No other auto-approve path exists. Documented as SC-006 and enforced in `OkrCheckInsService.submit()`.
4. **Routing for check-in reviewer — single Manager or any Manager?** — Decision: **Any Manager of the parent Objective's `departmentId`** can act on a `PENDING` check-in. First-in-wins. A unique reviewer would require a separate "department reviewer" assignment (out of scope). The check-in queue page lists all pending check-ins for the Manager's department.
5. **Notification category for OKR events — extend `NotificationCategory` enum or reuse `SYSTEM`?** — Decision: **Extend `NotificationCategory` with a new value `OKR`**. The enum lives in `packages/shared/src/enums/notification-category.enum.ts` and was designed to be extensible (feature 010 spec §4 explicitly lists nine values + one reserved `SYSTEM`). Reusing `SYSTEM` would mash OKR notifications into platform notices and break the inbox category filter. Migration: ADD VALUE to the existing PG enum — non-breaking, zero downtime.
6. **`assigneeIds` storage — pivot table or array column?** — Decision: **`text[]` column** (Postgres array of logical employee ids). Pivot table would add an indirection and a join on every KR read. The array column is indexable (GIN) for the rare "find all KRs assigned to employee X" lookup; we leave the GIN index off until the `flagAtRiskOkrs` Career Agent tool proves it needs one (per the "no speculative indexes" rule).
7. **Check-in `value` precision** — Decision: **`Decimal(18, 4)`** to handle currency (DZD with no decimals) and percentage (0.00–100.00) uniformly. Score stays at `Decimal(3, 2)` to enforce the [0.00, 1.00] range visually at the DB level (CHECK constraint on top).
8. **At-risk recompute trigger** — Decision: **Computed on read in the dashboard query**, NOT stored. Storing `isAtRisk` would require a re-write on every check-in approval and on cycle midpoint — wasted writes for a query that runs at most a few hundred times a day. The dashboard query computes it inline: `score < 0.3 AND status NOT IN ('ACHIEVED', 'CANCELLED') AND EXISTS (approved check-in)`.
9. **Reminder cron cadence** — Decision: **Daily at 09:00 server time** (`@Cron('0 9 * * *')`). The reminder scheduler scans every `ACTIVE` cycle whose `endDate` is exactly 14 days away (`endDate::date = (now()::date + interval '14 days')::date`) and emits one `okr.checkin_reminder_due` per assignee-with-stale-KRs. Daily granularity is sufficient — reminders are not time-of-day-critical.
10. **Career Agent tool RBAC — through the tool registry or in the agent graph?** — Decision: **In the tool itself**, via `HrCoreClient` JWT forwarding. The three new tools call HR Core endpoints which enforce RBAC (FR-028); on 403 the existing `GracefulDegradationHandler` returns `AgentDegradationResult` and the agent explains the limitation. The agent graph does NOT pre-check permissions — same pattern as every other Career Agent tool today.
11. **Frontend cycle selector — global state or per-page?** — Decision: **Per-page** for v1. Each of the three OKR pages owns its own `cycleId` state via `useState`, with a shared `<CycleSelector>` component. A global "active cycle" context could be added later if pages need to share the selection; YAGNI for now.
12. **Department-Objective department source of truth** — Decision: **`Objective.departmentId` on department-level Objectives**, NOT inferred from the creator's `user.departmentId`. The creator's department is used as the default in the create form, but HR Admin can override (HR Admin can create department Objectives for any department). The validation is "the creator must have HR_ADMIN role OR `creator.departmentId == body.departmentId`".

**Output**: `research.md` with the 12 decisions above, each in Decision / Rationale / Alternatives form.

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete.

### 1.1 Data model → `data-model.md`

Five new tables in `hr_core`, seven new enums. Key indexes:
- `okr_cycles(type, year, status)` — list/filter query.
- `okr_cycles(parent_cycle_id)` — annual → quarterly children walk.
- `objectives(cycle_id, level, status)` — per-cycle alignment tree query (the dashboard hot path).
- `objectives(parent_objective_id)` — recursive alignment walk.
- `objectives(department_id, level)` — Manager's "my dept Objectives" query (partial: `WHERE level='DEPARTMENT'`).
- `objectives(owner_id, level)` — Employee's "my personal Objectives" query (partial: `WHERE level='EMPLOYEE'`).
- `key_results(objective_id, status)` — KRs of an Objective.
- `key_results USING GIN (assignee_ids)` — **NOT created** until usage warrants. Documented.
- `okr_check_ins(key_result_id, created_at DESC)` — KR history.
- `okr_check_ins(status, key_result_id)` — pending queue for Manager review.
- CHECK constraints: `score BETWEEN 0 AND 1` (KR + check-in), `current_value >= 0`, `target_value > 0` (PERCENTAGE/NUMBER/CURRENCY) or `= 1` (BOOLEAN), `quarter BETWEEN 1 AND 4` (when set), cycle-parent type invariant (only QUARTERLY may have a parent), Objective level invariants (parent/department/owner presence per level). Seven CHECK constraints total — see [data-model.md §2](./data-model.md).

The full Prisma schema (with `@@schema("hr_core")`, `@@map` snake_case names, and the back-relations on `Employee` and `Department`) is in `data-model.md`. The `OkrAlignment` "entity" is documented explicitly as **not a table** — alignment is modelled by `Objective.parentObjectiveId` only.

### 1.2 REST contracts → `contracts/rest-api.md`

Five resource groups under HR Core, all under `/api/hr/` (matching the project's `vite.config.ts` proxy + frontend client convention):

- **OKR Cycles** (`/api/hr/okr-cycles`) — POST, GET, PATCH /:id/activate, PATCH /:id/close.
- **Objectives** (`/api/hr/objectives`) — POST, GET, GET /:id (with alignment tree + KRs), PATCH /:id, DELETE /:id (soft).
- **Key Results** (`/api/hr/key-results`) — POST, PATCH /:id, GET /objective/:objectiveId.
- **Check-ins** (`/api/hr/okr-check-ins`) — POST, GET /key-result/:keyResultId, PATCH /:id/approve, PATCH /:id/reject.
- **Analytics** (`/api/hr/okr-analytics`) — GET /cycle/:cycleId/summary, GET /employee/:employeeId/cycle/:cycleId.

Each endpoint is documented with: method, path, RBAC (`@Roles()`), DTO, response shape, error codes (with frontend `onError` mapping pre-written per `.claude/rules/frontend-backend-coherence.md`), Swagger `@ApiResponse` examples. Pagination on `GET /objectives` and `GET /okr-cycles` follows the same cursor pattern as `notifications` (base64url JSON `{ createdAt, id }`).

### 1.3 Event subscriptions → `contracts/event-subscriptions.md`

Documents the seven domain events the OKR module emits, the routing rule each one consumes in `okr.rules.ts`, and the resulting `(NotificationCategory, NotificationEventType)` pair. Mirrors feature 010's event-subscription contract format. Includes the post-commit emission contract (FR-035) and the `OKR` enum extension on `NotificationCategory` (R5).

### 1.4 Career Agent tools → `contracts/career-agent-tools.md`

For each of the three new tools:
- LangGraph tool definition (`name`, `description`, `schema`).
- Input Zod schema (`employeeId`, `departmentOkrId`, etc.) and Output Zod schema.
- The HR Core REST call(s) the tool makes via `HrCoreClient`.
- RBAC the HR Core endpoints enforce (FR-028).
- `AgentTaskLog` shape — `taskType: 'okr.suggest_objective_draft'` etc.
- Graceful-degradation behaviour on 403 (Employee asks for `flagAtRiskOkrs` → returns "I can only show this to your Manager; here is your own portfolio instead").
- LLM prompt template (small, deterministic) for `suggestObjectiveDraft` and `suggestKeyResults`. `flagAtRiskOkrs` is a pure REST call — no LLM.

### 1.5 Quickstart → `quickstart.md`

A 15-minute walkthrough:
1. `pnpm --filter @sentient/shared build` (seven new enums).
2. `cd apps/hr-core && npx prisma migrate dev --name add_okrs`.
3. `turbo dev --filter=hr-core --filter=web --filter=ai-agentic`.
4. Sign in as HR Admin → create FY 2026 + Q1 2026 + activate → verify cycle-activated notification fires.
5. Create company Objective.
6. Sign in as Manager → create department Objective aligned to it + KR with two assignees.
7. Sign in as Employee → create personal Objective + log own-KR check-in (auto-approve) + log department-KR check-in (PENDING).
8. Switch back to Manager → see ACTION_REQUIRED notification → approve / reject from review queue.
9. Use Career Agent (`/ai/chat` or `/chat`): "Help me draft 3 Key Results for my new Objective 'Reduce churn to 5%'" → `suggestKeyResults` tool invoked → result inserted into Objective via Add KR form.
10. Run `turbo test --filter=hr-core` and `turbo test:integration --filter=hr-core`.

### 1.6 Agent context update

Run `.specify/scripts/bash/update-agent-context.sh claude` after `data-model.md` and `contracts/` are written; this adds the new technology row ("OKR module + 7 enums + Career Agent OKR tools") to `CLAUDE.md`'s **Recent Changes** without overwriting manual sections.

**Output**: `data-model.md`, `contracts/rest-api.md`, `contracts/event-subscriptions.md`, `contracts/career-agent-tools.md`, `quickstart.md`, plus the agent context update.

## Complexity Tracking

No Constitution Check violations. Three design choices that may look like complexity but are intentional and worth recording:

| Choice | Why it's not over-engineering |
|---|---|
| Four domain tables for a "single feature" | OKRs are inherently a three-level hierarchy (cycle / objective / KR) with a separate review record (check-in). Collapsing any of them creates a worse model: a single "okr_item" table with self-references would force every query to filter by `level` and would not enforce the alignment invariant in the database. Four tables is the minimum to express the domain cleanly. |
| Auxiliary `KeyResultStatusHistory` audit table | FR-034 requires every status transition to be reconstructable from the database. Cycle / Objective / CheckIn transitions are at most 2–3 per row and fit on dedicated actor/timestamp columns (`activatedBy/At`, `closedBy/At`, `cancelledBy/At`, `reviewedBy/At`). KR status churns more (ON_TRACK ↔ AT_RISK ↔ BEHIND ↔ ACHIEVED ↔ CANCELLED) — a small immutable history table is the right shape. Same audit-table pattern as `AgentTaskLog` and `SalaryHistory` already in the codebase. |
| `assigneeIds text[]` array instead of a `kr_assignees` pivot table | The KR-assignee relation is read-only after creation (assignees are set when the KR is created and rarely change), the average list length is 1–3, and every read of a KR uses the assignees in the same query. A pivot would force a join on every KR read for zero structural benefit. Same pattern as `LeaveRequest.coveringEmployeeIds` already in the codebase. Documented in research R6 and data-model.md §3. |
| One new routing-rule file in the existing notifications module instead of a brand-new OKR notification surface | The notifications module from feature 010 was explicitly designed to be extended this way (CLAUDE.md §Notification Routing Convention). Creating an "OKR notification service" would duplicate every concern the existing module already solves (RBAC, SSE, retention, inbox UI) and break the single-inbox UX. The one-file extension is the cheapest correct path. |
