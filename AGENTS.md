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
- [claude] 012-social-scaffold: Social scaffold landed — Prisma 8-entity schema (announcements, events, event_attendees, documents, feedback, engagement_snapshots, exit_surveys, exit_survey_responses) + 8 Postgres enums + 10 indexes + migration, 4 new @sentient/shared enums (Audience/RsvpStatus/SentimentLabel/FeedbackType), SharedJwtGuard+RbacGuard global APP_GUARDs, @Public() on /health, HrCoreClient with in-process 60s employee-ref cache, local InMemoryEventBus/EventBusModule mirror, env templates, full test suite (auth-wiring, event-bus, hr-core.client, e2e health) all green
- performance-review-detail-modern-ui: Refined the Performance Review Details dialog into a modern scan-first review dossier with a dark summary band, status/rating chips, self-vs-manager rating panels, satisfaction snapshot, narrative cards, and timeline markers.
- performance-review-detail-dialog: Performance Reviews now exposes a Details action on every visible review row so employees, managers, and HR can inspect self/manager ratings, satisfaction scores, comments, org context, timestamps, rating gaps, and salary follow-up counts without needing an editable review state.
- org-chart-business-unit-filter: Org Chart now exposes Business Unit filters ahead of department filters, scopes department tabs and visible branches to the selected BU, shows BU names on department cards, and includes BU metadata in the HR Core org-chart response.
- org-chart-replit-behavior-port: Org Chart now uses the front-replit hierarchy behavior against live HR Core data, including CEO root support, skill search/highlights/tooltips, recent-joiner badges, department filters, and collapsed team branches that expand from lead-only views.
- okr-cascade-tree-expand-collapse: OKR Cycle Management now renders the cascade as a friendlier expandable tree, with per-parent expand/reduce controls, global Expand all/Reduce all actions, child counts, and clearer Company/Department/Employee visual hierarchy.
- okr-objectives-table-cascade-levels: The selected-cycle Objectives table now renders objectives in cascade order with indentation, explicit Company/Department/Employee badges, and parent alignment context instead of a flat level column.
- okr-cascade-management-ui: OKR Management now shows an explicit Company → Department → Employee cascade for the selected cycle, including active company objectives from a quarterly cycle's annual parent; managers can start a department objective directly under a company objective and activate linked draft department objectives from the cascade.
- okr-management-manager-tier-nav: OKR Management is visible to both department-manager and team-lead frontend tiers, because MANAGER JWTs can be classified by assignment scope; the route remains role-tier gated and backend OKR RBAC still enforces actual objective permissions.
- okr-manager-nav-access: Department managers now see an OKR Management sidebar entry that opens the existing cycle/objective management page, and the route is explicitly gated to HR admins and department managers so managers can activate their draft department objectives without exposing HR-only cycle administration.
- okr-employee-objective-owner-flow: Employee-level OKR creation now uses a scoped employee owner picker instead of raw IDs, auto-assigns self-service employee objectives to the current user, normalizes selected Employee IDs to linked User IDs in HR Core, and clarifies that active department objectives are required before employee OKRs can align.
- okr-manager-department-objectives: Department managers now create department OKRs without entering raw department IDs; HR Core derives the manager department from JWT claims, the OKR cycle page opens manager objective creation at Department level, and selected-cycle objectives can be activated from the UI so active parent objectives become selectable.
- okr-parent-objective-dropdown: Fixed the Objective form parent dropdown so department OKRs in quarterly cycles can align to active company objectives from the parent annual cycle, with loading/empty states instead of a blank menu.
- okr-cycle-date-normalization: Fixed OKR cycle creation so date-only UI payloads are normalized to UTC Date objects before Prisma DateTime writes, and cleaned the OKR RBAC test fixture so HR Core type-check remains green.
- 011-okr-module: OKR module — 4 new entities + 7 enums in hr_core, 3-level cascading hierarchy (Company/Department/Employee), dual-track contribution (personal OKRs auto-approve + shared KR check-ins via Manager review), notifications integration via okr.rules.ts + new OKR enum values, 14-day reminder cron (OkrReminderScheduler), 3 React pages (okr-dashboard, okr-cycle-management, my-okrs), HR Core backend clean build
- promotion-position-catalog-alignment: Promotion requests now require selecting an active Position by job-family in Simulation, removed custom promoted-role titles, and HR Core derives current/new role titles from canonical positions while applying the promoted position on approval.
- positions-domain-sections: Reorganized the Positions page into seeded job-family sections (Engineering, Product & Design, HR, Finance, Sales) and grouped each position's required skills by actual SkillDomain, with backend position-skill domain filtering support.
- employee-profile-gap-radar-port: Reworked the main React employee profile Skills tab to use a front-replit-style Skills & Proficiency gap radar, overlaying employee proficiency against role requirements and listing partial/missing gaps below the chart.
- front-replit-skill-gap-fallback: Employee profile skill gap information now renders in the isolated Replit frontend even when the local `/api` server is offline, using exported mock employee positions and required skills as a client-side fallback.
- employee-self-profile-nav: Added a My Profile nav entry and self-service profile route for every linked employee, hid HR-only edit controls outside HR admin views, exposed own salary history safely, and added scoped promotion history to employee profile details.
- simulation-hr-review-actions: Added HR admin Validate/Refuse actions to pending promotion request cards in the Simulation section, reusing HR Core approve/reject endpoints with query invalidation and toast feedback.
- promotion-submit-validation-scope: Fixed Simulation promotion submission by aligning manager create-scope with department/team leadership visibility, adding frontend validation for salary increases and required responsibilities, and surfacing HR Core validation messages instead of the generic scope error.
- simulation-budget-decimal-normalization: Fixed Simulation team-budget math by normalizing employee gross/net salary Decimal strings to numbers in the HR Core web API client, added a defensive salary coercion in the promotion wizard, and verified the live pending Backend promotion row still stores a realistic 367,918.00 team budget.
- promotion-simulation-budget-review: Promotion creation now computes current salary/team budget from HR Core instead of trusting frontend values, Simulation requests scoped compensation data only for HR/manager-owned employees, HR admins get a visible Pending HR Decisions card with Validate/Refuse actions, and the local bad Backend pending request was backfilled from real salary data.
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
