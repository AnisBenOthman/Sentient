---
description: "Cross-artifact consistency analysis for 011-okr-module — spec/plan/data-model/contracts/tasks coherence check before implementation"
---

# Cross-Artifact Analysis: 011-okr-module

**Date**: 2026-05-17
**Inputs analysed**:
- [spec.md](./spec.md) (278 lines)
- [plan.md](./plan.md) (282 lines)
- [research.md](./research.md) (266 lines, 12 decisions)
- [data-model.md](./data-model.md) (559 lines, 4 physical tables, 7 enums, 11 indexes, 6 CHECK constraints)
- [contracts/rest-api.md](./contracts/rest-api.md) (603 lines, ~18 endpoints)
- [contracts/event-subscriptions.md](./contracts/event-subscriptions.md) (207 lines, 7 events, 5 routing rules)
- [contracts/career-agent-tools.md](./contracts/career-agent-tools.md) (348 lines, 3 tools)
- [quickstart.md](./quickstart.md) (346 lines)
- [tasks.md](./tasks.md) (431 lines, T001–T138)

This report follows the speckit-analyze contract: surface every defect that would derail implementation if missed; classify by severity; propose minimal fixes; do NOT edit the spec artifacts.

---

## Coverage matrices (all green except where noted)

### Functional Requirements → Tasks

| FR | Topic | Covering tasks | Status |
|---|---|---|---|
| FR-001 | Cycle types + parent | T011, T021, T046 | ✅ |
| FR-002 | Cycle state machine | T046, T048, T049 | ✅ |
| FR-003 | Emit `okr.cycle_activated` | T048, T060 | ✅ |
| FR-004 | Closed cycle blocks creation | T054 (`CycleNotActive`), T075, T081 | ✅ |
| FR-005 | List cycles filtered | T022, T047, T051 | ✅ |
| FR-006 | COMPANY Objectives | T054, T057 | ✅ |
| FR-007 | DEPARTMENT Objectives | T070, T073 | ✅ |
| FR-008 | EMPLOYEE Objectives | T102 | ✅ |
| FR-009 | Reject CLOSED/CANCELLED parent | T054, T070, T102 | ✅ |
| FR-010 | Soft-delete via CANCELLED + cascade | T072 | ✅ |
| FR-011 | KR fields | T011, T026 | ✅ |
| FR-012 | Score formula | T017, T018, T082 | ✅ |
| FR-013 | At-risk computed flag | T032, T110 | ✅ |
| FR-014 | Manager/HR_ADMIN updates KR | T076, T079 | ✅ |
| FR-015 | Assignee submits check-in | T081 | ✅ |
| FR-016 | Auto-approval (owner of personal) | T103 | ✅ |
| FR-017 | PENDING for non-personal | T081 | ✅ |
| FR-018 | Approve check-in (cv+score+event) | T082, T087 | ✅ |
| FR-019 | Reject with reason | T083, T088 | ✅ |
| FR-020 | Emit `okr.checkin_submitted` | T081 | ✅ |
| FR-021 | Cycle CLOSED auto-rejects PENDING | T049 | ⚠ ambiguous — see F8 |
| FR-022 | `cycle_activated` → broadcast notification | T060, T061 | ⚠ stale wording — see F3 |
| FR-023 | `checkin_submitted` → Manager | T089 | ✅ |
| FR-024 | `checkin_approved` → submitter INFO | T090 | ✅ |
| FR-025 | `checkin_rejected` → submitter w/ reason | T091 | ✅ |
| FR-026 | 14-day reminder | T126, T127, T128 | ✅ |
| FR-027 | Career Agent 3 tools | T120, T121, T122 | ✅ |
| FR-028 | Career Agent tool RBAC | T120–T122 (via HrCoreClient + 403 degradation) | ⚠ contract drift — see F2 |
| FR-029 | `objective_created` → Career Agent opt-in | T125 | ✅ |
| FR-030 | `objective_closed` → performance summary | T125 | ✅ |
| FR-031 | OKR Dashboard endpoint | T110, T112 | ✅ |
| FR-032 | Employee portfolio endpoint | T111, T113 | ✅ |
| FR-033 | Guards everywhere + service-layer scope | T035, T037, T039, T041, T043, T019 | ✅ |
| **FR-034** | **Status-transition audit log** | **NONE** | ❌ — see F1 |
| FR-035 | Post-commit event emission | T048, T071, T082, T083, T103, T105, T134 | ✅ |
| FR-036 | Check-in visibility scope | T084 (uses `scopeForCheckInList`) | ✅ |

