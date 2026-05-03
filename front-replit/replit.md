# Sentient HRIS

## Overview

AI-powered HR Information System. Ported from a Vercel/Next.js monorepo to the Replit pnpm workspace stack.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/sentient-hris), Tailwind CSS v4, wouter routing, shadcn/ui components
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Project Structure

- `artifacts/sentient-hris/` — React + Vite frontend (main web app, served at `/`)
- `artifacts/api-server/` — Express API server (served at `/api`)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/` — Generated React Query hooks from OpenAPI
- `lib/api-zod/` — Generated Zod schemas from OpenAPI
- `lib/db/` — Drizzle ORM schema + database connection

## Original Project (Migration Backup)

The original project at `.migration-backup/` is a Turborepo monorepo with:
- NestJS microservices: hr-core, social, ai-agentic
- Next.js frontend (apps/web) — was "Coming soon" placeholder
- Shared TypeScript library (@sentient/shared)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
