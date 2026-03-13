import type {
  DealContext,
  GenerationBlueprint,
  SlideMetadata,
  SlideSelectionEntry,
  SlideSelectionPlan,
} from "@lumenalta/schemas";

import { generateEmbedding } from "../ingestion/embed-slide";
import { prisma } from "../lib/db";
import type {
  BlueprintWithCandidates,
  ResolvedCandidate,
} from "./blueprint-resolver";

const WEIGHTS = {
  industry: 3,
  pillar: 3,
  persona: 2,
  funnelStage: 2,
} as const;

interface ScoredCandidate {
  candidate: ResolvedCandidate;
  metadataScore: number;
  rationaleParts: string[];
}

export interface SectionMatchResult {
  plan: SlideSelectionPlan;
  blueprint: GenerationBlueprint;
}

export async function selectSlidesForBlueprint(
  input: BlueprintWithCandidates,
  onLog?: (message: string, detail?: string) => void,
): Promise<SectionMatchResult> {
  const blueprint: GenerationBlueprint = {
    ...input.blueprint,
    sections: input.blueprint.sections.map((section) => ({ ...section })),
  };
  const selections: SlideSelectionEntry[] = [];

  let cachedEmbedding: number[] | null = null;

  // Track already-selected slide IDs to avoid duplicates across sections
  const usedSlideIds = new Set<string>();

  // ── Single-source constraint ──────────────────────────────────────────
  // The Google Slides API cannot copy individual slides between presentations
  // with full visual fidelity (backgrounds, images, gradients are lost).
  // To guarantee quality, we force ALL selections from ONE source presentation.
  //
  // Strategy:
  // 1. First pass: determine which source has the most candidates across all sections
  // 2. Second pass: select slides constrained to that single source
  const primaryPresentationId = determinePrimarySource(input);
  console.log(`[section-matcher] Single-source mode: locked to presentationId=${primaryPresentationId}`);

  for (const section of blueprint.sections) {
    if (section.candidateSlideIds.length === 0) {
      continue;
    }

    // How many slides to select for this section
    const slideCount = Math.max(1, section.typicalSlideCount ?? 1);

    const filteredIds = excludePriorTouchSlides(
      section.candidateSlideIds,
      blueprint.dealContext.priorTouchSlideIds,
    );
    const candidateIds =
      filteredIds.length > 0 ? filteredIds : section.candidateSlideIds;

    // Also exclude slides already selected in other sections
    const availableIds = candidateIds.filter((id) => !usedSlideIds.has(id));
    const idsToUse = availableIds.length > 0 ? availableIds : candidateIds;

    // Resolve candidates and filter to primary source only
    let candidates = idsToUse
      .map((id) => input.candidates.get(id))
      .filter((candidate): candidate is ResolvedCandidate => Boolean(candidate));

    const primaryCandidates = candidates.filter(
      (c) => c.presentationId === primaryPresentationId,
    );

    // Use primary-only candidates; SKIP section entirely if primary has zero.
    // Secondary slides are rebuilt element-by-element and lose all visual design
    // (backgrounds, images, gradients), so they look broken. Better to omit a
    // section than include a visually broken slide.
    if (primaryCandidates.length > 0) {
      candidates = primaryCandidates;
    } else {
      console.log(
        `[section-matcher] Section "${section.sectionName}": SKIPPING — no candidates from primary source (secondary slides lose visual fidelity)`,
      );
      continue;
    }

    if (candidates.length === 0) {
      continue;
    }

    // Select up to slideCount slides for this section
    const remainingCandidates = [...candidates];
    let selectedForSection = 0;

    for (let i = 0; i < slideCount && remainingCandidates.length > 0; i++) {
      const scored = remainingCandidates.map((candidate) =>
        scoreCandidate(candidate, blueprint.dealContext),
      );

      const selected = await selectBestCandidate(scored, blueprint.dealContext, async () => {
        if (cachedEmbedding === null) {
          cachedEmbedding = await generateEmbedding(
            buildDealContextText(blueprint.dealContext),
          );
        }
        return cachedEmbedding;
      });

      // Set on the section slot for the first selection
      if (i === 0) {
        section.selectedSlideId = selected.candidate.slideId;
        section.sourcePresentationId = selected.candidate.presentationId;
      }

      usedSlideIds.add(selected.candidate.slideId);
      selectedForSection++;

      selections.push({
        sectionName: section.sectionName,
        slideId: selected.candidate.slideId,
        slideObjectId: selected.candidate.slideObjectId,
        sourcePresentationId: selected.candidate.presentationId,
        templateId: selected.candidate.templateId,
        matchRationale: `${selected.matchRationale}${slideCount > 1 ? ` (slide ${i + 1}/${slideCount} for section)` : ""}`,
      });

      // Remove selected candidate from remaining pool
      const idx = remainingCandidates.findIndex((c) => c.slideId === selected.candidate.slideId);
      if (idx >= 0) remainingCandidates.splice(idx, 1);
    }

    if (slideCount > 1) {
      console.log(`[section-matcher] Section "${section.sectionName}": selected ${selectedForSection}/${slideCount} slides (${candidates.length} candidates available)`);
    }
  }

  // Log source distribution
  const sourceCounts = new Map<string, number>();
  for (const sel of selections) {
    sourceCounts.set(sel.sourcePresentationId, (sourceCounts.get(sel.sourcePresentationId) ?? 0) + 1);
  }
  for (const [src, count] of sourceCounts) {
    console.log(`[section-matcher] Source ${src}: ${count} slides selected${src === primaryPresentationId ? " (PRIMARY)" : " (SECONDARY - will need rebuild)"}`);
  }

  return {
    plan: { selections },
    blueprint,
  };
}

