/*
  Warnings:

  - You are about to drop the column `isRequired` on the `position_skills` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SkillRequirementLevel" AS ENUM ('MANDATORY', 'EXPECTED', 'NICE_TO_HAVE');

-- AlterTable
ALTER TABLE "position_skills" DROP COLUMN "isRequired",
ADD COLUMN     "requirementLevel" "SkillRequirementLevel" NOT NULL DEFAULT 'MANDATORY';
