# Testing Conventions — Sentient Project

> Testing strategy calibrated for a 6-month FYP with 3 microservices.
> Test what matters most: business logic, RBAC, agent behavior, and
> inter-service contracts.

---

## 1. Testing Pyramid (Per Microservice)

```
        ╱  E2E  ╲           ← Few: Critical user journeys (cross-service)
       ╱─────────╲
      ╱Integration╲         ← Moderate: Service + Prisma + own schema
     ╱─────────────╲
    ╱ Contract Tests ╲       ← Per boundary: Inter-service REST contracts
   ╱──────────────────╲
  ╱    Unit Tests       ╲    ← Many: Pure business logic, DTOs, utils
 ╱────────────────────────╲
```

| Layer          | What to test                                  | Tool              | Where             |
|----------------|-----------------------------------------------|-------------------|-------------------|
| **Unit**       | Services (mocked deps), DTOs, utils, enums    | Jest              | Each service      |
| **Contract**   | REST client ↔ server API shape agreement      | Jest + MSW/Nock   | Between services  |
| **Integration**| Service + real Prisma + service's own schema   | Jest + Prisma     | Each service      |
| **E2E**        | Full request through gateway → service → DB    | Jest + Supertest  | Cross-service     |
| **Agent**      | LangGraph state machine with mocked LLM        | Jest              | AI Agentic only   |

---

## 2. File Naming & Location

```
apps/hr-core/
├── src/modules/leaves/
│   ├── leaves.service.ts
│   ├── leaves.service.spec.ts          # Unit tests (co-located)
│   └── leaves.controller.spec.ts
├── test/
│   ├── integration/
│   │   └── leaves.integration.spec.ts  # Integration (real DB, hr_core schema)
│   ├── contracts/
│   │   └── leaves-api.contract.spec.ts # Contract: validates API shape
│   ├── fixtures/
│   │   ├── employee.fixture.ts
│   │   └── leave.fixture.ts
│   └── helpers/
│       ├── prisma-test.helper.ts       # Test DB setup for hr_core schema
│       └── auth-test.helper.ts

apps/ai-agentic/
├── src/agents/leave-agent/
│   ├── leave-agent.graph.ts
│   └── leave-agent.spec.ts            # Agent state machine tests
├── test/
│   ├── contracts/
│   │   └── hr-core-client.contract.spec.ts  # Validates HrCoreClient calls
│   └── helpers/
│       └── mock-llm.helper.ts          # Predictable LLM mock

test/                                    # Root-level cross-service E2E
├── e2e/
│   ├── leave-workflow.e2e-spec.ts      # Employee → Agent → HR Core
│   └── document-rag.e2e-spec.ts        # Upload → Social → AI chunking
└── helpers/
    └── test-services.helper.ts         # Starts all 3 services for E2E
```

---

## 3. Per-Service Test Database Setup

Each service tests against its own schema in a shared test database:

```typescript
// apps/hr-core/test/helpers/prisma-test.helper.ts

import { PrismaClient } from '../../src/generated/prisma';

/**
 * WHY: Each service tests against its OWN schema only.
 * HR Core tests never touch the social or ai_agent schemas.
 * This mirrors production isolation.
 */
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.HR_CORE_TEST_DATABASE_URL },
    // URL: postgresql://...?schema=hr_core
  },
});

export async function cleanHrCoreSchema(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'hr_core'
  `;
  for (const { tablename } of tables) {
    if (tablename === '_prisma_migrations') continue;
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE hr_core."${tablename}" CASCADE`,
    );
  }
}

export { prisma as testPrisma };
```

### Environment Setup

```env
# .env.test
HR_CORE_TEST_DATABASE_URL=postgresql://sentient_admin:pass@localhost:5432/sentient_test?schema=hr_core
SOCIAL_TEST_DATABASE_URL=postgresql://sentient_admin:pass@localhost:5432/sentient_test?schema=social
AI_AGENT_TEST_DATABASE_URL=postgresql://sentient_admin:pass@localhost:5432/sentient_test?schema=ai_agent
```

---

## 4. Unit Test Patterns

### Service Tests (Mocked Prisma + Mocked Inter-Service Clients)

```typescript
// apps/hr-core/src/modules/leaves/leaves.service.spec.ts

describe('LeavesService', () => {
  let service: LeavesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LeavesService,
        {
          provide: PrismaService,
          useValue: {
            leaveRequest: { create: jest.fn(), findMany: jest.fn() },
            leaveBalance: { findFirst: jest.fn(), update: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get(LeavesService);
    prisma = module.get(PrismaService);
  });

  it('should reject when balance is insufficient', async () => {
    prisma.leaveBalance.findFirst.mockResolvedValue({
      remainingDays: 2,
    } as any);

    await expect(
      service.create('emp-1', {
        leaveTypeId: 'lt-1',
        startDate: '2025-07-01',
        endDate: '2025-07-10', // 8 business days > 2 remaining
      }),
    ).rejects.toThrow('Insufficient leave balance');
  });
});
```

### Mocking Inter-Service Clients

```typescript
// apps/ai-agentic/src/agents/leave-agent/leave-agent.spec.ts

/**
 * WHY: When testing agents, we mock the REST clients (HrCoreClient,
 * SocialClient) to avoid real HTTP calls. The agent test verifies
 * the LangGraph state machine routes correctly — not that HTTP works.
 */
describe('LeaveAgent', () => {
  let hrCoreClient: jest.Mocked<HrCoreClient>;

  beforeEach(() => {
    hrCoreClient = {
      getEmployee: jest.fn(),
      getLeaveBalance: jest.fn(),
      createLeaveRequest: jest.fn(),
    } as any;
  });

  it('should check balance before creating request', async () => {
    hrCoreClient.getLeaveBalance.mockResolvedValue([
      { remainingDays: 10, leaveType: { name: 'Annual' } },
    ]);
    hrCoreClient.createLeaveRequest.mockResolvedValue({ id: 'lr-1' });

    const result = await runLeaveAgent({
      message: "I'd like to take leave July 1-5",
      employeeId: 'emp-1',
      hrCoreClient,
    });

    expect(hrCoreClient.getLeaveBalance).toHaveBeenCalledBefore(
      hrCoreClient.createLeaveRequest,
    );
  });
});
```

---

## 5. Contract Tests (Inter-Service Boundaries)

Contract tests verify that the REST client in one service agrees with
the API shape of the target service. They catch breaking changes early.

```typescript
// apps/ai-agentic/test/contracts/hr-core-client.contract.spec.ts

import nock from 'nock';
import { HrCoreClient } from '../../src/common/clients/hr-core.client';

/**
 * WHY: This contract test verifies that HrCoreClient's expectations
 * match what HR Core actually returns. If HR Core changes its API
 * response shape, this test fails — catching the break before E2E.
 *
 * Run these whenever HR Core API changes.
 */
describe('HrCoreClient Contract', () => {
  const HR_CORE_URL = 'http://localhost:3001';
  let client: HrCoreClient;

  beforeEach(() => {
    client = new HrCoreClient(/* ... */);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('GET /api/employees/:id returns expected shape', async () => {
    const mockResponse = {
      id: 'emp-1',
      firstName: 'Alice',
      lastName: 'Martin',
      email: 'alice@sentient.dev',
      departmentId: 'dept-eng',
      employmentStatus: 'ACTIVE',
    };

    nock(HR_CORE_URL)
      .get('/api/employees/emp-1')
      .reply(200, mockResponse);

    const result = await client.getEmployee('emp-1', 'fake-jwt');

    // Validate shape — these fields MUST exist
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('firstName');
    expect(result).toHaveProperty('departmentId');
    expect(result).toHaveProperty('employmentStatus');
  });

  it('GET /api/leave-balances returns array', async () => {
    nock(HR_CORE_URL)
      .get('/api/leave-balances')
      .query({ employeeId: 'emp-1' })
      .reply(200, [
        { id: 'lb-1', remainingDays: 15, leaveTypeId: 'lt-annual' },
      ]);

    const result = await client.getLeaveBalance('emp-1', 'fake-jwt');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('remainingDays');
  });
});
```

---

## 6. Integration Tests

```typescript
// apps/hr-core/test/integration/leaves.integration.spec.ts

describe('LeavesService (Integration)', () => {
  beforeAll(async () => {
    await cleanHrCoreSchema();
    // Seed: department, position, employee, leave type, leave balance
    await seedTestData(testPrisma);
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it('should create leave request and increment pendingDays', async () => {
    const result = await service.create('emp-test-1', {
      leaveTypeId: 'lt-annual',
      startDate: '2025-07-01',
      endDate: '2025-07-03',
    });

    expect(result.status).toBe('PENDING');

    const balance = await testPrisma.leaveBalance.findFirst({
      where: { employeeId: 'emp-test-1', leaveTypeId: 'lt-annual' },
    });
    expect(Number(balance!.pendingDays)).toBe(3);
  });
});
```

---

## 7. E2E Tests (Cross-Service)

```typescript
// test/e2e/leave-workflow.e2e-spec.ts

/**
 * WHY: E2E tests verify the full workflow across microservice boundaries.
 * This test starts all 3 services and validates the complete leave flow:
 * Employee submits via AI → Agent checks balance (HR Core) → Creates request.
 */
describe('Leave Workflow (E2E)', () => {
  let hrCoreApp: INestApplication;
  let aiApp: INestApplication;
  let employeeToken: string;

  beforeAll(async () => {
    hrCoreApp = await createTestApp('hr-core', 3001);
    aiApp = await createTestApp('ai-agentic', 3003);
    employeeToken = generateTestJwt({ role: 'EMPLOYEE', employeeId: 'emp-1' });
  });

  afterAll(async () => {
    await hrCoreApp.close();
    await aiApp.close();
  });

  it('should process leave request through AI agent', async () => {
    // 1. Start conversation with AI
    const convRes = await request(aiApp.getHttpServer())
      .post('/api/conversations')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ agentType: 'LEAVE_AGENT', channel: 'WEB' })
      .expect(201);

    // 2. Send leave request message
    const msgRes = await request(aiApp.getHttpServer())
      .post(`/api/conversations/${convRes.body.id}/messages`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ content: "I'd like to take leave July 1-3" })
      .expect(201);

    // 3. Verify leave request was created in HR Core
    const leaveRes = await request(hrCoreApp.getHttpServer())
      .get('/api/leave-requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .query({ status: 'PENDING' })
      .expect(200);

    expect(leaveRes.body).toHaveLength(1);
    expect(leaveRes.body[0].employeeId).toBe('emp-1');
  });
});
```

---

## 8. Agent Test Patterns (AI Agentic Service Only)

```typescript
// apps/ai-agentic/src/agents/leave-agent/leave-agent.spec.ts

/**
 * WHY: Agent tests verify the LangGraph STATE MACHINE behavior,
 * NOT the LLM output quality. We mock the LLM to return predictable
 * tool calls and verify correct routing through the graph.
 */
describe('LeaveAgent Graph', () => {
  it('should route to risk assessment when sprint overlap detected', async () => {
    const mockLlm = createMockLlm([
      { toolCall: 'checkLeaveBalance', args: { employeeId: 'emp-1' } },
      { toolCall: 'checkTeamAvailability', args: { teamId: 'team-1', dates: ['2025-07-01'] } },
      // LLM sees team lead is on leave → triggers risk assessment
      { toolCall: 'generateRiskAssessment', args: { riskLevel: 'HIGH' } },
    ]);

    const result = await runLeaveAgent(mockLlm, {
      message: "I'd like to take leave next week",
      employeeId: 'emp-1',
    });

    // Verify the graph visited the risk assessment node
    expect(result.visitedNodes).toContain('risk_assessment');
    expect(result.output.riskLevel).toBe('HIGH');
  });

  it('should skip risk assessment for sick leave', async () => {
    // Sick leave auto-approves — no sprint analysis needed
    const result = await runLeaveAgent(mockLlm, {
      message: "I'm feeling sick, need today off",
      employeeId: 'emp-1',
    });

    expect(result.visitedNodes).not.toContain('risk_assessment');
  });
});
```

---

## 9. Test Data Factories

```typescript
// apps/hr-core/test/fixtures/employee.fixture.ts

import { randomUUID } from 'crypto';

export function buildEmployee(overrides: Partial<EmployeeCreateInput> = {}) {
  const id = randomUUID();
  return {
    id,
    employeeCode: `EMP-${id.slice(0, 4).toUpperCase()}`,
    firstName: 'Test',
    lastName: 'Employee',
    email: `test-${id.slice(0, 8)}@sentient.dev`,
    hireDate: new Date('2024-01-15'),
    employmentStatus: 'ACTIVE',
    contractType: 'FULL_TIME',
    currentSalary: 65000,
    ...overrides,
  };
}
```

---

## 10. What NOT to Test (FYP Time Budget)

- ❌ Prisma client methods (they work — test your logic around them)
- ❌ NestJS framework internals
- ❌ Simple CRUD with zero business logic
- ❌ LLM response quality (prompt engineering ≠ testing)
- ❌ Slack/Twilio SDK internals

## 11. What to ALWAYS Test

- ✅ Business rules (leave balance math, permission scope filtering)
- ✅ RBAC enforcement (correct role → access, wrong role → 403)
- ✅ Inter-service contracts (client expects what server provides)
- ✅ Agent graph routing (tool call order, conditional branches)
- ✅ DTO validation (reject bad input at the boundary)
- ✅ Domain event emission (leave approved → event emitted)
- ✅ Edge cases (overlapping leaves, anonymous complaints, terminated employees)

---

## 12. Running Tests

```bash
# Unit tests for one service
turbo test --filter=hr-core

# Integration tests (needs test DB with schemas)
turbo test:integration --filter=hr-core

# Contract tests
turbo test:contract --filter=ai-agentic

# E2E (starts all services — run from root)
npm run test:e2e

# Coverage (aim for >80% on services, >60% overall)
turbo test:cov --filter=hr-core
```
