/**
 * Re-run LLM generation for the current HITL stage of an interaction.
 *
 * Instead of starting a brand-new workflow (which always begins at skeleton),
 * this function directly calls the LLM agent to regenerate content for
 * whichever stage the interaction is currently on, then updates stageContent.
 */

import { z } from "zod";
import {
  PagerContentLlmSchema,
  ContentSlotDraftSchema,
  zodToLlmJsonSchema,
} from "@lumenalta/schemas";
import { executeRuntimeNamedAgent as executeNamedAgent } from "./agent-executor";
import { assertLlmContentQuality } from "./validate-llm-content";
import {
  loadDeckSectionsForSlotAnalysis,
  deriveSectionSlotCounts,
  formatSectionsWithSlotsForPrompt,
} from "./deck-structure-loader";
import type { SectionSlotCounts } from "./deck-structure-loader";
import { resolveGenerationStrategy, executeStructureDrivenPipeline, buildDealContext } from "../generation/route-strategy";
import { selectSlidesForDeck } from "./slide-selection";
import { prisma } from "./db";
import { getOrCreateDealFolder, resolveRootFolderId, shareWithOrg, archiveExistingFile } from "./drive-folders";
import { ingestGeneratedDeck } from "./ingestion-pipeline";
import { env } from "../env";
import { buildLogKey, createStepLogger, clearLogs } from "../generation/generation-logger";

