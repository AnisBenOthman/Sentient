/*
  Warnings:

  - The `level` column on the `positions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[employeeCode]` on the table `employees` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `employees` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeCode` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hireDate` to the `employees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `employees` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACTOR', 'FIXED_TERM');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('BELOW_COLLEGE', 'COLLEGE', 'BACHELOR', 'MASTER', 'DOCTOR');

-- CreateEnum
CREATE TYPE "PositionLevel" AS ENUM ('JUNIOR', 'MEDIUM', 'CONFIRMED', 'SENIOR_1', 'SENIOR_2', 'EXPERT');

-- CreateEnum
CREATE TYPE "SalaryChangeReason" AS ENUM ('PROMOTION', 'ANNUAL_REVIEW', 'NEW_FUNCTION', 'OTHER');

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "businessUnitId" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "contractType" "ContractType" NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "educationField" TEXT,
ADD COLUMN     "educationLevel" "EducationLevel",
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "employeeCode" TEXT NOT NULL,
ADD COLUMN     "grossSalary" DECIMAL(12,2),
ADD COLUMN     "hireDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "netSalary" DECIMAL(12,2),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "positionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "positions" DROP COLUMN "level",
ADD COLUMN     "level" "PositionLevel";

-- CreateTable
CREATE TABLE "enum_meta" (
    "id" TEXT NOT NULL,
    "enumName" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "enum_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousGrossSalary" DECIMAL(12,2) NOT NULL,
    "newGrossSalary" DECIMAL(12,2) NOT NULL,
    "previousNetSalary" DECIMAL(12,2),
    "newNetSalary" DECIMAL(12,2),
    "grossRaisePercentage" DECIMAL(6,2),
    "netRaisePercentage" DECIMAL(6,2),
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" "SalaryChangeReason",
    "reasonComment" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enum_meta_enumName_idx" ON "enum_meta"("enumName");

-- CreateIndex
CREATE UNIQUE INDEX "enum_meta_enumName_key_key" ON "enum_meta"("enumName", "key");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_name_key" ON "business_units"("name");

-- CreateIndex
CREATE INDEX "business_units_isActive_idx" ON "business_units"("isActive");

-- CreateIndex
CREATE INDEX "salary_history_employeeId_idx" ON "salary_history"("employeeId");

-- CreateIndex
CREATE INDEX "salary_history_effectiveDate_idx" ON "salary_history"("effectiveDate");

-- CreateIndex
CREATE INDEX "departments_businessUnitId_idx" ON "departments"("businessUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_positionId_idx" ON "employees"("positionId");

-- CreateIndex
CREATE INDEX "employees_managerId_idx" ON "employees"("managerId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
