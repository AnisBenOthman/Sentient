# Quickstart — 012-social-scaffold

Once the implementation lands, here is the developer flow to verify everything from a clean checkout.

---

## 0. Prerequisites

- Node 20 LTS
- pnpm 9.x
- Docker + Docker Compose
- A populated `.env` at the repo root (for `docker compose`) and at `apps/social/.env` (for the service)

## 1. Install dependencies

```bash
pnpm install
```

No new top-level dependencies were added by this feature beyond what HR Core already drags in (`axios` is already a transitive dep). If `pnpm install` adds anything, the lockfile change is expected.

## 2. Build the shared package

The 4 new shared enums (`Audience`, `RsvpStatus`, `SentimentLabel`, `FeedbackType`) MUST be compiled before Social can use them:

```bash
pnpm --filter @sentient/shared build
```

## 3. Start the database

```bash
docker compose up -d
```

If this is the first time on a fresh DB:

```bash
psql -U postgres -d sentient -f scripts/init-schemas.sql
```

This creates the `social` schema and the `social_svc` role. If the `social` schema is already populated by an older hand-run create, `prisma migrate dev` will detect drift and refuse — run `npx prisma migrate reset` inside `apps/social/` to start clean (DEV ONLY).

## 4. Configure Social

```bash
cp apps/social/.env.example apps/social/.env
```

Then fill (using the values from your root `.env` for shared secrets):

```env
SOCIAL_DATABASE_URL=postgresql://social_svc:social_pass@localhost:5432/sentient?schema=social
SOCIAL_PORT=3002
JWT_SECRET=<same as HR Core>
SYSTEM_JWT_SECRET=<same as HR Core>
HR_CORE_URL=http://localhost:3001
HR_CORE_EMPLOYEE_CACHE_TTL_MS=60000
FRONTEND_URL=http://localhost:3000
```

## 5. Run the migration

```bash
cd apps/social
npx prisma generate
npx prisma migrate dev --name init_social_scaffold
cd ../..
```

Expected output: "Your database is now in sync with your schema." and `apps/social/prisma/migrations/20260520000000_init_social_scaffold/migration.sql` is committed.

Verify the 8 tables exist:

```bash
psql -U social_svc -d sentient -c "\dt social.*"
```

Should list `announcements`, `documents`, `engagement_snapshots`, `event_attendees`, `events`, `exit_survey_responses`, `exit_surveys`, `feedback`.

## 6. Boot Social

From the repo root:

```bash
turbo dev --filter=social
```

Expected log line: `Social service listening on port 3002` (or whatever `SOCIAL_PORT` is set to).

## 7. Verify the health endpoint

```bash
curl -s http://localhost:3002/health | jq
```

Expected:

```json
{ "status": "ok", "service": "social", "timestamp": "2026-05-19T..." }
```

## 8. Verify the auth wall is up

```bash
curl -i http://localhost:3002/anything-else
```

Expected: `401 Unauthorized` (`SharedJwtGuard` rejects the unauthenticated request before the 404 handler).

## 9. Verify Swagger

Open <http://localhost:3002/api/docs> in a browser. Expected: Swagger UI with `BearerAuth` security scheme, currently only `/health` listed (more endpoints arrive with feature modules).

## 10. Run the tests

```bash
turbo test --filter=social
```

The suite includes:

- `hr-core.client.spec.ts` — HrCoreClient unit tests (axios mocked, cache assertions, error mapping).
- `auth-wiring.spec.ts` — `SharedJwtGuard` + `RbacGuard` smoke (no-token → 401, employee → 200, system on EMPLOYEE-only → 403).
- `event-bus.spec.ts` — `EVENT_BUS` provider resolves and accepts a `scaffold.ping` emit.
- `app.e2e-spec.ts` — `GET /health` returns the expected shape.

## 11. Tear down

```bash
docker compose down
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Migration init_social_scaffold has been modified since it was applied` | Edited the migration after applying it. | `npx prisma migrate reset` (DEV ONLY) or revert the edit. |
| `Error: relation "social.announcements" does not exist` | `scripts/init-schemas.sql` was not run on this DB. | Run the SQL, then `prisma migrate deploy`. |
| `401 Unauthorized` on `/health` | `@Public()` decorator not applied or not honored by the local `SharedJwtGuard`. | Re-check `apps/social/src/app.controller.ts` and `apps/social/src/app.module.ts` provider ordering. |
| `HR Core unreachable` when no real HR Core call has been made | `HrCoreClient` was eagerly instantiated and crashed reading `HR_CORE_URL`. | Confirm `HR_CORE_URL` is set in `apps/social/.env`. |
| `Cannot find module '@sentient/shared'` | The shared package was not built. | Run `pnpm --filter @sentient/shared build`. |
