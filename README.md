# Sentient HRIS

AI-powered HR Information System: a Turborepo monorepo with NestJS microservices, a Vite frontend, an API Gateway, and PostgreSQL + pgvector.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start the database
docker compose up -d

# 3. Initialize schemas and DB roles (idempotent, safe to run again)
psql -U postgres -d sentient -f scripts/init-schemas.sql

# 4. Configure environment files — one per service, created by hand.
#    .env.example is gitignored repo-wide, so there is nothing to copy;
#    see "Environment Variables" below for what each service requires.

# 5. Apply migrations (creates the hr_core/social/ai_agent tables and the
#    hr_analytics reporting views that init-schemas.sql only reserves space for)
pnpm --filter hr-core exec prisma migrate deploy
pnpm --filter @sentient/social exec prisma migrate deploy
pnpm --filter @sentient/ai-agentic exec prisma migrate deploy

# 6. Build all packages
pnpm build

# 7. Start all services in watch mode
pnpm dev
```

### Health Checks

```bash
curl http://localhost:3001/health   # HR Core
curl http://localhost:3002/health   # Social
curl http://localhost:3003/health   # AI Agentic
curl http://localhost:3004/health   # API Gateway aggregate health
curl http://localhost:3000          # Frontend
```

### Swagger UI

- HR Core: http://localhost:3001/api/docs
- Social: http://localhost:3002/api/docs
- AI Agentic: http://localhost:3003/api/docs
- API Gateway aggregate docs: http://localhost:3004/api/docs

## Turborepo Filter Commands

```bash
# Work on a single service
pnpm dev --filter=hr-core
pnpm dev --filter=@sentient/api-gateway
pnpm dev --filter=@sentient/web

# Run tests for one service
pnpm test --filter=hr-core

# Build only the shared package
pnpm build --filter=@sentient/shared
```

## Project Structure

```text
apps/
  hr-core/      # NestJS :3001 - IAM, org, employees, leaves, probation
  social/       # NestJS :3002 - announcements, events, exit surveys
  ai-agentic/   # NestJS :3003 - LangGraph agents, RAG, governance
  api-gateway/  # NestJS :3004 - public /api entry point
  web/          # Vite :3000 - frontend SPA
packages/
  shared/       # @sentient/shared - enums, interfaces, DTOs, event-bus, auth types
scripts/
  init-schemas.sql  # Idempotent DB setup (schemas + roles + pgvector)
```

## Environment Variables

There is no tracked `.env.example` — env files are gitignored repo-wide and each
service reads its own `apps/<service>/.env`. `.claude/rules/security.md` §7 lists
the full shared and per-service set; these are the ones a service will not start
without:

| Service | Required | Notes |
|---------|----------|-------|
| `hr-core` | `HR_CORE_DATABASE_URL`, `JWT_SECRET` | Unset DB URL silently falls back to libpq `PG*` defaults and fails to connect |
| `social` | `SOCIAL_DATABASE_URL` | Read with `getOrThrow` — the service throws on boot if it is missing |
| `ai-agentic` | `AI_AGENT_DATABASE_URL` | Plus at least one LLM provider key (`GEMINI_API_KEY`, `GROQ_API_KEY`, or `OPENROUTER_API_KEY`) for anything beyond the rules classifier |
| `api-gateway` | `JWT_SECRET` | Upstream URLs default to the local ports |

Everything else is optional and defaulted. `ai-agentic` and `api-gateway` declare
their full variable set with typed defaults in `src/config/*.config.ts`;
`hr-core` and `social` read theirs through `ConfigService`/`process.env` at the
point of use, so grep for `getOrThrow` and `config.get` in those two.

### Enabling the AI Analytics SQL branch (dev)

The Text-to-SQL analytics agent (`apps/ai-agentic`) ships disabled by default
(`AI_AGENT_ANALYTICS_SQL_ENABLED=false`) — merging it is inert until explicitly
turned on. To exercise it locally, add to `apps/ai-agentic/.env`:

```env
AI_AGENT_ANALYTICS_SQL_ENABLED=true
AI_AGENT_INTENT_DEBUG_LOGS=true   # optional: logs supervisor routing + gate diagnostics
```

Prerequisites, all three required — the branch fails closed on any of them, and a
missing view surfaces to the user as a generic "could not complete that query"
rather than a setup error:

1. `scripts/init-schemas.sql` has been run — creates the `ai_analytics_readonly`
   role, the `hr_analytics` schema, and the `USAGE` grant.
2. **HR Core migrations have been deployed** (`pnpm --filter hr-core exec prisma migrate deploy`)
   — `init-schemas.sql` only reserves the schema; migration
   `20260729000000_ai_analytics_views` is what creates the views themselves and
   their per-view `SELECT` grants.
3. The asking user holds a role in `MANAGER`, `TEAM_LEAD`, `HR_ADMIN`,
   `GLOBAL_HR_ADMIN`, or `EXECUTIVE` (`ANALYTICS_SQL_ROLES` in
   `apps/ai-agentic/src/modules/analytics-sql/analytics-schema-context.ts`).
   An `EMPLOYEE` is routed to the tool-calling Analytics Agent instead.

Before enabling it in any shared environment, satisfy the ship gate in
`apps/ai-agentic/test/integration/analytics-sql-scope.integration-spec.ts` by
running the suite with `AI_ANALYTICS_TEST_DATABASE_URL` set against a migrated,
seeded database. It is skipped — not failed — when that variable is absent.
