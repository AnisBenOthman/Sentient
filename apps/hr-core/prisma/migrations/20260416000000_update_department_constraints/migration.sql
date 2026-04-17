-- Migration: scope department name/code uniqueness to business unit
-- Removes global unique constraints on name and code,
-- replaces them with composite unique constraints scoped to businessUnitId.

-- WHY: Prisma generates unique constraints as standalone indexes (CREATE UNIQUE INDEX),
-- not as named constraints. DROP INDEX is required; DROP CONSTRAINT silently no-ops.
DROP INDEX IF EXISTS "hr_core"."departments_name_key";
DROP INDEX IF EXISTS "hr_core"."departments_code_key";

ALTER TABLE hr_core.departments
  ADD CONSTRAINT "departments_name_businessUnitId_key" UNIQUE (name, "businessUnitId");

ALTER TABLE hr_core.departments
  ADD CONSTRAINT "departments_code_businessUnitId_key" UNIQUE (code, "businessUnitId");