### Endpoints → Frontend wiring

All 18 REST endpoints (cycles 4, objectives 5, key-results 3, check-ins 4, analytics 2) have a backend implementation task **and** a typed Axios function task. ✅

### Events → Emit + Route

| Event | Emit task | Route task | Bridge registration |
|---|---|---|---|
| `okr.cycle_activated` | T048 | T060 `onCycleActivated` | T062 |
| `okr.objective_created` | T054, T102 | — (Career Agent only) | T125 |
| `okr.objective_closed` | T049, T071 | — (Career Agent only) | T125 |
| `okr.checkin_submitted` | T081 | T089 `onCheckInSubmitted` | T093 |
| `okr.checkin_approved` | T082 | T090 `onCheckInApproved` | T093 |
| `okr.checkin_rejected` | T083 | T091 `onCheckInRejected` | T093 |
| `okr.checkin_reminder_due` | T126 | T127 `onReminderDue` | T128 |

✅ All 7 events accounted for.

---

## Findings

### F1 — CRITICAL — FR-034 (audit log of status transitions) has no implementation path

**Requirement (spec.md FR-034)**: "All status transitions on Cycle, Objective, KeyResult, and OkrCheckIn MUST be logged with actor user id, timestamp, and (where applicable) reason, so an audit log can be reconstructed from the database."

**Reality (data-model.md §2)**: The data model captures actor/timestamp for **two** transitions only:
- `Objective.createdById` (creation only — not subsequent transitions)
- `OkrCheckIn.reviewedById` + `reviewedAt` + `rejectionReason` (approve/reject only)

**Missing actor/timestamp columns for**:
- `OkrCycle.activatedById` / `activatedAt` / `closedById` / `closedAt` — no record of who activated or closed a cycle.
- `Objective.closedById` (only `closedAt` exists) — no actor for close.
- `Objective.cancelledById` (only `cancelledAt` exists) — no actor for cancel.
- `KeyResult` — no transition log at all (only `updatedAt`); cannot answer "who flipped this KR to AT_RISK".

No task implements this. T034–T044 build the module skeleton; T046–T049, T071, T082, T083 implement state transitions but do not persist actor/timestamp beyond what the schema already has.

**Severity**: CRITICAL. FR-034 is explicitly mandated, and SC-004/SC-007 implicitly depend on it (auditors need to know who closed a cycle). Ignoring FR-034 means shipping the feature non-compliant with its own spec.

**Recommended fix** (small, additive, no schema rewrite):
- Add nullable timestamp + actor columns to `OkrCycle` (`activated_at`, `activated_by_id`, `closed_at`, `closed_by_id`) and to `Objective` (`closed_by_id`, `cancelled_by_id`).
- For `KeyResult` status transitions, the **simplest** option is to reuse the existing project pattern: log each transition into `AgentTaskLog` (cross-domain audit table) OR introduce a small `key_result_status_history` table (4 columns: `id`, `kr_id`, `status`, `changed_by_id`, `changed_at`). Either is a single migration and one service utility.
- Add tasks: extend T011 (schema), add columns to T015 migration, and add a tiny `auditStatusChange()` helper invoked from T048/T049/T071/T076/T082/T083.

If full audit logging is **deliberately deferred** to a later release, then FR-034 must be relaxed in spec.md (e.g. scoped down to "OkrCheckIn transitions are auditable; cycle/objective/KR transitions captured opportunistically via `updatedAt`"). Either fix the implementation **or** weaken the requirement — do not ship with the gap silent.

---

### F2 — HIGH — Career Agent RBAC mismatch between spec and contract

**spec.md** (RBAC matrix line 215): `Invoke Career Agent OKR tools | EMPLOYEE ✅ (own) | MANAGER ✅ (own + reports) | HR_ADMIN ✅ | EXECUTIVE ❌`

**spec.md FR-028**: `suggestObjectiveDraft and suggestKeyResults require the caller to be the employee/owner or that employee's Manager or HR_ADMIN; flagAtRiskOkrs requires the caller to be a Manager (own department) or HR_ADMIN.`

Both spec sources are consistent: **EXECUTIVE is forbidden for all three OKR tools**.

