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
