import { Mastra } from "@mastra/core";
import { registerApiRoute, MastraAuthProvider } from "@mastra/core/server";
import { verifySupabaseJwt, type JwtPayload } from "../lib/supabase-jwt-auth";
import { createResilientStorage } from "../lib/resilient-storage";
import { z } from "zod";
import { touch1Workflow } from "./workflows/touch-1-workflow";
import { touch2Workflow } from "./workflows/touch-2-workflow";
import { touch3Workflow } from "./workflows/touch-3-workflow";
import { touch4Workflow } from "./workflows/touch-4-workflow";
import { preCallWorkflow } from "./workflows/pre-call-workflow";
import { structureDrivenWorkflow } from "../generation/structure-driven-workflow";
import { getLogs as getGenerationLogs, buildLogKey as buildGenLogKey } from "../generation/generation-logger";
import { getOrCreateDealFolder, shareWithOrg } from "../lib/drive-folders";
import { getDriveClient, getSlidesClient, getPooledGoogleAuth } from "../lib/google-auth";
import { getAccessTokenForUser, resetTokenState } from "../lib/token-cache";
import { extractGoogleAuth, getVerifiedUserId } from "../lib/request-auth";
import { ingestDocument } from "../lib/atlusai-client";
import { ingestionQueue, clearStaleIngestions } from "../ingestion/ingestion-queue";
import { detectAndQueueBackfill } from "../ingestion/backfill-descriptions";
import { seedPublishedAgentCatalog } from "../lib/agent-catalog-defaults";
import { autoClassifyTemplates, autoIngestNewTemplates } from "../ingestion/auto-classify-templates";
import { encryptToken } from "../lib/token-encryption";
import {
  detectAtlusAccess,
  upsertAtlusToken,
  resolveActionsByType,
  getPooledAtlusAuth,
} from "../lib/atlus-auth";
import {
  ACTION_TYPES,
  ARTIFACT_TYPES,
  type ArtifactType,
  dealChatRouteContextSchema,
  dealChatSendRequestSchema,
  dealChatTouchTypeSchema,
  dealContextSourceSchema,
} from "@lumenalta/schemas";
import { env } from "../env";
import { regenerateStage, retryGeneration } from "../lib/regenerate-stage";
import { performVisualQA } from "../generation/visual-qa";
import { initMcp, shutdownMcp, callMcpTool, isMcpAvailable } from "../lib/mcp-client";
import { searchSlides } from "../lib/atlusai-search";
import { cacheThumbnailsForTemplate, THUMBNAIL_TTL_MS, cacheDocumentCover, checkGcsCoverExists, cachePresentationThumbnails, checkPresentationThumbnails, invalidatePresentationThumbnails } from "../lib/gcs-thumbnails";
import crypto from "node:crypto";
import { startDeckInferenceCron } from "../deck-intelligence/auto-infer-cron";
import {
  getDeckStructureListKeys,
  resolveDeckStructureKey,
} from "../deck-intelligence/deck-structure-key";
import {
  buildEmptyDeckStructureOutput,
  GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
  inferDeckStructure,
  isUnsupportedGenericTouch4,
} from "../deck-intelligence/infer-deck-structure";
import { calculateConfidence } from "../deck-intelligence/deck-structure-schema";
import { streamChatRefinement } from "../deck-intelligence/chat-refinement";
import { namedMastraAgents } from "./agents";
import {
  compileAgentInstructions,
  invalidateAgentPromptCache,
  getPublishedAgentConfig,
} from "../lib/agent-config";
import { GoogleGenAI } from "@google/genai";
import {
  appendDealChatMessage,
  confirmDealContextSource,
  getDealChatMessages,
  saveDealContextSource,
} from "../deal-chat/persistence";
import {
  buildDealChatSuggestions,
  runDealChatTurn,
} from "../deal-chat/assistant";

function createChatProviderClient() {
  return new GoogleGenAI({
    apiKey: env.GOOGLE_AI_STUDIO_API_KEY,
  });
}

function defaultDealChatRouteContext(dealId: string) {
  return {
    section: "overview" as const,
    touchType: null,
    pathname: `/deals/${dealId}`,
    pageLabel: "Overview",
  };
}

const dealChatBindingRequestSchema = z.object({
  sourceId: z.string().optional(),
  source: dealContextSourceSchema,
  action: z.enum(["confirm", "correct", "save_general_note"]),
  touchType: dealChatTouchTypeSchema.nullable().optional(),
  interactionId: z.string().nullable().optional(),
  refinedText: z.string().nullable().optional(),
});

const deckStructureArtifactQuerySchema = z.object({
  artifactType: z.enum(ARTIFACT_TYPES).nullable().optional(),
});

// ────────────────────────────────────────────────────────────
// Background Staleness Polling
// ────────────────────────────────────────────────────────────

const STALENESS_POLL_INTERVAL = 86_400_000; // 24 hours — only re-checks already-ingested content
const STALENESS_INITIAL_DELAY = 60_000; // 1 minute after startup
const DRIVE_API_DELAY = 200; // 200ms between Drive API calls

const AUTO_CLASSIFY_INTERVAL = 600_000; // 10 minutes — discovers NEW templates quickly
const AUTO_CLASSIFY_INITIAL_DELAY = 30_000; // 30 seconds after startup

// ────────────────────────────────────────────────────────────
// Discovery Batch Ingestion State (Phase 29)
// ────────────────────────────────────────────────────────────
const discoveryBatches = new Map<
  string,
  Map<string, { status: string; error?: string }>
>();

const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";

/**
 * Enrich discovery documents with Drive metadata. Uses a DB cache
 * (DiscoveryDocCache) so we only hit the Drive API once per document.
 *
 * Flow per document:
 *   1. Check cache by atlusDocId → if hit, apply cached fields
 *   2. On cache miss, search Drive by document title in background
 *   3. Write result to cache for future requests
 *
 * Mutates the documents in place.
 */
async function enrichDocsWithDriveMetadata(
  docs: Record<string, unknown>[],
  googleAuth?: { accessToken?: string },
): Promise<void> {
  if (docs.length === 0) return;

  // Collect atlusDocIds for cache lookup
  const docIds = docs.map((d) => String(d.slideId ?? "")).filter(Boolean);
  if (docIds.length === 0) return;

  // 1. Batch cache lookup
  const cached = await prisma.discoveryDocCache.findMany({
    where: { atlusDocId: { in: docIds } },
  });
  const cacheMap = new Map(cached.map((c) => [c.atlusDocId, c]));

  // Apply cached values and collect cache misses
  const misses: { idx: number; atlusDocId: string; title: string }[] = [];
  for (let i = 0; i < docs.length; i++) {
    const atlusDocId = String(docs[i].slideId ?? "");
    const hit = cacheMap.get(atlusDocId);
    if (hit) {
      docs[i].mimeType = hit.mimeType ?? undefined;
      docs[i].isGoogleSlides = hit.isGoogleSlides;
      if (hit.isGoogleSlides && hit.driveFileId) {
        docs[i].presentationId = hit.driveFileId;
        docs[i].googleSlidesUrl = hit.googleSlidesUrl ?? undefined;
      }
    } else {
      const title = String(docs[i].documentTitle ?? "").trim();
      if (title && atlusDocId) {
        misses.push({ idx: i, atlusDocId, title });
      }
    }
  }

  if (misses.length === 0) return;

  // 2. Build ordered list of Drive clients to try: user token → pooled tokens → SA
  const clientLabels: string[] = [];
  const driveClients: ReturnType<typeof getDriveClient>[] = [];
  if (googleAuth?.accessToken) {
    driveClients.push(getDriveClient(googleAuth));
    clientLabels.push("user-token");
  }
  try {
    const { accessToken } = await getPooledGoogleAuth();
    if (accessToken && accessToken !== googleAuth?.accessToken) {
      driveClients.push(getDriveClient({ accessToken }));
      clientLabels.push("pooled-token");
    }
  } catch { /* pooled auth unavailable */ }
  driveClients.push(getDriveClient()); // SA fallback
  clientLabels.push("service-account");
  console.log(`[discovery] Drive clients available: [${clientLabels.join(", ")}]`);

  // Helper: try a Drive files.list query across all clients with fallback on 429/403
  async function driveQuery(
    q: string,
    pageSize = 20,
  ): Promise<{ id: string; name: string; mimeType: string }[]> {
    for (const drive of driveClients) {
      try {
        const res = await drive.files.list({
          q,
          fields: "files(id,name,mimeType)",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageSize,
        });
        return (res.data.files ?? []).filter(
          (f): f is { id: string; name: string; mimeType: string } =>
            !!f.id && !!f.name && !!f.mimeType,
        );
      } catch (err: unknown) {
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code: number }).code
            : 0;
        if (code === 429 || code === 403) continue;
        console.warn("[discovery] Drive query failed:", err);
        continue;
      }
    }
    return [];
  }

  // Helper: paginated Drive list across all clients
  async function driveListAll(
    q: string,
  ): Promise<{ id: string; name: string; mimeType: string }[]> {
    for (const drive of driveClients) {
      try {
        const all: { id: string; name: string; mimeType: string }[] = [];
        let pageToken: string | undefined;
        do {
          const res = await drive.files.list({
            q,
            fields: "nextPageToken,files(id,name,mimeType)",
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            pageSize: 200,
            ...(pageToken ? { pageToken } : {}),
          });
          for (const f of res.data.files ?? []) {
            if (f.id && f.name && f.mimeType) {
              all.push({ id: f.id, name: f.name, mimeType: f.mimeType });
            }
          }
          pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken);
        return all;
      } catch (err: unknown) {
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code: number }).code
            : 0;
        if (code === 429 || code === 403) continue;
        console.warn("[discovery] Drive list failed:", err);
        continue;
      }
    }
    return [];
  }

  // Normalize for comparison: lowercase, strip extensions, normalize dashes/whitespace
  function normalize(s: string): string {
    return s
      .toLowerCase()
      .replace(/\.(pptx?|pdf|key|gslides)$/i, "")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Score how well a Drive filename matches the AtlusAI title (higher = better)
  function matchScore(atlusTitle: string, driveName: string): number {
    const a = normalize(atlusTitle);
    const d = normalize(driveName);
    if (a === d) return 100;
    if (a.startsWith(d) || d.startsWith(a)) return 80;
    if (a.includes(d) || d.includes(a)) return 60;
    const aWords = new Set(a.split(/\s+/));
    const dWords = new Set(d.split(/\s+/));
    const overlap = [...aWords].filter((w) => dWords.has(w)).length;
    const totalWords = Math.max(aWords.size, dWords.size);
    if (totalWords > 0 && overlap / totalWords >= 0.5)
      return 40 * (overlap / totalWords);
    return 0;
  }

  // Find best match from a list of files for a given title
  function pickBestMatch(
    title: string,
    files: { id: string; name: string; mimeType: string }[],
  ): { id: string; name: string; mimeType: string; score: number } | null {
    let best: (typeof files)[0] | null = null;
    let bestScore = 0;
    for (const f of files) {
      const score = matchScore(title, f.name);
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best && bestScore >= 30 ? { ...best, score: bestScore } : null;
  }

  // Helper: apply result to docs + write cache
  function applyResult(
    group: typeof misses,
    title: string,
    match: { id: string; mimeType: string } | null,
  ) {
    const isSlides = match?.mimeType === GOOGLE_SLIDES_MIME;
    const driveFileId = isSlides ? match!.id : null;
    const mimeType = match?.mimeType ?? null;
    const googleSlidesUrl = driveFileId
      ? `https://docs.google.com/presentation/d/${driveFileId}/edit`
      : null;

    for (const miss of group) {
      docs[miss.idx].mimeType = mimeType ?? undefined;
      docs[miss.idx].isGoogleSlides = isSlides;
      if (isSlides && driveFileId) {
        docs[miss.idx].presentationId = driveFileId;
        docs[miss.idx].googleSlidesUrl = googleSlidesUrl ?? undefined;
      }

      prisma.discoveryDocCache
        .upsert({
          where: { atlusDocId: miss.atlusDocId },
          create: {
            atlusDocId: miss.atlusDocId,
            documentTitle: title,
            driveFileId,
            mimeType,
            isGoogleSlides: isSlides,
            googleSlidesUrl,
          },
          update: {
            documentTitle: title,
            driveFileId,
            mimeType,
            isGoogleSlides: isSlides,
            googleSlidesUrl,
            resolvedAt: new Date(),
          },
        })
        .catch((err) => {
          console.warn(`[discovery] Cache write failed for ${miss.atlusDocId}:`, err);
        });
    }
  }

  // ── Phase A: Bulk list all Slides presentations (one paginated call) ──
  const allSlides = await driveListAll(
    `mimeType = '${GOOGLE_SLIDES_MIME}' and trashed = false`,
  );
  console.log(`[discovery] Phase A: bulk listed ${allSlides.length} presentations from Drive`);
  if (allSlides.length > 0) {
    console.log(`[discovery] Sample Drive names: ${allSlides.slice(0, 5).map((f) => f.name).join(", ")}`);
  }
  const slidesMap = new Map<string, (typeof allSlides)[0]>();
  for (const f of allSlides) {
    slidesMap.set(normalize(f.name), f);
  }

  // Group misses by title for dedup
  const titleGroups = new Map<string, typeof misses>();
  for (const miss of misses) {
    const group = titleGroups.get(miss.title) ?? [];
    group.push(miss);
    titleGroups.set(miss.title, group);
  }

  // Try matching each title against the bulk list
  const stillUnresolved: [string, typeof misses][] = [];
  for (const [title, group] of titleGroups) {
    const match = pickBestMatch(title, allSlides);
    if (match) {
      console.log(`[discovery] Phase A matched: "${title}" → "${match.name}" (score: ${match.score})`);
      applyResult(group, title, match);
    } else {
      console.log(`[discovery] Phase A miss: "${title}" (normalized: "${normalize(title)}")`);
      stillUnresolved.push([title, group]);
    }
  }

  // ── Phase B: Targeted keyword search for titles not found in bulk list ──
  if (stillUnresolved.length > 0) {
    console.log(`[discovery] Phase B: ${stillUnresolved.length} unresolved titles, doing targeted search`);
    const targetedLookups = stillUnresolved.map(async ([title, group]) => {
      const searchTerms = normalize(title)
        .split(/\s+/)
        .filter((w) => w.length > 2);
      const keywords = searchTerms.slice(0, 3);

      if (keywords.length === 0) {
        console.log(`[discovery] Phase B skip: "${title}" — no usable keywords`);
        applyResult(group, title, null);
        return;
      }

      const nameFilters = keywords.map((kw) => {
        const escaped = kw.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        return `name contains '${escaped}'`;
      });
      const q = [
        `mimeType = '${GOOGLE_SLIDES_MIME}'`,
        "trashed = false",
        ...nameFilters,
      ].join(" and ");

      console.log(`[discovery] Phase B query for "${title}": ${q}`);
      const files = await driveQuery(q);
      console.log(`[discovery] Phase B results for "${title}": ${files.length} files${files.length > 0 ? ` — ${files.map((f) => f.name).join(", ")}` : ""}`);
      const match = pickBestMatch(title, files);

      // If AND query didn't find anything, try with fewer keywords (OR-style fallback)
      if (!match && keywords.length > 1) {
        const longestKw = keywords.sort((a, b) => b.length - a.length)[0];
        const escaped = longestKw.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        const fallbackQ = `mimeType = '${GOOGLE_SLIDES_MIME}' and trashed = false and name contains '${escaped}'`;
        console.log(`[discovery] Phase B fallback for "${title}": keyword="${longestKw}"`);
        const fallbackFiles = await driveQuery(fallbackQ);
        console.log(`[discovery] Phase B fallback results for "${title}": ${fallbackFiles.length} files${fallbackFiles.length > 0 ? ` — ${fallbackFiles.map((f) => f.name).join(", ")}` : ""}`);
        const fallbackMatch = pickBestMatch(title, fallbackFiles);
        if (fallbackMatch) {
          console.log(`[discovery] Phase B fallback matched: "${title}" → "${fallbackMatch.name}" (score: ${fallbackMatch.score})`);
        } else {
          console.log(`[discovery] Phase B: no match found for "${title}"`);
        }
        applyResult(group, title, fallbackMatch);
        return;
      }

      if (match) {
        console.log(`[discovery] Phase B matched: "${title}" → "${match.name}" (score: ${match.score})`);
      } else {
        console.log(`[discovery] Phase B: no match found for "${title}"`);
      }
      applyResult(group, title, match);
    });

    await Promise.all(targetedLookups);
  }
}

function startStalenessPolling() {
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    console.log("[staleness] Skipping polling (GOOGLE_CLOUD_PROJECT not configured)");
    return;
  }

  console.log("[staleness] Background polling started (interval: 24h)");

  async function pollStaleTemplates() {
    try {
      // Only check idle, accessible, previously-ingested templates
      const templates = await prisma.template.findMany({
        where: {
          accessStatus: "accessible",
          ingestionStatus: "idle",
          lastIngestedAt: { not: null },
        },
      });

      const { accessToken, source } = await getPooledGoogleAuth();
      console.log(`[staleness] Polling with ${source} auth`);

      const drive = getDriveClient(accessToken ? { accessToken } : undefined);

      for (const template of templates) {
        try {
          const fileRes = await drive.files.get({
            fileId: template.presentationId,
            fields: "modifiedTime",
            supportsAllDrives: true,
          });

          const modifiedTime = fileRes.data.modifiedTime;
          if (modifiedTime && template.lastIngestedAt) {
            if (new Date(modifiedTime) > new Date(template.lastIngestedAt)) {
              // Template is stale -- update sourceModifiedAt and enqueue re-ingestion
              await prisma.template.update({
                where: { id: template.id },
                data: { sourceModifiedAt: new Date(modifiedTime) },
              });
              ingestionQueue.enqueue(template.id);
              console.log(`[staleness] Template "${template.name}" is stale, enqueuing re-ingestion`);
            }
          }

          // Rate limit between Drive API calls
          await new Promise((resolve) => setTimeout(resolve, DRIVE_API_DELAY));
        } catch (err: unknown) {
          const errStatus = err && typeof err === "object" && "status" in err
            ? (err as { status: number }).status
            : 0;

          // Create ActionRequired for SA permission errors
          if ((errStatus === 403 || errStatus === 404) && source === "service_account") {
            const existingAction = await prisma.actionRequired.findFirst({
              where: { resourceId: template.presentationId, actionType: "share_with_sa", resolved: false },
            });
            if (!existingAction) {
              await prisma.actionRequired.create({
                data: {
                  actionType: "share_with_sa",
                  title: `Share "${template.name}" with service account`,
                  description: `The template "${template.name}" is not accessible. Please share it with the service account email as a Viewer, or ask an admin to grant access.`,
                  resourceId: template.presentationId,
                  resourceName: template.name,
                },
              }).catch(() => {});
            }
          }

          console.error(`[staleness] Error checking template "${template.name}":`, err);
        }
      }
    } catch (err) {
      console.error("[staleness] Polling cycle error:", err);
    }
  }

  // First poll after initial delay, then every 5 minutes
  setTimeout(() => {
    void pollStaleTemplates();
    setInterval(() => void pollStaleTemplates(), STALENESS_POLL_INTERVAL);
  }, STALENESS_INITIAL_DELAY);
}

