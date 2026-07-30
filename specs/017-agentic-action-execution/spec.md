# Feature Specification: Agentic Action Execution (Reason → Propose → Confirm → Execute → Verify)

**Feature Branch**: `017-agentic-action-execution`
**Created**: 2026-07-30
**Status**: Draft
**Input**: User description: "equip the ai agent to be able to book holiday on behalf of user… the agent should always consult the policy… when the user says he is sick the agent books him sickness leave and his manager is informed of his absence… ensure the holiday was submitted successfully, user should click confirm to confirm his intention, agent can check balance before submit action"

## Overview

Feature `016-ai-module` delivered a **read-only** supervisor agent: it understands, routes, retrieves, and answers. This feature gives it **hands** — the ability to change official HR records — without giving up any of the trust guarantees that made the read-only assistant safe.

The governing principle is **the model proposes, the human confirms, code executes, and the system verifies**. An LLM never directly mutates an HR record, and the user is never told something worked until the system has independently confirmed that it did.

Every mutating action moves through five phases:

| Phase | Owner | Mutates? | Purpose |
|-------|-------|----------|---------|
| **1. Reason** | Specialist agent | No | Gather read-only context: balance, overlaps, holidays, and **approved policy via RAG** |
| **2. Propose** | Specialist agent | No | Compute an exact payload, mint a single-use token, present it for review with policy citations |
| **3. Confirm** | The human | No | An explicit tap. No implicit or inferred consent, ever |
| **4. Execute** | Deterministic code | **Yes** | Exactly one downstream write, using the payload frozen at propose time |
| **5. Verify** | Deterministic code | No | Independent read-back before the user is told it succeeded |

---

## Architecture

### End-to-end flow

```
User: "I'm not feeling well today"
   │
   ▼
┌──────────────────────────────────────────────────────────────────┐
│ SUPERVISOR (016 three-phase gate — unchanged)                    │
│   Phase 1 security guardrail → Phase 2 intent classifier         │
│   → Phase 3 RBAC/scope guardrail                                 │
│   Classifier sets emotionalContext = COMPASSIONATE_SICK          │
└──────────────────────────────────────────────────────────────────┘
   │ routes to
   ▼
┌──────────────────────────────────────────────────────────────────┐
│ LEAVE AGENT — PHASE 1: REASON  (all read-only)                   │
│   getLeaveContext()      EXISTS → balances + recentRequests      │
│                                   (covers balance AND overlap)   │
│   getHolidaysContext()   EXISTS → business-day math              │
│   getLeaveTypes()        NEW    → resolve "sick" to a type id    │
│   KnowledgeRepository.searchApproved()  → POLICY (advisory)      │
└──────────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 2: PROPOSE — no write occurs                               │
│   Compute payload · mint single-use token · persist server-side  │
│   return status = PENDING_CONFIRMATION + policy citations        │
└──────────────────────────────────────────────────────────────────┘
   │
   ▼  frontend renders <LeaveConfirmationCard> (not a chat bubble)
┌──────────────────────────────────────────────────────────────────┐
│  🤒 Sick Leave · 1 day · Today, 30 July 2026                     │
│  Balance after: 8 days remaining                                 │
│  ℹ Per Leave Policy v2, no medical certificate is required       │
│    for absences of 2 days or fewer.                              │
│                          [Cancel]          [Confirm ✓]           │
└──────────────────────────────────────────────────────────────────┘
   │ PHASE 3: user taps Confirm
   ▼
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 4: EXECUTE — the only mutating step                        │
│   Re-check auth + preconditions → consume token → ONE POST       │
│   HrCoreAiClient.createLeaveRequest(frozen payload, context)     │
└──────────────────────────────────────────────────────────────────┘
   │ HTTP 201 + leaveRequestId
   ▼
┌──────────────────────────────────────────────────────────────────┐
│ PHASE 5: VERIFY — read it back before claiming success           │
│   GET the created request by id · compare vs expected payload    │
│   match → SUCCESS  ·  mismatch/unreachable → UNVERIFIED          │
└──────────────────────────────────────────────────────────────────┘
   │
   ├─────────────────────────────────────────────────────────────┐
   ▼                                                             ▼
"Done — your sick leave is submitted."              MANAGER NOTIFICATION
"I'll check in with you in 2 days."                 (HR Core owns this)
   │                                                             │
   ▼ schedules                                     HR Core creates LeaveRequest
┌──────────────────────────┐                       and emits `leave.requested`
│ ScheduledFollowUp row    │                              │
│ +2 days, PENDING         │                              ▼
└──────────────────────────┘                    notifications-events.bridge
   │ hourly cron                                          │
   ▼                                                      ▼
ProactiveMessageService                       leave.rules.ts → onRequested
posts assistant message:                      → notifies employee.managerId
"Hi Anis, hope you're feeling better…"          (falls back to HR admins)
```

