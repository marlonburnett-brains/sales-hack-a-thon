-- Baseline migration: capture models added via db push (Company, Deal, InteractionRecord,
-- FeedbackSignal, Transcript, Brief) so migration history matches the actual database.
-- This migration is marked as already applied via `prisma migrate resolve`.

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salespersonName" TEXT,
    "salespersonPhoto" TEXT,
    "driveFolderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InteractionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "touchType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inputs" TEXT NOT NULL,
    "decision" TEXT,
    "generatedContent" TEXT,
    "outputRefs" TEXT,
    "driveFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InteractionRecord_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interactionId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackSignal_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "InteractionRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interactionId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "additionalNotes" TEXT,
    "subsector" TEXT NOT NULL,
    "customerContext" TEXT NOT NULL DEFAULT '',
    "businessOutcomes" TEXT NOT NULL DEFAULT '',
    "constraints" TEXT NOT NULL DEFAULT '',
    "stakeholders" TEXT NOT NULL DEFAULT '',
    "timeline" TEXT NOT NULL DEFAULT '',
    "budget" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transcript_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "InteractionRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interactionId" TEXT NOT NULL,
    "primaryPillar" TEXT NOT NULL,
    "secondaryPillars" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "customerContext" TEXT NOT NULL,
    "businessOutcomes" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "stakeholders" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "useCases" TEXT NOT NULL,
    "roiFraming" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending_approval',
    "reviewerName" TEXT,
    "approvedAt" DATETIME,
    "rejectionFeedback" TEXT,
    "workflowRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Brief_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "InteractionRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Deal_companyId_idx" ON "Deal"("companyId");

-- CreateIndex
CREATE INDEX "InteractionRecord_dealId_idx" ON "InteractionRecord"("dealId");

-- CreateIndex
CREATE INDEX "InteractionRecord_touchType_idx" ON "InteractionRecord"("touchType");

-- CreateIndex
CREATE INDEX "FeedbackSignal_interactionId_idx" ON "FeedbackSignal"("interactionId");

-- CreateIndex
CREATE INDEX "FeedbackSignal_signalType_idx" ON "FeedbackSignal"("signalType");

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_interactionId_key" ON "Transcript"("interactionId");

-- CreateIndex
CREATE INDEX "Transcript_interactionId_idx" ON "Transcript"("interactionId");

-- CreateIndex
CREATE INDEX "Transcript_subsector_idx" ON "Transcript"("subsector");

-- CreateIndex
CREATE UNIQUE INDEX "Brief_interactionId_key" ON "Brief"("interactionId");

-- CreateIndex
CREATE INDEX "Brief_interactionId_idx" ON "Brief"("interactionId");

-- CreateIndex
CREATE INDEX "Brief_primaryPillar_idx" ON "Brief"("primaryPillar");
