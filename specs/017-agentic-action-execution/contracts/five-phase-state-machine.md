# Contract: Five-Phase Action State Machine

**Feature**: `017-agentic-action-execution` | **Companion to**: [`016-ai-module/contracts/agent-state-machine.md`](../../016-ai-module/contracts/agent-state-machine.md)

This contract governs what happens **inside a specialist node** once the 016 supervisor has already routed to it. It does not modify the supervisor graph, its nodes, or its three-phase gate.

---

## Relationship to the 016 supervisor graph

```
016 SUPERVISOR GRAPH (unchanged)
  security guardrail → intent classifier → RBAC/scope guardrail
        → route → [specialist node] → return control → final answer
                        │
                        └── 017 lives HERE, entirely inside one specialist node
```

**Invariants inherited from 016 that this feature must not break:**

- A specialist always returns control to the supervisor before any user-facing answer (FR-032 of 016). A pending proposal is a **completed specialist turn** with `PENDING_CONFIRMATION`, not a suspended one — the graph does not stay parked waiting for a human.
- Phase-1 security refusals never reach a specialist, so they never reach this machine.
- `requireClassification()` is called unconditionally by the escalation and final-answer nodes. Any path added here must supply a classification.

---

## Phase transitions

```
                    ┌──────────────────────────────────────┐
                    │ specialist entered with an action     │
                    │ intent + ActionCapableConstraints     │
                    └──────────────────────────────────────┘
                                    │
                    ╔═══════════════▼═══════════════╗
                    ║ PHASE 1 · REASON  (read-only) ║
                    ╚═══════════════════════════════╝
                       getLeaveContext  · getHolidaysContext
                       getLeaveTypes    · searchApproved (policy)
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
     under-specified        precondition fails      all preconditions met
              │              (balance/overlap)             │
              ▼                     ▼                      ▼
    NEEDS_CLARIFICATION         REFUSED           ╔════════════════════╗
    (no token minted)      (no token minted)      ║ PHASE 2 · PROPOSE  ║
              │                     │             ╚════════════════════╝
              │                     │              freeze payload
              │                     │              mint token (expiresAt)
              │                     │              persist proposal row
              │                     │              log action.proposed
              │                     │                      │
              │                     │                      ▼
              │                     │            PENDING_CONFIRMATION
              │                     │            → return to supervisor
              │                     │            → card rendered, turn ENDS
              │                     │                      │
              │                     │         ╔════════════▼═══════════╗
              │                     │         ║ PHASE 3 · CONFIRM      ║
              │                     │         ║ (a NEW user turn)      ║
              │                     │         ╚════════════════════════╝
              │                     │          confirmed + token arrive
              │                     │                      │
              │                     │        ┌─────────────┼─────────────┐
              │                     │        ▼             ▼             ▼
              │                     │    consume       consume       confirmed
              │                     │    count===0     count===1      = false
              │                     │        │             │             │
              │                     │        ▼             │             ▼
              │                     │  ALREADY_SUBMITTED    │         CANCELLED
              │                     │  / EXPIRED            │      (token consumed,
              │                     │  NO downstream call   │       no call made)
              │                     │                       ▼
              │                     │        re-validate auth + preconditions
              │                     │                       │
              │                     │              ┌────────┴────────┐
              │                     │              ▼                 ▼
              │                     │        still valid       no longer valid
              │                     │              │                 │
              │                     │   ╔══════════▼═════════╗       ▼
              │                     │   ║ PHASE 4 · EXECUTE  ║   REFUSED
              │                     │   ║ THE ONLY WRITE     ║  (stale proposal;
              │                     │   ╚════════════════════╝   re-propose)
              │                     │      exactly ONE POST
              │                     │              │
              │                     │      ┌───────┴────────┐
              │                     │      ▼                ▼
              │                     │    2xx            non-2xx / timeout
              │                     │      │                │
              │                     │      │                ▼
              │                     │      │            FAILED
              │                     │      │       (specific code,
              │                     │      │        Phase 5 SKIPPED)
              │                     │      ▼
              │                     │  ╔═══════════════════╗
              │                     │  ║ PHASE 5 · VERIFY  ║
              │                     │  ╚═══════════════════╝
              │                     │     read back by id
              │                     │            │
              │                     │   ┌────────┴────────┐
              │                     │   ▼                 ▼
              │                     │ MATCHED      MISMATCHED /
              │                     │   │          UNAVAILABLE
              │                     │   ▼                 ▼
              │                     │ SUCCESS         UNVERIFIED
              │                     │ + schedule      NO follow-up
              │                     │   follow-up     scheduled
              ▼                     ▼   │                 │
        ────────────────────────────────┴─────────────────┴────────
                          return control to supervisor
```

