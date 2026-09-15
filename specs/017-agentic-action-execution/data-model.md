# Phase 1 Data Model: Agentic Action Execution

**Feature**: `017-agentic-action-execution` | **Date**: 2026-07-30 | **Research**: [research.md](./research.md)

Schema `ai_agent`. Two new models, two new enum members, one new enum. No changes to `Conversation`, `Message`, or `AgentTaskLog` structure — all three already carry what this feature needs.

---

## What already fits (no migration needed)

Verified against `apps/ai-agentic/prisma/schema.prisma`:

| Need | Existing support |
|---|---|
| Mark a message as awaiting confirmation | `Message.status` is already `AgentRunStatus` — it takes the new `PENDING_CONFIRMATION` value directly |
| Insert a proactive assistant message | `MessageRole.ASSISTANT` exists |
| Attribute a cron-fired task | `TaskTrigger.SCHEDULED` exists |
| Link the three phase logs | `AgentTaskLog.parentLogId` + self-relation `AgentTaskLogChildren` exist |
| Record a specific downstream failure | `AgentTaskLog.errorCode` + `errorMessage` exist |
| Correlate across services | `AgentTaskLog.correlationId` exists (required, non-null) |

---

## Enum changes

### `AgentRunStatus` — add two members

Must be applied to **both** declarations in the same task (see [research.md R2](./research.md)):
- `packages/shared/src/enums/ai-agent-run-status.enum.ts`
- `enum AgentRunStatus` in `apps/ai-agentic/prisma/schema.prisma` → requires a migration

```
PENDING_CONFIRMATION   // a proposal is awaiting the user's explicit tap
UNVERIFIED             // written, apparently accepted, but read-back did not confirm
```

Existing `FAILED` is reused. `DEGRADED` is **not** reused for unverified — it already means "graceful 403, proceeded with reduced context", a categorically different condition.

### `AgentActionKind` — new enum

```prisma
enum AgentActionKind {
  LEAVE_BOOKING

  @@schema("ai_agent")
}
```

One member today. Its existence — rather than a hardcoded string — is what makes the framework specialist-agnostic per FR-011.

### `ActionProposalStatus` — new enum

```prisma
enum ActionProposalStatus {
  PENDING     // minted, awaiting confirm or cancel
  CONSUMED    // claimed by exactly one execute or cancel
  EXPIRED     // swept past expiresAt without a decision

  @@schema("ai_agent")
}
```

---

## New model: `AgentActionProposal`

The frozen payload plus the single-use token. A row, not a JSON blob on the conversation — see [research.md R3](./research.md) for why the blob cannot enforce single-use.

```prisma
model AgentActionProposal {
  id             String               @id @default(uuid())
  conversationId String               @map("conversation_id")
  messageId      String               @unique @map("message_id")
  token          String               @unique
  actionKind     AgentActionKind      @map("action_kind")
  status         ActionProposalStatus @default(PENDING)

  /// WHY: scoping the token to the minting user and employee is what makes
  /// cross-user replay impossible (FR-004). Re-checked at confirm time.
  actorUserId     String  @map("actor_user_id")
  actorEmployeeId String  @map("actor_employee_id")

  /// The exact computed payload, frozen at propose time. Execute sends THIS,
  /// never a payload re-derived from the confirm message (FR-001).
  payload Json

  /// Citations shown on the card before the user confirmed (FR-047).
  policyCitations Json?  @map("policy_citations")

  /// Set by Execute. Null until a downstream write is attempted.
  executedAt        DateTime? @map("executed_at")
  resultRecordId    String?   @map("result_record_id")
  resultStatusCode  Int?      @map("result_status_code")
  resultErrorCode   String?   @map("result_error_code")

  /// Set by Verify. Null when Execute failed or verification has not run.
  verifiedAt        DateTime? @map("verified_at")
  verificationState String?   @map("verification_state")  // MATCHED | MISMATCHED | UNAVAILABLE

  proposalLogId  String?  @map("proposal_log_id")
  expiresAt      DateTime @map("expires_at")
  consumedAt     DateTime? @map("consumed_at")
  createdAt      DateTime @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  message      Message      @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([status, expiresAt])
  @@index([conversationId, createdAt])
  @@schema("ai_agent")
  @@map("agent_action_proposals")
}
```

**Design notes**

