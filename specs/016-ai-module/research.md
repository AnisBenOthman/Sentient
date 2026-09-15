# Research: AI Module

## R1. Scaffold scope for the first AI module slice

**Decision**: Implement a real module scaffold with persistence, APIs, state-machine orchestration, deterministic routing, safety checks, agent registry, audit logs, and frontend entry point. Do not require an external LLM provider for this first scaffold.

**Rationale**: `apps/ai-agentic` currently has only the NestJS shell and Prisma placeholder. A scaffold that already persists conversations, routes through graph nodes, logs handoffs, and returns deterministic specialist responses is testable and useful as infrastructure. It also avoids blocking on provider keys while preserving a clean interface for later model-backed agents.

**Alternatives considered**:

- **Add a model provider immediately**: Rejected for scaffold because provider choice, credentials, and eval harness would dominate the first implementation slice.
- **Only add empty folders/classes**: Rejected because project rules require complete, production-quality code, not placeholders.

## R2. State-machine implementation

**Decision**: Represent the workflow as an internal typed graph/state-machine service in AI Agentic for the scaffold. Nodes include Supervisor, Ask User for Clarification, specialist agents, Human Escalation, and Final Answer.

**Rationale**: The spec describes graph nodes and supervisor routing, but the current package has no graph runtime dependency. A typed in-repo state machine is enough for deterministic routing and contracts. It can later be adapted to LangGraph-style orchestration without changing the public API or stored conversation model.

**Alternatives considered**:

- **Introduce a graph runtime dependency now**: Rejected for scaffold because no existing dependency is installed and deterministic routing is easier to test.
- **Single service method without node model**: Rejected because it would hide handoffs and make supervisor/specialist audit trails harder to verify.

## R3. Specialist agent roster

**Decision**: Scaffold the named roster from the spec: Supervisor, OKR, Career, Analytics, Onboarding, Leave, Language, General Help, and Human Escalation. Extend shared agent type definitions to include missing names.

**Rationale**: Shared already contains `LEAVE_AGENT`, `CAREER_AGENT`, `ANALYTICS_AGENT`, and onboarding/linguistic-like values. The new spec requires Supervisor, OKR, General Help, and Human Escalation to be first-class. A registry lets tasks add specialist behavior incrementally without changing the supervisor contract.

**Alternatives considered**:

- **Use only one HR Assistant type**: Rejected because the user explicitly wants domain sub-agents and graph routing.
- **Create one service per future domain without registry**: Rejected because supervisor routing needs a stable inventory and health surface.

## R4. Permission and scope model

**Decision**: User-initiated agent calls forward the user's JWT to downstream HR/Social services and rely on those services for authoritative RBAC. AI Agentic also records permission decisions and graceful degradation locally.

**Rationale**: This matches `AgentContext` guidance and prior OKR tool planning. It avoids duplicating HR Core scope matrices inside the agent graph. Downstream 403/404 responses become structured degradation results that the supervisor can explain.

**Alternatives considered**:

- **Pre-check all permissions in the supervisor**: Rejected because it duplicates service-owned RBAC and risks drift.
- **Use a system token for user chats**: Rejected because it would over-broaden user context and violate scoped assistant behavior.

## R5. General Help RAG and policy knowledge

**Decision**: Scaffold knowledge ingestion/storage around `KnowledgeItem` and `VectorDocument` rows in `ai_agent`, with document metadata pointing back to Social documents. General Help answers use only approved indexed content.

**Rationale**: PostgreSQL pgvector is already provisioned. Documents module specs already describe AI Agentic consuming `document.uploaded` and `document.deleted` events. The scaffold should prepare this storage and retrieval boundary even if embedding generation is wired later.

**Alternatives considered**:

- **Read Social documents live on every question**: Rejected because it is slower and makes citations/retrieval harder.
- **Allow arbitrary user-uploaded text as policy context**: Rejected because the spec requires approved policy/document knowledge.

## R6. Human escalation

**Decision**: Treat escalation as a graph node and persisted `HumanEscalation` record. The scaffold records the target channel and next step, then returns a user-facing handoff explanation.

**Rationale**: User requirements emphasize routing sensitive or complex cases to a manager, HR business partner, or People team. A persisted escalation record makes the endpoint testable now and leaves room for future ticketing or notification integration.

**Alternatives considered**:

- **Just tell users to contact HR without recording anything**: Rejected because success criteria require recorded handoff targets.
- **Immediately integrate with ticketing/email**: Rejected for scaffold; channel integration can come after core handoff contracts are stable.

## R7. API and frontend route

**Decision**: Use the existing gateway AI prefix and reserved conversation route: browser calls `/api/ai/conversations*`, gateway proxies to AI Agentic, and web adds an authenticated AI Assistant page.

**Rationale**: API Gateway already configures `/api/ai` and a rate-limit override for `/api/ai/conversations*`. Web already has `aiClient` for that prefix. Planning against that route avoids churn.

**Alternatives considered**:

- **Direct web calls to port 3003**: Rejected because the gateway migration established one frontend API origin.
- **A new `/chat` prefix**: Rejected because gateway tests already reserve conversations.

## R8. Safety and tone guardrails

**Decision**: Implement safety/scope checks as reusable guardrail policies before specialist routing and before final answer emission.

**Rationale**: Sentient-only scope, polite off-topic handling, interpersonal-judgment refusal, and human escalation must be consistent across all agents. Running guardrails at both supervisor intake and final answer reduces leakage risk.

**Alternatives considered**:

- **Only encode guardrails in prompts**: Rejected for scaffold because deterministic tests require explicit policies.
- **Only check after specialist output**: Rejected because restricted prompts should not reach specialists unnecessarily.
