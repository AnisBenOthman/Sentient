# Tasks: Sentient Monorepo Scaffold

**Input**: Design documents from `/specs/002-monorepo-scaffold/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested — no test task generation. A final end-to-end verification task is included in the Polish phase.

**Organization**: Tasks are grouped by user story. US1 (full stack locally) is the largest phase because all three NestJS bootstraps must exist before the stack can run.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared state)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])
- All paths are relative to the repository root

---

## Phase 1: Setup (Root Configuration Files)

**Purpose**: Create the monorepo root configuration that all workspace packages depend on. These files must exist before `pnpm install` can be run.

- [x] T001 Create `package.json` at repo root — set `"name": "sentient"`, `"private": true`, `"packageManager": "pnpm@9.15.4"`, `"workspaces"` field pointing to `pnpm-workspace.yaml`, and root-level scripts: `"build": "turbo build"`, `"dev": "turbo dev"`, `"test": "turbo test"`, `"lint": "turbo lint"`, `"type-check": "turbo type-check"`, `"db:init": "psql -U postgres -f scripts/init-schemas.sql"`; add `turbo` and `typescript` as `devDependencies`
- [x] T002 Create `pnpm-workspace.yaml` at repo root — declare `packages: ["apps/*", "packages/*"]`
- [x] T003 [P] Create `turbo.json` at repo root — define pipeline per `contracts/turbo-pipeline.md`: `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**", ".next/**", "src/generated/**"]`), `dev` (`cache: false`, `persistent: true`, `dependsOn: ["^build"]`), `test` (`dependsOn: ["build"]`, `outputs: ["coverage/**"]`), `lint` (no deps), `type-check` (`dependsOn: ["^build"]`)
- [x] T004 [P] Create `tsconfig.base.json` at repo root — enable strict TypeScript: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitReturns": true`, `"forceConsistentCasingInFileNames": true`, `"esModuleInterop": true`, `"skipLibCheck": true`, `"moduleResolution": "bundler"` (or `"node16"`), `"target": "ES2021"`, `"module": "commonjs"`
- [x] T005 [P] Create `.gitignore` at repo root — include: `node_modules/`, `dist/`, `.next/`, `build/`, `*.log`, `.env`, `.env.local`, `.env*.local`, `apps/*/src/generated/`, `coverage/`, `.DS_Store`, `Thumbs.db`, `*.swp`, `*.tmp`, `pnpm-debug.log`, `turbo/`
- [x] T006 [P] Create `.env.example` at repo root — full template per `contracts/environment-vars.md`: all variables for all services with placeholder values and inline comments explaining each; include `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, all service DATABASE_URLs, PORT vars, JWT_SECRET, SYSTEM_JWT_SECRET, OPENAI_API_KEY, channel tokens, and SURVEY vars

---

## Phase 2: Foundational (Docker + Database + Shared Package)

**Purpose**: The database and shared package are blocking prerequisites for all user stories. No NestJS service can start without DB access and no service can compile without `@sentient/shared` being buildable.

**⚠️ CRITICAL**: Phase 1 must be complete (`pnpm install` must succeed) before this phase begins.

