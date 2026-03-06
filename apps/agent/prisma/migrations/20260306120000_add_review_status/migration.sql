-- AlterTable: Add reviewStatus column to SlideEmbedding
ALTER TABLE "SlideEmbedding" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'unreviewed';

-- CreateIndex: Index on reviewStatus for filtering
CREATE INDEX "SlideEmbedding_reviewStatus_idx" ON "SlideEmbedding"("reviewStatus");
