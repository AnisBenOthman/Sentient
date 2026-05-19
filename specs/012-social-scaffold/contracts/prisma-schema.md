# Contract — Prisma Schema (Social)

The canonical Prisma shape for the `social` Postgres schema. This file is the contract that the implementation must reproduce verbatim; any deviation (extra columns, missing indexes, divergent enum values) is a contract violation and must be reconciled before merge.

> Full schema and migration steps live in [`../data-model.md`](../data-model.md). This file states the **promises** in API-style form.

---

## 1. Schema-level promises

- `datasource.schemas` MUST be `["social"]`.
- `generator.previewFeatures` MUST include `"multiSchema"`.
- `generator.output` MUST be `../src/generated/prisma`.
- The generator output path MUST be inside an existing `.gitignore` rule (`**/generated/**`).

## 2. Model-level promises

For each of the 8 models:

- A `@@schema("social")` annotation.
- A `@@map(<snake_case_plural>)` annotation matching the names in `data-model.md`.
- A UUID primary key `id String @id @default(uuid())`.
- A `createdAt DateTime @default(now())` column.
- An `updatedAt DateTime @updatedAt` column **except** on `EventAttendee` and `ExitSurveyResponse`.

## 3. Enum-level promises

For each of the 8 Prisma enums:

- A `@@schema("social")` annotation.
- The set of enum members MUST equal (string equality, case-sensitive) the corresponding `@sentient/shared` TypeScript enum members. Verification rule: a `pnpm --filter @sentient/shared build` followed by `cd apps/social && npx prisma format` MUST succeed, and the Postgres `CREATE TYPE social."<Enum>" AS ENUM (...)` SQL in the migration MUST list the same values in the same order.

## 4. Relation promises

- Exactly two Prisma relations exist:
  - `EventAttendee.event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)`
  - `ExitSurveyResponse.survey ExitSurvey @relation(fields: [surveyId], references: [id], onDelete: Cascade)`
- All other inter-table references (`authorId`, `organizerId`, `employeeId`, `uploadedById`, `generatedById`, `respondentId`, `subjectId`, `scopeId`, `terminationReference`) are plain `String` (or `String?`) — NO Prisma `@relation` block, NO Postgres `FOREIGN KEY` constraint at the DB level.

## 5. Index promises

Exactly the 10 indexes listed in `data-model.md` are produced by the migration. None may be omitted; no extras may be added in this feature.

## 6. Migration promises

- File name: `apps/social/prisma/migrations/20260520000000_init_social_scaffold/migration.sql`.
- After running, re-running `npx prisma migrate dev` against the same DB produces **zero** pending changes.
- The migration MUST NOT include any `CREATE SCHEMA` statement (the `social` schema is owned by `scripts/init-schemas.sql` from feature 002).
- The migration MUST NOT include any GRANT/REVOKE statements (DB roles are owned by feature 002).

## 7. Anonymity-by-shape promises

- `ExitSurveyResponse` MUST NOT declare an `employeeId`, `respondentId`, `userId`, or any column whose name suggests a person reference. Verification rule: a grep across the generated migration `migration.sql` for `respondent_id|employee_id|user_id` inside the `exit_survey_responses` `CREATE TABLE` block MUST return zero hits.
- `ExitSurvey.respondentId` MUST be declared `String?` (nullable from day one).

## 8. What is explicitly NOT in this contract

- No domain validation logic (date ordering on `Event`, RSVP-after-event-end checks, etc.).
- No row-level scope filters (those live in feature modules, applied via `buildScopeFilter()` from `@sentient/shared`).
- No seed data (no announcements / events / surveys created at migrate time).
