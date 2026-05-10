-- AlterEnum
ALTER TYPE "hr_core"."SecurityEventType" ADD VALUE 'INVITE_SENT';
ALTER TYPE "hr_core"."SecurityEventType" ADD VALUE 'INVITE_CLAIMED';

-- CreateTable
CREATE TABLE "hr_core"."invite_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_tokens_tokenHash_key" ON "hr_core"."invite_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "invite_tokens_userId_idx" ON "hr_core"."invite_tokens"("userId");

-- CreateIndex
CREATE INDEX "invite_tokens_expiresAt_idx" ON "hr_core"."invite_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "hr_core"."invite_tokens" ADD CONSTRAINT "invite_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "hr_core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
