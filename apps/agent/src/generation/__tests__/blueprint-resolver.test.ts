import { beforeEach, describe, expect, it, vi } from "vitest";

// ────────────────────────────────────────────────────────────
// Hoisted mocks
// ────────────────────────────────────────────────────────────

const {
  mockDeckStructureFindFirst,
  mockSlideEmbeddingFindMany,
  mockTemplateFindMany,
} = vi.hoisted(() => ({
  mockDeckStructureFindFirst: vi.fn(),
  mockSlideEmbeddingFindMany: vi.fn(),
  mockTemplateFindMany: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    deckStructure: { findFirst: mockDeckStructureFindFirst },
    slideEmbedding: { findMany: mockSlideEmbeddingFindMany },
    template: { findMany: mockTemplateFindMany },
  },
}));

// ────────────────────────────────────────────────────────────
// Imports (after mocks)
// ────────────────────────────────────────────────────────────

import {
  resolveBlueprint,
  type ResolvedCandidate,
  type BlueprintWithCandidates,
} from "../blueprint-resolver";
import type { DealContext } from "@lumenalta/schemas";
import type { DeckStructureKey } from "../../deck-intelligence/deck-structure-key";
import type { DeckStructureOutput } from "../../deck-intelligence/deck-structure-schema";

// ────────────────────────────────────────────────────────────
// Factories
// ────────────────────────────────────────────────────────────

function makeDealContext(overrides?: Partial<DealContext>): DealContext {
  return {
    dealId: "deal-1",
    companyName: "Acme Corp",
    industry: "Technology, Media & Telecommunications",
    pillars: ["AI, ML & LLM"],
    persona: "CTO",
    funnelStage: "Intro Conversation",
    priorTouchSlideIds: [],
    transcriptInsights: [],
    ...overrides,
  };
}

