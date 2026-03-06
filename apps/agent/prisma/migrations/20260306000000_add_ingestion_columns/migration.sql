-- AlterTable: Add ingestion support columns to SlideEmbedding
ALTER TABLE "SlideEmbedding" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "SlideEmbedding" ADD COLUMN "classificationJson" TEXT;
ALTER TABLE "SlideEmbedding" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SlideEmbedding" ADD COLUMN "speakerNotes" TEXT;
ALTER TABLE "SlideEmbedding" ADD COLUMN "slideObjectId" TEXT;
ALTER TABLE "SlideEmbedding" ADD COLUMN "needsReReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SlideEmbedding" ADD COLUMN "previousClassificationJson" TEXT;

-- AlterTable: Add ingestion tracking columns to Template
ALTER TABLE "Template" ADD COLUMN "ingestionStatus" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "Template" ADD COLUMN "ingestionProgress" TEXT;

-- CreateIndex: Unique constraint for smart merge upsert
CREATE UNIQUE INDEX "SlideEmbedding_templateId_contentHash_key" ON "SlideEmbedding"("templateId", "contentHash");

-- CreateIndex: Index for archived filtering
CREATE INDEX "SlideEmbedding_archived_idx" ON "SlideEmbedding"("archived");