/**
 * Determine which source presentation covers the most sections.
 * This becomes the single source for the entire deck, ensuring visual fidelity
 * since the Google Slides API can only preserve full visuals via whole-deck copy.
 */
function determinePrimarySource(input: BlueprintWithCandidates): string {
  // Count how many sections each presentation can serve
  const presentationSectionCoverage = new Map<string, Set<string>>();
  // Also count total candidate slides per presentation
  const presentationCandidateCount = new Map<string, number>();

  for (const section of input.blueprint.sections) {
    for (const slideId of section.candidateSlideIds) {
      const candidate = input.candidates.get(slideId);
      if (!candidate) continue;

      const pid = candidate.presentationId;
      if (!presentationSectionCoverage.has(pid)) {
        presentationSectionCoverage.set(pid, new Set());
      }
      presentationSectionCoverage.get(pid)!.add(section.sectionName);
      presentationCandidateCount.set(pid, (presentationCandidateCount.get(pid) ?? 0) + 1);
    }
  }

  // Pick the presentation that covers the most sections,
  // breaking ties by total candidate count (more candidates = more choices)
  let bestPid = "";
  let bestSectionCount = 0;
  let bestCandidateCount = 0;

  for (const [pid, sections] of presentationSectionCoverage) {
    const sectionCount = sections.size;
    const candidateCount = presentationCandidateCount.get(pid) ?? 0;
    if (
      sectionCount > bestSectionCount ||
      (sectionCount === bestSectionCount && candidateCount > bestCandidateCount)
    ) {
      bestPid = pid;
      bestSectionCount = sectionCount;
      bestCandidateCount = candidateCount;
    }
  }

  console.log(
    `[section-matcher] Primary source selection: ${bestPid} covers ${bestSectionCount} sections with ${bestCandidateCount} candidates`,
  );
  for (const [pid, sections] of presentationSectionCoverage) {
    if (pid !== bestPid) {
      console.log(
        `[section-matcher]   runner-up: ${pid} covers ${sections.size} sections with ${presentationCandidateCount.get(pid) ?? 0} candidates`,
      );
    }
  }

  return bestPid;
}

function excludePriorTouchSlides(
  candidateIds: string[],
  priorTouchSlideIds: string[],
): string[] {
  const excluded = new Set(priorTouchSlideIds);
  return candidateIds.filter((id) => !excluded.has(id));
}

