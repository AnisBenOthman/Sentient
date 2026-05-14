CREATE TYPE "hr_core"."PromotionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "hr_core"."promotion_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "currentRole" TEXT NOT NULL,
    "newRole" TEXT NOT NULL,
    "currentGrossSalary" DECIMAL(12,2) NOT NULL,
    "newGrossSalary" DECIMAL(12,2) NOT NULL,
    "salaryDelta" DECIMAL(12,2) NOT NULL,
    "salaryDeltaPercentage" DECIMAL(6,2) NOT NULL,
    "currentTeamBudget" DECIMAL(12,2) NOT NULL,
    "newTeamBudget" DECIMAL(12,2) NOT NULL,
    "budgetImpactPercentage" DECIMAL(6,2) NOT NULL,
    "responsibilities" JSONB NOT NULL,
    "status" "hr_core"."PromotionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promotion_requests_employeeId_idx" ON "hr_core"."promotion_requests"("employeeId");
CREATE INDEX "promotion_requests_requestedById_idx" ON "hr_core"."promotion_requests"("requestedById");
CREATE INDEX "promotion_requests_reviewedById_idx" ON "hr_core"."promotion_requests"("reviewedById");
CREATE INDEX "promotion_requests_status_idx" ON "hr_core"."promotion_requests"("status");
CREATE INDEX "promotion_requests_submittedAt_idx" ON "hr_core"."promotion_requests"("submittedAt");

ALTER TABLE "hr_core"."promotion_requests"
ADD CONSTRAINT "promotion_requests_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "hr_core"."employees"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hr_core"."promotion_requests"
ADD CONSTRAINT "promotion_requests_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "hr_core"."employees"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "hr_core"."promotion_requests"
ADD CONSTRAINT "promotion_requests_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "hr_core"."employees"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
