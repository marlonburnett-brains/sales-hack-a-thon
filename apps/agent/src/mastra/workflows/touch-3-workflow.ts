/**
 * Touch 3 Capability Alignment Deck Workflow
 *
 * End-to-end generation: AI selects capability-specific slides based on
 * 1-2 specified capability areas, assembles them into a customized
 * presentation, saves to Drive, and records the interaction.
 *
 * Like Touch 2, Touch 3 generates directly without an intermediate
 * seller review step. The seller reviews the final deck via iframe preview
 * and can regenerate with different capability areas.
 *
 * Steps: selectSlides -> assembleDeck -> recordInteraction
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { selectSlidesForDeck } from "../../lib/slide-selection";
import { assembleDeckFromSlides } from "../../lib/deck-customizer";
import { getOrCreateDealFolder } from "../../lib/drive-folders";
import { ingestGeneratedDeck } from "../../lib/ingestion-pipeline";
import { env } from "../../env";

// ────────────────────────────────────────────────────────────
// Prisma client singleton
// ────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

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
});

const selectSlidesOutputSchema = z.object({
  dealId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  capabilityAreas: z.array(z.string()),
  context: z.string().optional(),
  priorTouchOutputs: z.array(z.string()).optional(),
  selectedSlideIds: z.array(z.string()),
  slideOrder: z.array(z.string()),
  personalizationNotes: z.string(),
});

const assembleDeckOutputSchema = selectSlidesOutputSchema.extend({
  presentationId: z.string(),
  driveUrl: z.string(),
});

// ────────────────────────────────────────────────────────────
// Step 1: Select slides via AI (capability-focused)
// ────────────────────────────────────────────────────────────

const selectSlides = createStep({
  id: "select-slides",
  inputSchema,
  outputSchema: selectSlidesOutputSchema,
  execute: async ({ inputData }) => {
    const result = await selectSlidesForDeck({
      touchType: "touch_3",
      companyName: inputData.companyName,
      industry: inputData.industry,
      capabilityAreas: inputData.capabilityAreas,
      context: inputData.context,
      priorTouchOutputs: inputData.priorTouchOutputs,
    });

    return {
      ...inputData,
      selectedSlideIds: result.selectedSlideIds,
      slideOrder: result.slideOrder,
      personalizationNotes: result.personalizationNotes,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 2: Assemble deck from selected slides
// ────────────────────────────────────────────────────────────

const assembleDeck = createStep({
  id: "assemble-deck",
  inputSchema: selectSlidesOutputSchema,
  outputSchema: assembleDeckOutputSchema,
  execute: async ({ inputData }) => {
    // Get or create per-deal folder
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: inputData.dealId },
      include: { company: true },
    });

    const folderId = await getOrCreateDealFolder({
      companyName: deal.company.name,
      dealName: deal.name,
      parentFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
    });

    // Update deal with folder ID if not set
    if (!deal.driveFolderId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { driveFolderId: folderId },
      });
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const deckName = `${inputData.companyName} - Capability Alignment - ${inputData.capabilityAreas.join(", ")} - ${dateStr}`;

    // Use capability deck source or fall back to Meet Lumenalta or general template
    const sourcePresentationId =
      env.CAPABILITY_DECK_PRESENTATION_ID ||
      env.MEET_LUMENALTA_PRESENTATION_ID ||
      env.GOOGLE_TEMPLATE_PRESENTATION_ID;

    const result = await assembleDeckFromSlides({
      sourcePresentationId,
      selectedSlideIds: inputData.selectedSlideIds,
      slideOrder: inputData.slideOrder,
      targetFolderId: folderId,
      deckName,
    });

    return {
      ...inputData,
      presentationId: result.presentationId,
      driveUrl: result.driveUrl,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Step 3: Record interaction + feedback + AtlusAI ingestion
// ────────────────────────────────────────────────────────────

const recordInteraction = createStep({
  id: "record-interaction",
  inputSchema: assembleDeckOutputSchema,
  outputSchema: z.object({
    interactionId: z.string(),
    presentationId: z.string(),
    driveUrl: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Touch 3 is direct generation — status is "approved"
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "touch_3",
        status: "approved",
        decision: "approved",
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          capabilityAreas: inputData.capabilityAreas,
          context: inputData.context,
        }),
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
        interactionId: interaction.id,
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
      interactionId: interaction.id,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Touch 3 Capability Alignment Deck
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
  .then(assembleDeck)
  .then(recordInteraction)
  .commit();
