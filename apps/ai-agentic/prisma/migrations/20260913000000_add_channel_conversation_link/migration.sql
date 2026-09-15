-- CreateEnum
-- WHY a ChannelType enum in the ai_agent schema: services never share schema
-- objects, so the hr_core enum of the same name is not reachable from here. The
-- members mirror packages/shared/src/enums/channel-type.enum.ts exactly.
CREATE TYPE "ai_agent"."ChannelType" AS ENUM ('WEB', 'SLACK', 'TELEGRAM', 'WHATSAPP', 'EMAIL', 'IN_APP');

-- CreateTable
-- WHY: which conversation a chat channel thread (a Telegram chat, later a Slack
-- DM) currently continues. One row per (channel, externalId); "/new" deletes it.
-- Cascade from conversations so deleting a thread in the web app drops the pointer.
CREATE TABLE "ai_agent"."channel_conversation_links" (
    "id" TEXT NOT NULL,
    "channel" "ai_agent"."ChannelType" NOT NULL,
    "external_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_conversation_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_conversation_links_channel_external_id_key" ON "ai_agent"."channel_conversation_links"("channel", "external_id");

-- CreateIndex
CREATE INDEX "channel_conversation_links_conversation_id_idx" ON "ai_agent"."channel_conversation_links"("conversation_id");

-- AddForeignKey
ALTER TABLE "ai_agent"."channel_conversation_links" ADD CONSTRAINT "channel_conversation_links_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_agent"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
