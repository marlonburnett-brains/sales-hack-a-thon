import { Mastra } from "@mastra/core";
import { registerApiRoute, SimpleAuth } from "@mastra/core/server";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";
import { touch1Workflow } from "./workflows/touch-1-workflow";
import { touch2Workflow } from "./workflows/touch-2-workflow";
import { touch3Workflow } from "./workflows/touch-3-workflow";
import { touch4Workflow } from "./workflows/touch-4-workflow";
import { preCallWorkflow } from "./workflows/pre-call-workflow";
import { getOrCreateDealFolder, makePubliclyViewable } from "../lib/drive-folders";
import { getDriveClient, getSlidesClient, getPooledGoogleAuth } from "../lib/google-auth";
import { extractGoogleAuth } from "../lib/request-auth";
import { ingestDocument } from "../lib/atlusai-client";
import { ingestionQueue, clearStaleIngestions } from "../ingestion/ingestion-queue";
import { encryptToken } from "../lib/token-encryption";
import {
  detectAtlusAccess,
  upsertAtlusToken,
  resolveActionsByType,
  getPooledAtlusAuth,
} from "../lib/atlus-auth";
import { ACTION_TYPES } from "@lumenalta/schemas";
import { env } from "../env";
import { initMcp, shutdownMcp, callMcpTool, isMcpAvailable } from "../lib/mcp-client";
import { searchSlides } from "../lib/atlusai-search";
import { cacheThumbnailsForTemplate, THUMBNAIL_TTL_MS } from "../lib/gcs-thumbnails";
import { generateEmbedding } from "../ingestion/embed-slide";
import { computeContentHash } from "../ingestion/smart-merge";
import { toSql } from "pgvector";
import crypto from "node:crypto";

// ────────────────────────────────────────────────────────────
// Background Staleness Polling
// ────────────────────────────────────────────────────────────

const STALENESS_POLL_INTERVAL = 300_000; // 5 minutes
const STALENESS_INITIAL_DELAY = 10_000; // 10 seconds after startup
const DRIVE_API_DELAY = 200; // 200ms between Drive API calls

// ────────────────────────────────────────────────────────────
// Discovery Batch Ingestion State (Phase 29)
// ────────────────────────────────────────────────────────────
const discoveryBatches = new Map<
  string,
  Map<string, { status: string; error?: string }>
>();

function startStalenessPolling() {
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    console.log("[staleness] Skipping polling (GOOGLE_CLOUD_PROJECT not configured)");
    return;
  }

  console.log("[staleness] Background polling started (interval: 5m)");

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

const auth = new SimpleAuth({
  headers: ["X-API-Key"],
  tokens: {
    [env.AGENT_API_KEY]: { id: "web-app", role: "service" },
  },
  public: publicPaths,
});

// Clear stale ingestion states on startup (crash recovery)
void clearStaleIngestions().catch((err) =>
  console.error("[startup] Failed to clear stale ingestions:", err)
);

