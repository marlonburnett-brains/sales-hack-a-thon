/**
 * AtlusAI MCP Client & Document Ingestion
 *
 * DISCOVERY FINDINGS (2026-03-03):
 * ================================
 * The AtlusAI MCP server at https://knowledge-base-api.lumenalta.com/sse
 * returns HTTP 401 ("Bad credentials") when accessed without authentication.
 *
 * Authentication is managed internally by Claude Code's MCP connection layer,
 * meaning only Claude Code can invoke MCP tools directly — standalone scripts
 * cannot connect to the SSE endpoint.
 *
 * Known MCP tools (from .claude/settings.local.json whitelist):
 *   1. knowledge_base_search_semantic  — semantic search across documents
 *   2. knowledge_base_search_structured — structured/filtered search
 *   3. discover_documents              — list/browse document inventory
 *
 * These are ALL read-only tools. No document creation/ingestion MCP tools
 * are exposed. The ~9,642 existing documents in AtlusAI were ingested from
 * a connected Google Drive folder.
 *
 * INGESTION STRATEGY:
 * ===================
 * Since no MCP-based document creation tools exist, we create structured
 * Google Docs in the connected Hack-a-thon Drive folder. AtlusAI monitors
 * this folder and re-indexes new documents automatically. Each Google Doc
 * represents one slide and contains:
 *   - Structured text content optimized for semantic search
 *   - Metadata encoded as document properties and in-document headers
 *   - A deterministic title based on presentationId + slideObjectId for idempotency
 *
 * This approach matches how the existing ~9,642 documents were originally
 * ingested into AtlusAI.
 */

import { Readable } from "node:stream";
import { getDriveClient } from "./google-auth";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface SlideDocument {
  /** Deterministic ID: SHA-256(presentationId:slideObjectId) first 32 chars */
  documentId: string;
  presentationId: string;
  presentationName: string;
  slideObjectId: string;
  slideIndex: number;
  folderPath: string;
  textContent: string;
  speakerNotes: string;
  isLowContent: boolean;
  metadata: Record<string, unknown>;
}

export interface AtlusAITool {
  name: string;
  description: string;
  inputSchema: unknown;
}

/** Result of a tool discovery attempt */
export interface DiscoveryResult {
  tools: AtlusAITool[];
  connectionSucceeded: boolean;
  error?: string;
  strategy: "mcp-direct" | "drive-folder" | "unknown";
}

// ────────────────────────────────────────────────────────────
// Tool discovery (documents what we know)
// ────────────────────────────────────────────────────────────

/**
 * Discover available AtlusAI MCP tools.
 *
 * NOTE: The SSE endpoint requires authentication that is only available
 * through Claude Code's internal MCP connection. This function documents
 * the known tools and the chosen ingestion strategy.
 *
 * To discover tools interactively, use Claude Code's MCP connection:
 *   - The 3 whitelisted tools are listed in .claude/settings.local.json
 *   - These are all read-only (search + discover)
 *   - No document creation tools are exposed via MCP
 */
