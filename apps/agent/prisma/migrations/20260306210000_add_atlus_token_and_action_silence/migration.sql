-- AlterTable: Add silence/seen tracking to ActionRequired
ALTER TABLE "ActionRequired" ADD COLUMN     "seenAt" TIMESTAMP(3),
ADD COLUMN     "silenced" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: UserAtlusToken for encrypted AtlusAI token storage
CREATE TABLE "UserAtlusToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAtlusToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAtlusToken_userId_key" ON "UserAtlusToken"("userId");

-- CreateIndex
CREATE INDEX "UserAtlusToken_isValid_lastUsedAt_idx" ON "UserAtlusToken"("isValid", "lastUsedAt");

-- CreateIndex
CREATE INDEX "UserAtlusToken_email_idx" ON "UserAtlusToken"("email");
