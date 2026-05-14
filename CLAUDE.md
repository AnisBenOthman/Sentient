# Sentient Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-12

## Persona

Senior Full-Stack Engineer. Write complete, production-quality code. No placeholders, no stubs with TODOs. If a task is assigned, implement it fully — Prisma schema, NestJS module, DTOs, guards, controller, service, barrel exports, all of it.

## Active Technologies
- TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/config (003-employee-module)
- PostgreSQL 16, schema `hr_core` (003-employee-module)
- TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/schedule (for monthly accrual cron), @nestjs/config (005-leave-module)
- TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` on) + NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, existing `@sentient/shared` (`IEventBus`, `DomainEvent`, `JwtPayload`, `PermissionScope`). Frontend: React 18 + Vite 7, TanStack Query v5, wouter, Tailwind CSS v4, shadcn/ui. (010-notifications)
- PostgreSQL 16, schema `hr_core`, one new table `notifications` plus three new enums (`notification_category`, `notification_event_type`, `notification_status`). (010-notifications)

- TypeScript 5.x — strict mode via `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `forceConsistentCasingInFileNames`) + NestJS 10, React 18 + Vite 7 (no SSR), Prisma 5 (multiSchema preview), @nestjs/config, @nestjs/swagger, class-validator, class-transformer, Turborepo 2.x
- PostgreSQL 16 + pgvector — Docker Compose (`pgvector/pgvector:pg16` image); 3 schemas (`hr_core`, `social`, `ai_agent`), 4 roles

## Project Structure

```text
apps/hr-core/      NestJS :3001  schema=hr_core
apps/social/       NestJS :3002  schema=social
apps/ai-agentic/   NestJS :3003  schema=ai_agent
apps/web/          React + Vite :3000
packages/shared/   @sentient/shared — enums, interfaces, DTOs, event-bus, auth
scripts/init-schemas.sql
docker-compose.yml
```

## Commands

```bash
pnpm install
docker compose up -d
psql -U postgres -d sentient -f scripts/init-schemas.sql
turbo build
turbo dev
turbo test --filter=<service>
```

## Code Style

See `.claude/rules/code-style.md` for full conventions. Key rules:
- No `any`. Use `unknown` and narrow.
- Explicit return types on all public methods.
- `@Injectable()` constructor injection only.
- DTOs validate with class-validator. Services trust their inputs.
- Every endpoint: `@UseGuards(SharedJwtGuard, RbacGuard)` + `@Roles(...)`. Except `/health`.

## Recent Changes
- 010-notifications: Implemented generic in-app notifications with the hr_core notifications table, shared notification enums, event-bus routing rules for leave and promotion, REST/SSE inbox endpoints, web bell/drawer, and retention purge.
- 010-notifications: Added TypeScript 5.x strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` on) + NestJS 10, Prisma 5 (multiSchema preview), class-validator, class-transformer, @nestjs/swagger, @nestjs/config, existing `@sentient/shared` (`IEventBus`, `DomainEvent`, `JwtPayload`, `PermissionScope`). Frontend: React 18 + Vite 7, TanStack Query v5, wouter, Tailwind CSS v4, shadcn/ui.
- 005-leave-module: Added TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/schedule (for monthly accrual cron), @nestjs/config
- 004-skills-module: Added TypeScript 5.x (strict mode) + NestJS 10, Prisma 5 (multiSchema), class-validator, class-transformer, @nestjs/swagger, @nestjs/config


<!-- MANUAL ADDITIONS START -->
## Notification Routing Convention
- HR Core notifications are created only from `DomainEvent` subscribers in `apps/hr-core/src/modules/notifications/events/notifications-events.bridge.ts`.
- Add a new notification producer by emitting after the domain transaction commits, adding one routing rule in `events/routing-rules/<domain>.rules.ts`, and registering the event type in the bridge. Do not call `NotificationsService` directly from domain services.
- `Notification` is implemented as the 24th HR Core entity for feature 010; the table uses polymorphic `referenceType`/`referenceId` links and owner-scoped inbox queries.
<!-- MANUAL ADDITIONS END -->
