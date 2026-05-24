-- AlterTable
ALTER TABLE "social"."documents" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "documents_isPublic_createdAt_idx" ON "social"."documents"("isPublic", "createdAt" DESC);
