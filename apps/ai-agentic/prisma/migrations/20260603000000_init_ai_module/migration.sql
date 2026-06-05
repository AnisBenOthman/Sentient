-- CreateEnum
CREATE TYPE "ai_agent"."AgentType" AS ENUM ('HR_ASSISTANT', 'SUPERVISOR_AGENT', 'OKR_AGENT', 'LEAVE_AGENT', 'CAREER_AGENT', 'LINGUISTIC_AGENT', 'LANGUAGE_AGENT', 'ANALYTICS_AGENT', 'ENGAGEMENT_AGENT', 'ONBOARDING_COMPANION', 'ONBOARDING_AGENT', 'GENERAL_HELP_AGENT', 'HUMAN_ESCALATION_AGENT');

-- CreateEnum
CREATE TYPE "ai_agent"."ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "ai_agent"."MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'AGENT');

-- CreateEnum
CREATE TYPE "ai_agent"."AgentNodeType" AS ENUM ('SUPERVISOR', 'CLARIFICATION', 'SPECIALIST', 'HUMAN_ESCALATION', 'FINAL_ANSWER');

-- CreateEnum
CREATE TYPE "ai_agent"."AgentRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'DEGRADED', 'PARTIAL', 'ESCALATED', 'REFUSED', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "ai_agent"."PermissionDecision" AS ENUM ('ALLOWED', 'PARTIAL', 'DENIED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ai_agent"."TaskTrigger" AS ENUM ('USER_MESSAGE', 'SYSTEM', 'SCHEDULED', 'EVENT');

