# Developer Quickstart: Sentient Monorepo Scaffold

**Feature**: `002-monorepo-scaffold`  
**Date**: 2026-04-06  
**Time to first health check**: ~5 minutes

---

## Prerequisites

Verify these are installed before starting:

```bash
node --version        # must be v20.x.x
pnpm --version        # must be 9.x.x (install via: npm install -g pnpm@9)
docker --version      # must be 24+ or Docker Desktop
docker compose version # must be v2.x (not v1 `docker-compose`)
```

---

## Step 1 — Clone and Install

```bash
# From your projects directory
git clone <repo-url> sentient
cd sentient

# Install all workspace dependencies in one command
pnpm install
```

All five workspace packages (`hr-core`, `social`, `ai-agentic`, `web`, `shared`) install together. pnpm creates a single `node_modules` at the root with symlinked workspace packages.

---

## Step 2 — Start the Database

```bash
# Start PostgreSQL 16 + pgvector
docker compose up -d

# Wait for it to be healthy (usually 5–10 seconds)
docker compose ps
# STATUS column should show "healthy" for the db service
```

---

## Step 3 — Initialize the Database Schemas

This is a one-time step (or re-run safely if needed — it's idempotent):

```bash
# Connect as the postgres superuser and run the init script
docker compose exec db psql -U postgres -f /dev/stdin < scripts/init-schemas.sql

# Verify schemas were created
docker compose exec db psql -U postgres -c "\dn"
# Should list: hr_core, social, ai_agent (plus public)
```

---

## Step 4 — Configure Environment Variables

Each service needs a `.env` file. Copy the example and fill in values:

```bash
# HR Core
cp .env.example apps/hr-core/.env

# Social
cp .env.example apps/social/.env

# AI Agentic
cp .env.example apps/ai-agentic/.env

# Frontend (optional at this stage — no API calls yet)
cp .env.example apps/web/.env.local
```

**Minimum required values to edit** in each `.env` (for scaffold only):

```env
# apps/hr-core/.env
HR_CORE_DATABASE_URL=postgresql://hr_core_svc:hr_core_pass@localhost:5432/sentient?schema=hr_core
HR_CORE_PORT=3001
JWT_SECRET=any-random-32-char-string-for-local-dev
FRONTEND_URL=http://localhost:3000

# apps/social/.env
SOCIAL_DATABASE_URL=postgresql://social_svc:social_pass@localhost:5432/sentient?schema=social
SOCIAL_PORT=3002
JWT_SECRET=same-value-as-hr-core
HR_CORE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# apps/ai-agentic/.env
AI_AGENT_DATABASE_URL=postgresql://ai_agent_svc:ai_pass@localhost:5432/sentient?schema=ai_agent
AI_AGENT_PORT=3003
JWT_SECRET=same-value-as-hr-core
HR_CORE_URL=http://localhost:3001
SOCIAL_URL=http://localhost:3002
```

*Note: The DB role passwords (`hr_core_pass`, `social_pass`, `ai_pass`) must match what `init-schemas.sql` sets when it creates the roles.*

---

## Step 5 — Build the Shared Package

The shared package must be compiled before any service can start:

```bash
turbo build --filter=@sentient/shared
```

This produces `packages/shared/dist/` which the services import at runtime.

---

## Step 6 — Start All Services

```bash
turbo dev
```

This starts all three NestJS services and the Next.js frontend in watch mode. You should see:

```
hr-core:dev  | [Nest] LOG — Application is listening on port 3001
social:dev   | [Nest] LOG — Application is listening on port 3002
ai-agentic:dev | [Nest] LOG — Application is listening on port 3003
web:dev      | ▲ Next.js 14.x ready on http://localhost:3000
```

---

## Step 7 — Verify Health Checks

```bash
# HR Core
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"hr-core","timestamp":"..."}

# Social
curl http://localhost:3002/health
# Expected: {"status":"ok","service":"social","timestamp":"..."}

# AI Agentic
curl http://localhost:3003/health
# Expected: {"status":"ok","service":"ai-agentic","timestamp":"..."}

# Frontend
curl http://localhost:3000
# Expected: HTML response (placeholder home page)
```

All four should respond. If any service fails, check the terminal output for the specific error (usually a missing env var or DB connection issue).

---

## Single-Service Workflow

```bash
# Work on HR Core only
turbo dev --filter=hr-core

# Run HR Core tests
turbo test --filter=hr-core

# Build only the shared package
turbo build --filter=@sentient/shared

# Build everything
turbo build
```

---

## Common Issues

### "Cannot find module '@sentient/shared'"
The shared package hasn't been built. Run:
```bash
turbo build --filter=@sentient/shared
```

### "ECONNREFUSED" on service start
The database is not running. Run:
```bash
docker compose up -d
```

### "relation does not exist" in Prisma
The schemas were not initialized. Re-run:
```bash
docker compose exec db psql -U postgres -f /dev/stdin < scripts/init-schemas.sql
```

### "permission denied for schema hr_core"
The service is connecting with the wrong DB role, or the role wasn't created. Re-run `init-schemas.sql` and verify the `DATABASE_URL` in the service `.env` uses the correct role name.

### Port already in use
Another process is using port 3001/3002/3003. Stop it or change the `*_PORT` in the service `.env`.

---

## What's NOT in This Scaffold

- No Prisma models — added feature-by-feature starting with IAM module
- No authentication — added in the IAM module (Month 2)
- No feature endpoints beyond `/health`
- No React components beyond the placeholder home page
- No agent implementations — Month 4+

---

## Implementation Checklist (from tasks.md)

When implementing, files are created in this order:

```
[ ] Root config files (package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json)
[ ] .gitignore + .env.example
[ ] docker-compose.yml
[ ] scripts/init-schemas.sql
[ ] packages/shared/ (package.json, tsconfig.json, barrel files)
[ ] apps/hr-core/ (full bootstrap)
[ ] apps/social/ (full bootstrap)
[ ] apps/ai-agentic/ (full bootstrap)
[ ] apps/web/ (Next.js bootstrap)
[ ] Verify: pnpm install → turbo build → turbo dev → health checks pass
```
