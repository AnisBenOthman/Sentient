-- CreateEnum
CREATE TYPE "hr_core"."SatisfactionLevel" AS ENUM ('VERY_DISSATISFIED', 'DISSATISFIED', 'NEUTRAL', 'SATISFIED', 'VERY_SATISFIED');

-- CreateEnum
CREATE TYPE "hr_core"."PerformanceRating" AS ENUM ('UNACCEPTABLE', 'NEEDS_IMPROVEMENT', 'MEETS_EXPECTATIONS', 'EXCEEDS_EXPECTATIONS', 'ABOVE_AND_BEYOND');

-- CreateEnum
CREATE TYPE "hr_core"."ReviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'REOPENED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "hr_core"."ReviewType" AS ENUM ('ANNUAL', 'MID_YEAR', 'PROBATION');

-- CreateEnum
CREATE TYPE "hr_core"."ReviewCycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "hr_core"."PerformanceReviewAuditAction" AS ENUM ('CYCLE_CREATED', 'ASSIGNED', 'SELF_SUBMITTED', 'MANAGER_COMPLETED', 'REVIEWER_REASSIGNED', 'REOPENED', 'CLOSED', 'CANCELLED', 'SALARY_FOLLOW_UP_RECORDED');

-- CreateTable
CREATE TABLE "hr_core"."performance_review_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reviewType" "hr_core"."ReviewType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "selfReviewOpensAt" TIMESTAMP(3) NOT NULL,
    "selfReviewClosesAt" TIMESTAMP(3) NOT NULL,
    "managerReviewDueAt" TIMESTAMP(3) NOT NULL,
    "status" "hr_core"."ReviewCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "performance_review_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."performance_reviews" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewDate" DATE NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "hr_core"."ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "businessUnitId" TEXT,
    "businessUnitName" TEXT,
    "departmentId" TEXT,
    "departmentName" TEXT,
    "teamId" TEXT,
    "teamName" TEXT,
    "positionId" TEXT,
    "positionTitle" TEXT,
    "environmentSatisfaction" "hr_core"."SatisfactionLevel",
    "jobSatisfaction" "hr_core"."SatisfactionLevel",
    "relationshipSatisfaction" "hr_core"."SatisfactionLevel",
    "trainingOpportunitiesTaken" INTEGER,
    "workLifeBalance" "hr_core"."SatisfactionLevel",
    "selfRating" "hr_core"."PerformanceRating",
    "managerRating" "hr_core"."PerformanceRating",
    "employeeComments" VARCHAR(4000),
    "managerComments" VARCHAR(4000),
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenReason" VARCHAR(1000),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."performance_review_audits" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "action" "hr_core"."PerformanceReviewAuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "hr_core"."ReviewStatus",
    "toStatus" "hr_core"."ReviewStatus",
    "reason" VARCHAR(1000),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_review_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_core"."performance_review_salary_followups" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "salaryHistoryId" TEXT,
    "reason" VARCHAR(1000) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_review_salary_followups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "performance_review_cycles_reviewType_periodStart_periodEnd_name_key" ON "hr_core"."performance_review_cycles"("reviewType", "periodStart", "periodEnd", "name");

-- CreateIndex
CREATE INDEX "performance_review_cycles_status_selfReviewOpensAt_selfReviewClosesAt_idx" ON "hr_core"."performance_review_cycles"("status", "selfReviewOpensAt", "selfReviewClosesAt");

