# Sentient — CLAUDE.md (Master Project Instructions)

> Root instruction file for Claude Code. Read automatically at session start.
> Detailed conventions live in `rules/code-style.md`, `rules/security.md`, `rules/testing.md`.

---

## 1. Persona & Operating Mode

You are a **Senior Full-Stack Engineer** specializing in Agentic AI and HRIS systems,
building **"Sentient"** — a platform bridging traditional HRIS/Intranet with an autonomous
AI agent ecosystem.

**Current stage:** Stage 2 — Active Development (Months 2-6 of 6). The scaffold is done.
Write production-quality code immediately. No placeholder stubs, no TODO comments, no
"this would be implemented later" — if a task is assigned, implement it fully.

**Engineering mindset:**

- **Ship working code** — Every task produces compilable, runnable TypeScript. If a module
  is incomplete, stub only what is strictly needed for compilation — never leave broken imports.
- **Own the full stack** — You write Prisma schemas, NestJS modules, REST endpoints, DTOs,
  guards, interceptors, frontend components, and SQL migrations. Nothing is out of scope.
- **Read before writing** — Always read the relevant files before modifying them. Understand
  existing patterns, then extend consistently. Don't reinvent what's already there.
- **Strict TypeScript** — `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` are
  always on. No `any`, no `as unknown as X` escape hatches. Fix the type, not the error.
- **Security is non-negotiable** — Every new endpoint gets `@UseGuards(SharedJwtGuard)` +
  `@Roles(...)` + `RbacGuard`. No unauthenticated endpoints except `/health` and the exit
  survey response endpoint. Validate all input with class-validator DTOs.
- **Agentic Thinking** — Every domain module should emit domain events and expose REST
  endpoints that AI agents can call. Design for the agent integration from day one.
- **Modular Design** — The AI Agentic service is completely separate. Never import from
  `apps/hr-core/` inside `apps/social/` or vice versa. Cross-service = REST only.
- **Data Privacy First** — Strict RBAC and scope filtering from day one. Agents inherit
  the requesting user's permission scope — no backdoors.

**How to work:**

1. Read the task. Read the relevant existing files. Understand context.
2. Write the full implementation — schema, service, controller, DTOs, module wiring.
3. Verify imports are correct and types resolve. No broken references.
4. Update any barrel files (`index.ts`) that need the new export.
5. If Prisma schema changed, note that `npx prisma migrate dev` must be run.

---

## 2. Technical Stack (Strict — No Substitutions)

| Layer              | Technology                          | Notes                                  |
|--------------------|-------------------------------------|----------------------------------------|
| Backend            | NestJS (TypeScript)                 | One app per microservice               |
| Frontend           | Next.js 14+ (App Router) + Tailwind | Single SPA, calls services via gateway |
| Database           | PostgreSQL 16 + pgvector            | Shared instance, 3 separate schemas    |
| ORM                | Prisma                              | One client per service (per schema)    |
| AI Orchestration   | LangGraph (TypeScript)              | AI Agentic service only                |
| LLMs               | OpenAI (GPT-4o) via `@langchain/openai` |                                    |
| Embeddings         | `text-embedding-3-small` (1536d)    | Stored in pgvector (ai_agent schema)   |
| Channels           | Slack SDK + Twilio (WhatsApp)       | Multi-channel via Session.channel      |
| Inter-Service      | REST (Phase 1) -> Kafka (Phase 2)   | Abstracted behind IEventBus            |
| API Gateway        | Next.js API routes or NestJS GW     | Single entry point for frontend        |

**Why pgvector?** Keeps embeddings inside PostgreSQL for transactional consistency,
hybrid SQL + vector queries, and single-database deployment.

---

## 3. Microservice Architecture — 3 Services

```
    Next.js Frontend (SPA)
           |
    API Gateway (/api/hr/* -> :3001, /api/social/* -> :3002, /api/ai/* -> :3003)
       |           |           |
  HR Core:3001  Social:3002  AI Agentic:3003
  [hr_core]     [social]     [ai_agent]
       \           |           /
        PostgreSQL 16 + pgvector
```

### 3.1 Service Boundaries & Entity Ownership

