-- CreateTable
CREATE TABLE "DiscoveryDocCache" (
    "id" TEXT NOT NULL,
    "atlusDocId" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "driveFileId" TEXT,
    "mimeType" TEXT,
    "isGoogleSlides" BOOLEAN NOT NULL DEFAULT false,
    "googleSlidesUrl" TEXT,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryDocCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryDocCache_atlusDocId_key" ON "DiscoveryDocCache"("atlusDocId");

-- CreateIndex
CREATE INDEX "DiscoveryDocCache_isGoogleSlides_idx" ON "DiscoveryDocCache"("isGoogleSlides");

-- CreateIndex
CREATE INDEX "DiscoveryDocCache_driveFileId_idx" ON "DiscoveryDocCache"("driveFileId");
