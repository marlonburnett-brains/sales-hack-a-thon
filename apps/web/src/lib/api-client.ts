import "server-only";

import type {
  ArtifactType,
  DealChatConfirmationChip,
  DealChatMeta,
  DealChatRouteContext,
  DealChatSendRequest,
  DealChatSuggestion,
  DealChatTouchType,
  DealContextSource,
} from "@lumenalta/schemas";

/**
 * Typed Fetch Wrapper for Agent Service
 *
 * All web -> agent communication goes through these functions.
 * The agent service URL is configured via AGENT_SERVICE_URL env var.
 */

import { env } from "@/env";
import { getGoogleAccessToken } from "@/lib/supabase/google-token";
import { getSupabaseAccessToken } from "@/lib/supabase/get-access-token";

const BASE_URL = env.AGENT_SERVICE_URL;

async function fetchAgent(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Not authenticated — no Supabase session");
  }

  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("Agent service is unreachable. Please try again later.");
  }
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchAgent(path, init);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Wrapper around fetchJSON that attaches Google auth headers.
 *
 * Use this for requests that trigger Google API calls on the agent side
 * (e.g. Drive access, Slides API, workflow starts). Non-Google CRUD
 * operations should continue using fetchJSON directly.
 */
export async function fetchWithGoogleAuth<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { accessToken } = await getGoogleAccessToken();

  const googleHeaders: Record<string, string> = {};
  if (accessToken) googleHeaders["X-Google-Access-Token"] = accessToken;
  // userId is now derived from the Supabase JWT on the agent side

  return fetchJSON<T>(path, {
    ...init,
    headers: {
      ...init?.headers,
      ...googleHeaders,
    },
  });
}