export async function regenerateStage(
  interactionId: string,
  feedback?: string,
  wipeData?: boolean
): Promise<{ success: boolean; stage: string }> {
  const interaction = await prisma.interactionRecord.findUniqueOrThrow({
    where: { id: interactionId },
    include: { deal: { include: { company: true } } },
  });

  // Wipe all prior data if requested -- reset to clean skeleton state
  if (wipeData) {
    // Delete all feedback signals for this interaction
    await prisma.feedbackSignal.deleteMany({
      where: { interactionId },
    });

    // Reset all generated artifacts
    await prisma.interactionRecord.update({
      where: { id: interactionId },
      data: {
        stageContent: null,
        generatedContent: null,
        driveFileId: null,
        outputRefs: null,
        hitlStage: "skeleton",
        status: "processing",
      },
    });
  }

  // If wipeData was requested, force stage to skeleton regardless of prior state
  const stage = wipeData ? "skeleton" : (interaction.hitlStage ?? "skeleton");
  const inputs = JSON.parse(interaction.inputs ?? "{}");
  const companyName = inputs.companyName ?? interaction.deal?.company?.name ?? "Unknown";
  const industry = inputs.industry ?? "Technology";
  const context = inputs.context ?? "";
  const salespersonName = inputs.salespersonName;

  if (stage === "skeleton") {
    const touchType = interaction.touchType;

    if (touchType === "touch_2" || touchType === "touch_3") {
      // Touch 2/3: Re-run slide selection (same logic as workflow selectSlides step)
      const result = await selectSlidesForDeck({
        touchType: touchType as "touch_2" | "touch_3",
        companyName,
        industry,
        context: context || undefined,
        ...(touchType === "touch_3" && inputs.capabilityAreas
          ? { capabilityAreas: inputs.capabilityAreas }
          : {}),
      });

      const skeletonContent = {
        selectedSlideIds: result.selectedSlideIds,
        slideOrder: result.slideOrder,
        selectionRationale: `Selected ${result.selectedSlideIds.length} slides for ${companyName} in ${industry}. ${result.personalizationNotes}`,
        personalizationNotes: result.personalizationNotes,
      };

      await prisma.interactionRecord.update({
        where: { id: interactionId },
        data: { stageContent: JSON.stringify(skeletonContent) },
      });
    } else {
      // Touch 1 (and default): Regenerate pager outline
      const prompt = buildSkeletonPrompt(companyName, industry, context, salespersonName, feedback);
      const SkeletonContentSchema = z.object({
        companyName: z.string(),
        headline: z.string(),
        valueProposition: z.string(),
        keyCapabilities: z.array(z.string()),
      });

      const response = await executeNamedAgent({
        agentId: "first-contact-pager-writer",
        messages: [{ role: "user", content: prompt }],
        options: {
          structuredOutput: {
            schema: zodToLlmJsonSchema(SkeletonContentSchema) as Record<string, unknown>,
          },
        },
      });

      const parsed = SkeletonContentSchema.parse(
        response.object ?? JSON.parse(response.text ?? "{}")
      );
      assertLlmContentQuality(parsed);

      await prisma.interactionRecord.update({
        where: { id: interactionId },
        data: { stageContent: JSON.stringify(parsed) },
      });
    }
  } else if (stage === "lowfi") {
    // Regenerate draft from existing skeleton
    // The skeleton was approved earlier, so look at the previous stageContent
    // or reconstruct from the interaction's generatedContent/inputs
    const skeletonContent = await getApprovedSkeleton(interaction);

    // Check if DeckStructure sections are available for section-aware drafting
    const slotData = await loadDeckSectionsForSlotAnalysis("touch_1");

    if (slotData && slotData.sections.length > 0) {
      const deckSections = slotData.sections;
      const slotCounts = deriveSectionSlotCounts(deckSections, slotData.elementsBySlideId);

      // Section-aware regeneration with structured slots
      const sectionAwarePrompt = buildSectionAwareDraftPrompt(
        companyName, industry, context, salespersonName, skeletonContent,
        deckSections, slotCounts, slotData.elementsBySlideId, feedback,
      );

      const response = await executeNamedAgent<z.infer<typeof ContentSlotDraftSchema>>({
        agentId: "first-contact-pager-writer",
        messages: [{ role: "user", content: sectionAwarePrompt }],
        options: {
          structuredOutput: {
            schema: zodToLlmJsonSchema(ContentSlotDraftSchema) as Record<string, unknown>,
          },
        },
      });

      const parsed = ContentSlotDraftSchema.parse(
        response.object ?? JSON.parse(response.text ?? "{}"),
      );
      assertLlmContentQuality(parsed);

      await prisma.interactionRecord.update({
        where: { id: interactionId },
        data: { stageContent: JSON.stringify(parsed) },
      });
    } else {
      // Legacy regeneration
      const prompt = buildDraftPrompt(companyName, industry, context, salespersonName, skeletonContent, feedback);

      const response = await executeNamedAgent<z.infer<typeof PagerContentLlmSchema>>({
        agentId: "first-contact-pager-writer",
        messages: [{ role: "user", content: prompt }],
        options: {
          structuredOutput: {
            schema: zodToLlmJsonSchema(PagerContentLlmSchema) as Record<string, unknown>,
          },
        },
      });

      const parsed = PagerContentLlmSchema.parse(
        response.object ?? JSON.parse(response.text ?? "{}")
      );
      assertLlmContentQuality(parsed);

      await prisma.interactionRecord.update({
        where: { id: interactionId },
        data: { stageContent: JSON.stringify(parsed) },
      });
    }
  } else if (stage === "highfi") {
    // Regenerate the Google Slides deck from approved draft content
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: interaction.dealId },
      include: { company: true },
    });

    // Get the approved draft content, or re-generate it from the skeleton
    let draftContent: z.infer<typeof PagerContentLlmSchema>;
    try {
      draftContent = await getApprovedDraft(interaction);
    } catch {
      // Draft not persisted (pre-fix interactions) — re-generate from skeleton via LLM
      console.log("[regenerate-stage] Draft not found, re-generating from skeleton via LLM");
      const skeleton = await getApprovedSkeleton(interaction);
      const prompt = buildDraftPrompt(companyName, industry, context, salespersonName, skeleton, feedback);
      const response = await executeNamedAgent<z.infer<typeof PagerContentLlmSchema>>({
        agentId: "first-contact-pager-writer",
        messages: [{ role: "user", content: prompt }],
        options: {
          structuredOutput: {
            schema: zodToLlmJsonSchema(PagerContentLlmSchema) as Record<string, unknown>,
          },
        },
      });
      draftContent = PagerContentLlmSchema.parse(
        response.object ?? JSON.parse(response.text ?? "{}")
      );
      assertLlmContentQuality(draftContent);
    }

    const deckName = `Touch 1 Pager - ${companyName} - ${new Date().toISOString().split("T")[0]}`;

    // Route via structure-driven pipeline (no legacy fallback)
    const dealContext = buildDealContext("touch_1", {
      dealId: interaction.dealId,
      companyName,
      industry,
    });
    const strategy = await resolveGenerationStrategy("touch_1", null, dealContext);

    if (strategy.type === "legacy") {
      throw new Error("[regenerate-stage] No DeckStructure/blueprint found for touch_1. Register an example presentation first.");
    }

    const result = await executeStructureDrivenPipeline({
      blueprint: strategy.blueprint,
      targetFolderId: "",
      deckName,
      dealContext,
      draftContent,
      ownerEmail: deal.ownerEmail ?? undefined,
    });

    // Update stageContent with new presentation and persist draft for future regeneration
    await prisma.interactionRecord.update({
      where: { id: interactionId },
      data: {
        stageContent: JSON.stringify({
          presentationId: result.presentationId,
          driveUrl: result.driveUrl,
          modificationPlans: result.modificationPlans,
        }),
        generatedContent: JSON.stringify(draftContent),
        driveFileId: result.presentationId,
      },
    });
  } else {
    throw new Error(`Regeneration not supported for stage: ${stage}`);
  }

  return { success: true, stage };
}

