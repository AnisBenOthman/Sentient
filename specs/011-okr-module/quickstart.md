# Quickstart: OKR (Objectives & Key Results) Module

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Audience**: A developer (Claude or human) sitting down on `011-okr-module` for the first time.

The goal of this walkthrough is to bring the whole loop up locally — from cycle creation to check-in approval, with notifications and the Career Agent's AI tools — in under 20 minutes.

---

## 0. Prerequisites

- `pnpm` installed, repo bootstrapped (`pnpm install` already run).
- Docker Desktop running with the Sentient `pgvector/pgvector:pg16` container (`docker compose up -d`).
- `.env` files in `apps/hr-core/`, `apps/web/`, `apps/ai-agentic/` populated per `.env.example`.
- HR Core IAM module is in place — there are real users (HR_ADMIN, MANAGER, EMPLOYEE).
- Feature 010 (notifications) is shipped and the bell + drawer are working in the top bar.
- (Optional, for §8) AI Agentic service is running on `:3003` with the Career Agent reachable.

---

## 1. Add the seven new shared enums

```bash
pnpm --filter @sentient/shared build
```

Seven new enums are exported: `OkrCycleType`, `OkrCycleStatus`, `ObjectiveLevel`, `ObjectiveStatus`, `KeyResultMetricType`, `KeyResultStatus`, `OkrCheckInStatus`. The build step regenerates the package's `dist/` so HR Core and the React app can `import { OkrCycleType } from '@sentient/shared'`.

If you also see a blank page in the browser, you've hit the known Vite + CJS-shim issue from `feedback_shared_pkg_vite_cjs.md` — rebuild `@sentient/shared` and restart the Vite dev server.

---

## 2. Run the Prisma migration

```bash
cd apps/hr-core
npx prisma migrate dev --name add_okrs
```

This:

