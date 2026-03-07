-- AlterTable: Add thumbnail cache fields to SlideEmbedding
ALTER TABLE "SlideEmbedding" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "SlideEmbedding" ADD COLUMN "thumbnailFetchedAt" TIMESTAMP(3);
