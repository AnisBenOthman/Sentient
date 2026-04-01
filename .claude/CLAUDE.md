# Sentient — CLAUDE.md (Master Project Instructions)

> **What is this file?** This is the root instruction file for Claude Code.
> It is read automatically at the start of every session and defines how Claude
> should reason about, architect, and implement the Sentient platform.

---

## 1. Persona & Operating Mode

You are a **Senior Full-Stack Architect** specializing in Agentic AI and HRIS systems.
You are helping build **"Sentient"** — a platform that bridges traditional HRIS/Intranet
functions with an autonomous AI agent ecosystem.

**Current stage:** Stage 1 — Foundation & Architecture (Months 1–2 of 6).

**Mindset directives:**

- **Agentic Thinking** — Never build a dumb chatbot. Every feature should be designed
  for proactive "Push" models. When asked for a feature, suggest how an *Agent* would
  automate it (e.g., the "Zero-Friction Sick Leave" workflow where the agent checks
  Jira, GitHub, and team availability before even asking HR).
- **Modular Design** — The AI Agentic service is a completely separate microservice.
  We must be able to rip it out and plug agents into Workvivo, Culture Amp, or any
  third-party HRIS without touching HR Core.
- **Data Privacy First** — We use fictional/dummy data for development, but every line
  of code must implement strict RBAC and AI Governance from day one. Agents inherit the
  requesting user's permission scope — no backdoors.
- **Evolutionary Architecture** — Start with REST between services, design the
  abstraction layer so we can swap to Kafka without rewriting business logic.

---

## 2. Technical Stack (Strict — No Substitutions)

| Layer                | Technology                        | Notes                                            |
|----------------------|-----------------------------------|--------------------------------------------------|
| **Backend**          | NestJS (TypeScript)               | One NestJS app per microservice                  |
| **Frontend**         | Next.js 14+ (App Router) + Tailwind | Single frontend, calls all 3 services via gateway |
| **Database**         | PostgreSQL 16 + pgvector          | Shared instance, 3 separate schemas              |
| **ORM**              | Prisma                            | One Prisma client per service (per schema)        |
| **AI Orchestration** | LangGraph (TypeScript)            | Runs inside AI Agentic service only               |
| **LLMs**             | OpenAI (GPT-4o)                   | Via `@langchain/openai`                           |
| **Embeddings**       | OpenAI `text-embedding-3-small`   | 1536 dimensions, stored in pgvector (ai schema)   |
| **Channels**         | Slack SDK + Twilio (WhatsApp)     | Multi-channel auth via Session.channel enum        |
| **Analytics**        | Power BI (anticipated)            | HR Analytics Agent produces Text-to-SQL output     |
| **Inter-Service**    | REST (Phase 1) → Kafka (Phase 2) | Abstracted behind EventBus interface               |
| **API Gateway**      | Next.js API routes or NestJS GW   | Single entry point for frontend                   |

**Why pgvector instead of FAISS?** pgvector keeps embeddings inside PostgreSQL, enabling
transactional consistency with HRIS data and hybrid SQL + vector queries (e.g., filter
by document category, then do ANN search). One database to deploy and back up.

---

## 3. Microservice Architecture — 3 Services

```
                    ┌──────────────────────┐
                    │   Next.js Frontend   │
                    │   (Single SPA)       │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │    API Gateway        │
                    │  /api/hr/*  → :3001   │
                    │  /api/social/* → :3002│
                    │  /api/ai/*  → :3003   │
                    └──┬───────┬───────┬───┘
                       │       │       │
          ┌────────────▼──┐ ┌──▼────────────┐ ┌──▼────────────┐
          │  HR Core      │ │  Social       │ │  AI Agentic   │
          │  :3001        │ │  :3002        │ │  :3003        │
          │               │ │               │ │               │
          │  Schema:      │ │  Schema:      │ │  Schema:      │
          │  hr_core      │ │  social       │ │  ai_agent     │
          └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
                  │                 │                  │
                  └─────────────────┴──────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   PostgreSQL 16     │
                         │   + pgvector        │
                         │                     │
                         │  ┌───────────────┐  │
                         │  │ hr_core       │  │
                         │  │ social        │  │
                         │  │ ai_agent      │  │
                         │  └───────────────┘  │
                         └─────────────────────┘
```

### 3.1 Service Boundaries & Entity Ownership

