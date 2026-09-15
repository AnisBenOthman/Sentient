-- AlterTable
-- Nullable and additive: existing business units keep country unset rather
-- than guessing a region from currency or free-text address (spec 017).
ALTER TABLE "hr_core"."business_units" ADD COLUMN "country" VARCHAR(2);
