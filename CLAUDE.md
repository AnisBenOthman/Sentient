# Sentient Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-07-30

## Persona

Senior Full-Stack Engineer. Write complete, production-quality code. No placeholders, no stubs with TODOs. If a task is assigned, implement it fully — Prisma schema, NestJS module, DTOs, guards, controller, service, barrel exports, all of it.

## Active Technologies
- TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/config (003-employee-module)
- PostgreSQL 16, schema `hr_core` (003-employee-module)
- TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/schedule (for monthly accrual cron), @nestjs/config (005-leave-module)
- TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` on) + NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, existing `@sentient/shared` (`IEventBus`, `DomainEvent`, `JwtPayload`, `PermissionScope`). Frontend: React 18 + Vite 7, TanStack Query v5, wouter, Tailwind CSS v4, shadcn/ui. (010-notifications)
- PostgreSQL 16, schema `hr_core`, one new table `notifications` plus three new enums (`notification_category`, `notification_event_type`, `notification_status`). (010-notifications)
- TypeScript 5.x strict — repo-wide `tsconfig.base.json` enforces `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames`. Social inherits. + NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, @nestjs/throttler, axios 1.x, `@sentient/shared` workspace package (`SharedJwtGuard`, `RbacGuard`, `EVENT_BUS`, `IEventBus`, `DomainEvent`, `JwtPayload`, `Public`/`Roles`/`CurrentUser` decorators, enums barrel). (012-social-scaffold)
- PostgreSQL 16, schema `social`. Eight new tables (`announcements`, `events`, `event_attendees`, `documents`, `feedback`, `engagement_snapshots`, `exit_surveys`, `exit_survey_responses`), eight new Postgres enums, ten new indexes. The `social` schema and `social_svc` role already exist from feature 002 (`scripts/init-schemas.sql`); this feature only adds tables, never schema-level DDL. (012-social-scaffold)
- TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames` via repo-wide `tsconfig.base.json`) + NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, `@sentient/shared` (SharedJwtGuard, RbacGuard, Roles, CurrentUser, Public, IEventBus, EVENT_BUS, DomainEvent, Audience enum, JwtPayload) (013-announcements-module)
- PostgreSQL 16, schema `social` — one existing table `announcements` (3 new columns + 2 indexes added by migration) (013-announcements-module)
- TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames` via repo-wide `tsconfig.base.json`) + NestJS 10, `@nestjs/platform-express` (already installed — exposes `FileInterceptor` and the built-in multer engine), Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, `@sentient/shared` (SharedJwtGuard, RbacGuard, Roles, CurrentUser, Public, IEventBus, EVENT_BUS, DomainEvent, DocumentCategory enum, JwtPayload). One new transitive dependency surfaced: `@types/multer` (dev) to type the `Express.Multer.File` shape. (014-documents-module)
- PostgreSQL 16, schema `social` — existing `documents` table gains 1 new column (`isPublic`) and 1 supporting index. File bytes are stored on the local filesystem under `apps/social/storage/documents/{documentId}/v{version}/{sanitized-filename}` (path configurable via `DOCUMENT_STORAGE_PATH`). The storage layer is fronted by a `DocumentStorage` interface so an S3-compatible implementation can drop in later without controller/service changes. (014-documents-module)

- TypeScript 5.x — strict mode via `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames`) + NestJS 10, React 18 + Vite 7 (no SSR), Prisma 5 (multiSchema preview), @nestjs/config, @nestjs/swagger, class-validator, class-transformer, Turborepo 2.x
- PostgreSQL 16 + pgvector — Docker Compose (`pgvector/pgvector:pg16` image); 3 schemas (`hr_core`, `social`, `ai_agent`), 4 roles
- TypeScript 5.x strict mode + NestJS 10 API Gateway, Express-compatible Node `http`/`https` streaming proxy, `jsonwebtoken`, `@nestjs/config`, `@nestjs/swagger`, stateless in-memory rate limiting, central JWT validation, correlation IDs, standard error envelopes, health/docs aggregation (015-api-gateway)
- TypeScript 5.x strict mode + NestJS 10 AI Agentic scaffold, Prisma 5 multiSchema, PostgreSQL pgvector, LangGraph.js supervisor graph, Gemini intent classifier with rule-based fallback, `@sentient/shared` AgentContext, React 18 + Vite 7 AI Assistant chat page, TanStack Query v5 (016-ai-module)

## Project Structure

```text
apps/hr-core/      NestJS :3001  schema=hr_core
apps/social/       NestJS :3002  schema=social
apps/ai-agentic/   NestJS :3003  schema=ai_agent
apps/api-gateway/  NestJS :3004  public single-entry-point gateway (streaming proxy + JWT validation + rate limiting)
apps/web/          React + Vite :3000
packages/shared/   @sentient/shared — enums, interfaces, DTOs, event-bus, auth
scripts/init-schemas.sql
docker-compose.yml
docs/diagrams/     All .drawio class/domain/use-case diagrams (flat — reference when mentioning diagrams to Claude)
docs/benchmarks/   Competitor screenshots + benchmark-report.md
docs/notes/        Working notes and command references
reference/front-replit/   UI prototype — reference for "do it like front-replit" prompts
specs/             Per-feature task lists (tasks.md) — read at session start
```

## Commands

```bash
pnpm install
docker compose up -d
psql -U postgres -d sentient -f scripts/init-schemas.sql
turbo build
turbo dev
turbo test --filter=<service>
```

## Code Style

See `.claude/rules/code-style.md` for full conventions. Key rules:
- No `any`. Use `unknown` and narrow.
- Explicit return types on all public methods.
- `@Injectable()` constructor injection only.
- DTOs validate with class-validator. Services trust their inputs.
- Every endpoint: `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles(...)`. Except `/health`.

## Recent Changes
- 016-ai-module (COMPLETE — all 97 tasks done, T097 live smoke pending): Full AI Agentic supervisor pipeline landed. LangGraph.js `SupervisorLangGraphRunnerService` compiled graph with conditional routing, clarification node, specialist execution, human escalation, and final-answer nodes. 7 specialist agents (Leave, OKR, Career, Analytics, Onboarding, Language, General Help) + Human Escalation. Gemini intent classifier with rule-based fallback, `AI_AGENT_INTENT_PROVIDER` env toggle. `AgentGuardrailService` with word-boundary Sentient-scope matching, UNAUTHORIZED_DATA / UNSAFE_SYSTEM_ACTION / interpersonal-judgment guardrails, split across a **three-phase supervisor gate: security guardrail → intent classifier → RBAC/scope guardrail** (see below). `FinalAnswerPolicyService` honest status taxonomy (REFUSED/PARTIAL/DEGRADED). Conversation management (list/detail/archive/delete/resume). Feedback + Governance endpoints. `HrCoreAiClient` / `SocialAiClient` with scope-filtered downstream context. `HolidayQueryDto` with `@Type(() => Number)` coercion. `AI_AGENT_SCOPE_OVERRIDE_THRESHOLD` (0.7) lets Gemini confident classifications override benign OUT_OF_SCOPE without bypassing hard refusals. Scope-gate SENTIENT_TERMS expanded to cover everyday HR vocabulary. Full AI Assistant chat page in `apps/web`. 27 test suites / 137 tests green.
- 015-api-gateway (COMPLETE): NestJS API Gateway in `apps/api-gateway` (:3004). Streaming proxy for HR/Social/AI upstreams. Central JWT validation + public allow-list. Correlation IDs. In-memory edge rate limiting (`@nestjs/throttler`) with public-IP and override-route tiers. Standard error envelopes. Health/docs aggregation. `API_GATEWAY_AI_UPSTREAM_TIMEOUT_MS` separate AI timeout. Frontend migrated to single `/api` gateway origin. Full test suite green.
- 014-documents-module: Documents module in Social — `DocumentStorage` interface + `FilesystemDocumentStorage`, path-traversal guard, `mime-to-extension` + `sanitizeFilename` helpers, 6 endpoints (upload/download/list/detail/update/delete), multer file-size filter, `document.uploaded`/`document.deleted` events, `DocumentCategory` enum corrected, frontend documents page with role-gated upload/edit/delete.
- 013-announcements-module: Announcements module in Social — audience-filter logic, expiry filtering, author enrichment, 6 endpoints, HrCoreClient with TTL-cache for dept/team refs, 25-test unit suite, frontend announcements page.
- 012-social-scaffold: Social scaffold — 8-entity Prisma schema, 8 Postgres enums, 10 indexes, SharedJwtGuard+RbacGuard global guards, HrCoreClient with 60s employee-ref cache, InMemoryEventBus, 4 new shared enums (Audience/RsvpStatus/SentimentLabel/FeedbackType).


<!-- MANUAL ADDITIONS START -->
## AI Supervisor Three-Phase Gate

> Every conversation turn in `SupervisorLangGraphRunnerService.supervisorNode` passes through
> three phases in this fixed order. Do not collapse them back into one pass.

```
User message
    ↓
