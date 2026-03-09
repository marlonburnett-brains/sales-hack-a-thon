/**
 * Touch 2 Meet Lumenalta Intro Deck Workflow (3-Stage HITL)
 *
 * 3-stage HITL model:
 *   Skeleton = slide selection rationale (why these slides were chosen, which templates matched)
 *   Low-fi   = draft slide order + notes per slide
 *   High-fi  = Google Slides deck (assembled from selected slides)
 *
 * Steps: createInteraction -> selectSlides -> awaitSkeletonApproval ->
 *        generateDraftOrder -> awaitLowfiApproval ->
 *        assembleDeck -> recordInteraction
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { selectSlidesForDeck } from "../../lib/slide-selection";
import { assembleDeckFromSlides } from "../../lib/deck-customizer";
import { getOrCreateDealFolder, resolveRootFolderId, shareWithOrg, archiveExistingFile } from "../../lib/drive-folders";
import { ingestGeneratedDeck } from "../../lib/ingestion-pipeline";
import { prisma } from "../../lib/db";
import { env } from "../../env";
import { resolveGenerationStrategy, executeStructureDrivenPipeline, buildDealContext } from "../../generation/route-strategy";

// ────────────────────────────────────────────────────────────
// Shared schemas
// ────────────────────────────────────────────────────────────

const inputSchema = z.object({
  dealId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  salespersonName: z.string().optional(),
  salespersonPhotoUrl: z.string().optional(),
  customerName: z.string().optional(),
  customerLogoUrl: z.string().optional(),
  context: z.string().optional(),
  priorTouchOutputs: z.array(z.string()).optional(),
  runId: z.string().optional(),
});

const skeletonContentSchema = z.object({
  selectedSlideIds: z.array(z.string()),
  slideOrder: z.array(z.string()),
  selectionRationale: z.string(),
  personalizationNotes: z.string(),
});

const lowfiContentSchema = z.object({
  slideOrder: z.array(z.string()),
  slideNotes: z.array(z.object({
    slideId: z.string(),
    notes: z.string(),
    purpose: z.string(),
  })),
  personalizationNotes: z.string(),
});

// Common passthrough fields
const touch2BaseFields = {
  dealId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  salespersonName: z.string().optional(),
  salespersonPhotoUrl: z.string().optional(),
  customerName: z.string().optional(),
  customerLogoUrl: z.string().optional(),
  context: z.string().optional(),
  priorTouchOutputs: z.array(z.string()).optional(),
  interactionId: z.string(),
};

// ────────────────────────────────────────────────────────────
// Step 1: Create InteractionRecord + Select slides via AI (Skeleton)
// ────────────────────────────────────────────────────────────

const selectSlides = createStep({
  id: "select-slides",
  inputSchema,
  outputSchema: z.object({
    ...touch2BaseFields,
    skeletonContent: skeletonContentSchema,
  }),
  execute: async ({ inputData }) => {
    // Create InteractionRecord at start
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "touch_2",
        status: "in_progress",
        decision: null,
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          salespersonName: inputData.salespersonName,
          customerName: inputData.customerName,
          context: inputData.context,
          runId: inputData.runId,
        }),
      },
    });

    const result = await selectSlidesForDeck({
      touchType: "touch_2",
      companyName: inputData.companyName,
      industry: inputData.industry,
      context: inputData.context,
      priorTouchOutputs: inputData.priorTouchOutputs,
    });

    const skeletonContent = {
      selectedSlideIds: result.selectedSlideIds,
      slideOrder: result.slideOrder,
      selectionRationale: `Selected ${result.selectedSlideIds.length} slides for ${inputData.companyName} in ${inputData.industry}. ${result.personalizationNotes}`,
      personalizationNotes: result.personalizationNotes,
    };

    // Update hitlStage to skeleton
    await prisma.interactionRecord.update({
      where: { id: interaction.id },
      data: {
        hitlStage: "skeleton",
        stageContent: JSON.stringify(skeletonContent),
      },
    });

    return {
      ...inputData,
      interactionId: interaction.id,
      skeletonContent,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 2: Await Skeleton Approval (SUSPEND 1)
// ────────────────────────────────────────────────────────────

const awaitSkeletonApproval = createStep({
  id: "await-skeleton-approval",
  inputSchema: z.object({
    ...touch2BaseFields,
    skeletonContent: skeletonContentSchema,
  }),
  outputSchema: z.object({
    ...touch2BaseFields,
    approvedSkeleton: skeletonContentSchema,
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "refined"]),
    refinedContent: skeletonContentSchema.optional(),
  }),
  suspendSchema: z.object({
    stage: z.literal("skeleton"),
    content: skeletonContentSchema,
    dealId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        stage: "skeleton" as const,
        content: inputData.skeletonContent,
        dealId: inputData.dealId,
        interactionId: inputData.interactionId,
      });
    }

    const approvedSkeleton = resumeData.refinedContent ?? inputData.skeletonContent;

    if (resumeData.refinedContent) {
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: { stageContent: JSON.stringify(approvedSkeleton) },
      });
    }

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      salespersonName: inputData.salespersonName,
      salespersonPhotoUrl: inputData.salespersonPhotoUrl,
      customerName: inputData.customerName,
      customerLogoUrl: inputData.customerLogoUrl,
      context: inputData.context,
      priorTouchOutputs: inputData.priorTouchOutputs,
      interactionId: inputData.interactionId,
      approvedSkeleton,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 3: Generate Draft Slide Order + Notes (Low-fi)
// ────────────────────────────────────────────────────────────

const generateDraftOrder = createStep({
  id: "generate-draft-order",
  inputSchema: z.object({
    ...touch2BaseFields,
    approvedSkeleton: skeletonContentSchema,
  }),
  outputSchema: z.object({
    ...touch2BaseFields,
    lowfiContent: lowfiContentSchema,
    selectedSlideIds: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const skeleton = inputData.approvedSkeleton;

    // Generate notes for each slide based on the selection rationale
    const slideNotes = skeleton.slideOrder.map((slideId) => ({
      slideId,
      notes: `Personalized for ${inputData.companyName} - ${inputData.industry}. ${skeleton.personalizationNotes}`,
      purpose: `Part of ${inputData.companyName} intro deck sequence`,
    }));

    const lowfiContent = {
      slideOrder: skeleton.slideOrder,
      slideNotes,
      personalizationNotes: skeleton.personalizationNotes,
    };

    // Update hitlStage to lowfi
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        hitlStage: "lowfi",
        stageContent: JSON.stringify(lowfiContent),
      },
    });

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      salespersonName: inputData.salespersonName,
      salespersonPhotoUrl: inputData.salespersonPhotoUrl,
      customerName: inputData.customerName,
      customerLogoUrl: inputData.customerLogoUrl,
      context: inputData.context,
      priorTouchOutputs: inputData.priorTouchOutputs,
      interactionId: inputData.interactionId,
      lowfiContent,
      selectedSlideIds: skeleton.selectedSlideIds,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 4: Await Low-fi Approval (SUSPEND 2)
// ────────────────────────────────────────────────────────────

const awaitLowfiApproval = createStep({
  id: "await-lowfi-approval",
  inputSchema: z.object({
    ...touch2BaseFields,
    lowfiContent: lowfiContentSchema,
    selectedSlideIds: z.array(z.string()),
  }),
  outputSchema: z.object({
    ...touch2BaseFields,
    approvedLowfi: lowfiContentSchema,
    selectedSlideIds: z.array(z.string()),
  }),
  resumeSchema: z.object({
    decision: z.enum(["approved", "refined"]),
    refinedContent: lowfiContentSchema.optional(),
  }),
  suspendSchema: z.object({
    stage: z.literal("lowfi"),
    content: lowfiContentSchema,
    dealId: z.string(),
    interactionId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        stage: "lowfi" as const,
        content: inputData.lowfiContent,
        dealId: inputData.dealId,
        interactionId: inputData.interactionId,
      });
    }

    const approvedLowfi = resumeData.refinedContent ?? inputData.lowfiContent;

    if (resumeData.refinedContent) {
      await prisma.interactionRecord.update({
        where: { id: inputData.interactionId },
        data: { stageContent: JSON.stringify(approvedLowfi) },
      });
    }

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      salespersonName: inputData.salespersonName,
      salespersonPhotoUrl: inputData.salespersonPhotoUrl,
      customerName: inputData.customerName,
      customerLogoUrl: inputData.customerLogoUrl,
      context: inputData.context,
      priorTouchOutputs: inputData.priorTouchOutputs,
      interactionId: inputData.interactionId,
      approvedLowfi,
      selectedSlideIds: inputData.selectedSlideIds,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 5: Assemble deck from selected slides (High-fi)
// ────────────────────────────────────────────────────────────

const assembleDeck = createStep({
  id: "assemble-deck",
  inputSchema: z.object({
    ...touch2BaseFields,
    approvedLowfi: lowfiContentSchema,
    selectedSlideIds: z.array(z.string()),
  }),
  outputSchema: z.object({
    ...touch2BaseFields,
    selectedSlideIds: z.array(z.string()),
    slideOrder: z.array(z.string()),
    personalizationNotes: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Get or create per-deal folder using user's root folder setting
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: inputData.dealId },
      include: { company: true },
    });

    const rootFolderId = await resolveRootFolderId(deal.ownerId ?? undefined);
    const folderId = await getOrCreateDealFolder({
      companyName: deal.company.name,
      dealName: deal.name,
      parentFolderId: rootFolderId,
    });

    // Update deal with folder ID if not set
    if (!deal.driveFolderId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { driveFolderId: folderId },
      });
    }

    // Archive previous file if re-generating
    const existingInteraction = await prisma.interactionRecord.findFirst({
      where: { dealId: inputData.dealId, touchType: "touch_2", driveFileId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { driveFileId: true },
    });
    if (existingInteraction?.driveFileId) {
      try {
        await archiveExistingFile({ dealFolderId: folderId, fileId: existingInteraction.driveFileId });
      } catch (err) {
        console.warn("[touch-2-workflow] Archive failed, continuing:", err);
      }
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const deckName = `${inputData.companyName} - Meet Lumenalta - ${dateStr}`;

    // Route: structure-driven pipeline or legacy slide assembly
    const dealContext = buildDealContext("touch_2", {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      priorTouchOutputs: inputData.priorTouchOutputs,
    });
    const strategy = await resolveGenerationStrategy("touch_2", null, dealContext);
    console.log(`[touch-2-workflow] Using ${strategy.type} generation path`);

    let result;
    if (strategy.type !== "legacy") {
      result = await executeStructureDrivenPipeline({
        blueprint: strategy.blueprint,
        targetFolderId: folderId,
        deckName,
        dealContext,
        ownerEmail: deal.ownerEmail ?? undefined,
      });
    } else {
      // Legacy: Use Meet Lumenalta source presentation or fall back to the general template
      const sourcePresentationId =
        env.MEET_LUMENALTA_PRESENTATION_ID || env.GOOGLE_TEMPLATE_PRESENTATION_ID;

      result = await assembleDeckFromSlides({
        sourcePresentationId,
        selectedSlideIds: inputData.selectedSlideIds,
        slideOrder: inputData.approvedLowfi.slideOrder,
        targetFolderId: folderId,
        deckName,
        customizations: {
          salespersonName: inputData.salespersonName,
          salespersonPhotoUrl: inputData.salespersonPhotoUrl,
          customerName: inputData.customerName,
          customerLogoUrl: inputData.customerLogoUrl,
        },
      });
    }

    // Share with deal owner as editor (domain sharing handled by assembleDeckFromSlides)
    if (deal.ownerEmail) {
      await shareWithOrg({ fileId: result.presentationId, ownerEmail: deal.ownerEmail });
    }

    // Update hitlStage to highfi then ready (no separate high-fi suspend for Touch 2/3)
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        hitlStage: "ready",
        stageContent: JSON.stringify({
          presentationId: result.presentationId,
          driveUrl: result.driveUrl,
        }),
      },
    });

    return {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      salespersonName: inputData.salespersonName,
      salespersonPhotoUrl: inputData.salespersonPhotoUrl,
      customerName: inputData.customerName,
      customerLogoUrl: inputData.customerLogoUrl,
      context: inputData.context,
      priorTouchOutputs: inputData.priorTouchOutputs,
      interactionId: inputData.interactionId,
      selectedSlideIds: inputData.selectedSlideIds,
      slideOrder: inputData.approvedLowfi.slideOrder,
      personalizationNotes: inputData.approvedLowfi.personalizationNotes,
      presentationId: result.presentationId,
      driveUrl: result.driveUrl,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 6: Record interaction + feedback + AtlusAI ingestion
// ────────────────────────────────────────────────────────────

const recordInteraction = createStep({
  id: "record-interaction",
  inputSchema: z.object({
    ...touch2BaseFields,
    selectedSlideIds: z.array(z.string()),
    slideOrder: z.array(z.string()),
    personalizationNotes: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Update existing interaction record with final content
    await prisma.interactionRecord.update({
      where: { id: inputData.interactionId },
      data: {
        status: "approved",
        decision: "approved",
        generatedContent: JSON.stringify({
          selectedSlideIds: inputData.selectedSlideIds,
          slideOrder: inputData.slideOrder,
          personalizationNotes: inputData.personalizationNotes,
        }),
        outputRefs: JSON.stringify([inputData.driveUrl]),
        driveFileId: inputData.presentationId,
      },
    });

    // Create positive feedback signal
    await prisma.feedbackSignal.create({
      data: {
        interactionId: inputData.interactionId,
        signalType: "positive",
        source: "touch_2_generate",
        content: JSON.stringify({
          selectedSlideIds: inputData.selectedSlideIds,
          personalizationNotes: inputData.personalizationNotes,
        }),
      },
    });

    // Ingest generated deck into AtlusAI (non-blocking)
    try {
      await ingestGeneratedDeck({
        presentationId: inputData.presentationId,
        deckName: `${inputData.companyName} - Meet Lumenalta`,
        dealContext: {
          companyName: inputData.companyName,
          industry: inputData.industry,
          touchType: "touch_2",
          decision: "approved",
        },
        driveFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
      });
    } catch (err) {
      console.error("[touch-2-workflow] AtlusAI ingestion failed:", err);
    }

    return {
      interactionId: inputData.interactionId,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Touch 2 Meet Lumenalta Intro Deck (3-Stage HITL)
// ────────────────────────────────────────────────────────────

export const touch2Workflow = createWorkflow({
  id: "touch-2-workflow",
  inputSchema,
  outputSchema: z.object({
    interactionId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
  }),
})
  .then(selectSlides)
  .then(awaitSkeletonApproval)
  .then(generateDraftOrder)
  .then(awaitLowfiApproval)
  .then(assembleDeck)
  .then(recordInteraction)
  .commit();
