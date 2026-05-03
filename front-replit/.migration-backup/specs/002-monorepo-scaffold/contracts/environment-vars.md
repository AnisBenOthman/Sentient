# Contract: Environment Variables

**Feature**: `002-monorepo-scaffold`  
**Source**: `root/.env.example` + per-service `.env` files

All services read configuration exclusively through `ConfigService` from `@nestjs/config`. Direct `process.env` access is not permitted outside of the root `ConfigModule` setup.

---

## HR Core (apps/hr-core/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HR_CORE_DATABASE_URL` | ✅ | — | PostgreSQL connection string for the `hr_core` schema using the `hr_core_svc` role |
| `HR_CORE_PORT` | ✅ | `3001` | Port the service listens on |
| `JWT_SECRET` | ✅ | — | Secret used to sign and verify user JWTs (minimum 32 chars) |
| `JWT_EXPIRY` | ❌ | `15m` | JWT access token expiry duration |
| `SYSTEM_JWT_SECRET` | ❌ | — | Secret for SYSTEM-role JWTs (added when AI Agentic is wired) |
| `SYSTEM_JWT_EXPIRY` | ❌ | `5m` | SYSTEM JWT expiry (short-lived) |
| `FRONTEND_URL` | ✅ | `http://localhost:3000` | CORS allowed origin |

---

## Social (apps/social/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOCIAL_DATABASE_URL` | ✅ | — | PostgreSQL connection string for the `social` schema using the `social_svc` role |
| `SOCIAL_PORT` | ✅ | `3002` | Port the service listens on |
| `JWT_SECRET` | ✅ | — | Shared JWT secret for token validation (same value as HR Core) |
| `HR_CORE_URL` | ✅ | `http://localhost:3001` | Base URL of the HR Core service for inter-service calls |
| `FRONTEND_URL` | ✅ | `http://localhost:3000` | CORS allowed origin |
| `SURVEY_TOKEN_SECRET` | ❌ | — | Secret for exit survey scoped tokens (added with Exit Survey module) |
| `SURVEY_TOKEN_EXPIRY_DAYS` | ❌ | `14` | Exit survey token validity in days |

---

## AI Agentic (apps/ai-agentic/.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_AGENT_DATABASE_URL` | ✅ | — | PostgreSQL connection string for the `ai_agent` schema using the `ai_agent_svc` role |
| `AI_ANALYTICS_DATABASE_URL` | ❌ | — | Read-only connection string using `ai_analytics_readonly` role on `hr_core` (added with Analytics Agent) |
| `AI_AGENT_PORT` | ✅ | `3003` | Port the service listens on |
| `JWT_SECRET` | ✅ | — | Shared JWT secret for token validation |
| `SYSTEM_JWT_SECRET` | ❌ | — | Secret for minting SYSTEM JWTs (added with AI Agentic agents) |
| `HR_CORE_URL` | ✅ | `http://localhost:3001` | Base URL of HR Core for inter-service calls |
| `SOCIAL_URL` | ✅ | `http://localhost:3002` | Base URL of Social for inter-service calls |
| `OPENAI_API_KEY` | ❌ | — | OpenAI API key (required when AI agents are implemented, Month 4) |
| `OPENAI_EMBEDDING_MODEL` | ❌ | `text-embedding-3-small` | Embedding model for RAG pipeline |

---

## Next.js Frontend (apps/web/.env.local)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_HR_CORE_URL` | ❌ | `http://localhost:3001` | HR Core base URL for client-side API calls |
| `NEXT_PUBLIC_SOCIAL_URL` | ❌ | `http://localhost:3002` | Social base URL |
| `NEXT_PUBLIC_AI_URL` | ❌ | `http://localhost:3003` | AI Agentic base URL |

*Note: `NEXT_PUBLIC_*` vars are exposed to the browser. Internal API routes in `app/api/` use the non-public server-side vars.*

---

## Docker Compose Variables (root .env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | ✅ | `postgres` | PostgreSQL superuser name |
| `POSTGRES_PASSWORD` | ✅ | — | PostgreSQL superuser password |
| `POSTGRES_DB` | ✅ | `sentient` | Default database name |

---

## Variable Naming Conventions

- Service-specific vars are prefixed with the service name: `HR_CORE_`, `SOCIAL_`, `AI_AGENT_`
- Cross-service shared vars (`JWT_SECRET`) use the same value in all services — copied into each service's `.env`
- `NEXT_PUBLIC_` prefix exposes vars to the browser (Next.js convention)
- All secrets use a minimum of 32 random characters in production
