import "server-only";

import type { ArtifactType } from "@lumenalta/schemas";

/**
 * Typed Fetch Wrapper for Agent Service
 *
 * All web -> agent communication goes through these functions.
 * The agent service URL is configured via AGENT_SERVICE_URL env var.
 */

import { env } from "@/env";
import { getGoogleAccessToken } from "@/lib/supabase/google-token";

const BASE_URL = env.AGENT_SERVICE_URL;

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AGENT_API_KEY}`,
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("Agent service is unreachable. Please try again later.");
  }

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
  const { accessToken, userId } = await getGoogleAccessToken();

  const googleHeaders: Record<string, string> = {};
  if (accessToken) googleHeaders["X-Google-Access-Token"] = accessToken;
  if (userId) googleHeaders["X-User-Id"] = userId;

  return fetchJSON<T>(path, {
    ...init,
    headers: {
      ...init?.headers,
      ...googleHeaders,
    },
  });
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
  return fetchWithGoogleAuth<WorkflowStartResult>(
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
  return fetchWithGoogleAuth<WorkflowStartResult>(
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
  return fetchWithGoogleAuth<WorkflowStartResult>(
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
  return fetchWithGoogleAuth<WorkflowStartResult>(
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
  return fetchWithGoogleAuth<WorkflowStartResult>(
    "/api/workflows/pre-call-workflow/start",
    {
      method: "POST",
      body: JSON.stringify({ inputData: { dealId, ...formData } }),
    }
  );
}

export async function getPreCallWorkflowStatus(
  runId: string
): Promise<WorkflowRunResult> {
  return fetchJSON<WorkflowRunResult>(
    `/api/workflows/pre-call-workflow/${runId}`
  );
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

export async function fetchActions(): Promise<ActionRequiredItem[]> {
  return fetchJSON<ActionRequiredItem[]>("/actions");
}

export async function fetchActionCount(): Promise<number> {
  const result = await fetchJSON<{ count: number }>("/actions/count");
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