// ────────────────────────────────────────────────────────────
// Retry generation from failed step
// ────────────────────────────────────────────────────────────

/**
 * Retry generation for a failed interaction, resuming from the last completed HITL stage.
 *
 * When a workflow dies mid-execution (e.g., transient DB error at assemble-deck),
 * the InteractionRecord preserves the approved stage data (hitlStage + stageContent).
 * This function re-runs just the remaining steps (assemble + record) without
 * requiring the user to re-approve already-approved stages.
 *
 * Supports Touch 2 and Touch 3 workflows (which share the assemble-deck pattern).
 * Returns a runId so the UI can poll for status.
 */
export async function retryGeneration(
  interactionId: string,
): Promise<{ success: boolean; runId: string; interactionId: string }> {
  const interaction = await prisma.interactionRecord.findUniqueOrThrow({
    where: { id: interactionId },
    include: { deal: { include: { company: true } } },
  });

  const touchType = interaction.touchType;
  if (touchType !== "touch_2" && touchType !== "touch_3") {
    throw new Error(`Retry generation not supported for ${touchType}. Only touch_2 and touch_3 support resume-from-failure.`);
  }

  const hitlStage = interaction.hitlStage;
  if (!hitlStage || !interaction.stageContent) {
    throw new Error("Cannot retry: no approved stage data found. Please start a new generation.");
  }

  // Only retry when the workflow failed after lowfi approval (assemble-deck or later)
  if (hitlStage !== "lowfi") {
    throw new Error(`Cannot retry from stage "${hitlStage}". Retry is only supported when the deck assembly step failed (hitlStage=lowfi).`);
  }

  const inputs = JSON.parse(interaction.inputs ?? "{}");
  const companyName = inputs.companyName ?? interaction.deal?.company?.name ?? "Unknown";
  const industry = inputs.industry ?? "Technology";
  const stageContent = JSON.parse(interaction.stageContent);

  // The lowfi stageContent contains the approved slide order
  const selectedSlideIds: string[] = stageContent.slideOrder ?? [];
  const personalizationNotes: string = stageContent.personalizationNotes ?? "";

  if (selectedSlideIds.length === 0) {
    throw new Error("Cannot retry: no selected slides found in stage content.");
  }

  // Reset interaction to in_progress for the retry
  const runId = crypto.randomUUID();
  await prisma.interactionRecord.update({
    where: { id: interactionId },
    data: { status: "in_progress" },
  });

  const logKey = buildLogKey(interaction.dealId, touchType);
  const logger = createStepLogger("retry-generation", logKey);
  logger.log("Retrying deck generation from approved outline...");

  try {
    // ── Replicate assemble-deck step logic ──
    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: interaction.dealId },
      include: { company: true },
    });

    const rootFolderId = await resolveRootFolderId(deal.ownerId ?? undefined);
    const folderId = await getOrCreateDealFolder({
      companyName: deal.company.name,
      dealName: deal.name,
      parentFolderId: rootFolderId,
    });

    if (!deal.driveFolderId) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { driveFolderId: folderId },
      });
    }

    // Archive previous file if re-generating
    const existingInteraction = await prisma.interactionRecord.findFirst({
      where: { dealId: interaction.dealId, touchType, driveFileId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { driveFileId: true },
    });
    if (existingInteraction?.driveFileId) {
      try {
        await archiveExistingFile({ dealFolderId: folderId, fileId: existingInteraction.driveFileId });
      } catch (err) {
        console.warn(`[retry-generation] Archive failed, continuing:`, err);
      }
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const deckLabel = touchType === "touch_2" ? "Meet Lumenalta" : "Capabilities Deep Dive";
    const deckName = `${companyName} - ${deckLabel} - ${dateStr}`;

    const dealContext = buildDealContext(touchType, {
      dealId: interaction.dealId,
      companyName,
      industry,
      priorTouchOutputs: inputs.priorTouchOutputs,
    });
    const strategy = await resolveGenerationStrategy(touchType, null, dealContext);

    if (strategy.type === "legacy") {
      throw new Error(`No DeckStructure/blueprint found for ${touchType}. Register an example presentation first.`);
    }

    logger.log("Starting structure-driven pipeline...");
    const result = await executeStructureDrivenPipeline({
      blueprint: strategy.blueprint,
      targetFolderId: folderId,
      deckName,
      dealContext,
      ownerEmail: deal.ownerEmail ?? undefined,
      logKey,
    });

    if (deal.ownerEmail) {
      await shareWithOrg({ fileId: result.presentationId, ownerEmail: deal.ownerEmail });
    }

    // ── Replicate record-interaction step logic ──
    logger.log("Saving final deck and recording interaction...");

    await prisma.interactionRecord.update({
      where: { id: interactionId },
      data: {
        status: "approved",
        decision: "approved",
        hitlStage: "ready",
        stageContent: JSON.stringify({
          presentationId: result.presentationId,
          driveUrl: result.driveUrl,
          modificationPlans: result.modificationPlans,
        }),
        generatedContent: JSON.stringify({
          selectedSlideIds,
          slideOrder: selectedSlideIds,
          personalizationNotes,
        }),
        outputRefs: JSON.stringify([result.driveUrl]),
        driveFileId: result.presentationId,
      },
    });

    await prisma.feedbackSignal.create({
      data: {
        interactionId,
        signalType: "positive",
        source: `${touchType}_retry_generate`,
        content: JSON.stringify({
          selectedSlideIds,
          personalizationNotes,
        }),
      },
    });

    // Ingest generated deck into AtlusAI (non-blocking)
    try {
      await ingestGeneratedDeck({
        presentationId: result.presentationId,
        deckName: `${companyName} - ${deckLabel}`,
        dealContext: {
          companyName,
          industry,
          touchType,
          decision: "approved",
        },
        driveFolderId: env.GOOGLE_DRIVE_FOLDER_ID,
      });
    } catch (err) {
      console.error("[retry-generation] AtlusAI ingestion failed:", err);
    }

    logger.log("Deck generation complete — ready for review!");
    clearLogs(logKey);

    return { success: true, runId, interactionId };
  } catch (err) {
    // Mark as failed again if retry also fails
    await prisma.interactionRecord.update({
      where: { id: interactionId },
      data: { status: "failed" },
    });
    logger.log(`Retry failed: ${err instanceof Error ? err.message : String(err)}`);
    clearLogs(logKey);
    throw err;
  }
}

