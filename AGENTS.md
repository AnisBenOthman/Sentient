# Sentient Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-09

## Persona

Senior Full-Stack Engineer. Write complete, production-quality code. No placeholders, no stubs with TODOs. If a task is assigned, implement it fully — Prisma schema, NestJS module, DTOs, guards, controller, service, barrel exports, all of it.

## Active Technologies
- TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/config (003-employee-module)
- PostgreSQL 16, schema `hr_core` (003-employee-module)
- TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/schedule (for monthly accrual cron), @nestjs/config (005-leave-module)

- TypeScript 5.x — strict mode via `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames`) + NestJS 10, React 18 + Vite 7 (no SSR), Prisma 5 (multiSchema preview), @nestjs/config, @nestjs/swagger, class-validator, class-transformer, Turborepo 2.x
- PostgreSQL 16 + pgvector — Docker Compose (`pgvector/pgvector:pg16` image); 3 schemas (`hr_core`, `social`, `ai_agent`), 4 roles

## Project Structure

```text
apps/hr-core/      NestJS :3001  schema=hr_core
apps/social/       NestJS :3002  schema=social
apps/ai-agentic/   NestJS :3003  schema=ai_agent
apps/web/          React + Vite :3000
packages/shared/   @sentient/shared — enums, interfaces, DTOs, event-bus, auth
scripts/init-schemas.sql
docker-compose.yml
```

## Commands

```bash
pnpm install
docker compose up -d
psql -U postgres -d sentient -f scripts/init-schemas.sql
turbo build
turbo dev
turbo test --filter=<service>
```

## Code Style

See `.claude/rules/code-style.md` for full conventions. Key rules:
- No `any`. Use `unknown` and narrow.
- Explicit return types on all public methods.
- `@Injectable()` constructor injection only.
- DTOs validate with class-validator. Services trust their inputs.
- Every endpoint: `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles(...)`. Except `/health`.

