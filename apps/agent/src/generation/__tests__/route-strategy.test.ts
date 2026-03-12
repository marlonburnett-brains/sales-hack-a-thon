import { beforeEach, describe, expect, it, vi } from "vitest";

// ────────────────────────────────────────────────────────────
// Hoisted mocks
// ────────────────────────────────────────────────────────────

const {
  mockDeckStructureFindFirst,
  mockResolveBlueprint,
  mockCalculateConfidence,
} = vi.hoisted(() => ({
  mockDeckStructureFindFirst: vi.fn(),
  mockResolveBlueprint: vi.fn(),
  mockCalculateConfidence: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    deckStructure: { findFirst: mockDeckStructureFindFirst },
    transcript: { findMany: vi.fn().mockResolvedValue([]) },
    dealContextSource: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("../blueprint-resolver", () => ({
  resolveBlueprint: mockResolveBlueprint,
}));

vi.mock("../../deck-intelligence/deck-structure-schema", () => ({
  calculateConfidence: mockCalculateConfidence,
}));

// Mock pipeline modules to avoid env/google-auth import chains
vi.mock("../section-matcher", () => ({
  selectSlidesForBlueprint: vi.fn(),
}));

vi.mock("../multi-source-assembler", () => ({
  buildMultiSourcePlan: vi.fn(),
  assembleMultiSourceDeck: vi.fn(),
}));

vi.mock("../modification-planner", () => ({
  planSlideModifications: vi.fn(),
}));

vi.mock("../modification-executor", () => ({
  executeModifications: vi.fn(),
}));

// ────────────────────────────────────────────────────────────
// Imports (after mocks)
// ────────────────────────────────────────────────────────────

import {
  resolveGenerationStrategy,
  buildDealContext,
} from "../route-strategy";
import type { DealContext } from "@lumenalta/schemas";

// ────────────────────────────────────────────────────────────
// Factories
// ────────────────────────────────────────────────────────────

function makeDealContext(overrides: Partial<DealContext> = {}): DealContext {
  return {
    dealId: "deal-1",
    companyName: "Acme Corp",
    industry: "Technology",
    pillars: [],
    persona: "General",
    funnelStage: "First Contact",
    priorTouchSlideIds: [],
    transcriptInsights: [],
    ...overrides,
  };
}

function makeBlueprintWithCandidates() {
  return {
    blueprint: {
      deckStructureId: "ds-1",
      touchType: "touch_1",
      artifactType: null,
      sections: [],
      dealContext: makeDealContext(),
      sequenceRationale: "test",
    },
    candidates: new Map(),
  };
}

// ────────────────────────────────────────────────────────────
// Tests: resolveGenerationStrategy
// ────────────────────────────────────────────────────────────

describe("resolveGenerationStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns legacy when resolveBlueprint returns null", async () => {
    mockResolveBlueprint.mockResolvedValue(null);

    const result = await resolveGenerationStrategy(
      "touch_1",
      null,
      makeDealContext(),
    );

    expect(result).toEqual({ type: "legacy" });
  });

  it("returns structure-driven when confidence is green", async () => {
    const bwc = makeBlueprintWithCandidates();
    mockResolveBlueprint.mockResolvedValue(bwc);
    mockDeckStructureFindFirst.mockResolvedValue({ exampleCount: 8 });
    mockCalculateConfidence.mockReturnValue({
      score: 92,
      color: "green",
      label: "High confidence",
    });

    const result = await resolveGenerationStrategy(
      "touch_2",
      null,
      makeDealContext(),
    );

    expect(result).toEqual({
      type: "structure-driven",
      blueprint: bwc,
      confidence: { score: 92, color: "green", label: "High confidence" },
    });
  });

  it("returns low-confidence when confidence is red", async () => {
    const bwc = makeBlueprintWithCandidates();
    mockResolveBlueprint.mockResolvedValue(bwc);
    mockDeckStructureFindFirst.mockResolvedValue({ exampleCount: 2 });
    mockCalculateConfidence.mockReturnValue({
      score: 40,
      color: "red",
      label: "Low confidence",
    });

    const result = await resolveGenerationStrategy(
      "touch_3",
      null,
      makeDealContext(),
    );

    expect(result).toEqual({
      type: "low-confidence",
      blueprint: bwc,
      confidence: { score: 40, color: "red", label: "Low confidence" },
    });
  });

  it("returns low-confidence when confidence is yellow", async () => {
    const bwc = makeBlueprintWithCandidates();
    mockResolveBlueprint.mockResolvedValue(bwc);
    mockDeckStructureFindFirst.mockResolvedValue({ exampleCount: 4 });
    mockCalculateConfidence.mockReturnValue({
      score: 70,
      color: "yellow",
      label: "Medium confidence",
    });

    const result = await resolveGenerationStrategy(
      "touch_1",
      null,
      makeDealContext(),
    );

    expect(result).toEqual({
      type: "low-confidence",
      blueprint: bwc,
      confidence: { score: 70, color: "yellow", label: "Medium confidence" },
    });
  });

  it("passes artifactType to resolveBlueprint for touch_4", async () => {
    const bwc = makeBlueprintWithCandidates();
    mockResolveBlueprint.mockResolvedValue(bwc);
    mockDeckStructureFindFirst.mockResolvedValue({ exampleCount: 10 });
    mockCalculateConfidence.mockReturnValue({
      score: 95,
      color: "green",
      label: "High confidence",
    });

    await resolveGenerationStrategy(
      "touch_4",
      "proposal",
      makeDealContext(),
    );

    expect(mockResolveBlueprint).toHaveBeenCalledWith(
      { touchType: "touch_4", artifactType: "proposal" },
      expect.any(Object),
    );
  });
});

// ────────────────────────────────────────────────────────────
// Tests: buildDealContext
// ────────────────────────────────────────────────────────────

describe("buildDealContext", () => {
  it("builds context for touch_1 with defaults", async () => {
    const ctx = await buildDealContext("touch_1", {
      dealId: "deal-1",
      companyName: "Acme Corp",
      industry: "Technology",
    });

    expect(ctx).toEqual({
      dealId: "deal-1",
      companyName: "Acme Corp",
      industry: "Technology",
      pillars: [],
      persona: "General",
      funnelStage: "First Contact",
      priorTouchSlideIds: [],
      transcriptInsights: [],
    });
  });

  it("maps touch_2 to Intro Conversation funnel stage", async () => {
    const ctx = await buildDealContext("touch_2", {
      dealId: "deal-2",
      companyName: "Beta Inc",
      industry: "Finance",
    });

    expect(ctx.funnelStage).toBe("Intro Conversation");
  });

  it("maps touch_3 to Capability Alignment funnel stage with capabilityAreas as pillars", async () => {
    const ctx = await buildDealContext("touch_3", {
      dealId: "deal-3",
      companyName: "Gamma LLC",
      industry: "Healthcare",
      capabilityAreas: ["Data", "AI"],
    });

    expect(ctx.funnelStage).toBe("Capability Alignment");
    expect(ctx.pillars).toEqual(["Data", "AI"]);
  });

  it("maps touch_4 to Solution Proposal funnel stage", async () => {
    const ctx = await buildDealContext("touch_4", {
      dealId: "deal-4",
      companyName: "Delta Corp",
      industry: "Retail",
    });

    expect(ctx.funnelStage).toBe("Solution Proposal");
  });

  it("uses priorTouchOutputs as priorTouchSlideIds when present", async () => {
    const ctx = await buildDealContext("touch_2", {
      dealId: "deal-2",
      companyName: "Beta Inc",
      industry: "Finance",
      priorTouchOutputs: ["slide-a", "slide-b"],
    });

    expect(ctx.priorTouchSlideIds).toEqual(["slide-a", "slide-b"]);
  });

  it("defaults pillars, priorTouchSlideIds, and transcriptInsights to empty arrays", async () => {
    const ctx = await buildDealContext("touch_1", {
      dealId: "deal-1",
      companyName: "Test",
      industry: "Tech",
    });

    expect(ctx.pillars).toEqual([]);
    expect(ctx.priorTouchSlideIds).toEqual([]);
    expect(ctx.transcriptInsights).toEqual([]);
  });
});