### Why the agent does not notify the manager itself

The user's requirement — "the manager is informed of his absence" — is satisfied **as a consequence of Execute succeeding**, not by any AI-side messaging code.

HR Core already emits `leave.requested` on creation, and [`leave.rules.ts`](../../apps/hr-core/src/modules/notifications/events/routing-rules/leave.rules.ts) `onRequested` already resolves `employee.managerId` and routes a `REQUEST_SUBMITTED` notification to them (falling back to active HR admins when no manager is set). This path is live today.

Routing the agent's booking through it rather than around it buys three things:

1. **Identical behavior across surfaces.** A manager receives the same notification whether the request originated in the AI chat or on the Leaves page. No second, divergent notification format to maintain.
2. **Module boundary preserved.** `apps/ai-agentic` never imports from `apps/hr-core`. `MailService` lives in `hr-core/iam` and is unreachable from the AI service by design — and must stay that way for the AI layer to remain portable.
3. **The project's own stated convention is respected.** Per `CLAUDE.md`: notifications are created *only* from `DomainEvent` subscribers in the bridge; domain services never call `NotificationsService` directly. An AI service inventing its own manager-messaging path would be a worse violation of that rule than a domain service doing it.

**Consequence for this spec:** there is no "send email/Slack to manager" requirement. There is a requirement that Execute must succeed for the manager to learn of the absence — which is precisely why Verify (Phase 5) exists. A silently-failed booking is not just an unbooked day off; it is a manager who was never told.

### Policy consultation — advisory, not authoritative

The agent **must** consult approved policy knowledge before proposing, and **must** cite what it used. But retrieved policy text is advisory context for the human, never an eligibility verdict.

| Concern | Authority | How it is used |
|---------|-----------|----------------|
| Balance sufficiency, overlapping requests, date validity, leave-type existence | **HR Core** — authoritative | Agent reads these to propose well; HR Core rejecting at Execute is the backstop |
| Written policy conditions, required documents, notice expectations, eligibility nuance | **Approved policy documents via RAG** — advisory | Surfaced and cited on the confirmation card so the user understands *why* before confirming |

This split exists to prevent two specific failure modes: an LLM refusing a perfectly valid booking because it retrieved a policy chunk out of context, and an LLM confidently proposing a booking that HR Core then rejects. **A proposal is never an eligibility guarantee.** The card must read as "here is what I understand and what the policy says," not "this is approved."

### Where the code lives

| Concern | Location | New? |
|---------|----------|------|
| Five-phase orchestration, token lifecycle | `apps/ai-agentic/src/modules/agents/specialists/` | extends existing |
| `createLeaveRequest` + read-back | `apps/ai-agentic/src/common/clients/hr-core-ai.client.ts` | new methods (client is read-only today) |
| `PENDING_CONFIRMATION` / `FAILED` / `UNVERIFIED`, confirmation payload | `apps/ai-agentic/src/common/graph/agent-graph.types.ts` | extends 016 types |
| Token store, single-use enforcement | `apps/ai-agentic` conversation agent-context | extends existing |
| `ScheduledFollowUp`, cron runner, proactive message | `apps/ai-agentic` + `ai_agent` schema | new |
| Confirmation / failure / sick-leave card | `apps/web/src/components/ai/` | new |
| Manager notification | `apps/hr-core` notifications bridge | **already exists — unchanged** |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reason Over Policy and Context, Then Propose (Priority: P1)

As an employee, I want the agent to understand my request, check my real balance and existing bookings, consult the company's approved leave policy, and show me a precise proposal with its reasoning cited — before anything changes — so I can see exactly what will be submitted and why it is allowed.

**Why this priority**: Propose-before-act is the foundational trust boundary. Confirm, Execute, and Verify are meaningless if the agent can mutate data without first reasoning about and disclosing its intent.