export async function discoverAtlusAITools(): Promise<DiscoveryResult> {
  // Known tools from .claude/settings.local.json whitelist
  const knownTools: AtlusAITool[] = [
    {
      name: "knowledge_base_search_semantic",
      description:
        "Semantic search across AtlusAI knowledge base documents. Returns relevant documents based on natural language query.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language search query" },
        },
        required: ["query"],
      },
    },
    {
      name: "knowledge_base_search_structured",
      description:
        "Structured/filtered search with metadata constraints. Supports filtering by tags, content type, and other document properties.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          filters: { type: "object" },
        },
      },
    },
    {
      name: "discover_documents",
      description:
        "List and browse the document inventory in the AtlusAI knowledge base.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];

  // Try direct connection to see if auth situation has changed
  try {
    const response = await fetch(
      "https://knowledge-base-api.lumenalta.com/sse",
      {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (response.status === 401) {
      return {
        tools: knownTools,
        connectionSucceeded: false,
        error:
          "SSE endpoint returns 401 (Bad credentials). Auth managed by Claude Code internally.",
        strategy: "drive-folder",
      };
    }
  } catch {
    // Connection error — expected
  }

  return {
    tools: knownTools,
    connectionSucceeded: false,
    error: "Cannot connect to SSE endpoint from standalone script.",
    strategy: "drive-folder",
  };
}

// ────────────────────────────────────────────────────────────
// Ingestion subfolder management
// ────────────────────────────────────────────────────────────

const INGESTION_FOLDER_NAME = "_slide-level-ingestion";

/**
 * Get or create the ingestion subfolder in the Hack-a-thon Drive folder.
 * Slide-level documents are placed here for AtlusAI to index.
 * Using a dedicated subfolder keeps ingested content organized and
 * separate from the original deck files.
 */
async function getOrCreateIngestionFolder(
  parentFolderId: string
): Promise<string> {
  const drive = getDriveClient();

  // Check if folder already exists
  const existing = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '${INGESTION_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  // Create the folder
  const created = await drive.files.create({
    requestBody: {
      name: INGESTION_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  console.log(
    `  Created ingestion folder: ${INGESTION_FOLDER_NAME} (${created.data.id})`
  );
  return created.data.id!;
}

// ────────────────────────────────────────────────────────────
// Document ingestion via Google Drive
// ────────────────────────────────────────────────────────────

/**
 * Ingest a slide document by creating a Google Doc in the connected
 * Drive folder. AtlusAI will automatically re-index new documents.
 *
 * Uses Drive API media upload with mimeType conversion to create a
 * Google Doc with content in a single API call (no Docs API needed).
 *
 * Idempotency: The document title includes the deterministic documentId.
 * Before creating, we check if a Doc with that title already exists.
 * On re-run, existing documents are skipped (no duplicates).
 */
export async function ingestDocument(
  doc: SlideDocument,
  driveFolderId: string
): Promise<{ created: boolean; docId?: string; skipped?: boolean }> {
  const drive = getDriveClient();

  // Get or create the ingestion subfolder
  const ingestionFolderId = await getOrCreateIngestionFolder(driveFolderId);

  // Deterministic title for idempotency checks
  const docTitle = `[SLIDE] ${doc.presentationName} - Slide ${doc.slideIndex + 1} [${doc.documentId}]`;

  // Check if document already exists (idempotency)
  const existing = await drive.files.list({
    q: `'${ingestionFolderId}' in parents and name = '${docTitle.replace(/'/g, "\\'")}' and trashed = false`,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return { created: false, docId: existing.data.files[0].id!, skipped: true };
  }

  // Build document content
  const content = buildDocumentContent(doc);

  // Create a Google Doc with content using Drive API media upload.
  // Upload as text/plain and convert to Google Docs format in one call.
  // This avoids needing the separate Google Docs API.
  const created = await drive.files.create({
    requestBody: {
      name: docTitle,
      mimeType: "application/vnd.google-apps.document",
      parents: [ingestionFolderId],
      description: JSON.stringify({
        documentId: doc.documentId,
        presentationId: doc.presentationId,
        slideObjectId: doc.slideObjectId,
        slideIndex: doc.slideIndex,
        isLowContent: doc.isLowContent,
        ...doc.metadata,
      }),
    },
    media: {
      mimeType: "text/plain",
      body: Readable.from(Buffer.from(content, "utf-8")),
    },
    fields: "id",
    supportsAllDrives: true,
  });

  return { created: true, docId: created.data.id! };
}

/**
 * Build the document content string for ingestion.
 * Combines slide text, speaker notes, and metadata into a structured format
 * that is optimized for semantic search retrieval by AtlusAI.
 */
function buildDocumentContent(doc: SlideDocument): string {
  const parts: string[] = [];

  parts.push(`${doc.presentationName} - Slide ${doc.slideIndex + 1}`);
  parts.push("");

  if (doc.folderPath) {
    parts.push(`Source: ${doc.folderPath}/${doc.presentationName}`);
    parts.push(`Presentation ID: ${doc.presentationId}`);
    parts.push(`Slide Object ID: ${doc.slideObjectId}`);
    parts.push(`Document ID: ${doc.documentId}`);
    parts.push("");
  }

  if (doc.textContent) {
    parts.push("Slide Content:");
    parts.push(doc.textContent);
    parts.push("");
  }

  if (doc.speakerNotes) {
    parts.push("Speaker Notes:");
    parts.push(doc.speakerNotes);
    parts.push("");
  }

  // Encode metadata as searchable text
  if (doc.metadata && Object.keys(doc.metadata).length > 0) {
    parts.push("Classification:");
    for (const [key, value] of Object.entries(doc.metadata)) {
      if (Array.isArray(value)) {
        parts.push(`  ${key}: ${value.join(", ")}`);
      } else if (value !== undefined && value !== null) {
        parts.push(`  ${key}: ${value}`);
      }
    }
  }

  return parts.join("\n");
}

// ────────────────────────────────────────────────────────────
// Standalone discovery script
// ────────────────────────────────────────────────────────────

if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("atlusai-client.ts") ||
    process.argv[1].endsWith("atlusai-client.js"))
) {
  console.log("=== AtlusAI MCP Tool Discovery ===");
  console.log(
    "Endpoint: https://knowledge-base-api.lumenalta.com/sse\n"
  );

  discoverAtlusAITools()
    .then((result) => {
      console.log("=== Discovery Result ===");
      console.log(`Connection succeeded: ${result.connectionSucceeded}`);
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      console.log(`Ingestion strategy: ${result.strategy}`);

      console.log(`\nKnown tools (${result.tools.length}):`);
      for (const tool of result.tools) {
        console.log(`\n  Tool: ${tool.name}`);
        console.log(`  Description: ${tool.description}`);
        console.log(
          `  Input Schema: ${JSON.stringify(tool.inputSchema, null, 4)}`
        );
      }

      console.log("\n=== Analysis ===");
      console.log("All 3 known tools are READ-ONLY (search + discover).");
      console.log("No document creation/ingestion MCP tools are available.");
      console.log(
        "\nIngestion approach: Create Google Docs in the connected Drive folder."
      );
      console.log(
        "AtlusAI monitors the folder and auto-indexes new documents."
      );
      console.log(
        "This matches how the ~9,642 existing documents were originally ingested."
      );
    })
    .catch((err) => {
      console.error("Discovery failed:", err);
      process.exit(1);
    });
}
