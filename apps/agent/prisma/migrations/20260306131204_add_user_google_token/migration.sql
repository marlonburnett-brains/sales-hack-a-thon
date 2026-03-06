-- CreateTable
CREATE TABLE "UserGoogleToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedRefresh" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGoogleToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGoogleToken_userId_key" ON "UserGoogleToken"("userId");

-- CreateIndex
CREATE INDEX "UserGoogleToken_isValid_lastUsedAt_idx" ON "UserGoogleToken"("isValid", "lastUsedAt");

-- CreateIndex
CREATE INDEX "UserGoogleToken_email_idx" ON "UserGoogleToken"("email");
