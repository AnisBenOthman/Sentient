-- WHY: Team code uniqueness must be scoped to business unit, not global.
-- Same code is allowed across different business units (e.g. Spain and Tunisia);
-- conflict is only raised when the same code is used twice within the same BU.

-- Step 1: add column nullable (safe for existing rows without a default)
ALTER TABLE hr_core.teams
  ADD COLUMN "businessUnitId" TEXT;

-- Step 2: backfill from the team's department join
UPDATE hr_core.teams t
SET    "businessUnitId" = d."businessUnitId"
FROM   hr_core.departments d
WHERE  t."departmentId" = d.id;

-- Step 3: enforce NOT NULL now that all rows are populated
ALTER TABLE hr_core.teams
  ALTER COLUMN "businessUnitId" SET NOT NULL;

-- Step 4: drop old global unique index on code
-- WHY: Prisma generates unique constraints as standalone indexes (CREATE UNIQUE INDEX),
-- not named constraints. DROP INDEX is required; DROP CONSTRAINT silently no-ops.
DROP INDEX IF EXISTS "hr_core"."teams_code_key";

-- Step 5: composite unique scoped to business unit
ALTER TABLE hr_core.teams
  ADD CONSTRAINT "teams_code_businessUnitId_key"
  UNIQUE (code, "businessUnitId");

-- Step 6: foreign key to business_units
ALTER TABLE hr_core.teams
  ADD CONSTRAINT "teams_businessUnitId_fkey"
  FOREIGN KEY ("businessUnitId")
  REFERENCES hr_core.business_units(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: index for FK lookup performance
CREATE INDEX "teams_businessUnitId_idx"
  ON hr_core.teams ("businessUnitId");