- [x] T007 Create `docker-compose.yml` at repo root — define a single service named `db` using `image: pgvector/pgvector:pg16`; set environment vars from `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`); expose `port: 5432:5432`; add named volume `postgres_data`; add health check: `test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]`, `interval: 5s`, `timeout: 5s`, `retries: 5`; declare `volumes: postgres_data:` at bottom
- [x] T008 Create `scripts/init-schemas.sql` — idempotent script per `contracts/environment-vars.md` and research Decision 5: `CREATE EXTENSION IF NOT EXISTS vector;`, `CREATE SCHEMA IF NOT EXISTS hr_core;`, `CREATE SCHEMA IF NOT EXISTS social;`, `CREATE SCHEMA IF NOT EXISTS ai_agent;`; create four roles with idempotent `DO $$ BEGIN CREATE ROLE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` pattern: `hr_core_svc` (USAGE+ALL on hr_core), `social_svc` (USAGE+ALL on social), `ai_agent_svc` (USAGE+ALL on ai_agent), `ai_analytics_readonly` (USAGE+SELECT on hr_core only); GRANT schema USAGE and table privileges to each role; add `ALTER DEFAULT PRIVILEGES` so future tables inherit grants
- [x] T009 Create `packages/shared/package.json` — `"name": "@sentient/shared"`, `"version": "0.0.1"`, `"private": true`, `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`, `"scripts": { "build": "tsc", "dev": "tsc --watch", "lint": "eslint src --ext .ts", "type-check": "tsc --noEmit" }`, add `typescript` as devDependency
- [x] T010 Create `packages/shared/tsconfig.json` — `"extends": "../../tsconfig.base.json"`, `"compilerOptions": { "outDir": "dist", "rootDir": "src", "declaration": true, "declarationMap": true }`, `"include": ["src"]`, `"exclude": ["dist", "node_modules"]`
- [x] T011 [P] Create `packages/shared/src/index.ts` — root barrel that re-exports all sub-barrels: `export * from './enums';`, `export * from './interfaces';`, `export * from './dto';`, `export * from './event-bus';`, `export * from './auth';`
- [x] T012 [P] Create `packages/shared/src/enums/index.ts` — empty barrel with comment: `// Enums are added here feature-by-feature. See CLAUDE.md section 8 for the full 32-enum registry.`
- [x] T013 [P] Create `packages/shared/src/interfaces/index.ts` — empty barrel with comment: `// Entity interfaces (read-only contracts) added per module.`
- [x] T014 [P] Create `packages/shared/src/dto/index.ts` — empty barrel with comment: `// Shared DTOs for inter-service calls added per feature.`
- [x] T015 [P] Create `packages/shared/src/event-bus/index.ts` — empty barrel with comment: `// IEventBus, DomainEvent<T>, REST transport added in Phase 1. Kafka transport added in Phase 2.`
- [x] T016 [P] Create `packages/shared/src/auth/index.ts` — empty barrel with comment: `// JwtPayload, AgentContext, SystemJwtPayload added with IAM module.`

**Checkpoint**: Run `turbo build --filter=@sentient/shared` — compiles to `packages/shared/dist/` with zero TypeScript errors.

---

## Phase 3: User Story 1 — Developer Runs the Full Stack Locally (Priority: P1) 🎯 MVP

**Goal**: All three NestJS services and the Next.js frontend bootstrap in watch mode, each with a working health endpoint. Running `turbo dev` produces four running processes and `curl localhost:3001/health` returns 200.

**Independent Test**: `pnpm install` → `docker compose up -d` → `psql ... < scripts/init-schemas.sql` → configure `.env` files → `turbo build --filter=@sentient/shared` → `turbo dev` → `curl` all four health/home endpoints and receive 200 responses.

### HR Core Bootstrap (reference implementation — social and ai-agentic follow the same pattern)

