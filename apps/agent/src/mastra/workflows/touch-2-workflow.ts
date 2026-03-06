/**
 * Touch 2 Meet Lumenalta Intro Deck Workflow
 *
 * End-to-end generation: AI selects industry-relevant slides from the Meet
 * Lumenalta source deck, assembles them into a customized presentation with
 * salesperson/customer branding, saves to Drive, and records the interaction.
 *
 * Unlike Touch 1 (which has a two-step review), Touch 2 generates directly
 * without an intermediate seller review step. The seller reviews the final
 * deck via iframe preview and can regenerate with tweaked inputs.
 *
 * Steps: selectSlides -> assembleDeck -> recordInteraction
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { selectSlidesForDeck } from "../../lib/slide-selection";
import { assembleDeckFromSlides } from "../../lib/deck-customizer";
import { getOrCreateDealFolder } from "../../lib/drive-folders";
import { ingestGeneratedDeck } from "../../lib/ingestion-pipeline";
import { prisma } from "../../lib/db";
import { env } from "../../env";

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
});

const selectSlidesOutputSchema = z.object({
  dealId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  salespersonName: z.string().optional(),
  salespersonPhotoUrl: z.string().optional(),
  customerName: z.string().optional(),
  customerLogoUrl: z.string().optional(),
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
// Step 1: Select slides via AI
// ────────────────────────────────────────────────────────────

const selectSlides = createStep({
  id: "select-slides",
  inputSchema,
  outputSchema: selectSlidesOutputSchema,
  execute: async ({ inputData }) => {
    const result = await selectSlidesForDeck({
      touchType: "touch_2",
      companyName: inputData.companyName,
      industry: inputData.industry,
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
    const deckName = `${inputData.companyName} - Meet Lumenalta - ${dateStr}`;

    // Use Meet Lumenalta source presentation or fall back to the general template
    const sourcePresentationId =
      env.MEET_LUMENALTA_PRESENTATION_ID || env.GOOGLE_TEMPLATE_PRESENTATION_ID;

    const result = await assembleDeckFromSlides({
      sourcePresentationId,
      selectedSlideIds: inputData.selectedSlideIds,
      slideOrder: inputData.slideOrder,
      targetFolderId: folderId,
      deckName,
      customizations: {
        salespersonName: inputData.salespersonName,
        salespersonPhotoUrl: inputData.salespersonPhotoUrl,
        customerName: inputData.customerName,
        customerLogoUrl: inputData.customerLogoUrl,
      },
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
    // Touch 2/3 are direct generation — status is "approved" (no intermediate review)
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: inputData.dealId,
        touchType: "touch_2",
        status: "approved",
        decision: "approved",
        inputs: JSON.stringify({
          companyName: inputData.companyName,
          industry: inputData.industry,
          salespersonName: inputData.salespersonName,
          salespersonPhotoUrl: inputData.salespersonPhotoUrl,
          customerName: inputData.customerName,
          customerLogoUrl: inputData.customerLogoUrl,
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

    // Create positive feedback signal (direct generation = approved)
    await prisma.feedbackSignal.create({
      data: {
        interactionId: interaction.id,
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
      interactionId: interaction.id,
      presentationId: inputData.presentationId,
      driveUrl: inputData.driveUrl,
    };
  },
});

// ────────────────────────────────────────────────────────────
// Workflow: Touch 2 Meet Lumenalta Intro Deck
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
  .then(assembleDeck)
  .then(recordInteraction)
  .commit();
