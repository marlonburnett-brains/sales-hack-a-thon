-- AlterTable: Add description column to SlideEmbedding
ALTER TABLE "SlideEmbedding" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- CreateTable: SlideElement for storing per-element structural data
CREATE TABLE IF NOT EXISTS "SlideElement" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "elementType" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "contentText" TEXT NOT NULL DEFAULT '',
    "fontSize" DOUBLE PRECISION,
    "fontColor" TEXT,
    "isBold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlideElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SlideElement_slideId_idx" ON "SlideElement"("slideId");

-- CreateIndex (unique constraint)
CREATE UNIQUE INDEX IF NOT EXISTS "SlideElement_slideId_elementId_key" ON "SlideElement"("slideId", "elementId");

-- AddForeignKey
ALTER TABLE "SlideElement" ADD CONSTRAINT "SlideElement_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "SlideEmbedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
