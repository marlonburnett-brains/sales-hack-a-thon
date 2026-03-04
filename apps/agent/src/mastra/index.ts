import { Mastra } from "@mastra/core";
import { registerApiRoute } from "@mastra/core/server";
import { LibSQLStore } from "@mastra/libsql";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { touch1Workflow } from "./workflows/touch-1-workflow";
import { touch2Workflow } from "./workflows/touch-2-workflow";
import { touch3Workflow } from "./workflows/touch-3-workflow";
import { touch4Workflow } from "./workflows/touch-4-workflow";
import { getOrCreateDealFolder, makePubliclyViewable } from "../lib/drive-folders";
import { getDriveClient } from "../lib/google-auth";
import { ingestDocument } from "../lib/atlusai-client";
import { env } from "../env";

/**
 * Two-database architecture for apps/agent:
 *
 * prisma/mastra.db --- Mastra's INTERNAL database
 *   Stores: workflow execution snapshots, suspend/resume state,
 *           message history, traces, and step outputs.
 *   Managed: entirely by Mastra; do NOT add Prisma models here.
 *
 * prisma/dev.db   --- APPLICATION-level database
 *   Stores: WorkflowJob records, Company, Deal, InteractionRecord, FeedbackSignal.
 *   Managed: by Prisma migrations (schema.prisma + prisma db push).
 *
 * Both SQLite files coexist in apps/agent/prisma/ without conflict.
 */

const prisma = new PrismaClient();

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "mastra-store",
    // LibSQL local file mode --- file: prefix is required
    url: "file:./prisma/mastra.db",
  }),
  workflows: {
    "touch-1-workflow": touch1Workflow,
    "touch-2-workflow": touch2Workflow,
    "touch-3-workflow": touch3Workflow,
    "touch-4-workflow": touch4Workflow,
  },
  server: {
    port: parseInt(env.MASTRA_PORT, 10),
    apiRoutes: [
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
                orderBy: { createdAt: "desc" },
                take: 1,
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
            const drive = getDriveClient();
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
    ],
  },
});
