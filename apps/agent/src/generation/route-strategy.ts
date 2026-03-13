/**
 * Route Strategy — Three-Way Generation Routing + Pipeline Orchestration
 *
 * Phase 57 Plan 01: Routes all 4 touch workflows through either the
 * structure-driven generation pipeline (when a DeckStructure exists with
 * sufficient confidence) or the legacy generation path (when it does not).
 *
 * Exports:
 *   - resolveGenerationStrategy: Three-way routing decision
 *   - buildDealContext: Constructs DealContext from touch workflow inputs
 *   - executeStructureDrivenPipeline: Full 6-step pipeline orchestration
 */

import type { ArtifactType, DealContext, SlideSelectionPlan, TranscriptInsight } from "@lumenalta/schemas";

import { prisma } from "../lib/db";
import { getPooledGoogleAuth } from "../lib/google-auth";
import {
  resolveBlueprint,
  type BlueprintWithCandidates,
} from "./blueprint-resolver";
import {
  calculateConfidence,
  type ConfidenceResult,
} from "../deck-intelligence/deck-structure-schema";
import { resolveDeckStructureKey } from "../deck-intelligence/deck-structure-key";
import { selectSlidesForBlueprint } from "./section-matcher";
import {
  buildMultiSourcePlan,
  assembleMultiSourceDeck,
} from "./multi-source-assembler";
import { planSlideModifications } from "./modification-planner";
import { executeModifications } from "./modification-executor";
import type { ModificationPlan } from "./modification-plan-schema";
import type { AssembleDeckResult } from "../lib/deck-customizer";
import { buildLogKey, createStepLogger, type StepLogger } from "./generation-logger";

// ────────────────────────────────────────────────────────────
// Exported Types
// ────────────────────────────────────────────────────────────

export type GenerationStrategy =
  | { type: "legacy" }
  | { type: "structure-driven"; blueprint: BlueprintWithCandidates; confidence: ConfidenceResult }
  | { type: "low-confidence"; blueprint: BlueprintWithCandidates; confidence: ConfidenceResult };

// ────────────────────────────────────────────────────────────
// resolveGenerationStrategy
// ────────────────────────────────────────────────────────────

/**
 * Three-way routing decision for deck generation.
 *
 * 1. If no DeckStructure/blueprint exists -> "legacy"
 * 2. If DeckStructure exists with green confidence -> "structure-driven"
 * 3. If DeckStructure exists with yellow/red confidence -> "low-confidence"
 */
export async function resolveGenerationStrategy(
  touchType: string,
  artifactType: ArtifactType | null,
  dealContext: DealContext,
): Promise<GenerationStrategy> {
  const key = resolveDeckStructureKey(touchType, artifactType);

  const blueprint = await resolveBlueprint(key, dealContext);
  if (!blueprint) {
    return { type: "legacy" };
  }

  // Query exampleCount for confidence calculation
  const deckStructure = await prisma.deckStructure.findFirst({
    where: { touchType: key.touchType, artifactType: key.artifactType },
    select: { exampleCount: true },
  });

  const confidence = calculateConfidence(deckStructure?.exampleCount ?? 0);

  if (confidence.color === "green") {
    return { type: "structure-driven", blueprint, confidence };
  }

  return { type: "low-confidence", blueprint, confidence };
}

// ────────────────────────────────────────────────────────────
// buildDealContext
// ────────────────────────────────────────────────────────────

const FUNNEL_STAGE_MAP: Record<string, string> = {
  touch_1: "First Contact",
  touch_2: "Intro Conversation",
  touch_3: "Capability Alignment",
  touch_4: "Solution Proposal",
};

/** Maximum number of transcript insights to include (most recent first). */
const MAX_TRANSCRIPT_INSIGHTS = 3;

/**
 * Constructs a DealContext from touch workflow inputs with sensible defaults.
 * Queries the database for transcript insights from DealContextSource and Transcript records.
 */
export async function buildDealContext(
  touchType: string,
  input: { dealId: string; companyName: string; industry: string; [key: string]: unknown },
): Promise<DealContext> {
  const capabilityAreas = input.capabilityAreas;
  const priorTouchOutputs = input.priorTouchOutputs;

  // Query transcript insights in parallel
  const transcriptInsights = await queryTranscriptInsights(input.dealId);

  return {
    dealId: input.dealId,
    companyName: input.companyName,
    industry: input.industry,
    pillars: Array.isArray(capabilityAreas) ? (capabilityAreas as string[]) : [],
    persona: "General",
    funnelStage: FUNNEL_STAGE_MAP[touchType] ?? "General",
    priorTouchSlideIds: Array.isArray(priorTouchOutputs) ? (priorTouchOutputs as string[]) : [],
    transcriptInsights,
  };
}