PHASE 1 — Security guardrail    AgentGuardrailService.evaluateSecurity(message)
    ↓                            IMMEDIATE_SAFETY_PATTERNS, UNSAFE_SYSTEM_ACTION_PATTERNS
    ↓                            Refused here → return BEFORE the classifier. No LLM call.
PHASE 2 — Intent classifier     IntentClassifier.classify(message, context)   ← the only LLM call
    ↓                            Groq / Gemini / OpenRouter, rules fallback
PHASE 3 — RBAC/scope guardrail  AgentGuardrailService.evaluateScope(message, actor)
    ↓                            UNAUTHORIZED_DATA (role-aware), THIRD_PARTY_LEAVE (role-aware),
    ↓                            UNSAFE_ADVICE, interpersonal/conflict, greeting, OUT_OF_SCOPE
Route → specialist / clarification / escalation / final answer
```

**Which phase does a new pattern belong to?** Phase 1 if and only if it is decidable from the
message alone — no `actor.roles`, no classified intent — **and** it is either an attack on the
system (injection, destructive SQL, secret exfiltration, shell execution) or an immediate
human-welfare risk where a one-LLM-call delay is unacceptable (`IMMEDIATE_SAFETY_PATTERNS`).
Everything that depends on who is asking is Phase 3 by definition.

**Rules:**
- Phase 1 must never call the LLM. Its whole purpose is that attacker-controlled text is refused
  deterministically without being forwarded to a model provider or billed for.
- **Known limitation:** this holds for the turn the payload arrives on. `ConversationContextService.build()`
  selects `recentMessages` by `conversationId` with no status filter, so a refused message is still
  replayed into the classifier prompt as history on subsequent turns of the same conversation.
  Closing this means excluding `REFUSED`/`ESCALATED` turns from the recent-message window.
- A Phase-1 short-circuit must supply `securityBlockedClassification()` — the escalation and
  final-answer nodes call `requireClassification()` unconditionally and will throw on null.
- Only the benign `OUT_OF_SCOPE` verdict is overridable by a confident classification
  (`source !== 'rules'` and confidence ≥ `AI_AGENT_SCOPE_OVERRIDE_THRESHOLD`). Hard refusals —
  `UNAUTHORIZED_DATA`, `UNSAFE_ADVICE`, `UNSAFE_SYSTEM_ACTION`, conflict escalations — are never
  bypassed, and Phase-1 refusals never reach the override at all.
- `AgentGuardrailService.evaluate()` is the single-pass composition kept for the unit suite.
  The supervisor does not use it.

## Notification Routing Convention
- HR Core notifications are created only from `DomainEvent` subscribers in `apps/hr-core/src/modules/notifications/events/notifications-events.bridge.ts`.
- Add a new notification producer by emitting after the domain transaction commits, adding one routing rule in `events/routing-rules/<domain>.rules.ts`, and registering the event type in the bridge. Do not call `NotificationsService` directly from domain services.
- `Notification` is implemented as the 24th HR Core entity for feature 010; the table uses polymorphic `referenceType`/`referenceId` links and owner-scoped inbox queries.

## Leave Booking Confirmation Protocol (PENDING IMPLEMENTATION)

> Governs how the AI Leave Agent handles any action that mutates HR Core state
> (leave requests, cancellations). These rules are non-negotiable — HR data integrity
> and employee trust depend on them.

### Core Rule: Model Proposes, Human Confirms, Code Executes

The Leave Agent **never** silently POSTs a leave request. Every booking flow has exactly
three phases: **propose → confirm → execute**. There is no shortcut.

```
User: "Book me 3 days off July 14-16"
  ↓