**Independent Test**: Ask for leave under valid, insufficient-balance, overlapping, and policy-conditional scenarios; verify a `PENDING_CONFIRMATION` result with correctly computed fields and policy citations in the valid case, and that no write reaches HR Core in any case.

**Acceptance Scenarios**:

1. **Given** an employee with sufficient balance, **When** they ask to book leave for a valid range, **Then** the agent computes business days (excluding weekends and public holidays), fetches the current balance, retrieves approved policy context, and returns a proposal showing balance-after and cited policy — without calling any creation endpoint.
2. **Given** the requested days exceed the remaining balance, **When** they ask to book, **Then** the agent declines to propose, explains the shortfall with the actual numbers, and mints no token.
3. **Given** an approved or pending request already overlaps the requested dates, **When** they ask to book, **Then** the agent surfaces the overlap and does not propose the booking as-is.
4. **Given** the message under-specifies leave type or dates, **When** the agent reasons about it, **Then** it asks one focused clarification question rather than guessing.
5. **Given** approved policy content is retrieved that materially affects this booking (required documentation, notice expectations, conditions on adjacent absences), **When** the proposal is shown, **Then** the relevant policy point is quoted or summarized on the card with its source document named.
6. **Given** no approved policy document is indexed for the relevant leave type, **When** the proposal is shown, **Then** the agent proceeds using HR Core data alone and states plainly that no policy document was available — it MUST NOT invent policy.
7. **Given** a valid proposal, **When** it is returned, **Then** it carries a single-use confirmation token bound to the exact computed payload, and that payload is persisted server-side rather than relying on the client to resend it.

---

### User Story 2 - Confirm and Execute (Priority: P1)

As an employee who has reviewed a proposal, I want to explicitly confirm before the request is submitted, and be told plainly whether it worked, so records change only when I say so and I never wonder whether my time off is actually booked.

**Why this priority**: This is the moment of actual mutation — the highest-risk step — and it must be unambiguous, single-shot, and honest about failure.

**Independent Test**: Confirm a valid proposal and verify exactly one POST occurs, the UI blocks a second submission, and a non-201 renders an explicit failure card rather than a false success.

**Acceptance Scenarios**:

1. **Given** a valid unexpired token, **When** the user taps Confirm, **Then** the agent executes exactly one create call using the payload frozen at propose time — never a payload re-derived from the confirm message.
2. **Given** the create call returns 201, **When** execution completes, **Then** the token is marked consumed and the result carries the created leave-request identifier, pending verification.
3. **Given** the create call returns any non-2xx, times out, or the connection fails, **When** execution completes, **Then** the agent reports `FAILED` with the specific downstream reason and never reports success.
4. **Given** the user taps Confirm twice, or retries after a timeout, **When** the second attempt is processed, **Then** the already-consumed token is detected and "this booking was already submitted" is returned with no second write.
5. **Given** the user taps Cancel, **When** processed, **Then** the token is consumed, no downstream call is made, and the cancellation is confirmed in plain language.
6. **Given** a token is expired, already consumed, or belongs to a different user or conversation, **When** a confirm references it, **Then** execution is refused and the user is asked to re-propose.
7. **Given** the balance or overlap situation changed between propose and confirm, **When** Confirm is processed, **Then** preconditions are re-validated and execution is refused with an explanation rather than submitting against stale numbers.
8. **Given** the user's role or account status changed between propose and confirm, **When** Confirm is processed, **Then** authorization is re-checked and recorded as a distinct decision from the propose-time check.

---

### User Story 3 - Verify the Outcome (Priority: P1)

As an employee, I want the agent to independently confirm my leave request truly exists in HR Core after submission — not merely trust the HTTP response — so a partial failure never leaves me, or my manager, with false confidence.

**Why this priority**: A 201 confirms the request was accepted, not that it is durably queryable and notification-triggering. The read-back is what makes "evaluate the action" a real, testable behavior. It is P1 alongside Execute because the manager-notification requirement depends entirely on the write having genuinely landed.

**Independent Test**: Simulate a create returning 201 where the subsequent read-back fails or returns a mismatched record; verify the agent reports unverified and directs the user to check manually, rather than `SUCCESS`.

**Acceptance Scenarios**:

1. **Given** a create returns 201 with an id, **When** the agent evaluates, **Then** it performs a read-back for that id before telling the user it succeeded.
2. **Given** the read-back confirms the record with expected dates and status, **When** evaluation completes, **Then** success is reported with a short summary (dates, status, balance after) and confirmation that the manager has been notified.
3. **Given** the read-back fails, times out, or returns a mismatched record, **When** evaluation completes, **Then** the outcome is reported as unverified, the user is told to check the Leaves page or contact HR, the discrepancy is logged for operators, and no follow-up is scheduled.
4. **Given** Execute already failed, **When** evaluation would run, **Then** it is skipped — verification runs only after an apparently-successful write.

---

### User Story 4 - Compassionate Sick-Leave Booking (Priority: P2)

As an employee who is unwell, I want to say so in plain language and have my sick day booked in a single tap, with no interrogation about symptoms, and know my manager has been informed — so being ill costs me as little effort as possible.

**Why this priority**: This is the flow the framework exists to enable and the one users will feel most. It is P2 only because it depends on P1 mechanics being in place; it is the primary launch scenario.

**Independent Test**: Send "I'm not feeling well today" and verify the response opens with empathy, proposes exactly one day (today), asks no diagnostic questions, and — after Confirm and successful verification — states that the manager has been notified.

**Acceptance Scenarios**:

1. **Given** a user expresses illness in natural language ("I'm sick", "not feeling well", "I have a fever"), **When** the supervisor classifies it, **Then** it routes to the Leave Agent without requiring explicit "book leave" phrasing, and marks the turn's emotional context as compassionate.
2. **Given** a sick-leave intent, **When** the agent responds, **Then** the first sentence acknowledges how the user feels before any data, and the tone remains warm through the confirmation card.
3. **Given** a sick-leave intent with no stated duration, **When** the agent proposes, **Then** it defaults to one day (today) rather than asking the user to specify a range.
4. **Given** a sick-leave intent, **When** the agent responds, **Then** it asks **zero** diagnostic questions — no symptoms, no doctor's note, no reason. Verification of medical documentation is HR's role at approval time, not the agent's.
5. **Given** a sick-leave booking is confirmed and verified, **When** the agent replies, **Then** it confirms submission, states the manager has been notified, and tells the user to rest.
6. **Given** the user specifies a longer duration ("I'll be out the rest of the week"), **When** the agent proposes, **Then** it honors the stated range instead of the one-day default, still without diagnostic questions.
7. **Given** approved policy indicates documentation is required beyond a certain duration, **When** the proposal exceeds it, **Then** the card notes the requirement as advisory information — it does not block the booking.

---

### User Story 5 - Proactive Wellness Follow-Up (Priority: P3)

As an employee who booked sick leave, I want the assistant to check in on me a couple of days later, so I can extend my leave in one exchange if I am still unwell and feel the company noticed I was gone.

**Why this priority**: This is the feature's most distinctive moment — the system reaching out rather than waiting — but the booking flow is fully valuable without it, and unprompted outbound messaging deserves its own careful guardrails.

**Independent Test**: Confirm a sick-leave booking, advance the clock past the follow-up window, run the scheduler, and verify exactly one assistant message appears in the same conversation; verify no message is sent when the underlying request was cancelled meanwhile.

**Acceptance Scenarios**:

1. **Given** a sick-leave booking is confirmed **and verified**, **When** execution completes, **Then** a follow-up is scheduled for a configurable interval (default 2 days) in that same conversation.
2. **Given** a scheduled follow-up becomes due, **When** the scheduler runs, **Then** an assistant message appears in the existing conversation asking warmly whether the user is ready to return or would like to extend.
3. **Given** the user replies "still not well", **When** the supervisor processes it, **Then** the Leave Agent enters the normal propose→confirm→execute→verify flow for the extension — a follow-up MUST NOT auto-book anything.
4. **Given** a follow-up has been sent, **When** the scheduler runs again, **Then** it is not re-sent. Each scheduled follow-up fires at most once.
5. **Given** the underlying leave request was cancelled or rejected before the follow-up is due, **When** the scheduler runs, **Then** the follow-up is suppressed and marked resolved without messaging the user.
6. **Given** the user already returned to work and said so in the conversation, **When** the follow-up is due, **Then** it is still permitted to send (the agent cannot reliably infer return), but MUST be phrased so it reads naturally if the user is already back.
7. **Given** a verification returned unverified, **When** execution completes, **Then** no follow-up is scheduled — the system does not check in on an absence it cannot confirm exists.
8. **Given** the scheduler encounters a conversation the user has since deleted or archived, **When** it runs, **Then** the follow-up is suppressed rather than resurrecting a closed thread.

