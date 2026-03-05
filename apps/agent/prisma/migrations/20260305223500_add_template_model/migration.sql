-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "googleSlidesUrl" TEXT NOT NULL,
    "touchTypes" TEXT NOT NULL,
    "accessStatus" TEXT NOT NULL DEFAULT 'not_checked',
    "lastIngestedAt" TIMESTAMP(3),
    "sourceModifiedAt" TIMESTAMP(3),
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_presentationId_key" ON "Template"("presentationId");

-- CreateIndex
CREATE INDEX "Template_accessStatus_idx" ON "Template"("accessStatus");
