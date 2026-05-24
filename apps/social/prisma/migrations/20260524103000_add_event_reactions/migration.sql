CREATE TABLE "social"."event_reactions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_reactions_eventId_employeeId_key" ON "social"."event_reactions"("eventId", "employeeId");

CREATE INDEX "event_reactions_eventId_emoji_idx" ON "social"."event_reactions"("eventId", "emoji");

ALTER TABLE "social"."event_reactions" ADD CONSTRAINT "event_reactions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "social"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
