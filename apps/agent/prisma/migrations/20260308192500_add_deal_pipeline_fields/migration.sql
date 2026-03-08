-- AlterTable: Add deal pipeline fields to Deal
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "ownerEmail" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "collaborators" TEXT NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_status_idx" ON "Deal"("status");
CREATE INDEX IF NOT EXISTS "Deal_ownerId_idx" ON "Deal"("ownerId");