- `token @unique` and `messageId @unique` — one proposal per message, one message per proposal. The frontend renders the card by joining the proposal to the message it belongs to, which keeps the payload out of `Message.sourceSummary` (that field means "sources used in the answer", not "pending action").
- The `executed*` and `verified*` field groups are deliberately separate. `resultRecordId` present with `verificationState` null is the exact consumed-but-unverified window from R3, and it is queryable for operators.
- `@@index([status, expiresAt])` serves the expiry sweep.
- **Consume is a conditional `updateMany`**, never a read-then-write:
  ```
  updateMany({ where: { token, status: PENDING, expiresAt: { gt: now } },
               data:  { status: CONSUMED, consumedAt: now } })
  count === 1 → this caller owns the execution
  count === 0 → already consumed, expired, or unknown → refuse, no downstream call
  ```

**State transitions**

```
PENDING ──confirm (count===1)──> CONSUMED ──> Execute ──> Verify
   │                                              │
   │                                              └─ FAILED: resultErrorCode set,
   │                                                 stays CONSUMED (no retry on this token)
   ├──cancel───────────────────> CONSUMED (no downstream call, executedAt stays null)
   └──sweep past expiresAt─────> EXPIRED
```

A `CONSUMED` row is terminal. Retry after failure requires a **new** proposal — this is what prevents a duplicate write (FR-006).

---

## New model: `ScheduledFollowUp`

```prisma
model ScheduledFollowUp {
  id             String    @id @default(uuid())
  conversationId String    @map("conversation_id")
  actorUserId    String    @map("actor_user_id")
  employeeFirstName String @map("employee_first_name")
  followUpType   String    @map("follow_up_type")   // SICK_LEAVE_WELLNESS_CHECK
  followUpAt     DateTime  @map("follow_up_at")

  /// The booking this check-in is about. Re-read at fire time under a SYSTEM
  /// context to decide whether to send or suppress (FR-040) — the event bus is
  /// in-process only and cannot deliver leave.cancelled across services.
  leaveRequestId String?   @map("leave_request_id")

  /// Null = pending. Non-null = handled, whether sent or suppressed.
  resolvedAt     DateTime? @map("resolved_at")
  resolution     String?   // SENT | SUPPRESSED_CANCELLED | SUPPRESSED_STALE | SUPPRESSED_CONVERSATION_GONE
  createdAt      DateTime  @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([followUpAt, resolvedAt])
  @@schema("ai_agent")
  @@map("scheduled_follow_ups")
}
```

**Design notes**

- `resolvedAt` + `resolution` rather than a bare `executedAt`: a suppressed follow-up is *handled*, not pending, and operators need to know **why** it never sent. FR-034 defines three distinct suppression causes and they must be distinguishable after the fact.
- `@@index([followUpAt, resolvedAt])` is the cron's only query: due and unresolved.
- `onDelete: Cascade` on the conversation satisfies FR-034's "conversation deleted" case structurally — a deleted conversation takes its pending follow-ups with it.
- `employeeFirstName` is denormalized at schedule time so the cron composes a warm greeting without an HR Core read purely for a name.

---

## `Conversation` — new back-relations only

```prisma
  actionProposals   AgentActionProposal[]
  scheduledFollowUps ScheduledFollowUp[]
```

## `Message` — new back-relation only

```prisma
  actionProposal AgentActionProposal?
```

No column changes on either model.

---

## Validation rules (from spec requirements)

| Rule | Source | Enforced |
|---|---|---|
| Token single-use | FR-004, FR-006 | `updateMany` count check + `@unique` |
| Token time-bound | FR-004, FR-021 | `expiresAt` + condition in the consume `where` |
| Token scoped to user and conversation | FR-004 | `actorUserId` / `conversationId` compared at confirm |
| Payload frozen at propose time | FR-001 | `payload Json` is written once, read at Execute, never rewritten |
| No success without verification | FR-009 | `SUCCESS` requires `verificationState = MATCHED`; otherwise `UNVERIFIED` |
| Follow-up fires at most once | FR-034 | `resolvedAt` set on both send and suppress |
| No follow-up on unverified booking | FR-035 | scheduling happens only on the `MATCHED` branch |
| Policy citations visible pre-confirm | FR-047 | `policyCitations` persisted on the proposal, served with the message |

---

## Migration ordering

1. Add `PENDING_CONFIRMATION` and `UNVERIFIED` to the Prisma `AgentRunStatus` enum
2. Create `AgentActionKind` and `ActionProposalStatus` enums
3. Create `agent_action_proposals` and `scheduled_follow_ups` tables with their indexes
4. Regenerate the client (`prisma generate` is already wired into this app's build scripts)

Additive only — no column drops, no data backfill, no unique-constraint replacement. The `DROP INDEX` vs `DROP CONSTRAINT` hazard in `.claude/rules/code-style.md` §3 does not apply here.

**Naming**: `20260730000000_add_agent_action_proposal_and_scheduled_follow_up`.
