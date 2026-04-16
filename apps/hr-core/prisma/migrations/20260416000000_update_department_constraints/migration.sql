-- Migration: scope department name/code uniqueness to business unit
-- Removes global unique constraints on name and code,
-- replaces them with composite unique constraints scoped to businessUnitId.

ALTER TABLE hr_core.departments DROP CONSTRAINT IF EXISTS "departments_name_key";
ALTER TABLE hr_core.departments DROP CONSTRAINT IF EXISTS "departments_code_key";

ALTER TABLE hr_core.departments
  ADD CONSTRAINT "departments_name_businessUnitId_key" UNIQUE (name, "businessUnitId");

ALTER TABLE hr_core.departments
  ADD CONSTRAINT "departments_code_businessUnitId_key" UNIQUE (code, "businessUnitId");