**contracts/career-agent-tools.md** disagrees:
- Tool 1 (`suggestObjectiveDraft`): EXECUTIVE = ❌ (matches spec) ✅
- Tool 2 (`suggestKeyResults`): `EXECUTIVE | Allowed (read-only — Executives may draft KRs as suggestions for HR_ADMIN to consider)` ❌ contradicts spec
- Tool 3 (`flagAtRiskOkrs`): `EXECUTIVE | ✅ (read-only, all departments)` ❌ contradicts spec

The implementing tasks (T120–T122) defer RBAC entirely to "what HR Core enforces". So whichever side wins, the underlying REST endpoint's `@Roles()` decoration is what matters. Currently:
- `GET /api/hr/objectives/:id` and `GET /api/hr/employees/:id` (used by Tool 1 + Tool 2) are not gated to EXECUTIVE by FR-028 — but the existing endpoint may be more permissive.
- `GET /api/hr/okr-analytics/cycle/:id/summary` (used by Tool 3) per rest-api.md §5 line 410: `@Roles('MANAGER', 'HR_ADMIN', 'EXECUTIVE')` — explicitly **includes** EXECUTIVE. So the underlying REST endpoint allows EXECUTIVE, meaning Tool 3 will work for EXECUTIVE in practice even though FR-028 forbids it.

**Severity**: HIGH. This is a real disagreement that will produce inconsistent behaviour: spec says ❌ but the implementation (driven by underlying REST RBAC) will say ✅. Either:
1. Update spec FR-028 + RBAC matrix to permit EXECUTIVE on Tools 2 & 3 (and reflect in tasks if controller-level enforcement is added), OR
2. Update contracts/career-agent-tools.md to forbid EXECUTIVE on Tools 2 & 3, AND tighten `@Roles()` on `GET /api/hr/okr-analytics/cycle/:id/summary` to exclude EXECUTIVE for these tool callers (which would also revoke EXECUTIVE's access to the OKR Dashboard summary endpoint — probably **not** what's intended).

**Recommended resolution**: option 1 — relax spec to allow EXECUTIVE on Tools 2 & 3. Rationale: EXECUTIVE already has read access to the analytics endpoints and to all Objectives via the dashboard; allowing them to invoke the AI tools is consistent and adds no new privilege.

---

### F3 — HIGH — FR-022 wording is stale relative to the resolved decision

**spec.md FR-022**: "`okr.cycle_activated` MUST be routed via the existing notifications module (feature 010) as a broadcast **SYSTEM** notification to every active employee with body 'Cycle <name> is now active'."

**Resolved decision** (research.md R5, data-model.md §2 migration, event-subscriptions.md routing table, tasks.md T009/T015/T060): the OKR notification category is `OKR` (new enum value added to `NotificationCategory`), **not** `SYSTEM`. The body template (event-subscriptions.md line 130) is `The <type> cycle "<cycleName>" runs <startDate> to <endDate>. Open your OKR workspace to align your goals.` — richer than FR-022's stub.

The spec.md text at line 252 already flags the decision was "deferred to research.md R5". R5 has been answered (OKR), but the FR text upstream was never reconciled.

**Severity**: HIGH for spec hygiene. The implementation is correct (all artefacts agree on `OKR`); only FR-022 is stale. Implementers reading FR-022 first will get the wrong signal.

**Recommended fix**: Rewrite FR-022 to: "`okr.cycle_activated` MUST be routed via the existing notifications module (feature 010) as a broadcast notification in the new `OKR` category to every active employee. Title/body template per [contracts/event-subscriptions.md](./contracts/event-subscriptions.md)."

---

### F4 — MEDIUM — Entity count disagreement (29 vs 28)

- **spec.md** Assumptions §11: "All five entities live in `hr_core` schema... raising the total to 29."
- **plan.md** Summary §1: "five new entities — `OkrCycle`, `Objective`, `KeyResult`, `OkrCheckIn`, and the conceptual `OkrAlignment`" — but only 4 are tables.
- **tasks.md** T137: "bump from 24 to **28** to reflect the four new OKR entities"
- **CLAUDE.md** §6 currently records 24 HR Core entities.

If we count physical tables: 24 + 4 = 28. If we count conceptual entities (including `OkrAlignment` which is not a table): 24 + 5 = 29.

**Severity**: MEDIUM. Cosmetic but will produce inconsistent documentation depending on which file the next developer reads first.

**Recommended fix**: pick **28** (physical tables) and update spec.md Assumptions §11 to: "All four new physical entities live in `hr_core` schema... raising the total to 28. (OkrAlignment is modelled via `Objective.parentObjectiveId`, not a physical table.)"