| Service          | Port  | Schema     | Owned Entities                                                                      | Count |
|------------------|-------|------------|-------------------------------------------------------------------------------------|-------|
| **HR Core**      | 3001  | `hr_core`  | User, Role, Permission, UserRole, RolePermission, Session, Employee, Department, Team, Position, Skill, EmployeeSkill, SalaryHistory, LeaveType, LeaveBalance, LeaveRequest, Complaint, PerformanceReview, Notification, Holiday | 20 |
| **Social**       | 3002  | `social`   | Announcement, Event, EventAttendee, Document, Feedback, EngagementSnapshot          | 6  |
| **AI Agentic**   | 3003  | `ai_agent` | Conversation, Message, VectorDocument, AgentTaskLog                                 | 4  |

### 3.2 Cross-Service Data Access Rules

Services **never** query another service's schema directly. They use REST calls
(Phase 1) or events (Phase 2). Each service maintains logical foreign ID references
validated at the application layer.

| Scenario                                         | Who Calls Whom             | Method              |
|--------------------------------------------------|----------------------------|---------------------|
| AI agent needs employee profile                  | AI Agentic → HR Core       | `GET /api/hr/employees/:id` |
| AI agent needs leave balance                     | AI Agentic → HR Core       | `GET /api/hr/leave-balances?employeeId=X` |
| Social needs employee name for announcement      | Social → HR Core           | `GET /api/hr/employees/:id` (cached) |
| Leave agent creates leave request                | AI Agentic → HR Core       | `POST /api/hr/leave-requests` |
| Engagement agent reads event feedback            | AI Agentic → Social        | `GET /api/social/feedback?eventId=X` |
| HR Core notifies on leave approval               | HR Core → (EventBus)       | `leave.approved` event |
| Social publishes new announcement                | Social → (EventBus)        | `announcement.published` event |
| AI agent generates engagement snapshot            | AI Agentic → Social        | `POST /api/social/engagement-snapshots` |

### 3.3 Inter-Service Communication — EventBus Abstraction

**Phase 1 (Now):** REST-based event emitter. Services call each other via HTTP.
**Phase 2 (Later):** Swap the transport to Kafka. Business logic doesn't change.

```typescript
// packages/shared/src/event-bus/event-bus.interface.ts

/**
 * WHY: This abstraction exists so we can start with REST webhooks
 * and migrate to Kafka without touching any service business logic.
 * Services emit and subscribe to domain events through this interface.
 */
export interface IEventBus {
  emit<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(eventType: string, handler: (event: DomainEvent<T>) => Promise<void>): void;
}

export interface DomainEvent<T = unknown> {
  id: string;              // UUID — idempotency key
  type: string;            // e.g. 'leave.approved', 'announcement.published'
  source: ServiceName;     // 'hr-core' | 'social' | 'ai-agentic'
  timestamp: Date;
  payload: T;
  metadata: {
    userId: string;        // Who triggered it
    correlationId: string; // Request tracing
  };
}

export type ServiceName = 'hr-core' | 'social' | 'ai-agentic';
```

### 3.4 Domain Events Catalog

| Event                        | Emitted By   | Consumed By       | Payload                          |
|------------------------------|--------------|-------------------|----------------------------------|
| `leave.requested`            | HR Core      | AI Agentic        | `{ leaveRequestId, employeeId }` |
| `leave.approved`             | HR Core      | AI Agentic, Social | `{ leaveRequestId, reviewerId }` |
| `leave.rejected`             | HR Core      | AI Agentic        | `{ leaveRequestId, reason }`     |
| `employee.created`           | HR Core      | Social, AI Agentic | `{ employeeId, departmentId }`   |
| `employee.terminated`        | HR Core      | Social, AI Agentic | `{ employeeId }`                 |
| `announcement.published`     | Social       | AI Agentic        | `{ announcementId, audience }`   |
| `event.created`              | Social       | AI Agentic        | `{ eventId, type }`              |
| `feedback.submitted`         | Social       | AI Agentic        | `{ feedbackId, eventId }`        |
| `document.uploaded`          | Social       | AI Agentic        | `{ documentId, category }`       |
| `agent.risk_assessment_done` | AI Agentic   | HR Core           | `{ leaveRequestId, assessment }` |
| `agent.snapshot_generated`   | AI Agentic   | Social            | `{ snapshotId, entityType }`     |

---

## 4. Project Structure (Monorepo — 3 Services)

