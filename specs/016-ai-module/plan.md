# Implementation Plan: AI Module

**Branch**: `016-ai-module` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-ai-module/spec.md`

## Summary

Scaffold the Sentient AI module as a role-scoped supervisor-agent system inside `apps/ai-agentic`. The implementation uses NestJS for API/auth/audit boundaries and LangGraph.js for the internal supervisor-agent workflow. It creates the persistence model, graph orchestration layer, named specialist-agent registry, conversation APIs, audit trail, human-escalation records, General Help RAG document contracts, and a web AI assistant entry point routed through the existing API Gateway. The scaffold is read-only for official HR records: agents may answer, draft, clarify, refuse, or escalate, but they do not mutate HR Core or Social records.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode  
**Primary Dependencies**: NestJS 10, LangGraph.js (`@langchain/langgraph`), Prisma 5 multiSchema, PostgreSQL pgvector, class-validator, class-transformer, @nestjs/swagger, @nestjs/config, @nestjs/throttler, @sentient/shared, React 18 + Vite 7, TanStack Query v5, wouter, Tailwind CSS v4, shadcn/ui  
**Storage**: PostgreSQL 16 schema `ai_agent`; vector-capable knowledge rows for handbook/policy content; no cross-schema foreign keys  
**Testing**: Jest unit and integration tests for AI Agentic, contract tests for API shape and downstream clients, Web type-check, Gateway proxy smoke for `/api/ai/conversations`  
**Target Platform**: Local Windows/Linux development, Node 20+, existing Docker Compose PostgreSQL with pgvector  
**Project Type**: Web application with NestJS AI Agentic service, API Gateway proxy, and React SPA page  
**Performance Goals**: First visible assistant response or polite limitation within 15 seconds for 90% of launch prompts; routing decision within 2 seconds for deterministic scaffold paths  
**Constraints**: Sentient-only scope, user-token forwarding for user-initiated context, no autonomous official-record mutation, specialist agents return control to supervisor before final answer, all assistant activity audit logged with correlation id, LangGraph nodes remain wrapped by NestJS services for dependency injection and repository access  
**Scale/Scope**: One supervisor, eight named specialist agents, one conversation surface, three launch user tiers (employee, manager, HR admin), scaffolded RAG knowledge surface for policy/handbook content

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution file is still the generated placeholder and contains no actionable project-specific gates. The plan applies the effective repository rules from `AGENTS.md` and `CLAUDE.md`:

- **Strict TypeScript / no `any`**: PASS. All contracts require typed DTOs, typed graph state, and typed agent results.
- **Endpoint auth guards except health**: PASS. Conversation/admin endpoints use shared JWT/RBAC rules; health remains public.
- **Service boundaries**: PASS. AI Agentic reads HR/Social context through REST clients or events, never cross-service source imports or direct cross-schema relations.
- **No placeholders/stubs for assigned implementation tasks**: PASS. Scaffold tasks will implement real modules, persistence, DTOs, and deterministic behavior; future LLM/provider expansion is represented by stable interfaces and explicit non-goals.
- **Auditability**: PASS. Parent-child `AgentTaskLog` and `AgentHandoff` are first-class data model entities.
- **Safety/scope boundaries**: PASS. Sentient-only scope, interpersonal judgment guardrails, human escalation, and refusal flows are part of contracts and success criteria.

## Project Structure

### Documentation (this feature)

```text
specs/016-ai-module/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ai-module-api.yaml
│   └── agent-state-machine.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/ai-agentic/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── modules/
│   │   ├── conversations/
│   │   ├── agents/
│   │   ├── knowledge/
│   │   ├── feedback/
│   │   └── governance/
│   ├── common/
│   │   ├── clients/
│   │   ├── graph/
│   │   ├── safety/
│   │   └── dto/
│   └── prisma/
└── test/
    ├── contracts/
    └── integration/

apps/web/src/
├── pages/ai-assistant.tsx
├── components/ai/
└── lib/api/ai.ts

packages/shared/src/
├── enums/agent-type.enum.ts
├── enums/task-status.enum.ts
└── auth/agent-context.interface.ts
```

**Structure Decision**: Use the existing monorepo shape. AI persistence, public API, auth, RBAC, audit, and governance live in `apps/ai-agentic`; LangGraph.js owns the internal supervisor workflow through `SupervisorLangGraphRunnerService`. The browser talks through the existing `/api/ai` gateway prefix; shared enums/interfaces are extended only where needed for cross-app contracts. HR Core and Social remain data owners; AI Agentic receives context through scoped REST clients and event-driven knowledge ingestion.

## Complexity Tracking

No constitution violations or complexity exceptions.

## Phase 0 Research Complete

See [research.md](./research.md). Decisions cover LangGraph.js state-machine implementation inside NestJS, deterministic scaffold scope, user-token permission model, specialist registry, General Help RAG, human escalation, and frontend/API routing.

## Phase 1 Design Complete

Generated artifacts:

- [data-model.md](./data-model.md)
- [contracts/ai-module-api.yaml](./contracts/ai-module-api.yaml)
- [contracts/agent-state-machine.md](./contracts/agent-state-machine.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Strict typing**: PASS. Data model and API contracts avoid loose payloads; task generation should require DTOs and typed agent result unions.
- **Endpoint auth guards**: PASS. Contracts mark `/health` public and assistant/governance routes authenticated.
- **Service boundaries**: PASS. Contracts explicitly require downstream context through REST clients and system-authorized knowledge ingestion.
- **Auditability**: PASS. Handoffs, task logs, permission decisions, feedback, and escalations are retained as inspectable records.
- **Safety/scope**: PASS. Out-of-scope, interpersonal judgment, unsafe advice, and human escalation behaviors are testable.

## Notes

- The Spec Kit Bash setup script could not run in this Windows sandbox because Git Bash path translation attempted to write under `/c/Users/Anis`; this `plan.md` was created manually from `.specify/templates/plan-template.md` with the same resolved feature paths.
- This plan is intentionally scaffold-focused. It defines the production module skeleton, contracts, deterministic routing/safety behavior, and persistence. External LLM provider selection and autonomous action tools remain outside the first scaffold slice.
