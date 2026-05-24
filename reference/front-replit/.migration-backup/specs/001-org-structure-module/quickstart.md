# Developer Quickstart: Organization Structure Module

**Feature**: `001-org-structure-module`  
**Service**: `apps/hr-core` (port 3001)  
**Date**: 2026-04-06

---

## Prerequisites

- Docker Compose running with `pgvector/pgvector:pg16` (see `docker-compose.yml`)
- `scripts/init-schemas.sql` already applied (creates `hr_core`, `social`, `ai_agent` schemas)
- `.env` set up with `HR_CORE_DATABASE_URL` pointing to your local PostgreSQL instance
- Node.js 20 LTS + pnpm installed

---

## 1. Set Up the Database

```bash
# From repo root — start the database
docker compose up -d db

# Apply the hr_core schema (if not already done)
psql -U postgres -f scripts/init-schemas.sql

# Run HR Core migrations
cd apps/hr-core
npx prisma migrate dev --name add_organization_module
```

After adding the three new models to `apps/hr-core/prisma/schema.prisma` (Department, Team, Position), run the migration above. The migration name should be descriptive.

---

## 2. Module Registration

Register `OrganizationModule` inside `apps/hr-core/src/app.module.ts`:

```typescript
import { OrganizationModule } from './modules/organization/organization.module';

@Module({
  imports: [
    // ... existing modules
    OrganizationModule,
  ],
})
export class AppModule {}
```

`OrganizationModule` itself imports `PrismaModule` (already provided by HR Core) and declares the four controllers and four services.

---

## 3. Seed Initial Data

Add organization seed data to `apps/hr-core/prisma/seed.ts`:

```typescript
// Seed departments
await prisma.department.createMany({
  data: [
    { name: 'Engineering', code: 'ENG' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Product', code: 'PRD' },
  ],
  skipDuplicates: true,
});

// Seed positions
await prisma.position.createMany({
  data: [
    { title: 'Software Engineer', level: 'Junior' },
    { title: 'Software Engineer', level: 'Senior' },   // Note: title must be unique — use combined strings
    // → Better: { title: 'Software Engineer - Junior' }, { title: 'Software Engineer - Senior' }
    { title: 'HR Generalist', level: null },
    { title: 'Product Manager', level: null },
  ],
  skipDuplicates: true,
});

// Seed teams (after departments exist)
const eng = await prisma.department.findUnique({ where: { code: 'ENG' } });
await prisma.team.createMany({
  data: [
    { name: 'Backend', code: 'BE', departmentId: eng!.id },
    { name: 'Frontend', code: 'FE', departmentId: eng!.id },
  ],
  skipDuplicates: true,
});
```

Run the seed:
```bash
cd apps/hr-core
npx prisma db seed
```

---

## 4. Run the Service

```bash
# From repo root
turbo dev --filter=hr-core

# Or directly
cd apps/hr-core
npm run start:dev
```

The service starts on `http://localhost:3001`.

---

## 5. Test the Endpoints

### Get a test JWT

Use the `POST /api/hr/auth/login` endpoint (IAM module) to get a valid JWT. For integration tests, use `generateTestJwt()` from `apps/hr-core/test/helpers/auth-test.helper.ts`.

### Quick smoke tests

```bash
# List departments (requires HR_ADMIN or EXECUTIVE JWT)
curl -H "Authorization: Bearer <jwt>" http://localhost:3001/api/hr/departments

# Create a department
curl -X POST -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"DevOps","code":"OPS"}' \
  http://localhost:3001/api/hr/departments

# Get org chart
curl -H "Authorization: Bearer <jwt>" http://localhost:3001/api/hr/org-chart
```

---

## 6. Run Tests

```bash
# Unit tests
cd apps/hr-core
npm test -- --testPathPattern="organization"

# Integration tests (requires running test DB)
npm run test:integration -- --testPathPattern="departments|teams|positions"

# All HR Core tests
turbo test --filter=hr-core
```

---

## 7. Module File Checklist

When implementing, create these files in order (each depends on the previous):

```
[ ] apps/hr-core/prisma/schema.prisma          → Add Department, Team, Position models
[ ] npx prisma migrate dev                      → Generate migration
[ ] apps/hr-core/src/modules/organization/
    [ ] departments/dto/create-department.dto.ts
    [ ] departments/dto/update-department.dto.ts
    [ ] departments/dto/department-query.dto.ts
    [ ] departments/departments.service.ts
    [ ] departments/departments.service.spec.ts
    [ ] departments/departments.controller.ts
    [ ] teams/dto/create-team.dto.ts
    [ ] teams/dto/update-team.dto.ts
    [ ] teams/dto/team-query.dto.ts
    [ ] teams/teams.service.ts
    [ ] teams/teams.service.spec.ts
    [ ] teams/teams.controller.ts
    [ ] positions/dto/create-position.dto.ts
    [ ] positions/dto/update-position.dto.ts
    [ ] positions/dto/position-query.dto.ts
    [ ] positions/positions.service.ts
    [ ] positions/positions.service.spec.ts
    [ ] positions/positions.controller.ts
    [ ] org-chart/org-chart.service.ts
    [ ] org-chart/org-chart.service.spec.ts
    [ ] org-chart/org-chart.controller.ts
    [ ] organization.module.ts
[ ] apps/hr-core/src/app.module.ts              → Register OrganizationModule
[ ] apps/hr-core/test/fixtures/organization.fixture.ts
[ ] apps/hr-core/test/integration/departments.integration.spec.ts
[ ] apps/hr-core/test/integration/teams.integration.spec.ts
[ ] apps/hr-core/test/integration/positions.integration.spec.ts
[ ] apps/hr-core/prisma/seed.ts                 → Add org structure seed data
```

---

## 8. Key Implementation Notes

**Scope filtering for teams list (MANAGER role)**:
```typescript
// In TeamsService.findAll()
const where: Prisma.TeamWhereInput = { isActive: true };
if (user.roles.includes('MANAGER') && !user.roles.includes('HR_ADMIN')) {
  where.id = user.teamId ?? 'no-match'; // Manager sees only their team
}
```

**Lead vacancy check (in TeamsService)**:
```typescript
// When resolving leadId
if (team.leadId) {
  const lead = await this.prisma.employee.findUnique({
    where: { id: team.leadId },
    select: { employmentStatus: true },
  });
  team.leadVacant = !lead || lead.employmentStatus === EmploymentStatus.TERMINATED;
}
```

**Inactive-department guard on team creation (in TeamsService.create())**:
```typescript
const dept = await this.prisma.department.findFirst({
  where: { id: dto.departmentId, isActive: true },
});
if (!dept) {
  throw new BadRequestException(
    `Department ${dto.departmentId} is inactive or does not exist`,
  );
}
```

**Org-chart query (in OrgChartService.getOrgChart())**:
```typescript
return this.prisma.department.findMany({
  where: { isActive: true },
  include: {
    teams: {
      where: { isActive: true },
      include: {
        _count: {
          select: { employees: { where: { employmentStatus: { not: 'TERMINATED' } } } },
        },
      },
    },
  },
  orderBy: { name: 'asc' },
});
```
Then map `_count.employees` → `employeeCount` in the response transformer.
