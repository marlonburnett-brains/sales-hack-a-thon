CREATE TABLE IF NOT EXISTS "DeckStructure" (
    "id" TEXT NOT NULL,
    "touchType" TEXT NOT NULL,
    "artifactType" TEXT,
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

CREATE INDEX IF NOT EXISTS "DeckStructure_touchType_idx"
ON "DeckStructure"("touchType");
