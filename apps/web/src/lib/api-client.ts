/**
 * Typed Fetch Wrapper for Agent Service
 *
 * All web -> agent communication goes through these functions.
 * The agent service URL is configured via AGENT_SERVICE_URL env var.
 */

import { env } from "@/env";

const BASE_URL = env.AGENT_SERVICE_URL;

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

// ────────────────────────────────────────────────────────────
// Company
// ────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  industry: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deals?: Deal[];
}

export async function createCompany(data: {
  name: string;
  industry: string;
  logoUrl?: string;
}): Promise<Company> {
  return fetchJSON<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ────────────────────────────────────────────────────────────
// Deal
// ────────────────────────────────────────────────────────────

export interface Deal {
  id: string;
  companyId: string;
  company?: Company;
  name: string;
  salespersonName: string | null;
  salespersonPhoto: string | null;
  driveFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  interactions?: InteractionRecord[];
}

export async function createDeal(data: {
  companyId: string;
  name: string;
  salespersonName?: string;
  salespersonPhoto?: string;
}): Promise<Deal> {
  return fetchJSON<Deal>("/deals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getDeal(dealId: string): Promise<Deal> {
  return fetchJSON<Deal>(`/deals/${dealId}`);
}

export async function listDeals(): Promise<Deal[]> {
  return fetchJSON<Deal[]>("/deals");
}

// ────────────────────────────────────────────────────────────
// Interactions
// ────────────────────────────────────────────────────────────

export interface FeedbackSignal {
  id: string;
  interactionId: string;
  signalType: string;
  source: string;
  content: string;
  createdAt: string;
}

export interface BriefRecord {
  id: string;
  interactionId: string;
  primaryPillar: string;
  secondaryPillars: string; // JSON array
  evidence: string;
  customerContext: string;
  businessOutcomes: string;
  constraints: string;
  stakeholders: string;
  timeline: string;
  budget: string;
  useCases: string; // JSON
  roiFraming: string; // JSON
  approvalStatus: string; // "pending_approval" | "approved" | "rejected" | "changes_requested"
  reviewerName: string | null;
  approvedAt: string | null;
  rejectionFeedback: string | null;
  workflowRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InteractionRecord {
  id: string;
  dealId: string;
  touchType: string;
  status: string;
  inputs: string;
  decision: string | null;
  generatedContent: string | null;
  outputRefs: string | null;
  driveFileId: string | null;
  createdAt: string;
  updatedAt: string;
  feedbackSignals?: FeedbackSignal[];
  brief?: BriefRecord | null;
}

export async function getInteractions(
  dealId: string
): Promise<InteractionRecord[]> {
  return fetchJSON<InteractionRecord[]>(`/deals/${dealId}/interactions`);
}

// ────────────────────────────────────────────────────────────
// Touch 1 Workflow
// ────────────────────────────────────────────────────────────

export interface WorkflowStartResult {
  runId: string;
  [key: string]: unknown;
}

export interface WorkflowRunResult {
  runId: string;
  status: string;
  steps?: Record<
    string,
    {
      status: string;
      output?: unknown;
      payload?: unknown;
    }
  >;
  result?: unknown;
}

export async function startTouch1Workflow(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    context: string;
    salespersonName?: string;
  }
): Promise<WorkflowStartResult> {
  return fetchJSON<WorkflowStartResult>(
    "/api/workflows/touch-1-workflow/start",
    {
      method: "POST",
      body: JSON.stringify({
        inputData: {
          dealId,
          ...formData,
        },
      }),
    }
  );
}

export async function resumeTouch1Workflow(
  runId: string,
  stepId: string,
  resumeData: {
    decision: "approved" | "edited";
    editedContent?: Record<string, unknown>;
  }
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-1-workflow/${runId}/resume`,
    {
      method: "POST",
      body: JSON.stringify({
        stepId,
        resumeData,
      }),
    }
  );
}

export async function getWorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-1-workflow/${runId}`
  );
}

// ────────────────────────────────────────────────────────────
// Touch 2 Workflow
// ────────────────────────────────────────────────────────────

export async function startTouch2Workflow(
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
  return fetchJSON<WorkflowStartResult>(
    "/api/workflows/touch-2-workflow/start",
    {
      method: "POST",
      body: JSON.stringify({
        inputData: {
          dealId,
          ...formData,
        },
      }),
    }
  );
}

export async function getTouch2WorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-2-workflow/${runId}`
  );
}

// ────────────────────────────────────────────────────────────
// Touch 3 Workflow
// ────────────────────────────────────────────────────────────

export async function startTouch3Workflow(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    capabilityAreas: string[];
    context?: string;
    priorTouchOutputs?: string[];
  }
): Promise<WorkflowStartResult> {
  return fetchJSON<WorkflowStartResult>(
    "/api/workflows/touch-3-workflow/start",
    {
      method: "POST",
      body: JSON.stringify({
        inputData: {
          dealId,
          ...formData,
        },
      }),
    }
  );
}

export async function getTouch3WorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-3-workflow/${runId}`
  );
}

// ────────────────────────────────────────────────────────────
// Touch 4 Workflow
// ────────────────────────────────────────────────────────────

export async function startTouch4Workflow(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    subsector: string;
    transcript: string;
    additionalNotes?: string;
  }
): Promise<WorkflowStartResult> {
  return fetchJSON<WorkflowStartResult>(
    "/api/workflows/touch-4-workflow/start",
    {
      method: "POST",
      body: JSON.stringify({
        inputData: {
          dealId,
          ...formData,
        },
      }),
    }
  );
}

export async function getTouch4WorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-4-workflow/${runId}`
  );
}

export async function resumeTouch4Workflow(
  runId: string,
  stepId: string,
  resumeData: {
    reviewedFields: {
      customerContext: string;
      businessOutcomes: string;
      constraints: string;
      stakeholders: string;
      timeline: string;
      budget: string;
    };
  }
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-4-workflow/${runId}/resume`,
    {
      method: "POST",
      body: JSON.stringify({
        stepId,
        resumeData,
      }),
    }
  );
}

// ────────────────────────────────────────────────────────────
// Touch 1 Override Upload
// ────────────────────────────────────────────────────────────

export interface UploadResult {
  interactionId: string;
  presentationId: string;
  driveUrl: string;
  decision: string;
}

export async function uploadTouch1Override(
  dealId: string,
  file: File
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dealId", dealId);

  const response = await fetch(`${BASE_URL}/touch-1/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<UploadResult>;
}

// ────────────────────────────────────────────────────────────
// Brief Approval API (Phase 6 -- HITL Checkpoint 1)
// ────────────────────────────────────────────────────────────

export interface BriefReviewData {
  brief: BriefRecord;
  deal: { companyName: string; industry: string; dealName: string };
  transcript: { subsector: string; summary: string } | null;
}

export async function getBrief(briefId: string): Promise<BriefRecord> {
  return fetchJSON<BriefRecord>(`/briefs/${briefId}`);
}

export async function getBriefReview(
  briefId: string
): Promise<BriefReviewData> {
  return fetchJSON<BriefReviewData>(`/briefs/${briefId}/review`);
}

export async function approveBrief(
  briefId: string,
  data: {
    reviewerName: string;
    editedBrief?: Record<string, unknown>;
    runId: string;
  }
): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/briefs/${briefId}/approve`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function rejectBrief(
  briefId: string,
  data: { reviewerName: string; feedback: string }
): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/briefs/${briefId}/reject`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function editBrief(
  briefId: string,
  data: { editedBrief: Record<string, unknown>; reviewerName: string }
): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/briefs/${briefId}/edit`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
