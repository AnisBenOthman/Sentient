# Tasks: AI Module

**Input**: Design documents from `/specs/016-ai-module/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ai-module-api.yaml](./contracts/ai-module-api.yaml), [contracts/agent-state-machine.md](./contracts/agent-state-machine.md), [quickstart.md](./quickstart.md)

**Tests**: Included because the specification defines independent test criteria, safety test sets, routing success criteria, and quickstart verification flows.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after shared setup/foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other tasks in the same phase because it touches different files or has no dependency on incomplete tasks.
- **[Story]**: Maps to user stories from [spec.md](./spec.md): `[US1]` through `[US3]`.
- Every task includes exact repository-relative file paths.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared AI enums, AI Agentic configuration, and test scaffolding for the supervisor-agent module.

- [ ] T001 [P] Extend the shared agent roster with `SUPERVISOR_AGENT`, `OKR_AGENT`, `LANGUAGE_AGENT`, `GENERAL_HELP_AGENT`, and `HUMAN_ESCALATION_AGENT` in `packages/shared/src/enums/agent-type.enum.ts`
- [ ] T002 [P] Create shared AI enum files for conversation status, node type, run status, permission decision, feedback rating, and knowledge source type in `packages/shared/src/enums/ai-conversation-status.enum.ts`, `packages/shared/src/enums/ai-agent-node-type.enum.ts`, `packages/shared/src/enums/ai-agent-run-status.enum.ts`, `packages/shared/src/enums/ai-permission-decision.enum.ts`, `packages/shared/src/enums/ai-feedback-rating.enum.ts`, and `packages/shared/src/enums/ai-knowledge-source-type.enum.ts`
- [ ] T003 Export the new shared AI enum files from `packages/shared/src/enums/index.ts`
- [ ] T004 [P] Update AI Agentic Jest configuration for `src`, `test/contracts`, and `test/integration` coverage in `apps/ai-agentic/package.json`
- [ ] T005 [P] Add AI Agentic configuration parsing and defaults in `apps/ai-agentic/src/config/ai-agentic.config.ts` and `apps/ai-agentic/src/config/validation.ts`
- [ ] T006 [P] Create module barrel exports for conversations, agents, knowledge, feedback, and governance in `apps/ai-agentic/src/modules/conversations/index.ts`, `apps/ai-agentic/src/modules/agents/index.ts`, `apps/ai-agentic/src/modules/knowledge/index.ts`, `apps/ai-agentic/src/modules/feedback/index.ts`, and `apps/ai-agentic/src/modules/governance/index.ts`
- [ ] T007 [P] Create common barrel exports for clients, graph, safety, and DTOs in `apps/ai-agentic/src/common/clients/index.ts`, `apps/ai-agentic/src/common/graph/index.ts`, `apps/ai-agentic/src/common/safety/index.ts`, and `apps/ai-agentic/src/common/dto/index.ts`
- [ ] T008 Add or verify AI Agentic scaffold environment variables and timeout defaults in `.env.example`

**Checkpoint**: Shared AI symbols and AI Agentic scaffolding are ready for persistence and graph implementation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence, auth, graph contracts, safety policies, audit logging, downstream clients, and module wiring required before user-story implementation.

**CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T009 Define Prisma enums and models for conversations, messages, task logs, handoffs, node runs, clarification requests, escalations, feedback, knowledge items, vector documents, and permission decisions in `apps/ai-agentic/prisma/schema.prisma`
- [ ] T010 Create and apply the initial AI Agentic Prisma migration for the `ai_agent` schema in `apps/ai-agentic/prisma/migrations/`
- [ ] T011 Replace the current PrismaService stub with the generated Prisma client implementation in `apps/ai-agentic/src/prisma/prisma.service.ts`
- [ ] T012 [P] Define shared AI DTO helpers for pagination, source context, and routing trace responses in `apps/ai-agentic/src/common/dto/pagination.dto.ts`, `apps/ai-agentic/src/common/dto/source-context.dto.ts`, and `apps/ai-agentic/src/common/dto/routing-trace.dto.ts`
- [ ] T013 [P] Define typed graph state, specialist input, specialist result, and final answer contracts in `apps/ai-agentic/src/common/graph/agent-graph.types.ts`
- [ ] T014 [P] Define safety policy result and scope classification types in `apps/ai-agentic/src/common/safety/safety.types.ts`
- [ ] T015 Configure `SharedJwtGuard`, `RbacGuard`, `ThrottlerGuard`, and public health behavior in `apps/ai-agentic/src/app.module.ts` and `apps/ai-agentic/src/app.controller.ts`
- [ ] T016 Implement an actor context factory that extracts forwarded JWT, roles, user id, employee id, and correlation id in `apps/ai-agentic/src/common/graph/actor-context.factory.ts`
- [ ] T017 [P] Implement scoped HR Core REST client helpers for employee, leave, OKR, performance, skills, notifications, and dashboard context in `apps/ai-agentic/src/common/clients/hr-core-ai.client.ts`
- [ ] T018 [P] Implement scoped Social REST client helpers for approved documents, FAQs, events, onboarding, and policy knowledge context in `apps/ai-agentic/src/common/clients/social-ai.client.ts`
- [ ] T019 Implement the specialist agent registry and health roster in `apps/ai-agentic/src/modules/agents/agent-registry.service.ts`
- [ ] T020 Implement deterministic supervisor intent and domain classification rules in `apps/ai-agentic/src/modules/agents/supervisor-intent-classifier.service.ts`
- [ ] T021 Implement Sentient-only scope, unauthorized-data, unsafe-advice, and interpersonal-judgment guardrails in `apps/ai-agentic/src/common/safety/agent-guardrail.service.ts`
- [ ] T022 Implement final response tone, scope, privacy, source-context, and draft-label checks in `apps/ai-agentic/src/common/safety/final-answer-policy.service.ts`
- [ ] T023 Implement parent-child agent task audit logging in `apps/ai-agentic/src/modules/agents/agent-task-log.service.ts`
- [ ] T024 Implement permission decision recording and downstream 403/404 degradation mapping in `apps/ai-agentic/src/modules/agents/permission-decision.service.ts`
- [ ] T025 Implement supervisor-to-specialist handoff persistence in `apps/ai-agentic/src/modules/agents/agent-handoff.service.ts`
- [ ] T026 Implement approved knowledge item and vector document repository methods in `apps/ai-agentic/src/modules/knowledge/knowledge.repository.ts`
- [ ] T027 Implement safe human escalation record creation with neutral summaries in `apps/ai-agentic/src/modules/agents/human-escalation-recorder.service.ts`
- [ ] T028 Implement AI health aggregation for supervisor, specialist roster, and context-source degradation in `apps/ai-agentic/src/modules/agents/ai-health.service.ts`
- [ ] T029 Wire foundational providers into `AgentsModule`, `KnowledgeModule`, and `AppModule` in `apps/ai-agentic/src/modules/agents/agents.module.ts`, `apps/ai-agentic/src/modules/knowledge/knowledge.module.ts`, and `apps/ai-agentic/src/app.module.ts`
- [ ] T030 [P] Add guardrail unit tests for out-of-scope, mixed-scope, unsafe-advice, and interpersonal-judgment prompts in `apps/ai-agentic/src/common/safety/agent-guardrail.service.spec.ts`
- [ ] T031 [P] Add classifier and registry unit tests for the full agent roster and multi-agent routing decisions in `apps/ai-agentic/src/modules/agents/supervisor-intent-classifier.service.spec.ts` and `apps/ai-agentic/src/modules/agents/agent-registry.service.spec.ts`
- [ ] T032 [P] Add Prisma schema generation regression coverage for generated client usage in `apps/ai-agentic/src/prisma/prisma.service.spec.ts`

**Checkpoint**: Foundation compiles, database client can be generated, auth/guardrails are testable, and user story work can proceed.

---

## Phase 3: User Story 1 - Ask the Supervisor Agent (Priority: P1) MVP

**Goal**: Provide one authenticated AI entry point where the supervisor classifies user intent, routes to the right specialist agents, applies Sentient-only scope and permission guardrails, and returns one coherent answer.

**Independent Test**: Sign in as employee, manager, and HR admin; ask single-domain, multi-domain, out-of-scope, ambiguous, and interpersonal-judgment prompts; verify routing, specialist return-to-supervisor behavior, final-answer scope, and persisted task logs.

### Tests for User Story 1

- [ ] T033 [P] [US1] Add API contract tests for `POST /conversations`, `POST /conversations/{conversationId}/messages`, and `GET /health` in `apps/ai-agentic/test/contracts/conversations.contract-spec.ts`
- [ ] T034 [P] [US1] Add state-machine fixture tests for leave, multi-domain manager, clarification, out-of-scope, handbook, dashboard, and escalation paths in `apps/ai-agentic/test/integration/agent-state-machine.integration-spec.ts`
- [ ] T035 [P] [US1] Add supervisor intake safety tests for Sentient-only scope and unauthorized sensitive-data prompts in `apps/ai-agentic/src/modules/agents/supervisor-agent.service.spec.ts`
- [ ] T036 [P] [US1] Add specialist return-control tests for OKR, Career, Analytics, Onboarding, Leave, Language, General Help, and Human Escalation agents in `apps/ai-agentic/src/modules/agents/specialists/specialist-return-control.spec.ts`

### Implementation for User Story 1

- [ ] T037 [US1] Create conversation turn DTOs for starting conversations and sending messages in `apps/ai-agentic/src/modules/conversations/dto/create-conversation.dto.ts` and `apps/ai-agentic/src/modules/conversations/dto/create-message.dto.ts`
- [ ] T038 [US1] Create conversation, message, source context, and routing response serializers in `apps/ai-agentic/src/modules/conversations/conversation-response.mapper.ts`
- [ ] T039 [US1] Implement conversation creation, user-message persistence, assistant-message persistence, and first-turn execution in `apps/ai-agentic/src/modules/conversations/conversations.service.ts`
- [ ] T040 [US1] Implement the supervisor graph orchestration loop in `apps/ai-agentic/src/modules/agents/supervisor-agent.service.ts`
- [ ] T041 [US1] Implement the Ask User for Clarification node in `apps/ai-agentic/src/modules/agents/nodes/clarification-node.service.ts`
- [ ] T042 [US1] Implement the Final Answer node in `apps/ai-agentic/src/modules/agents/nodes/final-answer-node.service.ts`
- [ ] T043 [P] [US1] Implement deterministic leave balance/history/policy scaffold behavior in `apps/ai-agentic/src/modules/agents/specialists/leave-agent.service.ts`
- [ ] T044 [P] [US1] Implement deterministic OKR explanation, focus, progress, and risk scaffold behavior in `apps/ai-agentic/src/modules/agents/specialists/okr-agent.service.ts`
- [ ] T045 [P] [US1] Implement deterministic career growth, skills, review context, and development scaffold behavior in `apps/ai-agentic/src/modules/agents/specialists/career-agent.service.ts`
- [ ] T046 [P] [US1] Implement deterministic manager/HR dashboard and workforce-stat explanation scaffold behavior in `apps/ai-agentic/src/modules/agents/specialists/analytics-agent.service.ts`
- [ ] T047 [P] [US1] Implement deterministic new-hire welcome and onboarding-progress scaffold behavior in `apps/ai-agentic/src/modules/agents/specialists/onboarding-agent.service.ts`
- [ ] T048 [P] [US1] Implement deterministic phrase review and professional rewording scaffold behavior in `apps/ai-agentic/src/modules/agents/specialists/language-agent.service.ts`
- [ ] T049 [P] [US1] Implement deterministic FAQ, handbook, and policy-grounded scaffold behavior in `apps/ai-agentic/src/modules/agents/specialists/general-help-agent.service.ts`
- [ ] T050 [US1] Implement the Human Escalation Agent node and manager/HRBP/People-team target selection in `apps/ai-agentic/src/modules/agents/specialists/human-escalation-agent.service.ts`
- [ ] T051 [US1] Persist node runs and safe routing traces for each conversation turn in `apps/ai-agentic/src/modules/agents/agent-node-run.service.ts`
- [ ] T052 [US1] Implement authenticated conversation start and message endpoints in `apps/ai-agentic/src/modules/conversations/conversations.controller.ts`
- [ ] T053 [US1] Wire `ConversationsModule`, specialist providers, and node providers into `apps/ai-agentic/src/modules/conversations/conversations.module.ts` and `apps/ai-agentic/src/modules/agents/agents.module.ts`
- [ ] T054 [US1] Return the contracted supervisor and specialist health roster from `apps/ai-agentic/src/app.controller.ts` and `apps/ai-agentic/src/app.service.ts`
- [ ] T055 [US1] Add typed frontend AI conversation turn request/response helpers in `apps/web/src/lib/api/ai.ts`
- [ ] T056 [P] [US1] Create reusable chat message, source context, and routing trace UI components in `apps/web/src/components/ai/ai-message.tsx`, `apps/web/src/components/ai/source-context-list.tsx`, and `apps/web/src/components/ai/routing-trace-summary.tsx`
- [ ] T057 [US1] Create the authenticated AI Assistant chat page in `apps/web/src/pages/ai-assistant.tsx`
- [ ] T058 [US1] Add the AI Assistant route and sidebar navigation entry in `apps/web/src/App.tsx` and `apps/web/src/components/layout.tsx`
- [ ] T059 [US1] Add an authenticated gateway proxy smoke test for `/api/ai/health` and `/api/ai/conversations` in `apps/api-gateway/test/proxy.e2e-spec.ts`

**Checkpoint**: User Story 1 is fully functional and testable independently as the MVP.

---

## Phase 4: User Story 2 - Continue and Manage AI Conversations (Priority: P2)

**Goal**: Let users list, open, resume, archive/delete, and rate assistant conversations while preserving prior context and required audit records.

**Independent Test**: Start a conversation, ask follow-ups across domains, leave the module, return later, resume the conversation, provide feedback, and archive/delete it without losing required audit records.

### Tests for User Story 2

- [ ] T060 [P] [US2] Add API contract tests for `GET /conversations`, `GET /conversations/{conversationId}`, `PATCH /conversations/{conversationId}`, and `DELETE /conversations/{conversationId}` in `apps/ai-agentic/test/contracts/conversation-management.contract-spec.ts`
- [ ] T061 [P] [US2] Add integration tests for follow-up questions that use prior messages and recheck current permissions in `apps/ai-agentic/test/integration/conversation-resume.integration-spec.ts`
- [ ] T062 [P] [US2] Add feedback endpoint tests for create/update semantics and user ownership in `apps/ai-agentic/test/contracts/response-feedback.contract-spec.ts`
- [ ] T063 [P] [US2] Add governance aggregate tests for usage, safety refusal, degraded answer, escalation, and feedback counts in `apps/ai-agentic/test/contracts/governance-agent-activity.contract-spec.ts`

### Implementation for User Story 2

- [ ] T064 [US2] Create conversation list, update, and detail DTOs in `apps/ai-agentic/src/modules/conversations/dto/list-conversations-query.dto.ts`, `apps/ai-agentic/src/modules/conversations/dto/update-conversation.dto.ts`, and `apps/ai-agentic/src/modules/conversations/dto/conversation-detail.dto.ts`
- [ ] T065 [US2] Implement user-owned conversation list, detail, archive, restore, and delete behavior in `apps/ai-agentic/src/modules/conversations/conversations.service.ts`
- [ ] T066 [US2] Implement history and prior-handoff context building for resumed conversations in `apps/ai-agentic/src/modules/conversations/conversation-context.service.ts`
- [ ] T067 [US2] Implement sensitive-data-safe title and preview generation in `apps/ai-agentic/src/modules/conversations/conversation-title.service.ts`
- [ ] T068 [US2] Add conversation management endpoints to `apps/ai-agentic/src/modules/conversations/conversations.controller.ts`
- [ ] T069 [US2] Create feedback DTOs, service, and controller in `apps/ai-agentic/src/modules/feedback/dto/feedback.dto.ts`, `apps/ai-agentic/src/modules/feedback/feedback.service.ts`, and `apps/ai-agentic/src/modules/feedback/feedback.controller.ts`
- [ ] T070 [US2] Implement aggregate agent activity and privacy-safe metrics in `apps/ai-agentic/src/modules/governance/governance.service.ts`
- [ ] T071 [US2] Implement HR/admin governance endpoint guards and controller in `apps/ai-agentic/src/modules/governance/governance.controller.ts`
- [ ] T072 [US2] Wire `FeedbackModule` and `GovernanceModule` into `apps/ai-agentic/src/modules/feedback/feedback.module.ts`, `apps/ai-agentic/src/modules/governance/governance.module.ts`, and `apps/ai-agentic/src/app.module.ts`
- [ ] T073 [US2] Extend frontend AI API helpers for list, detail, archive, delete, send follow-up, and feedback operations in `apps/web/src/lib/api/ai.ts`
- [ ] T074 [P] [US2] Create conversation list, empty state, and archive/delete UI components in `apps/web/src/components/ai/ai-conversation-list.tsx` and `apps/web/src/components/ai/ai-conversation-actions.tsx`
- [ ] T075 [P] [US2] Create assistant response feedback controls in `apps/web/src/components/ai/ai-response-feedback.tsx`
- [ ] T076 [US2] Wire conversation resume, conversation switching, archive/delete, and feedback flows into `apps/web/src/pages/ai-assistant.tsx`

**Checkpoint**: User Story 2 works independently after the MVP and preserves user-owned conversation continuity.

---

## Phase 5: User Story 3 - Draft HR Work Products Safely (Priority: P3)

**Goal**: Route drafting requests to the right specialist agent, return clearly labeled editable drafts, and ensure the scaffold never mutates official HR records.

**Independent Test**: Ask for objective drafts, self-review notes, manager feedback, HR announcements, policy summaries, workforce insight summaries, and phrase rewrites; verify drafts are scoped, labeled, source-aware, and read-only.

### Tests for User Story 3

- [ ] T077 [P] [US3] Add draft-routing tests for objective, self-review, manager-feedback, HR-announcement, policy-summary, workforce-insight, and phrase-rewrite prompts in `apps/ai-agentic/test/integration/draft-routing.integration-spec.ts`
- [ ] T078 [P] [US3] Add read-only enforcement tests proving no HR Core or Social mutation client is called during draft requests in `apps/ai-agentic/src/modules/agents/draft-readonly.spec.ts`
- [ ] T079 [P] [US3] Add language agent tests for preserving user intent while professionalizing workplace phrases in `apps/ai-agentic/src/modules/agents/specialists/language-agent.service.spec.ts`
- [ ] T080 [P] [US3] Add interpersonal-judgment and safety-risk escalation tests for draft-adjacent conflict prompts in `apps/ai-agentic/test/integration/human-escalation.integration-spec.ts`

### Implementation for User Story 3

- [ ] T081 [US3] Extend supervisor classification with draft intent categories and draft-safe routing in `apps/ai-agentic/src/modules/agents/supervisor-intent-classifier.service.ts`
- [ ] T082 [US3] Implement draft-specific safety and no-official-record-mutation rules in `apps/ai-agentic/src/common/safety/draft-policy.service.ts`
- [ ] T083 [US3] Add permitted objective and key-result draft behavior to `apps/ai-agentic/src/modules/agents/specialists/okr-agent.service.ts`
- [ ] T084 [US3] Add self-review, growth-plan, and development-next-step draft behavior to `apps/ai-agentic/src/modules/agents/specialists/career-agent.service.ts`
- [ ] T085 [US3] Add manager feedback and review-guidance draft behavior to `apps/ai-agentic/src/modules/agents/specialists/career-agent.service.ts`
- [ ] T086 [US3] Add scoped workforce insight summary draft behavior to `apps/ai-agentic/src/modules/agents/specialists/analytics-agent.service.ts`
- [ ] T087 [US3] Add policy summary and HR announcement draft behavior grounded in approved knowledge to `apps/ai-agentic/src/modules/agents/specialists/general-help-agent.service.ts`
- [ ] T088 [US3] Add phrase-review modes and constructive workplace tone boundaries to `apps/ai-agentic/src/modules/agents/specialists/language-agent.service.ts`
- [ ] T089 [US3] Update final answer composition to label drafts, uncertainty, sensitive context limitations, and human-review reminders in `apps/ai-agentic/src/modules/agents/nodes/final-answer-node.service.ts`
- [ ] T090 [US3] Add draft mode controls and draft copy actions to `apps/web/src/components/ai/ai-draft-toolbar.tsx` and `apps/web/src/pages/ai-assistant.tsx`

**Checkpoint**: User Story 3 works independently after the conversation scaffold and remains read-only for official records.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, docs, verification, quickstart smoke, and handoff updates across the completed scaffold.

- [ ] T091 [P] Add AI-specific frontend error messages for scope refusals, unavailable specialists, feedback errors, and gateway envelopes in `apps/web/src/lib/api/gateway-error.ts`
- [ ] T092 [P] Update AI module quickstart commands and expected scaffold outputs in `specs/016-ai-module/quickstart.md`
- [ ] T093 [P] Update OpenAPI Swagger annotations for AI Agentic health, conversations, feedback, and governance routes in `apps/ai-agentic/src/app.controller.ts`, `apps/ai-agentic/src/modules/conversations/conversations.controller.ts`, `apps/ai-agentic/src/modules/feedback/feedback.controller.ts`, and `apps/ai-agentic/src/modules/governance/governance.controller.ts`
- [ ] T094 Run AI Agentic verification commands from `apps/ai-agentic/package.json`: `pnpm --filter @sentient/ai-agentic type-check`, `pnpm --filter @sentient/ai-agentic test`, and `pnpm --filter @sentient/ai-agentic build`
- [ ] T095 Run Web verification command from `apps/web/package.json`: `pnpm --filter @sentient/web type-check`
- [ ] T096 Run Gateway proxy regression command from `apps/api-gateway/package.json`: `pnpm --filter @sentient/api-gateway test`
- [ ] T097 Execute health, first conversation, multi-agent manager, clarification, out-of-scope, interpersonal-judgment, feedback, and web smoke flows from `specs/016-ai-module/quickstart.md`
- [ ] T098 Update the AI module implementation handoff note in `AGENTS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundation; recommended MVP.
- **User Story 2 (Phase 4)**: Depends on US1 because conversation management needs persisted conversation turns.
- **User Story 3 (Phase 5)**: Depends on US1 and benefits from US2 conversation continuity, but draft routing can be tested once the supervisor graph is available.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: MVP supervisor entry point; no dependency on other user stories after Foundation.
- **US2 (P2)**: Requires US1 conversation persistence and message turns.
- **US3 (P3)**: Requires US1 routing/final-answer guardrails; can be added before or after the full US2 web management surface if needed.

