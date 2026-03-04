"use server";

import { revalidatePath } from "next/cache";
import {
  startTouch1Workflow,
  getWorkflowStatus,
  resumeTouch1Workflow,
  startTouch2Workflow,
  getTouch2WorkflowStatus,
  startTouch3Workflow,
  getTouch3WorkflowStatus,
  startTouch4Workflow,
  getTouch4WorkflowStatus,
  resumeTouch4Workflow,
  getBrief,
  getBriefReview,
  approveBrief,
  rejectBrief,
  editBrief,
} from "@/lib/api-client";
import type {
  WorkflowStartResult,
  WorkflowRunResult,
  BriefRecord,
  BriefReviewData,
} from "@/lib/api-client";

export async function generateTouch1PagerAction(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    context: string;
    salespersonName?: string;
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
