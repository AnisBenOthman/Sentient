# Feature Specification: Sentient Monorepo Scaffold

**Feature Branch**: `002-monorepo-scaffold`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "for the monorepo scaffold — the turbo.json, root package.json, docker-compose.yml, init-schemas.sql, and the three NestJS app bootstraps"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Runs the Full Stack Locally (Priority: P1)

A developer clones the repository, runs a single setup sequence, and has all three backend services and the database running locally within minutes — without manually configuring each service individually.

**Why this priority**: This is the foundation. No other development work can begin until the monorepo can be installed, built, and started in one sequence. Every subsequent module (IAM, Organization, Employees, AI Agents) depends on this scaffold existing.

**Independent Test**: From a clean clone, run `pnpm install` then `docker compose up -d` then `turbo dev` — all three NestJS services start, each logs its port (3001, 3002, 3003), and `GET http://localhost:3001/health` returns 200.

**Acceptance Scenarios**:

1. **Given** a developer has Node.js 20 and Docker installed, **When** they run `pnpm install` at the repo root, **Then** all workspace dependencies for all three services and the shared package install without error.
2. **Given** the database container is not running, **When** the developer runs `docker compose up -d`, **Then** a PostgreSQL 16 instance with the pgvector extension starts, and running `init-schemas.sql` creates the three schemas (`hr_core`, `social`, `ai_agent`) and the required database roles.
3. **Given** the database is running and schemas are initialized, **When** the developer runs `turbo dev`, **Then** all three NestJS services start in watch mode on ports 3001, 3002, and 3003 respectively, and a health endpoint on each returns 200.
4. **Given** the monorepo is set up, **When** a developer runs `turbo build`, **Then** all packages compile in dependency order (shared package first, then services) without TypeScript errors.

---

### User Story 2 - Developer Works on a Single Service in Isolation (Priority: P2)

A developer working on HR Core can start only that service, run its tests, and build it — without needing the other two services to be running.

**Why this priority**: The modular design principle requires each service to be independently runnable. A developer assigned to HR Core should not need Social or AI Agentic running to do their work.

**Independent Test**: `turbo dev --filter=hr-core` starts only the HR Core service on port 3001. `turbo test --filter=hr-core` runs only HR Core tests. Neither command starts Social or AI Agentic.

**Acceptance Scenarios**:

1. **Given** the monorepo is installed, **When** a developer runs `turbo dev --filter=hr-core`, **Then** only the HR Core service starts — Social and AI Agentic do not start.
2. **Given** the shared package is built, **When** a developer runs `turbo test --filter=ai-agentic`, **Then** only the AI Agentic service's tests execute.
3. **Given** a change is made in the shared package, **When** `turbo build` runs, **Then** all three services that depend on the shared package rebuild in the correct order (shared → services).

---

### User Story 3 - Developer Adds Code to the Shared Package (Priority: P3)

A developer adds a new enum or interface to the shared package and it is immediately available in all three services and the frontend without any manual copy-paste or re-linking.

**Why this priority**: The shared package is the single source of truth for enums, interfaces, DTOs, and the EventBus abstraction. Its workspace linking must work transparently so developers never need to manually distribute shared types.

**Independent Test**: Add a new exported constant to the shared package's enums barrel, build the shared package, then import it in the HR Core service — the import resolves without error.

**Acceptance Scenarios**:

1. **Given** a developer adds an export to the shared package, **When** the shared package is built, **Then** the export is importable via `@sentient/shared` in any service without reinstalling dependencies.
2. **Given** the shared package has a TypeScript error, **When** `turbo build` runs, **Then** the build fails at the shared package step before attempting to build any service — errors surface at the source, not in consumers.

---

### User Story 4 - Database Schemas and pgvector Are Ready for Prisma Migrations (Priority: P4)

A developer can run the Prisma migration commands for each service immediately after the scaffold is up — without needing to manually create schemas, extensions, or database roles.

