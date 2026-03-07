/**
 * AtlusAI Search Wrapper
 *
 * Provides slide content search against the AtlusAI knowledge base.
 *
 * STRATEGY (Phase 28): Routes search through MCP semantic search first,
 * falling back to Drive API keyword search when MCP is unavailable or
 * disabled via ATLUS_USE_MCP=false.
 *
 * MCP path:
 *   - Calls knowledge_base_search_semantic via MCP SSE client
 *   - Raw results mapped to SlideSearchResult via LLM extraction
 *   - Adaptive prompt: first call discovers result shape, caches prompt
 *
 * Drive fallback path (original):
 *   - Searches _slide-level-ingestion folder in Drive for Google Docs
 *   - Reads document content via Drive files.export (text/plain)
 *   - Parses document title and description for metadata
 */

import { getDriveClient } from "./google-auth";
import {
  callMcpTool,
  isMcpAvailable,
  getCachedExtractionPrompt,
  setCachedExtractionPrompt,
} from "./mcp-client";
import { GoogleGenAI } from "@google/genai";
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
  /** Result origin: 'mcp' for semantic search, 'drive' for keyword search */
  source?: "mcp" | "drive";
  /** Relevance score from MCP semantic search (0-1), undefined for Drive results */
  relevanceScore?: number;
}

// ────────────────────────────────────────────────────────────
// Internal: Search text builder (shared by MCP and Drive)
// ────────────────────────────────────────────────────────────

function buildSearchText(params: {
  query: string;
  industry?: string;
  touchType?: string;
}): string {
  const parts: string[] = [params.query];
  if (params.industry) parts.push(params.industry);
  if (params.touchType) parts.push(params.touchType);
  return parts.join(" ");
}

// ────────────────────────────────────────────────────────────
// Internal: MCP semantic search
// ────────────────────────────────────────────────────────────

/**
 * Search via MCP knowledge_base_search_semantic tool.
 * Results are mapped to SlideSearchResult via LLM extraction.
 */
async function searchSlidesMcp(params: {
  query: string;
  industry?: string;
  touchType?: string;
  limit?: number;
}): Promise<SlideSearchResult[]> {
  const searchText = buildSearchText(params);

  // Build MCP tool args
  const args: Record<string, unknown> = { query: searchText };
  if (env.ATLUS_PROJECT_ID) {
    args.project_id = env.ATLUS_PROJECT_ID;
  }

  const rawResult = await callMcpTool("knowledge_base_search_semantic", args);

  // Pass through LLM extraction to map to SlideSearchResult[]
  const results = await extractSlideResults(rawResult, searchText);

  // Tag all results with MCP source
  return results.map((r) => ({ ...r, source: "mcp" as const }));
}

// ────────────────────────────────────────────────────────────
// Internal: LLM extraction layer (adaptive prompt)
// ────────────────────────────────────────────────────────────

/** SlideSearchResult interface definition for LLM prompt */
const SLIDE_RESULT_SCHEMA = `interface SlideSearchResult {
  slideId: string;         // Unique identifier for the slide
  documentTitle: string;   // Title or name of the slide/document
  textContent: string;     // Main text content of the slide
  speakerNotes: string;    // Speaker notes (empty string if none)
  metadata: object;        // Any additional metadata as key-value pairs
  presentationId?: string; // Source presentation identifier if available
  slideObjectId?: string;  // Slide object ID within presentation if available
  relevanceScore?: number; // Semantic relevance score 0-1 based on match quality
}`;

/**
 * Extract SlideSearchResult[] from raw MCP results using LLM.
 *
 * Uses adaptive prompt pattern:
 * - First call: discovery prompt that includes raw result shape + target schema
 * - Subsequent calls: cached prompt template for efficiency
 *
 * On LLM failure: returns empty array (graceful degradation).
 */
/**
 * Extract a single batch of raw JSON into SlideSearchResult[].
 * Receives pre-sized JSON string and returns extracted results.
 */