function scoreCandidate(
  candidate: ResolvedCandidate,
  ctx: DealContext,
): ScoredCandidate {
  const metadata = parseMetadata(candidate.classificationJson);
  if (!metadata) {
    return {
      candidate,
      metadataScore: 0,
      rationaleParts: [],
    };
  }

  let metadataScore = 0;
  const rationaleParts: string[] = [];

  if (metadata.industries?.includes(ctx.industry as never)) {
    metadataScore += WEIGHTS.industry;
    rationaleParts.push(`Industry match (${ctx.industry})`);
  }

  const pillarOverlap = ctx.pillars.filter((pillar) =>
    metadata.solutionPillars?.includes(pillar),
  ).length;
  const cappedOverlap = Math.min(pillarOverlap, 2);
  if (cappedOverlap > 0) {
    metadataScore += cappedOverlap * WEIGHTS.pillar;
    rationaleParts.push(`${cappedOverlap} pillar overlap`);
  }

  if (metadata.buyerPersonas?.includes(ctx.persona as never)) {
    metadataScore += WEIGHTS.persona;
    rationaleParts.push("persona match");
  }

  if (metadata.funnelStages?.includes(ctx.funnelStage as never)) {
    metadataScore += WEIGHTS.funnelStage;
    rationaleParts.push("funnel stage match");
  }

  return { candidate, metadataScore, rationaleParts };
}

function parseMetadata(classificationJson: string | null): SlideMetadata | null {
  if (!classificationJson) {
    return null;
  }

  try {
    return JSON.parse(classificationJson) as SlideMetadata;
  } catch {
    return null;
  }
}

async function selectBestCandidate(
  scored: ScoredCandidate[],
  ctx: DealContext,
  getCachedEmbedding: () => Promise<number[]>,
): Promise<{ candidate: ResolvedCandidate; matchRationale: string }> {
  const sorted = [...scored].sort((a, b) => b.metadataScore - a.metadataScore);
  const topScore = sorted[0]?.metadataScore ?? 0;

  if (topScore === 0) {
    return selectSparseFallback(sorted);
  }

  const tied = sorted.filter((candidate) => candidate.metadataScore === topScore);
  if (tied.length === 1) {
    return {
      candidate: tied[0]!.candidate,
      matchRationale: formatMetadataRationale(tied[0]!),
    };
  }

  const embedding = await getCachedEmbedding();
  const similarities = await fetchVectorSimilarities(
    tied.map((entry) => entry.candidate.slideId),
    embedding,
  );

  const rankedByVector = tied
    .map((entry) => ({
      ...entry,
      similarity: similarities.get(entry.candidate.slideId) ?? 0,
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const winner = rankedByVector[0]!;
  const runnerUp = rankedByVector[1];

  return {
    candidate: winner.candidate,
    matchRationale: `${formatMetadataRationale(winner)}. Tiebreaker: vector similarity ${formatNumber(
      winner.similarity,
    )} vs ${formatNumber(runnerUp?.similarity ?? 0)}`,
  };
}

function selectSparseFallback(
  scored: ScoredCandidate[],
): { candidate: ResolvedCandidate; matchRationale: string } {
  const sortedByConfidence = [...scored].sort(
    (a, b) => (b.candidate.confidence ?? 0) - (a.candidate.confidence ?? 0),
  );

  const winner = sortedByConfidence[0]!;
  const confidence = winner.candidate.confidence ?? 0;

  if (confidence > 0) {
    return {
      candidate: winner.candidate,
      matchRationale: `Fallback: highest confidence (${formatNumber(confidence)})`,
    };
  }

  return {
    candidate: scored[0]!.candidate,
    matchRationale: "Fallback: first available candidate",
  };
}

function formatMetadataRationale(scored: ScoredCandidate): string {
  if (scored.rationaleParts.length === 0) {
    return `Score: ${scored.metadataScore}`;
  }

  return `${scored.rationaleParts.join(" + ")}. Score: ${scored.metadataScore}`;
}

async function fetchVectorSimilarities(
  slideIds: string[],
  queryVector: number[],
): Promise<Map<string, number>> {
  if (slideIds.length === 0) {
    return new Map();
  }

  const vectorString = `[${queryVector.join(",")}]`;
  const rows = await prisma.$queryRaw<Array<{ id: string; similarity: number }>>`
    SELECT id, 1 - (embedding <=> ${vectorString}::vector) AS similarity
    FROM "SlideEmbedding"
    WHERE id = ANY(${slideIds})
      AND archived = false
  `;

  return new Map(
    rows.map((row: { id: string; similarity: number }) => [
      row.id,
      Number(row.similarity),
    ]),
  );
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function buildDealContextText(ctx: DealContext): string {
  return [ctx.industry, ...ctx.pillars, ctx.persona, ctx.funnelStage, ctx.companyName]
    .filter(Boolean)
    .join(" | ");
}