---

### User Story 6 - Auditable Five-Phase Trail (Priority: P3)

As an HR admin or system operator, I want each phase individually logged and linked, so I can reconstruct exactly what the agent proposed, what the user approved, what actually happened in HR Core, and whether it was verified.

**Why this priority**: Makes the feature governable and debuggable after the fact; the user-facing flow works without an operator reading logs on day one.

**Independent Test**: Run a full flow and confirm linked `AgentTaskLog` entries exist with correct parent-child relationships and statuses.

**Acceptance Scenarios**:

1. **Given** a proposal is returned, **Then** an `action.proposed` log records the full computed payload, the policy sources consulted, and the absence of any write.
2. **Given** a confirmation executes, **Then** an `action.executed` log records HTTP status and response summary, linked to the proposal via `parentLogId`.
3. **Given** verification runs, **Then** an `action.verified` log records the comparison outcome, linked to the execution log.
4. **Given** a proactive follow-up is sent, **Then** it is logged with its originating booking referenced.
5. **Given** any phase fails, **Then** the failure reason and HTTP status are captured in full — never swallowed or generalized.

---

### Edge Cases

- **Balance changes between propose and confirm** (another request consumed it) — preconditions MUST be re-validated at Confirm; refuse rather than submit against stale numbers.
- **Token reused after consumption** — rejected with "already submitted"/"already cancelled", no second write.
- **Token expires unconfirmed** — requires a fresh proposal; an expired token MUST NOT be silently revived.
- **User's role or account status changes between propose and confirm** — re-checked at Confirm, logged as a distinct decision.
- **HR Core unreachable at Confirm** — `FAILED`, not an indefinite retry and never a success claim.
- **HR Core accepts the write but read-back is unavailable** — unverified/degraded, never `SUCCESS`, and no follow-up scheduled.
- **Unrelated message arrives while a proposal is pending** — MUST NOT be read as implicit confirmation; only an explicit confirm plus matching token counts.
- **Two pending proposals in one conversation** — disambiguated strictly by token; confirming one MUST NOT consume or execute the other.
- **Leave requested for today or the past** — handled by existing date validation and clarified before any proposal.
- **Policy document retrieved is stale or contradicts HR Core data** — HR Core wins for anything it owns; the agent surfaces the discrepancy rather than presenting it as settled.
- **User expresses illness but is out of leave balance** — the agent still responds with empathy, explains the balance situation, and routes to HR rather than silently failing or lecturing.
- **User expresses distress beyond ordinary illness** (mental-health crisis, safety risk) — existing `IMMEDIATE_SAFETY_PATTERNS` handling from 016 takes precedence over booking; the agent MUST NOT reduce a crisis to a leave transaction.
- **Follow-up cron encounters a backlog** after downtime — each due follow-up still fires at most once; the system MUST NOT burst days of stale check-ins at a user.
- **Employee has no manager assigned** — Execute still succeeds; HR Core's existing routing falls back to active HR admins, and the agent MUST NOT claim a specific manager was notified when none exists.

## Requirements *(mandatory)*

### Functional Requirements

#### Five-phase execution framework