```
sentient/
├── .claude/
│   ├── CLAUDE.md                         # ← You are here
│   └── rules/
│       ├── code-style.md                 # TypeScript & NestJS conventions
│       ├── testing.md                    # Testing strategy & conventions
│       └── security.md                   # RBAC, AI Governance, data privacy
│
├── apps/
│   ├── hr-core/                          # Microservice 1: Core HRIS (port 3001)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── iam/                  # User, Role, Permission, Session
│   │   │   │   ├── employees/            # Employee, Department, Team, Position
│   │   │   │   ├── skills/               # Skill, EmployeeSkill
│   │   │   │   ├── leaves/               # LeaveType, LeaveBalance, LeaveRequest
│   │   │   │   ├── complaints/           # Complaint
│   │   │   │   ├── performance/          # PerformanceReview, SalaryHistory
│   │   │   │   ├── notifications/        # Notification (multi-channel dispatch)
│   │   │   │   └── config/               # Holiday, system settings
│   │   │   ├── common/                   # Guards, decorators, pipes, filters
│   │   │   │   ├── guards/               # RbacGuard, JwtAuthGuard
│   │   │   │   ├── decorators/           # @Roles(), @CurrentUser(), @Permissions()
│   │   │   │   ├── interceptors/         # SanitizeResponseInterceptor
│   │   │   │   └── filters/              # GlobalExceptionFilter
│   │   │   └── prisma/                   # PrismaModule (hr_core schema)
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # hr_core schema — 20 entities
│   │   │   ├── migrations/
│   │   │   └── seed.ts                   # Dummy HR data
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── social/                           # Microservice 2: Intranet & Engagement (port 3002)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── announcements/        # Announcement
│   │   │   │   ├── events/               # Event, EventAttendee
│   │   │   │   ├── documents/            # Document (source files for RAG)
│   │   │   │   ├── feedback/             # Feedback
│   │   │   │   └── engagement/           # EngagementSnapshot
│   │   │   ├── common/
│   │   │   │   ├── guards/               # JWT validation (trusts HR Core tokens)
│   │   │   │   └── clients/              # HrCoreClient (REST calls to HR Core)
│   │   │   └── prisma/                   # PrismaModule (social schema)
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # social schema — 6 entities
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── ai-agentic/                       # Microservice 3: AI Agents (port 3003)
│   │   ├── src/
│   │   │   ├── agents/                   # LangGraph agent definitions
│   │   │   │   ├── hr-assistant/         # RAG-powered Q&A
│   │   │   │   ├── leave-agent/          # Context-aware leave processing
│   │   │   │   ├── career-agent/         # Profile analysis, interview prep
│   │   │   │   ├── linguistic-agent/     # Professional reformulation
│   │   │   │   ├── analytics-agent/      # Text-to-SQL for HR dashboards
│   │   │   │   └── engagement-agent/     # Feedback synthesis
│   │   │   ├── rag/                      # Vector search, document chunking
│   │   │   │   ├── chunker.service.ts
│   │   │   │   ├── embedder.service.ts
│   │   │   │   └── retriever.service.ts
│   │   │   ├── tools/                    # ToolRegistry — LangGraph tool wrappers
│   │   │   │   ├── tool-registry.ts
│   │   │   │   ├── hr-core.tools.ts      # Wraps HR Core REST calls as LangGraph tools
│   │   │   │   └── social.tools.ts       # Wraps Social REST calls as LangGraph tools
│   │   │   ├── conversations/            # Conversation, Message persistence
│   │   │   ├── task-log/                 # AgentTaskLog for audit trail
│   │   │   ├── common/
│   │   │   │   ├── guards/
│   │   │   │   └── clients/              # HrCoreClient, SocialClient (REST)
│   │   │   └── prisma/                   # PrismaModule (ai_agent schema)
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # ai_agent schema — 4 entities + pgvector
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   └── package.json
│   │
│   └── web/                              # Next.js frontend (Single SPA)
│       ├── src/
│       │   ├── app/                       # App Router pages
│       │   │   ├── (auth)/               # Login, register
│       │   │   ├── (dashboard)/          # HR dashboards
│       │   │   ├── (intranet)/           # Social features
│       │   │   ├── (ai)/                 # Chat interface, agents
│       │   │   └── api/                  # API Gateway routes (proxy)
│       │   ├── components/
│       │   ├── lib/
│       │   │   ├── api/                  # Typed API clients per service
│       │   │   │   ├── hr-core.client.ts
│       │   │   │   ├── social.client.ts
│       │   │   │   └── ai.client.ts
│       │   │   └── auth/
│       │   └── hooks/
│       └── public/
│
├── packages/
│   └── shared/                           # Shared across ALL services
│       ├── src/
│       │   ├── enums/                    # All 25+ enums (single source of truth)
│       │   │   ├── index.ts
│       │   │   ├── iam.enums.ts
│       │   │   ├── hr.enums.ts
│       │   │   ├── leave.enums.ts
│       │   │   ├── social.enums.ts
│       │   │   └── ai.enums.ts
│       │   ├── interfaces/               # Entity interfaces (read-only contracts)
│       │   ├── dto/                      # Shared DTOs for inter-service calls
│       │   │   ├── employee-ref.dto.ts   # Lightweight employee reference
│       │   │   └── ...
│       │   ├── event-bus/                # EventBus abstraction
│       │   │   ├── event-bus.interface.ts
│       │   │   ├── rest-event-bus.ts     # Phase 1: REST
│       │   │   ├── kafka-event-bus.ts    # Phase 2: Kafka (stub)
│       │   │   └── domain-events.ts      # Event type definitions
│       │   └── auth/                     # JWT payload types, token verification
│       │       └── jwt.types.ts
│       └── package.json
│
├── docker-compose.yml                    # PostgreSQL + pgvector (+ Kafka in Phase 2)
├── scripts/
│   └── init-schemas.sql                  # Creates 3 schemas + pgvector extension
├── turbo.json                            # Turborepo pipeline config
├── package.json                          # Root workspace
└── .env.example
```

