CREATE TYPE "hr_core"."Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY');

ALTER TABLE "hr_core"."employees" ADD COLUMN "gender" "hr_core"."Gender";

WITH ranked_employees AS (
  SELECT
    "id",
    row_number() OVER (ORDER BY "employeeCode") AS row_num
  FROM "hr_core"."employees"
)
UPDATE "hr_core"."employees" AS employee
SET "gender" = (
  CASE (ranked_employees.row_num % 10)
    WHEN 1 THEN 'FEMALE'
    WHEN 2 THEN 'MALE'
    WHEN 3 THEN 'FEMALE'
    WHEN 4 THEN 'MALE'
    WHEN 5 THEN 'FEMALE'
    WHEN 6 THEN 'MALE'
    WHEN 7 THEN 'NON_BINARY'
    WHEN 8 THEN 'FEMALE'
    WHEN 9 THEN 'MALE'
    ELSE 'PREFER_NOT_TO_SAY'
  END
)::"hr_core"."Gender"
FROM ranked_employees
WHERE ranked_employees."id" = employee."id"
  AND employee."gender" IS NULL;

CREATE INDEX "employees_gender_idx" ON "hr_core"."employees"("gender");
