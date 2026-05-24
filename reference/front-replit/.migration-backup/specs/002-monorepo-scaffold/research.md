# Research: Sentient Monorepo Scaffold

**Feature**: `002-monorepo-scaffold`  
**Date**: 2026-04-06  
**Status**: Complete — no NEEDS CLARIFICATION items in spec

---

## Decision 1: Package Manager — pnpm 9 with Corepack

**Decision**: pnpm 9.x enforced via `"packageManager": "pnpm@9.x.x"` in root `package.json`, activated by Node.js Corepack.

**Rationale**: CLAUDE.md explicitly specifies pnpm. pnpm workspaces provide strict dependency isolation (no phantom dependencies), faster installs than npm/yarn due to content-addressable storage, and native workspace protocol (`workspace:*`) that Turborepo understands natively.

**Alternatives considered**:
- npm workspaces — rejected per CLAUDE.md spec; no hoisting control.
- yarn workspaces — rejected per CLAUDE.md spec.

---

## Decision 2: Task Runner — Turborepo 2.x

**Decision**: Turborepo 2.x as the monorepo task runner, configured in `turbo.json` at the repo root.

**Rationale**: CLAUDE.md specifies Turborepo. Key pipeline behaviors:
- `build` task: `"dependsOn": ["^build"]` — the `^` prefix means "build all workspace dependencies first." This guarantees `@sentient/shared` compiles before any service tries to import it.
- `dev` task: `"cache": false, "persistent": true` — dev servers must not be cached and must run persistently.
- `test` task: `"dependsOn": ["build"]` — tests run after the service is built.
- `lint` task: no dependencies, fully parallel.

**Alternatives considered**:
- Nx — rejected per CLAUDE.md; Turborepo is explicitly specified.
- Plain npm scripts with concurrently — rejected; no dependency graph or caching.

---

## Decision 3: NestJS Bootstrap Scope — Minimal (Health Only)

**Decision**: Each NestJS service bootstrap includes only: `main.ts`, `app.module.ts`, `app.controller.ts` (health endpoint), `app.service.ts`, `PrismaModule`, and `ConfigModule`. No feature modules.

**Rationale**: The scaffold's purpose is structural foundation, not feature delivery. Adding IAM, guards, or decorators now would create partially implemented stubs that could mislead future developers. The health endpoint is the only endpoint needed to verify the service is up.

**Global pipes added at bootstrap**:
- `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true` — required by class-validator DTOs in all future modules.
- CORS enabled with `origin: process.env.FRONTEND_URL` (per CLAUDE.md security rules).

**Alternatives considered**:
- Including guard stubs now — rejected; guards without the IAM module are incomplete and misleading.
- Including Swagger setup — included, because Swagger adds zero complexity and would need to be added to every service anyway; better to do it once in bootstrap.

---

## Decision 4: Prisma Multi-Schema Setup

**Decision**: Use Prisma 5's `multiSchema` preview feature. Each service's `schema.prisma` declares:
- `previewFeatures = ["multiSchema"]` in the generator
- `schemas = ["<service_schema>"]` in the datasource
- No models in the scaffold — only the datasource and generator blocks

**Rationale**: Without `multiSchema`, Prisma cannot target a specific PostgreSQL schema (it defaults to `public`). The preview feature is stable enough for production use in Prisma 5 and is the canonical approach for schema-per-service isolation. Empty schemas (no models) are valid Prisma configs — they allow `prisma migrate dev` to be run immediately once models are added.

**Generator output**: `output = "../src/generated/prisma"` — generated client is inside the service `src/` directory, gitignored, and not shared across services.

**Alternatives considered**:
- One shared Prisma schema for all services — rejected; violates service isolation and CLAUDE.md architecture.
- Schema-based URL parameters (`?schema=hr_core`) without `multiSchema` — rejected; doesn't work correctly with Prisma migrations.

---

## Decision 5: init-schemas.sql Idempotency Strategy

