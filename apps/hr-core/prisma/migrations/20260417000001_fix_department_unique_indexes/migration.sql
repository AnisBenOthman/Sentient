-- WHY: Migration 20260416000000 used DROP CONSTRAINT to remove Prisma-generated
-- unique indexes, but Prisma creates them as standalone indexes via CREATE UNIQUE INDEX,
-- not as named constraints. DROP CONSTRAINT with IF EXISTS silently skipped them,
-- leaving UNIQUE(name) and UNIQUE(code) alive alongside the new composite constraints.
-- Same department name in a different business unit violated the old simple index.

DROP INDEX IF EXISTS "hr_core"."departments_name_key";
DROP INDEX IF EXISTS "hr_core"."departments_code_key";
