-- CreateTable
CREATE TABLE "position_skills" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "minimumProficiency" "ProficiencyLevel" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "position_skills_positionId_idx" ON "position_skills"("positionId");

-- CreateIndex
CREATE INDEX "position_skills_skillId_idx" ON "position_skills"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "position_skills_positionId_skillId_key" ON "position_skills"("positionId", "skillId");

-- AddForeignKey
ALTER TABLE "position_skills" ADD CONSTRAINT "position_skills_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_skills" ADD CONSTRAINT "position_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
