CREATE TYPE "hr_core"."NotificationCategory" AS ENUM (
  'LEAVE',
  'PROMOTION',
  'SKILL',
  'PERFORMANCE',
  'PROBATION',
  'CONTRACT_AMENDMENT',
  'COMPLAINT',
  'ENGAGEMENT',
  'EXIT_SURVEY',
  'SYSTEM'
);

CREATE TYPE "hr_core"."NotificationEventType" AS ENUM (
  'REQUEST_SUBMITTED',
  'REQUEST_APPROVED',
  'REQUEST_REJECTED',
  'REQUEST_CANCELLED',
  'DECISION_PENDING',
  'RESOLVED',
  'INFO'
);

CREATE TYPE "hr_core"."NotificationStatus" AS ENUM (
  'UNREAD',
  'READ',
  'DISMISSED'
);

CREATE TABLE "hr_core"."notifications" (
  "id" TEXT NOT NULL,
  "recipient_user_id" TEXT NOT NULL,
  "category" "hr_core"."NotificationCategory" NOT NULL,
  "event_type" "hr_core"."NotificationEventType" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" VARCHAR(600) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "reference_type" VARCHAR(64),
  "reference_id" TEXT,
  "status" "hr_core"."NotificationStatus" NOT NULL DEFAULT 'UNREAD',
  "actor_user_id" TEXT,
  "correlation_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6),
  "dismissed_at" TIMESTAMPTZ(6),

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "hr_core"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ck_notif_no_self" CHECK ("actor_user_id" IS NULL OR "actor_user_id" <> "recipient_user_id")
);

CREATE INDEX "idx_notif_recipient_status_created" ON "hr_core"."notifications"("recipient_user_id", "status", "created_at" DESC);
CREATE INDEX "idx_notif_recipient_category_created" ON "hr_core"."notifications"("recipient_user_id", "category", "created_at" DESC);
CREATE INDEX "idx_notif_reference" ON "hr_core"."notifications"("reference_type", "reference_id");
CREATE INDEX "idx_notif_created_at" ON "hr_core"."notifications"("created_at");