- [x] T017 [US1] Create `apps/hr-core/package.json` — `"name": "@sentient/hr-core"`, `"version": "0.0.1"`, `"private": true`; scripts: `"build": "nest build"`, `"dev": "nest start --watch"`, `"start": "nest start"`, `"start:prod": "node dist/main"`, `"test": "jest"`, `"lint": "eslint src --ext .ts"`, `"type-check": "tsc --noEmit"`; dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`, `@prisma/client`, `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`; devDependencies: `@nestjs/cli`, `@nestjs/testing`, `prisma`, `typescript`, `@types/node`, `@types/express`, `ts-jest`, `jest`; add `"@sentient/shared": "workspace:*"` to dependencies
- [x] T018 [P] [US1] Create `apps/hr-core/tsconfig.json` — `"extends": "../../tsconfig.base.json"`, add NestJS-specific options: `"emitDecoratorMetadata": true`, `"experimentalDecorators": true`, `"outDir": "dist"`, `"baseUrl": "."`, paths alias `"@/*": ["src/*"]`; AND create `apps/hr-core/tsconfig.build.json` — extends `./tsconfig.json`, `"exclude": ["node_modules", "test", "dist", "**/*spec.ts"]`; AND create `apps/hr-core/nest-cli.json` — `{ "collection": "@nestjs/cli", "$schema": "...", "sourceRoot": "src", "entryFile": "main" }`
- [x] T019 [US1] Create `apps/hr-core/prisma/schema.prisma` — datasource block with `provider = "postgresql"`, `url = env("HR_CORE_DATABASE_URL")`, `schemas = ["hr_core"]`; generator block with `provider = "prisma-client-js"`, `output = "../src/generated/prisma"`, `previewFeatures = ["multiSchema"]`; add comment: `// Models are added feature-by-feature. Next: IAM module (User, Role, Permission, Session).`
- [x] T020 [US1] Create `apps/hr-core/src/prisma/prisma.service.ts` — `@Injectable() export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy`; `onModuleInit()` calls `this.$connect()`; `onModuleDestroy()` calls `this.$disconnect()`; import `PrismaClient` from `'../generated/prisma'` (generated path); AND create `apps/hr-core/src/prisma/prisma.module.ts` — `@Global() @Module({ providers: [PrismaService], exports: [PrismaService] }) export class PrismaModule {}`
- [x] T021 [US1] Create `apps/hr-core/src/app.service.ts` — `@Injectable() export class AppService { getHealth() { return { status: 'ok', service: 'hr-core', timestamp: new Date().toISOString() }; } }`; AND create `apps/hr-core/src/app.controller.ts` — `@Controller() export class AppController`; `@Get('health') @ApiOperation({ summary: 'Service health check' }) getHealth() { return this.appService.getHealth(); }`; no auth guards on this endpoint
- [x] T022 [US1] Create `apps/hr-core/src/app.module.ts` — import `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' })` and `PrismaModule`; declare `AppController` and `AppService`; AND create `apps/hr-core/src/main.ts` — bootstrap: `const app = await NestFactory.create(AppModule)`; `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`; `app.enableCors({ origin: configService.get('FRONTEND_URL'), credentials: true })`; setup Swagger with `SwaggerModule.setup('api/docs', app, document)`; `await app.listen(configService.get('HR_CORE_PORT') ?? 3001)`

### Social Service Bootstrap

- [x] T023 [P] [US1] Create complete Social service bootstrap in `apps/social/` — mirror the HR Core bootstrap (T017–T022) with these differences: `"name": "@sentient/social"`, port `SOCIAL_PORT` defaulting to `3002`, database URL env var `SOCIAL_DATABASE_URL`, Prisma schema `schemas = ["social"]`, health response `service: 'social'`; include same 10 files: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `prisma/schema.prisma`, `src/prisma/prisma.service.ts`, `src/prisma/prisma.module.ts`, `src/app.service.ts`, `src/app.controller.ts`, `src/app.module.ts`, `src/main.ts`

### AI Agentic Service Bootstrap

- [x] T024 [P] [US1] Create complete AI Agentic service bootstrap in `apps/ai-agentic/` — mirror the HR Core bootstrap with: `"name": "@sentient/ai-agentic"`, port `AI_AGENT_PORT` defaulting to `3003`, database URL env var `AI_AGENT_DATABASE_URL`, Prisma schema `schemas = ["ai_agent"]`, health response `service: 'ai-agentic'`; include the same 11 files as Social (T023)

### Next.js Frontend Bootstrap