---

### F5 — MEDIUM — data-model.md miscounts "Five new tables"

**data-model.md line 6**: "Five new tables in the `hr_core` schema, seven new enums."

§2 lists exactly **4** `model` declarations (`OkrCycle`, `Objective`, `KeyResult`, `OkrCheckIn`). The fifth entity (`OkrAlignment`) is explicitly **not** a table (line 8 footnote).

**Severity**: MEDIUM. Misleading first sentence contradicts the body of the same document.

**Recommended fix**: Change line 6 to "Four new tables in the `hr_core` schema, seven new enums. (A conceptual fifth entity, `OkrAlignment`, is modelled via `Objective.parentObjectiveId` — see footnote below.)"

---

### F6 — LOW — tasks.md T015 says "five CHECK constraints" but enumerates six

**T015**: "Manually append the **five** CHECK constraints (`ck_kr_score_range`, `ck_checkin_score_range`, `ck_kr_target_positive`, `ck_cycle_quarter_range`, `ck_cycle_parent_type`, `ck_objective_level_invariants`)"

Six identifiers, word "five". Will not cause an implementation bug — the implementer copies the six identifiers verbatim — but the word is wrong.

**Recommended fix**: change "five" → "six".

---

### F7 — LOW — plan.md mentions a `current_value >= 0` CHECK that data-model.md does not declare

**plan.md §1.1**: "CHECK constraints: `score BETWEEN 0 AND 1`, `current_value >= 0`, `target_value > 0` (PERCENTAGE/NUMBER/CURRENCY), `quarter BETWEEN 1 AND 4` (when set)."

**data-model.md §2** declares: `ck_kr_score_range`, `ck_checkin_score_range`, `ck_kr_target_positive`, `ck_cycle_quarter_range`, `ck_cycle_parent_type`, `ck_objective_level_invariants`. No `current_value >= 0` constraint.

**Severity**: LOW. `currentValue` is overwritten only by approved check-ins whose `value` is validated via the score-range CHECK indirectly (score = currentValue/targetValue ∈ [0,1] implies currentValue ≥ 0 only when targetValue ≥ 0 — which IS enforced via `ck_kr_target_positive`). So the invariant is **transitively** enforced, but a dedicated `ck_kr_current_value_nonneg` would be belt-and-braces.

**Recommended fix** (optional): add `ALTER TABLE hr_core.key_results ADD CONSTRAINT ck_kr_current_value_nonneg CHECK ("current_value" >= 0);` to the migration in T015. Update T015 enumeration to seven constraints. Or update plan.md to remove the `current_value >= 0` mention.

---

### F8 — LOW — Ambiguity: cycle-close auto-rejected check-ins do NOT emit `okr.checkin_rejected`

**spec.md FR-021**: "When the parent cycle transitions to `CLOSED`, all `PENDING` check-ins in that cycle MUST be auto-rejected with a system-generated reason 'Cycle closed before review'."

**tasks.md T049** implements the auto-rejection (status flip + rejection reason) but only emits `okr.objective_closed` events, **not** `okr.checkin_rejected` per auto-rejected check-in.

**contracts/event-subscriptions.md** confirms: `okr.checkin_rejected` source is `OkrCheckInsService.reject(id, dto, user)` — only the manual rejection path.

**Implication**: Submitters whose pending check-ins are auto-rejected by cycle close will NOT receive a notification. They will only discover the rejection by visiting their check-in history.

**Severity**: LOW. Defensible product decision (avoid notification spam during cycle wrap-up) but it is currently implicit. Could surprise users; could surprise an auditor reading FR-025 ("`okr.checkin_rejected` routed to submitter with reason verbatim").

**Recommended fix**: add an explicit assumption to spec.md and a one-line note to event-subscriptions.md: "Check-ins auto-rejected by `OkrCyclesService.close()` (cascade) do NOT emit `okr.checkin_rejected` and produce no notification. The rejection is visible in the submitter's check-in history with system-generated `rejectionReason`."

Alternatively, if notifications **are** desired in that path: T049 must emit one `okr.checkin_rejected` per auto-rejected check-in, with `reviewerId = null` and `reason = 'Cycle closed before review'`. This is a small change to T049.

---

### F9 — LOW — Incomplete frontend error-code mappings in task descriptions