**Why this priority**: The `init-schemas.sql` script is the bridge between the Docker database and Prisma. It creates the three schemas and the pgvector extension before any Prisma migrations run. Without it, all migration commands fail.

**Independent Test**: After `docker compose up -d`, run `psql -U postgres -f scripts/init-schemas.sql` — then `cd apps/hr-core && npx prisma migrate dev --name init` completes without schema or extension errors.

**Acceptance Scenarios**:

1. **Given** the database container is running, **When** `init-schemas.sql` is executed, **Then** three PostgreSQL schemas (`hr_core`, `social`, `ai_agent`) exist and the `pgvector` extension is enabled on the database.
2. **Given** the schemas are initialized, **When** `npx prisma migrate dev` runs for any of the three services, **Then** Prisma connects using the service-specific database URL and applies migrations to the correct schema without error.
3. **Given** `init-schemas.sql` is run a second time against the same database, **Then** it completes without errors — all statements are idempotent.
4. **Given** three service-specific database roles are created by `init-schemas.sql`, **When** each service connects, **Then** it uses its own role and cannot query another service's schema (permission denied at the database level).

---

### Edge Cases

- What happens when a developer runs `turbo dev` before `docker compose up -d`? Each service should fail at startup with a clear database connection error — not a cryptic import or compilation failure.
- What happens when port 3001, 3002, or 3003 is already in use? The service that cannot bind should log the port conflict clearly and exit — not hang silently.
- What happens when `pnpm install` is run without the correct pnpm version? The root `package.json` `packageManager` field specifies the required version — Corepack should surface a clear version mismatch error.
- What happens when the shared package is not built before a service starts in dev mode? The `turbo dev` pipeline must declare the shared package as a prerequisite so it is always built first — services should never start with stale shared types.
- What happens if `init-schemas.sql` is run twice? All statements use `IF NOT EXISTS` guards — re-running must produce zero errors and leave the database state unchanged.

---

## Requirements *(mandatory)*

### Functional Requirements

**Monorepo Root**

- **FR-001**: The repository root MUST have a single `package.json` declaring the workspace structure covering `apps/*` and `packages/*`.
- **FR-002**: The root `package.json` MUST specify the required package manager version so the correct tooling is enforced for all developers.
- **FR-003**: A `turbo.json` at the root MUST define pipeline tasks (`build`, `dev`, `test`, `lint`) with dependency declarations ensuring shared packages always build before their consumers.
- **FR-004**: The monorepo MUST have a root `.env.example` file listing all required environment variables for all services with placeholder values and inline comments explaining each variable.
- **FR-005**: A root `.gitignore` MUST exclude dependency directories, build outputs, environment files, Prisma generated clients, and OS artifacts.
- **FR-006**: A root `tsconfig.base.json` MUST enforce strict TypeScript settings that all service configs extend.

**Docker and Database**

- **FR-007**: A `docker-compose.yml` at the root MUST define a PostgreSQL 16 + pgvector service with a named volume for data persistence and a health check so dependent processes can wait for readiness.
- **FR-008**: The database service MUST expose port 5432 to the host and use environment variables for credentials — no hardcoded passwords in the compose file.
- **FR-009**: A `scripts/init-schemas.sql` file MUST create three schemas (`hr_core`, `social`, `ai_agent`), enable the `pgvector` extension, and create three service roles (`hr_core_svc`, `social_svc`, `ai_agent_svc`) with schema-scoped GRANT permissions — all idempotent.
- **FR-010**: The `init-schemas.sql` MUST also create a read-only analytics role (`ai_analytics_readonly`) with SELECT-only access to the `hr_core` schema for the Analytics Agent's Text-to-SQL capability.

**Shared Package**

- **FR-011**: A `packages/shared/` package MUST exist with `package.json` exporting as `@sentient/shared` and a `tsconfig.json` extending the root base config.
- **FR-012**: The shared package MUST contain barrel files for `enums/`, `interfaces/`, `dto/`, `event-bus/`, and `auth/` sub-directories — empty but structurally ready.
- **FR-013**: Each of the three service `package.json` files and the frontend `package.json` MUST declare `@sentient/shared` as a workspace dependency.