1. Creates the seven PostgreSQL enums in schema `hr_core`.
2. Creates the four new tables: `okr_cycles`, `objectives`, `key_results`, `okr_check_ins`.
3. Creates the eleven new indexes listed in [data-model.md §5](./data-model.md).
4. Appends the CHECK constraints (score range, target positivity, quarter range, cycle parent type, objective level invariants) — manually added at the bottom of the generated `migration.sql` per [data-model.md §2](./data-model.md).
5. **`ALTER TYPE "hr_core"."notification_category" ADD VALUE 'OKR'`** — extends the existing notifications enum (research R5). Must be the last statement in the migration file (Postgres doesn't allow `ADD VALUE` inside a transaction).
6. Adds the back-relations on `User` and `Department`.

Verify:

```bash
psql "$HR_CORE_DATABASE_URL" -c "\d hr_core.okr_cycles"
psql "$HR_CORE_DATABASE_URL" -c "\d hr_core.objectives"
psql "$HR_CORE_DATABASE_URL" -c "\d hr_core.key_results"
psql "$HR_CORE_DATABASE_URL" -c "\d hr_core.okr_check_ins"
psql "$HR_CORE_DATABASE_URL" -c "SELECT enum_range(NULL::hr_core.notification_category);"
```

You should see all four tables, all eleven indexes, all five CHECK constraints, and `OKR` in the enum range.

---

## 3. Start the services

From the repo root:

```bash
# Backend + frontend only (skip if you don't need AI yet)
turbo dev --filter=hr-core --filter=web

# Full stack including Career Agent for §8
turbo dev --filter=hr-core --filter=web --filter=ai-agentic
```

- HR Core listens on `:3001` and serves `/api/hr/okr-cycles/*`, `/api/hr/objectives/*`, etc.
- Web on `:3000` proxies `/api` → `:3001`.
- AI Agentic on `:3003` exposes `/api/conversations` and the Career Agent with the new `OkrTools`.

---

## 4. Bootstrap a cycle and a company Objective (US1)

In one browser window, sign in as an **HR_ADMIN**.

### 4.1 Create the annual frame

Navigate to `/okr-cycle-management`. Click **"Create cycle"**:

- Name: `FY 2026`
- Type: `ANNUAL`
- Year: `2026`
- Start: `2026-01-01`
- End: `2026-12-31`

The cycle is created in `DRAFT`. You don't need to activate it (annual cycles are mainly an organisational frame; activation is optional for ANNUAL).

### 4.2 Create the quarterly child

Click **"Create cycle"** again:

- Name: `Q1 2026`
- Type: `QUARTERLY`
- Year: `2026`
- Quarter: `1`
- Parent cycle: `FY 2026`
- Start: `2026-01-01`
- End: `2026-03-31`

The cycle is created in `DRAFT` and shows a "parent: FY 2026" pill.

### 4.3 Activate Q1 2026

Click the **Activate** button. Behind the scenes:

- HR Core flips `status: DRAFT → ACTIVE`.
- After commit, `okr.cycle_activated` is emitted.
- The notifications bridge routes via `okr.rules.ts → onCycleActivated` and creates one `OKR / INFO` notification per active employee with body "The QUARTERLY cycle 'Q1 2026' runs 2026-01-01 to 2026-03-31. Open your OKR workspace to align your goals."

Verify: open any other test user (Manager, Employee) in a second window — the bell shows `+1` within ~2 seconds (SSE) or 60 seconds (polling fallback).

### 4.4 Create a company Objective inside Q1 2026

Navigate into the cycle (or to `/okr-dashboard?cycleId=<Q1 id>`). Click **"Create Objective"**:

- Level: `COMPANY`
- Title: `Grow ARR to 5M DZD by end of Q1`
- Description: `Drive net new revenue, expansion ARR, and reduce churn to deliver our quarterly revenue commitment.`

The Objective is created in `DRAFT`. Activate it via the row's **Activate** action so department-level Objectives can align to it.

---

## 5. Cascade into a department OKR and review check-ins (US2)

Sign in as a **MANAGER** in a second browser window (e.g. Engineering Manager).

### 5.1 Create the department Objective

Navigate to `/okr-dashboard`. The company Objective from §4.4 is visible. Click **"Create department Objective"**:

- Level: `DEPARTMENT` (pre-selected)
- Parent: `Grow ARR to 5M DZD by end of Q1` (only ACTIVE company Objectives in Q1 2026 appear)
- Department: pre-filled to caller's department (read-only for MANAGER)
- Title: `Engineering ships 4 enterprise features`
- Description: `Two billing, one SSO, one audit-log feature, each demoed live to design partners.`

Activate the Objective.

### 5.2 Add a Key Result with two assignees

In the Objective drawer, click **"Add Key Result"**:

- Title: `Ship 4 features end-to-end`
- Metric type: `NUMBER`
- Target value: `4`
- Unit: `features`
- Assignees: pick two direct reports (say Alice and Bob)
- Due date: `2026-03-25`

KR is created with `currentValue=0`, `score=0.00`, `status=ON_TRACK`.

### 5.3 Employee submits a check-in (US3 cameo)

Sign in as **Alice** (Employee) in a third window. Navigate to `/my-okrs`. Under "KRs assigned to me", click **"Log check-in"** on the engineering KR:

- New value: `2`  (two features shipped)
- Comment: `Billing-A and SSO-B are live in staging.`

On submit, the check-in is created with `status=PENDING` (parent Objective is DEPARTMENT-level — the auto-approve rule does NOT apply). `okr.checkin_submitted` is emitted. Manager's bell badge increments.

### 5.4 Manager approves the check-in

Back in the Manager window. The drawer item links to `/okr-dashboard?cycleId=<Q1 id>&review=<check-in id>`. The review queue shows Alice's pending check-in. Click **Approve**.

After the transaction commits:
- KR `currentValue` updates to `2`, `score` updates to `0.50` (2 / 4), status stays `ON_TRACK`.
- `okr.checkin_approved` is emitted.
- Alice receives an `OKR / INFO` notification: "Your check-in on Ship 4 features end-to-end was approved. New KR score: 0.50".

### 5.5 Reject another check-in (verify rejection path)

Have Alice submit a second check-in with `value: 4`, `comment: "all four done!"` (intentionally optimistic). In the Manager window, click **Reject** with reason `"Audit-log feature is not in production yet — please re-base."`.

After commit, Alice receives an `OKR / DECISION_PENDING` notification whose body includes the reason verbatim. The KR's `currentValue` and `score` are NOT updated.

---

## 6. Employee creates a personal OKR (US3)

Still in Alice's window. Navigate to `/my-okrs`. Click **"Create personal Objective"**:

- Level: `EMPLOYEE` (pre-selected)
- Parent: pick the department Objective from §5.1 (only ACTIVE department Objectives in Alice's department appear)
- Title: `I own the SSO feature end-to-end`
- Description: `Drive design, implementation, rollout, and design-partner demo for the SSO feature.`

Activate the Objective. Add a personal KR:

- Title: `Demo SSO to 2 design partners`
- Metric type: `NUMBER`
- Target value: `2`
- Unit: `demos`

Click **"Log check-in"** on this personal KR with `value: 1`. Because Alice owns the parent Objective AND submitted the check-in, the auto-approve rule fires:

- Status: `APPROVED` immediately.
- KR `currentValue` → `1`, `score` → `0.50`.
- `reviewedById`: null, `reviewedAt`: now (= time of submission).
- **No `okr.checkin_submitted` event is emitted**, **no `okr.checkin_approved` event is emitted**, **no notification fires**. The auto-approval path is silent by design.

Verify: the check-in shows green `APPROVED` in Alice's history; the Manager's bell does NOT increment.

---

## 7. Verify the dashboard (US4)

Sign in as each role and open `/okr-dashboard?cycleId=<Q1 id>`:

- **EXECUTIVE**: sees the company Objective, all department Objectives, all KRs, the aggregated per-department score bar, and the at-risk count.
- **HR_ADMIN**: same view as Executive plus edit/HR_ADMIN-only management actions.
- **MANAGER**: sees the company Objective (read-only), their own department's Objectives + KRs, and the at-risk count for their dept only.
- **EMPLOYEE** (Alice): sees company Objective (read-only context), her department's Objective + KR (read-only), and her personal Objective + KR (with check-in form).

Change the cycle selector to a previous (closed) cycle — the dashboard re-queries; closed cycles render with a "CLOSED" badge.

---

## 8. Exercise the Career Agent's OKR tools (AI Integration)

> Requires the AI Agentic service to be running (`turbo dev --filter=ai-agentic`).

In Alice's window, open the Career Agent chat (`/chat` or whichever route the Career Agent UI lives on).

### 8.1 Suggest a Key Result

Type: `"Help me draft 2 measurable Key Results for my Objective 'I own the SSO feature end-to-end'"`.

The agent invokes `suggestKeyResults` tool (LLM is called with the deterministic prompt from [contracts/career-agent-tools.md](./contracts/career-agent-tools.md)). Response: a list of 2–4 KR proposals each with `title`, `metricType`, `targetValue`, `unit`, and a one-paragraph `rationale`. A **"Create this in my OKRs"** button next to each proposal deep-links to `/my-okrs` with the draft pre-filled in the URL hash.

### 8.2 Draft a personal Objective

Type: `"Draft a personal OKR aligned to the Engineering department's 'Ship 4 features' Objective."`.

The agent invokes `suggestObjectiveDraft` (passing Alice's `employeeId` and the dept Objective id from earlier). Response: one draft Objective with `title`, `description`, `alignedTo: "Engineering ships 4 enterprise features"`, and `rationale`.

### 8.3 Flag at-risk OKRs (Manager only)

Switch to the Manager window. Open the Career Agent. Type: `"Which of my team's Key Results are at risk this quarter?"`.

The agent invokes `flagAtRiskOkrs` (passing the Manager's `employeeId` and Q1 2026's `cycleId`). The tool calls `GET /api/hr/okr-analytics/cycle/<Q1 id>/summary` — server-side scope-filters to the Manager's department. No KRs are at risk yet (we only had one check-in with score 0.5), so the response is "Good news — no Key Results are below the 0.3 risk threshold in Engineering this quarter."

To force the at-risk path: create another KR, log a check-in with a tiny value (`value: 0.1` on a `targetValue: 10` NUMBER KR), approve it; the score is `0.01 < 0.3` and the next `flagAtRiskOkrs` call reports it.

### 8.4 RBAC degradation

Switch back to Alice (EMPLOYEE) and ask: `"What's at risk in Engineering this quarter?"`. The agent invokes `flagAtRiskOkrs` → HR Core returns 403 → `GracefulDegradationHandler` returns `AgentDegradationResult` → agent replies: "I can't show you department-level risk data — that's visible to your Manager and HR. I can share your own portfolio if you'd like." `AgentTaskLog.status` is recorded as `DEGRADED`.

---

## 9. Reminder cron (manual trigger for testing)

The reminder scheduler runs daily at `09:00`. To exercise it locally without waiting:

```bash
# Connect to HR Core's REPL / shell and call the scheduler manually, OR temporarily change the cron expression in
# apps/hr-core/src/modules/okrs/scheduler/okr-reminder.scheduler.ts to '*/2 * * * *' (every 2 min)
# Then update an active cycle's endDate to today + 14 days:
psql "$HR_CORE_DATABASE_URL" -c \
  "UPDATE hr_core.okr_cycles SET end_date = (CURRENT_DATE + INTERVAL '14 days')::date WHERE name = 'Q1 2026';"
```

Wait for the next cron tick. Any active employee assigned to KRs with no approved check-in in the last 14 days receives an `OKR / DECISION_PENDING` reminder. Restore the production cron expression and revert the endDate before committing.

---

## 10. Run the tests

```bash
# Unit + controller tests for the new OKR module
turbo test --filter=hr-core -- --testPathPattern=okrs

# Integration tests
turbo test:integration --filter=hr-core -- --testPathPattern=okrs

# AI Agentic tool tests
turbo test --filter=ai-agentic -- --testPathPattern=okr-tools
```

Expected coverage thresholds:

- `OkrCyclesService`, `ObjectivesService`, `KeyResultsService`, `OkrCheckInsService`: ≥ 80 % lines each.
- `kr-score.util.ts`, `okr-rbac.util.ts`: ~100 % branch (pure functions, easy to certify).
- `okr.rules.ts` routing rules: ~100 % branch (per the feature 010 convention).
- Three AI tools in `okr-tools/`: each has at minimum a happy-path test, a 403 degradation test, and an input-validation test.

---

## 11. Tour of the source

| Path | Purpose |
|---|---|
| `apps/hr-core/src/modules/okrs/okrs.module.ts` | Module wiring; imports `PrismaModule` + `EVENT_BUS` |
| `apps/hr-core/src/modules/okrs/cycles/okr-cycles.{controller,service}.ts` | Cycle CRUD + lifecycle transitions |
| `apps/hr-core/src/modules/okrs/objectives/objectives.{controller,service}.ts` | Objective CRUD + alignment validation + cascade-cancel |
| `apps/hr-core/src/modules/okrs/key-results/key-results.{controller,service}.ts` | KR CRUD + scoring formula + auto-status flip |
| `apps/hr-core/src/modules/okrs/check-ins/okr-check-ins.{controller,service}.ts` | Submit + approve + reject + auto-approval rule |
| `apps/hr-core/src/modules/okrs/analytics/okr-analytics.{controller,service}.ts` | Dashboard summary + employee portfolio aggregations |
| `apps/hr-core/src/modules/okrs/scheduler/okr-reminder.scheduler.ts` | Daily 09:00 cron — emits `okr.checkin_reminder_due` |
| `apps/hr-core/src/modules/okrs/util/kr-score.util.ts` | Pure scoring functions per `metricType` |
| `apps/hr-core/src/modules/okrs/util/okr-rbac.util.ts` | Level-aware permission predicate |
| `apps/hr-core/src/modules/notifications/events/routing-rules/okr.rules.ts` | One new routing-rule file for the five OKR notification events |
| `apps/ai-agentic/src/tools/okr-tools/suggest-objective-draft.tool.ts` | Career Agent tool #1 |
| `apps/ai-agentic/src/tools/okr-tools/suggest-key-results.tool.ts` | Career Agent tool #2 |
| `apps/ai-agentic/src/tools/okr-tools/flag-at-risk-okrs.tool.ts` | Career Agent tool #3 |
| `apps/web/src/pages/okr-dashboard.tsx` | Role-aware health view (US4) |
| `apps/web/src/pages/okr-cycle-management.tsx` | HR_ADMIN cycle CRUD (US1) |
| `apps/web/src/pages/my-okrs.tsx` | Employee personal OKR workspace (US3) |
| `apps/web/src/components/okrs/*` | Alignment tree, KR progress bar, check-in form, review queue, cycle selector |
| `apps/web/src/lib/api/hr-core.ts` | Extended with `getOkrCycles`, `createOkrCycle`, `activateCycle`, `closeCycle`, `getObjectives`, `createObjective`, `getObjective`, `updateObjective`, `getKeyResults`, `createKeyResult`, `updateKeyResult`, `submitCheckIn`, `getCheckIns`, `approveCheckIn`, `rejectCheckIn`, `getOkrCycleSummary`, `getEmployeeOkrPortfolio` |

---

## 12. Adding a new OKR-domain notification later

If a future task adds (say) an `okr.kr_overdue` event when a KR passes its `dueDate` without reaching `ACHIEVED`:

1. Emit the event from the OKR service that detects the condition (likely the reminder scheduler), after-commit.
2. Add a new exported function in `okr.rules.ts → onKrOverdue`.
3. Register the event type → rule mapping in `notifications-events.bridge.ts`.
4. Add a renderer entry in `notifications.renderers.ts` for `(OKR, <chosen eventType>)`.
5. Add a Jest unit test for the rule.
6. Update [contracts/event-subscriptions.md](./contracts/event-subscriptions.md) with the new row.

No new table, no new controller, no new notification category — `OKR` already covers all OKR-domain notifications.

---

## 13. Troubleshooting

- **Cycle activate returns 400 `EndDateInPast`** — the cycle's `endDate` is already in the past; activate makes no business sense.
- **Create Objective returns 400 `ParentNotActive`** — the parent Objective is in `DRAFT` or `CLOSED`. Activate the parent first.
- **Create Objective returns 400 `CrossDepartmentAlignment`** — employee's `departmentId` does not match the parent department Objective's `departmentId`. Employees can only align to their own department.
- **Check-in submitted but no manager notification** — likely the parent Objective is `EMPLOYEE`-level owned by the submitter; the auto-approve rule fired and skipped the notification on purpose (FR-016, FR-024 silent path). Submit on a department KR to test the manager-routing path.
- **Manager sees an empty review queue after a check-in submission** — verify the parent Objective's `departmentId` matches the Manager's `user.departmentId`. The router resolves recipients at event-handle time.
- **`flagAtRiskOkrs` returns "no at-risk KRs" but the dashboard shows some** — the tool requires KRs to have at least one approved check-in (a brand-new KR with score 0 by default does not qualify as at-risk). Submit and approve a low-value check-in to trigger.
- **Dashboard `at-risk` count differs from the spec rule** — verify the dashboard query includes `EXISTS (SELECT 1 FROM okr_check_ins WHERE key_result_id = kr.id AND status = 'APPROVED')` in the inline at-risk computation (research R8).
