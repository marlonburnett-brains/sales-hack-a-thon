-- CreateTable
CREATE TABLE "ActionRequired" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actionType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceName" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRequired_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionRequired_resolved_idx" ON "ActionRequired"("resolved");

-- CreateIndex
CREATE INDEX "ActionRequired_userId_idx" ON "ActionRequired"("userId");

-- CreateIndex
CREATE INDEX "ActionRequired_actionType_idx" ON "ActionRequired"("actionType");
