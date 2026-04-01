# Code Style Rules — Sentient Project

> Read by Claude Code at session start. These rules are non-negotiable.

---

## 1. TypeScript Conventions

### Strict Mode — Always

```json
// tsconfig.json — these must be ON in every service
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Naming

| Thing              | Convention          | Example                          |
|--------------------|---------------------|----------------------------------|
| Files (modules)    | kebab-case          | `leave-request.service.ts`       |
| Classes            | PascalCase          | `LeaveRequestService`            |
| Interfaces         | PascalCase, no `I`  | `Employee` not `IEmployee`       |
| Enums              | PascalCase          | `LeaveStatus`                    |
| Enum members       | UPPER_SNAKE         | `ON_LEAVE`, `FULL_TIME`          |
| Functions/methods  | camelCase            | `calculateRemainingDays()`       |
| Constants          | UPPER_SNAKE         | `MAX_LEAVE_DAYS`                 |
| Variables          | camelCase            | `employeeCount`                  |
| DB columns (Prisma)| camelCase            | `employeeId`, `hireDate`         |
| DB tables (PG)     | snake_case           | `leave_requests`, `employee_skills` |
| API routes         | kebab-case           | `/api/leave-requests`            |
| DTOs               | PascalCase + Dto     | `CreateLeaveRequestDto`          |
| Services (NestJS)  | PascalCase + domain  | `LeavesService` not `LeaveService` |
| REST clients       | PascalCase + Client  | `HrCoreClient`, `SocialClient`   |

### Types Over `any`

```typescript
// ❌ NEVER
const data: any = await service.find();
function process(input: any): any { }

// ✅ ALWAYS
const data: Employee[] = await service.find();
function process(input: CreateEmployeeDto): Employee { }

// When truly unknown, use `unknown` and narrow
function parseInput(raw: unknown): LeaveRequest {
  if (!isLeaveRequest(raw)) throw new BadRequestException();
  return raw;
}
```

### Prefer `interface` for Object Shapes, `type` for Unions/Intersections

```typescript
// ✅ Interface for entity shapes
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  departmentId: string;
}

// ✅ Type for unions, intersections, mapped types
type AgentType = 'HR_ASSISTANT' | 'LEAVE_AGENT' | 'CAREER_AGENT';
type EmployeeWithSkills = Employee & { skills: EmployeeSkill[] };
```

### Return Types — Always Explicit on Public Methods

```typescript
// ❌ Implicit
async findAll() { return this.prisma.employee.findMany(); }

// ✅ Explicit
async findAll(): Promise<Employee[]> { return this.prisma.employee.findMany(); }
```

---

## 2. NestJS Architecture (Per Microservice)

### Module Structure

Every domain within a service follows this pattern:

```
apps/hr-core/src/modules/leaves/
├── leaves.module.ts           # Module declaration
├── leaves.controller.ts       # HTTP layer (thin — delegates to service)
├── leaves.service.ts          # Business logic
├── dto/
│   ├── create-leave-request.dto.ts
│   ├── update-leave-request.dto.ts
│   └── leave-request-query.dto.ts
├── guards/                    # Domain-specific guards (if any)
└── leaves.service.spec.ts     # Unit tests (co-located)
```

### Controller Rules

- **Thin controllers** — Validate input (DTOs + pipes) and delegate to services.
  No business logic. Ever.
- **Swagger decorators** — Every endpoint gets `@ApiOperation`, `@ApiResponse`.
- **Consistent route prefixes** — Scoped to the service's domain.

```typescript
@Controller('leave-requests')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiTags('Leave Management')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  @Roles('EMPLOYEE', 'HR_ADMIN')
  @ApiOperation({ summary: 'Submit a new leave request' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaveRequestDto,
  ): Promise<LeaveRequest> {
    return this.leavesService.create(user.employeeId, dto);
  }
}
```

### Service Rules

- **One service per domain aggregate** — `LeavesService` handles LeaveRequest,
  LeaveBalance, and LeaveType.
- **Services never import controllers**
- **Cross-module calls within the same service** go through module exports
- **Cross-service calls** go through REST clients in `common/clients/`

### Inter-Service Client Rules

```typescript
// ✅ Always in common/clients/ directory
// ✅ Always @Injectable() for DI
// ✅ Always forward the JWT for RBAC enforcement
// ✅ Always return typed responses using shared interfaces

@Injectable()
export class HrCoreClient {
  async getEmployee(id: string, jwt: string): Promise<EmployeeRef> { }
  async getLeaveBalance(employeeId: string, jwt: string): Promise<LeaveBalance[]> { }
}

// ❌ Never call another service's database directly
// ❌ Never import from another app's source code
// ❌ Never hardcode service URLs (use ConfigService)
```

### Dependency Injection

```typescript
// ✅ Constructor injection (always)
constructor(
  private readonly prisma: PrismaService,
  private readonly hrCoreClient: HrCoreClient,
) {}

// ❌ Property injection (never for required deps)
@Inject() prisma: PrismaService;
```

---

## 3. Prisma Conventions (Per Service)

### Each Service Has Its Own Prisma Setup

```
apps/hr-core/prisma/schema.prisma      → generates to apps/hr-core/src/generated/prisma
apps/social/prisma/schema.prisma       → generates to apps/social/src/generated/prisma
apps/ai-agentic/prisma/schema.prisma   → generates to apps/ai-agentic/src/generated/prisma
```

### Schema Organization

```prisma
// Always declare the schema annotation
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