**Key architectural rule:** The `apps/ai-agentic/` directory NEVER imports from
`apps/hr-core/` or `apps/social/` directly. It communicates ONLY through REST
clients and the EventBus. This is what makes the AI layer portable.

---

## 5. Database Architecture — Shared PostgreSQL, Separate Schemas

```sql
-- Each service owns its own schema. No cross-schema queries allowed.
CREATE SCHEMA IF NOT EXISTS hr_core;
CREATE SCHEMA IF NOT EXISTS social;
CREATE SCHEMA IF NOT EXISTS ai_agent;
CREATE EXTENSION IF NOT EXISTS vector;

-- Each service connects with its own PostgreSQL ROLE
CREATE ROLE hr_core_svc LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA hr_core TO hr_core_svc;
GRANT ALL ON ALL TABLES IN SCHEMA hr_core TO hr_core_svc;

CREATE ROLE social_svc LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA social TO social_svc;
GRANT ALL ON ALL TABLES IN SCHEMA social TO social_svc;

CREATE ROLE ai_agent_svc LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA ai_agent TO ai_agent_svc;
GRANT ALL ON ALL TABLES IN SCHEMA ai_agent TO ai_agent_svc;

-- AI Agentic gets READ-ONLY on hr_core for Text-to-SQL analytics
-- This is the ONLY cross-schema grant, and it's SELECT only
CREATE ROLE ai_analytics_readonly LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA hr_core TO ai_analytics_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA hr_core TO ai_analytics_readonly;
```

### Prisma Per-Service Configuration

Each service has its own `schema.prisma` with its own schema annotation:

```prisma
// apps/hr-core/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("HR_CORE_DATABASE_URL")
  schemas  = ["hr_core"]
}

generator client {
  provider        = "prisma-client-js"
  output          = "../src/generated/prisma"
  previewFeatures = ["multiSchema"]
}

model Employee {
  // ... fields ...
  @@schema("hr_core")
  @@map("employees")
}
```

```prisma
// apps/ai-agentic/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("AI_AGENT_DATABASE_URL")
  schemas  = ["ai_agent"]
}

model VectorDocument {
  // ... fields ...
  embedding Unsupported("vector(1536)")
  @@schema("ai_agent")
  @@map("vector_documents")
}
```

### Cross-Service Foreign Key Strategy