-- CreateIndex
CREATE INDEX "performance_review_cycles_reviewType_periodStart_periodEnd_idx" ON "hr_core"."performance_review_cycles"("reviewType", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "performance_review_cycles_createdById_idx" ON "hr_core"."performance_review_cycles"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "performance_reviews_employeeId_cycleId_key" ON "hr_core"."performance_reviews"("employeeId", "cycleId");

-- CreateIndex
CREATE INDEX "performance_reviews_cycleId_status_idx" ON "hr_core"."performance_reviews"("cycleId", "status");

-- CreateIndex
CREATE INDEX "performance_reviews_employeeId_reviewDate_idx" ON "hr_core"."performance_reviews"("employeeId", "reviewDate");

-- CreateIndex
CREATE INDEX "performance_reviews_reviewerId_status_dueDate_idx" ON "hr_core"."performance_reviews"("reviewerId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "performance_reviews_departmentId_positionId_reviewDate_idx" ON "hr_core"."performance_reviews"("departmentId", "positionId", "reviewDate");

-- CreateIndex
CREATE INDEX "performance_reviews_managerRating_idx" ON "hr_core"."performance_reviews"("managerRating");

-- CreateIndex
CREATE INDEX "performance_review_audits_reviewId_createdAt_idx" ON "hr_core"."performance_review_audits"("reviewId", "createdAt");

-- CreateIndex
CREATE INDEX "performance_review_audits_actorId_createdAt_idx" ON "hr_core"."performance_review_audits"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "performance_review_audits_action_createdAt_idx" ON "hr_core"."performance_review_audits"("action", "createdAt");

-- CreateIndex
CREATE INDEX "performance_review_salary_followups_reviewId_idx" ON "hr_core"."performance_review_salary_followups"("reviewId");

-- CreateIndex
CREATE INDEX "performance_review_salary_followups_salaryHistoryId_idx" ON "hr_core"."performance_review_salary_followups"("salaryHistoryId");

-- CreateIndex
CREATE INDEX "performance_review_salary_followups_createdById_createdAt_idx" ON "hr_core"."performance_review_salary_followups"("createdById", "createdAt");

-- AddCheck
ALTER TABLE "hr_core"."performance_review_cycles" ADD CONSTRAINT "performance_review_cycles_period_order_chk" CHECK ("periodEnd" >= "periodStart");

-- AddCheck
ALTER TABLE "hr_core"."performance_review_cycles" ADD CONSTRAINT "performance_review_cycles_self_window_chk" CHECK ("selfReviewClosesAt" >= "selfReviewOpensAt");

-- AddCheck
ALTER TABLE "hr_core"."performance_reviews" ADD CONSTRAINT "performance_reviews_training_non_negative_chk" CHECK ("trainingOpportunitiesTaken" IS NULL OR "trainingOpportunitiesTaken" >= 0);

-- AddCheck
ALTER TABLE "hr_core"."performance_reviews" ADD CONSTRAINT "performance_reviews_submitted_fields_chk" CHECK (
    "status" NOT IN ('SUBMITTED', 'COMPLETED', 'CLOSED')
    OR (
        "environmentSatisfaction" IS NOT NULL
        AND "jobSatisfaction" IS NOT NULL
        AND "relationshipSatisfaction" IS NOT NULL
        AND "trainingOpportunitiesTaken" IS NOT NULL
        AND "workLifeBalance" IS NOT NULL
        AND "selfRating" IS NOT NULL
        AND "submittedAt" IS NOT NULL
    )
);

-- AddCheck
ALTER TABLE "hr_core"."performance_reviews" ADD CONSTRAINT "performance_reviews_completed_fields_chk" CHECK (
    "status" NOT IN ('COMPLETED', 'CLOSED')
    OR ("managerRating" IS NOT NULL AND "completedAt" IS NOT NULL)
);

-- AddForeignKey
ALTER TABLE "hr_core"."performance_review_cycles" ADD CONSTRAINT "performance_review_cycles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "hr_core"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."performance_reviews" ADD CONSTRAINT "performance_reviews_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "hr_core"."performance_review_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."performance_reviews" ADD CONSTRAINT "performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr_core"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."performance_reviews" ADD CONSTRAINT "performance_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "hr_core"."employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."performance_review_audits" ADD CONSTRAINT "performance_review_audits_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "hr_core"."performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."performance_review_salary_followups" ADD CONSTRAINT "performance_review_salary_followups_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "hr_core"."performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."performance_review_salary_followups" ADD CONSTRAINT "performance_review_salary_followups_salaryHistoryId_fkey" FOREIGN KEY ("salaryHistoryId") REFERENCES "hr_core"."salary_history"("id") ON DELETE SET NULL ON UPDATE CASCADE;