// ============================================================
// DOMAIN: Leave Management
// WHY: Separated from core employee module to allow independent
//      leave policy changes without touching employee schema
// ============================================================

model LeaveType {
  id                 String   @id @default(uuid())
  name               String   @unique
  defaultDaysPerYear Int
  requiresApproval   Boolean  @default(true)
  color              String?

  balances LeaveBalance[]
  requests LeaveRequest[]

  @@schema("hr_core")
  @@map("leave_types")
}
```

### Prisma Rules

- **`@@schema()`** on every model — Maps to the service's PostgreSQL schema
- **`@@map()`** on every model — snake_case table names: `@@map("leave_requests")`
- **`@map()`** on columns only when Prisma camelCase differs from desired DB name
- **UUIDs everywhere** — `@id @default(uuid())`
- **No cross-schema relations** — Use logical foreign IDs (plain `String` fields)
- **Soft deletes where appropriate** — `deletedAt DateTime?` for audit-sensitive entities

### Migration Discipline

```bash
# Always name migrations descriptively — include service context
cd apps/hr-core
npx prisma migrate dev --name add_agent_risk_assessment_to_leave_requests

# Never edit a migration after it's been applied
# Never run one service's migrations from another service's directory
```

---

## 4. DTO Validation (class-validator)

```typescript
import { IsUUID, IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * WHY: DTOs are the contract between the HTTP boundary and business logic.
 * Validation happens here, not in services. Services trust their inputs.
 */
export class CreateLeaveRequestDto {
  @IsUUID()
  leaveTypeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
```

---

## 5. Error Handling

```typescript
// ✅ Use NestJS built-in exceptions
throw new NotFoundException(`Employee ${id} not found`);
throw new ForbiddenException('Insufficient permissions for TEAM scope');
throw new ConflictException('Leave request overlaps with existing approved leave');

// ✅ Custom business exceptions
export class InsufficientLeaveBalanceException extends BadRequestException {
  constructor(available: number, requested: number) {
    super(`Insufficient leave balance: ${available} available, ${requested} requested`);
  }
}

// ✅ Inter-service error handling — wrap HTTP errors
try {
  return await this.hrCoreClient.getEmployee(id, jwt);
} catch (error) {
  if (error.response?.status === 404) {
    throw new NotFoundException(`Employee ${id} not found in HR Core`);
  }
  throw new ServiceUnavailableException('HR Core service is unreachable');
}

// ❌ Never throw raw Error
throw new Error('Something went wrong');
```

---

## 6. Import Organization

Imports grouped in this order, separated by blank lines:

```typescript
// 1. Node built-ins
import { randomUUID } from 'crypto';

// 2. NestJS framework
import { Injectable, NotFoundException } from '@nestjs/common';

// 3. Third-party libraries
import { Prisma } from '../generated/prisma';

// 4. Shared package (@sentient/shared)
import { LeaveStatus, PermissionScope } from '@sentient/shared';

// 5. Internal imports (relative — same service only)
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
```

**Critical:** Never import from `apps/hr-core/` inside `apps/social/` or vice versa.
Cross-service communication goes through REST clients and `@sentient/shared` types.

---

## 7. Monorepo Conventions

### Package References

```json
// apps/hr-core/package.json
{
  "dependencies": {
    "@sentient/shared": "workspace:*"
  }
}
```

### Turborepo Pipeline

```json
// turbo.json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["build"] },
    "lint": {}
  }
}
```

### Dev Scripts

```bash
# Start all services
turbo dev

# Start one service
turbo dev --filter=hr-core

# Run tests for one service
turbo test --filter=ai-agentic
```

---

## 8. Comments Philosophy

```typescript
// ❌ Comments that say WHAT
// Get employee by id
async findById(id: string) { }

// ✅ Comments that say WHY
/**
 * WHY: Uses scope-filtered query because agents call this with
 * the requesting user's permissions. A TEAM-scoped request only
 * returns employees managed by the same manager.
 */
async findByScope(id: string, scope: PermissionScope): Promise<Employee[]> { }

// ✅ Comments that explain inter-service decisions
/**
 * WHY: Employee names are fetched from HR Core and cached for 5 minutes.
 * Social service doesn't store employee data — it only holds logical
 * employeeId references validated via REST on write.
 */
```

---

## 9. Frontend (Next.js + Tailwind)

### API Gateway Pattern

The Next.js `app/api/` routes act as the API gateway, proxying requests to the
correct microservice:

```typescript
// app/api/hr/[...path]/route.ts — proxies to HR Core :3001
// app/api/social/[...path]/route.ts — proxies to Social :3002
// app/api/ai/[...path]/route.ts — proxies to AI Agentic :3003
```

### File Conventions

- **App Router** — `app/` directory with `page.tsx`, `layout.tsx`, `loading.tsx`
- **Server Components by default** — Only `'use client'` when state/effects needed
- **Route groups** — `(auth)`, `(dashboard)`, `(intranet)`, `(ai)` for organization
- **Typed API clients** — One per service in `lib/api/`

### Tailwind Rules

- **No inline styles** — Everything through Tailwind utilities
- **Component variants** — Use `cva` (class-variance-authority)
- **Design tokens** — Define in `tailwind.config.ts`
- **Dark mode ready** — Use `dark:` variants from day one

### Component Structure

```
components/
├── ui/                  # Generic primitives (Button, Card, Input)
├── employees/           # Domain: HR Core data
├── leaves/              # Domain: Leave management
├── intranet/            # Domain: Social service data
├── chat/                # Domain: AI conversations
└── layout/              # Sidebar, Header, Navigation
```
