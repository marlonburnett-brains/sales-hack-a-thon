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
} from "@/lib/api-client";
import type { WorkflowStartResult, WorkflowRunResult } from "@/lib/api-client";

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
