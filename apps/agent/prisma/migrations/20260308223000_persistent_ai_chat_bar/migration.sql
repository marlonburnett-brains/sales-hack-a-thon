-- CreateTable
CREATE TABLE IF NOT EXISTS "DealChatThread" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "promptSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DealChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "routeSection" TEXT NOT NULL,
    "routeTouchType" TEXT,
    "routePathname" TEXT NOT NULL,
    "routePageLabel" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DealContextSource" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "touchType" TEXT,
    "interactionId" TEXT,
    "originPage" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "refinedText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_confirmation',
    "bindingMetaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealContextSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DealChatThread_dealId_key" ON "DealChatThread"("dealId");
CREATE INDEX IF NOT EXISTS "DealChatMessage_threadId_createdAt_idx" ON "DealChatMessage"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "DealChatMessage_routeSection_idx" ON "DealChatMessage"("routeSection");
CREATE INDEX IF NOT EXISTS "DealContextSource_dealId_createdAt_idx" ON "DealContextSource"("dealId", "createdAt");
CREATE INDEX IF NOT EXISTS "DealContextSource_interactionId_idx" ON "DealContextSource"("interactionId");
CREATE INDEX IF NOT EXISTS "DealContextSource_sourceType_status_idx" ON "DealContextSource"("sourceType", "status");
CREATE INDEX IF NOT EXISTS "DealContextSource_touchType_idx" ON "DealContextSource"("touchType");

-- AddForeignKey
ALTER TABLE "DealChatThread"
ADD CONSTRAINT "DealChatThread_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealChatMessage"
ADD CONSTRAINT "DealChatMessage_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "DealChatThread"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealContextSource"
ADD CONSTRAINT "DealContextSource_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealContextSource"
ADD CONSTRAINT "DealContextSource_interactionId_fkey"
FOREIGN KEY ("interactionId") REFERENCES "InteractionRecord"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