Leave Agent:
  1. Fetches leave type + current balance from HR Core (read-only)
  2. Computes business days + balance after
  3. Returns PENDING_CONFIRMATION (NOT a leave request POST)
  ↓
Frontend renders LeaveConfirmationCard:
  ┌─────────────────────────────────────────────┐
  │  📅 Leave Booking Request                   │
  │  Annual Leave · 3 days · 14–16 July 2025    │
  │  Balance after: 9 days remaining            │
  │                                             │
  │  [Cancel]                    [Confirm ✓]    │
  └─────────────────────────────────────────────┘
  ↓
User taps Confirm
  ↓
Leave Agent executes POST /leave-requests (with pre-computed payload from Phase 1)
  ↓
Only on verified 201 response → show "Leave request submitted. Pending manager approval."
On any non-201 → show explicit failure card (never silently swallow)
```

### Specialist Result Extension

`LeaveAgentService` must return a new status when a booking is proposed:

```typescript
// apps/ai-agentic/src/common/graph/agent-graph.types.ts
// New status alongside SUCCESS / REFUSED / PARTIAL / DEGRADED
type SpecialistStatus = 'SUCCESS' | 'REFUSED' | 'PARTIAL' | 'DEGRADED' | 'PENDING_CONFIRMATION' | 'FAILED';

