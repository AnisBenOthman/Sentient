-- AlterTable
ALTER TABLE "social"."announcements" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "targetDepartmentId" TEXT,
ADD COLUMN     "targetTeamId" TEXT;

-- CreateIndex
CREATE INDEX "announcements_targetDepartmentId_idx" ON "social"."announcements"("targetDepartmentId");

-- CreateIndex
CREATE INDEX "announcements_targetTeamId_idx" ON "social"."announcements"("targetTeamId");
