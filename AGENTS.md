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
- skills-domain: Added SkillDomain enum (TECHNICAL/LEADERSHIP/SOFT_SKILLS/DOMAIN_EXPERTISE) to shared pkg + Prisma schema; wired domain field into catalog DTOs, position-skills, employee-skills, history, and gap analysis services; added position required skills CRUD panel to positions.tsx (expandable per row, add/delete dialog, HR_ADMIN gated); replaced flat SkillsRadarCard with GapRadarCard (required vs acquired overlay) on employee-profile.tsx; enhanced SkillsGapCard with By Domain / By Requirement Level / All Skills tabs; seeded domains into seed-replit.ts via TECHNICAL/LEADERSHIP/BEHAVIORAL→SOFT_SKILLS/DOMAIN category mapping; migration at 20260510000000_add_skill_domain; run `prisma migrate dev` to apply
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
