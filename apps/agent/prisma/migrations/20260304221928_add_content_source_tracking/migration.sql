-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "contentType" TEXT,
    "touchTypes" TEXT,
    "accessStatus" TEXT NOT NULL DEFAULT 'not_accessible',
    "driveFileId" TEXT,
    "driveUrl" TEXT,
    "folderPath" TEXT,
    "lastCheckedAt" DATETIME,
    "errorMessage" TEXT,
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "ingestedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentSource_name_key" ON "ContentSource"("name");

-- CreateIndex
CREATE INDEX "ContentSource_accessStatus_idx" ON "ContentSource"("accessStatus");

-- CreateIndex
CREATE INDEX "ContentSource_contentType_idx" ON "ContentSource"("contentType");
