# Quickstart: Employee Module

**Branch**: `003-employee-module` | **Date**: 2026-04-13

## Prerequisites

- PostgreSQL 16 running (via `docker compose up -d`)
- Schemas initialized (`psql -U postgres -d sentient -f scripts/init-schemas.sql`)
- `pnpm install` completed

## Implementation Order

### Step 1: Schema & Migration

1. Update `apps/hr-core/prisma/schema.prisma`:
   - Add `ContractType` enum to Prisma schema
   - Extend `Employee` model with new fields (employeeCode, email, phone, dateOfBirth, hireDate, contractType, currentSalary, positionId, managerId, createdAt, updatedAt)
   - Add `SalaryHistory` model
   - Add Position relation to Employee
   - Add self-referencing manager relation

2. Add `RESIGNED` to shared `EmploymentStatus` enum (`packages/shared/src/enums/employment-status.enum.ts`)

3. Run migration:
   ```bash
   cd apps/hr-core
   npx prisma migrate dev --name add_employee_fields_and_salary_history
   npx prisma generate
   ```

### Step 2: DTOs

Create in `apps/hr-core/src/modules/employees/dto/`:
- `create-employee.dto.ts` — all creation fields with class-validator decorators
- `update-employee.dto.ts` — partial update fields
- `employee-query.dto.ts` — pagination, filtering, sorting, search params
- `update-employee-status.dto.ts` — status transition with reason

### Step 3: Service

Create `apps/hr-core/src/modules/employees/employees.service.ts`:
- `create()` — validate refs, auto-generate code, persist
- `findAll()` — scope-filtered, paginated, searchable
- `findById()` — scope-filtered, includes relations
- `update()` — salary history transaction, event emission
- `updateStatus()` — transition validation, event emission
- `getSalaryHistory()` — ordered by effectiveDate desc
- `buildScopeFilter()` — private helper returning Prisma where clause

### Step 4: Controller

Create `apps/hr-core/src/modules/employees/employees.controller.ts`:
- Wire all endpoints per API contract
- Apply `@UseGuards(SharedJwtGuard, RbacGuard)` at controller level
- Apply `@Roles()` per endpoint
- Swagger decorators on all endpoints

### Step 5: Module & Wiring

1. Create `apps/hr-core/src/modules/employees/employees.module.ts`
2. Register in `apps/hr-core/src/app.module.ts`

### Step 6: Response Sanitization

Add salary/DOB stripping logic — either as an interceptor or inline in the service select queries (Prisma `select` approach is simpler and avoids leaking data even internally).

### Step 7: Tests

- Unit: `employees.service.spec.ts` — scope filtering, salary history creation, status transitions, validation
- Integration: test against real hr_core schema

## Verification

```bash
# Build
cd apps/hr-core && npx prisma generate && cd ../.. && turbo build --filter=hr-core

# Test
turbo test --filter=hr-core

# Dev server
turbo dev --filter=hr-core
# Then: curl http://localhost:3001/employees (with JWT header)
```

## Files Created/Modified

| Action  | Path |
|---------|------|
| Modify  | `apps/hr-core/prisma/schema.prisma` |
| Modify  | `packages/shared/src/enums/employment-status.enum.ts` |
| Modify  | `apps/hr-core/src/app.module.ts` |
| Create  | `apps/hr-core/src/modules/employees/employees.module.ts` |
| Create  | `apps/hr-core/src/modules/employees/employees.controller.ts` |
| Create  | `apps/hr-core/src/modules/employees/employees.service.ts` |
| Create  | `apps/hr-core/src/modules/employees/employees.service.spec.ts` |
| Create  | `apps/hr-core/src/modules/employees/dto/create-employee.dto.ts` |
| Create  | `apps/hr-core/src/modules/employees/dto/update-employee.dto.ts` |
| Create  | `apps/hr-core/src/modules/employees/dto/update-employee-status.dto.ts` |
| Create  | `apps/hr-core/src/modules/employees/dto/employee-query.dto.ts` |
