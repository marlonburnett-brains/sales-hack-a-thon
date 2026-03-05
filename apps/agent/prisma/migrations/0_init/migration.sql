-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "WorkflowJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" TEXT NOT NULL,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "driveFileId" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "contentType" TEXT,
    "touchTypes" TEXT,
    "accessStatus" TEXT NOT NULL DEFAULT 'not_accessible',
    "driveFileId" TEXT,
    "driveUrl" TEXT,
    "folderPath" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "ingestedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salespersonName" TEXT,
    "salespersonPhoto" TEXT,
    "driveFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionRecord" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "touchType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inputs" TEXT NOT NULL,
    "decision" TEXT,
    "generatedContent" TEXT,
    "outputRefs" TEXT,
    "driveFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InteractionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackSignal" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
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
    "approvedAt" TIMESTAMP(3),
    "rejectionFeedback" TEXT,
    "workflowRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_driveFileId_key" ON "ImageAsset"("driveFileId");

-- CreateIndex
CREATE INDEX "ImageAsset_category_idx" ON "ImageAsset"("category");

-- CreateIndex
CREATE INDEX "ImageAsset_name_idx" ON "ImageAsset"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSource_name_key" ON "ContentSource"("name");

-- CreateIndex
CREATE INDEX "ContentSource_accessStatus_idx" ON "ContentSource"("accessStatus");

-- CreateIndex
CREATE INDEX "ContentSource_contentType_idx" ON "ContentSource"("contentType");

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

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionRecord" ADD CONSTRAINT "InteractionRecord_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSignal" ADD CONSTRAINT "FeedbackSignal_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "InteractionRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "InteractionRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "InteractionRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

