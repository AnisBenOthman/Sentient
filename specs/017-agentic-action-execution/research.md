# Phase 0 Research: Agentic Action Execution

**Feature**: `017-agentic-action-execution` | **Date**: 2026-07-30 | **Plan**: [plan.md](./plan.md)

All seven unknowns from `plan.md` are resolved below against the actual codebase. No item remains NEEDS CLARIFICATION.

---

## R1 — Capability union shape

**Decision**: Change `SpecialistInput.constraints` from a fixed object with the literal `readOnlyOfficialRecords: true` into a discriminated union:

```
ReadOnlyConstraints      { sentientOnly: true; readOnlyOfficialRecords: true;  mustReturnToSupervisor: true }
ActionCapableConstraints { sentientOnly: true; readOnlyOfficialRecords: false;
                           allowedActions: readonly AgentActionKind[];
                           mustReturnToSupervisor: true }
```

`AgentActionKind` starts as a single member (`LEAVE_BOOKING`). A specialist that receives `ReadOnlyConstraints` cannot construct a confirmation payload without a type error.

**Rationale**: The blast radius is far smaller than feared. `constraints` is constructed in **exactly one place** — [supervisor-langgraph-runner.service.ts:811](../../apps/ai-agentic/src/modules/agents/supervisor-langgraph-runner.service.ts:811) — so the supervisor decides per-route which variant a specialist receives, and the seven read-only specialists keep the literal `true` they have today. The remaining references are `DraftPolicyService` and six `*.spec.ts` fixtures, all of which continue to compile unchanged because the read-only variant is structurally identical to today's type.

**Alternatives considered**:
- *`readOnlyOfficialRecords: boolean`* — one-line change, compiles everywhere, and converts a compile-time proof into a runtime hope for all eight specialists simultaneously. Rejected: the literal type is the entire safety mechanism.
- *A separate `MutatingSpecialistInput` interface* — cleanly separates the two worlds but duplicates the eleven shared fields and forces every shared helper (`specialist-response.helpers.ts`) to be generic or overloaded. Rejected as more churn for the same guarantee.

---

## R2 — `AgentRunStatus` is defined twice and must stay in sync

**Decision**: Add `PENDING_CONFIRMATION` and `UNVERIFIED` to **both** definitions in the same migration-bearing task:
- TS: [`packages/shared/src/enums/ai-agent-run-status.enum.ts`](../../packages/shared/src/enums/ai-agent-run-status.enum.ts)
- Prisma: `enum AgentRunStatus` in `apps/ai-agentic/prisma/schema.prisma` (line 58), `@@schema("ai_agent")`

Reuse the existing `FAILED` — do **not** add a new failure status.

**Rationale**: The enum is genuinely dual-declared; the shared TS enum feeds agent result types while the Prisma enum types persisted columns. Adding to one only would fail at the persistence boundary with a runtime Prisma error rather than a compile error, which is the worst of both worlds. `FAILED`, `DEGRADED`, `PARTIAL`, `REFUSED`, `ESCALATED`, `OUT_OF_SCOPE` already exist, so only the two genuinely new states are added.

**On `UNVERIFIED` vs. reusing `DEGRADED`**: `DEGRADED` already carries a specific meaning in this codebase — a graceful 403 where the agent proceeded with reduced context (per `.claude/rules/security.md`). An unverified write is a categorically different condition: the action may well have succeeded, and the user must be told to check. Overloading `DEGRADED` would make the governance dashboard unable to distinguish "permission boundary" from "we do not know if we changed HR data," which is precisely the distinction operators most need.

**Alternatives considered**: A separate boolean `verified` column alongside `status`. Rejected — it permits the contradictory state `SUCCESS + verified:false`, which FR-009 forbids by construction.

---

## R3 — Atomic single-use token consumption

**Decision**: Consume via a conditional `updateMany` and branch on the returned count:

```
const { count } = await prisma.agentActionProposal.updateMany({
  where: { token, status: 'PENDING', expiresAt: { gt: new Date() } },
  data:  { status: 'CONSUMED', consumedAt: new Date() },
});
if (count === 0) → already consumed / expired / unknown → refuse, no downstream call
if (count === 1) → this caller owns the execution → proceed to the single POST
```

**Rationale**: `updateMany` compiles to a single `UPDATE … WHERE` statement, so the database performs the compare-and-set atomically under its default row locking. Exactly one of N concurrent double-tap requests can observe `count === 1`. This is what SC-002 (zero duplicate writes) actually requires, and it holds without an explicit transaction or advisory lock.

**Alternatives considered**:
- *Payload in the conversation's `agentContext` JSON, keyed by token* (the approach sketched in `CLAUDE.md`). Rejected as the primary defect this research pass found: a JSON read-modify-write cannot enforce single-use — two concurrent handlers both read `unconsumed` and both write. It also makes expiry sweeping and operator inspection awkward.
- *`SELECT … FOR UPDATE` inside an interactive transaction.* Equivalent safety, but holds a transaction open across application logic for no added guarantee.

**Residual window (documented, not eliminated)**: consume-then-call means a crash between the two leaves a consumed token with no HR Core record. The user sees the booking did not complete and re-proposes; no duplicate is created. This is the correct trade — the opposite order (call-then-consume) risks a duplicate write, which is unrecoverable from the user's perspective.

---

## R4 — What counts as a verified read-back

This was the sharpest open question, and the codebase answers it decisively.

**Decision**: Verify compares **identity and intent**, not arithmetic:

