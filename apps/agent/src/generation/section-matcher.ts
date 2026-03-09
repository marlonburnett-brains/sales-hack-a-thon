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
): Promise<SectionMatchResult> {
  const blueprint: GenerationBlueprint = {
    ...input.blueprint,
    sections: input.blueprint.sections.map((section) => ({ ...section })),
  };
  const selections: SlideSelectionEntry[] = [];

  let cachedEmbedding: number[] | null = null;

  for (const section of blueprint.sections) {
    if (section.candidateSlideIds.length === 0) {
      continue;
    }

    const filteredIds = excludePriorTouchSlides(
      section.candidateSlideIds,
      blueprint.dealContext.priorTouchSlideIds,
    );
    const candidateIds =
      filteredIds.length > 0 ? filteredIds : section.candidateSlideIds;

    const candidates = candidateIds
      .map((id) => input.candidates.get(id))
      .filter((candidate): candidate is ResolvedCandidate => Boolean(candidate));

    if (candidates.length === 0) {
      continue;
    }

    const scored = candidates.map((candidate) =>
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

    section.selectedSlideId = selected.candidate.slideId;
    section.sourcePresentationId = selected.candidate.presentationId;

    selections.push({
      sectionName: section.sectionName,
      slideId: selected.candidate.slideId,
      sourcePresentationId: selected.candidate.presentationId,
      templateId: selected.candidate.templateId,
      matchRationale: selected.matchRationale,
    });
  }

  return {
    plan: { selections },
    blueprint,
  };
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
