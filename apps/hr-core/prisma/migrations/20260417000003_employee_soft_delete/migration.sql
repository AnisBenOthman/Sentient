ALTER TABLE "hr_core"."employees" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "employees_deletedAt_idx" ON "hr_core"."employees"("deletedAt");
