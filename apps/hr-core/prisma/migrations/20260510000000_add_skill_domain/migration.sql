-- CreateEnum
CREATE TYPE "hr_core"."SkillDomain" AS ENUM ('TECHNICAL', 'LEADERSHIP', 'SOFT_SKILLS', 'DOMAIN_EXPERTISE');

-- AlterTable
ALTER TABLE "hr_core"."skills" ADD COLUMN "domain" "hr_core"."SkillDomain";

-- CreateIndex
CREATE INDEX "skills_domain_idx" ON "hr_core"."skills"("domain");