- **FR-001**: Every mutating specialist action MUST proceed through Reason → Propose → Confirm → Execute → Verify; no specialist MAY call a record-mutating downstream endpoint outside the Execute phase.
- **FR-002**: The Reason and Propose phases MUST use read-only calls only, and MUST NOT invoke any create, update, or delete endpoint.
- **FR-003**: Every proposal MUST mint a single-use confirmation token bound server-side to the exact computed payload, persisted in the conversation's stored agent context — the system MUST NOT rely on the client to resend the payload accurately.
- **FR-004**: Confirmation tokens MUST be single-use, time-bound with a configurable expiry, and scoped to the originating user and conversation; reuse, expiry, or cross-user/cross-conversation reference MUST cause refusal.
- **FR-005**: The Confirm phase MUST re-validate the preconditions established at propose time — balance, overlap, and authorization — and MUST refuse execution if any is no longer satisfied.
- **FR-006**: The Execute phase MUST consume the token before issuing the downstream call, so a retry or double-tap finds it consumed; the resulting consumed-but-unconfirmed window MUST be reconciled by the Verify read-back rather than by re-submitting.
- **FR-007**: The Execute phase MUST classify any non-2xx response, timeout, or network failure as `FAILED`, and MUST NOT report success unless the downstream service returned success.
- **FR-008**: The Verify phase MUST perform an independent read-back of the created record and compare it against the expected payload before the user is told the action succeeded.
- **FR-009**: If verification cannot complete or does not match, the system MUST report an unverified outcome — never `SUCCESS` — and MUST direct the user to a manual fallback.
- **FR-010**: On `FAILED`, the message surfaced MUST include the specific downstream reason (e.g. "HR Core returned: insufficient balance") rather than a generic error.
- **FR-011**: The framework MUST be specialist-agnostic so future mutating actions (leave cancellation, complaint submission) reuse it without a new state-machine design; leave booking is the reference implementation.
- **FR-012**: `SpecialistResult` / `SpecialistStatus` MUST be extended with `PENDING_CONFIRMATION`, `FAILED`, and an unverified outcome, and MUST carry an action-specific confirmation payload and token.
- **FR-013**: A Cancel action MUST consume the token, perform no downstream write, and produce a clear cancellation confirmation.
- **FR-014**: Mutating actions MUST inherit the requesting user's RBAC scope under existing `AgentContext` rules at both Propose and Confirm time — an agent MUST NOT gain broader authority than the human it acts for.
- **FR-015**: The Propose phase MUST run only after the existing 016 three-phase supervisor gate; this framework governs what happens after routing, and MUST NOT alter the security/intent/scope gate itself.

#### Policy consultation

- **FR-016**: Before proposing any mutating action, the agent MUST query approved policy knowledge for context relevant to the action.
- **FR-017**: When retrieved policy materially affects the action, the proposal MUST surface the relevant point and name its source document, so the user sees the reasoning before confirming.
- **FR-018**: Retrieved policy is **advisory**. HR Core remains authoritative for everything it owns — balance, overlap, date validity, leave-type existence — and a proposal MUST NOT be presented as an eligibility guarantee or an approval.
- **FR-019**: When no approved policy document is available for the action, the agent MUST proceed on HR Core data alone and state that no policy document was found. It MUST NOT invent, infer, or generalize policy.
- **FR-020**: When retrieved policy appears to contradict HR Core data, the agent MUST surface the discrepancy rather than resolving it silently in either direction.

#### Manager notification

- **FR-021**: When a leave request is successfully created and verified, the employee's manager MUST be informed of the absence.
- **FR-022**: This notification MUST be produced by HR Core's existing domain-event pipeline (`leave.requested` → notifications bridge → routing rule), triggered as a consequence of Execute succeeding. The AI service MUST NOT send messages to managers through any channel of its own.
- **FR-023**: The AI service MUST NOT import from, or directly invoke, HR Core notification or mail components; the boundary between `apps/ai-agentic` and `apps/hr-core` remains REST-and-events only.
- **FR-024**: The agent MUST tell the user their manager has been notified only after verification succeeds, and MUST NOT name a specific manager when the employee has none assigned.
- **FR-025**: Notification is a consequence of **creation**, not of verification — `leave.requested` fires inside HR Core the moment the record is created, before the AI service reads it back. An unverified outcome therefore means the user is told to check manually while the manager may already hold a notification. This asymmetry is intended: a failed read-back implicates the read path, not the write, and suppressing a notification the AI service did not send is neither possible nor desirable.

#### Compassionate sick leave

- **FR-026**: The supervisor MUST recognize natural-language illness expressions and route to the Leave Agent without requiring explicit booking phrasing.
- **FR-027**: The turn's emotional context MUST be carried to the final-answer stage so the response opens by acknowledging how the user feels before presenting any data.
- **FR-028**: The sick-leave flow MUST ask zero diagnostic questions — no symptoms, no medical documentation, no reason.
- **FR-029**: The sick-leave flow MUST default to a single day (today) when no duration is stated, and honor a stated range when one is given.
- **FR-030**: Sick leave MUST still pass through Confirm — it is minimum-friction (one tap), never autonomous. No mutating action is exempt from explicit human confirmation.
- **FR-031**: Life-event vocabulary (sick, unwell, ill, fever, and equivalents) MUST NOT be treated as out-of-scope by the scope guardrail.
- **FR-032**: Where an expression of illness also signals distress or a safety risk, existing immediate-safety handling MUST take precedence over the booking flow.

