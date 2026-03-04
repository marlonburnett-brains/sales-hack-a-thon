/**
 * AtlusAI Search Wrapper
 *
 * Provides slide content search against the AtlusAI knowledge base.
 *
 * STRATEGY: Since AtlusAI MCP tools require Claude Code's internal auth
 * and cannot be called from standalone Node.js, this module uses a
 * Drive API fallback strategy:
 *   - Searches the _slide-level-ingestion folder in Drive for Google Docs
 *     matching the query via Drive files.list + fullText contains
 *   - Reads document content via Drive files.export (text/plain)
 *   - Parses document title and description for metadata
 *
 * This approach works because all ingested slide content exists as
 * Google Docs in the monitored Drive folder (created by atlusai-client.ts).
 */

import { getDriveClient } from "./google-auth";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface SlideSearchResult {
  /** Deterministic ID from the ingested document */
  slideId: string;
  /** Title of the Google Doc in the ingestion folder */
  documentTitle: string;
  /** Plain text content of the slide */
  textContent: string;
  /** Speaker notes from the slide */
  speakerNotes: string;
  /** Metadata parsed from the document description JSON */
  metadata: Record<string, unknown>;
  /** Source presentation ID (parsed from title/description) */
  presentationId?: string;
  /** Slide object ID within the source presentation */
  slideObjectId?: string;
}

// ────────────────────────────────────────────────────────────
// Internal: Ingestion folder discovery
// ────────────────────────────────────────────────────────────

const INGESTION_FOLDER_NAME = "_slide-level-ingestion";

/** Cache the ingestion folder ID to avoid repeated lookups */
let cachedIngestionFolderId: string | null = null;

/**
 * Find the _slide-level-ingestion subfolder in the configured Drive folder.
 * Returns null if the folder doesn't exist (no slides have been ingested yet).
 */
