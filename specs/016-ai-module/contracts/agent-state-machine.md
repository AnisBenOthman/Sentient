# Contract: Agent State Machine

## Purpose

This contract defines how the Supervisor Agent, clarification node, specialist agents, Human Escalation Agent, and Final Answer node exchange state inside the AI module scaffold.

The runtime orchestration layer is LangGraph.js inside the NestJS `apps/ai-agentic` service. NestJS owns API, auth, RBAC, persistence, and dependency injection; LangGraph owns the internal node transitions for each conversation turn.

## Agent Nodes

| Node | Type | Responsibility | Returns Control To |
|------|------|----------------|--------------------|
| Supervisor Agent | `SUPERVISOR` | Classifies intent, applies intake guardrails, routes to clarification, specialist agents, escalation, or final answer | Final Answer or selected node |
| Ask User for Clarification | `CLARIFICATION` | Asks focused follow-up questions when safe routing requires more detail | Supervisor Agent |
| OKR Agent | `SPECIALIST` | Explains org OKRs, drafts permitted OKR ideas, explains progress/risk in scope | Supervisor Agent |
| Career Agent | `SPECIALIST` | Helps with growth paths, skills, reviews, learning, and development planning | Supervisor Agent |
| Analytics Agent | `SPECIALIST` | Explains dashboards, stats, trends, and scoped manager/HR insights | Supervisor Agent |
| Onboarding Agent | `SPECIALIST` | Supports new-hire welcome, onboarding progress, and manager/HR onboarding status | Supervisor Agent |
| Leave Agent | `SPECIALIST` | Answers leave balance/history/policy questions and prepares booking drafts | Supervisor Agent |
| Language Agent | `SPECIALIST` | Rewords and professionalizes user-provided workplace phrases | Supervisor Agent |
| General Help Agent | `SPECIALIST` | Answers FAQs and policy/handbook questions from approved knowledge | Supervisor Agent |
| Human Escalation Agent | `HUMAN_ESCALATION` | Records human handoff target and safe summary | Supervisor Agent |
| Final Answer | `FINAL_ANSWER` | Applies final tone, scope, privacy, source, and safety checks | End turn |

## Runtime Graph

```text
START
  -> supervisor
  -> humanEscalation | clarification | specialists | finalAnswer
  -> finalAnswer
  -> END
```

Implementation notes:

- `SupervisorLangGraphRunnerService` compiles the LangGraph graph.
- `SupervisorAgentService` remains the stable NestJS facade used by conversations/controllers.
- Specialist services remain NestJS providers and are invoked from the LangGraph `specialists` node.
- Audit records are still written through `AgentTaskLog`, `AgentNodeRun`, `AgentHandoff`, and `PermissionDecisionRecord`.
- The launch graph keeps specialist execution sequential inside the `specialists` node so current audit sequencing and permission handling remain deterministic.

## Graph State

```ts
type AgentGraphState = {
  conversationId: string;
  userMessageId: string;
  actor: {
    userId: string;
    employeeId: string | null;
    roles: string[];
    scope: string;
  };
  normalizedIntent: string;
  sentientScoped: boolean;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredAgents: AgentType[];
  permissionDecisions: PermissionDecisionRecord[];
  specialistResults: SpecialistResult[];
  escalation: HumanEscalationResult | null;
  finalAnswer: FinalAnswerResult | null;
  correlationId: string;
};
```

## Specialist Input

```ts
type SpecialistInput = {
  conversationId: string;
  parentTaskLogId: string;
  userMessage: string;
  normalizedIntent: string;
  actorContext: AgentContext;
  conversationContext: ConversationTurnContext;
  sourceHints: string[];
  isDraftRequest: boolean;
  constraints: {
    sentientOnly: true;
    readOnlyOfficialRecords: true;
    mustReturnToSupervisor: true;
  };
};
```

## Specialist Result

```ts
type SpecialistResult = {
  agentType: AgentType;
  status: 'SUCCESS' | 'PARTIAL' | 'DEGRADED' | 'FAILED' | 'REFUSED' | 'OUT_OF_SCOPE';
  summary: string;
  userVisibleContent: string;
  sourceContext: Array<{
    sourceType: string;
    title: string;
    referenceId?: string;
  }>;
  permissionDecision: 'ALLOWED' | 'PARTIAL' | 'DENIED' | 'UNAVAILABLE';
  recommendedNextStep?: string;
};
```

## Routing Rules

### Supervisor Intake

The Supervisor Agent MUST:

1. Determine whether the prompt is Sentient-scoped.
2. Detect restricted categories: unauthorized data, unsafe advice, interpersonal judgment, immediate safety risk, unrelated topic.
3. Decide whether clarification is required.
4. Select zero, one, or multiple specialist agents.
5. Create a parent `AgentTaskLog`.

### Clarification

Clarification is required when:

- The requested domain is ambiguous.
- The request references a missing object or person.
- The supervisor cannot safely distinguish between general language help and a workplace conflict.
- The user asks for action but does not specify enough context to prepare a draft safely.

Clarification MUST NOT be used to bypass privacy or scope rules.

### Specialist Handoff

Every specialist handoff MUST:

- Create an `AgentHandoff`.
- Create a child `AgentTaskLog`.
- Receive the user's own `AgentContext`.
- Return a `SpecialistResult`.
- Return control to the Supervisor Agent before the user sees a final answer.

### Human Escalation

Human escalation is required or recommended when:

- The user asks for judgment about another person.
- The user describes harassment, discrimination, conflict, discomfort, or workplace incident.
- The request requires official HR decision-making.
- A specialist cannot resolve a complex case safely.
- The user indicates immediate safety risk.

Human escalation MUST produce:

- `targetType`
- `targetLabel`
- neutral `summaryForHuman`
- user-facing next step

### Final Answer

The Final Answer node MUST:

- Compose one coherent response.
- Keep the response within Sentient scope.
- Avoid judging people or assigning blame.
- Label drafts clearly.
- Include source context when factual.
- Explain degraded or unavailable context.
- End the turn only when resolved, declined, refused, or escalated.

## Required Test Fixtures

Routing fixtures must include:

- Single-domain leave question.
- Multi-domain manager question using leave, OKR, and analytics.
- Ambiguous prompt requiring clarification.
- Off-topic general knowledge prompt.
- Interpersonal judgment prompt.
- HR admin dashboard explanation prompt.
- Handbook/policy FAQ prompt.
- Human escalation safety-risk prompt.

## Non-Goals

- No autonomous official-record writes.
- No general-purpose chatbot answers outside Sentient context.
- No fault determination in interpersonal conflicts.
- No external ticketing/email integration required for scaffold; record the escalation target and next step.
