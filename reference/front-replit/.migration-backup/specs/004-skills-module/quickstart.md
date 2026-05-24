# Quickstart: Skills Module

**Branch**: `004-skills-module` | **Date**: 2026-04-17

## Prerequisites

- PostgreSQL 16 running (`docker compose up -d`)
- Schemas initialized (`psql -U postgres -d sentient -f scripts/init-schemas.sql`)
- `pnpm install` completed at the repo root
- `003-employee-module` merged (this feature relies on the extended `Employee` table and its manager/team relations)

## Implementation Order

### Step 1 — Shared enums

Create in `packages/shared/src/enums/`:

- `proficiency-level.enum.ts` — `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `EXPERT`
- `source-level.enum.ts` — `RECRUITMENT`, `TRAINING`, `CERTIFICATION`, `MANAGER`, `PEER_REVIEW`

Re-export both from `packages/shared/src/enums/index.ts`.

### Step 2 — Prisma schema

Edit `apps/hr-core/prisma/schema.prisma`:

1. Add `enum ProficiencyLevel` (with `@@schema("hr_core")`).
2. Add `enum SourceLevel` (with `@@schema("hr_core")`).
3. Add `model Skill`, `model EmployeeSkill`, `model SkillHistory` as described in `data-model.md`.
4. Add back-references on `Employee`:
   - `skills EmployeeSkill[]`
   - `skillHistory SkillHistory[]`
   - `assessedSkillHistory SkillHistory[] @relation("AssessedSkillHistories")`
5. Declare `SkillHistory.assessedBy Employee? @relation("AssessedSkillHistories", fields: [assessedById], references: [id])`.

### Step 3 — Create migration, then hand-edit it

```bash
cd apps/hr-core
npx prisma migrate dev --create-only --name add_skills_module
```

Open the generated `migration.sql` and append this block **after** the auto-generated `CREATE UNIQUE INDEX` / `CREATE INDEX` statements:

```sql
-- Partial unique index: at most one non-deleted current proficiency per (employee, skill).
-- Necessary because Prisma's @@unique would forbid multiple soft-deleted rows.
CREATE UNIQUE INDEX "employee_skills_employeeId_skillId_active_unique"
  ON "hr_core"."employee_skills" ("employeeId", "skillId")
  WHERE "deletedAt" IS NULL;
```

Then apply:

```bash
npx prisma migrate dev
npx prisma generate
```

Verify the migration file includes three `CREATE TABLE` statements (`skills`, `employee_skills`, `skill_history`), two `CREATE TYPE` statements (the two enums), regular `CREATE INDEX` statements, and the appended partial-unique block. No `ALTER TABLE hr_core.employees` statements that change columns or constraints.

### Step 4 — DTOs

Create in `apps/hr-core/src/modules/skills/dto/`:

- `create-skill.dto.ts`
- `update-skill.dto.ts`
- `skill-query.dto.ts` (pagination + filters for `GET /skills`)
- `upsert-employee-skill.dto.ts` (body for `POST /employees/:id/skills`)
- `history-query.dto.ts` (filters for `GET /skills/history`; require at least one scope param in `validate()`)
- `employee-skill-query.dto.ts` (pagination for `GET /skills/:skillId/employees`)

All DTOs use class-validator decorators (`@IsUUID`, `@IsEnum`, `@IsOptional`, `@IsDateString`, `@IsInt`, `@Min`, `@Max`, `@Length`).

### Step 5 — Services

Create three services under `apps/hr-core/src/modules/skills/`:

- `catalog/catalog.service.ts` — `create`, `findAll`, `findById`, `update`, `deactivate`, `reactivate`. Case-insensitive duplicate check in `create` / `update` (see R-005).
- `employee-skills/employee-skills.service.ts` — `findForEmployee`, `upsert` (the core transactional path: current + history in one `prisma.$transaction`), `remove` (soft-delete), `findByEmployeesForSkill`. Enforces the termination guard (R-010). Emits `skill.assessed` and `skill.removed`.
- `history/history.service.ts` — `query(filters)`. Applies scope filtering (R-007). Rejects unscoped queries with `400`.

### Step 6 — Controllers

Create three controllers, all decorated at class level with `@UseGuards(SharedJwtGuard, RbacGuard)`:

- `catalog/catalog.controller.ts` → routes rooted at `/skills` and `/skills/:id` (excluding `/skills/history`, which is reserved for the history controller; NestJS route order must be checked — declare history route before catalog `:id` route in the module or use a distinct root).
- `employee-skills/employee-skills.controller.ts` → `/employees/:employeeId/skills` and `/skills/:skillId/employees`.
- `history/history.controller.ts` → `/skills/history`.

To avoid `/skills/history` matching `/skills/:id`, either register `HistoryController` on a separate `@Controller('skills/history')` or put `@Controller('skills')` on the catalog but register history-first in the module array and use regex-constrained `:id` params — the former is simpler; use it.

Each endpoint gets `@Roles(...)` matching the RBAC matrix in `contracts/skills-api.md`, plus Swagger decorators (`@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiQuery`, `@ApiBody`).

### Step 7 — Module wiring

- `apps/hr-core/src/modules/skills/skills.module.ts` — imports `PrismaModule`, declares all three controllers and all three services, imports the `EVENT_BUS` provider.
- `apps/hr-core/src/app.module.ts` — import `SkillsModule`.

### Step 8 — Unit tests (co-located)

- `catalog.service.spec.ts` — duplicate-name rejection (case-insensitive), deactivation, reactivation, forbidden role paths.
- `employee-skills.service.spec.ts` — first assessment creates both rows, same-level no-op, level change updates + appends history, soft-delete leaves history untouched, re-assignment after delete creates fresh row with `previousLevel = null`, terminated-employee write rejected, scope violation rejected.
- `history.service.spec.ts` — date-range filter inclusive, ordering, scope filtering (manager out-of-scope → 403, employee requesting another → 403).

### Step 9 — Integration tests

`apps/hr-core/test/integration/skills.integration.spec.ts`:

- Seed one HR admin, one manager, two employees (one reports to the manager, one does not), three catalog skills.
- Exercise full lifecycle: create skill → manager assesses direct report → HR admin upgrades → manager removes → manager re-adds (new first-assessment) → history query returns expected ordered entries.
- Verify RBAC: manager attempting to assess the non-report fails with `403`.

### Step 10 — Smoke test

```bash
# Build
cd apps/hr-core && npx prisma generate && cd ../.. && turbo build --filter=hr-core