interface LeaveConfirmationPayload {
  leaveTypeId: string;
  leaveTypeName: string;         // "Annual Leave"
  startDate: string;             // ISO "2025-07-14"
  endDate: string;               // ISO "2025-07-16"
  businessDays: number;          // 3
  currentBalance: number;        // 12
  balanceAfter: number;          // 9
  employeeId: string;
  confirmationToken: string;     // UUID minted by agent, stored in conversation context
                                 // Prevents replay: a token can only be used once
}

interface SpecialistResult {
  // ... existing fields ...
  status: SpecialistStatus;
  confirmationPayload?: LeaveConfirmationPayload; // present only when status = PENDING_CONFIRMATION
}
```

### Two-Phase Leave Agent Flow

**Phase 1 — Proposal** (triggered by booking intent, NO confirmation token in message):
1. Detect booking intent: "book", "request", "take", "apply for", "schedule" + date range
2. Call `HrCoreAiClient.getLeaveTypes()` to resolve leave type from user phrasing
3. Call `HrCoreAiClient.getLeaveBalance()` to get current balance
4. Compute business days (skip weekends, skip public holidays from `getHolidaysContext()`)
5. Validate: balance sufficient, no overlap (call `getLeaveRequests` to check)
6. Mint a `confirmationToken` (UUID), persist the full `LeaveConfirmationPayload` in the
   conversation's `agentContext` metadata (keyed by `confirmationToken`)
7. Return `status: PENDING_CONFIRMATION` — no POST to HR Core

**Phase 2 — Execution** (triggered by `confirmed: true` + matching `confirmationToken` in message):
1. Look up the `LeaveConfirmationPayload` from conversation context by `confirmationToken`
2. Mark the token as consumed (prevent replay)
3. POST `createLeaveRequest` to HR Core with the pre-computed payload
4. On HTTP 201: return `status: SUCCESS` with the created leave request ID
5. On any non-201 (4xx / 5xx / timeout): return `status: FAILED` with an explicit message
   — never return SUCCESS unless the API confirmed it
6. Log both phases to `AgentTaskLog` (proposal log + execution log, linked by `parentLogId`)

### Silent Failure Prevention Rules

- **Never swallow HTTP errors**: catch every axios error from `HrCoreAiClient.createLeaveRequest`,
  log the HTTP status + body to `AgentTaskLog`, and surface a human-readable failure card.
- **Timeout = failure**: if HR Core does not respond within `requestTimeoutMs`, treat as FAILED —
  not as success, not as unknown.
- **No optimistic UI**: the frontend must wait for the full API round-trip before rendering
  any success state. No "probably worked" messaging.
- **Idempotency guard**: the `confirmationToken` is single-use. If the user taps Confirm twice
  (double-click, retry), the second execution finds a consumed token and returns
  "This booking was already submitted" without a second POST.
- **Failure card content**: on FAILED, the frontend renders a structured error card, not a toast:
  ```
  ┌─────────────────────────────────────────────┐
  │  ⚠ Booking failed                           │
  │  The leave request could not be submitted.  │
  │  HR Core returned: [specific reason]        │
  │  Please try again or contact HR directly.   │
  └─────────────────────────────────────────────┘
  ```

### Frontend Contract

- `Message.confirmationPayload` (from `ConversationResponseMapper`) is the signal to render
  `<LeaveConfirmationCard>` instead of a plain text bubble.
- "Confirm" sends: `POST /conversations/:id/messages` with body
  `{ content: "confirm", metadata: { confirmed: true, confirmationToken: "<token>" } }`
- "Cancel" sends: `POST /conversations/:id/messages` with body
  `{ content: "cancel", metadata: { confirmed: false, confirmationToken: "<token>" } }`
  — agent marks token consumed and responds "Booking cancelled. No request was submitted."
- The Confirm button is disabled after first click (prevent double-submit); re-enabled only on
  FAILED response so the user can retry.

### AgentTaskLog Entries for a Complete Booking

| Phase | `taskType` | `status` | Notes |
|-------|-----------|---------|-------|
| Proposal | `leave.booking_proposed` | SUCCESS | Payload without POST |
| Execution | `leave.booking_executed` | SUCCESS / FAILED | HTTP status + leaveRequestId |
| HR Core call | `leave.create_request` | SUCCESS / FAILED | child log, `parentLogId` = execution log |

### Files to Create / Modify

- `apps/ai-agentic/src/modules/agents/specialists/leave-agent.service.ts` — add booking intent detection, two-phase flow, token minting/validation
- `apps/ai-agentic/src/common/clients/hr-core-ai.client.ts` — add `createLeaveRequest(payload, context)` method (already has read methods)
- `apps/ai-agentic/src/common/graph/agent-graph.types.ts` — add `PENDING_CONFIRMATION` / `FAILED` to `SpecialistStatus`, add `LeaveConfirmationPayload` interface, add `confirmationToken` to `SpecialistResult`
- `apps/ai-agentic/src/modules/conversations/conversation-response.mapper.ts` — serialize `confirmationPayload` into `Message` response
- `apps/ai-agentic/src/modules/conversations/conversations.service.ts` — persist/retrieve `confirmationPayload` in conversation context by token; enforce single-use
- `apps/web/src/components/ai/leave-confirmation-card.tsx` — new component: booking summary card with Confirm/Cancel, disabled-after-click button, failure card variant
- `apps/web/src/pages/ai-assistant.tsx` — detect `message.confirmationPayload`, render `<LeaveConfirmationCard>`, wire confirm/cancel handlers
- `apps/web/src/lib/api/ai.ts` — add `confirmationToken` to `CreateMessageDto`

## Proactive & Emotionally-Aware Leave Agent Flows (PENDING IMPLEMENTATION)

> Governs how the Leave Agent handles life-event intents (parental leave, sickness)
> with the right emotional tone, multi-turn clarification, RAG policy retrieval,
> and proactive follow-up. These are trust-building features — tone and reliability
> are as important as the data.

---

### Flow 1 — Parental Leave Planning

**Trigger phrases**: "expecting a baby", "pregnant", "parental leave", "maternity leave",
"paternity leave", "adoption leave", "planning baby leave", "starting a family".

**Tone**: Celebratory + supportive. Never clinical. The first sentence acknowledges the
life event before any data.

```
User:  "I'm expecting a baby in June and I'd like to start planning my parental leave."
Agent: "Congratulations! I'd be happy to help you plan your parental leave.
        Are you the primary or secondary caregiver?"

