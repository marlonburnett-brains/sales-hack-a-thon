"use server";

import { revalidatePath } from "next/cache";
import {
  startTouch1Workflow,
  getWorkflowStatus,
  resumeTouch1Workflow,
  startTouch2Workflow,
  getTouch2WorkflowStatus,
  resumeTouch2Workflow,
  startTouch3Workflow,
  getTouch3WorkflowStatus,
  resumeTouch3Workflow,
  startTouch4Workflow,
  getTouch4WorkflowStatus,
  resumeTouch4Workflow,
  resumeWorkflowStep,
  revertInteractionStage,
  regenerateInteractionStage,
  getBrief,
  getBriefReview,
  approveBrief,
  rejectBrief,
  editBrief,
  getAssetReview,
  approveAssets,
  rejectAssets,
  startPreCallWorkflow,
  getPreCallWorkflowStatus,
} from "@/lib/api-client";
import type {
  WorkflowStartResult,
  WorkflowRunResult,
  HitlStage,
  BriefRecord,
  BriefReviewData,
  AssetReviewData,
} from "@/lib/api-client";

export type { HitlStage };

export async function generateTouch1PagerAction(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    context: string;
    salespersonName?: string;
    enableVisualQA?: boolean;
  }
): Promise<WorkflowStartResult> {
  const result = await startTouch1Workflow(dealId, formData);
  return result;
}

export async function checkTouch1StatusAction(
  runId: string
): Promise<WorkflowRunResult> {
  return getWorkflowStatus(runId);
}

export async function approveTouch1Action(
  runId: string,
  stepId: string,
  decision: "approved" | "edited",
  editedContent?: Record<string, unknown>
): Promise<WorkflowRunResult> {
  const result = await resumeTouch1Workflow(runId, stepId, {
    decision,
    editedContent,
  });
  revalidatePath("/deals");
  return result;
}

// ────────────────────────────────────────────────────────────
// Touch 2 Actions
// ────────────────────────────────────────────────────────────

export async function generateTouch2DeckAction(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    salespersonName?: string;
    salespersonPhotoUrl?: string;
    customerName?: string;
    customerLogoUrl?: string;
    context?: string;
    priorTouchOutputs?: string[];
    enableVisualQA?: boolean;
  }
): Promise<WorkflowStartResult> {
  const result = await startTouch2Workflow(dealId, formData);
  return result;
}

export async function checkTouch2StatusAction(
  runId: string
): Promise<WorkflowRunResult> {
  return getTouch2WorkflowStatus(runId);
}

// ────────────────────────────────────────────────────────────
// Touch 3 Actions
// ────────────────────────────────────────────────────────────

export async function generateTouch3DeckAction(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    capabilityAreas: string[];
    context?: string;
    priorTouchOutputs?: string[];
    enableVisualQA?: boolean;
  }
): Promise<WorkflowStartResult> {
  const result = await startTouch3Workflow(dealId, formData);
  return result;
}

export async function checkTouch3StatusAction(
  runId: string
): Promise<WorkflowRunResult> {
  return getTouch3WorkflowStatus(runId);
}

// ────────────────────────────────────────────────────────────
// Touch 4 Actions
// ────────────────────────────────────────────────────────────

export async function generateTouch4BriefAction(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    subsector: string;
    transcript: string;
    additionalNotes?: string;
    enableVisualQA?: boolean;
  }
): Promise<WorkflowStartResult> {
  const result = await startTouch4Workflow(dealId, formData);
  return result;
}

export async function checkTouch4StatusAction(
  runId: string
): Promise<WorkflowRunResult> {
  return getTouch4WorkflowStatus(runId);
}

export async function resumeTouch4FieldReviewAction(
  runId: string,
  stepId: string,
  reviewedFields: {
    customerContext: string;
    businessOutcomes: string;
    constraints: string;
    stakeholders: string;
    timeline: string;
    budget: string;
  }
): Promise<WorkflowRunResult> {
  const result = await resumeTouch4Workflow(runId, stepId, { reviewedFields });
  revalidatePath("/deals");
  return result;
}

// ────────────────────────────────────────────────────────────
// Stage Transition Actions (3-Stage HITL Model)
// ────────────────────────────────────────────────────────────

const TOUCH_WORKFLOW_IDS: Record<string, string> = {
  touch_1: "touch-1-workflow",
  touch_2: "touch-2-workflow",
  touch_3: "touch-3-workflow",
  touch_4: "touch-4-workflow",
};

/**
 * Resume a suspended workflow step with an approval or refinement decision.
 * Used for advancing between HITL stages (skeleton -> lowfi -> highfi -> ready).
 */