**NestJS Service Bootstraps**

- **FR-014**: Each of the three NestJS services MUST have a working bootstrap: `main.ts` (global validation pipe, CORS), `app.module.ts`, `app.controller.ts`, and `app.service.ts`.
- **FR-015**: Each service MUST expose a health endpoint at `GET /health` returning `{ status, service, timestamp }` without requiring authentication.
- **FR-016**: Each service MUST have its own `tsconfig.json`, `nest-cli.json`, and `package.json` with `dev`, `build`, `start`, `start:prod`, and `test` scripts.
- **FR-017**: Each service MUST have its own `prisma/schema.prisma` with the correct datasource URL env var, `schemas` declaration for its schema only, and generator output path to `../src/generated/prisma`.
- **FR-018**: Each service MUST use a `ConfigModule` for all environment variable access — direct `process.env` calls outside the config setup are not permitted.
- **FR-019**: Each service MUST include a `PrismaModule` and `PrismaService` as shared infrastructure within that service, ready to be injected by feature modules.

**Next.js Frontend Bootstrap**

- **FR-020**: An `apps/web/` directory MUST exist with a minimal Next.js 14+ App Router bootstrap: `app/layout.tsx`, `app/page.tsx`, `next.config.ts`, and `tailwind.config.ts`.
- **FR-021**: The frontend MUST have a `src/lib/api/` directory with empty typed client stub files for `hr-core.ts`, `social.ts`, and `ai.ts`.

### Key Entities

- **Workspace**: The root monorepo configuration binding all apps and packages with a single install and unified task runner pipeline.
- **Shared Package**: The cross-cutting module (`@sentient/shared`) providing enums, interfaces, DTOs, and event bus types to all services and the frontend without circular dependencies.
- **Service Bootstrap**: The minimal runnable NestJS application for each microservice — health check, config, and Prisma wired up; no feature modules yet.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with Node.js 20 and Docker can go from a clean clone to all three services responding to health checks in under 5 minutes, following only the documented setup steps.
- **SC-002**: `turbo build` completes for the entire monorepo with zero TypeScript errors on the first run after setup.
- **SC-003**: Each service health endpoint responds within 500ms of the service process starting — confirming the bootstrap adds no unnecessary startup overhead.
- **SC-004**: Running `turbo dev --filter=<service>` starts exactly one service — no other service processes are spawned.
- **SC-005**: `init-schemas.sql` can be executed multiple times against the same running database without any errors — 100% idempotent.
- **SC-006**: Adding an export to the shared package and building it makes that export importable in all services without reinstalling or relinking — verified in under 30 seconds.
- **SC-007**: Each service's database role cannot execute queries against another service's schema — a cross-schema query attempt returns a permission denied error.

---

## Assumptions

- The target development environment is a developer workstation with Node.js 20 LTS, pnpm 9.x, and Docker Desktop (or Docker Engine on Linux) installed.
- The monorepo uses pnpm workspaces exclusively — npm and yarn workspaces are not used.
- Turborepo is the task runner; no Nx, Lerna, or other monorepo tools are introduced.
- All three NestJS services start with only a health endpoint — no feature modules are included in this scaffold. Feature modules are added one-by-one in subsequent implementation features.
- The Next.js frontend bootstrap is in scope but minimal — no pages, authentication, or API call implementations are included.
- The PostgreSQL instance is shared (one container, three schemas, three roles) — not three separate database containers.
- The `pgvector` extension is installed once at the database level and shared across all schemas.
- Each service reads environment variables from its own `.env` file; the root `.env.example` documents all variables but is not loaded by any service directly.
- The Prisma schemas for this scaffold contain only the datasource, generator, and `schemas` declarations — no models. Models are added feature-by-feature.
- A single `docker-compose.yml` at the root handles the database for local development; no separate per-service compose files.
- The `scripts/` directory at the root is for setup and utility scripts only — not deployed to production.