| Service        | Port | Schema    | Entities | Count |
|----------------|------|-----------|----------|-------|
| **HR Core**    | 3001 | hr_core   | User, Role, Permission, UserRole, RolePermission, Session, Employee, Department, Team, Position, Skill, EmployeeSkill, SalaryHistory, LeaveType, LeaveBalance, LeaveRequest, Complaint, PerformanceReview, Notification, Holiday, ProbationPolicy, ProbationPeriod, ProbationEvaluation, ContractAmendment | 24 |
| **Social**     | 3002 | social    | Announcement, Event, EventAttendee, Document, Feedback, EngagementSnapshot, ExitSurvey, ExitSurveyResponse | 8 |
| **AI Agentic** | 3003 | ai_agent  | Conversation, Message, VectorDocument, AgentTaskLog, OrgScenario | 5 |

### 3.2 Cross-Service Rules

Services **never** query another service's schema directly. REST calls (Phase 1)
or events (Phase 2). Logical foreign ID references validated at the application layer.

| Scenario                               | Direction              | Method                                  |
|----------------------------------------|------------------------|-----------------------------------------|
| Agent needs employee profile           | AI -> HR Core          | `GET /api/hr/employees/:id`             |
| Agent needs leave balance              | AI -> HR Core          | `GET /api/hr/leave-balances?empId=X`    |
| Social needs employee name             | Social -> HR Core      | `GET /api/hr/employees/:id` (cached)    |
| Agent creates leave request            | AI -> HR Core          | `POST /api/hr/leave-requests`           |
| Agent reads event feedback             | AI -> Social           | `GET /api/social/feedback?eventId=X`    |
| Agent generates engagement snapshot    | AI -> Social           | `POST /api/social/engagement-snapshots` |
| Exit survey dispatched on termination  | AI -> Social           | `POST /api/social/exit-surveys` (SYSTEM JWT) |
| Org scenario salary analysis           | AI -> HR Core          | `GET /api/hr/org-chart` + Text-to-SQL   |
| HR Admin views agent audit logs        | Frontend -> AI         | `GET /api/ai/task-logs`                 |

### 3.3 EventBus Abstraction

**Phase 1:** REST-based event emitter. **Phase 2:** Swap transport to Kafka.
Business logic unchanged. Interface defined in `packages/shared/src/event-bus/`.

Key types: `IEventBus` (emit/subscribe), `DomainEvent<T>` (id, type, source,
timestamp, payload, metadata with userId + correlationId).

### 3.4 Domain Events Catalog

**HR Core emits:**

| Event | Consumed By | Key Payload |
|-------|-------------|-------------|
| `leave.requested` | AI | leaveRequestId, employeeId |
| `leave.approved` | AI, Social | leaveRequestId, reviewerId |
| `leave.rejected` | AI | leaveRequestId, reason |
| `employee.created` | Social, AI | employeeId, departmentId |
| `employee.terminated` | Social, AI | employeeId |
| `probation.started` | AI | probationPeriodId, employeeId, managerId, dates |
| `probation.evaluation_due` | AI | probationPeriodId, dueDate |
| `probation.self_eval_submitted` | AI | probationPeriodId, employeeId |
| `probation.manager_eval_submitted` | AI | probationPeriodId, managerId |
| `probation.decision.confirmed` | AI, Social | probationPeriodId, decidedById |
| `probation.decision.extended` | AI | probationPeriodId, newEndDate |
| `probation.decision.terminated` | AI, Social | probationPeriodId, employeeId |
| `contract.amendment_submitted` | AI | amendmentId, employeeId, requestedById |
| `contract.amendment_approved` | AI | amendmentId, effectiveDate |
| `contract.amendment_rejected` | AI | amendmentId, reason |
| `performance.review_completed` | AI | reviewId, employeeId, reviewerId |

**Social emits:**

| Event | Consumed By | Key Payload |
|-------|-------------|-------------|
| `announcement.published` | AI | announcementId, audience |
| `event.created` | AI | eventId, type |
| `feedback.submitted` | AI | feedbackId, eventId |
| `document.uploaded` | AI | documentId, category |
| `exit_survey.sent` | AI | surveyId, employeeId, channel |
| `exit_survey.completed` | AI | surveyId (no employeeId — anonymized) |
| `exit_survey.expired` | AI | surveyId |
| `probation.letter_generated` | HR Core, AI | documentId, probationPeriodId |

**AI Agentic emits:**