// ────────────────────────────────────────────────────────────
// Prompt builders (match the workflow step prompts)
// ────────────────────────────────────────────────────────────

function buildSkeletonPrompt(
  companyName: string,
  industry: string,
  context: string,
  salespersonName?: string,
  feedback?: string
): string {
  let prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Generate a CONTENT OUTLINE (skeleton) for a pager targeting this company.

Company: ${companyName}
Industry: ${industry}
Additional Context: ${context}
${salespersonName ? `Salesperson: ${salespersonName}` : ""}

Generate a content outline with:
- A compelling headline tailored to the company's industry and situation
- A clear value proposition connecting Lumenalta's capabilities to the company's needs
- 3-5 key Lumenalta capabilities most relevant to this company (as brief bullet points)

Keep the tone professional but engaging. Focus on the company's likely challenges based on their industry.
This is a SKELETON outline -- concise summaries, not full paragraphs.`;

  if (feedback) {
    prompt += `\n\nUser feedback for regeneration: ${feedback}`;
  }
  return prompt;
}

function buildDraftPrompt(
  companyName: string,
  industry: string,
  context: string,
  salespersonName: string | undefined,
  skeleton: { headline: string; valueProposition: string; keyCapabilities: string[] },
  feedback?: string
): string {
  let prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Based on the approved content outline below, generate the FULL DRAFT TEXT for the pager.

Company: ${companyName}
Industry: ${industry}
Additional Context: ${context}
${salespersonName ? `Salesperson: ${salespersonName}` : ""}

APPROVED OUTLINE:
- Headline: ${skeleton.headline}
- Value Proposition: ${skeleton.valueProposition}
- Key Capabilities: ${skeleton.keyCapabilities.join(", ")}

Now expand this outline into a complete, polished pager with:
- The headline (can be refined from the outline)
- A fully written value proposition paragraph
- Expanded capability descriptions
- A specific call to action for the next step

Keep the tone professional but engaging. This is the FULL DRAFT -- complete, publication-ready text.`;

  if (feedback) {
    prompt += `\n\nUser feedback for regeneration: ${feedback}`;
  }
  return prompt;
}

