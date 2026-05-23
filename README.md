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

# 4. Configure environment files (one per service)
cp apps/hr-core/.env.example apps/hr-core/.env
cp apps/social/.env.example apps/social/.env
cp apps/ai-agentic/.env.example apps/ai-agentic/.env
cp apps/api-gateway/.env.example apps/api-gateway/.env

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

See `.env.example` for all environment variables.
