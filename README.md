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

# 4. Configure environment files (one per service — .env.example is gitignored,
#    so create each apps/<service>/.env by hand; see "Environment Variables" below)
touch apps/hr-core/.env apps/social/.env apps/ai-agentic/.env apps/api-gateway/.env

# 5. Build all packages
pnpm build

# 6. Start all services in watch mode
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
service reads its own `apps/<service>/.env`. The authoritative list of variables
per service is its `src/config/*.config.ts` (e.g. `apps/ai-agentic/src/config/ai-agentic.config.ts`),
where every variable has a typed default; an unset variable falls back to that
default rather than failing to boot, so a minimal `.env` (or none at all, for a
service with no required secrets) is enough to start locally. See
`.claude/rules/security.md` §7 for the full shared/per-service variable reference.

### Enabling the AI Analytics SQL branch (dev)

The Text-to-SQL analytics agent (`apps/ai-agentic`) ships disabled by default
(`AI_AGENT_ANALYTICS_SQL_ENABLED=false`) — merging it is inert until explicitly
turned on. To exercise it locally, add to `apps/ai-agentic/.env`:

```env
AI_AGENT_ANALYTICS_SQL_ENABLED=true
AI_AGENT_INTENT_DEBUG_LOGS=true   # optional: logs supervisor routing + gate diagnostics
```

Requires a role in `MANAGER`, `TEAM_LEAD`, `HR_ADMIN`, `GLOBAL_HR_ADMIN`,
`EXECUTIVE` (see `apps/ai-agentic/src/modules/analytics-sql/analytics-schema-context.ts`)
and `scripts/init-schemas.sql` to have been run so the `ai_analytics_readonly`
role and `hr_analytics` schema exist.
