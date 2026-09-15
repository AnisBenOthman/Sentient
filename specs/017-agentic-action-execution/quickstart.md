# Quickstart: Agentic Action Execution

**Feature**: `017-agentic-action-execution` | **Date**: 2026-07-30

Manual verification of the five-phase flow. The happy path is the least interesting part — scenarios 3–6 are where this feature earns its keep, and a green happy path with a red scenario 5 means the feature is **not** done.

---

## Prerequisites

```bash
docker compose up -d
```

```bash
pnpm --filter ai-agentic exec prisma migrate dev
```

Then start HR Core (:3001), AI Agentic (:3003), API Gateway (:3004), and Web (:3000).

**Seed requirements**
- An employee with a linked user account, a **manager assigned**, and a positive Sick Leave balance
- An approved `KnowledgeItem` + `VectorDocument` containing leave policy text (otherwise scenario 7 is the one that applies)
- Sign in as that employee at `http://localhost:3000`

---

## Scenario 1 — Compassionate sick leave, happy path

1. Open the AI Assistant and send: **"I'm not feeling well today"**

**Expect:**
- The reply opens by acknowledging how you feel, *before* any data (FR-027)
- **No** questions about symptoms, doctor's notes, or reason (FR-028)
- A confirmation **card**, not a chat bubble (FR-042)
- Sick Leave · **1 day · today** (FR-029)
- Balance-after shown
- A policy citation naming its source document (FR-047)
- Nothing written to HR Core yet — verify on the Leaves page: no new request

2. Tap **Confirm**.

**Expect:**
- The button disables immediately (FR-043)
- No success message until the round trip completes — no optimistic UI (FR-044)
- Confirmation states the request was submitted **and that your manager was notified**
- A follow-up is scheduled

**Verify externally:**
- Leaves page shows a PENDING request for today
- Signed in as the manager: a `REQUEST_SUBMITTED` notification is present — produced by HR Core's existing `leave.requested` bridge, with no AI-originated message (SC-008)

```sql
SELECT status, executed_at, verified_at, verification_state, result_record_id
FROM ai_agent.agent_action_proposals ORDER BY created_at DESC LIMIT 1;
```
Expect `CONSUMED` / timestamps set / `MATCHED` / a record id.

---

## Scenario 2 — Holiday booking with a balance check

Send: **"I'd like to book 3 days off next month"**

**Expect:** dates clarified if under-specified (FR-004); business days exclude weekends and holidays; balance-after computed; policy consulted.

Then request **more days than your balance allows**.

**Expect:** a refusal explaining the shortfall **with the actual numbers**, and **no confirmation card** — no token is minted when a precondition fails.

---

## Scenario 3 — Double-tap produces exactly one request

Propose a booking. When the card appears, **double-click Confirm as fast as possible**.

**Expect:**
- Exactly **one** leave request on the Leaves page
- The second attempt returns "already submitted" rather than a second write

```sql
SELECT COUNT(*) FROM hr_core.leave_requests
WHERE employee_id = '<your-employee-id>' AND start_date = '<the date>';
```
Must be `1`. **Any other value fails SC-002.**

To test the harder race, disable the button-disabling in devtools and fire two confirms concurrently — the `updateMany` count check must still yield exactly one write.

---

## Scenario 4 — Failure is reported as failure

Order matters here. Reason (Phase 1) reads HR Core for leave types, balance, and holidays, so with HR Core down no proposal can be produced and there is no card to confirm. The failure must be injected **between** Propose and Confirm:

1. With HR Core **running**, ask for a booking and wait for the confirmation card
2. **Now** stop HR Core (`Ctrl+C` on :3001)
3. Tap **Confirm**

**Expect:**
- A structured failure **card**, not a toast (FR-046)
- A **specific** reason, not "Something went wrong" (FR-010)
- A manual fallback ("contact HR directly")
- The Confirm button **re-enabled** so you can retry (FR-043)
- **No** success message anywhere

Restart HR Core and verify **no** leave request was created.

---

## Scenario 5 — Unverified is not success