function buildSectionAwareDraftPrompt(
  companyName: string,
  industry: string,
  context: string,
  salespersonName: string | undefined,
  skeleton: { headline: string; valueProposition: string; keyCapabilities: string[] },
  deckSections: import("../deck-intelligence/deck-structure-schema").DeckSection[],
  slotCounts: SectionSlotCounts[],
  elementsBySlideId: Map<string, import("./deck-structure-loader").SlotAnalysisElement[]>,
  feedback?: string,
): string {
  let prompt = `You are creating a first-contact one-pager for Lumenalta, a technology consulting and software development company. Based on the approved outline and the TEMPLATE STRUCTURE below, generate structured content slots for each template section.

Company: ${companyName}
Industry: ${industry}
Additional Context: ${context}
${salespersonName ? `Salesperson: ${salespersonName}` : ""}

APPROVED OUTLINE:
- Headline: ${skeleton.headline}
- Value Proposition: ${skeleton.valueProposition}
- Key Capabilities: ${skeleton.keyCapabilities.join(", ")}

TEMPLATE STRUCTURE (generate content for EACH section):
${formatSectionsWithSlotsForPrompt(slotCounts, deckSections, elementsBySlideId)}

For each section, generate structured content matching the slot counts:
- headlines: Array of headline strings (large/bold text)
- bodyParagraphs: Array of narrative text blocks
- metrics: Array of objects with {value, label} (quantitative proof points)
- bulletPoints: Array of capability/feature items
- speakerNotes: Brief talking points for the presenter

Generate EXACTLY the number of items specified for each content type. Content must be tailored to the target company and fit the section's purpose.
Also provide an overall headline, call to action, contactName, and contactRole (empty string if unknown).`;

  if (feedback) {
    prompt += `\n\nUser feedback for regeneration: ${feedback}`;
  }
  return prompt;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function getApprovedDraft(
  interaction: { id: string; stageContent: string | null; generatedContent: string | null; dealId: string }
): Promise<z.infer<typeof PagerContentLlmSchema>> {
  // Try generatedContent first (set after full workflow completion)
  if (interaction.generatedContent) {
    try {
      return PagerContentLlmSchema.parse(JSON.parse(interaction.generatedContent));
    } catch {
      // fall through
    }
  }

  // Look for approved draft in feedback signals
  const signals = await prisma.feedbackSignal.findMany({
    where: { interactionId: interaction.id },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });

  for (const signal of signals) {
    if (signal.content) {
      try {
        const parsed = JSON.parse(signal.content);
        if (parsed.finalContent) {
          return PagerContentLlmSchema.parse(parsed.finalContent);
        }
      } catch {
        // continue
      }
    }
  }

  // Fallback: find the most recent lowfi-stage interaction content
  // The lowfi stageContent would have been overwritten by highfi, so
  // look at the previous interaction record or reconstruct from inputs
  const prevInteraction = await prisma.interactionRecord.findFirst({
    where: { dealId: interaction.dealId, touchType: "touch_1" },
    orderBy: { createdAt: "desc" },
    select: { generatedContent: true },
  });

  if (prevInteraction?.generatedContent) {
    try {
      return PagerContentLlmSchema.parse(JSON.parse(prevInteraction.generatedContent));
    } catch {
      // fall through
    }
  }

  throw new Error("Could not find approved draft content for highfi regeneration");
}

async function getApprovedSkeleton(
  interaction: { id: string; stageContent: string | null; dealId: string }
): Promise<{ headline: string; valueProposition: string; keyCapabilities: string[] }> {
  // Current stageContent at lowfi IS the draft content.
  // We need the SKELETON that was approved. Look at feedback signals
  // or the previous interaction at skeleton stage.
  // Simplest: find the most recent skeleton-stage snapshot from feedbackSignals
  const signal = await prisma.feedbackSignal.findFirst({
    where: { interactionId: interaction.id },
    orderBy: { createdAt: "asc" },
    select: { content: true },
  });

  if (signal?.content) {
    try {
      const parsed = JSON.parse(signal.content);
      if (parsed.skeleton || parsed.approvedSkeleton) {
        return parsed.skeleton ?? parsed.approvedSkeleton;
      }
    } catch {
      // fall through
    }
  }

  // Fallback: parse skeleton from current stageContent (draft has all the fields)
  if (interaction.stageContent) {
    try {
      const draft = JSON.parse(interaction.stageContent);
      return {
        headline: draft.headline ?? "Untitled",
        valueProposition: draft.valueProposition ?? "",
        keyCapabilities: draft.keyCapabilities ?? [],
      };
    } catch {
      // fall through
    }
  }

  throw new Error("Could not find approved skeleton content for regeneration");
}
