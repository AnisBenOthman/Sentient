-- CreateEnum
CREATE TYPE "hr_core"."EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'PROBATION', 'TERMINATED', 'RESIGNED');

-- CreateTable
CREATE TABLE "hr_core"."employees" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "departmentId" TEXT,
    "teamId" TEXT,
    "employmentStatus" "hr_core"."EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "headId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "leadId" TEXT,
    "projectFocus" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."positions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_departmentId_idx" ON "hr_core"."employees"("departmentId");

-- CreateIndex
CREATE INDEX "employees_teamId_idx" ON "hr_core"."employees"("teamId");

-- CreateIndex
CREATE INDEX "employees_employmentStatus_idx" ON "hr_core"."employees"("employmentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "hr_core"."departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "hr_core"."departments"("code");

-- CreateIndex
CREATE INDEX "departments_isActive_idx" ON "hr_core"."departments"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "hr_core"."teams"("code");

-- CreateIndex
CREATE INDEX "teams_departmentId_idx" ON "hr_core"."teams"("departmentId");

-- CreateIndex
CREATE INDEX "teams_isActive_idx" ON "hr_core"."teams"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "positions_title_key" ON "hr_core"."positions"("title");

-- CreateIndex
CREATE INDEX "positions_isActive_idx" ON "hr_core"."positions"("isActive");

-- AddForeignKey
ALTER TABLE "hr_core"."employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr_core"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."employees" ADD CONSTRAINT "employees_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "hr_core"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."teams" ADD CONSTRAINT "teams_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr_core"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
