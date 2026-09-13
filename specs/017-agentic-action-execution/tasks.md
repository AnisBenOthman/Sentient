# Tasks: Agentic Action Execution

**Input**: Design documents from `/specs/017-agentic-action-execution/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (51 FRs, 14 SCs), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **REQUESTED.** plan.md Technical Context names them explicitly — Jest unit tests per phase, contract tests for the new `HrCoreAiClient` write/read-back methods, integration tests for token single-use and scheduler suppression, Web type-check. SC-002 and SC-005 are demonstrable *only* through the double-tap and expired-token tests, so those are not optional extras.

**Organization**: Grouped by user story. US1–US3 are all P1 and together form the MVP — see Implementation Strategy.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)

---

## Design Stance: Harness Engineering, Not Loop Engineering

This was an open question going into Phase 2. The answer is not close, and it is worth stating here because it constrains almost every task below.

**A harness owns control flow; the model fills named slots.**

FR-003 and FR-006 decide it. The payload is frozen server-side at Propose, and Execute sends *that* payload — never one re-derived from the confirm turn. A loop architecture means the model decides *when* to write and *with what*; that is structurally incompatible with a frozen payload and a single-use token consumed before the call. Add D1's capability union — where a read-only specialist producing a confirmation payload is a **compile error** — and the result is a harness by definition.

The app is already built this way. `016-ai-module` ships a compiled LangGraph with conditional routing and a fixed three-phase gate, making exactly one LLM call per turn (the intent classifier). This feature extends that shape rather than introducing a second, looser one.

**The model gets exactly four slots. Nothing else calls an LLM:**

| # | Slot | Where |
|---|---|---|
| 1 | Intent + emotional-context classification | Existing Phase 2 supervisor gate (unchanged mechanism) |
| 2 | Leave-type resolution from natural phrasing | Feeds `getLeaveTypes()`; the resolved **id** is what gets used |
| 3 | Policy passage summarization for the card | Summarizes retrieved chunks only — never generates policy |
| 4 | Tone opener | `FinalAnswerNodeService`, driven by `emotionalContext` |

Business-day math, balance checks, overlap detection, token lifecycle, execution, verification, and audit are all deterministic code. If an implementation task appears to need a fifth LLM call, that is a signal the harness is being weakened — raise it rather than adding one.

### Reason begins with identity resolution, not with the message

Every Reason phase opens by resolving **who is asking** from their id, before interpreting what they asked for. This is deterministic fetch, not inference, and it strengthens the harness: every fact the harness establishes up front is a fact the model no longer has to guess at.

Four identity facts gate the reasoning that follows. Their availability differs sharply, and the tasks reflect that:

| Fact | Source | Status |
|---|---|---|
| **Leave balance** | `getLeaveContext(employeeId)` | ✅ Exists — returns `balances` *and* `recentRequests` in one call |
| **Business unit** | `JwtPayload.businessUnitId` → `actor.businessUnitId` | ✅ Already in the JWT and already threaded into actor context ([actor-context.factory.ts:27](../../apps/ai-agentic/src/common/graph/actor-context.factory.ts:27)) — **no fetch needed at all** |
| **Gender** | `Employee.gender` (`Gender?`, nullable) | ⚠️ Column exists, but `getEmployeeContext()` returns the loose `DownstreamSummary` (`{id?, title?, status?, summary?, metadata?}`) — it needs a typed profile shape (T016) |
| **Country** | — | ❌ **Does not exist.** See below |

**On gender**: it is used for one thing — resolving which leave types the employee is actually eligible for (parental/maternity/paternity entitlements are gender-conditional in many policies) and filtering policy retrieval accordingly. It is **not** used to decide how to address the user. The column is nullable, the value may be absent or not map to a policy category, and getting it wrong in prose is a worse failure than neutral language. Responses stay gender-neutral in tone regardless of what the column says. Because the agent reads the requesting user's own profile under their own OWN scope, no RBAC widening is involved.

**On country — this one required a schema decision.** `country` appears **0 times** in `apps/hr-core/prisma/schema.prisma`. Not on `Employee`, not on `BusinessUnit` (which has only free-text `address` and a 3-char `currency`). Separately, `regulationRegion` — the field `CLAUDE.md` §11 builds its entire dual-namespace region-filtered RAG design around — appears **0 times** in `apps/ai-agentic/prisma/schema.prisma`. That design was documented and never built, the same class of documentation drift as the stale "5 entities" count.

So country cannot be fetched; it has to be modelled first. **Decision: add `country` (ISO-3166-1 alpha-2) to `BusinessUnit`, not to `Employee`** — holidays and leave types are already business-unit-scoped, employees at one site share a country, and putting it on `Employee` would duplicate the same value across every row. Resolution is then free: `actor.businessUnitId` is already in the JWT.

> **Assumption flagged**: this breaks plan.md's claim that the only change outside `apps/ai-agentic`/`apps/web` is one RBAC line. It is now that plus one additive HR Core column (T019). If you would rather defer country and let `businessUnitId` serve as the regional proxy on its own, T019 and the region-filter half of T031 are the only tasks to drop — nothing else depends on them.

---

## Corrections to plan.md surfaced during task generation

Three assumptions in plan.md did not survive verification against the code. All are handled by tasks below; none change the design.

1. **`AgentContextFactory` does not exist.** plan.md D4 and spec Assumptions describe `AgentContextFactory.forSystemTask()` as "the project's sanctioned mechanism." Grep across `apps/ai-agentic/src` and `packages/shared/src` finds no implementation — only `shared-jwt.guard.ts:35`, which *verifies* a SYSTEM JWT, and `AgentContext.isSystemContext` as an interface field. Nothing **signs** one. It must be built (T071–T072). Scoped to US5 rather than Foundational because only the scheduler needs it — US1–US4 run on the forwarded user JWT, which does exist.

2. **FR-042 is not RBAC-only.** plan.md D4 calls it "RBAC-only — no new HR Core endpoint, no new write path." The endpoint and write-path claims hold, but adding `'SYSTEM'` to `@Roles` is not sufficient: `requests.controller.ts:103` calls `requireEmployeeId(user)`, which throws for a SYSTEM JWT (`sub: 'system'`, no `employeeId`). The service layer is already fine — `findOne(id, ownerId?)` at `requests.service.ts:205` takes an **optional** owner and guards with `if (ownerId && …)`, a post-fetch ownership throw rather than a `where` clause. So the fix is a two-line controller branch passing `undefined` for SYSTEM callers, with `patchAgentAssessment` (`requests.controller.ts:149`) as the precedent. No service change, no query change (T073).

3. **Region-filtered policy retrieval has no field to filter on.** `regulationRegion` is documented in `CLAUDE.md` §11 and absent from the schema. T019 supplies the country value; T031 does the filtering with a documented fallback for the un-tagged corpus that exists today.

---

## Phase 1: Setup

**Purpose**: The one genuinely new dependency and its configuration.

- [X] T001 Add `@nestjs/schedule` to dependencies in `apps/ai-agentic/package.json` and run `pnpm install` (verified absent — this is the feature's only new package)
- [X] T002 Register `ScheduleModule.forRoot()` in `apps/ai-agentic/src/app.module.ts` (verified unregistered today)
- [X] T003 [P] Add config entries to `apps/ai-agentic/src/config/` and `.env.example`: `AI_AGENT_ACTION_TOKEN_TTL_MINUTES` (default 15), `AI_AGENT_FOLLOWUP_DELAY_HOURS` (default 48), `AI_AGENT_FOLLOWUP_STALE_AFTER_HOURS` (default 24, for FR-038 backlog suppression)
- [X] T004 [P] Add `SYSTEM_JWT_SECRET` and `SYSTEM_JWT_EXPIRY` to `.env.example` if absent, matching the names `packages/shared/src/auth/shared-jwt.guard.ts:35` already reads

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type system, persistence, identity/client surface, and audit primitives that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Type system — the load-bearing change

> **T007 is the highest-risk task in this feature.** The failure mode is not a compile error; it is an implementer widening the type to `boolean`, watching six specialist specs break, and "fixing" them by loosening the assertions — silently deleting the exact guarantee D1 exists to preserve. The constraint is in the task text for that reason.

- [X] T005 Add `PENDING_CONFIRMATION` and `UNVERIFIED` members to `AgentRunStatus` in `packages/shared/src/enums/ai-agent-run-status.enum.ts`, and rebuild `@sentient/shared`
- [X] T006 Add the same two members to `enum AgentRunStatus` in `apps/ai-agentic/prisma/schema.prisma` (both declarations must move together — see research.md R2)
- [X] T007 Convert `SpecialistInput.constraints` to a discriminated union in `apps/ai-agentic/src/common/graph/agent-graph.types.ts:58`: read-only specialists keep the literal `readOnlyOfficialRecords: true`; an action-capable variant names the `AgentActionKind`s the specialist may propose. Update **all 11 referencing files** — `common/safety/draft-policy.service.ts`, `modules/agents/draft-readonly.spec.ts`, `modules/agents/supervisor-langgraph-runner.service.ts`, `modules/agents/specialists/{analytics,language,leave,okr}-agent.service.spec.ts`, `modules/agents/specialists/specialist-response.helpers.spec.ts`, `modules/agents/specialists/specialist-return-control.spec.ts`, `modules/analytics-sql/analytics-sql.service.spec.ts` (the last is inherited from the 016 tip). **Constraint: no assertion may be weakened for the seven read-only specialists.** A read-only specialist constructing a confirmation payload must remain a compile error.
- [X] T008 Create `apps/ai-agentic/src/common/safety/action-capability.ts` — the registry mapping `AgentType` → permitted `AgentActionKind[]`, with only `LEAVE_AGENT → [LEAVE_BOOKING]` populated
- [X] T009 Extend `SpecialistStatus` with `PENDING_CONFIRMATION`, `FAILED`, `UNVERIFIED` and `SpecialistResult` with optional `confirmationPayload`, `confirmationToken`, `emotionalContext` in `apps/ai-agentic/src/common/graph/agent-graph.types.ts` (FR-012)
- [X] T010 Construct the capability-aware `constraints` object for `LEAVE_AGENT` at the single construction site, `apps/ai-agentic/src/modules/agents/supervisor-langgraph-runner.service.ts:811`; all other specialists keep the read-only literal
- [X] T011 Make `MUTATION_TERMS` capability-aware in `apps/ai-agentic/src/common/safety/draft-policy.service.ts` (D2): a matched term becomes a capability *check* rather than a blanket refusal. If the specialist holds the capability for that action kind, route to Propose; otherwise the existing refusal stands verbatim. **"book it" currently hard-blocks this entire feature.** Implemented via a `TERM_ACTION_KINDS` map so the check is **action-level, not agent-level**: `submit`/`book it`/`save it to` → `LEAVE_BOOKING`; `approve`/`reject`/`delete`/`publish now`/`update the record` → `null`, meaning no specialist can ever bypass them until a matching action kind exists. An agent-level "holds any capability" check would have let LEAVE_AGENT past all five of those verbs

> **Known limitation carried forward from 016 (not introduced here)**: this gate is evaluated **once per turn** against `classification.requiredAgents[0]` ([supervisor-langgraph-runner.service.ts:355](../../apps/ai-agentic/src/modules/agents/supervisor-langgraph-runner.service.ts:355)) and its `draftBlock` short-circuits the whole turn. On a multi-agent turn routed `[LEAVE_AGENT, OKR_AGENT]`, only LEAVE_AGENT's capability is consulted. This cannot produce an unauthorized mutation — the constraints union still hands OKR_AGENT read-only constraints — but it can suppress an honest refusal. Making the gate per-agent is out of scope for 017.
- [X] T012 [P] Verify every pre-existing test in `apps/ai-agentic/src/modules/agents/draft-readonly.spec.ts` still passes unchanged for the seven read-only specialists, and add cases proving the Leave Agent's `LEAVE_BOOKING` capability does *not* grant it any other action kind

### Persistence

- [X] T013 Add `AgentActionKind` and `ActionProposalStatus` enums plus the `AgentActionProposal` and `ScheduledFollowUp` models to `apps/ai-agentic/prisma/schema.prisma` exactly as specified in [data-model.md](./data-model.md), including `token @unique`, `messageId @unique`, `@@index([status, expiresAt])`, `@@index([followUpAt, resolvedAt])`, and the `onDelete: Cascade` conversation relations
- [X] T014 Add back-relations `actionProposals`/`scheduledFollowUps` on `Conversation` and `actionProposal` on `Message` in `apps/ai-agentic/prisma/schema.prisma` (no column changes on either model)
- [X] T015 Generate the migration as `20260730000000_add_agent_action_proposal_and_scheduled_follow_up` in `apps/ai-agentic/prisma/migrations/` and verify it is additive only — no drops, no backfill, no unique-constraint replacement

### Identity and downstream client surface

- [X] T016 Add three methods to `apps/ai-agentic/src/common/clients/hr-core-ai.client.ts`: `getLeaveTypes(businessUnitId, context)`, `getLeaveRequestById(id, context)`, and a **typed** `getEmployeeProfileContext(employeeId, context)` returning at least `{ firstName, gender, businessUnitId, country }`. The existing `getEmployeeContext()` hits the right endpoint but returns the loose `DownstreamSummary` (`{id?, title?, status?, summary?, metadata?}`), which cannot carry `gender` as a checked field — do not bury identity facts in `metadata`
- [X] T017 Add `createLeaveRequest(payload, context)` to `apps/ai-agentic/src/common/clients/hr-core-ai.client.ts` — **the client's first write method.** It must classify non-2xx, timeout, and connection failure distinctly and surface the downstream reason verbatim (FR-007, FR-010); it must never swallow an error into a generic result
- [X] T018 Contract test for all four new methods, covering 201, 400 with a body reason, 403, 500, timeout, and connection-refused paths for `createLeaveRequest` (required by D5 — FR-007 depends on this classification being correct), plus a null-`gender` profile response. **Landed in two co-located specs, not under `test/contracts/`**: `apps/ai-agentic/src/common/clients/http-json.client.spec.ts` (the FR-007 status classification, which is `HttpJsonClient`'s own behavior) and additions to `apps/ai-agentic/src/common/clients/hr-core-ai.client.spec.ts` (path/payload shape). WHY: this app's `test/contracts/*.contract-spec.ts` convention verifies AI Agentic's own **inbound** API shape, not outbound calls to HR Core
- [X] T019 Add `country String? @db.VarChar(2)` (ISO-3166-1 alpha-2) to `model BusinessUnit` in `apps/hr-core/prisma/schema.prisma` with an additive migration, expose it on the employee-profile and business-unit read responses, and seed it for existing business units. **This column does not exist today** — `country` has 0 occurrences in the HR Core schema, and `BusinessUnit` carries only free-text `address` and a 3-char `currency`, neither of which is a reliable country signal. Nullable so existing rows stay valid; consumers must handle absence.

> **✅ APPLIED to the local dev database (2026-08-01).** Both services now report *"Database schema is up to date"*, and `country` is seeded: Sentient HQ→`DZ`, France→`FR`, UAE→`AE`, UK→`GB`. Getting there surfaced two pre-existing infrastructure problems that anyone provisioning a fresh environment will also hit:
>
> 1. **Two HR Core migrations were physically applied but never recorded.** `employees.gender` (+ the `Gender` type) and `business_units.currency` already existed in the database while `_prisma_migrations` showed both as pending — the signature of a `prisma db push` that bypassed the migration history. A plain `migrate deploy` would have failed on a duplicate column and left a *failed* migration row blocking all future migrations. Resolved with `prisma migrate resolve --applied` for both, after confirming the objects existed. The gender backfill in that migration never ran and did not need to — all 201 employees already have a gender value.
> 2. **`ai_agent` objects were owned by `postgres`, not `ai_agent_svc`.** `scripts/init-schemas.sql` grants `ALL PRIVILEGES` to the service role, but **grants are not ownership** — `ALTER TABLE` and `ALTER TYPE` require ownership, so *every* ai-agentic migration that alters an existing object fails with `42501`. `20260729000100_add_agent_task_log_generated_sql` failed exactly this way and had to be `resolve --rolled-back`. Fixed by transferring ownership of all 12 tables, 13 enum types, and sequences in `ai_agent` to `ai_agent_svc`. **`scripts/init-schemas.sql` should be amended to set ownership, not just grants** — otherwise the next fresh environment reproduces this. Note the asymmetry that hid it: `apps/hr-core/.env` and `apps/social/.env` connect as the `postgres` superuser, so their migrations never hit the ownership wall; only `apps/ai-agentic/.env` uses its dedicated role, as `.claude/rules/security.md` §8 intends for all three.

### Audit primitive

> `ActionAuditService` sits in Foundational rather than US6 because all three P1 phases write through it and cannot be built without it. **US6 is therefore scoped to what is genuinely audit-shaped** — the distinct propose-vs-confirm authorization records (FR-050), policy sources on the proposal entry (FR-051), and end-to-end chain-linkage verification. That is deliberate scoping, not a thin story.

- [X] T020 Create `apps/ai-agentic/src/modules/agents/actions/action-audit.service.ts` writing `action.proposed`, `action.executed`, `action.verified` entries through the existing `AgentTaskLogService`, linked via `parentLogId`, each carrying the existing required `correlationId` (FR-049)
- [X] T021 Add typed, class-validated `confirmed?: boolean` and `confirmationToken?: string` fields to `apps/ai-agentic/src/modules/conversations/dto/create-message.dto.ts`, matching [contracts/action-execution-api.yaml](./contracts/action-execution-api.yaml). These are first-class DTO fields — they must **not** be smuggled through the untyped `clientContext` record

**Checkpoint**: Types, schema, identity surface, client, and audit ready — user story work can begin.

---

## Phase 3: User Story 1 - Reason Over Policy and Context, Then Propose (Priority: P1) 🎯 MVP part 1/3

**Goal**: The agent resolves who is asking, checks real balance/overlap/holidays, consults approved policy scoped to their region, and returns a precise proposal with citations — writing nothing.

**Independent Test**: Ask for leave under valid, insufficient-balance, overlapping, and under-specified scenarios. Verify a `PENDING_CONFIRMATION` result with correct fields and citations in the valid case, and that **no write reaches HR Core in any case**.

### Tests for User Story 1

- [X] T022 [P] [US1] Unit tests for booking-intent and date-range detection in `apps/ai-agentic/src/modules/agents/specialists/leave-agent.service.spec.ts`
- [X] T023 [P] [US1] Unit tests for the Reason phase in `apps/ai-agentic/src/modules/agents/actions/action-proposal.service.spec.ts`: sufficient balance proposes; insufficient balance declines with actual numbers and mints no token; overlap surfaces and does not propose
- [X] T024 [P] [US1] Unit tests in the same file asserting policy behavior: citations attached when policy is retrieved (FR-017), explicit "no policy document available" when the RAG search is empty (FR-019), and contradiction surfaced rather than silently resolved (FR-020)
- [ ] T025 [P] [US1] Integration test in `apps/ai-agentic/test/integration/propose-no-write.integration-spec.ts` asserting `createLeaveRequest` is never invoked during any Reason/Propose path (FR-002)

### Implementation for User Story 1

- [X] T026 [US1] Implement identity resolution as the **first step of Reason** in `apps/ai-agentic/src/modules/agents/actions/` — before intent interpretation, leave-type resolution, or policy retrieval. Take `employeeId` and `businessUnitId` from the already-populated actor context (both are JWT claims; **neither requires a fetch**), then call `getEmployeeProfileContext()` once for `firstName`, `gender`, and `country`. Every downstream Reason step consumes this resolved context rather than re-deriving it. All four facts must degrade independently: a null `gender`, a null `country`, an unavailable profile, or a 403 each reduce capability without failing the turn — reuse the existing `PermissionDecision`/degradation path, and record the degradation rather than silently proceeding as if the fact were known
- [X] T027 [US1] Add booking-intent detection and date-range extraction to `apps/ai-agentic/src/modules/agents/specialists/leave-agent.service.ts`. Resolve leave type against `getLeaveTypes(businessUnitId)` — **scoped to the resolved business unit**, since `LeaveType` is BU-scoped and an unscoped list can offer a type the employee cannot use. Where a leave type is gender-conditional (parental/maternity/paternity), filter eligibility by the resolved `gender`; when `gender` is null, present the applicable options rather than guessing. Slot 2 maps phrasing to a type; the resolved **id** is what enters the payload, never the raw phrase
- [X] T028 [US1] Compute an **advisory** business-day figure in `apps/ai-agentic/src/modules/agents/actions/` from `getHolidaysContext(businessUnitId)` — passing the resolved business unit, since public holidays differ by site and an unscoped call yields the wrong calendar. For display on the card only. At Propose time no record exists, so this number must be derived locally — but it must **not** be a port of HR Core's `countBusinessDays`. HR Core recomputes `totalDays` authoritatively inside `create`, reading holidays at its own moment, and per research.md R4 the two are **never compared** (see T051). A second copy of that rule would inevitably drift
- [X] T029 [US1] Fetch balance and existing requests via the existing `getLeaveContext(employeeId)` (one call returns both `balances` and `recentRequests`), and implement the insufficient-balance and overlap decline paths with concrete numbers
- [X] T030 [US1] Implement the single-question clarification path for under-specified type or dates, returning the existing clarification status rather than guessing (FR-001 acceptance scenario 4)
- [ ] T031 [US1] Retrieve policy through the existing `KnowledgeRepository.searchApproved()` in `apps/ai-agentic/src/modules/knowledge/knowledge.repository.ts`, **filtered by the resolved country** for external-regulation content, and attach `policyCitations` to the proposal (FR-016, FR-051). `CLAUDE.md` §11 specifies this filter but `regulationRegion` has **0 occurrences** in `apps/ai-agentic/prisma/schema.prisma` — it was never built. Filter on what exists and fall back to unfiltered retrieval when country is null or the corpus carries no region tag, stating the limitation rather than implying regional authority the retrieval did not have. Slot 3 summarizes retrieved passages only — the model must not generate policy text absent from a chunk (SC-007)
- [X] T032 [US1] Create `apps/ai-agentic/src/modules/agents/actions/action-proposal.service.ts` with `mint()`: persist the frozen payload, citations, `actorUserId`, `actorEmployeeId`, `conversationId`, `messageId`, and `expiresAt` as an `AgentActionProposal` row, returning a single-use token (FR-003, FR-004)
- [X] T033 [US1] Return `PENDING_CONFIRMATION` with `confirmationPayload` and `confirmationToken` from `leave-agent.service.ts`, and set the message's `status` to `PENDING_CONFIRMATION`
- [X] T034 [US1] Serialize `confirmationPayload` and `policyCitations` onto the message in `apps/ai-agentic/src/modules/conversations/conversation-response.mapper.ts`, joining the proposal by `messageId`. Keep this out of `Message.sourceSummary` — that field means "sources used in the answer", not "pending action"
- [X] T035 [US1] Write the `action.proposed` audit entry via `ActionAuditService`, recording the full computed payload, the resolved identity context (business unit and country actually used for scoping — **not** raw profile PII), the policy sources consulted, and the absence of any write (FR-049)
- [X] T036 [P] [US1] Add `ActionProposal`/citation types to `apps/web/src/lib/api/ai.ts` so the frontend contract matches the mapper output (per `.claude/rules/frontend-backend-coherence.md` — the type shape lands in the same slice as the endpoint change)

**Checkpoint**: Proposals are identity-scoped, computed, cited, persisted, and returned. Nothing can be executed yet — this is an advisor, not yet an actor.

---

## Phase 4: User Story 2 - Confirm and Execute (Priority: P1) 🎯 MVP part 2/3

**Goal**: An explicit human tap causes exactly one downstream write, with honest failure reporting and no possibility of a duplicate.

**Independent Test**: Confirm a valid proposal and verify exactly one POST occurs; verify the UI blocks a second submission; verify a non-201 renders an explicit failure card rather than a false success.

### Tests for User Story 2

- [ ] T037 [P] [US2] Integration test in `apps/ai-agentic/test/integration/token-single-use.integration-spec.ts` firing two concurrent confirms against one token and asserting **exactly one** `createLeaveRequest` call (SC-002 — this test is the primary evidence for that criterion)
- [X] T038 [P] [US2] Unit tests in `apps/ai-agentic/src/modules/agents/actions/action-executor.service.spec.ts` for token refusal paths: expired, already consumed, wrong user, wrong conversation — each asserting **no downstream call** (SC-005)
- [X] T039 [P] [US2] Unit tests for failure classification: non-2xx, timeout, and connection failure each produce `FAILED` carrying the specific downstream reason, never `SUCCESS` (FR-007, FR-010, SC-003)
- [X] T040 [P] [US2] Unit tests for precondition re-validation at Confirm — balance consumed since propose, and new overlapping request since propose — both refuse rather than submit against stale numbers (FR-005)

### Implementation for User Story 2

- [X] T041 [US2] Implement `consume(token, actor)` in `apps/ai-agentic/src/modules/agents/actions/action-proposal.service.ts` as a **conditional `updateMany`** — `where: { token, status: PENDING, expiresAt: { gt: now } }`, acting only when `count === 1`. Never read-then-write (research.md R3)
- [X] T042 [US2] Enforce token scoping at confirm time: compare `actorUserId` and `conversationId` against the request's context and refuse on mismatch (FR-004)
- [X] T043 [US2] Re-validate preconditions before consuming — balance, overlap, and authorization under the caller's current `AgentContext` — and refuse with an explanation if any no longer holds (FR-005, FR-014)
- [X] T044 [US2] Create `apps/ai-agentic/src/modules/agents/actions/action-executor.service.ts` with `execute()`: consume the token **then** issue exactly one `createLeaveRequest` using the payload frozen at propose time — never a payload re-derived from the confirm message (FR-001, FR-006). Record `executedAt`, `resultRecordId`, `resultStatusCode`, `resultErrorCode` on the proposal row
- [X] T045 [US2] Implement the already-consumed response path returning "this booking was already submitted" with no second write (FR-006 acceptance scenario 4)
- [X] T046 [US2] Implement Cancel: consume the token, make no downstream call, leave `executedAt` null, and confirm cancellation in plain language (FR-013)
- [X] T047 [US2] Route `confirmed`/`confirmationToken` from `CreateMessageDto` through `apps/ai-agentic/src/modules/conversations/conversations.service.ts` into the executor, **bypassing the classifier** — a confirm is a typed control signal, not a message to interpret. An unrelated message while a proposal is pending must not be read as implicit confirmation. Confirm/cancel control turns must also be excluded from the classifier's history window: `ConversationContextService.build()` selects `recentMessages` by `conversationId` with **no status filter** (a documented 016 limitation), so wiring this correctly for the confirm turn alone still replays a bare `"confirm"` into the classifier prompt on turn N+1
- [X] T048 [US2] Write the `action.executed` audit entry with HTTP status and response summary, linked to the proposal entry via `parentLogId` (FR-049)
- [X] T049 [US2] Create `apps/web/src/components/ai/action-confirmation-card.tsx` with the standard booking variant: summary fields, visible policy citations **before** confirming (FR-048), and Confirm/Cancel controls. Confirm disables immediately on first tap and re-enables only on `FAILED` (FR-044). Wire rendering into `apps/web/src/pages/ai-assistant.tsx` on `confirmationPayload` presence (FR-043) and add confirm/cancel calls to `apps/web/src/lib/api/ai.ts`

**Checkpoint**: A confirmed proposal writes exactly once. Success is still reported on the HTTP response alone — US3 closes that gap.

---

## Phase 5: User Story 3 - Verify the Outcome (Priority: P1) 🎯 MVP part 3/3

**Goal**: The agent independently reads the record back before claiming success, so a partial failure never produces false confidence.

**Independent Test**: Simulate a create returning 201 where the read-back fails or returns a mismatched record; verify the agent reports unverified and directs the user to a manual fallback rather than `SUCCESS`.

### Tests for User Story 3

- [X] T050 [P] [US3] Unit tests in `apps/ai-agentic/src/modules/agents/actions/action-executor.service.spec.ts` for `MATCHED`, `MISMATCHED`, and `UNAVAILABLE` verification outcomes
- [X] T051 [P] [US3] Test asserting `totalDays` is **never** compared for equality — a record correctly created by HR Core with a different `totalDays` than the agent's advisory figure must still verify as `MATCHED` (research.md R4; a strict comparison here produces false failures)
- [X] T052 [P] [US3] Test asserting verification is skipped entirely when Execute already failed (FR-008 acceptance scenario 4)
- [ ] T053 [P] [US3] Integration test in `apps/ai-agentic/test/integration/forced-unverified.integration-spec.ts` — 201 followed by a failing read-back yields `UNVERIFIED`, a manual-fallback message, and **no scheduled follow-up** (quickstart scenario 5)

### Implementation for User Story 3

- [X] T054 [US3] Implement `verify()` in `apps/ai-agentic/src/modules/agents/actions/action-executor.service.ts`: read back via `getLeaveRequestById()` and compare against the frozen payload on dates, leave type, employee, and status — explicitly excluding `totalDays`. Persist `verifiedAt` and `verificationState`
- [X] T055 [US3] Gate the reported status: `SUCCESS` only when `verificationState === 'MATCHED'`; otherwise `UNVERIFIED` with a manual-fallback instruction pointing at the Leaves page or HR (FR-009). Never reuse `DEGRADED`, which already means "graceful 403, proceeded with reduced context"
- [X] T056 [US3] State that the manager has been notified only on the `MATCHED` branch, and never name a specific manager when the employee has none assigned — HR Core's routing falls back to active HR admins (FR-024). Add no AI-side messaging of any kind (FR-022, FR-023)
- [X] T057 [US3] Write the `action.verified` audit entry recording the comparison outcome, linked to the execution entry (FR-049). An absent `action.verified` beside a successful `action.executed` must remain queryable as the consumed-but-unverified window
- [X] T058 [US3] Add failure and unverified variants to `apps/web/src/components/ai/action-confirmation-card.tsx` as structured cards with the specific reason and manual fallback — not toasts (FR-046) — and ensure `apps/web/src/pages/ai-assistant.tsx` renders no optimistic success, awaiting the full Execute-plus-Verify round trip (FR-045)

**Checkpoint**: 🎯 **MVP complete.** All five phases work end to end for a standard leave booking. This is the first genuinely demoable and deployable increment.

---

## Phase 6: User Story 4 - Compassionate Sick-Leave Booking (Priority: P2)

**Goal**: "I'm not feeling well" becomes a booked sick day in one tap, with empathy first and zero interrogation.

**Independent Test**: Send "I'm not feeling well today" and verify the response opens with empathy, proposes exactly one day (today), asks no diagnostic questions, and — after Confirm and successful verification — states the manager has been informed.

### Tests for User Story 4

- [ ] T059 [P] [US4] Unit tests in `apps/ai-agentic/src/common/safety/agent-guardrail.service.spec.ts` asserting illness vocabulary is not classified `OUT_OF_SCOPE` (FR-031)
- [ ] T060 [P] [US4] Unit tests in `apps/ai-agentic/src/modules/agents/supervisor-intent-classifier.service.spec.ts` for illness phrasing routing to `LEAVE_AGENT` without explicit booking words, with `emotionalContext` set (FR-026)
- [ ] T061 [P] [US4] Unit tests in `leave-agent.service.spec.ts` asserting **zero** diagnostic questions across the sick path — no symptoms, no doctor's note, no reason (FR-028, SC-009)
- [ ] T062 [P] [US4] Test asserting `IMMEDIATE_SAFETY_PATTERNS` takes precedence over booking when illness co-occurs with distress (FR-032) — the agent must not reduce a crisis to a leave transaction

### Implementation for User Story 4

- [ ] T063 [US4] Add life-event vocabulary (`sick`, `unwell`, `ill`, `fever`, and equivalents) to `SENTIENT_TERMS` in `apps/ai-agentic/src/common/safety/agent-guardrail.service.ts` (FR-031). Phase 1 security guardrails and the three-phase gate order stay untouched
- [ ] T064 [US4] Detect illness expressions in `apps/ai-agentic/src/modules/agents/supervisor-intent-classifier.service.ts` (slot 1), routing to `LEAVE_AGENT` and setting `emotionalContext: 'COMPASSIONATE_SICK'` (FR-026)
- [ ] T065 [US4] Apply the empathetic opener in `apps/ai-agentic/src/modules/agents/nodes/final-answer-node.service.ts` (slot 4) so the first sentence acknowledges how the user feels before any data (FR-027). Use the resolved `firstName` from T026; keep the wording gender-neutral regardless of the `gender` value. **Two concrete gaps found during Foundational work**: (a) `emotionalContext` was added to `SpecialistInput` in T009 but is currently **never set and never read** — it is dead until T064 sets it; (b) `FinalAnswerNodeService.compose()` takes a private `ComposeInput` that carries only `specialistResults`, with no `emotionalContext` field and no access to `SpecialistInput` — so `ComposeInput` must be extended and the supervisor's `finalAnswerNode` call site updated to pass it through
- [ ] T066 [US4] Add the sick-leave path to `leave-agent.service.ts`: default to one day (today) when no duration is stated, honor a stated range when given, ask zero diagnostic questions (FR-028, FR-029). It still passes through Confirm — one tap, never autonomous (FR-030)
- [ ] T067 [US4] Handle the out-of-balance-but-sick edge case with empathy and a route to HR, rather than silently failing or lecturing
- [ ] T068 [US4] Surface duration-triggered documentation policy as **advisory** on the card when retrieved policy mentions it — it must not block the booking (FR-018)
- [ ] T069 [US4] Add the sick variant to `apps/web/src/components/ai/action-confirmation-card.tsx` — visually and textually distinct from a standard booking card, reflecting the compassionate tone (FR-047)

**Checkpoint**: The primary launch scenario works end to end.

---

## Phase 7: User Story 5 - Proactive Wellness Follow-Up (Priority: P3)

**Goal**: Two days after a verified sick-leave booking, the assistant checks in — unless the booking is no longer active.

**Independent Test**: Confirm a sick-leave booking, advance the clock past the follow-up window, run the scheduler, and verify exactly one assistant message appears in the same conversation; verify no message is sent when the underlying request was cancelled meanwhile.

> **This phase contains the `AgentContextFactory` build** (correction 1 above). It is scoped here rather than to Foundational because only the scheduler needs a credential when no user JWT is in flight.

### Tests for User Story 5

- [ ] T070 [P] [US5] Integration tests in `apps/ai-agentic/test/integration/followup-suppression.integration-spec.ts` covering all four resolutions: `SENT`, `SUPPRESSED_CANCELLED`, `SUPPRESSED_STALE`, `SUPPRESSED_CONVERSATION_GONE`, plus at-most-once firing (FR-034, FR-035, SC-011)

### Implementation for User Story 5

- [ ] T071 [US5] Create `apps/ai-agentic/src/common/auth/agent-context.factory.ts` with `fromRequest()` and `forSystemTask(taskType)`. `forSystemTask` signs a `SystemJwtPayload` (`sub: 'system'`, `roles: ['SYSTEM']`, `scope: 'GLOBAL'`, explicit `taskType`, 5-minute expiry) with `SYSTEM_JWT_SECRET` — the counterpart to the verification already in `packages/shared/src/auth/shared-jwt.guard.ts:35`. **This does not exist today**; it must be built, not reused
- [ ] T072 [P] [US5] Unit tests in `apps/ai-agentic/src/common/auth/agent-context.factory.spec.ts` asserting the SYSTEM token is short-lived, carries `taskType`, sets `isSystemContext: true`, and is accepted by `SharedJwtGuard`
- [ ] T073 [US5] In `apps/hr-core/src/modules/leaves/requests/requests.controller.ts`: add `'SYSTEM'` to `@Roles` on `@Get(':id')` (line 94) **and** branch the handler to pass `undefined` instead of `requireEmployeeId(user)` when the caller is SYSTEM (line 103). The service is already compatible — `findOne(id, ownerId?)` at `requests.service.ts:205` guards with `if (ownerId && …)`. Use `patchAgentAssessment` (line 149) as the precedent. No service change, no query change (FR-042)
- [ ] T074 [P] [US5] Update `apps/hr-core/src/modules/leaves/requests/requests.controller.spec.ts` to cover SYSTEM read access and confirm the non-SYSTEM ownership throw is unchanged
- [ ] T075 [US5] Create `apps/ai-agentic/src/modules/agents/follow-up-scheduler.service.ts` with `schedule()`, `findDue()`, `resolve(id, resolution)`, writing `ScheduledFollowUp` rows and denormalizing `employeeFirstName` (from the T026 identity resolution) at schedule time
- [ ] T076 [US5] Schedule a follow-up **only** on the `MATCHED` branch of a sick-leave verification (FR-033, FR-035) — never after `FAILED` or `UNVERIFIED` (SC-011)
- [ ] T077 [US5] Create `apps/ai-agentic/src/modules/agents/proactive-message.service.ts` inserting an `ASSISTANT`-role `Message` into the **existing** conversation. It must never create a new unsolicited conversation (FR-037)
- [ ] T078 [US5] Create `apps/ai-agentic/src/modules/agents/follow-up-runner.service.ts` with `@Cron('0 * * * *')`, querying due-and-unresolved rows via the `[followUpAt, resolvedAt]` index
- [ ] T079 [US5] Implement fire-time suppression: re-read the originating leave request under `forSystemTask('sick_leave_wellness_check')` and suppress when cancelled or rejected (FR-040, FR-041). This is a read at fire time, **not** an event subscription — `InMemoryEventBus` is per-process and cannot deliver across services
- [ ] T080 [US5] Implement stale-backlog suppression using `AI_AGENT_FOLLOWUP_STALE_AFTER_HOURS` so post-downtime recovery does not burst days of late check-ins (FR-038), and set `resolvedAt` + `resolution` on every path — sent or suppressed (FR-034)
- [ ] T081 [US5] Compose the follow-up message so it reads naturally whether or not the user has already returned (FR-036 acceptance scenario 6), and ensure a reply re-enters the normal propose→confirm→execute→verify flow — a follow-up must never auto-book or extend anything (FR-036)
- [ ] T082 [US5] Log the proactive message with the same audit rigor as user-triggered actions, referencing the booking that scheduled it, attributed to the existing `TaskTrigger.SCHEDULED` (FR-039)

**Checkpoint**: The system reaches out, and correctly declines to when it shouldn't.

---

## Phase 8: User Story 6 - Auditable Five-Phase Trail (Priority: P3)

**Goal**: An operator can reconstruct exactly what was proposed, what was approved, what happened downstream, and whether it was verified.

**Independent Test**: Run a full flow and confirm linked `AgentTaskLog` entries exist with correct parent-child relationships and statuses.

> Base logging landed in Foundational (T020) because the P1 phases cannot be built without it. This story covers what is specifically audit-shaped and is not exercised by the phase implementations themselves.

- [ ] T083 [P] [US6] Integration test in `apps/ai-agentic/test/integration/audit-chain.integration-spec.ts` asserting a full run produces `action.proposed` → `action.executed` → `action.verified` with correct `parentLogId` linkage and statuses (SC-013)
- [ ] T084 [US6] Record propose-time and confirm-time authorization decisions as **distinct** `PermissionDecisionRecord` entries via the existing `apps/ai-agentic/src/modules/agents/permission-decision.service.ts`, so a role or account-status change between the two is auditable (FR-050)
- [ ] T085 [US6] Persist the policy sources consulted during Reason onto the `action.proposed` entry, matching the `policyCitations` stored on the proposal row (FR-051)
- [ ] T086 [P] [US6] Test asserting every failure path captures the downstream reason and HTTP status in full — never swallowed or generalized (FR-010, SC-003)
- [ ] T087 [P] [US6] Test asserting a `FAILED` or `UNVERIFIED` run still produces a complete, correctly linked chain — the trail must not be conditional on success
- [ ] T088 [US6] Verify the new task types surface correctly through the existing governance endpoints in `apps/ai-agentic/src/modules/governance/` with no query changes required

**Checkpoint**: The feature is governable and debuggable after the fact.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T089 [P] Correct the AI Agentic entity count from **5** to **13** in `CLAUDE.md` §3.1 (service table) and §6 (domain model), and in `AGENTS.md`. The count went stale during 016 — the schema already held 11 before this feature added 2. This is documentation debt being paid, not silent drift
- [ ] T090 [P] Reconcile `CLAUDE.md` §11's dual-namespace RAG description with reality: it specifies filtering on `regulationRegion`, which has **0 occurrences** in `apps/ai-agentic/prisma/schema.prisma`. Either note it as unimplemented or describe what T031 actually built. Leaving the two divergent is how the "5 entities" drift happened
- [ ] T091 [P] Trim `CLAUDE.md`'s "Leave Booking Confirmation Protocol (PENDING IMPLEMENTATION)" and "Proactive & Emotionally-Aware Leave Agent Flows (PENDING IMPLEMENTATION)" sections to a pointer at this spec, matching how completed features are summarized. Those sections were the input sketch; the spec is now the source of truth — and both contain shapes the design deliberately rejected (`content`/`metadata` message fields, JSON-blob token storage)
- [ ] T092 Run all 10 scenarios in [quickstart.md](./quickstart.md) end to end. Scenarios 3 (double-tap) and 5 (forced-unverified) are the ones that actually prove the feature
- [ ] T093 [P] Run `turbo test --filter=ai-agentic` and `turbo test --filter=hr-core`; confirm the full 016 suite still passes alongside the new tests
- [ ] T094 [P] Run the Web type-check and confirm `apps/web/src/lib/api/ai.ts` types match the mapper output per `.claude/rules/frontend-backend-coherence.md` §1
- [ ] T095 Add a module-boundary test in `apps/ai-agentic/test/contracts/no-hr-core-notification-import.contract-spec.ts` asserting no source file under `apps/ai-agentic/src` resolves an import path into HR Core notification or mail components (FR-023, SC-014). Without this, SC-014 is an unasserted claim — exactly the kind of invariant that rots silently as the service grows
- [ ] T096 Record SC verification status explicitly: **SC-001–SC-009, SC-011, SC-013 are validated by the test suite and quickstart run; SC-014 by T095.** **SC-010 and SC-012 are pilot-observation metrics** (single-tap completion rate, and whether users distinguish proposed from confirmed) and cannot be closed by a green suite — mark them as pending pilot rather than done. Then update `AGENTS.md` → `## Recent Changes` with a one-line 017 entry in the existing format

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **US1 → US2 → US3**: Genuinely sequential. Execute needs a proposal to consume; Verify needs an execution to read back. These three are not parallelizable across developers
- **US4 (P2)**: Depends on US1–US3 complete (it is the five-phase flow with a different tone and default)
- **US5 (P3)**: Depends on US3 (schedules only on `MATCHED`) and US4 (sick bookings are what get followed up)
- **US6 (P3)**: Depends on US1–US3 having produced log entries to link and assert against
- **Polish (Phase 9)**: Depends on all desired stories

### Within Each User Story

- Tests are written first and must fail before implementation
- **Identity resolution (T026) precedes every other Reason step** — leave-type scoping, holiday calendar, and policy filtering all consume its output
- Persistence → service → graph wiring → frontend
- Backend contract and its frontend type land in the same slice (`.claude/rules/frontend-backend-coherence.md` §5)

### Parallel Opportunities

Real parallelism here is narrower than the template's default, because the three P1 stories form a chain.

- T003 and T004 in Setup
- T019 (HR Core `country` column) is fully independent of the ai-agentic type work — different service, different migration
- T012 alongside T013–T015 (type verification vs. schema work touch different files)
- T016–T018 (client) can proceed alongside T005–T012 (types) — different files, no shared dependency
- All `[P]` test tasks within a single story
- **US6's test tasks (T083, T086, T087) can be written during US1–US3** and left failing until the phases land
- T089, T090, T091, T093, T094 in Polish

---

## Parallel Example: Foundational Phase

```bash
# Three independent tracks after T005-T006 land:
Task: "T007 Convert SpecialistInput.constraints to a discriminated union across 11 files"
Task: "T016 Add getLeaveTypes, getLeaveRequestById, getEmployeeProfileContext to hr-core-ai.client.ts"
Task: "T019 Add country to BusinessUnit in apps/hr-core with an additive migration"

# Then, still independent:
Task: "T012 Verify draft-readonly.spec.ts assertions unweakened"
Task: "T013 Add Prisma models and enums per data-model.md"
```

---

## Implementation Strategy

### MVP = US1 + US2 + US3, not US1 alone

The template defaults to "MVP = User Story 1." **That is wrong for this feature.** spec.md marks US1, US2, and US3 all **P1**, and shipping US1 alone produces an assistant that renders a confirmation card which can never execute — strictly worse than the current read-only agent, because it promises an action it cannot perform.

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — **blocks everything**
3. Complete Phases 3, 4, 5 (US1 → US2 → US3) in order
4. **STOP and VALIDATE**: run quickstart scenarios 1–5; a standard leave booking works end to end with verified success and honest failure
5. Deploy/demo — this is the real MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 + US2 + US3 → **MVP: five-phase booking** → demo
3. US4 → compassionate sick leave → demo (the primary launch scenario)
4. US5 → proactive follow-up → demo (the most distinctive moment)
5. US6 → audit completeness → operator-ready
6. Polish → documentation debt paid, SC status recorded honestly

### Parallel Team Strategy

The P1 chain limits this. With two developers after Foundational:

- **Dev A**: US1 → US2 → US3 (the critical path — this is the whole MVP)
- **Dev B**: T019 (HR Core `country` column), then US6 test scaffolding (T083, T086, T087) written against the contracts, then US5's independent pieces (T071–T074 — `AgentContextFactory` and the HR Core SYSTEM branch have no dependency on the P1 chain). **T019, T073, T074 touch `apps/hr-core`** — the only tasks in this feature outside `apps/ai-agentic`/`apps/web` — so Dev B must run `turbo test --filter=hr-core`, not just the ai-agentic suite

Sending a second developer at US4 before US3 lands will not work; it is the same code path with different tone.

---

## Requirements Coverage

| FR range | Area | Tasks |
|---|---|---|
| FR-001 – FR-015 | Five-phase framework | T007–T011, T020, T026–T028, T032–T033, T041–T049, T054–T055 |
| FR-016 – FR-020 | Policy consultation | T024, T031, T068 |
| FR-021 – FR-025 | Manager notification | T056 (assert-only — HR Core's pipeline is a precondition, not a deliverable) |
| FR-026 – FR-032 | Compassionate sick leave | T059–T069 |
| FR-033 – FR-042 | Proactive follow-up | T070–T082 |
| FR-043 – FR-048 | Frontend contract | T036, T049, T058, T069 |
| FR-049 – FR-051 | Audit | T020, T035, T048, T057, T083–T088, T095 |

All 51 FRs map to at least one task. FR-021–FR-023 are deliberately assertion-only: the manager notification is produced by HR Core's existing `leave.requested` pipeline as a consequence of Execute succeeding, and this feature's obligation is to **not** build a competing path (SC-014).

Identity resolution (T016, T019, T026) supports FR-016–FR-018 rather than adding requirements: policy consultation is only correct if it is scoped to the right region and the right leave types.

---

## Notes

- 96 tasks. US1–US3 (37 tasks) are the MVP.
- The 016 three-phase supervisor gate (security → intent → RBAC/scope) is untouched. This framework governs what a specialist does *after* routing.
- `[P]` tasks touch different files with no incomplete dependencies.
- Commit after each task or logical group, prefixed `[claude]` per `.claude/CLAUDE.md` §16.
- If a task appears to need a fifth LLM call beyond the four slots named in the Design Stance, stop and raise it — that is the harness being weakened, not a missing capability.