**Decision**: All SQL statements use existence guards: `CREATE SCHEMA IF NOT EXISTS`, `CREATE EXTENSION IF NOT EXISTS`, and role creation wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`.

**Rationale**: The script must be re-runnable (FR-009, SC-005). PostgreSQL does not natively support `CREATE ROLE IF NOT EXISTS` before PG 16, so we use the `DO $$ ... EXCEPTION` pattern for backward compatibility. `CREATE SCHEMA IF NOT EXISTS` and `CREATE EXTENSION IF NOT EXISTS` are natively idempotent in all PostgreSQL versions we support (16+).

**Role structure created**:

| Role | Schema Access | Purpose |
|------|--------------|---------|
| `hr_core_svc` | USAGE + ALL on `hr_core` | HR Core service |
| `social_svc` | USAGE + ALL on `social` | Social service |
| `ai_agent_svc` | USAGE + ALL on `ai_agent` | AI Agentic service |
| `ai_analytics_readonly` | USAGE + SELECT on `hr_core` | Analytics Agent Text-to-SQL |

**Alternatives considered**:
- Flyway/Liquibase for schema management — rejected; overkill for a 4-statement init script.
- Terraform for DB provisioning — rejected; too heavy for a local dev setup.

---

## Decision 6: Shared Package Barrel Structure

**Decision**: Five sub-directories in `packages/shared/src/`: `enums/`, `interfaces/`, `dto/`, `event-bus/`, `auth/` — each with an empty `index.ts` barrel. The root `src/index.ts` re-exports all barrels.

**Rationale**: This matches the CLAUDE.md section 4 (`packages/shared/src/` structure) exactly. Empty barrels allow `import { X } from '@sentient/shared'` to work the moment the first export is added — no structural changes needed later.

**Build configuration**: `"main": "dist/index.js"`, `"types": "dist/index.d.ts"` in `package.json`. The shared package compiles to `dist/` and services import from the compiled output (not `src/` directly) — this is how `workspace:*` references work with Turborepo's build pipeline.

**Alternatives considered**:
- Single flat `index.ts` with all types — rejected; as the package grows to 32 enums and multiple interfaces, a flat file becomes unmanageable.
- Separate npm packages per concern (e.g., `@sentient/enums`, `@sentient/auth`) — rejected; over-engineering for a single project.

---

## Decision 7: ConfigModule Strategy

**Decision**: Each NestJS service uses `@nestjs/config` with `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })`. No Joi/Zod validation at scaffold stage — validation added when modules that need specific vars are implemented.

**Rationale**: `isGlobal: true` makes the ConfigService available everywhere without re-importing ConfigModule in feature modules. The `.env` file path is service-relative (resolved from the CWD where `node` is launched). Validation is deferred because the scaffold has no feature modules that require specific env vars yet.

**Alternatives considered**:
- `process.env` direct access — rejected per CLAUDE.md code-style rules.
- Zod schema validation at startup — deferred; adds complexity before any module uses the vars.

---

## Decision 8: Docker Compose Health Check

**Decision**: The PostgreSQL service in `docker-compose.yml` includes a health check using `pg_isready` so that dependent processes can wait for database readiness.

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 5s
  timeout: 5s
  retries: 5
```

**Rationale**: Without a health check, `docker compose up` returns before PostgreSQL is accepting connections, causing NestJS services to fail on the first connection attempt. The health check enables `depends_on: condition: service_healthy` in future compose profiles.

**Alternatives considered**:
- Shell `sleep 5` in startup scripts — rejected; fragile and slow.
- No health check — rejected; leads to race conditions during `turbo dev`.

---

## Decision 9: Next.js Frontend Scope

**Decision**: Minimal App Router bootstrap only — `layout.tsx`, `page.tsx`, Tailwind CSS configured, empty API client stubs. No authentication, no pages, no components beyond the placeholder home.

**Rationale**: The frontend is Month 3 work per CLAUDE.md timeline. Including more than the bootstrap now would either be incomplete stubs (misleading) or wasted effort (premature). The API client stubs (`hr-core.ts`, `social.ts`, `ai.ts`) are included because they define the directory structure that future work will populate.

**Tailwind**: Configured via `tailwind.config.ts` + `postcss.config.js` with `content: ["./src/**/*.{ts,tsx}"]`. Dark mode ready via `darkMode: 'class'` per CLAUDE.md frontend rules.

**Alternatives considered**:
- Skipping the frontend entirely — rejected; the spec explicitly includes it (FR-020, FR-021).
- Including shadcn/ui or component library setup — deferred to Month 3.