## Recent Changes
- promotion-review-compensation: Added HR admin Validate/Refuse actions to the dashboard Promotions tab, wired them to HR Core approve/reject endpoints, made approval apply the promoted gross/net salary with salary-history audit, and filled canonical seed/live local salary history with realistic net salary movement.
- manager-simulation-performance-access: Opened Simulation to manager tiers and scopes its employee/request data to the manager's department/team before rendering promotion candidates; Performance Reviews now appears for every role while HR-only cycle actions remain HR-only.
- hrbp-dashboard-analytics: Added scoped HRBP workforce analytics to the dashboard API and React dashboard, including probation/exits, average age, average tenure, full-time ratio, exit rate, status breakdown, contract mix, age bands, and tenure bands.
- dashboard-analytics-trust: Fixed scoped dashboard employee stats so Total Employees counts all non-deleted people in scope while Active/On Leave stay status-specific; current payroll, skills, salary history, and pending approval queries now exclude terminal employees, with analytics unit coverage for department-manager scope.
- canonical-hr-seed: Consolidated HR Core seeding into `apps/hr-core/prisma/seed.ts`; removed the divergent `seed-replit.ts` and generated seed JS artifacts; Prisma config and package scripts now point to the canonical TypeScript seed, with Replit/performance-review enum metadata preserved in `seed.ts`.
- manager-scoped-employee-details: Department managers can open employee profiles for employees in their department, team leads can open profiles for employees in their team, HR still sees all profiles, and regular employees keep list-only access.
- role-scoped-directory-dashboard: Team leads and department managers now see Dashboard with team/dept-scoped analytics, including demo manager tokens that lack explicit scoped role assignments; org chart and org filter data are available to all authenticated users; employee directory is browseable by everyone while profile detail entry points are HR-only and non-HR API detail access is limited to self.
- employee-profile-business-unit: Fixed employee profile Professional Details so Business Unit is resolved from the employee API payload instead of staying in a Loading state; employee API now includes department/team Business Unit refs.
- employee-data-standardization: Cleaned live HR Core employee profiles so all active full names are unique, DOB/marital/phone/education/net salary fields are populated, employee emails/phones are standardized, and future reseeds use the same realistic unique profile generation with an active-name uniqueness index.
- employee-directory-org-context: Added BU-aware employee directory context so department groups and rows show the parent business unit; employee profile header/details now show Business Unit, and profile department selection labels duplicate department names with their BU path.
- 010-notifications: generic in-app notification module — Notification table + 3 enums in hr_core, event-bus subscriber wiring all domain events (leave + promotion live; skills/perf/probation/contract/complaint/engagement/exit-survey wired-but-inactive), bell + drawer in apps/web, SSE realtime with TanStack cache merge + 30s polling fallback, role-aware notification deep links, 90-day retention
- promotion-dashboard: Added durable HR Core promotion requests with Prisma model/migration, shared status enum, guarded NestJS create/list/dashboard endpoints, and service tests; moved Simulation promotion submissions from localStorage to live HR Core employees/API; updated Dashboard Promotions tab with year + org-scope filters, total requests, average salary lift, total budget impact, pending requests, and request detail table.
- skills-domain-front: Aligned web required-skills API types with the backend PositionSkill DTO (`skillId`, `minimumProficiency`, optional `requirementLevel`, bulk `{ skills: [...] }` payload); routed legacy positions-api helpers through the HR Core client; added position required-skills filtering by SkillDomain and visible requirement-tier counts/labels, plus backend domain filtering in the add-skill picker; updated employee-profile gap radar to render skills grouped per domain and the gap card to list actual Mandatory/Expected/Nice-to-Have skills with required/acquired proficiency.
- skills-domain: Added SkillDomain enum (TECHNICAL/LEADERSHIP/SOFT_SKILLS/DOMAIN_EXPERTISE) to shared pkg + Prisma schema; wired domain field into catalog DTOs, position-skills, employee-skills, history, and gap analysis services; added position required skills CRUD panel to positions.tsx (expandable per row, add/delete dialog, HR_ADMIN gated); replaced flat SkillsRadarCard with GapRadarCard (required vs acquired overlay) on employee-profile.tsx; enhanced SkillsGapCard with By Domain / By Requirement Level / All Skills tabs; seeded skill domains in seed.ts; migration at 20260510000000_add_skill_domain; run `prisma migrate dev` to apply
- 009-coordination: Established Claude Code ↔ Codex session-start protocol and fixed .claude/rules path reference in AGENTS.md
- 009-performance-review: Planned HR Core performance review cycles, self-review, manager review, HR outcome tracking, and API-backed web workflow using the existing TypeScript/NestJS/Prisma/React stack
- 005-leave-module: Added TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/schedule (for monthly accrual cron), @nestjs/config
- 004-skills-module: Added TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/config
- 003-employee-module: Added TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/config


## Agent Coordination Protocol

This project uses **two agents in sequence**: Claude Code and Codex. You never run at the
same time. The shared source of truth is **git history** and **`specs/*/tasks.md`**.

### At Every Session Start — Do These Before Writing Any Code

1. Run `git log --oneline -10` to see what the other agent last did and which branch is active.
2. Identify the active feature branch (e.g., `009-performance-review`) and read
   `specs/<feature>/tasks.md` to know which tasks are done (`[x]`) and which remain (`[ ]`).
3. Read `AGENTS.md` Recent Changes for the last feature that was added.

### Commit Message Convention

Prefix every commit with `[codex]` so the git log clearly shows which agent produced each change:

```
[codex] feat(performance-review): implement ReviewCyclesService create/initiate
[codex] fix(shared): correct PerformanceRating enum export
```

Claude Code uses `[claude]` for the same reason. This makes `git log --oneline` a readable
cross-agent work log without any extra tooling.

### When You Finish a Session

Update the `## Recent Changes` section at the top of this file with what you implemented,
using the same format as existing entries. This is the handoff note for the next agent.

### What You Do NOT Need to Do

- No separate state file to maintain — git is the state.
- No task attribution in `tasks.md` beyond the `[x]` checkbox — git blame covers attribution.
- No synchronization file — sequential execution means no collision risk.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