# Unit + integration
turbo test --filter=hr-core

# Dev server
turbo dev --filter=hr-core

# curl smoke (replace <JWT>):
curl -H "Authorization: Bearer <HR_ADMIN_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"name":"React","category":"Frontend"}' \
     http://localhost:3001/skills
```

## Verification Checklist

- [ ] Prisma migration applied cleanly; `information_schema.tables` shows `skills`, `employee_skills`, `skill_history` under `hr_core`.
- [ ] Partial unique index exists — verify with `\d hr_core.employee_skills` in `psql`.
- [ ] Shared enums exported and importable as `@sentient/shared`.
- [ ] All endpoints return `401` without a JWT and `403` with the wrong role.
- [ ] Same-level assessment returns `200 { changed: false }` with no new history row.
- [ ] Different-level assessment returns `200 { changed: true }` with exactly one new history row.
- [ ] Soft-delete followed by re-add produces a new `EmployeeSkill` row and a history row with `previousLevel = null`.
- [ ] Manager out-of-scope read returns `403`.
- [ ] Terminated employee writes return `409`.

## Files Created/Modified

| Action  | Path |
|---------|------|
| Create  | `packages/shared/src/enums/proficiency-level.enum.ts` |
| Create  | `packages/shared/src/enums/source-level.enum.ts` |
| Modify  | `packages/shared/src/enums/index.ts` |
| Modify  | `apps/hr-core/prisma/schema.prisma` |
| Create  | `apps/hr-core/prisma/migrations/<timestamp>_add_skills_module/migration.sql` |
| Create  | `apps/hr-core/src/modules/skills/skills.module.ts` |
| Create  | `apps/hr-core/src/modules/skills/catalog/catalog.controller.ts` |
| Create  | `apps/hr-core/src/modules/skills/catalog/catalog.service.ts` |
| Create  | `apps/hr-core/src/modules/skills/catalog/catalog.service.spec.ts` |
| Create  | `apps/hr-core/src/modules/skills/employee-skills/employee-skills.controller.ts` |
| Create  | `apps/hr-core/src/modules/skills/employee-skills/employee-skills.service.ts` |
| Create  | `apps/hr-core/src/modules/skills/employee-skills/employee-skills.service.spec.ts` |
| Create  | `apps/hr-core/src/modules/skills/history/history.controller.ts` |
| Create  | `apps/hr-core/src/modules/skills/history/history.service.ts` |
| Create  | `apps/hr-core/src/modules/skills/history/history.service.spec.ts` |
| Create  | `apps/hr-core/src/modules/skills/dto/create-skill.dto.ts` |
| Create  | `apps/hr-core/src/modules/skills/dto/update-skill.dto.ts` |
| Create  | `apps/hr-core/src/modules/skills/dto/skill-query.dto.ts` |
| Create  | `apps/hr-core/src/modules/skills/dto/upsert-employee-skill.dto.ts` |
| Create  | `apps/hr-core/src/modules/skills/dto/employee-skill-query.dto.ts` |
| Create  | `apps/hr-core/src/modules/skills/dto/history-query.dto.ts` |
| Create  | `apps/hr-core/test/integration/skills.integration.spec.ts` |
| Modify  | `apps/hr-core/src/app.module.ts` |

## Pre-IAM Re-enablement Index

Run to locate every commented-out guard after IAM lands:

```bash
grep -rn "TODO: re-enable when IAM module is implemented" apps/hr-core/src/modules/skills/
```

Targets as of implementation (uncomment each line when IAM is wired):

| File | Line | What to uncomment |
|------|------|-------------------|
| `catalog/catalog.controller.ts` | 15–17 | Guard imports |
| `catalog/catalog.controller.ts` | 24 | `@UseGuards(SharedJwtGuard, RbacGuard)` on class |
| `catalog/catalog.controller.ts` | 30,41,49,58,72,82 | `@Roles(...)` per endpoint |
| `employee-skills/employee-skills.controller.ts` | 16–18 | Guard imports |
| `employee-skills/employee-skills.controller.ts` | 34 | `@UseGuards(...)` on class |
| `employee-skills/employee-skills.controller.ts` | 40,57,72 | `@Roles(...)` per endpoint |
| `employee-skills/employee-skills.service.ts` | 84 | `assessedById = user.employeeId` |
| `employee-skills/employee-skills.service.ts` | 218,250 | `buildScopeFilter(...)` calls |
| `employee-skills/skill-reverse.controller.ts` | 3–5 | Guard imports |
| `employee-skills/skill-reverse.controller.ts` | 10 | `@UseGuards(...)` on class |
| `employee-skills/skill-reverse.controller.ts` | 16 | `@Roles(...)` |
| `history/history.controller.ts` | 4–6 | Guard imports |
| `history/history.controller.ts` | 11 | `@UseGuards(...)` on class |
| `history/history.controller.ts` | 17 | `@Roles(...)` |
| `history/history.service.ts` | 18 | Employee OWN-scope enforcement |