- [x] T025 [P] [US1] Create `apps/web/package.json` — `"name": "@sentient/web"`, scripts: `"build": "next build"`, `"dev": "next dev"`, `"start": "next start"`, `"lint": "next lint"`, `"type-check": "tsc --noEmit"`; dependencies: `next` (14+), `react`, `react-dom`, `tailwindcss`, `postcss`, `autoprefixer`, `@sentient/shared: workspace:*`; devDependencies: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`
- [x] T026 [P] [US1] Create `apps/web/tsconfig.json` — Next.js TypeScript config extending `../../tsconfig.base.json`; add `"jsx": "preserve"`, `"lib": ["dom", "dom.iterable", "esnext"]`, `"allowJs": true`, `"incremental": true`; `"paths": { "@/*": ["./src/*"] }`; AND create `apps/web/next.config.ts` — basic config with `transpilePackages: ['@sentient/shared']` so the shared package is compiled by Next.js; AND create `apps/web/postcss.config.js` — `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }`
- [x] T027 [US1] Create `apps/web/tailwind.config.ts` — `content: ["./src/**/*.{ts,tsx,js,jsx}"]`, `darkMode: 'class'`, empty theme extensions placeholder; AND create `apps/web/src/app/globals.css` — Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`); AND create `apps/web/src/app/layout.tsx` — root layout importing `globals.css`, basic HTML structure with `<html lang="en">` and `<body>`; AND create `apps/web/src/app/page.tsx` — placeholder: `export default function Home() { return <main><h1>Sentient HRIS</h1><p>Coming soon.</p></main>; }`
- [x] T028 [US1] Create the three API client stubs: `apps/web/src/lib/api/hr-core.ts` — `// HR Core API client — populated with the IAM module\nexport const hrCoreApi = {};`; `apps/web/src/lib/api/social.ts` — same pattern; `apps/web/src/lib/api/ai.ts` — same pattern

**Checkpoint**: `turbo dev` starts all four processes. `curl http://localhost:3001/health`, `curl http://localhost:3002/health`, `curl http://localhost:3003/health` all return `{"status":"ok",...}`. `curl http://localhost:3000` returns HTML.

---

## Phase 4: User Story 2 — Developer Works on a Single Service in Isolation (Priority: P2)

**Goal**: Confirm that Turborepo filter commands work correctly so a developer can target exactly one service without starting the others.

**Independent Test**: `turbo dev --filter=hr-core` starts only `hr-core:dev` in the terminal output — no `social:dev` or `ai-agentic:dev` processes appear.

### Implementation for User Story 2

- [x] T029 [US2] Verify all four services have the required Turborepo-compatible scripts in their `package.json`: open each of `apps/hr-core/package.json`, `apps/social/package.json`, `apps/ai-agentic/package.json`, `apps/web/package.json` and confirm `build`, `dev`, `test`, `lint`, `type-check` scripts exist with the correct commands; fix any missing scripts now (should match what T017, T023, T024, T025 created)
- [x] T030 [US2] Add `"dev"` task dependency configuration to `turbo.json` for the shared package: ensure `packages/shared/package.json` has `"dev": "tsc --watch"` so `turbo dev` also rebuilds the shared package in watch mode when its source changes; update `turbo.json` if the `dev` pipeline needs explicit outputs for the shared package

**Checkpoint**: `turbo dev --filter=hr-core` output shows exactly `hr-core:dev` and `shared:build` processes — Social and AI Agentic do not appear. `turbo dev --filter=@sentient/web` shows only `web:dev` and `shared:build`.

---

## Phase 5: User Story 3 — Developer Adds Code to the Shared Package (Priority: P3)

**Goal**: Confirm the workspace:* linking and Turborepo build pipeline correctly propagate shared package changes to all consumers.

**Independent Test**: Add `export const SENTIENT_VERSION = '0.0.1';` to `packages/shared/src/index.ts`, run `turbo build --filter=@sentient/shared`, then add `import { SENTIENT_VERSION } from '@sentient/shared';` to `apps/hr-core/src/main.ts` and run `turbo type-check --filter=hr-core` — it must resolve without error.

### Implementation for User Story 3