async function extractSingleBatch(
  rawStr: string,
  searchQuery: string,
): Promise<SlideSearchResult[]> {
  const cachedPrompt = getCachedExtractionPrompt();
  let prompt: string;

  if (cachedPrompt) {
    // Subsequent calls: use cached template
    prompt = cachedPrompt
      .replace("{{RAW_RESULTS}}", rawStr)
      .replace("{{SEARCH_QUERY}}", searchQuery);
  } else {
    // First call: discovery prompt
    prompt = [
      "You are extracting structured slide search results from a knowledge base API response.",
      "",
      "The raw API response is:",
      "```json",
      rawStr,
      "```",
      "",
      `The search query was: "${searchQuery}"`,
      "",
      "Map the raw results into an array of objects matching this TypeScript interface:",
      "```typescript",
      SLIDE_RESULT_SCHEMA,
      "```",
      "",
      "Instructions:",
      "- Extract ALL result items from the raw response into SlideSearchResult objects",
      "- Map fields as closely as possible to the target interface",
      "- For slideId: use any unique identifier field from the raw result",
      "- For documentTitle: use any title/name field",
      "- For textContent: use the main content/text/body field",
      "- For speakerNotes: use notes field if present, otherwise empty string",
      "- For metadata: include any remaining fields not mapped above",
      "- For relevanceScore: assign a 0-1 score based on semantic match quality if discernible from the data, or 0.5 as default",
      "- Return a JSON array of SlideSearchResult objects",
      "- If the raw result is empty or contains no searchable items, return an empty array []",
    ].join("\n");
  }

  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContent({
    model: "openai/gpt-oss-120b-maas",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const text = response.text ?? "[]";
  const parsed = JSON.parse(text) as SlideSearchResult[];

  // After first successful extraction: build and cache a prompt template
  if (!cachedPrompt && parsed.length > 0) {
    const template = [
      "You are extracting structured slide search results from a knowledge base API response.",
      "",
      "The raw API response is:",
      "```json",
      "{{RAW_RESULTS}}",
      "```",
      "",
      `The search query was: "{{SEARCH_QUERY}}"`,
      "",
      "Map the raw results into an array of SlideSearchResult objects.",
      "```typescript",
      SLIDE_RESULT_SCHEMA,
      "```",
      "",
      "Instructions:",
      "- Extract ALL result items into SlideSearchResult objects",
      "- Map fields using the same field mapping as before",
      "- For relevanceScore: assign a 0-1 score based on semantic match quality",
      "- Return a JSON array",
    ].join("\n");
    setCachedExtractionPrompt(template);
  }

  return Array.isArray(parsed) ? parsed : [];
}

async function extractSlideResults(
  rawResult: unknown,
  searchQuery: string,
): Promise<SlideSearchResult[]> {
  try {
    const rawStr = JSON.stringify(rawResult);

    // Small results: single batch (up to 32000 chars)
    if (rawStr.length <= 32000) {
      return await extractSingleBatch(rawStr, searchQuery);
    }

    // Large results: split at array boundaries
    console.log(`[atlusai-search] Large result (${rawStr.length} chars) -- splitting into chunks`);

    let items: unknown[];
    try {
      const parsed = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      items = [rawResult];
    }

    // Accumulate items into chunks where each chunk serializes to <= 30000 chars
    const chunks: unknown[][] = [];
    let currentChunk: unknown[] = [];
    let currentSize = 2; // account for "[]" wrapper

    for (const item of items) {
      const itemSize = JSON.stringify(item).length + 1; // +1 for comma separator
      if (currentChunk.length > 0 && currentSize + itemSize > 30000) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentSize = 2;
      }
      currentChunk.push(item);
      currentSize += itemSize;
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    console.log(`[atlusai-search] Large result (${rawStr.length} chars) -- splitting into ${chunks.length} chunks`);

    // Process all chunks in parallel
    const results = await Promise.all(
      chunks.map((chunk) => extractSingleBatch(JSON.stringify(chunk), searchQuery)),
    );

    return results.flat();
  } catch (err) {
    console.error("[search] LLM extraction failed:", err);
    return [];
  }
}

// ────────────────────────────────────────────────────────────
// Internal: Drive API keyword search (original implementation)
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

/**
 * Parse the ingestion document title to extract presentationId and slideObjectId.
 *
 * Title format from atlusai-client.ts:
 *   [SLIDE] PresentationName - Slide N [documentId]
 */
function parseDocumentTitle(title: string): {
  presentationName: string;
  slideIndex: number;
  documentId: string;
} {
  const match = title.match(
    /^\[SLIDE\]\s+(.+?)\s+-\s+Slide\s+(\d+)\s+\[([a-f0-9]+)\]$/
  );

  if (match) {
    return {
      presentationName: match[1],
      slideIndex: parseInt(match[2], 10) - 1,
      documentId: match[3],
    };
  }

  return {
    presentationName: title,
    slideIndex: 0,
    documentId: "",
  };
}

/**
 * Parse the document description JSON to extract metadata.
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
 */
function parseDocumentContent(content: string): {
  textContent: string;
  speakerNotes: string;
} {
  let textContent = "";
  let speakerNotes = "";

  const slideContentMatch = content.match(
    /Slide Content:\n([\s\S]*?)(?=\nSpeaker Notes:|\nClassification:|\n*$)/
  );
  if (slideContentMatch) {
    textContent = slideContentMatch[1].trim();
  }

  const speakerNotesMatch = content.match(
    /Speaker Notes:\n([\s\S]*?)(?=\nClassification:|\n*$)/
  );
  if (speakerNotesMatch) {
    speakerNotes = speakerNotesMatch[1].trim();
  }

  return { textContent, speakerNotes };
}

/**
 * Drive API keyword search (original searchSlides implementation).
 * Now internal -- used as fallback when MCP is unavailable.
 */
async function searchSlidesDrive(params: {
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

  const searchText = buildSearchText(params);
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
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Search for slides matching a natural language query.
 *
 * Routes through MCP semantic search first, falling back to Drive API
 * keyword search when MCP is unavailable or disabled.
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
  const useMcp = env.ATLUS_USE_MCP !== "false";

  if (useMcp && isMcpAvailable()) {
    try {
      return await searchSlidesMcp(params);
    } catch (err) {
      console.warn("[search] MCP search failed, falling back to Drive:", err);
      // Fall through to Drive
    }
  }

  const results = await searchSlidesDrive(params);
  return results.map((r) => ({ ...r, source: "drive" as const }));
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
 * Multi-pass logic is unchanged (SRCH-03) -- only the inner searchSlides()
 * now routes through MCP semantic search.
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

  // -- Pass 1: Primary pillar --
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

  // -- Pass 2: Secondary pillars --
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

  // -- Pass 3: Case studies --
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
 * Constructs a combined query from capability areas and industry context.
 * Delegates to searchSlides() which routes through MCP or Drive (SRCH-04).
 */
export async function searchByCapability(params: {
  capabilityAreas: string[];
  industry: string;
  limit?: number;
}): Promise<SlideSearchResult[]> {
  const query = [...params.capabilityAreas, params.industry].join(" ");

  return searchSlides({
    query,
    industry: params.industry,
    limit: params.limit,
  });
}
