-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "driveFileId" TEXT NOT NULL,
    "driveUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAsset_driveFileId_key" ON "ImageAsset"("driveFileId");

-- CreateIndex
CREATE INDEX "ImageAsset_category_idx" ON "ImageAsset"("category");

-- CreateIndex
CREATE INDEX "ImageAsset_name_idx" ON "ImageAsset"("name");
