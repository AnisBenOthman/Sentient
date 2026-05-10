# Implementation Plan: Sentient Monorepo Scaffold

**Branch**: `002-monorepo-scaffold` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-monorepo-scaffold/spec.md`

## Summary

Bootstrap the Sentient monorepo from scratch: root workspace config (pnpm + Turborepo), a `packages/shared` TypeScript package, three NestJS microservice skeletons (HR Core :3001, Social :3002, AI Agentic :3003), a minimal Next.js 14 frontend, a Docker Compose PostgreSQL 16 + pgvector database, and a `scripts/init-schemas.sql` that creates the three schemas, four DB roles, and pgvector extension idempotently. No feature modules, no Prisma models — just the structural foundation every subsequent feature builds on.

## Technical Context

**Language/Version**: TypeScript 5.x — strict mode via `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames`)  
**Primary Dependencies**: NestJS 10, Next.js 14 (App Router), Prisma 5 (multiSchema preview), @nestjs/config, @nestjs/swagger, class-validator, class-transformer, Turborepo 2.x  
**Package Manager**: pnpm 9.x with `pnpm-workspace.yaml` covering `apps/*` and `packages/*`  
**Storage**: PostgreSQL 16 + pgvector — Docker Compose (`pgvector/pgvector:pg16` image); 3 schemas, 4 roles  
**Testing**: Jest per service (configured in each service's `package.json`); no tests in scaffold itself  
**Target Platform**: Local Docker Compose (developer workstation); Node.js 20 LTS  
**Project Type**: Turborepo monorepo — 3 NestJS microservices + 1 Next.js frontend + 1 shared TypeScript package  
**Performance Goals**: All three services start in under 10 seconds; health endpoints respond in < 500ms  
**Constraints**: No cross-service source imports; `@sentient/shared` is the only cross-cutting dependency; each service connects with its own DB role; Prisma schemas contain no models yet  
**Scale/Scope**: 5 workspace packages total (~60 files created)

## Constitution Check

*Constitution.md is a blank template — principles derived from CLAUDE.md.*

| Gate | Rule (from CLAUDE.md) | Status |
|------|----------------------|--------|
| Modular design | Each NestJS service is a standalone app; no source-level cross-service imports | PASS |
| Strict TypeScript | `tsconfig.base.json` enforces strict mode inherited by all services | PASS |
| No cross-schema queries | Each service Prisma schema declares only its own schema; DB roles restrict access at DB level | PASS |
| Evolutionary architecture | EventBus stub wired in shared package (empty barrel); Kafka swap in Phase 2 won't require structural changes | PASS |
| Data privacy | DB role isolation enforced in `init-schemas.sql`; no service can access another's tables | PASS |
| AI portability | AI Agentic never imports hr-core or social source — only `@sentient/shared` types | PASS |

**Gate result: ALL PASS. Proceeding to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/002-monorepo-scaffold/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output — file manifest + env schema
├── quickstart.md        # Phase 1 output — developer setup sequence
├── contracts/
│   ├── health-endpoint.md     # GET /health response contract (all 3 services)
│   ├── environment-vars.md    # Required env vars per service
│   └── turbo-pipeline.md      # turbo.json task pipeline contracts
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
sentient/                                    # repo root
├── .claude/                                 # existing — unchanged
├── specs/                                   # existing — unchanged
├── apps/
│   ├── hr-core/                             # NestJS microservice :3001
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.controller.ts
│   │   │   ├── app.service.ts
│   │   │   └── prisma/
│   │   │       ├── prisma.module.ts
│   │   │       └── prisma.service.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma               # datasource + generator only (no models)
│   │   ├── test/
│   │   │   └── app.e2e-spec.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── nest-cli.json
│   ├── social/                              # NestJS microservice :3002 (same structure)
│   ├── ai-agentic/                          # NestJS microservice :3003 (same structure)
│   └── web/                                 # Next.js 14 frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx
│       │   └── lib/api/
│       │       ├── hr-core.ts              # typed client stub (empty)
│       │       ├── social.ts
│       │       └── ai.ts
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                              # @sentient/shared
│       ├── src/
│       │   ├── index.ts                     # root barrel
│       │   ├── enums/index.ts
│       │   ├── interfaces/index.ts
│       │   ├── dto/index.ts
│       │   ├── event-bus/index.ts
│       │   └── auth/index.ts
│       ├── package.json
│       └── tsconfig.json
├── scripts/
│   └── init-schemas.sql
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                             # root workspace
├── tsconfig.base.json
├── .env.example
└── .gitignore
```

**Structure Decision**: Standard Turborepo monorepo with `apps/` for runnable services and `packages/` for shared libraries. Each service is self-contained with its own `package.json`, `tsconfig.json`, `nest-cli.json`, and `prisma/` directory. No feature modules in any service yet.

## Complexity Tracking

No constitution violations. No complexity justification needed.
