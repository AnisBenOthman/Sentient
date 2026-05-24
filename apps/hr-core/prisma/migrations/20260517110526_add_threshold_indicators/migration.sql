-- CreateTable
CREATE TABLE "threshold_indicators" (
    "id" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "warningThreshold" DOUBLE PRECISION,
    "criticalThreshold" DOUBLE PRECISION,
    "warningBelow" DOUBLE PRECISION,
    "criticalBelow" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threshold_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "threshold_indicators_metricKey_key" ON "threshold_indicators"("metricKey");

-- CreateIndex
CREATE INDEX "threshold_indicators_isActive_idx" ON "threshold_indicators"("isActive");

-- RenameIndex
ALTER INDEX "performance_review_cycles_reviewType_periodStart_periodEnd_name" RENAME TO "performance_review_cycles_reviewType_periodStart_periodEnd__key";

-- RenameIndex
ALTER INDEX "performance_review_cycles_status_selfReviewOpensAt_selfReviewCl" RENAME TO "performance_review_cycles_status_selfReviewOpensAt_selfRevi_idx";