#### Proactive follow-up

- **FR-033**: On a confirmed **and verified** sick-leave booking, the system MUST schedule a wellness follow-up at a configurable interval (default 2 days) in the same conversation.
- **FR-034**: A scheduled follow-up MUST fire at most once and MUST be marked resolved after firing or suppression.
- **FR-035**: A follow-up MUST be suppressed if the underlying leave request was cancelled or rejected, if the booking was never verified, or if the conversation has been deleted or archived.
- **FR-036**: A follow-up MUST NOT auto-book, extend, or mutate anything; a user's reply re-enters the normal propose→confirm→execute→verify flow.
- **FR-037**: Proactive messages MUST be written only into a conversation already owned by that user; the system MUST NOT create new unsolicited conversations.
- **FR-038**: After downtime, a backlog of due follow-ups MUST NOT be delivered as a burst; stale follow-ups past a reasonable window MUST be suppressed rather than sent late.
- **FR-039**: Proactive messages MUST be logged with the same audit rigor as user-triggered actions, referencing the booking that scheduled them.
- **FR-040**: Before sending a follow-up, the scheduler MUST re-read the originating leave request's current state and suppress the message if it is no longer active (cancelled or rejected). Because the domain event bus is in-process only and does not cross service boundaries, this check MUST be a read at fire time, not an event subscription.
- **FR-041**: Proactive follow-up execution — including the fire-time state re-read — MUST run under a SYSTEM context minted by `AgentContextFactory.forSystemTask()` with an explicit task type. The user's original JWT MUST NOT be persisted beyond the turn that created it, nor reused to act on their behalf days later.
- **FR-042**: HR Core MUST accept the SYSTEM role on the leave-request read endpoint used by the scheduler, scoped to reading only the specific request the follow-up references.

#### Frontend contract

- **FR-043**: The frontend MUST render a distinct confirmation card — not a plain chat bubble — whenever a message carries a confirmation payload, with explicit Confirm and Cancel controls.
- **FR-044**: The Confirm control MUST disable immediately on first tap and re-enable only on a `FAILED` response, preventing duplicate submissions.
- **FR-045**: The UI MUST NOT render an optimistic success state; it MUST await the full Execute-plus-Verify round trip before showing success.
- **FR-046**: `FAILED` and unverified outcomes MUST render as structured cards with the specific reason and a manual fallback, not as a transient toast.
- **FR-047**: The sick-leave card MUST be visually and textually distinct from a standard holiday booking card, reflecting the compassionate tone.
- **FR-048**: Policy citations attached to a proposal MUST be visible on the card before the user confirms, not disclosed only afterward.

#### Audit

- **FR-049**: Each executed phase MUST write a distinct audit log entry; Execute and Verify entries MUST link to their originating Propose entry via `parentLogId`.
- **FR-050**: Propose-time and Confirm-time authorization decisions MUST be logged distinctly, so a permission change between them is auditable.
- **FR-051**: Policy sources consulted during Reason MUST be recorded on the proposal log entry.

### Key Entities

