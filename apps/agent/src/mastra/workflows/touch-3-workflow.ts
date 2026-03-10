/**
 * Touch 3 Capability Alignment Deck Workflow (3-Stage HITL)
 *
 * 3-stage HITL model (mirrors Touch 2 pattern):
 *   Skeleton = slide selection rationale (why these capability slides were chosen)
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
import { loadDeckSections } from "../../lib/deck-structure-loader";
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
  capabilityAreas: z.array(z.string()),
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
const touch3BaseFields = {
  dealId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  capabilityAreas: z.array(z.string()),
  context: z.string().optional(),
  priorTouchOutputs: z.array(z.string()).optional(),
  interactionId: z.string(),
};

// ────────────────────────────────────────────────────────────
// Step 1: Create InteractionRecord + Select slides (Skeleton)
// ────────────────────────────────────────────────────────────

const selectSlides = createStep({
  id: "select-slides",
  inputSchema,
  outputSchema: z.object({
    ...touch3BaseFields,
    skeletonContent: skeletonContentSchema,
  }),
  execute: async ({ inputData, runId }) => {
    // Create InteractionRecord at start
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "touch_3",
        status: "in_progress",
        decision: null,
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          capabilityAreas: inputData.capabilityAreas,
          context: inputData.context,
          runId: runId ?? inputData.runId,
        }),
      },
    });

    const result = await selectSlidesForDeck({
      touchType: "touch_3",
      companyName: inputData.companyName,
      industry: inputData.industry,
      capabilityAreas: inputData.capabilityAreas,
      context: inputData.context,
      priorTouchOutputs: inputData.priorTouchOutputs,
    });

    const skeletonContent = {
      selectedSlideIds: result.selectedSlideIds,
      slideOrder: result.slideOrder,
      selectionRationale: `Selected ${result.selectedSlideIds.length} capability slides for ${inputData.companyName} covering ${inputData.capabilityAreas.join(", ")}. ${result.personalizationNotes}`,
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
    ...touch3BaseFields,
    skeletonContent: skeletonContentSchema,
  }),
  outputSchema: z.object({
    ...touch3BaseFields,
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
      capabilityAreas: inputData.capabilityAreas,
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
    ...touch3BaseFields,
    approvedSkeleton: skeletonContentSchema,
  }),
  outputSchema: z.object({
    ...touch3BaseFields,
    lowfiContent: lowfiContentSchema,
    selectedSlideIds: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const skeleton = inputData.approvedSkeleton;

    // Load DeckStructure sections to enrich slide notes
    const deckSections = await loadDeckSections("touch_3");

    // Generate notes for each slide, enriched with section info when available
    const slideNotes = skeleton.slideOrder.map((slideId) => {
      // Try to match slideId against DeckStructure section slideIds
      if (deckSections) {
        const matchedSection = deckSections.find((section) =>
          section.slideIds.includes(slideId),
        );
        if (matchedSection) {
          return {
            slideId,
            notes: `Section: ${matchedSection.name} — ${matchedSection.purpose}. Capability alignment for ${inputData.companyName} in ${inputData.industry}.`,
            purpose: `${matchedSection.name}: ${matchedSection.purpose}`,
          };
        }
      }
      // Fallback: generic notes
      return {
        slideId,
        notes: `Capability alignment for ${inputData.companyName} - ${inputData.capabilityAreas.join(", ")}. ${skeleton.personalizationNotes}`,
        purpose: `Demonstrates Lumenalta capability relevant to ${inputData.industry}`,
      };
    });

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
      capabilityAreas: inputData.capabilityAreas,
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
    ...touch3BaseFields,
    lowfiContent: lowfiContentSchema,
    selectedSlideIds: z.array(z.string()),
  }),
  outputSchema: z.object({
    ...touch3BaseFields,
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
      capabilityAreas: inputData.capabilityAreas,
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
    ...touch3BaseFields,
    approvedLowfi: lowfiContentSchema,
    selectedSlideIds: z.array(z.string()),
  }),
  outputSchema: z.object({
    ...touch3BaseFields,
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
      where: { dealId: inputData.dealId, touchType: "touch_3", driveFileId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { driveFileId: true },
    });
    if (existingInteraction?.driveFileId) {
      try {
        await archiveExistingFile({ dealFolderId: folderId, fileId: existingInteraction.driveFileId });
      } catch (err) {
        console.warn("[touch-3-workflow] Archive failed, continuing:", err);
      }
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const deckName = `${inputData.companyName} - Capability Alignment - ${inputData.capabilityAreas.join(", ")} - ${dateStr}`;

    // Route: structure-driven pipeline or legacy slide assembly
    const dealContext = buildDealContext("touch_3", {
      dealId: inputData.dealId,
      companyName: inputData.companyName,
      industry: inputData.industry,
      capabilityAreas: inputData.capabilityAreas,
      priorTouchOutputs: inputData.priorTouchOutputs,
    });
    const strategy = await resolveGenerationStrategy("touch_3", null, dealContext);
    console.log(`[touch-3-workflow] Using ${strategy.type} generation path`);

    if (strategy.type === "legacy") {
      throw new Error("[touch-3-workflow] No DeckStructure/blueprint found for touch_3. Register an example presentation first.");
    }

    const result = await executeStructureDrivenPipeline({
      blueprint: strategy.blueprint,
      targetFolderId: folderId,
      deckName,
      dealContext,
      ownerEmail: deal.ownerEmail ?? undefined,
    });

    // Share with deal owner as editor
    if (deal.ownerEmail) {
      await shareWithOrg({ fileId: result.presentationId, ownerEmail: deal.ownerEmail });
    }

    // Update hitlStage to ready
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
      capabilityAreas: inputData.capabilityAreas,
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
    ...touch3BaseFields,
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
        source: "touch_3_generate",
        content: JSON.stringify({
          capabilityAreas: inputData.capabilityAreas,
          selectedSlideIds: inputData.selectedSlideIds,
          personalizationNotes: inputData.personalizationNotes,
        }),
      },
    });

    // Ingest generated deck into AtlusAI (non-blocking)
    try {
      await ingestGeneratedDeck({
        presentationId: inputData.presentationId,
        deckName: `${inputData.companyName} - Capability Alignment - ${inputData.capabilityAreas.join(", ")}`,
        dealContext: {
          companyName: inputData.companyName,
          industry: inputData.industry,
          touchType: "touch_3",
          decision: "approved",
        },
        driveFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
      });
    } catch (err) {
      console.error("[touch-3-workflow] AtlusAI ingestion failed:", err);
    }

    return {
      interactionId: inputData.interactionId,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Touch 3 Capability Alignment Deck (3-Stage HITL)
// ────────────────────────────────────────────────────────────

export const touch3Workflow = createWorkflow({
  id: "touch-3-workflow",
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
