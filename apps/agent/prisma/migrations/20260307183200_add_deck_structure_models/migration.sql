-- CreateTable
CREATE TABLE IF NOT EXISTS "DeckStructure" (
    "id" TEXT NOT NULL,
    "touchType" TEXT NOT NULL,
    "structureJson" TEXT NOT NULL,
    "exampleCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chatContextJson" TEXT,
    "dataHash" TEXT,
    "inferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeckStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeckChatMessage" (
    "id" TEXT NOT NULL,
    "deckStructureId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structureDiff" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DeckStructure_touchType_key" ON "DeckStructure"("touchType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeckStructure_touchType_idx" ON "DeckStructure"("touchType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeckChatMessage_deckStructureId_idx" ON "DeckChatMessage"("deckStructureId");

-- AddForeignKey
ALTER TABLE "DeckChatMessage" ADD CONSTRAINT "DeckChatMessage_deckStructureId_fkey" FOREIGN KEY ("deckStructureId") REFERENCES "DeckStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