- **Agent Action Proposal**: The computed payload frozen at propose time (for leave: type, dates, business days, current balance, balance after, employee), plus the policy citations that informed it.
- **Confirmation Token**: A single-use, time-bound identifier scoped to one user and conversation, binding a Confirm request to the proposal it must execute unchanged.
- **Action Execution Result**: Outcome of Execute — status, downstream HTTP result, created record identifier on success.
- **Action Verification Result**: Outcome of Verify — matched, mismatched, or unavailable, with comparison detail.
- **Scheduled Follow-Up**: A pending proactive check-in bound to a conversation, user, originating leave request, due time, and resolution state.
- **Policy Citation**: A reference to the approved document and passage that informed a proposal, surfaced to the user before confirmation.
- **Specialist Result** *(extended from 016)*: Carries the new statuses plus optional confirmation payload, token, and emotional context.
- **Agent Task Log** *(reused from 016)*: New task types for each phase, linked through the existing `parentLogId` chain.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of mutating actions in the launch test set follow Reason → Propose → Confirm → Execute → Verify, with zero paths executing without a prior confirmed proposal.
- **SC-002**: 0 duplicate downstream writes across a test set of double-click and retry-after-timeout scenarios.
- **SC-003**: 100% of `FAILED` executions surface a specific, non-generic reason.
- **SC-004**: 100% of apparently-successful executions are followed by a verification read-back before success is shown.
- **SC-005**: 100% of expired or reused tokens are rejected without a downstream call.
- **SC-006**: 100% of proposals either cite the approved policy consulted or state explicitly that none was available.
- **SC-007**: 0 instances in the test set where the agent asserts a policy rule not present in a retrieved document.
- **SC-008**: 100% of successfully verified leave bookings result in a manager (or HR-admin fallback) notification via the existing event pipeline, with no AI-originated outbound message.
- **SC-009**: 100% of sick-leave flows in the test set ask zero diagnostic questions and open with an empathetic acknowledgement.
- **SC-010**: 90% of sick-leave bookings complete in a single user tap after the initial message.
- **SC-011**: 100% of scheduled follow-ups fire at most once, and 100% of follow-ups whose booking was cancelled, rejected, or unverified are suppressed.
- **SC-012**: 95% of pilot users correctly distinguish a proposed booking from a confirmed one without additional explanation.
- **SC-013**: 100% of phases exercised in the test set produce a correctly linked audit entry.
- **SC-014**: 0 test-set paths in which `apps/ai-agentic` reaches HR Core notification or mail components other than through REST and domain events.

## Assumptions

- Builds directly on `016-ai-module`'s supervisor graph, `AgentContext`, `AgentTaskLog`, and `KnowledgeRepository`; it does not redefine the three-phase security/intent/RBAC gate.
- `leave.requested` → notifications bridge → manager routing already exists in HR Core and is unchanged by this feature. Its correctness is a **precondition**, not a deliverable.
- Notification **delivery channels** are out of scope. Managers receive the existing in-app/SSE notification. Email beyond invites and Slack (`ChannelType.SLACK` exists in the enum with no implementation, and no Slack package is installed) are deferred to a future channel-delivery feature owned by HR Core.
- No new configured business rules — such as restrictions on leave adjacent to remote work — are introduced here. That example is treated as illustrative of the *duty to consult policy*: the agent must retrieve and cite approved policy, while HR Core remains authoritative for what it validates. Should such a rule become a hard constraint, it belongs in HR Core's leave validation, and the agent would surface its rejection through the existing `FAILED` path with no change to this framework.
- HR Core's leave-request creation is safe to call at most once per confirmed token. No cross-service distributed transaction or automatic compensating rollback is attempted — a failed or unverified execution is surfaced to the human, never auto-retried.
- Verify reuses existing HR Core read endpoints; no new HR Core write endpoints are required.
- Multi-channel confirmation (Slack, WhatsApp) is out of scope; the first implementation targets the existing web chat surface.
- The parental-leave RAG entitlement flow sketched in `CLAUDE.md` — where the LLM interprets a policy document to generate its own clarifying questions and compute entitlement — is **deliberately excluded**. It is a distinct capability (LLM-driven multi-turn policy interpretation) that should build on this framework once the mechanics are proven, and warrants its own specification.
- Proactive work is credential-free by design. A user's JWT is valid for minutes; a follow-up fires days later. The scheduler therefore posts under a short-lived SYSTEM context minted by `AgentContextFactory.forSystemTask()`, which is the project's sanctioned mechanism for exactly this case.
- Cancellation awareness is a **read at fire time, not an event subscription.** The event catalog lists `leave.cancelled` / `leave.rejected` as consumed by AI, but the bus is `InMemoryEventBus` in both HR Core and Social — per-process, with no cross-service transport, and AI Agentic has no subscriptions today. Cross-service event delivery is Phase 2 (Kafka) work and is explicitly not built here. A SYSTEM-context read of the specific leave request before sending achieves the same suppression guarantee with no new transport, and is self-healing after downtime.
- `ScheduledFollowUp` is a **sixth** `ai_agent` entity. Both `CLAUDE.md` (§3.1 service table, §6 domain model) and `AGENTS.md` currently state AI Agentic owns 5; these counts must be updated when the model lands.
- Confirmation payloads and scheduled follow-ups follow existing conversation retention and privacy rules; no new data-classification tier is introduced.
