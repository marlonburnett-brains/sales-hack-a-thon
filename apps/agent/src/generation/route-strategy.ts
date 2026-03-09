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

export interface ExecutePipelineParams {
  blueprint: BlueprintWithCandidates;
  targetFolderId: string;
  deckName: string;
  dealContext: DealContext;
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

  // Step 1: Select slides for blueprint sections
  const { plan } = await selectSlidesForBlueprint(blueprint);

  // Step 2: Get all slides per involved presentation
  const allSlidesByPresentation = await getAllSlidesByPresentation(plan);

  // Step 3: Build multi-source plan
  const multiSourcePlan = buildMultiSourcePlan(plan, allSlidesByPresentation);

  // Step 4: Assemble the deck
  const assemblyResult = await assembleMultiSourceDeck({
    plan: multiSourcePlan,
    targetFolderId,
    deckName,
    ownerEmail,
  });

  // Step 5: Plan modifications for each selected slide
  const modificationResults = await Promise.all(
    plan.selections.map((selection) =>
      planSlideModifications({
        slideId: selection.slideId,
        slideObjectId: selection.slideId,
        dealContext,
      }),
    ),
  );

  // Step 6: Execute modifications (filter out fallback/empty plans)
  const activePlans = modificationResults
    .filter((r) => !r.usedFallback && r.plan.modifications.length > 0)
    .map((r) => r.plan);

  if (activePlans.length > 0) {
    await executeModifications({
      presentationId: assemblyResult.presentationId,
      plans: activePlans,
    });
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

  const templateToPresentationId = new Map(
    templates.map((t) => [t.id, t.presentationId]),
  );

  const uniquePresentationIds = [...new Set(templates.map((t) => t.presentationId))];

  if (uniquePresentationIds.length === 0) {
    return new Map();
  }

  // Query all non-archived slides for these presentations
  const allSlides = await prisma.slideEmbedding.findMany({
    where: {
      templateId: { in: uniqueTemplateIds },
      archived: false,
    },
    select: { id: true, templateId: true },
  });

  // Group by presentationId
  const result = new Map<string, string[]>();
  for (const slide of allSlides) {
    const presentationId = templateToPresentationId.get(slide.templateId);
    if (!presentationId) continue;

    const existing = result.get(presentationId) ?? [];
    existing.push(slide.id);
    result.set(presentationId, existing);
  }

  return result;
}
