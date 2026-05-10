# Data Model: Sentient Monorepo Scaffold

**Feature**: `002-monorepo-scaffold`  
**Date**: 2026-04-06

*Note: This scaffold feature has no database entities — the Prisma schemas contain only datasource + generator declarations. This document describes the file manifest and environment variable schema instead.*

---

## File Manifest (Complete)

### Root Level

| File | Purpose |
|------|---------|
| `package.json` | Root workspace; `packageManager: pnpm@9.x.x`; scripts: `build`, `dev`, `test`, `lint`, `db:init` |
| `pnpm-workspace.yaml` | Declares `packages: ["apps/*", "packages/*"]` |
| `turbo.json` | Pipeline: build (^build), dev (persistent, no cache), test (depends build), lint |
| `tsconfig.base.json` | Strict TypeScript base extended by all services |
| `.env.example` | All environment variables documented |
| `.gitignore` | Standard Node + Prisma + OS ignores |
| `docker-compose.yml` | PostgreSQL 16 + pgvector service |
| `scripts/init-schemas.sql` | Idempotent schema + role + extension setup |

### packages/shared

| File | Purpose |
|------|---------|
| `packages/shared/package.json` | `name: @sentient/shared`; main/types point to `dist/` |
| `packages/shared/tsconfig.json` | Extends `../../tsconfig.base.json` |
| `packages/shared/src/index.ts` | Root barrel — re-exports all sub-barrels |
| `packages/shared/src/enums/index.ts` | Empty barrel — receives 32 enums feature-by-feature |
| `packages/shared/src/interfaces/index.ts` | Empty barrel |
| `packages/shared/src/dto/index.ts` | Empty barrel |
| `packages/shared/src/event-bus/index.ts` | Empty barrel — IEventBus, DomainEvent added in Phase 2 |
| `packages/shared/src/auth/index.ts` | Empty barrel — JwtPayload, AgentContext added with IAM module |

### apps/hr-core (repeated pattern for social + ai-agentic)

| File | Purpose |
|------|---------|
| `apps/hr-core/package.json` | `name: @sentient/hr-core`; scripts; deps including `@sentient/shared: workspace:*` |
| `apps/hr-core/tsconfig.json` | Extends `../../tsconfig.base.json`; paths alias |
| `apps/hr-core/tsconfig.build.json` | Excludes `test/` and `node_modules` |
| `apps/hr-core/nest-cli.json` | `sourceRoot: src`; `entryFile: main` |
| `apps/hr-core/src/main.ts` | Bootstrap: ValidationPipe, CORS, Swagger, port 3001 |
| `apps/hr-core/src/app.module.ts` | Imports: ConfigModule (global), PrismaModule |
| `apps/hr-core/src/app.controller.ts` | `GET /health` endpoint |
| `apps/hr-core/src/app.service.ts` | `getHealth()` returns status object |
| `apps/hr-core/src/prisma/prisma.module.ts` | `@Global() @Module` exports PrismaService |
| `apps/hr-core/src/prisma/prisma.service.ts` | Extends PrismaClient; onModuleInit/Destroy |
| `apps/hr-core/prisma/schema.prisma` | datasource + generator + `schemas = ["hr_core"]`; no models |
| `apps/hr-core/test/app.e2e-spec.ts` | Health endpoint smoke test |

### apps/web

| File | Purpose |
|------|---------|
| `apps/web/package.json` | `name: @sentient/web`; Next.js + Tailwind deps; `@sentient/shared: workspace:*` |
| `apps/web/tsconfig.json` | Next.js TypeScript config; extends `../../tsconfig.base.json` |
| `apps/web/next.config.ts` | Basic Next.js config; transpiles `@sentient/shared` |
| `apps/web/tailwind.config.ts` | Content paths, dark mode class, theme extensions |
| `apps/web/postcss.config.js` | Tailwind + Autoprefixer |
| `apps/web/src/app/layout.tsx` | Root layout; imports global CSS |
| `apps/web/src/app/globals.css` | Tailwind directives |
| `apps/web/src/app/page.tsx` | Placeholder home page |
| `apps/web/src/lib/api/hr-core.ts` | Typed client stub (exports empty object for now) |
| `apps/web/src/lib/api/social.ts` | Typed client stub |
| `apps/web/src/lib/api/ai.ts` | Typed client stub |

