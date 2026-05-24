-- DropForeignKey
ALTER TABLE "departments" DROP CONSTRAINT "departments_businessUnitId_fkey";

-- AlterTable
ALTER TABLE "departments" ALTER COLUMN "businessUnitId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
