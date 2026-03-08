-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentConfig" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "touchTypes" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentConfigVersion" (
    "id" TEXT NOT NULL,
    "agentConfigId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "baselinePrompt" TEXT NOT NULL,
    "rolePrompt" TEXT NOT NULL,
    "compiledPrompt" TEXT,
    "changeSummary" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgentConfig_agentId_key" ON "AgentConfig"("agentId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentConfig_publishedVersionId_key" ON "AgentConfig"("publishedVersionId");
CREATE INDEX IF NOT EXISTS "AgentConfig_family_idx" ON "AgentConfig"("family");
CREATE INDEX IF NOT EXISTS "AgentConfig_status_idx" ON "AgentConfig"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentConfigVersion_agentConfigId_version_key" ON "AgentConfigVersion"("agentConfigId", "version");
CREATE INDEX IF NOT EXISTS "AgentConfigVersion_agentConfigId_idx" ON "AgentConfigVersion"("agentConfigId");
CREATE INDEX IF NOT EXISTS "AgentConfigVersion_isPublished_idx" ON "AgentConfigVersion"("isPublished");

-- AddForeignKey
ALTER TABLE "AgentConfigVersion"
ADD CONSTRAINT "AgentConfigVersion_agentConfigId_fkey"
FOREIGN KEY ("agentConfigId") REFERENCES "AgentConfig"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentConfig"
ADD CONSTRAINT "AgentConfig_publishedVersionId_fkey"
FOREIGN KEY ("publishedVersionId") REFERENCES "AgentConfigVersion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