User:  "Primary."
Agent: "As a primary caregiver, you're entitled to 16 weeks of paid parental leave.
        Here's what the policy says: [RAG content from parental leave policy doc]

        Suggested timeline:
        - Start date: on or before June 1
        - End date: ~September 20 (16 weeks)
        - Balance remaining after: [calculated from balance]
        - Documents needed: [from RAG policy]

        Would you like me to prepare the booking for those dates, or would you
        prefer to choose different dates?"
```

**Core design principle — the agent has zero hardcoded leave rules**:

The agent never knows in advance what questions to ask or what the entitlement is.
Those come entirely from the policy document. The flow is always:
**RAG first → LLM reads policy → determines what to ask → asks → user answers → LLM applies policy to that answer.**

"Primary or secondary caregiver" was an example. The actual questions depend on what the
company's parental leave policy says. A different company might ask "birth parent or adoptive
parent?", "salaried or hourly?", "first child or subsequent?". The agent must not assume.

**Implementation steps inside `LeaveAgentService`**:

1. **Intent detection** — add `requestsLifeEventLeave(input)` that matches trigger phrases
2. **RAG retrieval first** — immediately call `knowledgeRepository.searchApproved("parental leave policy")`;
   this is always step 1, before asking anything. If RAG returns nothing (no policy document uploaded),
   the agent says "I don't have your company's parental leave policy on file yet. Please contact HR
   directly or ask your HR admin to upload the policy to the Documents section."
3. **LLM policy interpretation** — pass the RAG chunks + the user's situation to a Gemini call
   (reusing the existing `GeminiIntentClassifierAdapter` infrastructure or a new `PolicyInterpreterService`):
   - Prompt: "Based on this leave policy, what clarifying information do you need from this employee
     to determine their entitlement? Return: { questions: string[], canAnswerDirectly: boolean }"
   - If `canAnswerDirectly: true` (policy needs no further info) → skip to step 5
   - If questions returned → go to step 4
4. **Ask the LLM-generated question(s)** — return `status: 'NEEDS_CLARIFICATION'` with the first
   question from the LLM response. The answer arrives in `conversationContext.recentMessages` next turn.
   Repeat until all questions answered or policy is sufficient to compute entitlement.
5. **LLM entitlement answer** — pass policy text + all collected answers to Gemini:
   "Based on this policy and these answers, what is this employee entitled to? Return a human-readable
   summary with: entitlement duration, pay rate, notice requirements, documents needed, suggested dates."
6. **Transition to booking flow** — present LLM-generated entitlement summary as `sourceContext`
   (cite the policy document), then ask if they want to proceed;
   if yes, enter the existing `PENDING_CONFIRMATION` booking protocol

**RAG source context** — use `KnowledgeRepository.searchApproved()` which already exists.
The parental leave policy document must be uploaded via Social Documents (category INTERNAL_POLICY)
and approved so it appears in `VectorDocument` with an active `KnowledgeItem`.

**What the LLM call looks like** (new `PolicyInterpreterService` or inline in `LeaveAgentService`):
```typescript
// Input to Gemini
{
  systemPrompt: "You are an HR policy assistant. Answer only from the provided policy text. Never invent rules.",
  policyChunks: ragResults.map(r => r.document.content),
  employeeSituation: input.userMessage,
  priorAnswers: conversationContext.recentMessages
                  .filter(m => m.role === 'user')
                  .map(m => m.content),
}
// Output expected
{
  needsClarification: boolean,
  nextQuestion: string | null,          // ask this if needsClarification = true
  entitlementSummary: string | null,    // return this when all info is collected
  policySourceLabel: string,            // e.g. "Parental Leave Policy v2"
}
```

**`AgentTaskLog` entries**:

| Phase | `taskType` | Notes |
|-------|-----------|-------|
| Clarification prompt | `leave.parental_clarification` | caregiver type not yet known |
| Policy retrieval | `leave.parental_policy_rag` | RAG search result count |
| Plan presented | `leave.parental_plan_proposed` | entitlement + suggested dates |
| Booking confirmation | `leave.booking_proposed` | reuses existing booking protocol |

---

### Flow 2 — Sick Leave: Compassionate Booking + Proactive Follow-up

**Trigger phrases**: "I'm sick", "I'm not feeling well", "I feel ill", "I have a fever",
"I'm coming down with something", "I'm unwell", "I need a sick day", "I'm too ill to work".

**Tone**: Compassionate, low-friction. Don't ask for a detailed reason. One sentence of
empathy before anything else.

```
User:  "I'm not feeling well today."
Agent: "I'm sorry to hear that — I hope you feel better soon.
        I can book a sick day for you right now.

        ┌──────────────────────────────────────────────────┐
        │  🤒 Sick Leave Booking                           │
        │  Sick Leave · 1 day · Today (14 June 2025)       │
        │  Balance after: 8 days remaining                 │
        │                                                  │
        │  [Cancel]                        [Confirm ✓]     │
        └──────────────────────────────────────────────────┘"