| Field | Comparison | Why |
|---|---|---|
| `id` | must equal the id returned by Execute | proves we read back the record we created |
| `employeeId` | must equal the proposal's employee | proves it was booked for the right person |
| `leaveTypeId` | must equal the proposal's leave type | proves the right leave type |
| `startDate` / `endDate` | must equal the proposal's dates | proves the right dates |
| `status` | must be a live status (`PENDING`/`APPROVED`) | proves it was not created-then-voided |
| `totalDays` | **recorded, never compared for equality** | HR Core computes this authoritatively — see below |

A `totalDays` difference is **not** a verification failure. It is surfaced to the user as the authoritative figure ("submitted — HR Core recorded this as 3 days").

**Rationale**: `RequestsService.create` computes `totalDays` server-side via [`countBusinessDays`](../../apps/hr-core/src/modules/leaves/util/business-day.util.ts), reading the holiday set inside its own call, and the source comment states plainly that `totalDays` "is fixed at submission time and never recomputed — this is the single source of truth for that value." The agent computes its own business-day figure for the *proposal* from `getHolidaysContext()`, read at a different moment. These can legitimately diverge (a holiday added in between, a half-day nuance). Treating that divergence as a mismatch would report false failures on correctly-created records.

**Consequence — the agent must not reimplement `countBusinessDays`**: it lives in `apps/hr-core` and the module boundary forbids importing it. AI Agentic has no equivalent today. The agent's own computation is therefore explicitly **advisory, for display on the proposal card**, and HR Core's returned `totalDays` is authoritative the moment it exists. This keeps a duplicated algorithm from silently drifting into a second source of truth.

**Alternatives considered**: Reimplementing `countBusinessDays` inside AI Agentic and comparing strictly. Rejected — it creates two implementations of a rule that must agree forever, and the half-day and holiday-timing edge cases guarantee they eventually will not.

---

## R5 — Failure reasons are already machine-readable

**Decision**: Map HR Core's existing error codes directly to user-facing text; do not invent a new error vocabulary.

`RequestsService.create` throws these codes: `UnresolvedBusinessUnit`, `LeaveTypeInactive`, `LeaveTypeOutOfScope`, `ZeroDayRequest`, `OverlappingRequest` (409), `InsufficientBalance`. Every one must appear in the agent's failure mapping and in the frontend card.

**Rationale**: FR-010 requires a specific, non-generic reason, and `.claude/rules/frontend-backend-coherence.md` §3 already mandates that every backend `throw` string be mapped on the frontend. This is an existing project rule, not a new invention — the same codes are already mapped on the Leaves page, so the agent's mapping should reuse that wording for consistency.

**Note**: `OverlappingRequest` and `InsufficientBalance` are also checked by the agent during Reason. When they surface at Execute instead, it means state changed between propose and confirm — exactly the FR-005 re-validation case — and the message should say so rather than implying the user did something wrong.

---

## R6 — Policy citation shape

**Decision**: A citation is `{ title, sourceLabel, excerpt }` derived from `KnowledgeSearchResult { document: VectorDocument; item: KnowledgeItem | null }`, where the label falls back to the document's own metadata when `item` is `null`.

**Rationale**: `searchApproved()` returns `item` as nullable — an approved `VectorDocument` may have no `KnowledgeItem`. A citation renderer that assumes `item` is present would crash on exactly the content most likely to be seeded rather than uploaded. Retrieval is vector-first with a keyword fallback, so citations must also render sensibly when the match came from the keyword path and is less semantically precise.

**Constraint**: only content already returned by `searchApproved()` may be shown — it filters to approved items, and the citation path must not widen that filter.

---

## R7 — Timeout headroom for Execute + Verify

**Decision**: No timeout configuration change is required. Execute and Verify both run inside the AI upstream budget of **60 s** (`API_GATEWAY_AI_UPSTREAM_TIMEOUT_MS`, defaulted at [gateway.config.ts:53](../../apps/api-gateway/src/config/gateway.config.ts:53)), versus 15 s for non-AI upstreams.

**Rationale**: The confirm turn performs one POST plus one GET against HR Core, with no LLM call in between — Phase 4 and 5 are deterministic code. This is comfortably inside 60 s.

**Required behavior at the boundary**: if the AI service's own downstream call to HR Core times out, that is `FAILED` (FR-007). If the *gateway* times out the confirm turn after the POST has already been issued, the browser cannot distinguish success from failure — so the frontend MUST NOT treat a gateway timeout as failure. It must re-fetch conversation state, where the persisted execution result is authoritative. This is an explicit frontend task, not an inferred behavior.

---

## Resolved Technical Context

| Item | Resolution |
|---|---|
| New dependency | `@nestjs/schedule` — confirmed absent from `apps/ai-agentic/package.json`; install + `ScheduleModule.forRoot()` are real tasks |
| New HR Core endpoints | **None.** `GET /leave-types`, `POST /leave-requests`, `GET /leave-requests/:id`, `GET /holidays` all exist with `EMPLOYEE`/`MANAGER`/`HR_ADMIN` roles |
| HR Core change | RBAC only — add `SYSTEM` to `@Roles` on `GET /leave-requests/:id` for the scheduler (FR-042) |
| New AI client methods | 3 — `getLeaveTypes`, `createLeaveRequest` (first write on this client), `getLeaveRequestById` |
| Cross-service events | Not usable. `InMemoryEventBus` is per-process in both HR Core and Social; AI Agentic has no subscriptions. Follow-up suppression is a fire-time read (R4 pattern), not a subscription |
| Cron backlog policy | A due follow-up older than **24 h** past its `followUpAt` is marked resolved without sending (FR-038). A wellness check-in that arrives days late is worse than none |
| Entity count | `ai_agent` currently holds **11** models, not the 5 claimed in `CLAUDE.md` §3.1/§6 and `AGENTS.md`. This feature takes it to 13; correcting the docs is a task |
