-- WHY: Migration 20260417000000 used DROP CONSTRAINT to remove the Prisma-generated
-- unique index on teams.code, but Prisma creates it as a standalone index via
-- CREATE UNIQUE INDEX, not a named constraint. DROP CONSTRAINT with IF EXISTS silently
-- skipped it, leaving the old UNIQUE(code) alive alongside the new composite constraint.
-- Same team code in a different business unit violated the old simple index.

DROP INDEX IF EXISTS "hr_core"."teams_code_key";