export async function fetchWithGoogleAuthResponse(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { accessToken } = await getGoogleAccessToken();

  const googleHeaders: Record<string, string> = {};
  if (accessToken) googleHeaders["X-Google-Access-Token"] = accessToken;
  // userId is now derived from the Supabase JWT on the agent side

  const response = await fetchAgent(path, {
    ...init,
    headers: {
      ...init?.headers,
      ...googleHeaders,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API error (${response.status}): ${text}`);
  }

  return response;
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
  status: string; // "open" | "won" | "lost" | "abandoned"
  ownerId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  collaborators: string; // JSON string: [{id?, email, name?}]
  createdAt: string;
  updatedAt: string;
  interactions?: InteractionRecord[];
}

export interface KnownUser {
  id: string;
  email: string;
  name: string;
}

export async function createDeal(data: {
  companyId: string;
  name: string;
  salespersonName?: string;
  salespersonPhoto?: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  collaborators?: string;
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

export async function listDealsFiltered(params: {
  status?: string;
  assignee?: string;
  userId?: string;
}): Promise<Deal[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.assignee && params.assignee !== "all") qs.set("assignee", params.assignee);
  if (params.userId) qs.set("userId", params.userId);
  return fetchJSON<Deal[]>(`/deals?${qs}`);
}

export async function updateDealStatus(
  dealId: string,
  status: string,
): Promise<Deal> {
  return fetchJSON<Deal>(`/deals/${dealId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function updateDealAssignment(
  dealId: string,
  data: {
    ownerId?: string;
    ownerEmail?: string;
    ownerName?: string;
    collaborators?: Array<{ id?: string; email: string; name?: string }>;
  },
): Promise<Deal> {
  return fetchJSON<Deal>(`/deals/${dealId}/assignment`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listKnownUsers(): Promise<KnownUser[]> {
  return fetchJSON<KnownUser[]>("/users/known");
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
  hitlStage: string | null;
  stageContent: string | null;
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
// Deal Chat
// ────────────────────────────────────────────────────────────

export interface DealChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta: DealChatMeta | null;
  createdAt: string;
}

export interface DealChatBootstrapData {
  messages: DealChatMessageData[];
  greeting: string | null;
  suggestions: DealChatSuggestion[];
}

export type DealChatSendInput = Omit<DealChatSendRequest, "dealId">;

export type DealChatBindingAction = "confirm" | "correct" | "save_general_note";

export interface DealChatBindingRequest {
  sourceId?: string;
  source: DealContextSource;
  action: DealChatBindingAction;
  touchType?: DealChatTouchType | null;
  interactionId?: string | null;
  refinedText?: string | null;
}

export interface DealChatSavedSource {
  id: string;
  dealId: string;
  sourceType: "note" | "transcript";
  touchType: DealChatTouchType | null;
  interactionId: string | null;
  originPage: string;
  rawText: string;
  refinedText: string | null;
  status: string;
  bindingMetaJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealChatBindingResult {
  source: DealChatSavedSource;
  confirmationChip: DealChatConfirmationChip;
}

export async function getDealChatBootstrap(
  dealId: string,
  routeContext: DealChatRouteContext,
): Promise<DealChatBootstrapData> {
  const query = new URLSearchParams({
    section: routeContext.section,
    pathname: routeContext.pathname,
    pageLabel: routeContext.pageLabel,
  });

  if (routeContext.touchType) {
    query.set("touchType", routeContext.touchType);
  }

  return fetchWithGoogleAuth<DealChatBootstrapData>(
    `/deals/${dealId}/chat?${query.toString()}`,
  );
}

export async function sendDealChatMessage(
  dealId: string,
  input: DealChatSendInput,
): Promise<Response> {
  return fetchWithGoogleAuthResponse(`/deals/${dealId}/chat`, {
    method: "POST",
    body: JSON.stringify({
      dealId,
      ...input,
    }),
  });
}

export async function confirmDealChatBinding(
  dealId: string,
  input: DealChatBindingRequest,
): Promise<DealChatBindingResult> {
  return fetchWithGoogleAuth<DealChatBindingResult>(`/deals/${dealId}/chat/bindings`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ────────────────────────────────────────────────────────────
// Generation Log Entry (shared type for workflow step logs)
// ────────────────────────────────────────────────────────────

export interface GenerationLogEntry {
  timestamp: string;
  step: string;
  message: string;
  detail?: string;
}

// ────────────────────────────────────────────────────────────
// Touch 1 Workflow
// ────────────────────────────────────────────────────────────

export interface WorkflowStartResult {
  runId: string;
  status?: string;
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
    enableVisualQA?: boolean;
  }
): Promise<WorkflowStartResult> {
  const result = await fetchWithGoogleAuth<WorkflowStartResult>(
    `/api/workflows/touch-1-workflow/start-async`,
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
  return result;
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
    `/api/workflows/touch-1-workflow/resume?runId=${encodeURIComponent(runId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        step: stepId,
        resumeData,
      }),
    }
  );
}

export async function getWorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-1-workflow/runs/${encodeURIComponent(runId)}`
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
    enableVisualQA?: boolean;
  }
): Promise<WorkflowStartResult> {
  const result = await fetchWithGoogleAuth<WorkflowStartResult>(
    `/api/workflows/touch-2-workflow/start-async`,
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
  return result;
}

export async function resumeTouch2Workflow(
  runId: string,
  stepId: string,
  resumeData: {
    decision: "approved" | "refined";
    refinedContent?: unknown;
  }
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-2-workflow/resume?runId=${encodeURIComponent(runId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        step: stepId,
        resumeData,
      }),
    }
  );
}

export async function getTouch2WorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-2-workflow/runs/${encodeURIComponent(runId)}`
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
    enableVisualQA?: boolean;
  }
): Promise<WorkflowStartResult> {
  const result = await fetchWithGoogleAuth<WorkflowStartResult>(
    `/api/workflows/touch-3-workflow/start-async`,
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
  return result;
}

export async function resumeTouch3Workflow(
  runId: string,
  stepId: string,
  resumeData: {
    decision: "approved" | "refined";
    refinedContent?: unknown;
  }
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-3-workflow/resume?runId=${encodeURIComponent(runId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        step: stepId,
        resumeData,
      }),
    }
  );
}

export async function getTouch3WorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-3-workflow/runs/${encodeURIComponent(runId)}`
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
    enableVisualQA?: boolean;
  }
): Promise<WorkflowStartResult> {
  const result = await fetchWithGoogleAuth<WorkflowStartResult>(
    `/api/workflows/touch-4-workflow/start-async`,
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
  return result;
}

export async function getTouch4WorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/touch-4-workflow/runs/${encodeURIComponent(runId)}`
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
    `/api/workflows/touch-4-workflow/resume?runId=${encodeURIComponent(runId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        step: stepId,
        resumeData,
      }),
    }
  );
}

// ────────────────────────────────────────────────────────────
// HITL Stage Management
// ────────────────────────────────────────────────────────────

export type HitlStage = "skeleton" | "lowfi" | "highfi";

/**
 * Revert an interaction to an earlier HITL stage.
 * Clears downstream stageContent so it can be regenerated.
 */
export async function revertInteractionStage(
  interactionId: string,
  targetStage: HitlStage
): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(
    `/interactions/${interactionId}/revert-stage`,
    {
      method: "POST",
      body: JSON.stringify({ targetStage }),
    }
  );
}

/**
 * Re-run LLM generation for the current HITL stage without starting a new workflow.
 */
export async function regenerateInteractionStage(
  interactionId: string,
  feedback?: string,
  wipeData?: boolean
): Promise<{ success: boolean; stage: string }> {
  return fetchJSON<{ success: boolean; stage: string }>(
    `/interactions/${interactionId}/regenerate-stage`,
    {
      method: "POST",
      body: JSON.stringify({
        feedback: feedback || undefined,
        wipeData: wipeData || undefined,
      }),
    }
  );
}

// ────────────────────────────────────────────────────────────
// Generic Workflow Resume Helper
// ────────────────────────────────────────────────────────────

/**
 * Generic resume function for any workflow step.
 * Use per-touch resume functions when available; use this for generic stage transitions.
 */
export async function resumeWorkflowStep(
  workflowId: string,
  runId: string,
  stepId: string,
  resumeData: unknown
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/${workflowId}/resume?runId=${encodeURIComponent(runId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        step: stepId,
        resumeData,
      }),
    }
  );
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

// ────────────────────────────────────────────────────────────
// Asset Review API (Phase 9 -- HITL Checkpoint 2)
// ────────────────────────────────────────────────────────────

export interface AssetReviewData {
  interaction: {
    id: string;
    status: string;
    outputRefs: {
      deckUrl: string;
      talkTrackUrl: string;
      faqUrl: string;
      dealFolderId: string;
    };
  };
  deal: { companyName: string; industry: string; dealName: string };
  brief: {
    id: string;
    primaryPillar: string;
    workflowRunId: string | null;
    approvalStatus: string;
  } | null;
  complianceResult: {
    passed: boolean;
    warnings: Array<{ check: string; message: string; severity: string }>;
  } | null;
}

export async function getAssetReview(
  interactionId: string
): Promise<AssetReviewData> {
  return fetchJSON<AssetReviewData>(
    `/interactions/${interactionId}/asset-review`
  );
}

export async function approveAssets(
  interactionId: string,
  data: { reviewerName: string; reviewerRole: string; runId: string }
): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(
    `/interactions/${interactionId}/approve-assets`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function rejectAssets(
  interactionId: string,
  data: { reviewerName: string; reviewerRole: string; feedback: string }
): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(
    `/interactions/${interactionId}/reject-assets`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

// ────────────────────────────────────────────────────────────
// Pre-Call Briefing Workflow
// ────────────────────────────────────────────────────────────

export async function startPreCallWorkflow(
  dealId: string,
  formData: {
    companyName: string;
    industry: string;
    buyerRole: string;
    meetingContext: string;
  }
): Promise<WorkflowStartResult> {
  const result = await fetchWithGoogleAuth<WorkflowStartResult>(
    `/api/workflows/pre-call-workflow/start-async`,
    {
      method: "POST",
      body: JSON.stringify({ inputData: { dealId, ...formData } }),
    }
  );
  return result;
}

export async function getPreCallWorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/pre-call-workflow/runs/${encodeURIComponent(runId)}`
  );
}

// ────────────────────────────────────────────────────────────
// Generation Logs (real-time polling)
// ────────────────────────────────────────────────────────────

export interface GenerationLogEntry {
  timestamp: string;
  step: string;
  message: string;
  detail?: string;
}

export async function getGenerationLogs(
  dealId: string,
  touchType: string,
): Promise<GenerationLogEntry[]> {
  const data = await fetchJSON<{ logs: GenerationLogEntry[] }>(
    `/api/generation-logs/${encodeURIComponent(dealId)}/${encodeURIComponent(touchType)}`,
  );
  return data.logs;
}

// ────────────────────────────────────────────────────────────
// Templates (Phase 19 -- TMPL-05/06/07)
// ────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  presentationId: string;
  googleSlidesUrl: string;
  touchTypes: string; // JSON array string
  artifactType: ArtifactType | null;
  accessStatus: string;
  lastIngestedAt: string | null;
  sourceModifiedAt: string | null;
  slideCount: number;
  ingestionStatus: string; // "idle" | "queued" | "ingesting" | "failed"
  ingestionProgress: string | null; // JSON string
  contentClassification: string | null; // null | "template" | "example"
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateResult {
  template: Template;
  serviceAccountEmail: string | null;
}

export interface StalenessCheckResult {
  isStale: boolean;
  modifiedTime?: string;
  accessError?: boolean;
  serviceAccountEmail?: string;
}

export async function listTemplates(): Promise<Template[]> {
  return fetchJSON<Template[]>("/templates");
}

export async function createTemplate(data: {
  googleSlidesUrl: string;
  presentationId: string;
  touchTypes: string[];
}): Promise<CreateTemplateResult> {
  return fetchWithGoogleAuth<CreateTemplateResult>("/templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteTemplate(id: string): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/templates/${id}`, {
    method: "DELETE",
  });
}

export async function checkTemplateStaleness(id: string): Promise<StalenessCheckResult> {
  return fetchWithGoogleAuth<StalenessCheckResult>(`/templates/${id}/check-staleness`, {
    method: "POST",
  });
}

export async function classifyTemplate(
  id: string,
  data: {
    classification: "template" | "example";
    touchTypes?: string[];
    artifactType?: ArtifactType | null;
  },
): Promise<Template> {
  return fetchJSON<Template>(`/templates/${id}/classify`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ────────────────────────────────────────────────────────────
// Ingestion (Phase 20 -- SLIDE-02/03/04/05/06/08)
// ────────────────────────────────────────────────────────────

export interface IngestionProgress {
  status: string;
  phase?: string;
  current: number;
  total: number;
  skipped?: number;
}

export async function triggerIngestion(
  templateId: string
): Promise<{ queued: boolean }> {
  return fetchWithGoogleAuth<{ queued: boolean }>(`/templates/${templateId}/ingest`, {
    method: "POST",
  });
}

export async function getIngestionProgress(
  templateId: string
): Promise<IngestionProgress> {
  return fetchJSON<IngestionProgress>(`/templates/${templateId}/progress`);
}

// ────────────────────────────────────────────────────────────
// Slides — Preview & Review (Phase 21)
// ────────────────────────────────────────────────────────────

export interface SlideElementData {
  id: string;
  elementId: string;
  elementType: string; // "shape" | "text" | "image" | "table" | "group"
  positionX: number; // EMU units
  positionY: number; // EMU units
  width: number; // EMU units
  height: number; // EMU units
  contentText: string;
  fontSize: number | null;
  fontColor: string | null;
  isBold: boolean;
}

export interface SlideData {
  id: string;
  slideIndex: number;
  slideObjectId: string | null;
  contentText: string;
  classificationJson: string | null; // JSON string — parse on read
  confidence: number | null;
  needsReReview: boolean;
  reviewStatus: string; // "unreviewed" | "approved" | "needs_correction"
  industry: string | null;
  solutionPillar: string | null;
  persona: string | null;
  funnelStage: string | null;
  contentType: string | null;
  description: string | null;
  elements: SlideElementData[];
}

export interface SlideThumbnail {
  slideObjectId: string;
  slideIndex: number;
  thumbnailUrl: string | null;
  cached?: boolean;
}

export interface SimilarSlide {
  id: string;
  templateId: string;
  slideIndex: number;
  slideObjectId: string | null;
  contentText: string;
  classificationJson: string | null;
  confidence: number | null;
  reviewStatus: string;
  similarity: number;
}

export interface CorrectedTags {
  industries: string[];
  solutionPillars: string[];
  buyerPersonas: string[];
  funnelStages: string[];
  contentType: string;
  slideCategory: string;
  subsectors?: string[];
  touchType?: string[];
}

export async function listSlides(
  templateId: string
): Promise<SlideData[]> {
  return fetchJSON<SlideData[]>(`/templates/${templateId}/slides`);
}

export async function getSlideThumbnails(
  templateId: string
): Promise<{ thumbnails: SlideThumbnail[]; caching?: boolean }> {
  return fetchWithGoogleAuth<{ thumbnails: SlideThumbnail[]; caching?: boolean }>(
    `/templates/${templateId}/thumbnails`
  );
}

export async function updateSlideClassification(
  slideId: string,
  data: {
    reviewStatus: "approved" | "needs_correction";
    correctedTags?: CorrectedTags;
  }
): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(
    `/slides/${slideId}/update-classification`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function findSimilarSlides(
  slideId: string,
  limit?: number
): Promise<{ results: SimilarSlide[] }> {
  return fetchJSON<{ results: SimilarSlide[] }>(
    `/slides/${slideId}/similar`,
    {
      method: "POST",
      body: JSON.stringify({ limit: limit ?? 10 }),
    }
  );
}

// ────────────────────────────────────────────────────────────
// Google Token Storage (Phase 22 -- OAuth Scope Expansion)
// ────────────────────────────────────────────────────────────

export async function storeGoogleToken(data: {
  userId: string;
  email: string;
  refreshToken: string;
}): Promise<{ success: boolean; tokenId: string }> {
  return fetchJSON<{ success: boolean; tokenId: string }>("/tokens", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function checkGoogleToken(
  userId: string
): Promise<{ hasToken: boolean }> {
  return fetchJSON<{ hasToken: boolean }>(`/tokens/check/${userId}`);
}

// ────────────────────────────────────────────────────────────
// Action Required (Phase 24 -- POOL-03/05)
// ────────────────────────────────────────────────────────────

export interface ActionRequiredItem {
  id: string;
  userId: string | null;
  actionType: string;
  title: string;
  description: string;
  resourceId: string | null;
  resourceName: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  silenced: boolean;
  seenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchActions(userId?: string): Promise<ActionRequiredItem[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return fetchJSON<ActionRequiredItem[]>(`/actions${qs}`);
}

export async function fetchActionCount(userId?: string): Promise<number> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const result = await fetchJSON<{ count: number }>(`/actions/count${qs}`);
  return result.count;
}

export async function resolveAction(id: string): Promise<ActionRequiredItem> {
  return fetchJSON<ActionRequiredItem>(`/actions/${id}/resolve`, {
    method: "PATCH",
  });
}

export async function silenceAction(id: string): Promise<ActionRequiredItem> {
  return fetchJSON<ActionRequiredItem>(`/actions/${id}/silence`, {
    method: "PATCH",
  });
}

export async function storeAtlusOAuthToken(
  userId: string,
  email: string,
  accessToken: string,
  refreshToken?: string,
): Promise<{ success: boolean; accessResult: string }> {
  return fetchJSON<{ success: boolean; accessResult: string }>(
    "/atlus/oauth/store-token",
    {
      method: "POST",
      body: JSON.stringify({ userId, email, accessToken, refreshToken }),
    },
  );
}

// ────────────────────────────────────────────────────────────
// Discovery (Phase 29)
// ────────────────────────────────────────────────────────────

export interface DiscoveryDocument {
  slideId: string;
  documentTitle: string;
  textContent: string;
  speakerNotes: string;
  metadata: Record<string, unknown>;
  presentationId?: string;
  slideObjectId?: string;
  source?: "mcp" | "drive";
  relevanceScore?: number;
  mimeType?: string;
  isGoogleSlides?: boolean;
  googleSlidesUrl?: string;
  thumbnailUrl?: string;
  templateData?: {
    ingestionStatus: string;
    lastIngestedAt: string | null;
    sourceModifiedAt: string | null;
    slideCount: number | null;
    ingestionProgress?: number;
    accessStatus: string;
  };
}

export interface BrowseResult {
  documents: DiscoveryDocument[];
  nextCursor?: string;
  totalDocuments?: number;
  ingestedHashes: string[];
}

export interface SearchResult {
  results: DiscoveryDocument[];
  ingestedHashes: string[];
}

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?: "no_tokens" | "mcp_unavailable" | "disabled";
}

export interface IngestionProgressResult {
  items: Array<{ id: string; status: string; error?: string }>;
  complete: boolean;
}

export async function checkAtlusAccess(): Promise<AccessCheckResult> {
  return fetchJSON<AccessCheckResult>("/discovery/access-check");
}

export async function browseDiscovery(params: { cursor?: string; limit?: number }): Promise<BrowseResult> {
  const qs = new URLSearchParams({ limit: String(params.limit ?? 20) });
  if (params.cursor) qs.set("cursor", params.cursor);
  return fetchWithGoogleAuth<BrowseResult>(`/discovery/browse?${qs}`);
}

export async function searchDiscovery(query: string): Promise<SearchResult> {
  return fetchWithGoogleAuth<SearchResult>("/discovery/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export async function startDiscoveryIngestion(items: DiscoveryDocument[]): Promise<{ batchId: string }> {
  return fetchWithGoogleAuth<{ batchId: string }>("/discovery/ingest", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export async function getDiscoveryIngestionProgress(batchId: string): Promise<IngestionProgressResult> {
  return fetchJSON<IngestionProgressResult>(`/discovery/ingest/${batchId}/progress`);
}

// ────────────────────────────────────────────────────────────
// Deck Structures (Phase 34 -- DKI-03/04/05/06/07)
// ────────────────────────────────────────────────────────────

export interface DeckStructureSummary {
  id: string | null;
  touchType: string;
  artifactType?: ArtifactType | null;
  exampleCount: number;
  confidence: number;
  confidenceColor: "green" | "yellow" | "red";
  confidenceLabel: string;
  sectionCount: number;
  inferredAt: string | null;
  lastChatAt: string | null;
  updatedAt: string | null;
}

export interface DeckSectionData {
  order: number;
  name: string;
  purpose: string;
  isOptional: boolean;
  variationCount: number;
  slideIds: string[];
}

export interface DeckStructureDetail {
  touchType: string;
  artifactType?: ArtifactType | null;
  structure: {
    sections: DeckSectionData[];
    sequenceRationale: string;
  };
  exampleCount: number;
  confidence: number;
  confidenceColor: "green" | "yellow" | "red";
  confidenceLabel: string;
  chatMessages: DeckChatMessageData[];
  chatContext: unknown;
  slideIdToThumbnail: Record<string, string>;
  inferredAt: string | null;
  lastChatAt: string | null;
}

export interface DeckChatMessageData {
  id: string;
  deckStructureId: string;
  role: "user" | "assistant";
  content: string;
  structureDiff: string | null;
  createdAt: string;
}

export async function getDeckStructures(): Promise<DeckStructureSummary[]> {
  return fetchJSON<DeckStructureSummary[]>("/deck-structures");
}

export async function getDeckStructure(
  touchType: string,
  artifactType?: ArtifactType | null,
): Promise<DeckStructureDetail> {
  const query = new URLSearchParams();
  if (artifactType) {
    query.set("artifactType", artifactType);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return fetchJSON<DeckStructureDetail>(
    `/deck-structures/${encodeURIComponent(touchType)}${suffix}`,
  );
}

export async function triggerDeckInference(
  touchType: string,
  artifactType?: ArtifactType | null,
): Promise<{ touchType: string; structure: unknown; confidence: number }> {
  const query = new URLSearchParams();
  if (artifactType) {
    query.set("artifactType", artifactType);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return fetchJSON(`/deck-structures/${encodeURIComponent(touchType)}/infer${suffix}`, {
    method: "POST",
  });
}

export async function deleteDeckMemories(
  touchType: string,
  artifactType?: ArtifactType | null,
): Promise<DeckStructureDetail> {
  const query = new URLSearchParams();
  if (artifactType) query.set("artifactType", artifactType);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return fetchJSON<DeckStructureDetail>(
    `/deck-structures/${encodeURIComponent(touchType)}/memories${suffix}`,
    { method: "DELETE" },
  );
}

export async function deleteDeckMessage(
  touchType: string,
  messageId: string,
  artifactType?: ArtifactType | null,
): Promise<{ success: boolean }> {
  const query = new URLSearchParams();
  if (artifactType) query.set("artifactType", artifactType);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return fetchJSON<{ success: boolean }>(
    `/deck-structures/${encodeURIComponent(touchType)}/messages/${encodeURIComponent(messageId)}${suffix}`,
    { method: "DELETE" },
  );
}

// ────────────────────────────────────────────────────────────
// Agent Configs (Phase 44)
// ────────────────────────────────────────────────────────────

export interface AgentConfigListItem {
  agentId: string;
  name: string;
  responsibility: string;
  family: string;
  isShared: boolean;
  publishedVersion: number | null;
  hasDraft: boolean;
  draftVersion: number | null;
}

export interface AgentConfigDetail {
  agentId: string;
  name: string;
  responsibility: string;
  family: string;
  isShared: boolean;
  publishedVersion: {
    id: string;
    version: number;
    baselinePrompt: string;
    rolePrompt: string;
    compiledPrompt: string | null;
    changeSummary: string | null;
    publishedAt: string | null;
    publishedBy: string | null;
  } | null;
  draft: {
    id: string;
    version: number;
    rolePrompt: string;
    createdAt: string;
  } | null;
}

export interface AgentConfigVersionItem {
  id: string;
  version: number;
  rolePrompt: string;
  changeSummary: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
}

export async function listAgentConfigs(): Promise<AgentConfigListItem[]> {
  return fetchJSON<AgentConfigListItem[]>("/agent-configs");
}

export async function getAgentConfig(
  agentId: string,
): Promise<AgentConfigDetail> {
  return fetchJSON<AgentConfigDetail>(`/agent-configs/${encodeURIComponent(agentId)}`);
}

export async function getAgentConfigVersions(
  agentId: string,
): Promise<AgentConfigVersionItem[]> {
  return fetchJSON<AgentConfigVersionItem[]>(
    `/agent-configs/${encodeURIComponent(agentId)}/versions`,
  );
}

export async function saveDraftPrompt(
  agentId: string,
  data: { rolePrompt: string; userId?: string; expectedVersion?: number },
): Promise<unknown> {
  return fetchJSON(`/agent-configs/${encodeURIComponent(agentId)}/draft`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function publishAgentConfig(
  agentId: string,
  data: { changeSummary?: string; userId?: string },
): Promise<unknown> {
  return fetchJSON(`/agent-configs/${encodeURIComponent(agentId)}/publish`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function discardDraft(agentId: string): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(
    `/agent-configs/${encodeURIComponent(agentId)}/discard`,
    { method: "POST" },
  );
}

export async function rollbackAgentConfig(
  agentId: string,
  data: { targetVersion: number; userId?: string },
): Promise<unknown> {
  return fetchJSON(`/agent-configs/${encodeURIComponent(agentId)}/rollback`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function saveBaselineDraft(data: {
  baselinePrompt: string;
  userId?: string;
}): Promise<unknown> {
  return fetchJSON("/agent-configs/baseline/draft", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function publishBaseline(data: {
  changeSummary?: string;
  userId?: string;
}): Promise<{ agentsUpdated: number }> {
  return fetchJSON<{ agentsUpdated: number }>("/agent-configs/baseline/publish", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
