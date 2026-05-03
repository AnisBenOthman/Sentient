-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "SourceLevel" AS ENUM ('RECRUITMENT', 'TRAINING', 'CERTIFICATION', 'MANAGER', 'PEER_REVIEW');

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "proficiency" "ProficiencyLevel" NOT NULL,
    "acquiredDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "previousLevel" "ProficiencyLevel",
    "newLevel" "ProficiencyLevel",
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "source" "SourceLevel" NOT NULL,
    "note" TEXT,
    "assessedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex
CREATE INDEX "employee_skills_employeeId_idx" ON "employee_skills"("employeeId");

-- CreateIndex
CREATE INDEX "employee_skills_skillId_idx" ON "employee_skills"("skillId");

-- CreateIndex
CREATE INDEX "employee_skills_deletedAt_idx" ON "employee_skills"("deletedAt");

-- CreateIndex
CREATE INDEX "skill_history_employeeId_effectiveDate_idx" ON "skill_history"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "skill_history_skillId_effectiveDate_idx" ON "skill_history"("skillId", "effectiveDate");

-- CreateIndex
CREATE INDEX "skill_history_effectiveDate_idx" ON "skill_history"("effectiveDate");

-- CreateIndex
CREATE INDEX "skill_history_source_idx" ON "skill_history"("source");

-- CreateIndex
CREATE INDEX "skill_history_assessedById_idx" ON "skill_history"("assessedById");

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_history" ADD CONSTRAINT "skill_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_history" ADD CONSTRAINT "skill_history_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_history" ADD CONSTRAINT "skill_history_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique index: at most one non-deleted current proficiency per (employee, skill).
-- WHY: @@unique would forbid multiple soft-deleted rows for the same pair; a partial index
-- enforces the active-row constraint while allowing the full soft-delete history to accumulate.
CREATE UNIQUE INDEX "employee_skills_employeeId_skillId_active_unique"
  ON "hr_core"."employee_skills" ("employeeId", "skillId")
  WHERE "deletedAt" IS NULL;
