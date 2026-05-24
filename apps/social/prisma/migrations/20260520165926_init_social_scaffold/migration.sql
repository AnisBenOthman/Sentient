-- CreateEnum
CREATE TYPE "social"."Audience" AS ENUM ('COMPANY', 'DEPARTMENT', 'TEAM', 'ROLE', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "social"."EventType" AS ENUM ('MEETING', 'TRAINING', 'SOCIAL', 'ALL_HANDS', 'ONBOARDING', 'OFFSITE');

-- CreateEnum
CREATE TYPE "social"."RsvpStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'TENTATIVE', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "social"."DocumentCategory" AS ENUM ('INTERNAL_POLICY', 'HANDBOOK', 'REGULATION', 'TEMPLATE', 'GUIDE', 'OTHER');

-- CreateEnum
CREATE TYPE "social"."SentimentLabel" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED');

-- CreateEnum
CREATE TYPE "social"."FeedbackType" AS ENUM ('EVENT_FEEDBACK', 'ANNOUNCEMENT_FEEDBACK', 'GENERAL_FEEDBACK', 'MANAGER_FEEDBACK', 'PEER_FEEDBACK');

-- CreateEnum
CREATE TYPE "social"."ExitSurveyStatus" AS ENUM ('PENDING', 'SENT', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "social"."ExitSurveyQuestionKey" AS ENUM ('REASON_FOR_LEAVING', 'MANAGER_RATING', 'TEAM_CULTURE_RATING', 'GROWTH_OPPORTUNITY_RATING', 'WOULD_RECOMMEND_COMPANY', 'OPEN_FEEDBACK');

-- CreateTable
CREATE TABLE "social"."announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "audience" "social"."Audience" NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "pinnedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social"."events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventType" "social"."EventType" NOT NULL,
    "organizerId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "audience" "social"."Audience" NOT NULL,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social"."event_attendees" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "rsvpStatus" "social"."RsvpStatus" NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social"."documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "social"."DocumentCategory" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social"."feedback" (
    "id" TEXT NOT NULL,
    "feedbackType" "social"."FeedbackType" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER,
    "sentiment" "social"."SentimentLabel",
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social"."engagement_snapshots" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social"."exit_surveys" (
    "id" TEXT NOT NULL,
    "respondentId" TEXT,
    "terminationReference" TEXT,
    "status" "social"."ExitSurveyStatus" NOT NULL DEFAULT 'PENDING',
    "surveyTokenHash" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exit_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social"."exit_survey_responses" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "questionKey" "social"."ExitSurveyQuestionKey" NOT NULL,
    "answerText" TEXT,
    "answerRating" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exit_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_audience_publishedAt_idx" ON "social"."announcements"("audience", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "events_eventType_startAt_idx" ON "social"."events"("eventType", "startAt" DESC);

-- CreateIndex
CREATE INDEX "event_attendees_eventId_idx" ON "social"."event_attendees"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendees_eventId_employeeId_key" ON "social"."event_attendees"("eventId", "employeeId");

-- CreateIndex
CREATE INDEX "documents_category_createdAt_idx" ON "social"."documents"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "feedback_subjectType_subjectId_idx" ON "social"."feedback"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "feedback_isAnonymous_idx" ON "social"."feedback"("isAnonymous");

-- CreateIndex
CREATE INDEX "engagement_snapshots_scopeType_scopeId_periodStart_idx" ON "social"."engagement_snapshots"("scopeType", "scopeId", "periodStart");

-- CreateIndex
CREATE INDEX "exit_surveys_status_idx" ON "social"."exit_surveys"("status");

-- CreateIndex
CREATE INDEX "exit_surveys_expiresAt_idx" ON "social"."exit_surveys"("expiresAt");

-- CreateIndex
CREATE INDEX "exit_survey_responses_surveyId_questionKey_idx" ON "social"."exit_survey_responses"("surveyId", "questionKey");

-- AddForeignKey
ALTER TABLE "social"."event_attendees" ADD CONSTRAINT "event_attendees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "social"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social"."exit_survey_responses" ADD CONSTRAINT "exit_survey_responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "social"."exit_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