function makeDeckStructureRow(
  structureJson: string | DeckStructureOutput,
  overrides?: Record<string, unknown>,
) {
  const json =
    typeof structureJson === "string"
      ? structureJson
      : JSON.stringify(structureJson);
  return {
    id: "ds-1",
    touchType: "touch_2",
    artifactType: null,
    structureJson: json,
    confidence: 80,
    dataHash: "hash-1",
    exampleCount: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSlideEmbedding(id: string, templateId: string) {
  return {
    id,
    templateId,
    classificationJson: JSON.stringify({ category: "title" }),
    thumbnailUrl: `https://thumb.example.com/${id}`,
    confidence: 0.75,
    slideIndex: 0,
    slideObjectId: `obj-${id}`,
  };
}

function makeTemplate(id: string, presentationId: string) {
  return { id, presentationId };
}

function makeStructureOutput(
  sections: DeckStructureOutput["sections"] = [],
  rationale = "Test rationale",
): DeckStructureOutput {
  return { sections, sequenceRationale: rationale };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe("resolveBlueprint", () => {
  const defaultKey: DeckStructureKey = { touchType: "touch_2", artifactType: null };
  const defaultDeal = makeDealContext();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSlideEmbeddingFindMany.mockResolvedValue([]);
    mockTemplateFindMany.mockResolvedValue([]);
  });

  // Test 1
  it("returns null when no DeckStructure exists for the given key", async () => {
    mockDeckStructureFindFirst.mockResolvedValue(null);

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).toBeNull();
    expect(mockDeckStructureFindFirst).toHaveBeenCalledOnce();
  });

  // Test 2
  it("returns null when DeckStructure exists but structureJson has empty sections array", async () => {
    mockDeckStructureFindFirst.mockResolvedValue(
      makeDeckStructureRow(makeStructureOutput([])),
    );

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).toBeNull();
  });

  // Test 3
  it("returns null when structureJson is invalid JSON", async () => {
    mockDeckStructureFindFirst.mockResolvedValue(
      makeDeckStructureRow("not-valid-json{{{"),
    );

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).toBeNull();
  });

  // Test 4
  it("returns GenerationBlueprint with ordered SectionSlots when valid DeckStructure exists", async () => {
    const structure = makeStructureOutput([
      {
        order: 1,
        name: "Title Slide",
        purpose: "Open the deck",
        isOptional: false,
        variationCount: 2,
        slideIds: ["slide-1", "slide-2"],
      },
      {
        order: 2,
        name: "Case Studies",
        purpose: "Show evidence",
        isOptional: true,
        variationCount: 3,
        slideIds: ["slide-3"],
      },
    ]);

    mockDeckStructureFindFirst.mockResolvedValue(makeDeckStructureRow(structure));
    mockSlideEmbeddingFindMany.mockResolvedValue([
      makeSlideEmbedding("slide-1", "tpl-1"),
      makeSlideEmbedding("slide-2", "tpl-1"),
      makeSlideEmbedding("slide-3", "tpl-2"),
    ]);
    mockTemplateFindMany.mockResolvedValue([
      makeTemplate("tpl-1", "pres-1"),
      makeTemplate("tpl-2", "pres-2"),
    ]);

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).not.toBeNull();
    const { blueprint } = result!;
    expect(blueprint.deckStructureId).toBe("ds-1");
    expect(blueprint.touchType).toBe("touch_2");
    expect(blueprint.artifactType).toBeNull();
    expect(blueprint.sections).toHaveLength(2);
    expect(blueprint.sections[0].sectionName).toBe("Title Slide");
    expect(blueprint.sections[0].candidateSlideIds).toEqual(["slide-1", "slide-2"]);
    expect(blueprint.sections[1].sectionName).toBe("Case Studies");
    expect(blueprint.sections[1].candidateSlideIds).toEqual(["slide-3"]);
    expect(blueprint.dealContext).toEqual(defaultDeal);
    expect(blueprint.sequenceRationale).toBe("Test rationale");
  });

  // Test 5
  it("filters out archived/missing SlideEmbedding IDs from candidateSlideIds", async () => {
    const structure = makeStructureOutput([
      {
        order: 1,
        name: "Intro",
        purpose: "Introduce",
        isOptional: false,
        variationCount: 3,
        slideIds: ["slide-1", "slide-archived", "slide-missing"],
      },
    ]);

    mockDeckStructureFindFirst.mockResolvedValue(makeDeckStructureRow(structure));
    // Only slide-1 is returned (slide-archived filtered by archived:false, slide-missing doesn't exist)
    mockSlideEmbeddingFindMany.mockResolvedValue([
      makeSlideEmbedding("slide-1", "tpl-1"),
    ]);
    mockTemplateFindMany.mockResolvedValue([makeTemplate("tpl-1", "pres-1")]);

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).not.toBeNull();
    expect(result!.blueprint.sections[0].candidateSlideIds).toEqual(["slide-1"]);
    expect(result!.blueprint.sections[0].candidateSlideIds).not.toContain("slide-archived");
    expect(result!.blueprint.sections[0].candidateSlideIds).not.toContain("slide-missing");
  });

  // Test 6
  it("resolves templateId -> presentationId for each candidate via separate Template query", async () => {
    const structure = makeStructureOutput([
      {
        order: 1,
        name: "Title",
        purpose: "Open",
        isOptional: false,
        variationCount: 1,
        slideIds: ["slide-1"],
      },
    ]);

    mockDeckStructureFindFirst.mockResolvedValue(makeDeckStructureRow(structure));
    mockSlideEmbeddingFindMany.mockResolvedValue([
      makeSlideEmbedding("slide-1", "tpl-1"),
    ]);
    mockTemplateFindMany.mockResolvedValue([makeTemplate("tpl-1", "pres-abc")]);

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).not.toBeNull();
    // Verify Template was queried separately
    expect(mockTemplateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["tpl-1"] } },
      }),
    );
    // Verify the candidate has the resolved presentationId
    const candidate = result!.candidates.get("slide-1");
    expect(candidate).toBeDefined();
    expect(candidate!.presentationId).toBe("pres-abc");
  });

  // Test 7
  it("sections are sorted by order field from DeckStructure", async () => {
    const structure = makeStructureOutput([
      {
        order: 3,
        name: "Closing",
        purpose: "Close",
        isOptional: false,
        variationCount: 1,
        slideIds: ["slide-3"],
      },
      {
        order: 1,
        name: "Title",
        purpose: "Open",
        isOptional: false,
        variationCount: 1,
        slideIds: ["slide-1"],
      },
      {
        order: 2,
        name: "Body",
        purpose: "Main content",
        isOptional: false,
        variationCount: 1,
        slideIds: ["slide-2"],
      },
    ]);

    mockDeckStructureFindFirst.mockResolvedValue(makeDeckStructureRow(structure));
    mockSlideEmbeddingFindMany.mockResolvedValue([
      makeSlideEmbedding("slide-1", "tpl-1"),
      makeSlideEmbedding("slide-2", "tpl-1"),
      makeSlideEmbedding("slide-3", "tpl-1"),
    ]);
    mockTemplateFindMany.mockResolvedValue([makeTemplate("tpl-1", "pres-1")]);

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).not.toBeNull();
    expect(result!.blueprint.sections.map((s) => s.sectionName)).toEqual([
      "Title",
      "Body",
      "Closing",
    ]);
  });

  // Test 8
  it("touch_4 with artifactType correctly queries DeckStructure", async () => {
    const key: DeckStructureKey = { touchType: "touch_4", artifactType: "proposal" };
    const structure = makeStructureOutput([
      {
        order: 1,
        name: "Proposal Title",
        purpose: "Proposal opening",
        isOptional: false,
        variationCount: 1,
        slideIds: ["slide-p1"],
      },
    ]);

    mockDeckStructureFindFirst.mockResolvedValue(
      makeDeckStructureRow(structure, {
        touchType: "touch_4",
        artifactType: "proposal",
      }),
    );
    mockSlideEmbeddingFindMany.mockResolvedValue([
      makeSlideEmbedding("slide-p1", "tpl-p"),
    ]);
    mockTemplateFindMany.mockResolvedValue([makeTemplate("tpl-p", "pres-p")]);

    const result = await resolveBlueprint(key, defaultDeal);

    expect(result).not.toBeNull();
    expect(result!.blueprint.touchType).toBe("touch_4");
    expect(result!.blueprint.artifactType).toBe("proposal");
    expect(mockDeckStructureFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { touchType: "touch_4", artifactType: "proposal" },
      }),
    );
  });

  // Test 9
  it("sections with zero valid candidates are kept in blueprint (not filtered out)", async () => {
    const structure = makeStructureOutput([
      {
        order: 1,
        name: "Intro",
        purpose: "Introduce",
        isOptional: false,
        variationCount: 1,
        slideIds: ["slide-1"],
      },
      {
        order: 2,
        name: "Empty Section",
        purpose: "All slides archived",
        isOptional: true,
        variationCount: 2,
        slideIds: ["slide-gone-1", "slide-gone-2"],
      },
    ]);

    mockDeckStructureFindFirst.mockResolvedValue(makeDeckStructureRow(structure));
    // Only slide-1 is in the DB; slide-gone-1 and slide-gone-2 are not returned
    mockSlideEmbeddingFindMany.mockResolvedValue([
      makeSlideEmbedding("slide-1", "tpl-1"),
    ]);
    mockTemplateFindMany.mockResolvedValue([makeTemplate("tpl-1", "pres-1")]);

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).not.toBeNull();
    expect(result!.blueprint.sections).toHaveLength(2);
    expect(result!.blueprint.sections[1].sectionName).toBe("Empty Section");
    expect(result!.blueprint.sections[1].candidateSlideIds).toEqual([]);
  });

  // Test 10
  it("candidates Map contains ResolvedCandidate with all expected fields", async () => {
    const structure = makeStructureOutput([
      {
        order: 1,
        name: "Title",
        purpose: "Open",
        isOptional: false,
        variationCount: 1,
        slideIds: ["slide-1"],
      },
    ]);

    mockDeckStructureFindFirst.mockResolvedValue(makeDeckStructureRow(structure));
    mockSlideEmbeddingFindMany.mockResolvedValue([
      {
        id: "slide-1",
        templateId: "tpl-1",
        classificationJson: '{"category":"title"}',
        thumbnailUrl: "https://thumb.example.com/slide-1",
        confidence: 0.81,
        slideIndex: 0,
        slideObjectId: "obj-slide-1",
      },
    ]);
    mockTemplateFindMany.mockResolvedValue([makeTemplate("tpl-1", "pres-1")]);

    const result = await resolveBlueprint(defaultKey, defaultDeal);

    expect(result).not.toBeNull();
    const candidate = result!.candidates.get("slide-1");
    expect(candidate).toBeDefined();
    expect(candidate).toEqual({
      slideId: "slide-1",
      slideObjectId: expect.any(String),
      templateId: "tpl-1",
      presentationId: "pres-1",
      classificationJson: '{"category":"title"}',
      thumbnailUrl: "https://thumb.example.com/slide-1",
      confidence: 0.81,
    });
  });
});
