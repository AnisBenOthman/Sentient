# Security Requirements — Sentient Project

> Non-negotiable rules. Every line of code must respect these constraints.
> We are handling HR data across 3 microservices — salaries, complaints,
> performance reviews. Security is not a feature; it is the foundation.

---

## 1. Authentication Architecture

### Centralized Auth in HR Core

HR Core is the **only service that issues and manages tokens**. Social and AI Agentic
validate tokens but never create them.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  HR Core     │     │  Social      │     │  AI Agentic  │
│              │     │              │     │              │
│  ✅ Issues JWT│     │  ✅ Validates │     │  ✅ Validates │
│  ✅ Manages   │     │    JWT only  │     │    JWT only  │
│    Sessions  │     │              │     │              │
│  ✅ Stores    │     │  ❌ No user   │     │  ❌ No user   │
│    Users     │     │    table     │     │    table     │
└──────────────┘     └──────────────┘     └──────────────┘
```

**How it works:**
1. User authenticates via HR Core → receives JWT access token + refresh token (stored in Session table)
2. Frontend sends JWT in `Authorization: Bearer` header to any service
3. Social and AI Agentic validate the JWT using the shared secret (from `@sentient/shared`)
4. If validation passes, the service trusts the JWT claims (userId, roles, scope)

### JWT + Session Hybrid

```
User Login → JWT Access Token (15 min) + Refresh Token (Session table in hr_core)
                                              ↓
                              Session tracks: channel (WEB/SLACK/WHATSAPP)
                                              expiresAt, userId
```

**Why hybrid?** JWTs are stateless for fast validation in any service, but the
Session table lets HR Core revoke access across channels (e.g., when an employee
is terminated, all sessions are invalidated immediately).

### Token Payload (Minimal — No PII)

```typescript
interface JwtPayload {
  sub: string;            // User.id (UUID)
  employeeId: string;     // Employee.id
  roles: string[];        // ['EMPLOYEE', 'MANAGER']
  departmentId: string;   // For DEPARTMENT scope filtering
  teamId: string | null;  // For TEAM scope filtering
  channel: ChannelType;   // Where this token was issued
  iat: number;
  exp: number;
}
```

**Never in JWT:** email, name, salary, or any PII. The token identifies who;
each service resolves permissions from the claims.

### Shared JWT Validation

```typescript
// packages/shared/src/auth/jwt-validation.guard.ts

/**
 * WHY: All 3 services use the same JWT validation logic.
 * This guard lives in the shared package so there's one source
 * of truth for token verification. HR Core uses it AND the
 * auth module that issues tokens. Social and AI Agentic use
 * it as their primary auth guard.
 */