Per `.claude/rules/frontend-backend-coherence.md` rule §3 (Error Codes Must Be Fully Mapped), every backend `throw new BadRequestException('Code')` must have a frontend `onError` mapping.

Verified gaps in **task descriptions** (the implementer would still write them in code if attentive, but the task wording leaves room for slippage):

- **T067 `objective-form.tsx`** — task description names no error mappings at all. Backend codes from T054 (`CycleNotActive`, `ParentNotFound`, `ParentWrongLevel`, `ParentNotActive`, `LevelMismatch`) and T070 / T102 (`CrossDepartmentAlignment`) should all be mapped here. **T108** adds `CrossDepartmentAlignment` mapping for `my-okrs.tsx` but the same mappings need to be in `objective-form.tsx` when used from `okr-cycle-management.tsx`.
- **T101 (KR section of cycle-management page)** — task description doesn't enumerate KR error codes: `ObjectiveNotActive`, `BooleanTargetMustBeOne`, `TargetMustBePositive`, `AssigneeNotFound`.
- **T100 `check-in-review-queue.tsx`** — maps `CheckInNotPending` and `WrongDepartment` ✅ but does not mention `ReasonRequired` (from T083). The reject dialog needs that mapping.

**Severity**: LOW. Implementer who follows the coherence rule strictly will catch this in code review. Worth tightening the task descriptions so the requirement is unmissable.

**Recommended fix**: Edit task descriptions T067, T100, T101 to explicitly enumerate the error code → message mappings, mirroring the format used in T068, T106, T108.

---

## Constitution re-check (post-Phase 1)

Plan.md §"Constitution Check" passed pre-design. Re-running against the now-detailed artefacts:

| Gate | Status | Notes |
|---|---|---|
| No `any`; strict TS; explicit return types | PASS | Tasks reference shared enums + Prisma-generated types throughout. |
| Modular NestJS Module→Controller→Service | PASS | OkrsModule with five service+controller pairs (T044) + analytics. |
| `@@schema()` + `@@map()` on every Prisma model | PASS | All 4 models annotated in data-model.md §2. |
| Every endpoint guarded | PASS | T035/T037/T039/T041/T043 declare `@UseGuards`. RBAC enforced via service-layer `okr-rbac.util.ts` (T019/T020). |
| No cross-service DB queries | PASS | Career Agent talks to HR Core via `HrCoreClient` only (T119). |
| EventBus abstraction | PASS | 7 events via `IEventBus.emit()` post-commit. |
| DTOs validate at boundary | PASS | T021–T029 DTOs with class-validator. |
| Prisma `DROP INDEX` for `@@unique` renames | N/A | Additive migration only. |
| No cross-app source imports | PASS | OkrTools live under `apps/ai-agentic/src/tools/okr-tools/`. |
| Pre-IAM RBAC convention | N/A | IAM is in place (`project_iam_integration_progress.md`). |
| Notification routing convention (CLAUDE.md) | PASS | Single `okr.rules.ts` file added; OKR module never calls `NotificationsService`. |
| Frontend↔Backend coherence | PARTIAL | Coverage matrix above ✅ for endpoints + types; ⚠ error-code mapping incompletely specified in three task descriptions (F9). |

**Verdict**: PASS with one partial (F9 — task-description tightening, not an implementation blocker).

---

## Severity-ranked summary

| ID | Severity | Title | Where | Recommended action |
|---|---|---|---|---|
| F1 | CRITICAL | FR-034 audit log has no implementation | spec.md vs data-model.md vs tasks.md | Add actor/timestamp columns to `OkrCycle` + `Objective` and a small KR transition history table; add migration + helper to T015/T076; OR weaken FR-034 in spec.md. |
| F2 | HIGH | EXECUTIVE RBAC mismatch for Career Agent Tools 2 & 3 | spec RBAC matrix + FR-028 vs career-agent-tools.md | Update spec to permit EXECUTIVE on Tools 2 & 3 (matches existing analytics endpoint RBAC). |
| F3 | HIGH | FR-022 wording stale (says SYSTEM, should say OKR) | spec.md FR-022 vs research R5 | Rewrite FR-022 to reference the new `OKR` category. |
| F4 | MEDIUM | Entity count 29 vs 28 | spec.md vs plan.md / tasks.md T137 | Standardise on **28** physical entities; clarify conceptual `OkrAlignment` parenthetically. |
| F5 | MEDIUM | data-model.md says "Five new tables" but lists 4 | data-model.md line 6 | Change "Five" → "Four"; clarify in footnote. |
| F6 | LOW | T015 says "five" but enumerates six CHECK constraints | tasks.md T015 | One-word fix: five → six. |
| F7 | LOW | plan.md mentions `current_value >= 0` CHECK not in data-model.md | plan.md §1.1 vs data-model.md §2 | Either add `ck_kr_current_value_nonneg` to migration or remove the mention from plan.md. |
| F8 | LOW | Ambiguity: cycle-close auto-reject does NOT emit `okr.checkin_rejected` | spec.md FR-021 implicit; tasks.md T049 silent | Add explicit assumption to spec.md and one-line note to event-subscriptions.md. |
| F9 | LOW | Three task descriptions don't enumerate frontend error-code mappings | tasks.md T067, T100, T101 | Edit task wording to list each `BadRequestException` code → frontend message, mirroring T068/T106. |

