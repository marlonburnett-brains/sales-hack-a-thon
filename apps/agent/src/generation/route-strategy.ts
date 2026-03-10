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

import type { ArtifactType, DealContext, SlideSelectionPlan } from "@lumenalta/schemas";

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
import { performVisualQA } from "./visual-qa";
import type { AssembleDeckResult } from "../lib/deck-customizer";

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

/**
 * Constructs a DealContext from touch workflow inputs with sensible defaults.
 */
export function buildDealContext(
  touchType: string,
  input: { dealId: string; companyName: string; industry: string; [key: string]: unknown },
): DealContext {
  const capabilityAreas = input.capabilityAreas;
  const priorTouchOutputs = input.priorTouchOutputs;

  return {
    dealId: input.dealId,
    companyName: input.companyName,
    industry: input.industry,
    pillars: Array.isArray(capabilityAreas) ? (capabilityAreas as string[]) : [],
    persona: "General",
    funnelStage: FUNNEL_STAGE_MAP[touchType] ?? "General",
    priorTouchSlideIds: Array.isArray(priorTouchOutputs) ? (priorTouchOutputs as string[]) : [],
  };
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
): Promise<AssembleDeckResult> {
  const { blueprint, targetFolderId, deckName, dealContext, ownerEmail } = params;

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
  const { plan } = await selectSlidesForBlueprint(blueprint);

  // Step 2: Get all slides per involved presentation
  const allSlidesByPresentation = await getAllSlidesByPresentation(plan);

  // Step 3: Build multi-source plan
  const multiSourcePlan = buildMultiSourcePlan(plan, allSlidesByPresentation);
  console.log(`[structure-pipeline] Step 3: Multi-source plan - primary=${multiSourcePlan.primarySource.presentationId}, keepSlides=[${multiSourcePlan.primarySource.keepSlideIds.join(', ')}], deleteSlides=[${multiSourcePlan.primarySource.deleteSlideIds.join(', ')}], secondarySources=${multiSourcePlan.secondarySources.length}`);
  for (const sec of multiSourcePlan.secondarySources) {
    console.log(`[structure-pipeline]   Secondary: ${sec.presentationId}, slides=[${sec.slideIds.join(', ')}]`);
  }

  // Step 4: Assemble the deck
  const assemblyResult = await assembleMultiSourceDeck({
    plan: multiSourcePlan,
    targetFolderId,
    deckName,
    ownerEmail,
    authOptions,
  });
  console.log(`[structure-pipeline] Step 4: Assembly complete - presentationId=${assemblyResult.presentationId}`);

  // Step 5: Plan modifications for each selected slide
  // Use source slideObjectId for planning (DB elements are keyed to source IDs)
  console.log(`[structure-pipeline] Step 5: Planning modifications for ${plan.selections.length} selections`);
  for (const selection of plan.selections) {
    console.log(`[structure-pipeline]   Selection: slideId=${selection.slideId}, slideObjectId=${selection.slideObjectId}, source=${selection.sourcePresentationId}, template=${selection.templateId}`);
  }

  const modificationResults = await Promise.all(
    plan.selections.map((selection) =>
      planSlideModifications({
        slideId: selection.slideId,
        slideObjectId: selection.slideObjectId,
        dealContext,
        draftContent: params.draftContent,
      }),
    ),
  );

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
    const execResult = await executeModifications({
      presentationId: assemblyResult.presentationId,
      plans: activePlans,
      authOptions,
    });
    console.log(`[structure-pipeline] Execution result: totalApplied=${execResult.totalApplied}, totalSkipped=${execResult.totalSkipped}`);
    for (const r of execResult.results) {
      console.log(`[structure-pipeline]   Slide ${r.slideObjectId}: status=${r.status}, applied=${r.modificationsApplied}${r.error ? `, error=${r.error}` : ''}`);
    }

    // Step 7: Post-modification visual QA — autofit + vision-based overlap detection
    if (execResult.totalApplied > 0) {
      console.log(`[structure-pipeline] Step 7: Running visual QA on ${activePlans.length} modified slides`);
      const qaResult = await performVisualQA({
        presentationId: assemblyResult.presentationId,
        modifiedPlans: activePlans,
        authOptions,
      });
      console.log(`[structure-pipeline] Step 7 result: status=${qaResult.status}, iterations=${qaResult.iterations}${qaResult.issues ? `, issues=${qaResult.issues.length}` : ''}`);
      if (qaResult.status === "warning" && qaResult.issues) {
        console.warn(`[structure-pipeline] Visual QA warnings after ${qaResult.iterations} correction attempts:`);
        for (const issue of qaResult.issues) {
          console.warn(`[structure-pipeline]   - ${issue}`);
        }
      }
    }
  } else {
    console.warn(`[structure-pipeline] WARNING: No active modification plans! All plans either used fallback or had 0 modifications.`);
  }

  return assemblyResult;
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