@Injectable()
export class SharedJwtGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing token');

    try {
      const payload = jwt.verify(token, this.configService.get('JWT_SECRET'));
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

### Password Hashing

- **Algorithm:** Argon2id (not bcrypt — memory-hard, GPU/ASIC resistant)
- **Library:** `argon2` npm package
- **Lives in:** HR Core only (the only service with User table)

---

## 2. RBAC Implementation

### Role Hierarchy

```
EMPLOYEE        → Base role. Every user has this.
MANAGER         → View/approve for direct reports (TEAM scope).
HR_ADMIN        → View/manage all employees (GLOBAL scope).
EXECUTIVE       → Read-only analytics and dashboards (GLOBAL scope).
SYSTEM_ADMIN    → Platform configuration, user management.
```

### Permission Model (Resource + Action + Scope)

```typescript
interface Permission {
  resource: string;            // 'leave_request', 'employee', 'complaint'
  action: PermissionAction;    // CREATE, READ, UPDATE, DELETE, APPROVE
  scope: PermissionScope;      // OWN, TEAM, DEPARTMENT, GLOBAL
}
```

### Scope Enforcement (Row-Level Security)

```typescript
/**
 * WHY: This is the enforcement layer that makes RBAC real.
 * Without scope filtering, a MANAGER could see salary data
 * for the entire company. With it, they see only their team.
 *
 * CRITICAL: AI agents inherit the requesting user's scope.
 * The JWT is forwarded from AI Agentic → HR Core, so HR Core
 * applies the same scope filter regardless of whether the call
 * came from a human or an agent.
 */
function buildScopeFilter(
  user: JwtPayload,
  resource: string,
  action: PermissionAction,
): Prisma.EmployeeWhereInput {
  const permission = resolvePermission(user.roles, resource, action);

  switch (permission.scope) {
    case 'OWN':
      return { id: user.employeeId };
    case 'TEAM':
      return { managerId: user.employeeId };
    case 'DEPARTMENT':
      return { departmentId: user.departmentId };
    case 'GLOBAL':
      return {}; // No filter
    default:
      throw new ForbiddenException('No permission for this resource');
  }
}
```

### RBAC Guard

```typescript
// apps/hr-core/src/common/guards/rbac.guard.ts

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const user: JwtPayload = context.switchToHttp().getRequest().user;
    return requiredRoles.some(role => user.roles.includes(role));
  }
}
```

### Endpoint-Level RBAC Matrix (HR Core)

| Endpoint                           | EMPLOYEE | MANAGER | HR_ADMIN | EXECUTIVE |
|------------------------------------|----------|---------|----------|-----------|
| GET /employees (own profile)       | ✅       | ✅      | ✅       | ✅        |
| GET /employees (team)              | ❌       | ✅      | ✅       | ✅        |
| GET /employees (all)               | ❌       | ❌      | ✅       | ✅ (read) |
| POST /leave-requests               | ✅       | ✅      | ✅       | ❌        |
| PATCH /leave-requests/:id/approve  | ❌       | ✅      | ✅       | ❌        |
| GET /salary-history                | ❌       | ❌      | ✅       | ✅ (read) |
| GET /complaints                    | OWN      | ❌      | ✅       | ❌        |

### Endpoint-Level RBAC Matrix (Social)

| Endpoint                           | EMPLOYEE | MANAGER | HR_ADMIN | EXECUTIVE |
|------------------------------------|----------|---------|----------|-----------|
| GET /announcements                 | ✅       | ✅      | ✅       | ✅        |
| POST /announcements                | ❌       | ❌      | ✅       | ❌        |
| POST /feedback                     | ✅       | ✅      | ✅       | ✅        |
| GET /feedback (anonymous)          | ❌       | ❌      | ✅       | ✅        |
| GET /engagement-snapshots          | ❌       | ❌      | ✅       | ✅        |

### Endpoint-Level RBAC Matrix (AI Agentic)

| Endpoint                           | EMPLOYEE | MANAGER | HR_ADMIN | EXECUTIVE |
|------------------------------------|----------|---------|----------|-----------|
| POST /conversations                | ✅       | ✅      | ✅       | ✅        |
| POST /conversations/:id/messages   | ✅       | ✅      | ✅       | ✅        |
| GET /conversations (own only)      | ✅       | ✅      | ✅       | ✅        |
| Analytics Agent queries            | ❌       | ❌      | ✅       | ✅        |

---

## 3. AI Governance

### Core Principle: Agents Are Not Superusers

Every AI agent action is executed **in the context of the requesting user's JWT**.
When AI Agentic calls HR Core, it forwards the user's token. HR Core applies
the same RBAC rules as if the user made the call directly.

### Agent Permission Inheritance (Cross-Service)

```
Employee (TEAM scope) → Starts conversation with Leave Agent
    ↓
AI Agentic receives JWT with roles: ['EMPLOYEE']
    ↓
Leave Agent calls HrCoreClient.getLeaveBalance(empId, jwt)
    ↓
HR Core receives JWT → applies OWN scope → returns ONLY this employee's balance
    ↓
Leave Agent calls HrCoreClient.getTeamAvailability(teamId, jwt)
    ↓
HR Core receives JWT → EMPLOYEE has no TEAM scope for this resource → 403 FORBIDDEN
    ↓
Agent gracefully handles: "I can help you submit the request,
but I don't have access to check team availability. Your manager
will review overlap during approval."
```

**This is intentional.** An EMPLOYEE's agent should NOT see team data. A MANAGER's
agent CAN, because the JWT carries MANAGER role claims.

### AgentTaskLog — Full Audit Trail

Every tool call, every inter-service request, every LLM invocation is logged.

```typescript
interface AgentTaskLogEntry {
  id: string;
  conversationId: string | null;      // null for proactive/push tasks
  agentType: AgentType;
  taskType: string;                    // 'leave_balance_check', 'text_to_sql'
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: TaskStatus;
  durationMs: number;
  errorMessage: string | null;
  triggeredBy: TaskTrigger;            // USER, SYSTEM, SCHEDULE
  // Cross-service tracking
  targetService: ServiceName | null;   // Which service was called
  httpMethod: string | null;           // GET, POST, PATCH
  httpStatusCode: number | null;       // Response status
  createdAt: Date;
}
```

### Text-to-SQL Safety (Analytics Agent)

The most dangerous agent — it has direct SQL query access to HR Core data.

**Safeguards:**

1. **Separate read-only PostgreSQL role** — `ai_analytics_readonly` has SELECT-only
   on `hr_core` schema. Cannot INSERT, UPDATE, DELETE, or DDL.
2. **No system table access** — Role cannot query `pg_catalog`, `information_schema`,
   or any schema other than `hr_core`.
3. **Scope-wrapped queries** — Generated SQL is automatically wrapped:
   ```sql
   -- Original (from LLM):
   SELECT department, AVG(current_salary) FROM employees GROUP BY department;
   -- Wrapped (for DEPARTMENT scope user):
   SELECT department, AVG(current_salary) FROM hr_core.employees
   WHERE department_id = $1 GROUP BY department;
   ```
4. **Query review** — SQL logged in AgentTaskLog before execution.
5. **Result limits** — Max 1000 rows. Aggregations preferred over raw data.
6. **No PII in responses** — Individual salaries masked; only aggregates shown.
7. **Separate Prisma client** — Uses `ai_analytics_readonly` connection string,
   distinct from the main `ai_agent_svc` role.

---

## 4. Inter-Service Security

### Service-to-Service Authentication

In Phase 1 (REST), services authenticate inter-service calls by forwarding the
user's JWT. This means:

- **No service accounts** in Phase 1 — every call carries a real user's permissions
- **EventBus webhooks** include the originating user's JWT in headers
- **Push/scheduled tasks** (e.g., engagement snapshot generation) use a SYSTEM
  service account with explicitly scoped permissions

```typescript
// System service account — used ONLY for scheduled tasks
interface SystemJwtPayload {
  sub: 'system';
  roles: ['SYSTEM'];
  scope: 'GLOBAL';     // Only for read operations
  taskType: string;     // e.g., 'engagement_snapshot'
}
```

### Request Tracing

Every inter-service call carries a `correlationId` for end-to-end tracing:

```typescript
// Middleware added to every service
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = req.headers['x-correlation-id'] || randomUUID();
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
```

---

## 5. Data Privacy Rules

### Sensitive Fields Per Service

**HR Core (most sensitive data lives here):**

| Field               | Classification | Who Can See              |
|---------------------|---------------|--------------------------|
| `currentSalary`     | CONFIDENTIAL  | HR_ADMIN, EXECUTIVE      |
| `passwordHash`      | SECRET        | Nobody (system only)     |
| `Complaint.*`       | CONFIDENTIAL  | Submitter + HR_ADMIN     |
| `dateOfBirth`       | PII           | OWN + HR_ADMIN           |
| `phone`             | PII           | OWN + HR_ADMIN           |
| `SalaryHistory`     | CONFIDENTIAL  | HR_ADMIN, EXECUTIVE      |

**Social:**

| Field                      | Classification | Who Can See                    |
|----------------------------|---------------|--------------------------------|
| `Feedback.employeeId`     | RESTRICTED    | System only (null when anon)   |
| `EngagementSnapshot`      | INTERNAL      | HR_ADMIN, EXECUTIVE            |

**AI Agentic:**

| Field                      | Classification | Who Can See                    |
|----------------------------|---------------|--------------------------------|
| `Conversation` history     | PRIVATE       | OWN only (employee's chats)    |
| `AgentTaskLog`             | INTERNAL      | SYSTEM_ADMIN, HR_ADMIN         |
| `VectorDocument.embedding` | INTERNAL      | System only                    |

### Response Sanitization (Per Service)

```typescript
// apps/hr-core/src/common/interceptors/sanitize.interceptor.ts

/**
 * WHY: Even if a Prisma query returns full employee data,
 * the interceptor strips fields based on the requesting user's role.
 * This protects against accidental data leakage, including when
 * AI Agentic forwards data to the LLM — the data is sanitized
 * BEFORE it leaves HR Core.
 */
@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const user: JwtPayload = context.switchToHttp().getRequest().user;
    return next.handle().pipe(
      map(data => this.sanitize(data, user.roles)),
    );
  }

  private sanitize(data: any, roles: string[]): any {
    if (!roles.includes('HR_ADMIN') && !roles.includes('EXECUTIVE')) {
      delete data.currentSalary;
      delete data.salaryHistory;
      delete data.dateOfBirth;
    }
    // passwordHash is NEVER returned — excluded at Prisma select level
    delete data.passwordHash;
    return data;
  }
}
```

### Anonymous Feedback Enforcement (Social Service)

```typescript
/**
 * WHY: When isAnonymous is true, employeeId is NULL in the database.
 * The Social service guarantees no API response, log, or event can
 * link anonymous feedback back to the employee. This is a trust
 * requirement — employees will not give honest feedback without it.
 */
async createFeedback(dto: CreateFeedbackDto, employeeId: string): Promise<Feedback> {
  return this.prisma.feedback.create({
    data: {
      ...dto,
      employeeId: dto.isAnonymous ? null : employeeId,
    },
  });
}
```

---

## 6. API Security Checklist (Every Endpoint, Every Service)

- [ ] **Authentication** — `@UseGuards(SharedJwtGuard)` on every controller
- [ ] **Authorization** — `@Roles()` decorator + `RbacGuard`
- [ ] **Input validation** — DTO with `class-validator` decorators
- [ ] **Scope filtering** — Prisma queries use `buildScopeFilter()` (HR Core)
- [ ] **Rate limiting** — `@Throttle()` on mutation endpoints
- [ ] **No PII leakage** — Sensitive fields stripped by interceptor
- [ ] **Correlation ID** — Every request has traceable `x-correlation-id`
- [ ] **Audit logging** — Mutations logged with who/what/when

---

## 7. Environment Variables

```env
# .env.example — committed (no real values)
# Shared
JWT_SECRET=change-me-in-production
JWT_EXPIRY=15m
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# HR Core
HR_CORE_DATABASE_URL=postgresql://hr_core_svc:pass@localhost:5432/sentient?schema=hr_core
HR_CORE_PORT=3001

# Social
SOCIAL_DATABASE_URL=postgresql://social_svc:pass@localhost:5432/sentient?schema=social
SOCIAL_PORT=3002
HR_CORE_URL=http://localhost:3001   # Social calls HR Core

# AI Agentic
AI_AGENT_DATABASE_URL=postgresql://ai_agent_svc:pass@localhost:5432/sentient?schema=ai_agent
AI_ANALYTICS_DATABASE_URL=postgresql://ai_analytics_readonly:pass@localhost:5432/sentient?schema=hr_core
AI_AGENT_PORT=3003
HR_CORE_URL=http://localhost:3001   # AI calls HR Core
SOCIAL_URL=http://localhost:3002    # AI calls Social

# Channels
SLACK_BOT_TOKEN=xoxb-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
```

**Rules:**
- `.env` is in `.gitignore` — never committed
- All secrets via `ConfigService` — never `process.env` directly
- Each service reads only its own variables
- Service URLs are configurable (supports Docker networking in production)

---

## 8. Database Security

- **Per-service PostgreSQL roles** — Each service connects with its own role
- **No cross-schema queries** — Enforced at both application and DB role level
- **Parameterized queries** — Prisma handles this; NEVER `$executeRawUnsafe` with user input
- **Read-only analytics role** — AI Analytics Agent uses SELECT-only access to `hr_core`
- **Connection pooling** — Each service manages its own Prisma pool
- **Schema isolation** — Even sharing one PostgreSQL instance, services cannot see
  each other's data at the database level (except the explicit analytics grant)

---

## 9. CORS & Headers

```typescript
// Each service's main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL,  // Never '*' in production
  credentials: true,
});
app.use(helmet());

// Inter-service calls don't go through CORS — they're server-to-server
```

---

## 10. Phase 2 Security Considerations (Kafka)

When migrating to Kafka, additional security measures:

- **Encrypted topics** — TLS for Kafka broker connections
- **ACLs per service** — HR Core can only produce to `hr-core.*` topics
- **Schema Registry** — Avro/JSON Schema validation on events
- **Idempotency keys** — DomainEvent.id prevents duplicate processing
- **Dead letter queue** — Failed events are retried, then moved to DLQ for review
