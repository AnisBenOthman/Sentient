-- AlterEnum
-- WHY two statements: ALTER TYPE ... ADD VALUE accepts exactly one value per
-- statement. Prisma runs this file in a transaction, which PostgreSQL 12+
-- allows for ADD VALUE provided the new value is not USED in the same
-- transaction. Neither value is referenced below — the tables created here use
-- ActionProposalStatus and AgentActionKind — so this is safe on the project's
-- PostgreSQL 16.
ALTER TYPE "ai_agent"."AgentRunStatus" ADD VALUE 'PENDING_CONFIRMATION';
ALTER TYPE "ai_agent"."AgentRunStatus" ADD VALUE 'UNVERIFIED';

-- CreateEnum
CREATE TYPE "ai_agent"."AgentActionKind" AS ENUM ('LEAVE_BOOKING');

-- CreateEnum
CREATE TYPE "ai_agent"."ActionProposalStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ai_agent"."agent_action_proposals" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "action_kind" "ai_agent"."AgentActionKind" NOT NULL,
    "status" "ai_agent"."ActionProposalStatus" NOT NULL DEFAULT 'PENDING',
    "actor_user_id" TEXT NOT NULL,
    "actor_employee_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "policy_citations" JSONB,
    "executed_at" TIMESTAMP(3),
    "result_record_id" TEXT,
    "result_status_code" INTEGER,
    "result_error_code" TEXT,
    "verified_at" TIMESTAMP(3),
    "verification_state" TEXT,
    "proposal_log_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_action_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."scheduled_follow_ups" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "employee_first_name" TEXT NOT NULL,
    "follow_up_type" TEXT NOT NULL,
    "follow_up_at" TIMESTAMP(3) NOT NULL,
    "leave_request_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_action_proposals_message_id_key" ON "ai_agent"."agent_action_proposals"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_action_proposals_token_key" ON "ai_agent"."agent_action_proposals"("token");

-- CreateIndex
CREATE INDEX "agent_action_proposals_status_expires_at_idx" ON "ai_agent"."agent_action_proposals"("status", "expires_at");

-- CreateIndex
CREATE INDEX "agent_action_proposals_conversation_id_created_at_idx" ON "ai_agent"."agent_action_proposals"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "scheduled_follow_ups_follow_up_at_resolved_at_idx" ON "ai_agent"."scheduled_follow_ups"("follow_up_at", "resolved_at");

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_action_proposals" ADD CONSTRAINT "agent_action_proposals_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_action_proposals" ADD CONSTRAINT "agent_action_proposals_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_agent"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."scheduled_follow_ups" ADD CONSTRAINT "scheduled_follow_ups_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