- [x] T031 [US3] Verify `packages/shared/package.json` has correct `main`, `types`, and `exports` fields pointing to `dist/`: `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`, and optionally `"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }`; run `turbo build --filter=@sentient/shared` and confirm `packages/shared/dist/` is created with `index.js` and `index.d.ts`
- [x] T032 [US3] Add a smoke import to `apps/hr-core/src/main.ts` to verify workspace linking: add `import '@sentient/shared';` (side-effect import) at the top; run `turbo type-check --filter=hr-core`; confirm it resolves; then remove the import — this task is purely a verification step, the import should not remain in the final file

**Checkpoint**: `turbo build` compiles the entire monorepo in the correct order (shared → services → web) with zero TypeScript errors.

---

## Phase 6: User Story 4 — Database Schemas Ready for Prisma Migrations (Priority: P4)

**Goal**: A developer can immediately run `npx prisma migrate dev` for any service after the scaffold is set up — no manual schema or role creation needed beyond running `init-schemas.sql`.

**Independent Test**: Run `docker compose up -d` → `psql ... < scripts/init-schemas.sql` (twice — confirm idempotency) → `cd apps/hr-core && npx prisma validate` → `npx prisma migrate dev --name init` completes without errors.

### Implementation for User Story 4

- [x] T033 [US4] Create per-service `.env` files from `.env.example`: copy and fill minimum required values for each service (per `contracts/environment-vars.md`); create `apps/hr-core/.env`, `apps/social/.env`, `apps/ai-agentic/.env` with the correct `DATABASE_URL`, `PORT`, and `JWT_SECRET` values pointing to the Docker database with the correct per-service roles; add all three `.env` file paths to `.gitignore` if not already excluded by the `*.env` pattern
- [x] T034 [US4] Validate all three Prisma schemas: from `apps/hr-core/` run `npx prisma validate`; from `apps/social/` run `npx prisma validate`; from `apps/ai-agentic/` run `npx prisma validate`; all three must pass with "The schema at prisma/schema.prisma is valid" — fix any datasource or generator syntax errors found; also run `npx prisma generate` in each service to confirm the generated client is created at `src/generated/prisma/` (note: no migrations yet — just validation and client generation)
- [x] T035 [US4] Test `init-schemas.sql` idempotency: run the script a second time against the running database (`psql -U postgres -f scripts/init-schemas.sql`) and confirm zero errors; verify all four roles exist using `psql -U postgres -c "\du"` and confirm `hr_core_svc`, `social_svc`, `ai_agent_svc`, `ai_analytics_readonly` are listed; verify all three schemas exist with `psql -U postgres -c "\dn"`

**Checkpoint**: `npx prisma validate` passes for all three services. `init-schemas.sql` runs twice without errors. All four DB roles exist.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, README documentation, and cleanup to confirm the scaffold meets all success criteria from the spec.

- [x] T036 [P] Create `README.md` at repo root — document the project overview, prerequisites (Node 20, pnpm 9, Docker), the 6-step quickstart sequence from `quickstart.md` (condensed), turbo filter usage examples, and links to the `.env.example`; keep it under 100 lines — not a comprehensive guide, just the minimum a new developer needs to get started
- [x] T037 End-to-end verification: follow the quickstart.md step-by-step in a clean shell session (do not rely on anything already running): `pnpm install` → `docker compose up -d` → `psql ... < scripts/init-schemas.sql` → configure `.env` files → `turbo build` → `turbo dev` → curl all health endpoints; document any failures and fix them; this task is complete when all four health endpoints return 200 and `turbo build` exits with code 0
- [x] T038 [P] Add `apps/*/src/generated/` and `packages/shared/dist/` to `.gitignore` if not already present (Prisma generated clients and shared package builds must never be committed); also add `apps/web/.next/` and `apps/web/out/` to `.gitignore`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 complete (`pnpm install` needs `package.json` + `pnpm-workspace.yaml`); BLOCKS all user stories
- **Phase 3 (US1)**: Requires Phase 2 complete (shared package must build; Docker DB must be running)
- **Phase 4 (US2)**: Requires Phase 3 complete (services must exist to test filter isolation)
- **Phase 5 (US3)**: Requires Phase 2 complete (shared package must compile); can run in parallel with Phase 3
- **Phase 6 (US4)**: Requires Phase 2 complete (Docker + init SQL) and Phase 3 complete (Prisma schemas in services); can run partially in parallel with Phase 4/5
- **Phase 7 (Polish)**: Requires all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Requires Foundational — all NestJS bootstraps needed for `turbo dev` to work
- **US2 (P2)**: Requires US1 — services must exist to verify filter isolation
- **US3 (P3)**: Requires Foundational only — shared package pipeline is independent of NestJS bootstraps
- **US4 (P4)**: Requires Foundational (Docker + SQL) + US1 (Prisma schemas in services)