-- CreateEnum
CREATE TYPE "ai_agent"."ClarificationStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ai_agent"."HumanEscalationTargetType" AS ENUM ('MANAGER', 'HR_BUSINESS_PARTNER', 'PEOPLE_TEAM', 'EMERGENCY_PROCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "ai_agent"."HumanEscalationStatus" AS ENUM ('RECORDED', 'SENT', 'CANCELLED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ai_agent"."FeedbackRating" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ai_agent"."KnowledgeSourceType" AS ENUM ('HANDBOOK', 'POLICY', 'SOCIAL_DOCUMENT', 'FAQ', 'SYSTEM_GUIDE');

-- CreateEnum
CREATE TYPE "ai_agent"."KnowledgeItemStatus" AS ENUM ('ACTIVE', 'STALE', 'DELETED');

-- CreateTable
CREATE TABLE "ai_agent"."conversations" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "owner_employee_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "ai_agent"."ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_agent_type" "ai_agent"."AgentType",
    "last_message_preview" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "ai_agent"."MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "agent_type" "ai_agent"."AgentType",
    "node_type" "ai_agent"."AgentNodeType",
    "source_summary" JSONB,
    "status" "ai_agent"."AgentRunStatus" NOT NULL DEFAULT 'SUCCESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."agent_task_logs" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "parent_log_id" TEXT,
    "agent_type" "ai_agent"."AgentType" NOT NULL,
    "node_type" "ai_agent"."AgentNodeType" NOT NULL,
    "task_type" TEXT NOT NULL,
    "trigger" "ai_agent"."TaskTrigger" NOT NULL DEFAULT 'USER_MESSAGE',
    "actor_user_id" TEXT,
    "actor_employee_id" TEXT,
    "status" "ai_agent"."AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "permission_decision" "ai_agent"."PermissionDecision",
    "source_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "input_summary" TEXT,
    "output_summary" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "correlation_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "agent_task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."agent_handoffs" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "parent_task_log_id" TEXT NOT NULL,
    "specialist_task_log_id" TEXT,
    "from_agent_type" "ai_agent"."AgentType" NOT NULL,
    "to_agent_type" "ai_agent"."AgentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "requested_intent" TEXT NOT NULL,
    "permission_decision" "ai_agent"."PermissionDecision" NOT NULL,
    "status" "ai_agent"."AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."agent_node_runs" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "task_log_id" TEXT NOT NULL,
    "node_type" "ai_agent"."AgentNodeType" NOT NULL,
    "agent_type" "ai_agent"."AgentType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "state_before" JSONB,
    "state_after" JSONB,
    "status" "ai_agent"."AgentRunStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_node_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."clarification_requests" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "task_log_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ai_agent"."ClarificationStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "clarification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."human_escalations" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "task_log_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "target_type" "ai_agent"."HumanEscalationTargetType" NOT NULL,
    "target_label" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary_for_human" TEXT NOT NULL,
    "status" "ai_agent"."HumanEscalationStatus" NOT NULL DEFAULT 'RECORDED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "human_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."response_feedback" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" "ai_agent"."FeedbackRating" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."knowledge_items" (
    "id" TEXT NOT NULL,
    "source_type" "ai_agent"."KnowledgeSourceType" NOT NULL,
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "status" "ai_agent"."KnowledgeItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."vector_documents" (
    "id" TEXT NOT NULL,
    "knowledge_item_id" TEXT,
    "source_type" "ai_agent"."KnowledgeSourceType" NOT NULL,
    "source_id" TEXT,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vector_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent"."permission_decisions" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "task_log_id" TEXT NOT NULL,
    "agent_type" "ai_agent"."AgentType" NOT NULL,
    "decision" "ai_agent"."PermissionDecision" NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_owner_user_id_updated_at_idx" ON "ai_agent"."conversations"("owner_user_id", "updated_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "ai_agent"."messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_task_logs_conversation_id_started_at_idx" ON "ai_agent"."agent_task_logs"("conversation_id", "started_at");

-- CreateIndex
CREATE INDEX "agent_task_logs_parent_log_id_idx" ON "ai_agent"."agent_task_logs"("parent_log_id");

-- CreateIndex
CREATE INDEX "agent_handoffs_conversation_id_created_at_idx" ON "ai_agent"."agent_handoffs"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_node_runs_conversation_id_sequence_idx" ON "ai_agent"."agent_node_runs"("conversation_id", "sequence");

-- CreateIndex
CREATE INDEX "clarification_requests_conversation_id_status_idx" ON "ai_agent"."clarification_requests"("conversation_id", "status");

-- CreateIndex
CREATE INDEX "human_escalations_conversation_id_created_at_idx" ON "ai_agent"."human_escalations"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "response_feedback_message_id_user_id_key" ON "ai_agent"."response_feedback"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "response_feedback_conversation_id_created_at_idx" ON "ai_agent"."response_feedback"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "knowledge_items_source_type_source_id_idx" ON "ai_agent"."knowledge_items"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "vector_documents_knowledge_item_id_chunk_index_idx" ON "ai_agent"."vector_documents"("knowledge_item_id", "chunk_index");

-- CreateIndex
CREATE INDEX "permission_decisions_conversation_id_created_at_idx" ON "ai_agent"."permission_decisions"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "permission_decisions_task_log_id_idx" ON "ai_agent"."permission_decisions"("task_log_id");

-- AddForeignKey
ALTER TABLE "ai_agent"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_task_logs" ADD CONSTRAINT "agent_task_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_task_logs" ADD CONSTRAINT "agent_task_logs_parent_log_id_fkey" FOREIGN KEY ("parent_log_id") REFERENCES "ai_agent"."agent_task_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_handoffs" ADD CONSTRAINT "agent_handoffs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_handoffs" ADD CONSTRAINT "agent_handoffs_parent_task_log_id_fkey" FOREIGN KEY ("parent_task_log_id") REFERENCES "ai_agent"."agent_task_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_handoffs" ADD CONSTRAINT "agent_handoffs_specialist_task_log_id_fkey" FOREIGN KEY ("specialist_task_log_id") REFERENCES "ai_agent"."agent_task_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_node_runs" ADD CONSTRAINT "agent_node_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."agent_node_runs" ADD CONSTRAINT "agent_node_runs_task_log_id_fkey" FOREIGN KEY ("task_log_id") REFERENCES "ai_agent"."agent_task_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."clarification_requests" ADD CONSTRAINT "clarification_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."clarification_requests" ADD CONSTRAINT "clarification_requests_task_log_id_fkey" FOREIGN KEY ("task_log_id") REFERENCES "ai_agent"."agent_task_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."human_escalations" ADD CONSTRAINT "human_escalations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."human_escalations" ADD CONSTRAINT "human_escalations_task_log_id_fkey" FOREIGN KEY ("task_log_id") REFERENCES "ai_agent"."agent_task_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."response_feedback" ADD CONSTRAINT "response_feedback_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."response_feedback" ADD CONSTRAINT "response_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_agent"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."vector_documents" ADD CONSTRAINT "vector_documents_knowledge_item_id_fkey" FOREIGN KEY ("knowledge_item_id") REFERENCES "ai_agent"."knowledge_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."permission_decisions" ADD CONSTRAINT "permission_decisions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent"."permission_decisions" ADD CONSTRAINT "permission_decisions_task_log_id_fkey" FOREIGN KEY ("task_log_id") REFERENCES "ai_agent"."agent_task_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