/**
 * Queries transcript insights from two sources:
 * 1. Transcript records (from touch 4 pipeline) — have structured extracted fields
 * 2. DealContextSource records (from deal chat) — raw/refined text as customerContext
 *
 * Returns combined insights sorted newest first, limited to MAX_TRANSCRIPT_INSIGHTS.
 */
async function queryTranscriptInsights(dealId: string): Promise<TranscriptInsight[]> {
  try {
    const [transcripts, contextSources] = await Promise.all([
      // Touch 4 transcripts with structured fields (via InteractionRecord)
      prisma.transcript.findMany({
        where: {
          interaction: { dealId },
          OR: [
            { customerContext: { not: "" } },
            { businessOutcomes: { not: "" } },
            { constraints: { not: "" } },
            { stakeholders: { not: "" } },
            { timeline: { not: "" } },
            { budget: { not: "" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: MAX_TRANSCRIPT_INSIGHTS,
        select: {
          customerContext: true,
          businessOutcomes: true,
          constraints: true,
          stakeholders: true,
          timeline: true,
          budget: true,
          createdAt: true,
        },
      }),

      // Deal chat context sources (raw transcripts)
      prisma.dealContextSource.findMany({
        where: {
          dealId,
          sourceType: "transcript",
          status: "saved",
        },
        orderBy: { createdAt: "desc" },
        take: MAX_TRANSCRIPT_INSIGHTS,
        select: {
          refinedText: true,
          rawText: true,
          createdAt: true,
        },
      }),
    ]);

    const insights: (TranscriptInsight & { _createdAt: Date })[] = [];

    // Map structured Transcript records
    for (const t of transcripts) {
      insights.push({
        source: "transcript",
        customerContext: t.customerContext,
        businessOutcomes: t.businessOutcomes,
        constraints: t.constraints,
        stakeholders: t.stakeholders,
        timeline: t.timeline,
        budget: t.budget,
        _createdAt: t.createdAt,
      });
    }

    // Map DealContextSource records (raw text as customerContext)
    for (const cs of contextSources) {
      insights.push({
        source: "context_source",
        customerContext: cs.refinedText || cs.rawText,
        businessOutcomes: "",
        constraints: "",
        stakeholders: "",
        timeline: "",
        budget: "",
        _createdAt: cs.createdAt,
      });
    }

    // Sort newest first, limit to MAX
    insights.sort((a, b) => b._createdAt.getTime() - a._createdAt.getTime());
    const limited = insights.slice(0, MAX_TRANSCRIPT_INSIGHTS);

    // Strip internal _createdAt field
    return limited.map(({ _createdAt, ...rest }) => rest);
  } catch (error) {
    // Graceful fallback: if query fails, return empty array (no transcript insights)
    console.warn("[buildDealContext] Failed to query transcript insights:", error);
    return [];
  }
}

// ────────────────────────────────────────────────────────────
// executeStructureDrivenPipeline
// ────────────────────────────────────────────────────────────

export interface DraftContent {
  headline: string;
  valueProposition: string;
  keyCapabilities: string[];
  callToAction: string;
  companyName: string;
  [key: string]: unknown;
}

export interface ExecutePipelineParams {
  blueprint: BlueprintWithCandidates;
  targetFolderId: string;
  deckName: string;
  dealContext: DealContext;
  draftContent?: DraftContent;
  ownerEmail?: string;
  /** Optional key for real-time log streaming (dealId:touchType). */
  logKey?: string;
  /** Enable visual QA post-assembly. */
  enableVisualQA?: boolean;
  /**
   * Pre-approved slide selections from HITL stages (skeleton + lowfi approval).
   * When provided, skips the AI slide selection step and uses these selections directly.
   * This ensures the final deck matches what the user approved during the HITL flow.
   */
  approvedSelections?: SlideSelectionPlan;
}

/**
 * Full 6-step structure-driven deck generation pipeline.
 *
 * 1. Select slides for blueprint sections
 * 2. Query all slides per presentation for multi-source planning
 * 3. Build multi-source plan
 * 4. Assemble multi-source deck
 * 5. Plan modifications per slide
 * 6. Execute modifications
 */
export async function executeStructureDrivenPipeline(
  params: ExecutePipelineParams,
): Promise<AssembleDeckResult & { modificationPlans: ModificationPlan[] }> {
  const { blueprint, targetFolderId, deckName, dealContext, ownerEmail, logKey } = params;
  const logger = createStepLogger("structure-pipeline", logKey);

  logger.log("Initializing generation pipeline...");

  // Use pooled user auth (user-delegated tokens) to access example presentations
  // Pool auth is REQUIRED — SA doesn't have access to org-shared template presentations
  const pooled = await getPooledGoogleAuth();
  const authOptions = pooled.accessToken ? { accessToken: pooled.accessToken } : undefined;
  console.log(`[structure-pipeline] Auth source: ${pooled.source}`);

  if (!authOptions) {
    throw new Error(
      "[structure-pipeline] No authenticated Google user available. " +
      "A connected Google account is required to access template presentations. " +
      "Please ask a team member to connect their Google account via Settings."
    );
  }

  // Step 1: Select slides for blueprint sections
  // If pre-approved selections exist (from HITL flow), use them directly
  let plan: SlideSelectionPlan;
  if (params.approvedSelections && params.approvedSelections.selections.length > 0) {
    plan = params.approvedSelections;
    const uniqueSources = new Set(plan.selections.map((s) => s.sourcePresentationId));
    logger.log(`Using ${plan.selections.length} HITL-approved slides from ${uniqueSources.size} source presentations`);
    console.log(`[structure-pipeline] Step 1: Using HITL-approved selections (${plan.selections.length} slides)`);
  } else {
    logger.log("Selecting best slides for each section...");
    const result = await selectSlidesForBlueprint(blueprint);
    plan = result.plan;
    const uniqueSources = new Set(plan.selections.map((s) => s.sourcePresentationId));
    logger.log(`Selected ${plan.selections.length} slides from ${uniqueSources.size} source presentations`);
  }

  // Step 2: Get all slides per involved presentation
  logger.log("Fetching slide data from source presentations...");
  const allSlidesByPresentation = await getAllSlidesByPresentation(plan);

  // Step 3: Build multi-source plan
  logger.log("Building multi-source assembly plan...");
  const multiSourcePlan = buildMultiSourcePlan(plan, allSlidesByPresentation);
  console.log(`[structure-pipeline] Step 3: Multi-source plan - primary=${multiSourcePlan.primarySource.presentationId}, keepSlides=[${multiSourcePlan.primarySource.keepSlideIds.join(', ')}], deleteSlides=[${multiSourcePlan.primarySource.deleteSlideIds.join(', ')}], secondarySources=${multiSourcePlan.secondarySources.length}`);
  for (const sec of multiSourcePlan.secondarySources) {
    console.log(`[structure-pipeline]   Secondary: ${sec.presentationId}, slides=[${sec.slideIds.join(', ')}]`);
  }
  logger.log(`Assembly plan ready: ${multiSourcePlan.secondarySources.length > 0 ? `merging ${multiSourcePlan.secondarySources.length + 1} presentations` : "single source"}`);

  // Step 4: Assemble the deck
  logger.log(`Assembling deck: ${deckName}...`);
  const assemblyResult = await assembleMultiSourceDeck({
    plan: multiSourcePlan,
    targetFolderId,
    deckName,
    ownerEmail,
    authOptions,
  });
  logger.log(`Deck assembled — ${plan.selections.length} slides in Google Slides`);
  console.log(`[structure-pipeline] Step 4: Assembly complete - presentationId=${assemblyResult.presentationId}`);

  // Step 5: Plan modifications for each selected slide
  // Use source slideObjectId for planning (DB elements are keyed to source IDs)
  logger.log(`Planning content modifications for ${plan.selections.length} slides...`);
  console.log(`[structure-pipeline] Step 5: Planning modifications for ${plan.selections.length} selections`);
  for (const selection of plan.selections) {
    console.log(`[structure-pipeline]   Selection: slideId=${selection.slideId}, slideObjectId=${selection.slideObjectId}, source=${selection.sourcePresentationId}, template=${selection.templateId}`);
  }

  const modificationResults = await Promise.all(
    plan.selections.map(async (selection, i) => {
      const result = await planSlideModifications({
        slideId: selection.slideId,
        slideObjectId: selection.slideObjectId,
        dealContext,
        draftContent: params.draftContent,
      });
      logger.log(`Planned slide ${i + 1}/${plan.selections.length}: ${result.plan.modifications.length} modifications`);
      return result;
    }),
  );

  const totalMods = modificationResults.reduce((s, r) => s + r.plan.modifications.length, 0);
  logger.log(`Modification planning complete: ${totalMods} total changes across ${plan.selections.length} slides`);

  console.log(`[structure-pipeline] Step 5 results:`);
  for (const r of modificationResults) {
    console.log(`[structure-pipeline]   Slide ${r.plan.slideObjectId}: usedFallback=${r.usedFallback}, modifications=${r.plan.modifications.length}, unmodified=${r.plan.unmodifiedElements.length}`);
    for (const mod of r.plan.modifications) {
      console.log(`[structure-pipeline]     Modify element ${mod.elementId}: "${mod.currentContent.slice(0, 40)}..." -> "${mod.newContent.slice(0, 40)}..."`);
    }
  }

  // Step 6: Translate objectIds for assembled presentation and execute
  // When multi-source assembly rebuilds secondary slides, element and slide
  // objectIds change. Translate the modification plans to use assembled IDs.
  const { slideIdMap, elementIdMap } = assemblyResult;

  console.log(`[structure-pipeline] Step 6: slideIdMap=${slideIdMap ? `size=${slideIdMap.size}` : 'undefined'}, elementIdMap=${elementIdMap ? `size=${elementIdMap.size}` : 'undefined'}`);
  if (slideIdMap) {
    for (const [src, dst] of slideIdMap.entries()) {
      console.log(`[structure-pipeline]   slideIdMap: ${src} -> ${dst}`);
    }
  }
  if (elementIdMap && elementIdMap.size > 0) {
    for (const [src, dst] of elementIdMap.entries()) {
      console.log(`[structure-pipeline]   elementIdMap: ${src} -> ${dst}`);
    }
  }

  const activePlans = modificationResults
    .filter((r) => !r.usedFallback && r.plan.modifications.length > 0)
    .map((r) => {
      const plan = r.plan;

      // Translate slideObjectId if it changed during assembly
      if (slideIdMap) {
        const translatedSlideId = slideIdMap.get(plan.slideObjectId);
        if (translatedSlideId && translatedSlideId !== plan.slideObjectId) {
          console.log(
            `[structure-pipeline] Translating slide objectId: ${plan.slideObjectId} -> ${translatedSlideId}`,
          );
          plan.slideObjectId = translatedSlideId;
        }
      }

      // Translate element objectIds if they changed during secondary slide rebuild
      if (elementIdMap && elementIdMap.size > 0) {
        for (const mod of plan.modifications) {
          const translatedElementId = elementIdMap.get(mod.elementId);
          if (translatedElementId) {
            console.log(
              `[structure-pipeline] Translating element objectId: ${mod.elementId} -> ${translatedElementId}`,
            );
            mod.elementId = translatedElementId;
          }
        }
      }

      return plan;
    });

  console.log(`[structure-pipeline] Active plans after filtering: ${activePlans.length}`);
  for (const p of activePlans) {
    console.log(`[structure-pipeline]   Plan for slide ${p.slideObjectId}: ${p.modifications.length} modifications`);
    for (const mod of p.modifications) {
      console.log(`[structure-pipeline]     -> element ${mod.elementId}: "${mod.newContent.slice(0, 50)}..."`);
    }
  }

  if (activePlans.length > 0) {
    logger.log(`Applying text modifications to ${activePlans.length} slides...`);
    const execResult = await executeModifications({
      presentationId: assemblyResult.presentationId,
      plans: activePlans,
      authOptions,
    });
    logger.log(`Modifications applied: ${execResult.totalApplied} changes, ${execResult.totalSkipped} skipped`);
    console.log(`[structure-pipeline] Execution result: totalApplied=${execResult.totalApplied}, totalSkipped=${execResult.totalSkipped}`);
    for (const r of execResult.results) {
      console.log(`[structure-pipeline]   Slide ${r.slideObjectId}: status=${r.status}, applied=${r.modificationsApplied}${r.error ? `, error=${r.error}` : ''}`);
    }

  } else {
    logger.log("No text modifications needed — deck is ready as-is");
    console.warn(`[structure-pipeline] WARNING: No active modification plans! All plans either used fallback or had 0 modifications.`);
  }

  logger.log("Generation complete!");

  return { ...assemblyResult, modificationPlans: activePlans };
}

// ────────────────────────────────────────────────────────────
// buildApprovedSelections — Reconstruct SlideSelectionPlan from HITL data
// ────────────────────────────────────────────────────────────

/**
 * Reconstructs a SlideSelectionPlan from HITL-approved slide IDs.
 * Looks up slideObjectId, sourcePresentationId, and templateId from the database.
 *
 * @param approvedSlideIds - Ordered list of SlideEmbedding IDs approved during HITL
 * @param sections - Optional section metadata from skeleton approval
 */
export async function buildApprovedSelections(
  approvedSlideIds: string[],
  sections?: Array<{ sectionName: string; purpose: string; selectedSlideId: string | null; rationale: string }>,
): Promise<SlideSelectionPlan> {
  if (approvedSlideIds.length === 0) {
    return { selections: [] };
  }

  // Query all slide metadata in one batch
  const slides = await prisma.slideEmbedding.findMany({
    where: { id: { in: approvedSlideIds } },
    select: {
      id: true,
      slideObjectId: true,
      templateId: true,
      template: { select: { presentationId: true } },
    },
  });

  type SlideRow = typeof slides[number];
  const slideMap = new Map<string, SlideRow>(slides.map((s: SlideRow) => [s.id, s]));

  // Build selections in the approved order
  const selections: Array<{
    sectionName: string;
    slideId: string;
    slideObjectId: string;
    sourcePresentationId: string;
    templateId: string;
    matchRationale: string;
  }> = [];

  for (const slideId of approvedSlideIds) {
    const slide = slideMap.get(slideId);
    if (!slide) {
      console.warn(`[buildApprovedSelections] Slide ${slideId} not found in DB, skipping`);
      continue;
    }

    // Find matching section from skeleton approval
    const section = sections?.find((s) => s.selectedSlideId === slideId);

    selections.push({
      sectionName: section?.sectionName ?? `Slide ${slideId}`,
      slideId: slide.id,
      slideObjectId: slide.slideObjectId ?? slide.id,
      sourcePresentationId: slide.template.presentationId,
      templateId: slide.templateId,
      matchRationale: section?.rationale ?? "HITL-approved selection",
    });
  }

  console.log(`[buildApprovedSelections] Reconstructed ${selections.length}/${approvedSlideIds.length} selections`);
  return { selections };
}

// ────────────────────────────────────────────────────────────
// Private Helpers
// ────────────────────────────────────────────────────────────

/**
 * Query all non-archived slides grouped by presentation ID.
 * Used to build the allSlidesByPresentation map for multi-source planning.
 */
async function getAllSlidesByPresentation(
  plan: SlideSelectionPlan,
): Promise<Map<string, string[]>> {
  // Get unique presentation IDs from selections via Template lookup
  const uniqueTemplateIds = [...new Set(plan.selections.map((s) => s.templateId))];

  if (uniqueTemplateIds.length === 0) {
    return new Map();
  }

  // Resolve templateId -> presentationId
  const templates = await prisma.template.findMany({
    where: { id: { in: uniqueTemplateIds } },
    select: { id: true, presentationId: true },
  });

  const templateToPresentationId = new Map<string, string>(
    templates.map((t: { id: string; presentationId: string }) => [t.id, t.presentationId]),
  );

  const uniquePresentationIds = [...new Set(templates.map((t: { id: string; presentationId: string }) => t.presentationId))];

  if (uniquePresentationIds.length === 0) {
    return new Map();
  }

  // Query all non-archived slides for these presentations
  // Returns slideObjectId (Google Slides page objectId) for use in assembly
  const allSlides = await prisma.slideEmbedding.findMany({
    where: {
      templateId: { in: uniqueTemplateIds },
      archived: false,
    },
    select: { id: true, slideObjectId: true, templateId: true },
  });

  // Group by presentationId, using slideObjectId (Google Slides objectId)
  const result = new Map<string, string[]>();
  for (const slide of allSlides as Array<{ id: string; slideObjectId: string | null; templateId: string }>) {
    const presentationId = templateToPresentationId.get(slide.templateId);
    if (!presentationId) continue;

    const objectId = slide.slideObjectId ?? slide.id;
    const existing = result.get(presentationId) ?? [];
    existing.push(objectId);
    result.set(presentationId, existing);
  }

  return result;
}
