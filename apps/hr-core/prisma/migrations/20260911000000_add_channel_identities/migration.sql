-- AlterEnum
-- WHY: TELEGRAM joins the existing chat channels so a Session / ChannelIdentity
-- row can record which channel a token was issued on. Additive only — no
-- existing value is renamed or removed, so no data backfill is needed.
ALTER TYPE "hr_core"."ChannelType" ADD VALUE IF NOT EXISTS 'TELEGRAM';

-- AlterEnum
-- WHY: Linking/unlinking a chat channel is a security-relevant account change
-- and must land in the same SecurityEvent audit trail as logins and invites.
-- Two ADD VALUEs in one migration require PostgreSQL 12+ (this project is on 16).
ALTER TYPE "hr_core"."SecurityEventType" ADD VALUE IF NOT EXISTS 'CHANNEL_LINKED';
ALTER TYPE "hr_core"."SecurityEventType" ADD VALUE IF NOT EXISTS 'CHANNEL_UNLINKED';

-- CreateTable
-- WHY: Maps an external chat identity (Telegram chatId, Slack userId) to a
-- Sentient User so an inbound chat message resolves to a real, RBAC-scoped
-- session instead of a SYSTEM/GLOBAL bypass.
CREATE TABLE "hr_core"."channel_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "hr_core"."ChannelType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- WHY: One-time codes for the two-step link handshake. Only the hash is stored
-- (same treatment as refresh tokens and invite tokens), and consumedAt makes
-- redemption single-use via an atomic conditional UPDATE.
CREATE TABLE "hr_core"."channel_link_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "hr_core"."ChannelType" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_identities_userId_idx" ON "hr_core"."channel_identities"("userId");

-- CreateIndex
-- WHY: One Sentient account per external chat — re-pairing the same chatId
-- upserts onto this unique index rather than creating a second mapping.
CREATE UNIQUE INDEX "channel_identities_channel_externalId_key" ON "hr_core"."channel_identities"("channel", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_link_codes_codeHash_key" ON "hr_core"."channel_link_codes"("codeHash");

-- CreateIndex
CREATE INDEX "channel_link_codes_userId_channel_idx" ON "hr_core"."channel_link_codes"("userId", "channel");

-- CreateIndex
CREATE INDEX "channel_link_codes_expiresAt_idx" ON "hr_core"."channel_link_codes"("expiresAt");

-- AddForeignKey
ALTER TABLE "hr_core"."channel_identities" ADD CONSTRAINT "channel_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hr_core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_core"."channel_link_codes" ADD CONSTRAINT "channel_link_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hr_core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