The scenario this feature exists for. After the POST succeeds, make the read-back fail.

Easiest approach: in `HrCoreAiClient.getLeaveRequestById`, temporarily throw, or point it at a bad path.

Propose and confirm a booking.

**Expect:**
- Status is `UNVERIFIED`, **never** `SUCCESS`
- The user is told the booking could not be confirmed and to check the Leaves page
- **No** wellness follow-up scheduled (FR-035)
- The leave request **does** exist in HR Core, and the manager **has** been notified — because notification follows creation, not verification (FR-025)

```sql
SELECT verification_state, verified_at FROM ai_agent.agent_action_proposals
ORDER BY created_at DESC LIMIT 1;
```
Expect `UNAVAILABLE`.

**If this reports SUCCESS, the core guarantee of the feature is broken.**

---

## Scenario 6 — Cancel writes nothing

Propose a booking, tap **Cancel**.

**Expect:** clear cancellation message; no HR Core record; proposal row `CONSUMED` with `executed_at` NULL. Tapping Confirm afterward is refused as already-consumed.

---

## Scenario 7 — No policy document available

Remove or unapprove the leave policy `KnowledgeItem`, then propose a booking.

**Expect:** the booking still proceeds on HR Core data, and the card **states plainly that no policy document was found**. It must **not** invent a policy rule (FR-019, SC-007).

---

## Scenario 8 — Proactive wellness follow-up

Complete scenario 1, then move the follow-up's due time into the past:

```sql
UPDATE ai_agent.scheduled_follow_ups SET follow_up_at = NOW() - INTERVAL '1 hour'
WHERE resolved_at IS NULL;
```

Wait for the hourly cron (or trigger the runner directly).

**Expect:** one warm assistant message in the **existing** conversation, no new conversation created; `resolved_at` set with `resolution = 'SENT'`; the log carries `trigger = SCHEDULED`.

Run the cron again — **no second message** (FR-034).

Reply **"still not well"** → a **new** confirmation card for the extension. The follow-up must **not** auto-book (FR-036).

**Suppression check:** schedule another follow-up, cancel the underlying leave request in HR Core, then run the cron. Expect **no message** and `resolution = 'SUPPRESSED_CANCELLED'` — proving the fire-time read works without any cross-service event bus.

---

## Scenario 9 — Expired token

Propose a booking, then expire it:

```sql
UPDATE ai_agent.agent_action_proposals SET expires_at = NOW() - INTERVAL '1 minute'
WHERE status = 'PENDING';
```

Tap **Confirm**.

**Expect:** refusal asking you to re-propose; **no** HR Core write.

---

## Scenario 10 — Read-only specialists stay read-only

Ask the OKR or Career agent to "submit", "book it", or "approve" something.

**Expect:** the existing draft-only refusal, unchanged. Only the Leave Agent holds an action capability — and a read-only specialist attempting to construct a confirmation payload is a **compile error**, not a runtime check.

---

## Regression check

```bash
pnpm --filter ai-agentic test
```

All 016 suites must stay green — particularly `draft-readonly.spec.ts` and the six specialist specs whose fixtures build `constraints`. If the capability union was done right, they compile untouched.

```bash
pnpm --filter web exec tsc --noEmit
```

---

## Verification checklist

- [ ] No HR Core write before Confirm, in any scenario
- [ ] Exactly one write per confirmed token, under double-tap (SC-002)
- [ ] Every failure names a specific reason (SC-003)
- [ ] Every apparent success is read back before being reported (SC-004)
- [ ] Expired and reused tokens are refused with no downstream call (SC-005)
- [ ] Every proposal cites policy or states none was found (SC-006, SC-007)
- [ ] Manager notified via HR Core's event pipeline only (SC-008)
- [ ] Zero diagnostic questions on sick leave (SC-009)
- [ ] Follow-ups fire at most once; suppressed when cancelled or unverified (SC-011)
- [ ] Three linked audit entries per completed action (SC-013)
- [ ] No AI-service path reaches HR Core notification or mail components (SC-014)