---

## Recommendation

**Do not start implementation (Phase 1 of tasks.md) until F1, F2, and F3 are resolved.** All three are spec-vs-implementation mismatches that will create silent drift during build.

F1 in particular is the most consequential: shipping with FR-034 unimplemented means the module is technically non-compliant with its own spec, and the audit-log gap is hard to retrofit without a second migration. Fixing it now (one extra task in Phase 2, two extra columns on two tables) is cheap.

F4–F8 can be batched into a single one-shot spec-cleanup commit after F1/F2/F3 land.
F9 is a tasks.md tightening — can be done at any time, ideally before tasks T067/T100/T101 are picked up.

After these are resolved, the package is ready for `/speckit-implement` or for tasks to be picked up one phase at a time per the dependency graph in tasks.md §Dependencies & Execution Order.

---

## Resolution log (2026-05-17, same day)

All nine findings were resolved in spec/plan/data-model/contracts/tasks artefacts before any code was written. Summary of what changed:

| ID | Resolution |
|---|---|
| **F1** | data-model.md §2 — added `activatedAt/By`, `closedAt/By`, `createdById` columns to `OkrCycle`; `activatedAt/By`, `closedById`, `cancelledById` to `Objective`. Added new `KeyResultStatusHistory` model + index (`idx_kr_status_history_kr_changed`). Added `current_value >= 0` CHECK. Added §2.5 FR-034 audit-trail summary table. Added ten User back-relations. spec.md FR-034 expanded to point at the schema. tasks.md T011/T012 updated; new T020a/T020b (audit utility + test) added; T046/T048/T049/T071/T072/T076/T082/T103 each updated to persist actor/timestamp atomically with the transition; new T105a integration test verifies the full audit trail across all four entities. |
| **F2** | spec.md FR-028 rewritten to permit EXECUTIVE on `suggestKeyResults` and `flagAtRiskOkrs` (consistent with the underlying analytics-endpoint RBAC). spec.md RBAC matrix line replaced with three per-tool rows. contracts/career-agent-tools.md unchanged (it was already correct). |
| **F3** | spec.md FR-022 rewritten to reference the `OKR` category + point at event-subscriptions.md for templates. |
| **F4** | spec.md Assumptions §11 standardised on 28 physical entities (24 + 4). plan.md Summary + Storage rewritten. tasks.md T137 updated. `KeyResultStatusHistory` explicitly NOT counted (it's an audit-log table, not a domain entity). |
| **F5** | data-model.md line 6 changed from "Five new tables" to "Four new tables ... plus a small audit table". |
| **F6** | tasks.md T015 corrected from "five" to "seven" CHECK constraints (six original + the new `ck_kr_current_value_nonneg`). |
| **F7** | data-model.md §2 migration block now declares `ck_kr_current_value_nonneg`. plan.md §1.1 cleaned up to enumerate all seven constraints. |
| **F8** | spec.md FR-021 made explicit ("These cascade rejections do NOT emit `okr.checkin_rejected` and do NOT produce per-submitter notifications ..."). event-subscriptions.md `okr.checkin_rejected` block has a new explanatory note. tasks.md T049 + T063 (integration test) rewritten to reflect this. |
| **F9** | tasks.md T067 + T100 + T101 task descriptions now enumerate every `BadRequestException` code mapping with the user-facing message, mirroring the format already used in T068/T106/T108. |

After this pass, all FRs (FR-001 through FR-036) are covered by tasks, spec/plan/data-model/contracts agree on entity count and notification category, and the Constitution Check still passes. **Status: ready for `/speckit-implement`.**