---

## Environment Variable Schema

### Root .env.example

```env
# ============================================================
# Sentient — Environment Variables
# Copy to .env in each service directory and fill in values.
# DO NOT commit .env files.
# ============================================================

# ── Shared / Cross-Service ──────────────────────────────────
JWT_SECRET=change-me-in-production-min-32-chars
JWT_EXPIRY=15m
SYSTEM_JWT_SECRET=change-me-system-secret-min-32-chars
SYSTEM_JWT_EXPIRY=5m

# ── OpenAI ─────────────────────────────────────────────────
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# ── HR Core (port 3001) ─────────────────────────────────────
HR_CORE_DATABASE_URL=postgresql://hr_core_svc:hr_core_pass@localhost:5432/sentient?schema=hr_core
HR_CORE_PORT=3001
FRONTEND_URL=http://localhost:3000

# ── Social (port 3002) ──────────────────────────────────────
SOCIAL_DATABASE_URL=postgresql://social_svc:social_pass@localhost:5432/sentient?schema=social
SOCIAL_PORT=3002
HR_CORE_URL=http://localhost:3001

# ── AI Agentic (port 3003) ──────────────────────────────────
AI_AGENT_DATABASE_URL=postgresql://ai_agent_svc:ai_pass@localhost:5432/sentient?schema=ai_agent
AI_ANALYTICS_DATABASE_URL=postgresql://ai_analytics_readonly:readonly_pass@localhost:5432/sentient?schema=hr_core
AI_AGENT_PORT=3003
SOCIAL_URL=http://localhost:3002

# ── Exit Survey & System JWTs ────────────────────────────────
SURVEY_TOKEN_SECRET=change-me-survey-secret
SURVEY_TOKEN_EXPIRY_DAYS=14

# ── Channels (Phase 4+) ──────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# ── Database (Docker) ────────────────────────────────────────
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=sentient
```

### Per-Service Required Variables (Scaffold Phase)

| Service | Required at Start | Optional (Phase 4+) |
|---------|------------------|---------------------|
| HR Core | `HR_CORE_DATABASE_URL`, `HR_CORE_PORT`, `JWT_SECRET`, `FRONTEND_URL` | `SLACK_BOT_TOKEN`, `TWILIO_*` |
| Social | `SOCIAL_DATABASE_URL`, `SOCIAL_PORT`, `JWT_SECRET`, `HR_CORE_URL`, `FRONTEND_URL` | same |
| AI Agentic | `AI_AGENT_DATABASE_URL`, `AI_AGENT_PORT`, `JWT_SECRET`, `HR_CORE_URL`, `SOCIAL_URL`, `OPENAI_API_KEY` | `AI_ANALYTICS_DATABASE_URL`, channels |

---

## Prisma Schema Templates (No Models)

### HR Core — `apps/hr-core/prisma/schema.prisma`

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../src/generated/prisma"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("HR_CORE_DATABASE_URL")
  schemas  = ["hr_core"]
}

// Models added feature-by-feature (IAM module next)
```

### Social — `apps/social/prisma/schema.prisma`

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../src/generated/prisma"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("SOCIAL_DATABASE_URL")
  schemas  = ["social"]
}
```

### AI Agentic — `apps/ai-agentic/prisma/schema.prisma`

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../src/generated/prisma"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("AI_AGENT_DATABASE_URL")
  schemas  = ["ai_agent"]
}
```

---

## Turborepo Pipeline Contract

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "src/generated/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

**Key rule**: `"^build"` means "build all workspace packages that this package depends on first." Because all services depend on `@sentient/shared`, the shared package always compiles before any service.