### Within Each User Story

- Tests are listed before implementation tasks and should fail before implementation.
- DTOs and serializers before services and controllers.
- Graph contracts and guardrails before specialist behavior.
- Specialist agents return structured results to the supervisor before final-answer composition.
- Each checkpoint should be validated before moving to the next priority story.

### Parallel Opportunities

- Setup tasks T001, T002, T004, T005, T006, and T007 can run in parallel.
- Foundational type/client/safety tasks T012, T013, T014, T017, and T018 can run in parallel.
- US1 specialist services T043 through T049 can run in parallel after the agent registry contract is complete.
- US2 feedback, governance, and web conversation components can run in parallel after conversation management DTOs are defined.
- US3 draft tests T077 through T080 can run in parallel, and specialist draft implementations T083 through T088 can be split by domain.

---

## Parallel Examples

### User Story 1

```bash
Task: "T033 [US1] Add API contract tests in apps/ai-agentic/test/contracts/conversations.contract-spec.ts"
Task: "T034 [US1] Add state-machine fixture tests in apps/ai-agentic/test/integration/agent-state-machine.integration-spec.ts"
Task: "T043 [US1] Implement Leave Agent in apps/ai-agentic/src/modules/agents/specialists/leave-agent.service.ts"
Task: "T044 [US1] Implement OKR Agent in apps/ai-agentic/src/modules/agents/specialists/okr-agent.service.ts"
Task: "T046 [US1] Implement Analytics Agent in apps/ai-agentic/src/modules/agents/specialists/analytics-agent.service.ts"
```

