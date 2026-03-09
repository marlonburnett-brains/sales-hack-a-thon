import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateEmbedding, mockQueryRaw } = vi.hoisted(() => ({
  mockGenerateEmbedding: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock("../../ingestion/embed-slide", () => ({
  generateEmbedding: mockGenerateEmbedding,
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

import type {
  DealContext,
  GenerationBlueprint,
  SlideMetadata,
} from "@lumenalta/schemas";

import type {
  BlueprintWithCandidates,
  ResolvedCandidate,
} from "../blueprint-resolver";
import { selectSlidesForBlueprint } from "../section-matcher";

function makeDealContext(overrides: Partial<DealContext> = {}): DealContext {
  return {
    dealId: "deal-1",
    companyName: "Acme Bank",
    industry: "Financial Services",
    pillars: ["AI, ML & LLM", "Data & Analytics"],
    persona: "CTO",
    funnelStage: "Intro Conversation",
    priorTouchSlideIds: [],
    ...overrides,
  };
}

function makeMetadata(overrides: Partial<SlideMetadata> = {}): SlideMetadata {
  return {
    industries: ["Financial Services"],
    subsectors: [],
    solutionPillars: ["AI, ML & LLM"],
    funnelStages: ["Intro Conversation"],
    contentType: "Capability",
    slideCategory: "Content",
    buyerPersonas: ["CTO"],
    touchType: ["touch_2"],
    ...overrides,
  };
}

function makeCandidate(
  slideId: string,
  overrides: Partial<ResolvedCandidate> & { metadata?: SlideMetadata | null } = {},
): ResolvedCandidate {
  const metadata = Object.prototype.hasOwnProperty.call(overrides, "metadata")
    ? overrides.metadata
    : makeMetadata();

  return {
    slideId,
    templateId: overrides.templateId ?? `tpl-${slideId}`,
    presentationId: overrides.presentationId ?? `pres-${slideId}`,
    classificationJson:
      metadata === null
        ? null
        : (overrides.classificationJson ?? JSON.stringify(metadata)),
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    confidence: overrides.confidence ?? 0.5,
  };
}

function makeInput(params: {
  candidateIds?: string[];
  candidates?: ResolvedCandidate[];
  dealContext?: DealContext;
  sectionName?: string;
  purpose?: string;
}): BlueprintWithCandidates {
  const candidates = params.candidates ?? [];
  const candidateIds =
    params.candidateIds ?? candidates.map((candidate) => candidate.slideId);

  const blueprint: GenerationBlueprint = {
    deckStructureId: "deck-1",
    touchType: "touch_2",
    artifactType: null,
    dealContext: params.dealContext ?? makeDealContext(),
    sequenceRationale: "Test sequence",
    sections: [
      {
        sectionName: params.sectionName ?? "Capabilities",
        purpose: params.purpose ?? "Show relevant capabilities",
        isOptional: false,
        candidateSlideIds: candidateIds,
        selectedSlideId: null,
        sourcePresentationId: null,
        hasModificationPlan: false,
      },
    ],
  };

  return {
    blueprint,
    candidates: new Map(candidates.map((candidate) => [candidate.slideId, candidate])),
  };
}

describe("selectSlidesForBlueprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockQueryRaw.mockResolvedValue([]);
  });

  it("scores metadata using weighted industry, pillar, persona, and funnel stage matches", async () => {
    const best = makeCandidate("slide-best", {
      metadata: makeMetadata({ solutionPillars: ["AI, ML & LLM", "Data & Analytics"] }),
      templateId: "tpl-best",
      presentationId: "pres-best",
    });
    const weak = makeCandidate("slide-weak", {
      metadata: makeMetadata({
        industries: ["Healthcare"],
        solutionPillars: [],
        buyerPersonas: [],
        funnelStages: [],
      }),
      templateId: "tpl-weak",
      presentationId: "pres-weak",
    });

    const result = await selectSlidesForBlueprint(
      makeInput({ candidates: [weak, best] }),
    );

    expect(result.plan.selections).toHaveLength(1);
    expect(result.plan.selections[0]).toMatchObject({
      sectionName: "Capabilities",
      slideId: "slide-best",
      sourcePresentationId: "pres-best",
      templateId: "tpl-best",
    });
    expect(result.plan.selections[0]?.matchRationale).toContain("Score: 11");
    expect(result.blueprint.sections[0]).toMatchObject({
      selectedSlideId: "slide-best",
      sourcePresentationId: "pres-best",
    });
  });

  it("caps pillar overlap contribution at two matches", async () => {
    const capped = makeCandidate("slide-capped", {
      metadata: makeMetadata({
        solutionPillars: ["AI, ML & LLM", "Data & Analytics", "Cloud & Infrastructure"],
      }),
    });

    const result = await selectSlidesForBlueprint(
      makeInput({
        candidates: [capped],
        dealContext: makeDealContext({
          pillars: [
            "AI, ML & LLM",
            "Data & Analytics",
            "Cloud & Infrastructure",
          ],
        }),
      }),
    );

    expect(result.plan.selections[0]?.matchRationale).toContain("2 pillar overlap");
    expect(result.plan.selections[0]?.matchRationale).toContain("Score: 11");
  });

  it("treats null and malformed classificationJson as zero-score candidates without crashing", async () => {
    const nullCandidate = makeCandidate("slide-null", {
      metadata: null,
      confidence: 0.2,
    });
    const malformedCandidate = makeCandidate("slide-bad", {
      classificationJson: "{not-json",
      confidence: 0.9,
    });

    const result = await selectSlidesForBlueprint(
      makeInput({ candidates: [nullCandidate, malformedCandidate] }),
    );

    expect(result.plan.selections[0]?.slideId).toBe("slide-bad");
    expect(result.plan.selections[0]?.matchRationale).toContain(
      "Fallback: highest confidence (0.9)",
    );
  });

  it("uses vector similarity to break metadata ties and caches the deal embedding", async () => {
    mockQueryRaw.mockResolvedValue([
      { id: "slide-b", similarity: 0.82 },
      { id: "slide-a", similarity: 0.91 },
    ]);

    const tiedA = makeCandidate("slide-a", {
      metadata: makeMetadata({ solutionPillars: ["AI, ML & LLM"] }),
    });
    const tiedB = makeCandidate("slide-b", {
      metadata: makeMetadata({ solutionPillars: ["Data & Analytics"] }),
    });

    const input = makeInput({
      candidates: [tiedA, tiedB],
      purpose: "Explain fit",
    });
    input.blueprint.sections.push({
      sectionName: "Proof",
      purpose: "Show proof",
      isOptional: false,
      candidateSlideIds: ["slide-a", "slide-b"],
      selectedSlideId: null,
      sourcePresentationId: null,
      hasModificationPlan: false,
    });

    const result = await selectSlidesForBlueprint(input);

    expect(result.plan.selections).toHaveLength(2);
    expect(result.plan.selections[0]?.slideId).toBe("slide-a");
    expect(result.plan.selections[0]?.matchRationale).toContain(
      "Tiebreaker: vector similarity 0.91 vs 0.82",
    );
    expect(result.plan.selections[1]?.slideId).toBe("slide-a");
    expect(mockGenerateEmbedding).toHaveBeenCalledTimes(1);
    expect(mockGenerateEmbedding).toHaveBeenCalledWith(
      "Financial Services | AI, ML & LLM | Data & Analytics | CTO | Intro Conversation | Acme Bank",
    );
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });

  it("falls back to highest confidence when all metadata scores are zero and first candidate on tied confidence", async () => {
    const low = makeCandidate("slide-low", {
      metadata: makeMetadata({
        industries: ["Healthcare"],
        solutionPillars: [],
        buyerPersonas: [],
        funnelStages: [],
      }),
      confidence: 0.3,
    });
    const high = makeCandidate("slide-high", {
      metadata: makeMetadata({
        industries: ["Healthcare"],
        solutionPillars: [],
        buyerPersonas: [],
        funnelStages: [],
      }),
      confidence: 0.92,
    });

    const result = await selectSlidesForBlueprint(
      makeInput({ candidates: [low, high] }),
    );
    expect(result.plan.selections[0]?.slideId).toBe("slide-high");

    const first = makeCandidate("slide-first", {
      metadata: makeMetadata({
        industries: ["Healthcare"],
        solutionPillars: [],
        buyerPersonas: [],
        funnelStages: [],
      }),
      confidence: null,
    });
    const second = makeCandidate("slide-second", {
      metadata: makeMetadata({
        industries: ["Healthcare"],
        solutionPillars: [],
        buyerPersonas: [],
        funnelStages: [],
      }),
      confidence: null,
    });

    const fallbackResult = await selectSlidesForBlueprint(
      makeInput({ candidates: [first, second] }),
    );
    expect(fallbackResult.plan.selections[0]?.slideId).toBe("slide-first");
    expect(fallbackResult.plan.selections[0]?.matchRationale).toContain(
      "Fallback: first available candidate",
    );
  });

  it("excludes prior touch slides before scoring and falls back to unfiltered candidates when all are excluded", async () => {
    const reused = makeCandidate("slide-reused", {
      metadata: makeMetadata({ solutionPillars: ["AI, ML & LLM", "Data & Analytics"] }),
      confidence: 0.9,
    });
    const fresh = makeCandidate("slide-fresh", {
      metadata: makeMetadata({ solutionPillars: ["AI, ML & LLM"] }),
      confidence: 0.4,
    });

    const result = await selectSlidesForBlueprint(
      makeInput({
        candidates: [reused, fresh],
        dealContext: makeDealContext({ priorTouchSlideIds: ["slide-reused"] }),
      }),
    );
    expect(result.plan.selections[0]?.slideId).toBe("slide-fresh");

    const allExcluded = await selectSlidesForBlueprint(
      makeInput({
        candidates: [reused],
        dealContext: makeDealContext({ priorTouchSlideIds: ["slide-reused"] }),
      }),
    );
    expect(allExcluded.plan.selections[0]?.slideId).toBe("slide-reused");
  });

  it("skips sections with empty candidate lists and preserves presentationId output for filled sections", async () => {
    const candidate = makeCandidate("slide-1", {
      templateId: "tpl-1",
      presentationId: "pres-1",
    });
    const input = makeInput({ candidates: [candidate] });
    input.blueprint.sections.push({
      sectionName: "Optional Gap",
      purpose: "No candidates yet",
      isOptional: true,
      candidateSlideIds: [],
      selectedSlideId: null,
      sourcePresentationId: null,
      hasModificationPlan: false,
    });

    const result = await selectSlidesForBlueprint(input);

    expect(result.plan.selections).toHaveLength(1);
    expect(result.plan.selections[0]).toMatchObject({
      sourcePresentationId: "pres-1",
      templateId: "tpl-1",
    });
    expect(result.blueprint.sections[1]).toMatchObject({
      selectedSlideId: null,
      sourcePresentationId: null,
    });
  });
});
