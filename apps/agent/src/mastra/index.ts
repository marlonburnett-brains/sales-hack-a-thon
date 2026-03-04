import { Mastra } from "@mastra/core";
import { registerApiRoute } from "@mastra/core/server";
import { LibSQLStore } from "@mastra/libsql";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { touch1Workflow } from "./workflows/touch-1-workflow";
import { touch2Workflow } from "./workflows/touch-2-workflow";
import { touch3Workflow } from "./workflows/touch-3-workflow";
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
                include: { feedbackSignals: true },
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
    ],
  },
});
