# Implementation Plan: Agentic Action Execution

**Branch**: `017-agentic-action-execution` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-agentic-action-execution/spec.md`

## Summary

Give the `016-ai-module` supervisor the ability to mutate official HR records, gated behind a five-phase framework — Reason → Propose → Confirm → Execute → Verify. The Leave Agent is the reference implementation: it reasons over balance, overlaps, holidays and approved policy (RAG), proposes a frozen payload with a single-use token, waits for an explicit human tap, executes exactly one write, then independently reads the record back before reporting success. Manager notification is produced by HR Core's existing `leave.requested` event pipeline as a consequence of Execute succeeding — the AI service sends no messages of its own. A compassionate sick-leave path makes the whole flow one tap, and a SYSTEM-context scheduler posts a wellness follow-up two days later.

The load-bearing change is not the write itself; it is converting a **type-level, globally-asserted read-only invariant** into a **narrow, per-action capability** without weakening it for the seven specialists that must remain read-only.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode
**Primary Dependencies**: NestJS 10, LangGraph.js, Prisma 5 multiSchema, `@sentient/shared`, React 18 + Vite 7, TanStack Query v5, shadcn/ui, plus **one new dependency: `@nestjs/schedule`** — verified absent from `apps/ai-agentic/package.json` and unregistered in `app.module.ts`, so installing it and adding `ScheduleModule.forRoot()` are real tasks, not assumptions
**Storage**: PostgreSQL 16 schema `ai_agent`; two new models (`AgentActionProposal`, `ScheduledFollowUp`), two new `AgentRunStatus` enum values
**Testing**: Jest unit tests per phase, contract tests for the new `HrCoreAiClient` write/read-back methods, integration tests for token single-use and scheduler suppression, Web type-check
**Target Platform**: Local Windows/Linux dev, Node 20+, existing Docker Compose PostgreSQL
**Project Type**: Web application — NestJS AI Agentic service, HR Core RBAC change, React SPA components
**Performance Goals**: Proposal returned within the existing 15s first-response budget; Execute + Verify round trip within the gateway's `API_GATEWAY_AI_UPSTREAM_TIMEOUT_MS`; follow-up cron hourly
**Constraints**: Exactly one downstream write per confirmed token; no optimistic UI; no AI-originated outbound messaging; `apps/ai-agentic` never imports from `apps/hr-core`; the 016 three-phase supervisor gate is unchanged
**Scale/Scope**: One mutating action (leave booking) proving a specialist-agnostic framework; one proactive message type

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file remains the generated placeholder. Applying effective repository rules from `AGENTS.md`, `CLAUDE.md`, and `.claude/rules/`:

- **Strict TypeScript / no `any`**: PASS. The capability model is a discriminated union, deliberately chosen so that a read-only specialist attempting a write is a *compile error*, not a runtime check.
- **Endpoint auth guards except health**: PASS. New confirm/cancel routes carry `SharedJwtGuard` + `RbacGuard`; the HR Core read endpoint gains `SYSTEM` alongside existing roles, not in place of them.
- **Service boundaries**: PASS — and materially strengthened. FR-022/FR-023 forbid the AI service from reaching HR Core notification or mail components; the only new coupling is one REST write method on an existing client.
- **No placeholders/stubs**: PASS. Every phase is implemented; no TODO-gated paths.
- **Auditability**: PASS. Three linked `AgentTaskLog` entries per action plus a distinct proactive-message entry.
- **Safety/scope boundaries**: PASS — with one deliberate, scoped relaxation of the read-only invariant, tracked in Complexity Tracking below.

## Project Structure

### Documentation (this feature)

```text
specs/017-agentic-action-execution/
├── spec.md              ✓ 51 FRs, 14 SCs
├── plan.md              ✓ this file
├── research.md          ✓ Phase 0 — 7 unknowns resolved
├── data-model.md        ✓ Phase 1
├── quickstart.md        ✓ Phase 1 — 10 scenarios
├── contracts/
│   ├── action-execution-api.yaml     ✓ Phase 1
│   └── five-phase-state-machine.md   ✓ Phase 1
└── tasks.md             ← Phase 2 (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/ai-agentic/
├── prisma/
│   ├── schema.prisma                      AgentActionProposal, ScheduledFollowUp,
│   └── migrations/                        AgentRunStatus += PENDING_CONFIRMATION, UNVERIFIED
├── src/
│   ├── common/
│   │   ├── graph/agent-graph.types.ts     capability union, confirmation payload
│   │   ├── clients/hr-core-ai.client.ts   getLeaveTypes, createLeaveRequest,
│   │                                  getLeaveRequestById (3 new; first write)
│   │   └── safety/
│   │       ├── draft-policy.service.ts    capability-aware (currently hard-blocks)
│   │       └── action-capability.ts        NEW — which agent may perform which action
│   └── modules/agents/
│       ├── actions/                        NEW — the framework
│       │   ├── action-proposal.service.ts       mint / load / atomically consume
│       │   ├── action-executor.service.ts       Execute + Verify
│       │   └── action-audit.service.ts          three linked log entries
│       ├── specialists/leave-agent.service.ts   Reason + Propose + sick-leave path
│       ├── follow-up-scheduler.service.ts  NEW
│       ├── follow-up-runner.service.ts     NEW — @Cron hourly
│       └── proactive-message.service.ts    NEW
└── test/{contracts,integration}/

apps/hr-core/src/modules/leaves/
└── (RBAC only) allow SYSTEM role on leave-request read by id

apps/web/src/
├── components/ai/action-confirmation-card.tsx   NEW — booking + sick + failure variants
├── pages/ai-assistant.tsx                       render card on confirmationPayload
└── lib/api/ai.ts                                confirmationToken on CreateMessageDto
```

**Structure Decision**: The five-phase framework lives in a new `modules/agents/actions/` directory rather than inside `leave-agent.service.ts`, because FR-011 requires it to be specialist-agnostic. The Leave Agent supplies domain reasoning and a payload; it does not own token lifecycle, execution, verification, or audit. A second mutating action later should need no changes under `actions/`.

## Key Design Decisions

These four are the decisions Phase 0 research must validate. Each was surfaced by reading the existing code, and each has a cheaper-but-wrong alternative worth recording.

### D1 — Capability union, not a boolean flag

`SpecialistInput.constraints.readOnlyOfficialRecords` is currently the **literal type `true`** ([agent-graph.types.ts:58](../../apps/ai-agentic/src/common/graph/agent-graph.types.ts:58)), asserted across `DraftPolicyService` and six spec files. Widening it to `boolean` would compile everywhere and silently delete the guarantee for all eight specialists.

**Decision**: make `constraints` a discriminated union — read-only specialists keep the literal `true`; the Leave Agent receives an action-capable variant naming exactly which actions it may propose. A read-only specialist that tries to produce a confirmation payload fails to type-check.

**Rejected**: `readOnlyOfficialRecords: boolean`. Cheap, one-line, and it converts a compile-time proof into a runtime hope.

### D2 — `DraftPolicyService` must become capability-aware

Today it hard-blocks on `MUTATION_TERMS = ['submit', …, 'book it', …]`. As written, "book it" is refused before the Leave Agent ever runs — this service is a live blocker for the feature, not a nice-to-have refactor.

**Decision**: the term list stops being a blanket prohibition and becomes the trigger for a capability check. If the specialist holds the capability for that action, the phrase routes into Propose; if not, the existing refusal stands unchanged. Every currently-passing draft-policy test must still pass for the seven read-only specialists.

### D3 — Token lifecycle in a table, not the conversation JSON blob

`CLAUDE.md`'s pending sketch stores the payload in the conversation's `agentContext` metadata keyed by token. A JSON read-modify-write cannot enforce single-use under a double-tap: two concurrent requests both read "unconsumed" and both write.

**Decision**: a dedicated `AgentActionProposal` row, consumed by a **conditional update** (`UPDATE … WHERE status = 'PENDING'` and act only if one row changed). The database provides the atomicity that SC-002 (zero duplicate writes) actually requires.

**Note on FR-006's honesty**: a local consume and a remote HTTP call can never be truly atomic. The order is consume-then-call, which can leave a consumed-but-unwritten window on a crash. That window is exactly what Verify exists to reconcile — and it is why Verify is P1, not a nicety.

### D4 — Follow-up suppression by fire-time read, not event subscription

The spec originally called for subscribing to `leave.cancelled` / `leave.rejected`. Reading the code shows this is not implementable: `InMemoryEventBus` in both HR Core and Social is a per-process `Map` of handlers ([in-memory-event-bus.ts:12](../../apps/hr-core/src/common/event-bus/in-memory-event-bus.ts:12)), AI Agentic registers no subscriptions, and `packages/shared/src/event-bus/` ships interfaces only. Cross-service delivery is Phase 2 (Kafka) work.

**Decision**: the scheduler re-reads the specific leave request at fire time under a SYSTEM context from `AgentContextFactory.forSystemTask()` — the project's sanctioned mechanism for scheduled work, which also resolves the "user's JWT expired days ago" problem. Requires HR Core to accept `SYSTEM` on that one read endpoint (FR-042).

**Consequence**: this is the feature's only change outside `apps/ai-agentic` and `apps/web`, and it is RBAC-only — no new HR Core endpoint, no new write path.

### D5 — HR Core needs no new endpoints; the AI client needs three methods

Verified against the leave controllers: `GET /leave-types`, `POST /leave-requests`, `GET /leave-requests/:id`, and `GET /holidays` all exist and already permit `EMPLOYEE`, `MANAGER`, `HR_ADMIN`. Every phase of this feature targets an endpoint that is live today.

On the AI side, `HrCoreAiClient` already has what Reason needs but is missing what Execute and Verify need:

| Need | Status |
|---|---|
| Balance **and** overlap check | `getLeaveContext()` — **exists**, returns `balances` + `recentRequests` in one call |
| Business-day math | `getHolidaysContext()` — **exists** |
| Resolve "sick"/"annual" to a leave-type id | `getLeaveTypes()` — **new** |
| Execute the booking | `createLeaveRequest()` — **new**, the client's first write method |
| Verify read-back | `getLeaveRequestById()` — **new** |

**Consequence for task ordering**: Reason is *not* a large slice. Two of its three data calls already exist, so it is one task rather than a foundational phase. The genuinely new client surface is three methods, and `createLeaveRequest` is the first time this client has written anything — it needs its own contract test covering the non-2xx and timeout paths that FR-007 depends on.

## Complexity Tracking

| Deviation | Why needed | Why the simpler option was rejected |
|---|---|---|
| Relaxing the global read-only-official-records invariant | The feature's entire purpose; 016 was explicitly scaffolded read-only pending this | A boolean flag would relax it for all eight specialists at once. The union narrows the relaxation to one agent and one action, verified by the compiler |
| Two new `ai_agent` models | Single-use enforcement needs a row with a status; proactive follow-up needs durable scheduling across restarts | In-memory or JSON-blob state loses both guarantees under concurrency and restart |
| One HR Core RBAC change | The scheduler must read leave state with no user credential in flight | Carrying a long-lived user token for days is a materially worse security posture than a 5-minute SYSTEM JWT |

## Known Documentation Debt

Both `CLAUDE.md` (§3.1 service table, §6 domain model) and `AGENTS.md` state AI Agentic owns **5 entities**. The schema already contains **11** models (`Conversation`, `Message`, `AgentTaskLog`, `AgentHandoff`, `AgentNodeRun`, `ClarificationRequest`, `HumanEscalation`, `ResponseFeedback`, `KnowledgeItem`, `VectorDocument`, `PermissionDecisionRecord`) — the count went stale during 016. This feature takes it to 13. Correcting both files is a task in this feature, not a silent drift.

## Phase 0 Research — COMPLETE

See [research.md](./research.md). All seven unknowns resolved against the codebase; none remain NEEDS CLARIFICATION.

Two findings changed the design rather than merely confirming it:

- **R3** — the `CLAUDE.md`-sketched approach of keying the payload off the conversation's `agentContext` JSON **cannot** enforce single-use. A read-modify-write races under a double-tap. Replaced with a row plus a conditional `updateMany` count check.
- **R4** — `totalDays` must **never** be compared for equality during Verify. HR Core computes it authoritatively inside `create` via `countBusinessDays`, reading holidays at its own moment; the agent's figure is advisory display only. Comparing them strictly would report false failures on correctly-created records. This also settles that the agent must **not** reimplement `countBusinessDays` — a second copy of that rule would inevitably drift.

## Phase 1 Design — COMPLETE

- [data-model.md](./data-model.md) — `AgentActionProposal`, `ScheduledFollowUp`, enum additions, state transitions, additive-only migration
- [contracts/action-execution-api.yaml](./contracts/action-execution-api.yaml) — confirm/cancel contract built on the **real** `CreateMessageDto` (`message`/`clientContext`), not the `content`/`metadata` shape `CLAUDE.md` sketched
- [contracts/five-phase-state-machine.md](./contracts/five-phase-state-machine.md) — phase transitions, terminal-state table, audit chain, and the supervisor's unchanged relationship to it
- [quickstart.md](./quickstart.md) — 10 scenarios; scenarios 3 (double-tap) and 5 (forced-unverified) are the ones that actually prove the feature

Agent context refreshed via `update-agent-context.sh claude` (date bump only — the stack was already recorded).

## Post-Design Constitution Check

Re-evaluated after Phase 1. No new violations.

- **Strict typing**: PASS. The capability union is *stronger* than the status quo — a read-only specialist constructing a confirmation payload is now a compile error rather than a convention.
- **Endpoint auth guards**: PASS. No new routes; confirm/cancel ride the existing guarded message endpoint. `confirmed`/`confirmationToken` are typed and class-validated rather than smuggled through untyped `clientContext`.
- **Service boundaries**: PASS, and load-bearing. Contracts forbid the AI service from reaching HR Core notification/mail components; the single cross-service addition is one `@Roles` entry for `SYSTEM`.
- **Auditability**: PASS. Three linked task-log entries per action; an absent `action.verified` beside a successful `action.executed` is itself a queryable signal.
- **Safety/scope**: PASS. The read-only relaxation is scoped to one agent and one action kind, and remains subject to explicit human confirmation.

**One gate genuinely tightened by design work**: FR-006's original "atomic" claim was not achievable — a local write and a remote HTTP call never are. The contract now states consume-then-call honestly and names Verify as the reconciler of the resulting window.

## Notes

- The 016 three-phase supervisor gate (security → intent → RBAC/scope) is untouched. This framework governs what a specialist does *after* routing.
- The parental-leave RAG entitlement flow from `CLAUDE.md` remains out of scope per the spec's Assumptions; it should build on this framework once proven.
- `CLAUDE.md`'s "Leave Booking Confirmation Protocol" and "Proactive & Emotionally-Aware Leave Agent Flows" sections were the input sketch for this feature. Once this spec is approved they should be trimmed to a pointer, matching how completed features are summarized — the spec, not `CLAUDE.md`, becomes the source of truth.
