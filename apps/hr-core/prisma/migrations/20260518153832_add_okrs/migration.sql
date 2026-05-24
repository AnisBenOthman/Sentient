-- CreateEnum
CREATE TYPE "OkrCycleType" AS ENUM ('ANNUAL', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "OkrCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ObjectiveLevel" AS ENUM ('COMPANY', 'DEPARTMENT', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KeyResultMetricType" AS ENUM ('PERCENTAGE', 'NUMBER', 'CURRENCY', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "KeyResultStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'BEHIND', 'ACHIEVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OkrCheckInStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'OKR';

-- CreateTable
CREATE TABLE "okr_cycles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "type" "OkrCycleType" NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" SMALLINT,
    "status" "OkrCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "parent_cycle_id" UUID,
    "created_by_id" TEXT NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "activated_by_id" TEXT,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "okr_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "level" "ObjectiveLevel" NOT NULL,
    "cycle_id" UUID NOT NULL,
    "parent_objective_id" UUID,
    "owner_id" TEXT,
    "department_id" TEXT,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "activated_at" TIMESTAMPTZ(6),
    "activated_by_id" TEXT,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by_id" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_results" (
    "id" UUID NOT NULL,
    "objective_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "metric_type" "KeyResultMetricType" NOT NULL,
    "target_value" DECIMAL(18,4) NOT NULL,
    "current_value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit" VARCHAR(32) NOT NULL,
    "score" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "assignee_ids" UUID[],
    "due_date" DATE,
    "status" "KeyResultStatus" NOT NULL DEFAULT 'ON_TRACK',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_check_ins" (
    "id" UUID NOT NULL,
    "key_result_id" UUID NOT NULL,
    "employee_id" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "score" DECIMAL(3,2) NOT NULL,
    "comment" VARCHAR(2000),
    "status" "OkrCheckInStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okr_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_result_status_history" (
    "id" UUID NOT NULL,
    "key_result_id" UUID NOT NULL,
    "from_status" "KeyResultStatus",
    "to_status" "KeyResultStatus" NOT NULL,
    "changed_by_id" TEXT,
    "reason" VARCHAR(2000),
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_result_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_okr_cycle_type_year_status" ON "okr_cycles"("type", "year", "status");

-- CreateIndex
CREATE INDEX "idx_okr_cycle_parent" ON "okr_cycles"("parent_cycle_id");

-- CreateIndex
CREATE INDEX "idx_okr_cycle_status_end" ON "okr_cycles"("status", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "okr_cycles_name_key" ON "okr_cycles"("name");

-- CreateIndex
CREATE INDEX "idx_objective_cycle_level_status" ON "objectives"("cycle_id", "level", "status");

-- CreateIndex
CREATE INDEX "idx_objective_parent" ON "objectives"("parent_objective_id");

-- CreateIndex
CREATE INDEX "idx_objective_dept_level" ON "objectives"("department_id", "level");

-- CreateIndex
CREATE INDEX "idx_objective_owner_level" ON "objectives"("owner_id", "level");

-- CreateIndex
CREATE INDEX "idx_kr_objective_status" ON "key_results"("objective_id", "status");

-- CreateIndex
CREATE INDEX "idx_checkin_kr_created" ON "okr_check_ins"("key_result_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_checkin_status_kr" ON "okr_check_ins"("status", "key_result_id");

-- CreateIndex
CREATE INDEX "idx_checkin_employee_created" ON "okr_check_ins"("employee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_kr_status_history_kr_changed" ON "key_result_status_history"("key_result_id", "changed_at" DESC);

-- AddForeignKey
ALTER TABLE "okr_cycles" ADD CONSTRAINT "okr_cycles_parent_cycle_id_fkey" FOREIGN KEY ("parent_cycle_id") REFERENCES "okr_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_cycles" ADD CONSTRAINT "okr_cycles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_cycles" ADD CONSTRAINT "okr_cycles_activated_by_id_fkey" FOREIGN KEY ("activated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_cycles" ADD CONSTRAINT "okr_cycles_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "okr_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_parent_objective_id_fkey" FOREIGN KEY ("parent_objective_id") REFERENCES "objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_activated_by_id_fkey" FOREIGN KEY ("activated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_check_ins" ADD CONSTRAINT "okr_check_ins_key_result_id_fkey" FOREIGN KEY ("key_result_id") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_check_ins" ADD CONSTRAINT "okr_check_ins_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_result_status_history" ADD CONSTRAINT "key_result_status_history_key_result_id_fkey" FOREIGN KEY ("key_result_id") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_result_status_history" ADD CONSTRAINT "key_result_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Score range invariants
ALTER TABLE "hr_core"."key_results"
  ADD CONSTRAINT "ck_kr_score_range"
  CHECK ("score" >= 0 AND "score" <= 1);

ALTER TABLE "hr_core"."okr_check_ins"
  ADD CONSTRAINT "ck_checkin_score_range"
  CHECK ("score" >= 0 AND "score" <= 1);

ALTER TABLE "hr_core"."key_results"
  ADD CONSTRAINT "ck_kr_current_value_nonneg"
  CHECK ("current_value" >= 0);

ALTER TABLE "hr_core"."key_results"
  ADD CONSTRAINT "ck_kr_target_positive"
  CHECK (
    ("metric_type" = 'BOOLEAN' AND "target_value" = 1)
    OR ("metric_type" <> 'BOOLEAN' AND "target_value" > 0)
  );

ALTER TABLE "hr_core"."okr_cycles"
  ADD CONSTRAINT "ck_cycle_quarter_range"
  CHECK (
    ("type" = 'ANNUAL' AND "quarter" IS NULL)
    OR ("type" = 'QUARTERLY' AND "quarter" BETWEEN 1 AND 4)
  );

ALTER TABLE "hr_core"."okr_cycles"
  ADD CONSTRAINT "ck_cycle_parent_type"
  CHECK (
    ("type" = 'ANNUAL' AND "parent_cycle_id" IS NULL)
    OR ("type" = 'QUARTERLY')
  );

ALTER TABLE "hr_core"."objectives"
  ADD CONSTRAINT "ck_objective_level_invariants"
  CHECK (
    ("level" = 'COMPANY' AND "parent_objective_id" IS NULL AND "department_id" IS NULL AND "owner_id" IS NULL)
    OR ("level" = 'DEPARTMENT' AND "parent_objective_id" IS NOT NULL AND "department_id" IS NOT NULL AND "owner_id" IS NULL)
    OR ("level" = 'EMPLOYEE' AND "parent_objective_id" IS NOT NULL AND "owner_id" IS NOT NULL)
  );