[ User taps Confirm ]

Agent: "Done — your sick leave has been submitted for today.
        I'll check in with you in 2 days to see how you're feeling.
        Please rest and take care of yourself."

[ 2 days later — proactive follow-up message appears in chat ]

Agent: "Hi [firstName], I hope you're feeling better!
        It's been a couple of days since your sick leave.
        Are you ready to return to work, or would you like to
        extend your leave?"

User:  "Still not well — need one more day."
Agent: "Of course. Let me book an extra day for you."
        [ enters booking confirmation flow for +1 day ]
```

**Key rules for sick leave flow**:
- Ask zero diagnostic questions (what are your symptoms, do you have a doctor's note)
  — that is HR's job during approval, not the agent's
- Default to 1 day (today) unless the user specifies a range
- After confirmation: immediately schedule a follow-up task for 2 days from now

---

### Proactive Follow-up Scheduler

**Purpose**: After sick leave is confirmed, the agent schedules a wellness check-in so
the system reaches back to the employee — not the other way around.

**Architecture**:

```
Leave booking confirmed (phase 2 SUCCESS)
  ↓
LeaveAgentService calls FollowUpSchedulerService.schedule({
  conversationId,
  userId,
  employeeFirstName,
  followUpAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  followUpType: 'SICK_LEAVE_WELLNESS_CHECK',
  leaveRequestId,
})
  ↓