---

## Terminal states

| Status | Write occurred? | Token | Follow-up scheduled? |
|---|---|---|---|
| `NEEDS_CLARIFICATION` | no | not minted | no |
| `REFUSED` (precondition) | no | not minted | no |
| `REFUSED` (stale at confirm) | no | consumed | no |
| `PENDING_CONFIRMATION` | no | minted, PENDING | no |
| `CANCELLED` | no | consumed | no |
| `ALREADY_SUBMITTED` | no (this turn) | already consumed | no |
| `FAILED` | attempted, rejected | consumed | no |
| `UNVERIFIED` | **yes, probably** | consumed | **no** |
| `SUCCESS` | yes, confirmed | consumed | yes |

**`UNVERIFIED` is the state that most needs care.** The write probably landed — which means HR Core probably emitted `leave.requested` and the manager probably already has a notification. The user is nonetheless told to verify manually. No follow-up is scheduled, because the system will not check in on an absence it cannot confirm exists.

---

## Hard rules

1. **Phase 4 is the only phase that may issue a mutating call.** Phases 1, 2, 3, 5 are read-only. A mutating call from any other phase is a contract violation.
2. **Consent is explicit or absent.** Only `confirmed: true` plus a matching, unconsumed, unexpired token authorizes Phase 4. Message text is never parsed for consent — "yes", "do it", and "confirm" typed as ordinary messages authorize nothing.
3. **Consume precedes call.** The order is: conditional update → check count → then POST. Never POST-then-consume.
4. **One token, one outcome.** A consumed token is terminal regardless of result. Retry after `FAILED` requires a **new** proposal.
5. **No success without verification.** `SUCCESS` requires `verificationState = MATCHED`. Every other verify outcome is `UNVERIFIED`.
6. **`totalDays` is never a mismatch.** HR Core computes it authoritatively; the proposal's `businessDays` is advisory display only (research.md R4).
7. **Phase 5 is skipped when Phase 4 failed.** There is nothing to read back.
8. **Read-only specialists cannot enter this machine.** They receive `ReadOnlyConstraints` and cannot construct a confirmation payload without a compile error.

---

## Audit contract

Three linked `AgentTaskLog` entries per action, using the existing `parentLogId` self-relation:

```
action.proposed   (parentLogId = supervisor run log)
  └─ action.executed  (parentLogId = action.proposed)
       └─ action.verified  (parentLogId = action.executed)
```

| taskType | Written when | Records |
|---|---|---|
| `action.proposed` | Phase 2 completes | frozen payload, policy sources consulted, propose-time permission decision, **no write occurred** |
| `action.executed` | Phase 4 completes | HTTP status, `errorCode`, `errorMessage`, created record id, confirm-time permission decision (logged **distinctly** from propose-time per FR-048) |
| `action.verified` | Phase 5 completes | comparison outcome, authoritative `totalDays`, any discrepancy detail |
| `leave.sick_wellness_followup` | cron sends or suppresses | `trigger = SCHEDULED`, resolution reason, originating booking |

Phases that do not run write no entry — an absent `action.verified` alongside a successful `action.executed` is itself the signal that a turn was interrupted mid-flight, and is queryable for operators.

---

## Proactive follow-up (out-of-band, no user turn)

```
hourly cron
   → find followUpAt <= now AND resolvedAt IS NULL
   → for each:
       stale (> 24h overdue)?          → resolve SUPPRESSED_STALE, no message
       mint SYSTEM context (forSystemTask)
       re-read leave request by id      → cancelled/rejected?
                                        → resolve SUPPRESSED_CANCELLED, no message
       insert ASSISTANT message into the EXISTING conversation
       log with trigger = SCHEDULED
       resolve SENT
```

**Rules:**
- Runs under `AgentContextFactory.forSystemTask()`. The user's JWT is never persisted or reused (FR-041).
- Writes only into a conversation the user already owns; never creates one (FR-037).
- Cancellation awareness is a **fire-time read**, not an event subscription — `InMemoryEventBus` is per-process and cannot deliver `leave.cancelled` across services (research.md).
- The message itself mutates nothing. A user reply re-enters this state machine at Phase 1 as a normal turn (FR-036).
