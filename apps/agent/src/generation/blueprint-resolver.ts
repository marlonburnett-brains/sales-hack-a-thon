/**
 * Blueprint Resolver — DeckStructure -> GenerationBlueprint
 *
 * Consumes a DeckStructure (inferred per touch type in Phase 34) and
 * produces a GenerationBlueprint with candidate slides resolved to full
 * SlideEmbedding records. This is the entry point for the structure-driven
 * generation pipeline (Phases 51-57).
 *
 * Returns null when no DeckStructure exists or its sections are empty,
 * enabling Phase 57's fallback routing to legacy generation.
 *
 * Query strategy: 2 batch queries (SlideEmbedding + Template) to avoid N+1.
 * CRITICAL: No FK relation between SlideEmbedding and Template — use
 * separate batch query on Template, never `include: { template: true }`.
 */

import { prisma } from "../lib/db";
import type {
  GenerationBlueprint,
  SectionSlot,
  DealContext,
} from "@lumenalta/schemas";
import {
  resolveDeckStructureKey,
  type DeckStructureKey,
} from "../deck-intelligence/deck-structure-key";
import type { DeckStructureOutput } from "../deck-intelligence/deck-structure-schema";

// ────────────────────────────────────────────────────────────
// Exported Types
// ────────────────────────────────────────────────────────────

/**
 * Resolved candidate slide with full metadata for downstream phases.
 * Includes presentationId resolved via separate Template query.
 */
export interface ResolvedCandidate {
  slideId: string;
  templateId: string;
  presentationId: string;
  classificationJson: string | null;
  thumbnailUrl: string | null;
  confidence: number | null;
}

/**
 * Blueprint paired with resolved candidate data.
 * Candidates map is keyed by slideId for O(1) lookup by Section Matcher.
 */
export interface BlueprintWithCandidates {
  blueprint: GenerationBlueprint;
  candidates: Map<string, ResolvedCandidate>;
}

// ────────────────────────────────────────────────────────────
// Main Function
// ────────────────────────────────────────────────────────────

/**
 * Resolve a DeckStructure into a GenerationBlueprint with candidate slides.
 *
 * @param key - DeckStructureKey (touchType + artifactType)
 * @param dealContext - Deal context for the blueprint
 * @returns BlueprintWithCandidates or null if no structure exists
 */
export async function resolveBlueprint(
  key: DeckStructureKey,
  dealContext: DealContext,
): Promise<BlueprintWithCandidates | null> {
  // 1. Validate key (throws on invalid — let it propagate)
  const validatedKey = resolveDeckStructureKey(
    key.touchType,
    key.artifactType,
  );

  // 2. Query DeckStructure
  const deckStructure = await prisma.deckStructure.findFirst({
    where: {
      touchType: validatedKey.touchType,
      artifactType: validatedKey.artifactType,
    },
  });

  if (!deckStructure) return null;

  // 3. Parse structureJson
  let parsed: DeckStructureOutput;
  try {
    parsed = JSON.parse(
      deckStructure.structureJson,
    ) as DeckStructureOutput;
  } catch {
    return null;
  }

  if (!parsed.sections || parsed.sections.length === 0) return null;

  // 4. Collect all slideIds across all sections
  const allSlideIds = parsed.sections.flatMap((s) => s.slideIds);
  if (allSlideIds.length === 0) return null;

  // 5. Batch query SlideEmbeddings (non-archived only)
  const slides = await prisma.slideEmbedding.findMany({
    where: { id: { in: allSlideIds }, archived: false },
    select: {
      id: true,
      templateId: true,
      classificationJson: true,
      thumbnailUrl: true,
      confidence: true,
      slideIndex: true,
      slideObjectId: true,
    },
  });

  const slideMap = new Map(slides.map((s) => [s.id, s]));

  // 6. Batch query Templates for presentationId resolution (NO FK relation)
  const uniqueTemplateIds = [...new Set(slides.map((s) => s.templateId))];
  const templates =
    uniqueTemplateIds.length > 0
      ? await prisma.template.findMany({
          where: { id: { in: uniqueTemplateIds } },
          select: { id: true, presentationId: true },
        })
      : [];

  const templateMap = new Map(templates.map((t) => [t.id, t]));

  // 7. Build candidates Map<slideId, ResolvedCandidate>
  const candidates = new Map<string, ResolvedCandidate>();
  for (const slide of slides) {
    const template = templateMap.get(slide.templateId);
    candidates.set(slide.id, {
      slideId: slide.id,
      templateId: slide.templateId,
      presentationId: template?.presentationId ?? "",
      classificationJson: slide.classificationJson,
      thumbnailUrl: slide.thumbnailUrl,
      confidence: slide.confidence,
    });
  }

  // 8. Map DeckSection[] -> SectionSlot[], sorted by order
  const sections: SectionSlot[] = [...parsed.sections]
    .sort((a, b) => a.order - b.order)
    .map(
      (section): SectionSlot => ({
        sectionName: section.name,
        purpose: section.purpose,
        isOptional: section.isOptional,
        candidateSlideIds: section.slideIds.filter((id) =>
          slideMap.has(id),
        ),
        selectedSlideId: null,
        sourcePresentationId: null,
        hasModificationPlan: false,
      }),
    );

  // 9. Return blueprint with candidates
  const blueprint: GenerationBlueprint = {
    deckStructureId: deckStructure.id,
    touchType: validatedKey.touchType,
    artifactType: validatedKey.artifactType,
    sections,
    dealContext,
    sequenceRationale: parsed.sequenceRationale,
  };

  return { blueprint, candidates };
}