export async function transitionStageAction(
  interactionId: string,
  runId: string,
  stepId: string,
  touchType: string,
  decision: "approved" | "refined",
  refinedContent?: unknown
): Promise<WorkflowRunResult> {
  const workflowId = TOUCH_WORKFLOW_IDS[touchType];
  if (!workflowId) {
    throw new Error(`Unknown touch type: ${touchType}`);
  }

  // Use per-touch resume functions where available for type safety,
  // fall back to generic resume for all touches
  let result: WorkflowRunResult;

  switch (touchType) {
    case "touch_1":
      result = await resumeTouch1Workflow(runId, stepId, {
        decision: decision === "approved" ? "approved" : "edited",
        editedContent: refinedContent as Record<string, unknown> | undefined,
      });
      break;
    case "touch_2":
      result = await resumeTouch2Workflow(runId, stepId, {
        decision,
        refinedContent,
      });
      break;
    case "touch_3":
      result = await resumeTouch3Workflow(runId, stepId, {
        decision,
        refinedContent,
      });
      break;
    case "touch_4":
      result = await resumeWorkflowStep(workflowId, runId, stepId, {
        decision,
        refinedContent,
      });
      break;
    default:
      result = await resumeWorkflowStep(workflowId, runId, stepId, {
        decision,
        refinedContent,
      });
  }

  revalidatePath("/deals");
  return result;
}

/**
 * Revert an interaction to a previous HITL stage.
 * Updates InteractionRecord.hitlStage and clears downstream stageContent.
 * Does NOT restart the workflow -- the UI triggers a new generation run.
 * Per locked decision: "downstream stages regenerate" when user goes back.
 */
export async function revertStageAction(
  interactionId: string,
  targetStage: HitlStage
): Promise<{ success: boolean }> {
  const result = await revertInteractionStage(interactionId, targetStage);
  revalidatePath("/deals");
  return result;
}

/**
 * Re-run LLM generation for the current stage without starting a new workflow.
 */
export async function regenerateStageAction(
  interactionId: string,
  feedback?: string,
  wipeData?: boolean
): Promise<{ success: boolean; stage: string }> {
  const result = await regenerateInteractionStage(interactionId, feedback, wipeData);
  revalidatePath("/deals");
  return result;
}

// ────────────────────────────────────────────────────────────
// Brief Approval Actions (Phase 6 -- HITL Checkpoint 1)
// ────────────────────────────────────────────────────────────

export async function getBriefAction(
  briefId: string
): Promise<BriefRecord> {
  return getBrief(briefId);
}

export async function getBriefReviewAction(
  briefId: string
): Promise<BriefReviewData> {
  return getBriefReview(briefId);
}

export async function approveBriefAction(
  briefId: string,
  data: {
    reviewerName: string;
    editedBrief?: Record<string, unknown>;
    runId: string;
  }
): Promise<{ success: boolean }> {
  const result = await approveBrief(briefId, data);
  revalidatePath("/deals");
  return result;
}

export async function rejectBriefAction(
  briefId: string,
  data: { reviewerName: string; feedback: string }
): Promise<{ success: boolean }> {
  const result = await rejectBrief(briefId, data);
  revalidatePath("/deals");
  return result;
}

export async function editBriefAction(
  briefId: string,
  data: { editedBrief: Record<string, unknown>; reviewerName: string }
): Promise<{ success: boolean }> {
  const result = await editBrief(briefId, data);
  revalidatePath("/deals");
  return result;
}

// ────────────────────────────────────────────────────────────
// Asset Review Actions (Phase 9 -- HITL Checkpoint 2)
// ────────────────────────────────────────────────────────────

export async function getAssetReviewAction(
  interactionId: string
): Promise<AssetReviewData> {
  return getAssetReview(interactionId);
}

export async function approveAssetsAction(
  interactionId: string,
  data: { reviewerName: string; reviewerRole: string; runId: string }
): Promise<{ success: boolean }> {
  const result = await approveAssets(interactionId, data);
  revalidatePath("/deals");
  return result;
}

export async function rejectAssetsAction(
  interactionId: string,
  data: { reviewerName: string; reviewerRole: string; feedback: string }
): Promise<{ success: boolean }> {
  const result = await rejectAssets(interactionId, data);
  revalidatePath("/deals");
  return result;
}

// ────────────────────────────────────────────────────────────
// Pre-Call Briefing Actions
// ────────────────────────────────────────────────────────────

export async function generatePreCallBriefingAction(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    buyerRole: string;
    meetingContext: string;
  }
) {
  const result = await startPreCallWorkflow(dealId, formData);
  revalidatePath(`/deals/${dealId}`);
  return result;
}

export async function checkPreCallStatusAction(runId: string) {
  return getPreCallWorkflowStatus(runId);
}