/**
 * Single-database architecture with schema isolation:
 *
 * public schema (Prisma) --- APPLICATION-level tables
 *   Stores: WorkflowJob, Company, Deal, InteractionRecord, etc.
 *   Managed: by Prisma migrations (schema.prisma + prisma migrate).
 *
 * mastra schema (PostgresStore) --- Mastra INTERNAL tables
 *   Stores: workflow execution snapshots, suspend/resume state,
 *           message history, traces, and step outputs.
 *   Managed: entirely by Mastra (auto-created on first startup).
 *
 * Both schemas coexist in the same Supabase PostgreSQL database.
 */

// PrismaClient singleton imported from shared module
import { prisma } from "../lib/db";

// Service-to-service auth: require X-API-Key header on all endpoints except /health
const publicPaths: (string | RegExp)[] = ["/health"];
if (env.NODE_ENV === "development") {
  // Only Mastra playground/docs routes are public in dev — workflow APIs still require auth
  publicPaths.push(/^\/api\/playground/);
  publicPaths.push(/^\/api\/docs/);
  publicPaths.push(/^\/api\/openapi/);
}

// Supabase JWT auth: verifies user tokens from the web app
class SupabaseJwtAuth extends MastraAuthProvider<JwtPayload> {
  constructor(publicPaths: (string | RegExp)[]) {
    super({ name: "supabase-jwt", public: publicPaths });
  }

  async authenticateToken(token: string): Promise<JwtPayload | null> {
    // Strip Bearer prefix if present (Mastra may or may not strip it)
    const rawToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    return verifySupabaseJwt(rawToken, env.SUPABASE_URL);
  }

  async authorizeUser(): Promise<boolean> {
    // All authenticated users are authorized
    return true;
  }
}

const auth = new SupabaseJwtAuth(publicPaths);

// Ensure all named agents from the catalog have DB config rows (idempotent)
void seedPublishedAgentCatalog(prisma)
  .then(() => console.log("[startup] Agent catalog seed check complete"))
  .catch((err) =>
    console.error("[startup] Failed to seed agent catalog:", err)
  );

// Clear stale ingestion states on startup (crash recovery)
void clearStaleIngestions().catch((err) =>
  console.error("[startup] Failed to clear stale ingestions:", err)
);

// Detect slides with missing descriptions/elements and queue for backfill
void detectAndQueueBackfill().catch((err) =>
  console.error("[startup] Failed to queue description backfill:", err)
);