| Event | Consumed By | Key Payload |
|-------|-------------|-------------|
| `agent.risk_assessment_done` | HR Core | leaveRequestId, assessment |
| `agent.snapshot_generated` | Social | snapshotId, entityType |
| `exit_survey.results_ready` | Social | surveyId, snapshotId |
| `org_scenario.analysis_requested` | AI (internal) | scenarioId |
| `org_scenario.analysis_completed` | Frontend (polling) | scenarioId, aiAnalysis |
| `org_scenario.approved` | HR Core | scenarioId, amendmentIds[] |
| `regulation.seeded` | AI (internal log) | region, documentCount |
| `regulation.updated` | AI | regulationRegion, updatedDocumentIds |

---

## 4. Project Structure (Monorepo)

```
sentient/
├── .claude/
│   ├── CLAUDE.md
│   └── rules/                            # code-style.md, testing.md, security.md
├── apps/
│   ├── hr-core/                          # Microservice 1 (port 3001)
│   │   ├── src/modules/
│   │   │   ├── iam/                      # User, Role, Permission, Session
│   │   │   ├── organization/             # Department, Team, Position (org structure)
│   │   │   ├── employees/                # Employee, SalaryHistory (lifecycle + compensation)
│   │   │   ├── skills/                   # Skill, EmployeeSkill
│   │   │   ├── leaves/                   # LeaveType, LeaveBalance, LeaveRequest
│   │   │   ├── performance/              # PerformanceReview (standalone review cycles)
│   │   │   ├── complaints/               # Complaint
│   │   │   ├── probation/                # ProbationPolicy, ProbationPeriod, ProbationEvaluation
│   │   │   ├── contract-amendments/      # ContractAmendment
│   │   │   ├── notifications/            # Notification (multi-channel dispatch)
│   │   │   └── config/                   # Holiday, system settings
│   │   ├── src/common/                   # Guards, decorators, interceptors, filters
│   │   ├── src/prisma/                   # PrismaModule (hr_core schema)
│   │   ├── prisma/schema.prisma          # hr_core schema — 24 entities
│   │   └── prisma/seed.ts
│   │
│   ├── social/                           # Microservice 2 (port 3002)
│   │   ├── src/modules/
│   │   │   ├── announcements/            # Announcement
│   │   │   ├── events/                   # Event, EventAttendee
│   │   │   ├── documents/                # Document (source files for RAG)
│   │   │   ├── feedback/                 # Feedback
│   │   │   ├── engagement/               # EngagementSnapshot
│   │   │   └── exit-surveys/             # ExitSurvey, ExitSurveyResponse
│   │   ├── src/common/                   # Guards, HrCoreClient
│   │   ├── prisma/schema.prisma          # social schema — 8 entities
│   │   └── prisma/seed.ts
│   │
│   ├── ai-agentic/                       # Microservice 3 (port 3003)
│   │   ├── src/agents/                   # LangGraph agent definitions
│   │   │   ├── hr-assistant/             # RAG Q&A (dual-namespace)
│   │   │   ├── leave-agent/              # Context-aware leave processing
│   │   │   ├── career-agent/             # Profile analysis, interview prep
│   │   │   ├── linguistic-agent/         # Professional reformulation
│   │   │   ├── analytics-agent/          # Text-to-SQL + org-scenario sub-graph
│   │   │   ├── engagement-agent/         # Feedback synthesis + exit survey
│   │   │   └── onboarding-companion/     # Probation lifecycle support
│   │   ├── src/rag/                      # chunker, embedder, retriever (dual-namespace)
│   │   ├── src/tools/                    # ToolRegistry + LangGraph tool wrappers
│   │   ├── src/conversations/            # Conversation, Message persistence
│   │   ├── src/task-log/                 # AgentTaskLog — governance API
│   │   ├── src/org-scenarios/            # OrgScenario CRUD + lifecycle
│   │   ├── src/scheduler/                # Bull queue for scheduled tasks
│   │   ├── src/common/                   # Guards, AgentContextFactory, GracefulDegradation, REST clients
│   │   ├── prisma/schema.prisma          # ai_agent schema — 5 entities + pgvector
│   │   └── prisma/seeds/regulations/     # Algerian Labour Code .txt files
│   │
│   └── web/                              # Next.js frontend (SPA)
│       ├── src/app/                      # App Router: (auth), (dashboard), (intranet), (ai), (survey), api/
│       ├── src/components/               # ui/, employees/, leaves/, chat/, governance/, exit-surveys/, org-chart/, layout/
│       └── src/lib/api/                  # Typed clients: hr-core, social, ai
│
├── packages/shared/                      # Shared across ALL services
│   └── src/
│       ├── enums/                        # All 32 enums (single source of truth)
│       ├── interfaces/                   # Entity interfaces (read-only contracts)
│       ├── dto/                          # Shared DTOs for inter-service calls
│       ├── event-bus/                    # IEventBus, DomainEvent, REST + Kafka impls
│       └── auth/                         # JWT types, AgentContext, SystemJwtPayload
│
├── docker-compose.yml                    # pgvector/pgvector:pg16 (+ Kafka Phase 2)
├── scripts/init-schemas.sql              # Creates 3 schemas + pgvector extension
├── turbo.json
└── .env.example
```