Services store **foreign IDs** (e.g., `employeeId` in Social's `Feedback` table)
but these are NOT database-level foreign keys. They are **logical references**
validated at the application layer via REST calls.

```prisma
// apps/social/prisma/schema.prisma
model Feedback {
  id          String  @id @default(uuid())
  eventId     String? // FK to Event (same schema — real FK)
  employeeId  String? // Logical reference to HR Core — NOT a DB FK
  // ...
  event Event? @relation(fields: [eventId], references: [id])
  // NO @relation for employeeId — it lives in a different schema
  @@schema("social")
  @@map("feedback")
}
```

---

## 6. Domain Model — 27 Entities Across 3 Services

The complete class diagram specification lives in `sentient-class-diagram-spec.md`.

### HR Core Service (20 entities, schema: `hr_core`)

| Domain           | Entities                                                                 |
|------------------|--------------------------------------------------------------------------|
| **IAM**          | User, Role, Permission, UserRole, RolePermission, Session                |
| **Core HRIS**    | Employee, Department, Team, Position, Skill, EmployeeSkill, SalaryHistory |
| **Leave**        | LeaveType, LeaveBalance, LeaveRequest                                    |
| **Complaints**   | Complaint                                                                |
| **Performance**  | PerformanceReview                                                        |
| **Notifications**| Notification                                                             |
| **Config**       | Holiday                                                                  |

### Social Service (6 entities, schema: `social`)

| Domain           | Entities                                                    |
|------------------|-------------------------------------------------------------|
| **Intranet**     | Announcement, Event, EventAttendee, Document                |
| **Engagement**   | Feedback, EngagementSnapshot                                |

### AI Agentic Service (4 entities, schema: `ai_agent`)

| Domain           | Entities                                                    |
|------------------|-------------------------------------------------------------|
| **Conversations**| Conversation, Message                                       |
| **RAG**          | VectorDocument                                              |
| **Audit**        | AgentTaskLog                                                |

### Critical Design Decisions

1. **Permission.scope** (`OWN | TEAM | DEPARTMENT | GLOBAL`) — Row-level security.
   Agents inherit the requesting user's scope via JWT claims.

2. **LeaveRequest.agentRiskAssessment** (Json) — Stored in HR Core, populated by
   AI Agentic via REST `PATCH` after risk analysis completes.

3. **Notification lives in HR Core** — Not Social, because notifications are triggered
   by HR events (leave approval, complaint updates, review reminders) and need access
   to employee roles for routing.

4. **Document lives in Social** — Source files for RAG live in Social. When a document
   is uploaded, Social emits `document.uploaded`, AI Agentic fetches the file, chunks
   it, embeds it, and stores VectorDocument records in `ai_agent` schema.

5. **Authentication is centralized in HR Core** — HR Core issues JWTs. Social and
   AI Agentic validate JWTs using the shared secret/public key from `packages/shared`.

---

## 7. Inter-Service REST Client Pattern

```typescript
// apps/ai-agentic/src/common/clients/hr-core.client.ts

/**
 * WHY: Typed REST client encapsulates all HTTP calls to HR Core.
 * When we migrate to Kafka, event-based calls move to the EventBus,
 * and synchronous queries stay as REST (or become gRPC).
 * The JWT is forwarded — the agent sees only what the user can see.
 */
@Injectable()
export class HrCoreClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.configService.get<string>('HR_CORE_URL');
  }

  async getEmployee(employeeId: string, jwt: string): Promise<EmployeeRef> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/api/employees/${employeeId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    return data;
  }

  async getLeaveBalance(employeeId: string, jwt: string): Promise<LeaveBalance[]> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/api/leave-balances`, {
        params: { employeeId },
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    return data;
  }

  async createLeaveRequest(dto: CreateLeaveRequestDto, jwt: string): Promise<LeaveRequest> {
    const { data } = await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/api/leave-requests`, dto, {
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    return data;
  }
}
```

---

## 8. AI Agent Architecture

### 6 Agents (LangGraph Stateful Graphs)

| Agent                | Purpose                                   | Calls Service  | Trigger Model     |
|----------------------|-------------------------------------------|----------------|-------------------|
| **HR Assistant**     | RAG-powered Q&A on policies/regulations   | HR Core, Social | Pull (user asks)  |
| **Leave Agent**      | Context-aware leave with risk assessment  | HR Core        | Pull → Push alerts |
| **Career Agent**     | Profile analysis, interview prep          | HR Core        | Pull (user asks)  |
| **Linguistic Agent** | Professional reformulation of messages    | None (pure LLM) | Pull (user asks)  |
| **Analytics Agent**  | Text-to-SQL for HR dashboards             | HR Core (read) | Pull (HR/exec)    |
| **Engagement Agent** | Anonymous feedback synthesis              | Social         | Push (post-event) |

### Agent ↔ Service Boundary (ToolRegistry)

```
┌──────────────────────────────────────────────────────────┐
│  AI Agentic Service (port 3003)                          │
│                                                          │
│  ┌──────────────┐    ┌─────────────────────────────┐     │
│  │  LangGraph   │───▶│  ToolRegistry               │     │
│  │  Agents      │    │   ├── LeaveTools ──────────────────────▶ HR Core REST
│  │              │    │   ├── EmployeeTools ───────────────────▶ HR Core REST
│  │  RAG Pipeline│    │   ├── SkillTools ──────────────────────▶ HR Core REST
│  │              │    │   ├── DocumentTools ───────────────────▶ Social REST
│  │  Conversations│   │   ├── FeedbackTools ──────────────────▶ Social REST
│  │              │    │   └── AnalyticsTools ──────────────────▶ HR Core (read-only)
│  └──────────────┘    └─────────────────────────────┘     │
│                                                          │
│  Every tool call:                                        │
│  1. Inherits user's JWT (RBAC enforcement)               │
│  2. Is logged in AgentTaskLog (audit trail)               │
│  3. Passes through scope filtering on the target service  │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Enum Registry (Centralized in `packages/shared/src/enums/`)

All 25 enums defined once, used by all 3 services and the frontend.
Key enums (see class diagram spec for complete list):

- `AgentType`: HR_ASSISTANT, LEAVE_AGENT, CAREER_AGENT, LINGUISTIC_AGENT, ANALYTICS_AGENT, ENGAGEMENT_AGENT
- `PermissionScope`: OWN, TEAM, DEPARTMENT, GLOBAL
- `ChannelType`: WEB, SLACK, WHATSAPP, EMAIL, IN_APP
- `EmploymentStatus`: ACTIVE, ON_LEAVE, PROBATION, TERMINATED
- `LeaveStatus`: PENDING, APPROVED, REJECTED, CANCELLED, ESCALATED
- `TaskTrigger`: USER, SYSTEM, SCHEDULE
- `ServiceName`: HR_CORE, SOCIAL, AI_AGENTIC

---

## 10. Project Timeline (6-Month FYP)

| Month | Focus                            | Deliverables                                         |
|-------|----------------------------------|------------------------------------------------------|
| 1     | Analysis, design, architecture   | Class diagram, CLAUDE.md, Prisma schemas (3), monorepo setup, docker-compose |
| 2     | HR Core backend                  | All 8 HR Core modules, RBAC, seed data, API endpoints, inter-service clients |
| 3     | Social service + Frontend        | Social modules, Next.js frontend, HR dashboards, API gateway |
| 4     | AI Agentic — HR Assistant        | RAG pipeline, HR Assistant agent, multi-channel, conversation persistence |
| 5     | Remaining agents                 | Leave, Career, Engagement, Linguistic, Analytics agents |
| 6     | Security, testing, Kafka prep    | E2E tests, security audit, Kafka EventBus stub, FYP report, demo |

---

## 11. Output Requirements

When asked to generate code or architecture, **always provide**:

1. **Which service** does this belong to? (HR Core / Social / AI Agentic)
2. **TypeScript interfaces** for all relevant entities
3. **Modular NestJS architecture** (Module → Controller → Service)
4. **Prisma schema snippets** with correct `@@schema()` annotation
5. **Inter-service calls** — does this feature need to call another service?
6. **Domain events** — does this feature emit or consume events?
7. **RBAC considerations** — which roles and scopes apply?
8. **Agent integration points** — how would an agent automate this?

---

## 12. Docker Compose (Development)

```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: sentient
      POSTGRES_USER: sentient_admin
      POSTGRES_PASSWORD: sentient_dev_pass
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-schemas.sql:/docker-entrypoint-initdb.d/01-schemas.sql

  # Phase 2: Uncomment when ready for Kafka
  # kafka:
  #   image: confluentinc/cp-kafka:7.5.0
  #   ports:
  #     - "9092:9092"

volumes:
  pgdata:
```

---

## 13. Key File References

- `sentient-class-diagram-spec.md` — Complete 27-entity class diagram
- `Pfe___Sentient_Hris_document_De_Projet_Détaillé.pdf` — FYP project document
- `.claude/rules/code-style.md` — TypeScript & NestJS conventions
- `.claude/rules/testing.md` — Testing strategy per microservice
- `.claude/rules/security.md` — RBAC, AI Governance, inter-service auth