FollowUpSchedulerService persists a ScheduledFollowUp row in Prisma
  ↓
@Cron('0 * * * *') [hourly] scans for due ScheduledFollowUp rows
  ↓
For each due row → ProactiveMessageService.sendToConversation({
  conversationId,
  content: "Hi [firstName], I hope you're feeling better! ...",
  taskType: 'leave.sick_wellness_followup',
})
  ↓
Assistant message appears in the existing conversation
  ↓
User responds → normal supervisor turn handles it
  (Leave Agent detects "still sick" → enters booking flow for extension)
```

**Prisma model** (add to `apps/ai-agentic/prisma/schema.prisma`, schema `ai_agent`):

```prisma
model ScheduledFollowUp {
  id               String    @id @default(uuid())
  conversationId   String
  userId           String
  employeeFirstName String
  followUpType     String    // 'SICK_LEAVE_WELLNESS_CHECK'
  followUpAt       DateTime
  executedAt       DateTime? // null = pending, non-null = done
  leaveRequestId   String?   // reference for context
  createdAt        DateTime  @default(now())

  @@index([followUpAt, executedAt])
  @@schema("ai_agent")
  @@map("scheduled_follow_ups")
}
```

**New files to create**:
- `apps/ai-agentic/src/modules/agents/follow-up-scheduler.service.ts`
  — `schedule(input)`, `findDue()`, `markExecuted(id)`
- `apps/ai-agentic/src/modules/agents/proactive-message.service.ts`
  — `sendToConversation(conversationId, content, taskType)`:
  creates an `assistant` role `Message` row directly via Prisma, logs to `AgentTaskLog`
- `apps/ai-agentic/src/modules/agents/follow-up-runner.service.ts`
  — `@Cron('0 * * * *')` hourly cron; calls `findDue()` + `sendToConversation()` + `markExecuted()`

**Files to modify**:
- `apps/ai-agentic/src/modules/agents/specialists/leave-agent.service.ts`
  — add `requestsSickLeave()`, compassionate intro, single-day default, call `FollowUpSchedulerService.schedule()` after booking execution
  — add `requestsParentalLeavePlanning()`, caregiver clarification, RAG retrieval
- `apps/ai-agentic/src/modules/agents/agents.module.ts`
  — register `FollowUpSchedulerService`, `ProactiveMessageService`, `FollowUpRunnerService`
- `apps/ai-agentic/src/app.module.ts`
  — import `@nestjs/schedule` (`ScheduleModule.forRoot()`) if not already registered
- `apps/ai-agentic/prisma/schema.prisma`
  — add `ScheduledFollowUp` model

**Emotional tone system** — `SpecialistInput` gains an optional field:
```typescript
emotionalContext?: 'NEUTRAL' | 'COMPASSIONATE_SICK' | 'CELEBRATORY_PARENTAL' | 'EMPATHETIC_BEREAVEMENT';
```
Set by the supervisor classifier when it detects a life event. `FinalAnswerNodeService` reads it
and applies the appropriate opening line to the final answer before returning it to the user.

**Supervisor classifier additions** — `SupervisorIntentClassifierService` must detect:
- Parental/maternity/paternity phrases → `emotionalContext: 'CELEBRATORY_PARENTAL'`
- Sick/unwell/fever phrases → `emotionalContext: 'COMPASSIONATE_SICK'`
  and route directly to LEAVE_AGENT without requiring explicit "book leave" phrasing

**Guardrail additions** — ensure these life-event phrases are never classified as OUT_OF_SCOPE
by the scope gate. Add them to `SENTIENT_TERMS` in `AgentGuardrailService`:
`'sick', 'unwell', 'ill', 'fever', 'maternity', 'paternity', 'parental', 'baby', 'expecting', 'pregnancy'`

---

### Summary of All Files

| File | Action |
|------|--------|
| `apps/ai-agentic/prisma/schema.prisma` | Add `ScheduledFollowUp` model |
| `apps/ai-agentic/src/common/graph/agent-graph.types.ts` | Add `emotionalContext` to `SpecialistInput` + `'NEEDS_CLARIFICATION'` status |
| `apps/ai-agentic/src/common/safety/agent-guardrail.service.ts` | Add life-event terms to SENTIENT_TERMS |
| `apps/ai-agentic/src/modules/agents/supervisor-intent-classifier.service.ts` | Detect life-event intents, set `emotionalContext` |
| `apps/ai-agentic/src/modules/agents/nodes/final-answer-node.service.ts` | Apply emotional tone opener from `emotionalContext` |
| `apps/ai-agentic/src/modules/agents/specialists/leave-agent.service.ts` | Add sick + parental flows, RAG call, call scheduler after sick booking |
| `apps/ai-agentic/src/modules/agents/follow-up-scheduler.service.ts` | NEW — schedule/findDue/markExecuted |
| `apps/ai-agentic/src/modules/agents/proactive-message.service.ts` | NEW — insert assistant message into conversation |
| `apps/ai-agentic/src/modules/agents/follow-up-runner.service.ts` | NEW — @Cron hourly runner |
| `apps/ai-agentic/src/modules/agents/agents.module.ts` | Register 3 new services |
| `apps/ai-agentic/src/app.module.ts` | Ensure `ScheduleModule.forRoot()` imported |
| `apps/ai-agentic/src/modules/knowledge/knowledge.repository.ts` | Already has `searchApproved()` — no changes needed |
| `apps/web/src/components/ai/leave-confirmation-card.tsx` | Add sick-leave compassionate variant (🤒 icon, "I hope you feel better" text) |
<!-- MANUAL ADDITIONS END -->