export const mastra = new Mastra({
  storage: createResilientStorage({
    id: "mastra-store",
    connectionString: env.DATABASE_URL,
    schemaName: "mastra",
  }),
  agents: namedMastraAgents,
  workflows: {
    "touch-1-workflow": touch1Workflow,
    "touch-2-workflow": touch2Workflow,
    "touch-3-workflow": touch3Workflow,
    "touch-4-workflow": touch4Workflow,
    "pre-call-workflow": preCallWorkflow,
    "structure-driven-workflow": structureDrivenWorkflow,
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(env.MASTRA_PORT, 10),
    auth,
    cors: {
      origin: env.WEB_APP_URL,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type', 'X-Google-Access-Token', 'X-User-Id'],
      credentials: false,
    },
    apiRoutes: [
      // ────────────────────────────────────────────────────────────
      // Health Check (public -- no auth required)
      // ────────────────────────────────────────────────────────────
      registerApiRoute("/health", {
        method: "GET",
        requiresAuth: false,
        handler: async (c) => {
          return c.json({ status: "ok" });
        },
      }),
      // ────────────────────────────────────────────────────────────
      // Generation Logs (real-time polling)
      // ────────────────────────────────────────────────────────────
      registerApiRoute("/generation-logs/:dealId/:touchType", {
        method: "GET",
        requiresAuth: false,
        handler: async (c) => {
          const dealId = c.req.param("dealId");
          const touchType = c.req.param("touchType");
          const key = buildGenLogKey(dealId, touchType);
          const logs = getGenerationLogs(key);
          console.log(`[generation-logs] key=${key} logs=${logs.length}`);
          return c.json({ logs });
        },
      }),
      // ────────────────────────────────────────────────────────────
      // Company CRUD
      // ────────────────────────────────────────────────────────────
      registerApiRoute("/companies", {
        method: "GET",
        handler: async (c) => {
          const companies = await prisma.company.findMany({
            include: { deals: true },
            orderBy: { createdAt: "desc" },
          });
          return c.json(companies);
        },
      }),
      registerApiRoute("/companies", {
        method: "POST",
        handler: async (c) => {
          const body = await c.req.json();
          const data = z
            .object({
              name: z.string().min(1),
              industry: z.string().min(1),
              logoUrl: z.string().optional(),
            })
            .parse(body);

          // Upsert: create or return existing by name
          const company = await prisma.company.upsert({
            where: { name: data.name },
            update: { industry: data.industry, logoUrl: data.logoUrl },
            create: data,
          });
          return c.json(company);
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Deal CRUD
      // ────────────────────────────────────────────────────────────
      registerApiRoute("/deals", {
        method: "GET",
        handler: async (c) => {
          const statusParam = c.req.query("status");
          const assigneeParam = c.req.query("assignee");
          const userIdParam = c.req.query("userId");

          // Build where clause
          const where: Record<string, unknown> = {};

          // Filter by status (if provided and not "all")
          if (statusParam && statusParam !== "all") {
            where.status = statusParam;
          }

          // Filter by assignee (skip when "all" or absent)
          if (assigneeParam && assigneeParam !== "all") {
            const targetUserId = assigneeParam === "me" ? userIdParam : assigneeParam;
            if (targetUserId) {
              where.OR = [
                { ownerId: targetUserId },
                { collaborators: { contains: targetUserId } },
              ];
            }
          }

          const deals = await prisma.deal.findMany({
            where,
            include: {
              company: true,
              interactions: {
                include: { brief: true },
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { createdAt: "desc" },
          });
          return c.json(deals);
        },
      }),
      registerApiRoute("/deals", {
        method: "POST",
        handler: async (c) => {
          const body = await c.req.json();
          const data = z
            .object({
              companyId: z.string().min(1),
              name: z.string().min(1),
              salespersonName: z.string().optional(),
              salespersonPhoto: z.string().optional(),
              ownerId: z.string().optional(),
              ownerEmail: z.string().optional(),
              ownerName: z.string().optional(),
              collaborators: z.string().optional(),
            })
            .parse(body);

          const deal = await prisma.deal.create({
            data,
            include: { company: true },
          });
          return c.json(deal);
        },
      }),
      registerApiRoute("/deals/:id", {
        method: "GET",
        handler: async (c) => {
          const id = c.req.param("id");
          const deal = await prisma.deal.findUnique({
            where: { id },
            include: {
              company: true,
              interactions: {
                include: { feedbackSignals: true, brief: true },
                orderBy: { createdAt: "desc" },
              },
            },
          });
          if (!deal) {
            return c.json({ error: "Deal not found" }, 404);
          }
          return c.json(deal);
        },
      }),
      registerApiRoute("/deals/:id/interactions", {
        method: "GET",
        handler: async (c) => {
          const id = c.req.param("id");
          const interactions = await prisma.interactionRecord.findMany({
            where: { dealId: id },
            include: { feedbackSignals: true },
            orderBy: { createdAt: "desc" },
          });
          return c.json(interactions);
        },
      }),
      registerApiRoute("/deals/:dealId/chat", {
        method: "GET",
        handler: async (c) => {
          const dealId = c.req.param("dealId");
          const routeContext = dealChatRouteContextSchema.parse({
            section: c.req.query("section") ?? "overview",
            touchType: c.req.query("touchType") ?? null,
            pathname: c.req.query("pathname") ?? `/deals/${dealId}`,
            pageLabel: c.req.query("pageLabel") ?? "Overview",
          });
          const messages = await getDealChatMessages(dealId);

          return c.json({
            messages: messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              meta: message.metaJson ? JSON.parse(message.metaJson) : null,
              createdAt: message.createdAt,
            })),
            greeting:
              messages.length === 0
                ? `Hi - I can help with ${routeContext.pageLabel.toLowerCase()} context, similar cases, and note capture for this deal.`
                : null,
            suggestions: buildDealChatSuggestions(routeContext),
          });
        },
      }),
      registerApiRoute("/deals/:dealId/chat", {
        method: "POST",
        handler: async (c) => {
          const dealId = c.req.param("dealId");
          const body = await c.req.json();
          const parsed = dealChatSendRequestSchema.parse({
            ...body,
            dealId,
          });
          const userTurnContent = parsed.transcriptUpload
            ? parsed.message.trim()
              ? `Uploaded transcript: ${parsed.transcriptUpload.fileName}\n${parsed.message.trim()}`
              : `Uploaded transcript: ${parsed.transcriptUpload.fileName}`
            : parsed.message.trim();

          await appendDealChatMessage({
            dealId,
            role: "user",
            content: userTurnContent,
            routeContext: parsed.routeContext,
          });

          const result = await runDealChatTurn({
            dealId,
            message: parsed.message.trim(),
            routeContext: parsed.routeContext,
            transcriptUpload: parsed.transcriptUpload ?? null,
          });

          await appendDealChatMessage({
            dealId,
            role: "assistant",
            content: result.text,
            routeContext: parsed.routeContext,
            metaJson: JSON.stringify(result.meta),
          });

          const encoder = new TextEncoder();
          const chunks = result.text
            .split(/\n\n+/)
            .map((chunk) => chunk.trim())
            .filter(Boolean);

          const stream = new ReadableStream({
            start(controller) {
              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(`${chunk}\n\n`));
              }
              controller.enqueue(encoder.encode("---DEAL_CHAT_META---\n"));
              controller.enqueue(encoder.encode(JSON.stringify(result.meta)));
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache",
            },
          });
        },
      }),
      registerApiRoute("/deals/:dealId/chat/bindings", {
        method: "POST",
        handler: async (c) => {
          const dealId = c.req.param("dealId");
          const body = await c.req.json();
          const parsed = dealChatBindingRequestSchema.parse(body);
          const touchType =
            parsed.action === "save_general_note"
              ? null
              : parsed.touchType ?? parsed.source.touchType ?? null;

          const pendingSource = parsed.sourceId
            ? { id: parsed.sourceId }
            : await saveDealContextSource({
                dealId,
                source: parsed.source,
                status: "pending_confirmation",
                interactionId: parsed.interactionId ?? null,
                bindingMeta: {
                  action: parsed.action,
                  requestedTouchType: touchType,
                },
              });

          const saved = await confirmDealContextSource(pendingSource.id, {
            touchType,
            interactionId: parsed.interactionId ?? null,
            refinedText: parsed.refinedText ?? parsed.source.refinedText ?? null,
            bindingMeta: {
              action: parsed.action,
              touchType,
            },
          });

          return c.json({
            source: saved,
            confirmationChip: {
              id: `source-${saved.id}`,
              label: touchType
                ? `Saved to ${touchType.replace("_", " ")}`
                : "Saved as general deal notes",
              tone: "success",
              sourceType: saved.sourceType,
              touchType: saved.touchType,
            },
          });
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Deal Pipeline — Status & Assignment
      // ────────────────────────────────────────────────────────────
      registerApiRoute("/deals/:id/status", {
        method: "PATCH",
        handler: async (c) => {
          const id = c.req.param("id");
          const body = await c.req.json();
          const validStatuses = ["open", "won", "lost", "abandoned"];
          if (!body.status || !validStatuses.includes(body.status)) {
            return c.json(
              { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
              400,
            );
          }
          const deal = await prisma.deal.update({
            where: { id },
            data: { status: body.status },
            include: { company: true },
          });
          return c.json(deal);
        },
      }),
      registerApiRoute("/deals/:id/assignment", {
        method: "PATCH",
        handler: async (c) => {
          const id = c.req.param("id");
          const body = await c.req.json();
          const data: Record<string, unknown> = {};
          if (body.ownerId !== undefined) data.ownerId = body.ownerId;
          if (body.ownerEmail !== undefined) data.ownerEmail = body.ownerEmail;
          if (body.ownerName !== undefined) data.ownerName = body.ownerName;
          if (body.collaborators !== undefined) {
            data.collaborators = JSON.stringify(body.collaborators ?? []);
          }
          const deal = await prisma.deal.update({
            where: { id },
            data,
            include: { company: true },
          });
          return c.json(deal);
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Known Users (from Google token store)
      // ────────────────────────────────────────────────────────────
      registerApiRoute("/users/known", {
        method: "GET",
        handler: async (c) => {
          const tokens = await prisma.userGoogleToken.findMany({
            where: { isValid: true },
            select: { userId: true, email: true },
            orderBy: { lastUsedAt: "desc" },
          });
          const users = tokens.map((t) => ({
            id: t.userId,
            email: t.email,
            name: t.email
              .split("@")[0]
              .replace(/[.-]/g, " ")
              .replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
          }));
          return c.json(users);
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Touch 1 Override Upload
      // ────────────────────────────────────────────────────────────
      registerApiRoute("/touch-1/upload", {
        method: "POST",
        handler: async (c) => {
          try {
            const formData = await c.req.formData();
            const file = formData.get("file") as File | null;
            const dealId = formData.get("dealId") as string | null;

            if (!file || !dealId) {
              return c.json({ error: "file and dealId are required" }, 400);
            }

            // Get deal info
            const deal = await prisma.deal.findUniqueOrThrow({
              where: { id: dealId },
              include: { company: true },
            });

            // Get or create deal folder
            const folderId = await getOrCreateDealFolder({
              companyName: deal.company.name,
              dealName: deal.name,
              parentFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
            });

            if (!deal.driveFolderId) {
              await prisma.deal.update({
                where: { id: deal.id },
                data: { driveFolderId: folderId },
              });
            }

            // Upload file to Drive
            const googleAuth = await extractGoogleAuth(c, await getVerifiedUserId(c, env.SUPABASE_URL));
            const drive = getDriveClient(googleAuth.accessToken ? googleAuth : undefined);
            const buffer = Buffer.from(await file.arrayBuffer());
            const { Readable } = await import("node:stream");

            const uploaded = await drive.files.create({
              requestBody: {
                name: `Touch 1 Override - ${deal.company.name} - ${new Date().toISOString().split("T")[0]}`,
                parents: [folderId],
                mimeType: "application/vnd.google-apps.presentation",
              },
              media: {
                mimeType: file.type,
                body: Readable.from(buffer),
              },
              fields: "id",
              supportsAllDrives: true,
            });

            const fileId = uploaded.data.id!;
            const driveUrl = `https://docs.google.com/presentation/d/${fileId}/edit`;

            // Share with org (domain-wide viewer access)
            await shareWithOrg({ fileId });

            // Create interaction record with "overridden" decision
            const interaction = await prisma.interactionRecord.create({
              data: {
                dealId,
                touchType: "touch_1",
                status: "overridden",
                decision: "overridden",
                inputs: JSON.stringify({
                  companyName: deal.company.name,
                  industry: deal.company.industry,
                  uploadedFile: file.name,
                }),
                outputRefs: JSON.stringify([driveUrl]),
                driveFileId: fileId,
              },
            });

            // Create override feedback signal
            await prisma.feedbackSignal.create({
              data: {
                interactionId: interaction.id,
                signalType: "override",
                source: "touch_1_upload",
                content: JSON.stringify({
                  originalFileName: file.name,
                  fileSize: file.size,
                  mimeType: file.type,
                }),
              },
            });

            // Ingest uploaded file into AtlusAI (non-blocking)
            try {
              await ingestDocument(
                {
                  documentId: `touch1-override-${interaction.id}`,
                  presentationId: fileId,
                  presentationName: `Touch 1 Override - ${deal.company.name}`,
                  slideObjectId: "full-deck",
                  slideIndex: 0,
                  folderPath: `deals/${deal.company.name}`,
                  textContent: `Override upload for ${deal.company.name} Touch 1 pager`,
                  speakerNotes: "",
                  isLowContent: true,
                  metadata: {
                    touchType: "touch_1",
                    industry: deal.company.industry,
                    companyName: deal.company.name,
                    decision: "overridden",
                  },
                },
                env.GOOGLE_DRIVE_FOLDER_ID
              );
            } catch (err) {
              console.error("[touch-1/upload] AtlusAI ingestion failed:", err);
            }

            return c.json({
              interactionId: interaction.id,
              presentationId: fileId,
              driveUrl,
              decision: "overridden",
            });
          } catch (err) {
            console.error("[touch-1/upload] Error:", err);
            return c.json({ error: "Upload failed", details: String(err) }, 500);
          }
        },
      }),
      // ────────────────────────────────────────────────────────────
      // Touch 4 Workflow Status (persistent store fallback)
      // ────────────────────────────────────────────────────────────
      registerApiRoute("/touch-4-workflow/status/:runId", {
        method: "GET",
        handler: async (c) => {
          const runId = c.req.param("runId");
          try {
            const wf = mastra.getWorkflow("touch-4-workflow");
            const run = wf.createRun({ runId });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const status = await (run as any).get();
            return c.json(status);
          } catch (err) {
            return c.json(
              { error: "Workflow run not found", details: String(err) },
              404,
            );
          }
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Brief Approval API (Phase 6 -- HITL Checkpoint 1)
      // ────────────────────────────────────────────────────────────

      // GET /briefs/:briefId -- Fetch brief by ID
      registerApiRoute("/briefs/:briefId", {
        method: "GET",
        handler: async (c) => {
          const briefId = c.req.param("briefId");
          try {
            const brief = await prisma.brief.findUniqueOrThrow({
              where: { id: briefId },
              include: {
                interaction: {
                  include: { deal: { include: { company: true } } },
                },
              },
            });
            return c.json(brief);
          } catch {
            return c.json({ error: "Brief not found" }, 404);
          }
        },
      }),

      // GET /briefs/:briefId/review -- Fetch brief + deal context for standalone review page
      registerApiRoute("/briefs/:briefId/review", {
        method: "GET",
        handler: async (c) => {
          const briefId = c.req.param("briefId");
          try {
            const brief = await prisma.brief.findUniqueOrThrow({
              where: { id: briefId },
              include: {
                interaction: {
                  include: {
                    deal: { include: { company: true } },
                    transcript: true,
                  },
                },
              },
            });

            const deal = brief.interaction.deal;
            const transcript = brief.interaction.transcript;

            return c.json({
              brief: {
                id: brief.id,
                interactionId: brief.interactionId,
                primaryPillar: brief.primaryPillar,
                secondaryPillars: brief.secondaryPillars,
                evidence: brief.evidence,
                customerContext: brief.customerContext,
                businessOutcomes: brief.businessOutcomes,
                constraints: brief.constraints,
                stakeholders: brief.stakeholders,
                timeline: brief.timeline,
                budget: brief.budget,
                useCases: brief.useCases,
                roiFraming: brief.roiFraming,
                approvalStatus: brief.approvalStatus,
                reviewerName: brief.reviewerName,
                approvedAt: brief.approvedAt,
                rejectionFeedback: brief.rejectionFeedback,
                workflowRunId: brief.workflowRunId,
                createdAt: brief.createdAt,
                updatedAt: brief.updatedAt,
              },
              deal: {
                companyName: deal.company.name,
                industry: deal.company.industry,
                dealName: deal.name,
              },
              transcript: transcript
                ? {
                    subsector: transcript.subsector,
                    summary: transcript.rawText.slice(0, 200),
                  }
                : null,
            });
          } catch {
            return c.json({ error: "Brief not found" }, 404);
          }
        },
      }),

      // POST /briefs/:briefId/approve -- Resume workflow with approval
      registerApiRoute("/briefs/:briefId/approve", {
        method: "POST",
        handler: async (c) => {
          const briefId = c.req.param("briefId");
          try {
            const body = await c.req.json();
            const data = z
              .object({
                reviewerName: z.string().min(1),
                editedBrief: z.record(z.string(), z.unknown()).optional(),
                runId: z.string().min(1),
              })
              .parse(body);

            // Update workflowRunId on the Brief (steps cannot access runId)
            await prisma.brief.update({
              where: { id: briefId },
              data: { workflowRunId: data.runId },
            });

            // Resume the workflow at the await-brief-approval step
            const wf = mastra.getWorkflow("touch-4-workflow");
            const run = await wf.createRun({ runId: data.runId });
            await run.resume({
              step: "await-brief-approval",
              resumeData: {
                decision: "approved",
                reviewerName: data.reviewerName,
                editedBrief: data.editedBrief,
              },
            });

            return c.json({ success: true });
          } catch (err) {
            console.error("[briefs/approve] Error:", err);
            return c.json(
              { error: "Approval failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /briefs/:briefId/reject -- Record rejection (does NOT resume workflow)
      registerApiRoute("/briefs/:briefId/reject", {
        method: "POST",
        handler: async (c) => {
          const briefId = c.req.param("briefId");
          try {
            const body = await c.req.json();
            const data = z
              .object({
                reviewerName: z.string().min(1),
                feedback: z.string().min(1),
              })
              .parse(body);

            // Update Brief with rejection info
            const brief = await prisma.brief.update({
              where: { id: briefId },
              data: {
                approvalStatus: "changes_requested",
                reviewerName: data.reviewerName,
                rejectionFeedback: data.feedback,
              },
            });

            // Update InteractionRecord status
            await prisma.interactionRecord.update({
              where: { id: brief.interactionId },
              data: { status: "changes_requested" },
            });

            // Create FeedbackSignal for rejection
            await prisma.feedbackSignal.create({
              data: {
                interactionId: brief.interactionId,
                signalType: "negative",
                source: "brief_rejection",
                content: JSON.stringify({
                  reviewerName: data.reviewerName,
                  feedback: data.feedback,
                  briefId,
                }),
              },
            });

            return c.json({ success: true });
          } catch (err) {
            console.error("[briefs/reject] Error:", err);
            return c.json(
              { error: "Rejection failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /briefs/:briefId/edit -- Save brief edits with FeedbackSignal diff
      registerApiRoute("/briefs/:briefId/edit", {
        method: "POST",
        handler: async (c) => {
          const briefId = c.req.param("briefId");
          try {
            const body = await c.req.json();
            const data = z
              .object({
                editedBrief: z.record(z.string(), z.unknown()),
                reviewerName: z.string().min(1),
              })
              .parse(body);

            // Snapshot original brief before editing
            const original = await prisma.brief.findUniqueOrThrow({
              where: { id: briefId },
            });

            const edited = data.editedBrief as Record<string, unknown>;

            // Update Brief fields in-place
            await prisma.brief.update({
              where: { id: briefId },
              data: {
                primaryPillar: (edited.primaryPillar as string) ?? original.primaryPillar,
                secondaryPillars:
                  typeof edited.secondaryPillars === "string"
                    ? edited.secondaryPillars
                    : JSON.stringify(edited.secondaryPillars ?? JSON.parse(original.secondaryPillars)),
                evidence: (edited.evidence as string) ?? original.evidence,
                customerContext: (edited.customerContext as string) ?? original.customerContext,
                businessOutcomes: (edited.businessOutcomes as string) ?? original.businessOutcomes,
                constraints: (edited.constraints as string) ?? original.constraints,
                stakeholders: (edited.stakeholders as string) ?? original.stakeholders,
                timeline: (edited.timeline as string) ?? original.timeline,
                budget: (edited.budget as string) ?? original.budget,
                useCases:
                  typeof edited.useCases === "string"
                    ? edited.useCases
                    : JSON.stringify(edited.useCases ?? JSON.parse(original.useCases)),
                approvalStatus: "pending_approval", // Reset for re-review
              },
            });

            // Create FeedbackSignal with before/after diff
            await prisma.feedbackSignal.create({
              data: {
                interactionId: original.interactionId,
                signalType: "edited",
                source: "brief_edit",
                content: JSON.stringify({
                  reviewerName: data.reviewerName,
                  before: {
                    primaryPillar: original.primaryPillar,
                    secondaryPillars: original.secondaryPillars,
                    evidence: original.evidence,
                    customerContext: original.customerContext,
                    businessOutcomes: original.businessOutcomes,
                    constraints: original.constraints,
                    stakeholders: original.stakeholders,
                    timeline: original.timeline,
                    budget: original.budget,
                    useCases: original.useCases,
                  },
                  after: edited,
                }),
              },
            });

            return c.json({ success: true });
          } catch (err) {
            console.error("[briefs/edit] Error:", err);
            return c.json(
              { error: "Edit failed", details: String(err) },
              500
            );
          }
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Asset Review API (Phase 9 -- HITL Checkpoint 2)
      // ────────────────────────────────────────────────────────────

      // GET /interactions/:id/asset-review -- Fetch asset review data for standalone review page
      registerApiRoute("/interactions/:id/asset-review", {
        method: "GET",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const interaction = await prisma.interactionRecord.findUniqueOrThrow({
              where: { id },
              include: {
                deal: { include: { company: true } },
                brief: true,
                feedbackSignals: true,
              },
            });

            // Parse outputRefs JSON (format: { deckUrl, talkTrackUrl, faqUrl, dealFolderId })
            let outputRefs: {
              deckUrl: string;
              talkTrackUrl: string;
              faqUrl: string;
              dealFolderId: string;
            } | null = null;
            if (interaction.outputRefs) {
              try {
                outputRefs = JSON.parse(interaction.outputRefs);
              } catch {
                console.warn("[asset-review] Failed to parse outputRefs:", interaction.outputRefs);
              }
            }

            // Try to get complianceResult from workflow step output
            let complianceResult: {
              passed: boolean;
              warnings: Array<{ check: string; message: string; severity: string }>;
            } | null = null;

            if (interaction.brief?.workflowRunId) {
              try {
                const wf = mastra.getWorkflow("touch-4-workflow");
                const run = wf.createRun({ runId: interaction.brief.workflowRunId });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const status = await (run as any).get();
                const stepOutput = (status as Record<string, unknown>)?.steps as
                  | Record<string, { status: string; output?: Record<string, unknown> }>
                  | undefined;
                if (stepOutput?.["check-brand-compliance"]?.output?.complianceResult) {
                  complianceResult = stepOutput["check-brand-compliance"].output
                    .complianceResult as unknown as typeof complianceResult;
                }
              } catch (err) {
                console.warn("[asset-review] Could not fetch compliance result from workflow:", err);
              }
            }

            return c.json({
              interaction: {
                id: interaction.id,
                status: interaction.status,
                outputRefs: outputRefs ?? {
                  deckUrl: "",
                  talkTrackUrl: "",
                  faqUrl: "",
                  dealFolderId: "",
                },
              },
              deal: {
                companyName: interaction.deal.company.name,
                industry: interaction.deal.company.industry,
                dealName: interaction.deal.name,
              },
              brief: interaction.brief
                ? {
                    id: interaction.brief.id,
                    primaryPillar: interaction.brief.primaryPillar,
                    workflowRunId: interaction.brief.workflowRunId,
                    approvalStatus: interaction.brief.approvalStatus,
                  }
                : null,
              complianceResult,
            });
          } catch (err) {
            console.error("[asset-review] Error:", err);
            return c.json(
              { error: "Asset review data not found", details: String(err) },
              404
            );
          }
        },
      }),

      // POST /interactions/:id/approve-assets -- Resume workflow with asset approval
      registerApiRoute("/interactions/:id/approve-assets", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const body = await c.req.json();
            const data = z
              .object({
                reviewerName: z.string().min(1),
                reviewerRole: z.enum(["Seller", "SME", "Marketing", "Solutions"]),
                runId: z.string().min(1),
              })
              .parse(body);

            // Resume the workflow at the await-asset-review step
            const wf = mastra.getWorkflow("touch-4-workflow");
            const run = await wf.createRun({ runId: data.runId });
            await run.resume({
              step: "await-asset-review",
              resumeData: {
                decision: "approved" as const,
                reviewerName: data.reviewerName,
                reviewerRole: data.reviewerRole,
              },
            });

            return c.json({ success: true });
          } catch (err) {
            console.error("[approve-assets] Error:", err);
            return c.json(
              { error: "Asset approval failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /interactions/:id/reject-assets -- Record rejection without resuming workflow
      registerApiRoute("/interactions/:id/reject-assets", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const body = await c.req.json();
            const data = z
              .object({
                reviewerName: z.string().min(1),
                reviewerRole: z.enum(["Seller", "SME", "Marketing", "Solutions"]),
                feedback: z.string().min(1),
              })
              .parse(body);

            // Create FeedbackSignal for rejection (do NOT resume workflow)
            await prisma.feedbackSignal.create({
              data: {
                interactionId: id,
                signalType: "negative",
                source: "asset_review_rejection",
                content: JSON.stringify({
                  reviewerName: data.reviewerName,
                  reviewerRole: data.reviewerRole,
                  feedback: data.feedback,
                }),
              },
            });

            return c.json({ success: true });
          } catch (err) {
            console.error("[reject-assets] Error:", err);
            return c.json(
              { error: "Asset rejection failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /interactions/:id/revert-stage -- Revert HITL stage to an earlier stage
      registerApiRoute("/interactions/:id/revert-stage", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const body = await c.req.json();
            const data = z
              .object({
                targetStage: z.enum(["skeleton", "lowfi", "highfi"]),
              })
              .parse(body);

            const STAGE_ORDER: Record<string, number> = {
              skeleton: 0,
              lowfi: 1,
              highfi: 2,
              ready: 3,
            };

            const interaction =
              await prisma.interactionRecord.findUniqueOrThrow({
                where: { id },
                select: { hitlStage: true },
              });

            const currentIndex =
              STAGE_ORDER[interaction.hitlStage ?? "skeleton"] ?? 0;
            const targetIndex = STAGE_ORDER[data.targetStage] ?? 0;

            if (targetIndex >= currentIndex) {
              return c.json(
                { error: "Can only revert to an earlier stage" },
                400
              );
            }

            await prisma.interactionRecord.update({
              where: { id },
              data: { hitlStage: data.targetStage, stageContent: null },
            });

            return c.json({ success: true });
          } catch (err) {
            console.error("[revert-stage] Error:", err);
            return c.json(
              { error: "Stage revert failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /interactions/:id/mark-failed -- Mark an interaction as failed (workflow died)
      registerApiRoute("/interactions/:id/mark-failed", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const interaction = await prisma.interactionRecord.findUniqueOrThrow({
              where: { id },
              select: { status: true },
            });

            // Only mark as failed if currently in_progress
            if (interaction.status !== "in_progress") {
              return c.json({ success: true, status: interaction.status });
            }

            await prisma.interactionRecord.update({
              where: { id },
              data: { status: "failed" },
            });

            return c.json({ success: true, status: "failed" });
          } catch (err) {
            console.error("[mark-failed] Error:", err);
            return c.json(
              { error: "Mark failed failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /interactions/:id/regenerate-stage -- Re-run LLM generation for current stage
      registerApiRoute("/interactions/:id/regenerate-stage", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const body = await c.req.json().catch(() => ({}));
            const data = z
              .object({
                feedback: z.string().optional(),
                wipeData: z.boolean().optional(),
              })
              .parse(body);

            const result = await regenerateStage(id, data.feedback, data.wipeData);
            return c.json(result);
          } catch (err) {
            console.error("[regenerate-stage] Error:", err);
            return c.json(
              { error: "Stage regeneration failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /interactions/:id/retry-generation -- Retry from failed step (preserves approved stages)
      registerApiRoute("/interactions/:id/retry-generation", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const result = await retryGeneration(id);
            return c.json(result);
          } catch (err) {
            console.error("[retry-generation] Error:", err);
            return c.json(
              { error: "Retry generation failed", details: String(err) },
              500
            );
          }
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Visual QA — On-demand SSE endpoint
      // ────────────────────────────────────────────────────────────

      registerApiRoute("/visual-qa/run", {
        method: "POST",
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const { presentationId, interactionId } = body as {
              presentationId: string;
              interactionId: string;
            };

            if (!presentationId || !interactionId) {
              return c.json(
                { error: "Missing presentationId or interactionId" },
                400,
              );
            }

            // Load modification plans from interaction stageContent
            const interaction = await prisma.interactionRecord.findUniqueOrThrow({
              where: { id: interactionId },
            });
            const stageContent = JSON.parse(interaction.stageContent ?? "{}");
            const modifiedPlans = stageContent.modificationPlans ?? [];

            // Get pooled auth
            const pooled = await getPooledGoogleAuth();
            const authOptions = pooled.accessToken
              ? { accessToken: pooled.accessToken }
              : undefined;

            // Create SSE stream
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              async start(controller) {
                const send = (event: string, data: unknown) => {
                  controller.enqueue(
                    encoder.encode(
                      `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                    ),
                  );
                };

                try {
                  const result = await performVisualQA(
                    { presentationId, modifiedPlans, authOptions },
                    (type, detail) =>
                      send("log", { type, detail, timestamp: Date.now() }),
                  );

                  // If corrections were applied, invalidate stale GCS thumbnails
                  // and re-cache fresh ones so the frontend shows updated slides.
                  if (result.status === "corrected" || result.status === "warning") {
                    send("log", { type: "info", detail: "Refreshing slide thumbnails...", timestamp: Date.now() });
                    try {
                      await invalidatePresentationThumbnails(presentationId);
                      await cachePresentationThumbnails(presentationId, authOptions);
                      send("log", { type: "info", detail: "Thumbnails refreshed", timestamp: Date.now() });
                    } catch (thumbErr) {
                      console.warn("[visual-qa/run] Thumbnail refresh failed (non-fatal):", thumbErr);
                    }
                  }

                  send("complete", result);
                } catch (err) {
                  send("error", {
                    message:
                      err instanceof Error ? err.message : String(err),
                  });
                } finally {
                  controller.close();
                }
              },
            });

            return new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
              },
            });
          } catch (err) {
            console.error("[visual-qa/run] Error:", err);
            return c.json(
              {
                error: "Visual QA failed",
                details: String(err),
              },
              500,
            );
          }
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Template CRUD + Drive Access (Phase 19 -- TMPL-05/06/07)
      // ────────────────────────────────────────────────────────────

      // GET /templates -- List all templates ordered by createdAt desc
      registerApiRoute("/templates", {
        method: "GET",
        handler: async (c) => {
          const templates = await prisma.template.findMany({
            orderBy: { createdAt: "desc" },
          });
          return c.json(templates);
        },
      }),

      // POST /templates -- Create template with Drive access check
      registerApiRoute("/templates", {
        method: "POST",
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const data = z
              .object({
                name: z.string().optional(),
                googleSlidesUrl: z.string().url(),
                presentationId: z.string().min(1),
                touchTypes: z.array(z.string()).default([]),
              })
              .parse(body);

            let accessStatus = "not_checked";
            let sourceModifiedAt: Date | null = null;
            let serviceAccountEmail: string | null = null;
            let templateName = data.name || "Untitled Presentation";

            const googleAuth = await extractGoogleAuth(c, await getVerifiedUserId(c, env.SUPABASE_URL));
            try {
              const drive = getDriveClient(googleAuth.accessToken ? googleAuth : undefined);
              const fileRes = await drive.files.get({
                fileId: data.presentationId,
                fields: "id,name,modifiedTime",
                supportsAllDrives: true,
              });
              accessStatus = "accessible";
              templateName = fileRes.data.name || templateName;
              if (fileRes.data.modifiedTime) {
                sourceModifiedAt = new Date(fileRes.data.modifiedTime);
              }
            } catch (driveErr: unknown) {
              const errCode =
                driveErr &&
                typeof driveErr === "object" &&
                "code" in driveErr
                  ? (driveErr as { code: number }).code
                  : 0;
              if (errCode === 403 || errCode === 404) {
                accessStatus = "not_accessible";
                try {
                  const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
                  serviceAccountEmail = creds.client_email ?? null;
                } catch {
                  // ignore parse error
                }
              } else {
                throw driveErr;
              }
            }

            const template = await prisma.template.create({
              data: {
                name: templateName,
                googleSlidesUrl: data.googleSlidesUrl,
                presentationId: data.presentationId,
                touchTypes: JSON.stringify(data.touchTypes),
                accessStatus,
                sourceModifiedAt,
              },
            });

            return c.json({ template, serviceAccountEmail });
          } catch (err) {
            console.error("[templates/create] Error:", err);
            return c.json(
              { error: "Template creation failed", details: String(err) },
              500
            );
          }
        },
      }),

      // DELETE /templates/:id -- Delete template by id
      registerApiRoute("/templates/:id", {
        method: "DELETE",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            await prisma.template.delete({ where: { id } });
            return c.json({ success: true });
          } catch (err) {
            console.error("[templates/delete] Error:", err);
            return c.json(
              { error: "Template deletion failed", details: String(err) },
              500
            );
          }
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Slide Ingestion (Phase 20 -- SLIDE-02/03/04/05/06/08)
      // ────────────────────────────────────────────────────────────

      // POST /templates/:id/ingest -- Enqueue template for ingestion
      registerApiRoute("/templates/:id/ingest", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const template = await prisma.template.findUniqueOrThrow({
              where: { id },
              select: { accessStatus: true, ingestionStatus: true },
            });

            if (template.accessStatus !== "accessible") {
              return c.json(
                { error: "Template is not accessible. Grant access first." },
                400
              );
            }

            if (
              template.ingestionStatus === "queued" ||
              template.ingestionStatus === "ingesting"
            ) {
              return c.json(
                { error: "Ingestion already in progress" },
                409
              );
            }

            // Set status to queued
            await prisma.template.update({
              where: { id },
              data: { ingestionStatus: "queued" },
            });

            // Fire and forget
            ingestionQueue.enqueue(id);

            return c.json({ queued: true });
          } catch (err) {
            console.error("[templates/ingest] Error:", err);
            return c.json(
              { error: "Ingestion trigger failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /templates/:id/classify -- Classify template as "template" or "example"
      registerApiRoute("/templates/:id/classify", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const body = await c.req.json();
            const data = z
              .object({
                classification: z.enum(["template", "example"]),
                touchTypes: z.array(z.string()).optional(),
                artifactType: z.enum(ARTIFACT_TYPES).nullable().optional(),
              })
              .parse(body);

            const touchTypes = data.touchTypes ?? [];

            if (data.classification === "example" && touchTypes.length === 0) {
              return c.json(
                { error: "touchTypes must be a non-empty array when classification is 'example'" },
                400
              );
            }

            if (data.classification === "example" && touchTypes.length !== 1) {
              return c.json(
                { error: "examples must include exactly one touch type" },
                400,
              );
            }

            if (
              data.classification === "example" &&
              touchTypes[0] === "touch_4" &&
              !data.artifactType
            ) {
              return c.json(
                { error: "artifactType is required for touch_4 examples" },
                400,
              );
            }

            const template = await prisma.template.findUnique({ where: { id } });
            if (!template) {
              return c.json({ error: "Template not found" }, 404);
            }
            const updateData: Record<string, unknown> = {
              contentClassification: data.classification,
              artifactType: null,
              touchTypes: JSON.stringify(touchTypes),
            };

            if (
              data.classification === "example" &&
              touchTypes[0] === "touch_4"
            ) {
              updateData.artifactType = data.artifactType as ArtifactType;
            }

            const updated = await prisma.template.update({
              where: { id },
              data: updateData,
            });

            return c.json(updated);
          } catch (err) {
            if (err instanceof z.ZodError) {
              return c.json({ error: "Invalid request body", details: err.issues }, 400);
            }
            console.error("[templates/classify] Error:", err);
            return c.json(
              { error: "Classification failed", details: String(err) },
              500
            );
          }
        },
      }),

      // GET /templates/:id/progress -- Get ingestion progress
      registerApiRoute("/templates/:id/progress", {
        method: "GET",
        handler: async (c) => {
          const id = c.req.param("id");
          try {
            const template = await prisma.template.findUniqueOrThrow({
              where: { id },
              select: {
                ingestionProgress: true,
                ingestionStatus: true,
                slideCount: true,
              },
            });

            if (!template.ingestionProgress) {
              return c.json({
                status: template.ingestionStatus,
                current: 0,
                total: 0,
              });
            }

            const progress = JSON.parse(template.ingestionProgress);
            return c.json({
              status: template.ingestionStatus,
              ...progress,
            });
          } catch (err) {
            console.error("[templates/progress] Error:", err);
            return c.json(
              { error: "Progress fetch failed", details: String(err) },
              500
            );
          }
        },
      }),

      // POST /templates/:id/check-staleness -- Check staleness for a single template
      registerApiRoute("/templates/:id/check-staleness", {
        method: "POST",
        handler: async (c) => {
          const id = c.req.param("id");
          const googleAuth = await extractGoogleAuth(c, await getVerifiedUserId(c, env.SUPABASE_URL));
          try {
            const template = await prisma.template.findUniqueOrThrow({
              where: { id },
            });

            try {
              const drive = getDriveClient(googleAuth.accessToken ? googleAuth : undefined);
              const fileRes = await drive.files.get({
                fileId: template.presentationId,
                fields: "id,name,modifiedTime",
                supportsAllDrives: true,
              });

              const modifiedTime = fileRes.data.modifiedTime ?? null;
              let isStale = false;

              if (modifiedTime && template.lastIngestedAt) {
                isStale =
                  new Date(modifiedTime) > new Date(template.lastIngestedAt);
              }

              // Update access status, name, and sourceModifiedAt
              await prisma.template.update({
                where: { id },
                data: {
                  accessStatus: "accessible",
                  ...(fileRes.data.name ? { name: fileRes.data.name } : {}),
                  sourceModifiedAt: modifiedTime
                    ? new Date(modifiedTime)
                    : undefined,
                },
              });

              return c.json({ isStale, modifiedTime });
            } catch (driveErr: unknown) {
              const errCode =
                driveErr &&
                typeof driveErr === "object" &&
                "code" in driveErr
                  ? (driveErr as { code: number }).code
                  : 0;
              if (errCode === 403 || errCode === 404) {
                await prisma.template.update({
                  where: { id },
                  data: { accessStatus: "not_accessible" },
                });

                let serviceAccountEmail: string | null = null;
                try {
                  const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
                  serviceAccountEmail = creds.client_email ?? null;
                } catch {
                  // ignore
                }

                return c.json({
                  isStale: false,
                  accessError: true,
                  serviceAccountEmail,
                });
              }
              throw driveErr;
            }
          } catch (err) {
            console.error("[templates/check-staleness] Error:", err);
            return c.json(
              { error: "Staleness check failed", details: String(err) },
              500
            );
          }
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Phase 21: Preview & Review Engine (PREV-01 through PREV-05, SLIDE-09)
      // ────────────────────────────────────────────────────────────

      // GET /templates/:id/slides -- List all active slides with classifications for a template
      registerApiRoute("/templates/:id/slides", {
        method: "GET",
        handler: async (c) => {
          const templateId = c.req.param("id");
          const slides = await prisma.slideEmbedding.findMany({
            where: { templateId, archived: false },
            orderBy: { slideIndex: "asc" },
            select: {
              id: true,
              slideIndex: true,
              slideObjectId: true,
              contentText: true,
              classificationJson: true,
              confidence: true,
              needsReReview: true,
              reviewStatus: true,
              industry: true,
              solutionPillar: true,
              persona: true,
              funnelStage: true,
              contentType: true,
              description: true,
              elements: {
                orderBy: { positionY: "asc" },
                select: {
                  id: true,
                  elementId: true,
                  elementType: true,
                  positionX: true,
                  positionY: true,
                  width: true,
                  height: true,
                  contentText: true,
                  fontSize: true,
                  fontColor: true,
                  isBold: true,
                },
              },
            },
          });
          return c.json(slides);
        },
      }),

      // GET /templates/:id/thumbnails -- Return cached GCS thumbnail URLs
      // Returns whatever is cached immediately; kicks off background caching for missing/stale thumbnails.
      // The UI should poll this endpoint to pick up newly cached thumbnails.
      registerApiRoute("/templates/:id/thumbnails", {
        method: "GET",
        handler: async (c) => {
          const templateId = c.req.param("id");
          const template = await prisma.template.findUniqueOrThrow({ where: { id: templateId } });
          const googleAuth = await extractGoogleAuth(c, await getVerifiedUserId(c, env.SUPABASE_URL));

          // Query slides with cached thumbnail info
          const slides = await prisma.slideEmbedding.findMany({
            where: { templateId, archived: false },
            orderBy: { slideIndex: "asc" },
            select: { slideObjectId: true, slideIndex: true, thumbnailUrl: true, thumbnailFetchedAt: true },
          });

          const ttlCutoff = new Date(Date.now() - THUMBNAIL_TTL_MS);
          const needsRefresh = slides.some(
            (s) => s.slideObjectId && (!s.thumbnailUrl || !s.thumbnailFetchedAt || s.thumbnailFetchedAt < ttlCutoff)
          );

          // Fire-and-forget: cache missing/stale thumbnails in the background
          if (needsRefresh) {
            cacheThumbnailsForTemplate(
              templateId,
              template.presentationId,
              googleAuth.accessToken ? googleAuth : undefined
            ).catch((err) => console.error("[thumbnails] Background GCS cache refresh failed:", err));
          }

          // Return whatever is cached right now
          const thumbnails = slides
            .filter((s) => s.slideObjectId)
            .map((s) => ({
              slideObjectId: s.slideObjectId!,
              slideIndex: s.slideIndex,
              thumbnailUrl: s.thumbnailUrl ?? null,
              cached: !!(s.thumbnailUrl && s.thumbnailFetchedAt && s.thumbnailFetchedAt > ttlCutoff),
            }));

          return c.json({
            thumbnails,
            caching: needsRefresh,
          });
        },
      }),

      // GET /presentations/:id/thumbnails -- Return cached GCS thumbnail URLs for a generated presentation
      // Returns whatever is cached immediately; kicks off background caching for missing ones.
      // Frontend should poll while `caching` is true.
      registerApiRoute("/presentations/:id/thumbnails", {
        method: "GET",
        handler: async (c) => {
          const presentationId = c.req.param("id");

          // Get total slide count so we know when caching is complete
          let totalSlides = 0;
          try {
            const slidesApi = getSlidesClient();
            const pres = await slidesApi.presentations.get({
              presentationId,
              fields: "slides.objectId",
            });
            totalSlides = pres.data.slides?.length ?? 0;
          } catch {
            // If we can't reach Slides API, fall back to returning what we have
          }

          // Check GCS for existing cached thumbnails
          const cached = await checkPresentationThumbnails(presentationId);
          const cachedCount = cached?.length ?? 0;
          const isComplete = totalSlides > 0 && cachedCount >= totalSlides;

          if (isComplete) {
            return c.json({ thumbnails: cached, caching: false });
          }

          // Fire-and-forget: cache thumbnails in the background
          if (cachedCount === 0 || cachedCount < totalSlides) {
            cachePresentationThumbnails(presentationId).catch((err) =>
              console.error("[thumbnails] Background presentation thumbnail cache failed:", err),
            );
          }

          return c.json({ thumbnails: cached ?? [], caching: true });
        },
      }),

      // POST /slides/:id/update-classification -- Update a slide's classification tags and review status
      registerApiRoute("/slides/:id/update-classification", {
        method: "POST",
        handler: async (c) => {
          const slideId = c.req.param("id");
          const body = await c.req.json();
          const data = z.object({
            reviewStatus: z.enum(["approved", "needs_correction"]),
            correctedTags: z.object({
              industries: z.array(z.string()),
              solutionPillars: z.array(z.string()),
              buyerPersonas: z.array(z.string()),
              funnelStages: z.array(z.string()),
              contentType: z.string(),
              slideCategory: z.string(),
              subsectors: z.array(z.string()).optional(),
              touchType: z.array(z.string()).optional(),
            }).optional(),
          }).parse(body);

          if (data.reviewStatus === "approved") {
            // Thumbs up -- mark as approved, no tag changes
            await prisma.slideEmbedding.update({
              where: { id: slideId },
              data: { reviewStatus: "approved", needsReReview: false },
            });
          } else {
            // Thumbs down with corrections -- update tags + classificationJson via raw SQL
            const tags = data.correctedTags!;
            await prisma.$executeRaw`
              UPDATE "SlideEmbedding"
              SET
                industry = ${tags.industries[0] ?? null},
                "solutionPillar" = ${tags.solutionPillars[0] ?? null},
                persona = ${tags.buyerPersonas[0] ?? null},
                "funnelStage" = ${tags.funnelStages[0] ?? null},
                "contentType" = ${tags.contentType},
                "classificationJson" = ${JSON.stringify(tags)},
                "reviewStatus" = 'needs_correction',
                "needsReReview" = false,
                "updatedAt" = NOW()
              WHERE id = ${slideId}
            `;
          }
          return c.json({ success: true });
        },
      }),

      // POST /slides/:id/similar -- Find similar slides by vector cosine distance
      registerApiRoute("/slides/:id/similar", {
        method: "POST",
        handler: async (c) => {
          const slideId = c.req.param("id");
          const body = await c.req.json();
          const limit = body.limit ?? 10;

          const sourceRows = await prisma.$queryRaw<Array<{ embedding: string }>>`
            SELECT embedding::text FROM "SlideEmbedding" WHERE id = ${slideId}
          `;
          if (sourceRows.length === 0) {
            return c.json({ error: "Slide not found" }, 404);
          }
          const embedding = sourceRows[0].embedding;

          const similar = await prisma.$queryRaw`
            SELECT id, "templateId", "slideIndex", "slideObjectId",
                   "contentText", "classificationJson", confidence, "reviewStatus",
                   1 - (embedding <=> ${embedding}::vector) AS similarity
            FROM "SlideEmbedding"
            WHERE archived = false
              AND id != ${slideId}
            ORDER BY embedding <=> ${embedding}::vector
            LIMIT ${limit}
          `;
          return c.json({ results: similar });
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Phase 22: Google Token Storage
      // ────────────────────────────────────────────────────────────

      registerApiRoute("/tokens", {
        method: "POST",
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const data = z
              .object({
                userId: z.string().min(1),
                email: z.string().email(),
                refreshToken: z.string().min(1),
              })
              .parse(body);

            const { encrypted, iv, authTag } = encryptToken(data.refreshToken);

            const token = await prisma.userGoogleToken.upsert({
              where: { userId: data.userId },
              update: {
                encryptedRefresh: encrypted,
                iv,
                authTag,
                email: data.email,
                isValid: true,
                revokedAt: null,
                lastUsedAt: new Date(),
              },
              create: {
                userId: data.userId,
                email: data.email,
                encryptedRefresh: encrypted,
                iv,
                authTag,
              },
            });

            // CRITICAL: Clear in-memory failure tracking for this user.
            // Without this, a previous doRefresh failure's cooldown timer
            // would carry over and prematurely invalidate the freshly stored token.
            resetTokenState(data.userId);

            // Auto-resolve any reauth_needed actions for this user
            await prisma.actionRequired.updateMany({
              where: {
                userId: data.userId,
                actionType: "reauth_needed",
                resolved: false,
              },
              data: { resolved: true, resolvedAt: new Date() },
            }).catch(() => {}); // fire and forget

            // Re-queue templates with failed ingestion so they auto-retry
            try {
              const failedTemplates = await prisma.template.findMany({
                where: { ingestionStatus: "failed" },
                select: { id: true, name: true },
              });
              for (const t of failedTemplates) {
                ingestionQueue.enqueue(t.id);
                console.log(`[tokens] Re-queued failed template "${t.name}" after Google reconnect`);
              }
            } catch { /* non-critical */ }

            // NOTE: AtlusAI access detection removed from here.
            // detectAtlusAccess requires an AtlusAI access token, NOT a Google refresh token.
            // AtlusAI detection should happen via the dedicated /atlus/detect endpoint
            // or the AtlusAI OAuth flow (/auth/atlus/connect -> /auth/atlus/callback).

            return c.json({ success: true, tokenId: token.id });
          } catch (err) {
            if (err instanceof z.ZodError) {
              return c.json({ error: "Invalid request body", details: err.issues }, 400);
            }
            console.error("[tokens] Failed to store token:", err);
            return c.json(
              { error: "Failed to store token" },
              500
            );
          }
        },
      }),

      registerApiRoute("/tokens/check/:userId", {
        method: "GET",
        handler: async (c) => {
          const userId = c.req.param("userId");
          const token = await prisma.userGoogleToken.findUnique({
            where: { userId },
            select: { isValid: true },
          });
          return c.json({ hasToken: !!token?.isValid });
        },
      }),

      // GET /tokens/access/:userId -- Get a fresh Google access token for a specific user
      registerApiRoute("/tokens/access/:userId", {
        method: "GET",
        handler: async (c) => {
          const userId = c.req.param("userId");
          try {
            const accessToken = await getAccessTokenForUser(userId);
            if (!accessToken) {
              return c.json({ error: "No valid token for user" }, 404);
            }
            return c.json({ accessToken });
          } catch (err) {
            console.error(`[tokens/access] Failed for user ${userId}:`, err);
            return c.json({ error: "Failed to get access token" }, 500);
          }
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Phase 47: UserSetting CRUD Routes
      // ────────────────────────────────────────────────────────────

      // GET /user-settings/:userId/:key -- Read a single user setting
      registerApiRoute("/user-settings/:userId/:key", {
        method: "GET",
        handler: async (c) => {
          const userId = c.req.param("userId");
          const key = c.req.param("key");
          const setting = await prisma.userSetting.findUnique({
            where: { userId_key: { userId, key } },
          });
          return c.json({ value: setting?.value ?? null });
        },
      }),

      // PUT /user-settings/:userId/:key -- Upsert a single user setting
      registerApiRoute("/user-settings/:userId/:key", {
        method: "PUT",
        handler: async (c) => {
          const userId = c.req.param("userId");
          const key = c.req.param("key");
          const body = await c.req.json();
          const value = String(body.value);
          await prisma.userSetting.upsert({
            where: { userId_key: { userId, key } },
            create: { userId, key, value },
            update: { value },
          });
          return c.json({ success: true });
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Phase 24: ActionRequired CRUD Routes
      // ────────────────────────────────────────────────────────────

      // GET /actions -- List pending (unresolved) actions, ordered by updatedAt desc
      // so re-surfaced items appear at top
      registerApiRoute("/actions", {
        method: "GET",
        handler: async (c) => {
          const userId = c.req.query("userId");
          const where: Record<string, unknown> = { resolved: false };
          if (userId) where.userId = userId;
          const actions = await prisma.actionRequired.findMany({
            where,
            orderBy: { updatedAt: "desc" },
          });
          return c.json(actions);
        },
      }),

      // GET /actions/count -- Return count of unresolved, non-silenced actions (badge count)
      registerApiRoute("/actions/count", {
        method: "GET",
        handler: async (c) => {
          const userId = c.req.query("userId");
          const where: Record<string, unknown> = { resolved: false, silenced: false };
          if (userId) where.userId = userId;
          const count = await prisma.actionRequired.count({ where });
          return c.json({ count });
        },
      }),

      // PATCH /actions/:id/resolve -- Mark an action as resolved
      registerApiRoute("/actions/:id/resolve", {
        method: "PATCH",
        handler: async (c) => {
          const id = c.req.param("id");
          const action = await prisma.actionRequired.update({
            where: { id },
            data: { resolved: true, resolvedAt: new Date() },
          });
          return c.json(action);
        },
      }),

      // PATCH /actions/:id/silence -- Silence an action (hide from badge count)
      registerApiRoute("/actions/:id/silence", {
        method: "PATCH",
        handler: async (c) => {
          const id = c.req.param("id");
          const action = await prisma.actionRequired.update({
            where: { id },
            data: { silenced: true, seenAt: new Date() },
          });
          return c.json(action);
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Phase 27: AtlusAI Access Detection
      // ────────────────────────────────────────────────────────────

      // POST /atlus/oauth/store-token -- Store AtlusAI OAuth tokens after web OAuth flow
      registerApiRoute("/atlus/oauth/store-token", {
        method: "POST",
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const data = z
              .object({
                userId: z.string().min(1),
                email: z.string().email(),
                accessToken: z.string().min(1),
                refreshToken: z.string().optional(),
              })
              .parse(body);

            // Store the OAuth tokens as JSON (encrypted at rest)
            const tokenPayload = JSON.stringify({
              access_token: data.accessToken,
              refresh_token: data.refreshToken ?? null,
            });
            await upsertAtlusToken(data.userId, data.email, tokenPayload);

            // OAuth success means the user has an AtlusAI account — auto-resolve
            await resolveActionsByType(
              data.userId,
              ACTION_TYPES.ATLUS_ACCOUNT_REQUIRED,
            );

            // Run access detection with the new token to check project access
            const accessResult = await detectAtlusAccess(
              data.userId,
              data.email,
              data.accessToken,
            );

            // Re-initialize MCP now that we have a token in the pool.
            // This clears fallbackMode so isMcpAvailable() returns true
            // without requiring an agent restart.
            if (accessResult === "full_access") {
              initMcp().catch((err) =>
                console.warn("[atlus-oauth] MCP re-init after token store failed:", err),
              );
            }

            return c.json({ success: true, accessResult });
          } catch (err) {
            if (err instanceof z.ZodError) {
              return c.json(
                { error: "Invalid request body", details: err.issues },
                400,
              );
            }
            console.error(
              "[atlus-oauth] Failed to store AtlusAI OAuth tokens:",
              err,
            );
            return c.json({ error: "Failed to store OAuth tokens" }, 500);
          }
        },
      }),

      // POST /atlus/detect -- On-demand AtlusAI access re-check
      registerApiRoute("/atlus/detect", {
        method: "POST",
        handler: async (c) => {
          const body = await c.req.json();
          const data = z
            .object({
              userId: z.string().min(1),
              email: z.string().email(),
              googleAccessToken: z.string().min(1),
            })
            .parse(body);
          const result = await detectAtlusAccess(
            data.userId,
            data.email,
            data.googleAccessToken,
          );
          return c.json({ result });
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Phase 29: Discovery UI Endpoints
      // ────────────────────────────────────────────────────────────

      // GET /discovery/access-check -- Check if AtlusAI is available
      registerApiRoute("/discovery/access-check", {
        method: "GET",
        handler: async (c) => {
          try {
            if (env.ATLUS_USE_MCP === "false") {
              return c.json({ hasAccess: false, reason: "disabled" });
            }

            if (!isMcpAvailable()) {
              // Check if there are tokens at all
              const auth = await getPooledAtlusAuth();
              if (!auth) {
                return c.json({ hasAccess: false, reason: "no_tokens" });
              }
              return c.json({ hasAccess: false, reason: "mcp_unavailable" });
            }

            return c.json({ hasAccess: true });
          } catch (err) {
            console.error("[discovery/access-check] Error:", err);
            return c.json({ hasAccess: false, reason: "mcp_unavailable" });
          }
        },
      }),

      // GET /discovery/browse -- Browse AtlusAI document inventory
      registerApiRoute("/discovery/browse", {
        method: "GET",
        handler: async (c) => {
          try {
            if (!isMcpAvailable()) {
              return c.json(
                { documents: [], error: "MCP not available" },
                503,
              );
            }

            const cursor = c.req.query("cursor") || undefined;
            const limit = parseInt(c.req.query("limit") || "20", 10);
            const debug = c.req.query("debug") === "1";

            const args: Record<string, unknown> = { limit };
            if (env.ATLUS_PROJECT_ID) {
              args.aiProjectId = env.ATLUS_PROJECT_ID;
            }
            if (cursor) {
              args.offset = parseInt(cursor, 10);
            }
            // Filter to Google Drive docs with successful ingestion only
            args.preFilters = {
              condition: "and",
              filters: [
                { key: "source", operator: "==", value: "google-drive" },
                { key: "ingest_status", operator: "==", value: "SUCCESS" },
              ],
            };

            let rawResult: unknown;
            try {
              rawResult = await callMcpTool("discover_documents", args);
            } catch (callErr) {
              console.error("[discovery/browse] callMcpTool threw:", callErr);
              return c.json({ documents: [], error: String(callErr), _debug: debug ? { stage: "callMcpTool", err: String(callErr) } : undefined }, 500);
            }

            if (debug) {
              return c.json({
                _debug: {
                  rawResultType: typeof rawResult,
                  rawResultPreview: JSON.stringify(rawResult)?.substring(0, 2000),
                  isNull: rawResult === null,
                  isUndefined: rawResult === undefined,
                  isArray: Array.isArray(rawResult),
                  args,
                },
              });
            }

            // Query already-ingested presentation IDs from Template table
            const ingestedTemplates = await prisma.template.findMany({
              select: { presentationId: true },
            });
            const ingestedHashes = ingestedTemplates.map((t) => t.presentationId);

            // Parse raw MCP result — discover_documents returns { text, total }
            // where text is a formatted string with document blocks separated by "=============="
            let documents: unknown[] = [];
            let nextCursor: string | undefined;
            let totalDocuments: number | undefined;

            if (rawResult && typeof rawResult === "object") {
              const rawObj = rawResult as Record<string, unknown>;

              if (typeof rawObj.total === "number") {
                totalDocuments = rawObj.total;
              }

              // Text format: parse document blocks from formatted string
              if (typeof rawObj.text === "string" && rawObj.text.length > 0) {
                // Strip the "Showing X of Y..." header line before splitting
                const textBody = rawObj.text.replace(/^Showing \d+ of \d+[^\n]*\n*/m, "");
                const blocks = textBody.split(/={10,}/);
                for (const block of blocks) {
                  const trimmed = block.trim();
                  if (!trimmed) continue;

                  // Extract fields from the text block
                  const idMatch = trimmed.match(/ID:\s*(.+)/);
                  const urlMatch = trimmed.match(/URL:\s*(.+)/);
                  const statusMatch = trimmed.match(/Ingestion Status:\s*(.+)/);
                  const createdMatch = trimmed.match(/Created At:\s*(.+)/);
                  const sourceMatch = trimmed.match(/source:\s*(.+)/);
                  const pathMatch = trimmed.match(/path:\s*(.+)/);
                  const channelMatch = trimmed.match(/channelName:\s*(.+)/);
                  const dateMatch = trimmed.match(/date:\s*(.+)/);

                  if (!idMatch) continue;

                  const ingestionStatus = statusMatch?.[1]?.trim();

                  const url = urlMatch?.[1]?.trim() ?? "";
                  const path = pathMatch?.[1]?.trim() ?? "";
                  const channel = channelMatch?.[1]?.trim() ?? "";
                  const source = sourceMatch?.[1]?.trim() ?? "unknown";

                  // Derive a human-readable title
                  let title = path
                    ? path.split("/").pop() ?? path
                    : channel
                      ? `#${channel}`
                      : url;

                  documents.push({
                    slideId: idMatch[1].trim(),
                    documentTitle: title,
                    textContent: trimmed,
                    speakerNotes: "",
                    source,
                    metadata: {
                      id: idMatch[1]?.trim(),
                      url,
                      ingestionStatus,
                      createdAt: createdMatch?.[1]?.trim(),
                      date: dateMatch?.[1]?.trim(),
                      source,
                      path,
                      channelName: channel || undefined,
                    },
                  });
                }

                // Calculate next cursor for pagination
                const offset = cursor ? parseInt(cursor, 10) : 0;
                if (totalDocuments && offset + limit < totalDocuments) {
                  nextCursor = String(offset + limit);
                }
              } else if (Array.isArray(rawObj.documents)) {
                // Structured format (future-proofing)
                documents = rawObj.documents;
              }
            } else if (typeof rawResult === "string" && rawResult.length > 0) {
              documents = [{ textContent: rawResult, source: "mcp" }];
            }

            // Enrich documents with Drive MIME type to detect Google Slides
            const googleAuth = await extractGoogleAuth(c, await getVerifiedUserId(c, env.SUPABASE_URL));
            console.log(`[discovery/browse] Google auth: hasToken=${!!googleAuth.accessToken}, userId=${googleAuth.userId ?? "none"}, docs=${documents.length}`);
            await enrichDocsWithDriveMetadata(documents as Record<string, unknown>[], googleAuth);

            // Template cross-reference: attach templateData for documents with matching templates
            const typedDocs = documents as Record<string, unknown>[];
            const presentationIds = typedDocs
              .map((d) => String(d.presentationId ?? ""))
              .filter(Boolean);

            if (presentationIds.length > 0) {
              const matchingTemplates = await prisma.template.findMany({
                where: { presentationId: { in: presentationIds } },
                select: {
                  presentationId: true,
                  ingestionStatus: true,
                  lastIngestedAt: true,
                  sourceModifiedAt: true,
                  slideCount: true,
                  ingestionProgress: true,
                  accessStatus: true,
                },
              });
              const templateMap = new Map(
                matchingTemplates.map((t) => [t.presentationId, t]),
              );

              for (const doc of typedDocs) {
                const pid = String(doc.presentationId ?? "");
                const tmpl = templateMap.get(pid);
                if (tmpl) {
                  doc.templateData = {
                    ingestionStatus: tmpl.ingestionStatus,
                    lastIngestedAt: tmpl.lastIngestedAt?.toISOString() ?? null,
                    sourceModifiedAt: tmpl.sourceModifiedAt?.toISOString() ?? null,
                    slideCount: tmpl.slideCount,
                    ingestionProgress: tmpl.ingestionProgress
                      ? (typeof tmpl.ingestionProgress === "string"
                          ? JSON.parse(tmpl.ingestionProgress)?.current
                          : undefined)
                      : undefined,
                    accessStatus: tmpl.accessStatus,
                  };
                }
              }
            }

            // Cover thumbnail enrichment: check GCS for existing covers, fire background cache for missing
            for (const doc of typedDocs) {
              const pid = String(doc.presentationId ?? "");
              const mime = String(doc.mimeType ?? "");
              if (!pid) continue;

              try {
                const cachedUrl = await checkGcsCoverExists(pid);
                if (cachedUrl) {
                  doc.thumbnailUrl = cachedUrl;
                } else if (mime) {
                  // Fire background caching (non-blocking)
                  void cacheDocumentCover(pid, mime, googleAuth);
                }
              } catch {
                // Non-blocking — skip thumbnail on error
              }
            }

            return c.json({ documents, nextCursor, totalDocuments, ingestedHashes });
          } catch (err) {
            console.error("[discovery/browse] Error:", err);
            return c.json(
              { documents: [], error: String(err) },
              500,
            );
          }
        },
      }),

      // POST /discovery/search -- Semantic search via MCP
      registerApiRoute("/discovery/search", {
        method: "POST",
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const data = z
              .object({ query: z.string().min(1) })
              .parse(body);

            const results = await searchSlides({
              query: data.query,
              limit: 30,
            });

            // Enrich results with Drive MIME type to detect Google Slides
            const googleAuth = await extractGoogleAuth(c, await getVerifiedUserId(c, env.SUPABASE_URL));
            await enrichDocsWithDriveMetadata(results as unknown as Record<string, unknown>[], googleAuth);

            // Template cross-reference: attach templateData for results with matching templates
            const typedResults = results as unknown as Record<string, unknown>[];
            const searchPresentationIds = typedResults
              .map((d) => String(d.presentationId ?? ""))
              .filter(Boolean);

            if (searchPresentationIds.length > 0) {
              const matchingTemplates = await prisma.template.findMany({
                where: { presentationId: { in: searchPresentationIds } },
                select: {
                  presentationId: true,
                  ingestionStatus: true,
                  lastIngestedAt: true,
                  sourceModifiedAt: true,
                  slideCount: true,
                  ingestionProgress: true,
                  accessStatus: true,
                },
              });
              const templateMap = new Map(
                matchingTemplates.map((t) => [t.presentationId, t]),
              );

              for (const doc of typedResults) {
                const pid = String(doc.presentationId ?? "");
                const tmpl = templateMap.get(pid);
                if (tmpl) {
                  doc.templateData = {
                    ingestionStatus: tmpl.ingestionStatus,
                    lastIngestedAt: tmpl.lastIngestedAt?.toISOString() ?? null,
                    sourceModifiedAt: tmpl.sourceModifiedAt?.toISOString() ?? null,
                    slideCount: tmpl.slideCount,
                    ingestionProgress: tmpl.ingestionProgress
                      ? (typeof tmpl.ingestionProgress === "string"
                          ? JSON.parse(tmpl.ingestionProgress)?.current
                          : undefined)
                      : undefined,
                    accessStatus: tmpl.accessStatus,
                  };
                }
              }
            }

            // Cover thumbnail enrichment for search results
            for (const doc of typedResults) {
              const pid = String(doc.presentationId ?? "");
              const mime = String(doc.mimeType ?? "");
              if (!pid) continue;

              try {
                const cachedUrl = await checkGcsCoverExists(pid);
                if (cachedUrl) {
                  doc.thumbnailUrl = cachedUrl;
                } else if (mime) {
                  void cacheDocumentCover(pid, mime, googleAuth);
                }
              } catch {
                // Non-blocking
              }
            }

            // Query already-ingested presentation IDs from Template table
            const ingestedTemplates = await prisma.template.findMany({
              select: { presentationId: true },
            });
            const ingestedHashes = ingestedTemplates.map((t) => t.presentationId);

            return c.json({ results, ingestedHashes });
          } catch (err) {
            if (err instanceof z.ZodError) {
              return c.json(
                { error: "Invalid request body", details: err.issues },
                400,
              );
            }
            console.error("[discovery/search] Error:", err);
            return c.json(
              { results: [], error: String(err) },
              500,
            );
          }
        },
      }),

      // POST /discovery/ingest -- Create Template records and trigger ingestion for Google Slides
      registerApiRoute("/discovery/ingest", {
        method: "POST",
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const data = z
              .object({
                items: z.array(
                  z.object({
                    slideId: z.string(),
                    documentTitle: z.string(),
                    textContent: z.string(),
                    speakerNotes: z.string().default(""),
                    presentationId: z.string().min(1),
                    googleSlidesUrl: z.string().url(),
                    metadata: z.record(z.string(), z.unknown()).default({}),
                  }),
                ),
              })
              .parse(body);

            const batchId = crypto.randomUUID();

            // Initialize batch tracking
            const batchItems = new Map<
              string,
              { status: string; error?: string }
            >();
            for (const item of data.items) {
              batchItems.set(item.slideId, { status: "pending" });
            }
            discoveryBatches.set(batchId, batchItems);

            // Fire and forget -- process asynchronously
            void (async () => {
              for (const item of data.items) {
                try {
                  batchItems.set(item.slideId, { status: "ingesting" });

                  // Check if Template already exists for this presentationId
                  const existing = await prisma.template.findUnique({
                    where: { presentationId: item.presentationId },
                    select: { id: true, ingestionStatus: true },
                  });
                  if (existing) {
                    // Duplicate guard: reject items already ingesting or queued
                    if (
                      existing.ingestionStatus === "ingesting" ||
                      existing.ingestionStatus === "queued"
                    ) {
                      batchItems.set(item.slideId, {
                        status: "skipped",
                        error: "Already ingesting",
                      });
                      continue;
                    }
                    // Template exists but idle — allow re-ingestion
                    if (existing.ingestionStatus === "idle") {
                      await prisma.template.update({
                        where: { id: existing.id },
                        data: { ingestionStatus: "queued" },
                      });
                      ingestionQueue.enqueue(existing.id);
                      batchItems.set(item.slideId, { status: "done" });
                      continue;
                    }
                    // Other states (failed, etc.) — mark as done, template already exists
                    batchItems.set(item.slideId, { status: "done" });
                    continue;
                  }

                  // Check Drive access using pooled auth
                  let accessStatus = "not_checked";
                  let sourceModifiedAt: Date | null = null;
                  let templateName = item.documentTitle || "Untitled Presentation";

                  try {
                    const { accessToken } = await getPooledGoogleAuth();
                    const drive = getDriveClient(accessToken ? { accessToken } : undefined);
                    const fileRes = await drive.files.get({
                      fileId: item.presentationId,
                      fields: "id,name,modifiedTime",
                      supportsAllDrives: true,
                    });
                    accessStatus = "accessible";
                    templateName = fileRes.data.name || templateName;
                    if (fileRes.data.modifiedTime) {
                      sourceModifiedAt = new Date(fileRes.data.modifiedTime);
                    }
                  } catch (driveErr: unknown) {
                    const errCode =
                      driveErr &&
                      typeof driveErr === "object" &&
                      "code" in driveErr
                        ? (driveErr as { code: number }).code
                        : 0;
                    if (errCode === 403 || errCode === 404) {
                      accessStatus = "not_accessible";
                    } else {
                      throw driveErr;
                    }
                  }

                  // Create Template record (same as POST /templates flow)
                  const template = await prisma.template.create({
                    data: {
                      name: templateName,
                      googleSlidesUrl: item.googleSlidesUrl,
                      presentationId: item.presentationId,
                      touchTypes: JSON.stringify([]),
                      accessStatus,
                      sourceModifiedAt,
                    },
                  });

                  // Auto-trigger ingestion if accessible (same as Templates page flow)
                  if (accessStatus === "accessible") {
                    await prisma.template.update({
                      where: { id: template.id },
                      data: { ingestionStatus: "queued" },
                    });
                    ingestionQueue.enqueue(template.id);
                  }

                  batchItems.set(item.slideId, { status: "done" });
                } catch (err) {
                  console.error(
                    `[discovery/ingest] Failed to ingest ${item.slideId}:`,
                    err,
                  );
                  batchItems.set(item.slideId, {
                    status: "error",
                    error: String(err),
                  });
                }
              }
            })();

            return c.json({ batchId });
          } catch (err) {
            if (err instanceof z.ZodError) {
              return c.json(
                { error: "Invalid request body", details: err.issues },
                400,
              );
            }
            console.error("[discovery/ingest] Error:", err);
            return c.json({ error: "Ingestion failed" }, 500);
          }
        },
      }),

      // GET /discovery/ingest/:batchId/progress -- Poll ingestion progress
      registerApiRoute("/discovery/ingest/:batchId/progress", {
        method: "GET",
        handler: async (c) => {
          const batchId = c.req.param("batchId");
          const batch = discoveryBatches.get(batchId);

          if (!batch) {
            return c.json({ error: "Batch not found" }, 404);
          }

          const items = Array.from(batch.entries()).map(([id, state]) => ({
            id,
            status: state.status,
            ...(state.error ? { error: state.error } : {}),
          }));

          const complete = items.every(
            (i) => i.status === "done" || i.status === "error",
          );

          return c.json({ items, complete });
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Phase 34: Deck Intelligence — Structure Inference Endpoints
      // ────────────────────────────────────────────────────────────

      // GET /deck-structures -- Returns all DeckStructure records (one per touch type)
      registerApiRoute("/deck-structures", {
        method: "GET",
        handler: async (c) => {
          const keys = getDeckStructureListKeys();
          const records = await prisma.deckStructure.findMany({
            where: {
              OR: keys.map((key) => ({
                touchType: key.touchType,
                artifactType: key.artifactType,
              })),
            },
            orderBy: { touchType: "asc" },
          });

          const byKey = new Map(
            records.map((r) => [`${r.touchType}:${r.artifactType ?? "null"}`, r]),
          );

          const results = keys.map((key) => {
            const record = byKey.get(`${key.touchType}:${key.artifactType ?? "null"}`);
            if (record) {
              const conf = calculateConfidence(record.exampleCount);
              return {
                id: record.id,
                touchType: record.touchType,
                artifactType: key.artifactType,
                exampleCount: record.exampleCount,
                confidence: record.confidence,
                confidenceColor: conf.color,
                confidenceLabel: conf.label,
                sectionCount: (() => {
                  try {
                    const parsed = JSON.parse(record.structureJson) as { sections?: unknown[] };
                    return parsed.sections?.length ?? 0;
                  } catch {
                    return 0;
                  }
                })(),
                inferredAt: record.inferredAt,
                lastChatAt: record.lastChatAt,
                updatedAt: record.updatedAt,
              };
            }
            return {
              id: null,
              touchType: key.touchType,
              artifactType: key.artifactType,
              exampleCount: 0,
              confidence: 0,
              confidenceColor: "red" as const,
              confidenceLabel: "No examples",
              sectionCount: 0,
              inferredAt: null,
              lastChatAt: null,
              updatedAt: null,
            };
          });

          return c.json(results);
        },
      }),

      // GET /deck-structures/:touchType -- Returns single DeckStructure with parsed structure and chat messages
      registerApiRoute("/deck-structures/:touchType", {
        method: "GET",
        handler: async (c) => {
          const touchType = c.req.param("touchType");
          const query = deckStructureArtifactQuerySchema.parse(c.req.query());

          let key;
          try {
            key = resolveDeckStructureKey(touchType, query.artifactType ?? null);
          } catch (error) {
            return c.json(
              { error: error instanceof Error ? error.message : "Invalid deck structure key" },
              400,
            );
          }

          if (isUnsupportedGenericTouch4(key.touchType, key.artifactType)) {
            const conf = calculateConfidence(0);
            return c.json({
              touchType: key.touchType,
              artifactType: key.artifactType,
              structure: buildEmptyDeckStructureOutput(
                key.touchType,
                GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
              ),
              exampleCount: 0,
              confidence: 0,
              confidenceColor: conf.color,
              confidenceLabel: conf.label,
              chatMessages: [],
              chatContext: null,
              slideIdToThumbnail: {},
              inferredAt: null,
              lastChatAt: null,
            });
          }

          const record = await prisma.deckStructure.findFirst({
            where: {
              touchType: key.touchType,
              artifactType: key.artifactType,
            },
            include: {
              chatMessages: {
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
          });

          if (!record) {
            const conf = calculateConfidence(0);
            return c.json({
              touchType: key.touchType,
              artifactType: key.artifactType,
              structure: { sections: [], sequenceRationale: "" },
              exampleCount: 0,
              confidence: 0,
              confidenceColor: conf.color,
              confidenceLabel: conf.label,
              chatMessages: [],
              chatContext: null,
              slideIdToThumbnail: {},
              inferredAt: null,
              lastChatAt: null,
            });
          }

          const conf = calculateConfidence(record.exampleCount);
          let structure: { sections?: Array<{ slideIds?: string[] }>; sequenceRationale?: string };
          try {
            structure = JSON.parse(record.structureJson);
          } catch {
            structure = { sections: [], sequenceRationale: "" };
          }

          // Resolve slide IDs to thumbnail URLs
          const allSlideIds = (structure.sections ?? []).flatMap((s) => s.slideIds ?? []);
          const slideIdToThumbnail: Record<string, string> = {};
          if (allSlideIds.length > 0) {
            const slides = await prisma.slideEmbedding.findMany({
              where: { id: { in: allSlideIds }, archived: false },
              select: { id: true, thumbnailUrl: true },
            });
            for (const slide of slides) {
              if (slide.thumbnailUrl) {
                slideIdToThumbnail[slide.id] = slide.thumbnailUrl;
              }
            }
          }

          let chatContext: unknown = null;
          if (record.chatContextJson) {
            try { chatContext = JSON.parse(record.chatContextJson); } catch { chatContext = null; }
          }

          return c.json({
            touchType: record.touchType,
            artifactType: record.artifactType,
            structure,
            exampleCount: record.exampleCount,
            confidence: record.confidence,
            confidenceColor: conf.color,
            confidenceLabel: conf.label,
            chatMessages: record.chatMessages.reverse(), // chronological order
            chatContext,
            slideIdToThumbnail,
            inferredAt: record.inferredAt,
            lastChatAt: record.lastChatAt,
          });
        },
      }),

      // POST /deck-structures/:touchType/infer -- Manually trigger re-inference
      registerApiRoute("/deck-structures/:touchType/infer", {
        method: "POST",
        handler: async (c) => {
          const touchType = c.req.param("touchType");
          const query = deckStructureArtifactQuerySchema.parse(c.req.query());

          let key;
          try {
            key = resolveDeckStructureKey(touchType, query.artifactType ?? null);
          } catch (error) {
            return c.json(
              { error: error instanceof Error ? error.message : "Invalid deck structure key" },
              400,
            );
          }

          if (isUnsupportedGenericTouch4(key.touchType, key.artifactType)) {
            const conf = calculateConfidence(0);
            return c.json({
              touchType: key.touchType,
              artifactType: key.artifactType,
              structure: buildEmptyDeckStructureOutput(
                key.touchType,
                GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
              ),
              confidence: conf.score,
              confidenceColor: conf.color,
              confidenceLabel: conf.label,
            });
          }

          // Load existing chat constraints if any
          const existing = await prisma.deckStructure.findFirst({
            where: {
              touchType: key.touchType,
              artifactType: key.artifactType,
            },
            select: { chatContextJson: true },
          });

          try {
            const result = await inferDeckStructure(key, existing?.chatContextJson ?? undefined);

            const conf = calculateConfidence(
              (await prisma.deckStructure.findFirst({
                where: {
                  touchType: key.touchType,
                  artifactType: key.artifactType,
                },
                select: { exampleCount: true },
              }))?.exampleCount ?? 0,
            );

            return c.json({
              touchType: key.touchType,
              artifactType: key.artifactType,
              structure: result,
              confidence: conf.score,
              confidenceColor: conf.color,
              confidenceLabel: conf.label,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[deck-structures] Inference failed for ${touchType}: ${message}`);
            return c.json({ error: "Inference failed", details: message }, 500);
          }
        },
      }),

      // POST /deck-structures/:touchType/chat -- Streaming chat refinement
      // Custom Mastra API routes are mounted at the service root, not under /api.
      registerApiRoute("/deck-structures/:touchType/chat", {
        method: "POST",
        handler: async (c) => {
          const touchType = c.req.param("touchType");
          const query = deckStructureArtifactQuerySchema.parse(c.req.query());
          const body = await c.req.json<{ message: string }>();

          let key;
          try {
            key = resolveDeckStructureKey(touchType, query.artifactType ?? null);
          } catch (error) {
            return c.json(
              { error: error instanceof Error ? error.message : "Invalid deck structure key" },
              400,
            );
          }

          if (!body.message?.trim()) {
            return c.json({ error: "Message is required" }, 400);
          }

          // Use ReadableStream for streaming response
          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              try {
                const result = await streamChatRefinement(
                  key.touchType,
                  body.message.trim(),
                  (chunk) => {
                    controller.enqueue(encoder.encode(chunk));
                  },
                  key.artifactType,
                );

                // Write delimiter and structure update payload
                controller.enqueue(
                  encoder.encode("\n---STRUCTURE_UPDATE---\n"),
                );
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      updatedStructure: result.updatedStructure,
                      diff: result.diff,
                    }),
                  ),
                );

                controller.close();
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[deck-chat] Chat failed for ${touchType}: ${message}`);
                controller.enqueue(
                  encoder.encode(`\n[Error: ${message}]`),
                );
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Transfer-Encoding": "chunked",
              "Cache-Control": "no-cache",
            },
          });
        },
      }),

      // DELETE /deck-structures/:touchType/memories -- Clear all chat context and messages
      registerApiRoute("/deck-structures/:touchType/memories", {
        method: "DELETE",
        handler: async (c) => {
          const touchType = c.req.param("touchType");
          const query = deckStructureArtifactQuerySchema.parse(c.req.query());

          let key;
          try {
            key = resolveDeckStructureKey(touchType, query.artifactType ?? null);
          } catch (error) {
            return c.json(
              { error: error instanceof Error ? error.message : "Invalid deck structure key" },
              400,
            );
          }

          const record = await prisma.deckStructure.findFirst({
            where: {
              touchType: key.touchType,
              artifactType: key.artifactType,
            },
          });

          if (!record) {
            return c.json({ error: "Deck structure not found" }, 404);
          }

          await prisma.$transaction([
            prisma.deckChatMessage.deleteMany({
              where: { deckStructureId: record.id },
            }),
            prisma.deckStructure.update({
              where: { id: record.id },
              data: { chatContextJson: null, lastChatAt: null },
            }),
          ]);

          // Re-fetch updated record with empty messages
          const updated = await prisma.deckStructure.findFirst({
            where: { id: record.id },
            include: {
              chatMessages: {
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
          });

          if (!updated) {
            return c.json({ error: "Deck structure not found after update" }, 500);
          }

          const conf = calculateConfidence(updated.exampleCount);
          let structure: { sections?: unknown[]; sequenceRationale?: string };
          try {
            structure = JSON.parse(updated.structureJson);
          } catch {
            structure = { sections: [], sequenceRationale: "" };
          }

          return c.json({
            touchType: updated.touchType,
            artifactType: updated.artifactType,
            structure,
            exampleCount: updated.exampleCount,
            confidence: updated.confidence,
            confidenceColor: conf.color,
            confidenceLabel: conf.label,
            chatMessages: updated.chatMessages.reverse(),
            chatContext: null,
            slideIdToThumbnail: {},
            inferredAt: updated.inferredAt,
            lastChatAt: updated.lastChatAt,
          });
        },
      }),

      // DELETE /deck-structures/:touchType/messages/:messageId -- Delete a single chat message
      registerApiRoute("/deck-structures/:touchType/messages/:messageId", {
        method: "DELETE",
        handler: async (c) => {
          const messageId = c.req.param("messageId");

          try {
            await prisma.deckChatMessage.delete({
              where: { id: messageId },
            });
          } catch (err) {
            const prismaError = err as { code?: string };
            if (prismaError.code === "P2025") {
              return c.json({ error: "Message not found" }, 404);
            }
            throw err;
          }

          return c.json({ success: true });
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Agent Config CRUD (Phase 44)
      // ────────────────────────────────────────────────────────────

      // GET /agent-configs -- List all agent configs with published version info and draft status
      registerApiRoute("/agent-configs", {
        method: "GET",
        handler: async (c) => {
          const configs = await prisma.agentConfig.findMany({
            include: {
              publishedVersion: true,
              versions: { orderBy: { version: "desc" }, take: 1 },
            },
            orderBy: { name: "asc" },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = (configs as any[]).map((cfg: any) => {
            const latestVersion = cfg.versions[0] ?? null;
            const hasDraft = latestVersion ? !latestVersion.isPublished : false;
            return {
              agentId: cfg.agentId,
              name: cfg.name,
              responsibility: cfg.responsibility,
              family: cfg.family,
              isShared: cfg.isShared,
              publishedVersion: cfg.publishedVersion?.version ?? null,
              hasDraft,
              draftVersion: hasDraft ? latestVersion!.version : null,
            };
          });

          return c.json(result);
        },
      }),

      // GET /agent-configs/:agentId -- Get single agent config with published version and latest draft
      registerApiRoute("/agent-configs/:agentId", {
        method: "GET",
        handler: async (c) => {
          const agentId = c.req.param("agentId");
          const config = await prisma.agentConfig.findUnique({
            where: { agentId },
            include: {
              publishedVersion: true,
              versions: { orderBy: { version: "desc" }, take: 1 },
            },
          });

          if (!config) {
            return c.json({ error: "Agent config not found" }, 404);
          }

          const latestVersion = config.versions[0] ?? null;
          const hasDraft = latestVersion ? !latestVersion.isPublished : false;

          return c.json({
            agentId: config.agentId,
            name: config.name,
            responsibility: config.responsibility,
            family: config.family,
            isShared: config.isShared,
            publishedVersion: config.publishedVersion
              ? {
                  id: config.publishedVersion.id,
                  version: config.publishedVersion.version,
                  baselinePrompt: config.publishedVersion.baselinePrompt,
                  rolePrompt: config.publishedVersion.rolePrompt,
                  compiledPrompt: config.publishedVersion.compiledPrompt,
                  changeSummary: config.publishedVersion.changeSummary,
                  publishedAt: config.publishedVersion.publishedAt,
                  publishedBy: config.publishedVersion.publishedBy,
                }
              : null,
            draft: hasDraft
              ? {
                  id: latestVersion!.id,
                  version: latestVersion!.version,
                  rolePrompt: latestVersion!.rolePrompt,
                  createdAt: latestVersion!.createdAt,
                }
              : null,
          });
        },
      }),

      // GET /agent-configs/:agentId/versions -- List all versions for an agent
      registerApiRoute("/agent-configs/:agentId/versions", {
        method: "GET",
        handler: async (c) => {
          const agentId = c.req.param("agentId");
          const config = await prisma.agentConfig.findUnique({
            where: { agentId },
          });
          if (!config) {
            return c.json({ error: "Agent config not found" }, 404);
          }

          const versions = await prisma.agentConfigVersion.findMany({
            where: { agentConfigId: config.id },
            orderBy: { version: "desc" },
            select: {
              id: true,
              version: true,
              rolePrompt: true,
              changeSummary: true,
              isPublished: true,
              publishedAt: true,
              publishedBy: true,
              createdAt: true,
            },
          });

          return c.json(versions);
        },
      }),

      // POST /agent-configs/:agentId/draft -- Create a draft version
      registerApiRoute("/agent-configs/:agentId/draft", {
        method: "POST",
        handler: async (c) => {
          const agentId = c.req.param("agentId");
          const body = await c.req.json();
          const data = z
            .object({
              rolePrompt: z.string().min(1),
              userId: z.string().optional(),
              expectedVersion: z.number().optional(),
            })
            .parse(body);

          const config = await prisma.agentConfig.findUnique({
            where: { agentId },
            include: { publishedVersion: true },
          });
          if (!config) {
            return c.json({ error: "Agent config not found" }, 404);
          }

          // Optimistic locking check
          const lastVersion = await prisma.agentConfigVersion.findFirst({
            where: { agentConfigId: config.id },
            orderBy: { version: "desc" },
          });
          const currentVersion = lastVersion?.version ?? 0;

          if (
            data.expectedVersion !== undefined &&
            data.expectedVersion !== currentVersion
          ) {
            return c.json(
              {
                error: "Version conflict",
                currentVersion,
                expectedVersion: data.expectedVersion,
              },
              409,
            );
          }

          const nextVersion = currentVersion + 1;
          const baseline =
            config.publishedVersion?.baselinePrompt ?? "";
          const compiled = compileAgentInstructions(
            baseline,
            data.rolePrompt,
          );

          const draft = await prisma.agentConfigVersion.create({
            data: {
              agentConfigId: config.id,
              version: nextVersion,
              baselinePrompt: baseline,
              rolePrompt: data.rolePrompt,
              compiledPrompt: compiled.compiledPrompt,
              isPublished: false,
            },
          });

          return c.json(draft);
        },
      }),

      // POST /agent-configs/:agentId/publish -- Publish the latest draft
      registerApiRoute("/agent-configs/:agentId/publish", {
        method: "POST",
        handler: async (c) => {
          const agentId = c.req.param("agentId");
          const body = await c.req.json();
          const data = z
            .object({
              changeSummary: z.string().optional(),
              userId: z.string().optional(),
            })
            .parse(body);

          const config = await prisma.agentConfig.findUnique({
            where: { agentId },
          });
          if (!config) {
            return c.json({ error: "Agent config not found" }, 404);
          }

          const latestDraft = await prisma.agentConfigVersion.findFirst({
            where: { agentConfigId: config.id, isPublished: false },
            orderBy: { version: "desc" },
          });
          if (!latestDraft) {
            return c.json({ error: "No unpublished draft found" }, 404);
          }

          await prisma.agentConfigVersion.update({
            where: { id: latestDraft.id },
            data: {
              isPublished: true,
              publishedAt: new Date(),
              publishedBy: data.userId ?? null,
              changeSummary: data.changeSummary ?? null,
            },
          });

          await prisma.agentConfig.update({
            where: { id: config.id },
            data: { publishedVersionId: latestDraft.id },
          });

          invalidateAgentPromptCache({ agentId });

          const updated = await prisma.agentConfig.findUnique({
            where: { agentId },
            include: { publishedVersion: true },
          });

          return c.json(updated);
        },
      }),

      // POST /agent-configs/:agentId/discard -- Discard the latest draft
      registerApiRoute("/agent-configs/:agentId/discard", {
        method: "POST",
        handler: async (c) => {
          const agentId = c.req.param("agentId");
          const config = await prisma.agentConfig.findUnique({
            where: { agentId },
          });
          if (!config) {
            return c.json({ error: "Agent config not found" }, 404);
          }

          const latestDraft = await prisma.agentConfigVersion.findFirst({
            where: { agentConfigId: config.id, isPublished: false },
            orderBy: { version: "desc" },
          });
          if (!latestDraft) {
            return c.json({ error: "No unpublished draft found" }, 404);
          }

          await prisma.agentConfigVersion.delete({
            where: { id: latestDraft.id },
          });

          return c.json({ success: true });
        },
      }),

      // POST /agent-configs/:agentId/rollback -- Rollback to a specific version
      registerApiRoute("/agent-configs/:agentId/rollback", {
        method: "POST",
        handler: async (c) => {
          const agentId = c.req.param("agentId");
          const body = await c.req.json();
          const data = z
            .object({
              targetVersion: z.number().int().min(1),
              userId: z.string().optional(),
            })
            .parse(body);

          const config = await prisma.agentConfig.findUnique({
            where: { agentId },
            include: { publishedVersion: true },
          });
          if (!config) {
            return c.json({ error: "Agent config not found" }, 404);
          }

          const targetVersionRecord =
            await prisma.agentConfigVersion.findFirst({
              where: {
                agentConfigId: config.id,
                version: data.targetVersion,
              },
            });
          if (!targetVersionRecord) {
            return c.json({ error: "Target version not found" }, 404);
          }

          // Use current published baseline, not the old one
          const currentBaseline =
            config.publishedVersion?.baselinePrompt ?? "";
          const compiled = compileAgentInstructions(
            currentBaseline,
            targetVersionRecord.rolePrompt,
          );

          const lastVersion = await prisma.agentConfigVersion.findFirst({
            where: { agentConfigId: config.id },
            orderBy: { version: "desc" },
          });
          const nextVersion = (lastVersion?.version ?? 0) + 1;

          const newVersion = await prisma.agentConfigVersion.create({
            data: {
              agentConfigId: config.id,
              version: nextVersion,
              baselinePrompt: currentBaseline,
              rolePrompt: targetVersionRecord.rolePrompt,
              compiledPrompt: compiled.compiledPrompt,
              changeSummary: `Rollback to v${data.targetVersion}`,
              isPublished: true,
              publishedAt: new Date(),
              publishedBy: data.userId ?? null,
            },
          });

          await prisma.agentConfig.update({
            where: { id: config.id },
            data: { publishedVersionId: newVersion.id },
          });

          invalidateAgentPromptCache({ agentId });

          return c.json(newVersion);
        },
      }),

      // POST /agent-configs/:agentId/chat -- AI prompt editing assistant
      registerApiRoute("/agent-configs/:agentId/chat", {
        method: "POST",
        handler: async (c) => {
          const agentId = c.req.param("agentId");
          const body = await c.req.json();
          const data = z
            .object({
              message: z.string().min(1),
              currentPrompt: z.string(),
            })
            .parse(body);

          const systemPrompt = `You are a prompt engineering assistant. The user wants to improve an agent's system prompt.

The agent's current role prompt is:
---
${data.currentPrompt}
---

When you suggest changes, output the COMPLETE updated prompt between delimiters \`---PROMPT_UPDATE---\` and \`---END_PROMPT_UPDATE---\`. Outside the delimiters, explain your reasoning. Always include the full prompt text between the delimiters, not just the changed parts.`;

          const ai = createChatProviderClient();

          const stream = await ai.models.generateContentStream({
            model: "gemini-3-flash-preview",
            contents: [
              { role: "user", parts: [{ text: data.message }] },
            ],
            config: {
              systemInstruction: systemPrompt,
            },
          });

          const readableStream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              try {
                for await (const chunk of stream) {
                  const text = chunk.text ?? "";
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                  }
                }
                controller.close();
              } catch (err) {
                controller.error(err);
              }
            },
          });

          return new Response(readableStream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache",
            },
          });
        },
      }),

      // POST /agent-configs/baseline/draft -- Save a baseline draft
      registerApiRoute("/agent-configs/baseline/draft", {
        method: "POST",
        handler: async (c) => {
          const body = await c.req.json();
          const data = z
            .object({
              baselinePrompt: z.string().min(1),
              userId: z.string().optional(),
            })
            .parse(body);

          // Ensure shared-baseline config exists
          let config = await prisma.agentConfig.findUnique({
            where: { agentId: "shared-baseline" },
          });
          if (!config) {
            config = await prisma.agentConfig.create({
              data: {
                agentId: "shared-baseline",
                name: "Shared Baseline",
                responsibility: "Global baseline prompt prepended to all agents",
                family: "validation",
                isShared: true,
                touchTypes: "[]",
                status: "active",
              },
            });
          }

          const lastVersion = await prisma.agentConfigVersion.findFirst({
            where: { agentConfigId: config.id },
            orderBy: { version: "desc" },
          });
          const nextVersion = (lastVersion?.version ?? 0) + 1;

          const draft = await prisma.agentConfigVersion.create({
            data: {
              agentConfigId: config.id,
              version: nextVersion,
              baselinePrompt: data.baselinePrompt,
              rolePrompt: data.baselinePrompt,
              compiledPrompt: data.baselinePrompt,
              isPublished: false,
            },
          });

          return c.json(draft);
        },
      }),

      // POST /agent-configs/baseline/publish -- Publish baseline and recompile all agents
      registerApiRoute("/agent-configs/baseline/publish", {
        method: "POST",
        handler: async (c) => {
          const body = await c.req.json();
          const data = z
            .object({
              changeSummary: z.string().optional(),
              userId: z.string().optional(),
            })
            .parse(body);

          const baselineConfig = await prisma.agentConfig.findUnique({
            where: { agentId: "shared-baseline" },
          });
          if (!baselineConfig) {
            return c.json(
              { error: "No shared-baseline config found. Save a baseline draft first." },
              404,
            );
          }

          const latestBaselineDraft =
            await prisma.agentConfigVersion.findFirst({
              where: {
                agentConfigId: baselineConfig.id,
                isPublished: false,
              },
              orderBy: { version: "desc" },
            });
          if (!latestBaselineDraft) {
            return c.json(
              { error: "No unpublished baseline draft found" },
              404,
            );
          }

          const newBaseline = latestBaselineDraft.baselinePrompt;

          // Publish the baseline draft itself
          await prisma.agentConfigVersion.update({
            where: { id: latestBaselineDraft.id },
            data: {
              isPublished: true,
              publishedAt: new Date(),
              publishedBy: data.userId ?? null,
              changeSummary: data.changeSummary ?? "Baseline updated",
            },
          });
          await prisma.agentConfig.update({
            where: { id: baselineConfig.id },
            data: { publishedVersionId: latestBaselineDraft.id },
          });

          // Recompile all agent configs that have a published version
          const allConfigs = await prisma.agentConfig.findMany({
            where: {
              agentId: { not: "shared-baseline" },
              publishedVersionId: { not: null },
            },
            include: { publishedVersion: true },
          });

          let agentsUpdated = 0;
          for (const cfg of allConfigs) {
            if (!cfg.publishedVersion) continue;

            const lastVer = await prisma.agentConfigVersion.findFirst({
              where: { agentConfigId: cfg.id },
              orderBy: { version: "desc" },
            });
            const nextVer = (lastVer?.version ?? 0) + 1;

            const compiled = compileAgentInstructions(
              newBaseline,
              cfg.publishedVersion.rolePrompt,
            );

            const newVer = await prisma.agentConfigVersion.create({
              data: {
                agentConfigId: cfg.id,
                version: nextVer,
                baselinePrompt: newBaseline,
                rolePrompt: cfg.publishedVersion.rolePrompt,
                compiledPrompt: compiled.compiledPrompt,
                changeSummary: `Baseline updated: ${data.changeSummary ?? ""}`.trim(),
                isPublished: true,
                publishedAt: new Date(),
                publishedBy: data.userId ?? null,
              },
            });

            await prisma.agentConfig.update({
              where: { id: cfg.id },
              data: { publishedVersionId: newVer.id },
            });

            agentsUpdated++;
          }

          // Clear entire prompt cache
          invalidateAgentPromptCache();

          return c.json({ agentsUpdated });
        },
      }),

      // ────────────────────────────────────────────────────────────
      // Phase 72: Tutorial Browse
      // ────────────────────────────────────────────────────────────

      registerApiRoute("/tutorials", {
        method: "GET",
        handler: async (c) => {
          const userId = await getVerifiedUserId(c, env.SUPABASE_URL);
          if (!userId) {
            return c.json({ error: "Unauthorized" }, 401);
          }

          // Fixed category metadata in locked order (Phase 72 spec)
          const CATEGORY_META = [
            { key: "getting_started",    label: "Getting Started" },
            { key: "deal_workflows",     label: "Deal Workflows" },
            { key: "touch_points",       label: "Touch Points" },
            { key: "content_management", label: "Content Management" },
            { key: "review",             label: "Review" },
            { key: "settings_admin",     label: "Settings & Admin" },
          ] as const;

          // Fetch tutorials ordered by sortOrder and this user's views
          const [tutorials, views] = await Promise.all([
            prisma.tutorial.findMany({ orderBy: { sortOrder: "asc" } }),
            prisma.tutorialView.findMany({ where: { userId } }),
          ]);

          // Build a watched lookup keyed by tutorialId
          const watchedSet = new Set(
            views.filter((v) => v.watched).map((v) => v.tutorialId),
          );

          // Group tutorials by category key
          const byCategory = new Map<string, typeof tutorials>(
            CATEGORY_META.map((m) => [m.key, []]),
          );
          for (const t of tutorials) {
            byCategory.get(t.category)?.push(t);
          }

          // Build category payloads
          const categories = CATEGORY_META.map((meta) => {
            const catTutorials = byCategory.get(meta.key) ?? [];
            const tutorialCount = catTutorials.length;
            const watchedCount = catTutorials.filter((t) =>
              watchedSet.has(t.id),
            ).length;
            const completionPercent =
              tutorialCount === 0
                ? 0
                : Math.round((watchedCount / tutorialCount) * 100);

            const tutorialCards = catTutorials.map((t) => ({
              id: t.id,
              slug: t.slug,
              title: t.title,
              description: t.description,
              category: t.category,
              durationSec: t.durationSec,
              thumbnailUrl: t.thumbnailUrl ?? null,
              watched: watchedSet.has(t.id),
            }));

            return {
              key: meta.key,
              label: meta.label,
              tutorialCount,
              watchedCount,
              completionPercent,
              tutorials: tutorialCards,
            };
          });

          // Overall stats
          const totalCount = tutorials.length;
          const completedCount = tutorials.filter((t) =>
            watchedSet.has(t.id),
          ).length;
          const overallPercent =
            totalCount === 0
              ? 0
              : Math.round((completedCount / totalCount) * 100);

          return c.json({
            overall: {
              totalCount,
              completedCount,
              completionPercent: overallPercent,
            },
            categories,
          });
        },
      }),
    ],
  },
});

// Start background staleness polling after Mastra is initialized
startStalenessPolling();

// Auto-classify and auto-ingest timer
setTimeout(() => {
  async function runAutoTasks() {
    await autoIngestNewTemplates();
    await autoClassifyTemplates();
  }
  void runAutoTasks();
  setInterval(() => void runAutoTasks(), AUTO_CLASSIFY_INTERVAL);
  console.log("[auto-tasks] Background auto-classify/ingest started (interval: 10m)");
}, AUTO_CLASSIFY_INITIAL_DELAY);

// ── Deck Intelligence Cron ──
startDeckInferenceCron();

// ── MCP Client Initialization ──
initMcp().catch((err) => console.error("[mcp] Init failed:", err));

// ── Process-level safety nets ──
// Prevent transient unhandled rejections (e.g. DB connectivity blips,
// DNS hiccups) from fatally crashing the Node process.
process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled rejection (non-fatal):", reason);
});

// ── Graceful Shutdown ──
process.on("SIGTERM", async () => {
  console.log("[shutdown] SIGTERM received");
  await shutdownMcp();
  process.exit(0);
});
