-- AlterTable: Add HITL stage tracking fields to InteractionRecord
ALTER TABLE "InteractionRecord" ADD COLUMN "hitlStage" TEXT;
ALTER TABLE "InteractionRecord" ADD COLUMN "stageContent" TEXT;