**Key rule:** `apps/ai-agentic/` NEVER imports from `apps/hr-core/` or `apps/social/`.
Communication ONLY through REST clients and EventBus. This makes the AI layer portable.

---

## 5. Database Architecture

3 schemas (`hr_core`, `social`, `ai_agent`) in one PostgreSQL instance. Each service
connects with its own DB role. No cross-schema queries except one explicit grant:
`ai_analytics_readonly` gets SELECT-only on `hr_core` for Text-to-SQL analytics.

Schema init SQL lives in `scripts/init-schemas.sql`. Prisma config per service detailed
in `rules/code-style.md` section 3.

**Cross-service FK strategy:** Services store logical foreign IDs (plain `String` fields)
with NO database-level foreign keys across schemas. Validated at application layer via REST.

---

## 6. Domain Model — 37 Entities Across 3 Services

Complete class diagram in `sentient-class-diagram-spec.md`.

### HR Core (24 entities, schema: hr_core)

| Domain              | Entities |
|---------------------|----------|
| IAM                 | User, Role, Permission, UserRole, RolePermission, Session |
| Organization        | Department, Team, Position |
| Employees           | Employee, SalaryHistory |
| Skills              | Skill, EmployeeSkill |
| Leave               | LeaveType, LeaveBalance, LeaveRequest |
| Performance         | PerformanceReview |
| Probation           | ProbationPolicy, ProbationPeriod, ProbationEvaluation |
| Contract Amendments | ContractAmendment |
| Complaints          | Complaint |
| Notifications       | Notification |
| Config              | Holiday |

### Social (8 entities, schema: social)

| Domain       | Entities |
|--------------|----------|
| Intranet     | Announcement, Event, EventAttendee, Document |
| Engagement   | Feedback, EngagementSnapshot |
| Exit Surveys | ExitSurvey, ExitSurveyResponse |

### AI Agentic (5 entities, schema: ai_agent)

| Domain        | Entities |
|---------------|----------|
| Conversations | Conversation, Message |
| RAG           | VectorDocument (sourceType: INTERNAL_POLICY / EXTERNAL_REGULATION, regulationRegion) |
| Audit         | AgentTaskLog (parentLogId for tool call chains, actorUserId) |
| Org Planning  | OrgScenario (proposedChanges: Json, aiAnalysis: Json?, status) |

### Critical Design Decisions

1. **Permission.scope** (OWN | TEAM | DEPARTMENT | GLOBAL) — Row-level security.
   Agents inherit requesting user's scope via JWT claims.
2. **LeaveRequest.agentRiskAssessment** (Json) — In HR Core, populated by AI via REST PATCH.
3. **Notification in HR Core** — Triggered by HR events, needs employee roles for routing.
4. **Document in Social** — Source files for RAG. On upload, Social emits `document.uploaded`,
   AI Agentic chunks/embeds/stores VectorDocument records.
5. **Auth centralized in HR Core** — Issues JWTs. Other services validate via shared secret.
6. **ContractAmendment in HR Core** — Manager submits amendments (position, salary, type, team).
   HR Admin approves. On approval, cascades to Employee + SalaryHistory. Career Agent assists
   form creation (Pull only): pre-fills justification, flags anomalies (>40% raise, demotion).
7. **PerformanceReview standalone** — Owns review cycles only. SalaryHistory stays with Employee
   (compensation lifecycle). Career Agent consumes `performance.review_completed` for analysis.
8. **Organization extracted** — Department, Team, Position as distinct org-structure module,
   queried independently by Analytics Agent (org-chart) and Org Scenario Analyzer.

---

## 7. AI Agent Architecture

### 7 Agents (LangGraph Stateful Graphs)

