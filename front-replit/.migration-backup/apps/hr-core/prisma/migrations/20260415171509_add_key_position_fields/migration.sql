/*
  Warnings:

  - Added the required column `updatedAt` to the `positions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "KeyPositionRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "hasSuccessor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isKeyPosition" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keyPositionRisk" "KeyPositionRisk",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "positions_isKeyPosition_idx" ON "positions"("isKeyPosition");