export const mastra = new Mastra({
  storage: new PostgresStore({
    id: "mastra-store",
    connectionString: env.DATABASE_URL,
    schemaName: "mastra",
  }),
  workflows: {
    "touch-1-workflow": touch1Workflow,
    "touch-2-workflow": touch2Workflow,
    "touch-3-workflow": touch3Workflow,
    "touch-4-workflow": touch4Workflow,
    "pre-call-workflow": preCallWorkflow,
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(env.MASTRA_PORT, 10),
    auth,
    cors: {
      origin: env.WEB_APP_URL,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-mastra-client-type', 'X-Google-Access-Token', 'X-User-Id'],
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
          const deals = await prisma.deal.findMany({
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
            const googleAuth = await extractGoogleAuth(c);
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

            // Make publicly viewable for iframe preview
            await makePubliclyViewable(fileId);

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
                editedBrief: z.record(z.unknown()).optional(),
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
            const run = wf.createRun({ runId: data.runId });
            await run.resume({
              stepId: "await-brief-approval",
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
                editedBrief: z.record(z.unknown()),
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
            const run = wf.createRun({ runId: data.runId });
            await run.resume({
              stepId: "await-asset-review",
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

            const googleAuth = await extractGoogleAuth(c);
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
          const googleAuth = await extractGoogleAuth(c);
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
            },
          });
          return c.json(slides);
        },
      }),

      // GET /templates/:id/thumbnails -- Return cached GCS thumbnail URLs (falls back to live Slides API)
      registerApiRoute("/templates/:id/thumbnails", {
        method: "GET",
        handler: async (c) => {
          const templateId = c.req.param("id");
          const template = await prisma.template.findUniqueOrThrow({ where: { id: templateId } });
          const googleAuth = await extractGoogleAuth(c);

          // 1. Query slides with cached thumbnail info
          const slides = await prisma.slideEmbedding.findMany({
            where: { templateId, archived: false },
            orderBy: { slideIndex: "asc" },
            select: { slideObjectId: true, slideIndex: true, thumbnailUrl: true, thumbnailFetchedAt: true },
          });

          const ttlCutoff = new Date(Date.now() - THUMBNAIL_TTL_MS);
          const allCached = slides.every(
            (s) => s.thumbnailUrl && s.thumbnailFetchedAt && s.thumbnailFetchedAt > ttlCutoff
          );

          // 2. If cache HIT: return immediately (no Slides API calls)
          if (allCached) {
            const thumbnails = slides
              .filter((s) => s.slideObjectId)
              .map((s) => ({
                slideObjectId: s.slideObjectId!,
                slideIndex: s.slideIndex,
                thumbnailUrl: s.thumbnailUrl!,
              }));
            return c.json({ thumbnails });
          }

          // 3. Cache MISS or stale: refresh via GCS caching
          try {
            await cacheThumbnailsForTemplate(
              templateId,
              template.presentationId,
              googleAuth.accessToken ? googleAuth : undefined
            );
          } catch (err) {
            console.error("[thumbnails] GCS cache refresh failed:", err);
          }

          // 4. Re-query after refresh
          const refreshed = await prisma.slideEmbedding.findMany({
            where: { templateId, archived: false },
            orderBy: { slideIndex: "asc" },
            select: { slideObjectId: true, slideIndex: true, thumbnailUrl: true },
          });

          // 5. Separate cached vs uncached slides
          const thumbnails: Array<{ slideObjectId: string; slideIndex: number; thumbnailUrl: string }> = [];
          const uncached = refreshed.filter((s) => s.slideObjectId && !s.thumbnailUrl);

          for (const s of refreshed) {
            if (!s.slideObjectId) continue;
            if (s.thumbnailUrl) {
              thumbnails.push({
                slideObjectId: s.slideObjectId,
                slideIndex: s.slideIndex,
                thumbnailUrl: s.thumbnailUrl,
              });
            }
          }

          // 6. Fall back to live Slides API for any still-uncached slides (backward compat)
          if (uncached.length > 0) {
            const slidesApi = getSlidesClient(googleAuth.accessToken ? googleAuth : undefined);
            const BATCH_SIZE = 5;
            const BATCH_DELAY_MS = 1500;
            for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
              if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
              const batch = uncached.slice(i, i + BATCH_SIZE);
              const results = await Promise.allSettled(
                batch.map(async (slide) => {
                  const result = await slidesApi.presentations.pages.getThumbnail({
                    presentationId: template.presentationId,
                    pageObjectId: slide.slideObjectId!,
                    "thumbnailProperties.thumbnailSize": "LARGE",
                  });
                  return {
                    slideObjectId: slide.slideObjectId!,
                    slideIndex: slide.slideIndex,
                    thumbnailUrl: result.data.contentUrl ?? "",
                  };
                })
              );
              for (const r of results) {
                if (r.status === "fulfilled") thumbnails.push(r.value);
                else console.error(`[thumbnails] Live fallback failed:`, r.reason?.message ?? r.reason);
              }
            }
          }

          // Sort by slideIndex to maintain consistent order
          thumbnails.sort((a, b) => a.slideIndex - b.slideIndex);
          return c.json({ thumbnails });
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

            // Auto-resolve any reauth_needed actions for this user
            await prisma.actionRequired.updateMany({
              where: {
                userId: data.userId,
                actionType: "reauth_needed",
                resolved: false,
              },
              data: { resolved: true, resolvedAt: new Date() },
            }).catch(() => {}); // fire and forget

            // NOTE: AtlusAI access detection removed from here.
            // detectAtlusAccess requires an AtlusAI access token, NOT a Google refresh token.
            // AtlusAI detection should happen via the dedicated /atlus/detect endpoint
            // or the AtlusAI OAuth flow (/auth/atlus/connect -> /auth/atlus/callback).

            return c.json({ success: true, tokenId: token.id });
          } catch (err) {
            if (err instanceof z.ZodError) {
              return c.json({ error: "Invalid request body", details: err.errors }, 400);
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

            // Query already-ingested content hashes
            const ingested = await prisma.slideEmbedding.findMany({
              where: { archived: false },
              select: { contentHash: true },
            });
            const ingestedHashes = ingested
              .map((r) => r.contentHash)
              .filter((h): h is string => h !== null);

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

            // Query already-ingested content hashes
            const ingested = await prisma.slideEmbedding.findMany({
              where: { archived: false },
              select: { contentHash: true },
            });
            const ingestedHashes = ingested
              .map((r) => r.contentHash)
              .filter((h): h is string => h !== null);

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

      // POST /discovery/ingest -- Start batch ingestion of selected discovery items
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

                  // Generate content hash
                  const contentHash = computeContentHash(
                    item.textContent,
                    item.speakerNotes,
                    item.slideId,
                  );

                  // Check for duplicate
                  const existing = await prisma.slideEmbedding.findFirst({
                    where: { contentHash, archived: false },
                    select: { id: true },
                  });
                  if (existing) {
                    batchItems.set(item.slideId, { status: "done" });
                    continue;
                  }

                  // Generate embedding via Vertex AI
                  const embeddingText = [
                    item.documentTitle,
                    item.textContent,
                    item.speakerNotes,
                  ]
                    .filter(Boolean)
                    .join("\n");
                  const embedding = await generateEmbedding(embeddingText);

                  // Generate a simple cuid-like ID
                  const id = `c${Date.now().toString(36)}${Math.random().toString(36).substring(2, 12)}`;

                  // Store SlideEmbedding record via raw SQL for pgvector
                  await prisma.$executeRaw`
                    INSERT INTO "SlideEmbedding" (
                      id, "templateId", "slideIndex", "slideObjectId",
                      "contentText", "speakerNotes", "contentHash",
                      embedding, "classificationJson", confidence,
                      "reviewStatus", "needsReReview", archived,
                      "createdAt", "updatedAt"
                    ) VALUES (
                      ${id}, 'atlus-discovery', 0, ${item.slideId},
                      ${item.textContent}, ${item.speakerNotes}, ${contentHash},
                      ${toSql(embedding)}::vector, ${JSON.stringify(item.metadata)}, ${0.5},
                      'unreviewed', false, false,
                      NOW(), NOW()
                    )
                  `;

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
    ],
  },
});

// Start background staleness polling after Mastra is initialized
startStalenessPolling();

// ── MCP Client Initialization ──
initMcp().catch((err) => console.error("[mcp] Init failed:", err));

// ── Graceful Shutdown ──
process.on("SIGTERM", async () => {
  console.log("[shutdown] SIGTERM received");
  await shutdownMcp();
  process.exit(0);
});