### Parallel Opportunities

**Within Phase 1**: T003, T004, T005, T006 are all independent root-level config files — create in parallel after T001 and T002.

**Within Phase 2**: T011–T016 (all 6 shared barrel files) are fully parallel after T009 and T010.

**Within Phase 3**: After HR Core (T017–T022) is complete as the reference implementation:
- T023 (Social bootstrap) and T024 (AI Agentic bootstrap) are fully parallel — different directories
- T025, T026, T027, T028 (Next.js bootstrap) can run in parallel with T023 and T024

**Phase 5 (US3)** can start in parallel with Phase 3 (US1) once Phase 2 is done.

---

## Parallel Example: Phase 1 Root Config

```
Sequential:
  T001: Create root package.json
  T002: Create pnpm-workspace.yaml

Then parallel (all independent files):
  T003: Create turbo.json
  T004: Create tsconfig.base.json
  T005: Create .gitignore
  T006: Create .env.example
```

## Parallel Example: Phase 3 Service Bootstraps

```
Sequential (HR Core as reference):
  T017 → T018 → T019 → T020 → T021 → T022

Then parallel (independent service directories):
  T023: Social bootstrap     ─┬─ can all run simultaneously
  T024: AI Agentic bootstrap  │  after HR Core is complete
  T025: web package.json     ─┤
  T026: web configs          ─┤
  T027: web Tailwind + app   ─┤
  T028: web API client stubs ─┘
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup root config (T001–T006)
2. Phase 2: Docker + DB + shared package (T007–T016)
3. `pnpm install` — verify workspace installs without error
4. `turbo build --filter=@sentient/shared` — verify shared compiles
5. Phase 3: HR Core bootstrap only (T017–T022) — 6 tasks
6. **STOP and VALIDATE**: `turbo dev --filter=hr-core` → `curl localhost:3001/health` → 200

MVP is delivered: one running NestJS service with a health endpoint. Add Social, AI Agentic, and Web incrementally.

### Incremental Delivery

1. Setup + Foundational → `pnpm install` works
2. Shared package → `turbo build --filter=@sentient/shared` works
3. HR Core bootstrap → one service running ✅
4. Social bootstrap → two services running ✅
5. AI Agentic bootstrap → three services running ✅
6. Next.js bootstrap → frontend running ✅ (full US1 done)
7. US2, US3, US4 → verification and hardening passes ✅
8. Polish → README and final end-to-end ✅

---

## Notes

- [P] tasks = different files, no state shared with incomplete parallel tasks
- HR Core bootstrap (T017–T022) serves as the canonical reference — Social and AI Agentic bootstrap tasks (T023, T024) specify exactly what to change from the HR Core template
- The `PrismaService` in each bootstrap extends `PrismaClient` from `../generated/prisma` — `npx prisma generate` must run in each service before the service can compile; add this to the dev script or run it manually after T019/T023/T024
- `NestFactory.create` in `main.ts` requires `reflect-metadata` imported at the very top — ensure `import 'reflect-metadata';` is the first line in each `main.ts`
- The Next.js `transpilePackages: ['@sentient/shared']` in `next.config.ts` is required because the shared package is TypeScript source — Next.js must transpile it rather than trying to load the compiled JS
- Total task count: **38 tasks** across 7 phases