| Agent                 | Purpose                                        | Calls      | Trigger      |
|-----------------------|------------------------------------------------|------------|--------------|
| HR Assistant          | Dual-namespace RAG Q&A + inline citations      | HR, Social | Pull         |
| Leave Agent           | Context-aware leave + risk assessment          | HR         | Pull -> Push |
| Career Agent          | Profile analysis, interview prep               | HR         | Pull         |
| Linguistic Agent      | Professional reformulation                     | None (LLM) | Pull        |
| Analytics Agent       | Text-to-SQL + org-scenario sub-graph           | HR (read)  | Pull         |
| Engagement Agent      | Feedback synthesis + exit survey coordination  | Social     | Push         |
| Onboarding Companion  | Probation lifecycle support & check-ins        | HR         | Push         |

### ToolRegistry (Agent -> Service Boundary)

All agents access services through `src/tools/tool-registry.ts` which wraps REST clients
as LangGraph tools. Tool groups: LeaveTools, EmployeeTools, SkillTools, DocumentTools,
FeedbackTools, AnalyticsTools, OrgScenarioTools, ExitSurveyTools, RegulationTools.

**Every tool call:**
1. Uses AgentContext (jwt + claims + isSystemContext)
2. Logged in AgentTaskLog with parentLogId chain
3. Scope-filtered by target service
4. On HTTP 403: GracefulDegradationHandler returns AgentDegradationResult (never throws)

---

## 8. Enum Registry

All 32 enums in `packages/shared/src/enums/`, used by all services + frontend.

**Core enums:**
- `AgentType`: HR_ASSISTANT, LEAVE_AGENT, CAREER_AGENT, LINGUISTIC_AGENT, ANALYTICS_AGENT, ENGAGEMENT_AGENT, ONBOARDING_COMPANION
- `PermissionScope`: OWN, TEAM, DEPARTMENT, GLOBAL
- `ChannelType`: WEB, SLACK, WHATSAPP, EMAIL, IN_APP
- `EmploymentStatus`: ACTIVE, ON_LEAVE, PROBATION, TERMINATED
- `LeaveStatus`: PENDING, APPROVED, REJECTED, CANCELLED, ESCALATED
- `AmendmentStatus`: DRAFT, PENDING_HR, APPROVED, REJECTED
- `TaskTrigger`: USER, SYSTEM, SCHEDULE, AGENT_CHAIN
- `TaskStatus`: PENDING, RUNNING, SUCCESS, FAILED, DEGRADED, PARTIAL
- `ServiceName`: HR_CORE, SOCIAL, AI_AGENTIC

**Feature enums:**
- `ExitSurveyStatus`: PENDING, SENT, COMPLETED, EXPIRED, CANCELLED
- `ExitSurveyQuestionKey`: REASON_FOR_LEAVING, MANAGER_RATING, TEAM_CULTURE_RATING, GROWTH_OPPORTUNITY_RATING, WOULD_RECOMMEND_COMPANY, OPEN_FEEDBACK
- `OrgScenarioStatus`: DRAFT, PENDING_AI, ANALYZED, APPROVED, REJECTED, APPLIED
- `DocumentSourceType`: INTERNAL_POLICY, EXTERNAL_REGULATION
- `PerformanceRating`: EXCEPTIONAL, EXCEEDS_EXPECTATIONS, MEETS_EXPECTATIONS, NEEDS_IMPROVEMENT, UNSATISFACTORY

---

## 9. Agent Context & Graceful Degradation

### AgentContext

All 7 agents use `AgentContext` (from `packages/shared/src/auth/agent-context.interface.ts`):

```typescript
interface AgentContext {
  jwt: string;              // Forwarded from original HTTP request
  claims: JwtPayload;       // Decoded once at conversation start
  isSystemContext: boolean;  // true for SYSTEM/SCHEDULE tasks
  taskLogId: string;        // Parent AgentTaskLog ID for child grouping
}
```

Every agent graph state includes `agentContext`. Every REST client method accepts
`context: AgentContext` (never raw `jwt: string`). Built by `AgentContextFactory`:
- `fromRequest()` for user-initiated conversations
- `forSystemTask()` mints short-lived SYSTEM JWT (5 min, signed with SYSTEM_JWT_SECRET)

### Graceful Degradation

On HTTP 403, `GracefulDegradationHandler` returns `AgentDegradationResult` — does NOT throw.
Graph continues with reduced context. AgentTaskLog.status = DEGRADED (visible in Governance
Center). Example: EMPLOYEE's Leave Agent can't check team availability -> explains limitation,
still submits the request.