### User Story 2

```bash
Task: "T060 [US2] Add conversation management contract tests in apps/ai-agentic/test/contracts/conversation-management.contract-spec.ts"
Task: "T062 [US2] Add feedback endpoint tests in apps/ai-agentic/test/contracts/response-feedback.contract-spec.ts"
Task: "T063 [US2] Add governance aggregate tests in apps/ai-agentic/test/contracts/governance-agent-activity.contract-spec.ts"
Task: "T074 [US2] Create conversation list/action components in apps/web/src/components/ai/"
```

### User Story 3

```bash
Task: "T077 [US3] Add draft-routing tests in apps/ai-agentic/test/integration/draft-routing.integration-spec.ts"
Task: "T079 [US3] Add Language Agent tests in apps/ai-agentic/src/modules/agents/specialists/language-agent.service.spec.ts"
Task: "T083 [US3] Add OKR draft behavior in apps/ai-agentic/src/modules/agents/specialists/okr-agent.service.ts"
Task: "T087 [US3] Add General Help draft behavior in apps/ai-agentic/src/modules/agents/specialists/general-help-agent.service.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundation.
3. Complete Phase 3: US1 supervisor entry point.
4. Validate employee, manager, HR admin, clarification, out-of-scope, and interpersonal-judgment prompts.
5. Stop and demo the MVP before adding full conversation management and draft workflows.

### Conversation Continuity Increment

1. Add US2 list/detail/archive/delete/feedback/governance APIs.
2. Add the web conversation list, resume, archive/delete, and response feedback controls.
3. Validate prior-message context and current-permission rechecks.

### Drafting Increment

1. Add US3 draft routing and read-only draft guardrails.
2. Add domain draft behavior for OKR, Career, Analytics, General Help, and Language.
3. Validate that no official HR Core or Social records are mutated.

### Parallel Team Strategy

With multiple implementers:

1. One engineer completes Setup/Foundation.
2. Engineer A implements US1 supervisor graph and conversation APIs.
3. Engineer B implements specialist agents and state-machine tests after graph contracts land.
4. Engineer C implements US2 conversation management, feedback, governance, and web continuity.
5. Engineer D implements US3 draft behavior and draft safety tests after US1 routing exists.

---

## Summary

- **Total tasks**: 98
- **Setup tasks**: 8
- **Foundational tasks**: 24
- **US1 tasks**: 27
- **US2 tasks**: 17
- **US3 tasks**: 14
- **Polish tasks**: 8
- **MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1)
