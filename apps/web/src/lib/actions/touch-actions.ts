"use server";

import { revalidatePath } from "next/cache";
import {
  startTouch1Workflow,
  getWorkflowStatus,
  resumeTouch1Workflow,
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