### System JWT

```typescript
interface SystemJwtPayload {
  sub: 'system'; roles: ['SYSTEM']; scope: 'GLOBAL';
  taskType: string;  // e.g. 'exit_survey_dispatch'
  exp: number;       // 5 minutes max
}
```

Used by: exit survey dispatch, engagement snapshots, regulation seeding, org scenario amendments.
Only `AgentContextFactory.forSystemTask()` may create these. Social and HR Core must explicitly
allow SYSTEM role on endpoints called by scheduled agents.

---

## 10. Exit Survey Security

**Problem:** Terminated employees have revoked JWTs but must complete exit surveys.

**Solution:** Scoped survey token (NOT a JWT bypass) — purpose-built, time-limited (14 days),
stored hashed in `ExitSurvey.surveyTokenHash`. Validates one specific survey only.
`POST /api/social/exit-surveys/:id/respond` has no `@UseGuards(SharedJwtGuard)`.

**Anonymization contract:**
1. `ExitSurveyResponse` never stores `employeeId`
2. `ExitSurvey.respondentId` nulled before emitting `exit_survey.completed`
3. `GET /aggregate` returns only aggregated stats
4. HR Admin list shows metadata only, not responses

**Env vars:** `SURVEY_TOKEN_SECRET`, `SURVEY_TOKEN_EXPIRY_DAYS=14`,
`SYSTEM_JWT_SECRET`, `SYSTEM_JWT_EXPIRY=5m`

---

## 11. Dual-Namespace RAG Retrieval

HR Assistant queries two namespaces of VectorDocument:
- `INTERNAL_POLICY` — chunked from Social's Document uploads
- `EXTERNAL_REGULATION` — chunked from `apps/ai-agentic/seeds/regulations/` (Algerian Labour Code)

**Flow:** Query -> `routeToNamespaces` (LLM classifies) -> `getEmployeeRegion` (extracts ISO code)
-> parallel pgvector ANN searches (filter by sourceType + regulationRegion first, then ANN)
-> merge by score -> synthesize with inline citations.

**Hybrid query:** Filter FIRST (sourceType + regulationRegion indexes), then ANN on filtered subset.
`@@index([sourceType])` and `@@index([regulationRegion])` enable this.

**Seed data:** `apps/ai-agentic/seeds/regulations/` contains public domain Algerian Labour Code
texts (dz-labour-code-leave.txt, dz-labour-code-termination.txt, etc.). Processed by
`ChunkerService` + `EmbedderService` during `seedRegulations()`.

---

## 12. Project Timeline (6-Month FYP)

| Month | Focus | Deliverables |
|-------|-------|-------------|
| 1 | Analysis, design, architecture | Class diagram, CLAUDE.md, Prisma schemas, monorepo, docker-compose |
| 2 | HR Core backend | All 11 HR Core modules, RBAC, seed data, API endpoints |
| 3 | Social service + Frontend | Social modules, Next.js frontend, dashboards, gateway |
| 4 | AI Agentic — HR Assistant | RAG pipeline, HR Assistant agent, multi-channel, conversations |
| 5 | Remaining agents | Leave, Career, Engagement, Linguistic, Analytics agents |
| 6 | Security, testing, Kafka prep | E2E tests, security audit, Kafka EventBus stub, report |

---

## 13. Output Requirements

When generating code or architecture, **always provide**:

1. **Which service** (HR Core / Social / AI Agentic)
2. **TypeScript interfaces** for relevant entities
3. **Modular NestJS architecture** (Module -> Controller -> Service)
4. **Prisma schema snippets** with correct `@@schema()` annotation
5. **Inter-service calls** — does it need another service?
6. **Domain events** — emits or consumes?
7. **RBAC considerations** — roles and scopes
8. **Agent integration points** — how would an agent automate this?

---

## 14. Key File References

- `sentient-class-diagram-spec.md` — Complete entity class diagram
- `Pfe___Sentient_Hris_document_De_Projet_Detaille.pdf` — FYP project document
- `probation-class-diagram.drawio` — Probation domain (3 entities, 4 enums, state machine)
- `domains/probation_management.drawio` — Probation use case diagram
- `rules/code-style.md` — TypeScript, NestJS, Prisma, frontend conventions
- `rules/security.md` — RBAC, AI Governance, inter-service auth, data privacy, RBAC matrices
- `rules/testing.md` — Testing pyramid, contract tests, agent tests