async function getIngestionFolderId(): Promise<string | null> {
  if (cachedIngestionFolderId) return cachedIngestionFolderId;

  const drive = getDriveClient();
  const parentFolderId = env.GOOGLE_DRIVE_FOLDER_ID;

  const result = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '${INGESTION_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (result.data.files && result.data.files.length > 0) {
    cachedIngestionFolderId = result.data.files[0].id!;
    return cachedIngestionFolderId;
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// Internal: Title parsing
// ────────────────────────────────────────────────────────────

/**
 * Parse the ingestion document title to extract presentationId and slideObjectId.
 *
 * Title format from atlusai-client.ts:
 *   [SLIDE] PresentationName - Slide N [documentId]
 *
 * The document description (JSON) contains presentationId and slideObjectId directly.
 */
function parseDocumentTitle(title: string): {
  presentationName: string;
  slideIndex: number;
  documentId: string;
} {
  // Match: [SLIDE] PresentationName - Slide N [documentId]
  const match = title.match(
    /^\[SLIDE\]\s+(.+?)\s+-\s+Slide\s+(\d+)\s+\[([a-f0-9]+)\]$/
  );

  if (match) {
    return {
      presentationName: match[1],
      slideIndex: parseInt(match[2], 10) - 1, // Convert to 0-based
      documentId: match[3],
    };
  }

  // Fallback: return raw title info
  return {
    presentationName: title,
    slideIndex: 0,
    documentId: "",
  };
}

/**
 * Parse the document description JSON to extract metadata.
 * The description is set by atlusai-client.ts ingestDocument() and contains
 * documentId, presentationId, slideObjectId, slideIndex, isLowContent, and
 * any additional metadata from the original SlideDocument.
 */
function parseDocumentDescription(
  description: string | null | undefined
): Record<string, unknown> {
  if (!description) return {};

  try {
    return JSON.parse(description) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Parse document content to extract slide text and speaker notes sections.
 * The content format follows the structure created by buildDocumentContent()
 * in atlusai-client.ts.
 */
function parseDocumentContent(content: string): {
  textContent: string;
  speakerNotes: string;
} {
  let textContent = "";
  let speakerNotes = "";

  // Extract "Slide Content:" section
  const slideContentMatch = content.match(
    /Slide Content:\n([\s\S]*?)(?=\nSpeaker Notes:|\nClassification:|\n*$)/
  );
  if (slideContentMatch) {
    textContent = slideContentMatch[1].trim();
  }

  // Extract "Speaker Notes:" section
  const speakerNotesMatch = content.match(
    /Speaker Notes:\n([\s\S]*?)(?=\nClassification:|\n*$)/
  );
  if (speakerNotesMatch) {
    speakerNotes = speakerNotesMatch[1].trim();
  }

  return { textContent, speakerNotes };
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Search for slides matching a natural language query.
 *
 * Uses Drive API fullText search against Google Docs in the ingestion folder.
 * Returns slide content with parsed metadata for AI-driven slide selection.
 *
 * @param params.query - Natural language search query
 * @param params.industry - Optional industry filter (included in search query)
 * @param params.touchType - Optional touch type filter (included in search query)
 * @param params.limit - Maximum number of results (default 20)
 */
export async function searchSlides(params: {
  query: string;
  industry?: string;
  touchType?: string;
  limit?: number;
}): Promise<SlideSearchResult[]> {
  const ingestionFolderId = await getIngestionFolderId();
  if (!ingestionFolderId) {
    console.warn(
      "AtlusAI search: No ingestion folder found. No slides have been ingested yet."
    );
    return [];
  }

  const drive = getDriveClient();
  const limit = params.limit ?? 20;

  // Build search query combining the user query with optional filters
  const queryParts: string[] = [params.query];
  if (params.industry) {
    queryParts.push(params.industry);
  }
  if (params.touchType) {
    queryParts.push(params.touchType);
  }
  const searchText = queryParts.join(" ");

  // Search for Google Docs in the ingestion folder matching the query
  // Drive API fullText search indexes the document content
  const escapedQuery = searchText.replace(/'/g, "\\'");
  const result = await drive.files.list({
    q: `'${ingestionFolderId}' in parents and fullText contains '${escapedQuery}' and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
    fields: "files(id, name, description)",
    pageSize: limit,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = result.data.files ?? [];
  const results: SlideSearchResult[] = [];

  for (const file of files) {
    const title = file.name ?? "";
    const description = parseDocumentDescription(file.description);
    const titleParts = parseDocumentTitle(title);

    // Export the document content as plain text
    let textContent = "";
    let speakerNotes = "";

    try {
      const exported = await drive.files.export({
        fileId: file.id!,
        mimeType: "text/plain",
      });
      const content =
        typeof exported.data === "string"
          ? exported.data
          : String(exported.data);
      const parsed = parseDocumentContent(content);
      textContent = parsed.textContent;
      speakerNotes = parsed.speakerNotes;
    } catch (error) {
      console.warn(
        `AtlusAI search: Failed to export document ${file.id}: ${error}`
      );
    }

    results.push({
      slideId: titleParts.documentId || (description.documentId as string) || file.id!,
      documentTitle: title,
      textContent,
      speakerNotes,
      metadata: description,
      presentationId: (description.presentationId as string) || undefined,
      slideObjectId: (description.slideObjectId as string) || undefined,
    });
  }

  return results;
}

// ────────────────────────────────────────────────────────────
// Proposal-level multi-pass retrieval
// ────────────────────────────────────────────────────────────

/**
 * Result of a multi-pass proposal retrieval containing all candidate slides
 * and counts per retrieval pass for diagnostics.
 */
export interface ProposalSearchResult {
  /** All deduplicated candidate slides from all retrieval passes */
  candidates: SlideSearchResult[];
  /** Number of slides from the primary pillar pass */
  primaryCount: number;
  /** Number of new slides from secondary pillar passes */
  secondaryCount: number;
  /** Number of new slides from the case study pass */
  caseStudyCount: number;
}

/**
 * Multi-pass retrieval for proposal deck assembly.
 *
 * Executes three retrieval passes against AtlusAI content:
 *   1. Primary pillar + industry (largest budget, ~20 slides)
 *   2. Secondary pillars + industry (5 per pillar)
 *   3. Case studies for industry + subsector (5 slides)
 *
 * Includes three-tier fallback for sparse results:
 *   - If primary returns < 3: re-query without industry filter
 *   - If still < 3 total: query cross-industry capabilities
 *   - Never fails -- returns whatever candidates are found
 *
 * @param params.industry - Target industry
 * @param params.subsector - Target subsector within industry
 * @param params.primaryPillar - Primary Lumenalta solution pillar
 * @param params.secondaryPillars - Additional solution pillars
 * @param params.useCases - Use cases from the brief (for context)
 * @param params.limit - Maximum slides for primary pass (default 20)
 */
export async function searchForProposal(params: {
  industry: string;
  subsector: string;
  primaryPillar: string;
  secondaryPillars: string[];
  useCases: { name: string; description: string }[];
  limit?: number;
}): Promise<ProposalSearchResult> {
  const primaryLimit = params.limit ?? 20;
  const map = new Map<string, SlideSearchResult>();

  // ── Pass 1: Primary pillar ──
  const primaryResults = await searchSlides({
    query: `${params.primaryPillar} ${params.industry} solution proposal capabilities`,
    industry: params.industry,
    limit: primaryLimit,
  });

  for (const slide of primaryResults) {
    map.set(slide.slideId, slide);
  }
  const primaryCount = map.size;

  // Fallback tier 1: If primary returns < 3, broaden without industry filter
  if (primaryCount < 3) {
    const broadResults = await searchSlides({
      query: `${params.primaryPillar} solution proposal capabilities`,
      limit: primaryLimit,
    });
    for (const slide of broadResults) {
      if (!map.has(slide.slideId)) {
        map.set(slide.slideId, slide);
      }
    }
  }

  // Fallback tier 2: If still < 3 total, cross-industry capabilities
  if (map.size < 3) {
    const crossResults = await searchSlides({
      query: `${params.primaryPillar} capabilities solutions`,
      limit: 10,
    });
    for (const slide of crossResults) {
      if (!map.has(slide.slideId)) {
        map.set(slide.slideId, slide);
      }
    }
  }

  // ── Pass 2: Secondary pillars ──
  const beforeSecondary = map.size;
  for (const pillar of params.secondaryPillars) {
    const secondaryResults = await searchSlides({
      query: `${pillar} ${params.industry}`,
      industry: params.industry,
      limit: 5,
    });
    for (const slide of secondaryResults) {
      if (!map.has(slide.slideId)) {
        map.set(slide.slideId, slide);
      }
    }
  }
  const secondaryCount = map.size - beforeSecondary;

  // ── Pass 3: Case studies ──
  const beforeCaseStudy = map.size;
  const caseStudyResults = await searchSlides({
    query: `case study ${params.industry} ${params.subsector} results outcomes`,
    industry: params.industry,
    limit: 5,
  });
  for (const slide of caseStudyResults) {
    if (!map.has(slide.slideId)) {
      map.set(slide.slideId, slide);
    }
  }
  const caseStudyCount = map.size - beforeCaseStudy;

  return {
    candidates: Array.from(map.values()),
    primaryCount,
    secondaryCount,
    caseStudyCount,
  };
}

/**
 * Search for slides matching specific capability areas and industry.
 *
 * Constructs a combined query from capability areas and industry context
 * to find the most relevant slides for capability alignment decks.
 *
 * @param params.capabilityAreas - Capability areas to search for
 * @param params.industry - Target industry for relevance filtering
 * @param params.limit - Maximum number of results (default 20)
 */
export async function searchByCapability(params: {
  capabilityAreas: string[];
  industry: string;
  limit?: number;
}): Promise<SlideSearchResult[]> {
  // Combine capability areas with industry for a comprehensive search
  const query = [...params.capabilityAreas, params.industry].join(" ");

  return searchSlides({
    query,
    industry: params.industry,
    limit: params.limit,
  });
}
