import { type ArtifactType } from "@lumenalta/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTemplateFindMany,
  mockSlideEmbeddingFindMany,
  mockFindFirst,
  mockUpdate,
  mockCreate,
  mockExecuteRuntimeProviderNamedAgent,
} = vi.hoisted(() => ({
  mockTemplateFindMany: vi.fn(),
  mockSlideEmbeddingFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
  mockExecuteRuntimeProviderNamedAgent: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    template: { findMany: mockTemplateFindMany },
    slideEmbedding: { findMany: mockSlideEmbeddingFindMany },
    deckStructure: {
      findFirst: mockFindFirst,
      update: mockUpdate,
      create: mockCreate,
    },
  },
}));

vi.mock("../../lib/agent-executor", () => ({
  createJsonResponseOptions: vi.fn((schema?: Record<string, unknown>) => ({
    responseFormat: schema
      ? { type: "json", schema }
      : { type: "json" },
  })),
  executeRuntimeProviderNamedAgent: mockExecuteRuntimeProviderNamedAgent,
}));

import {
  computeDataHash,
  inferDeckStructure,
  isUnsupportedGenericTouch4,
} from "../infer-deck-structure";

const _computeDataHashRejectsBroadArtifactString:
  string extends Parameters<typeof computeDataHash>[1] ? never : true = true;
const _isUnsupportedGenericTouch4RejectsBroadArtifactString:
  string extends Parameters<typeof isUnsupportedGenericTouch4>[1] ? never : true =
  true;

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "template-1",
    name: "Template 1",
    touchTypes: JSON.stringify(["touch_4"]),
    artifactType: null,
    contentClassification: "example",
    ...overrides,
  };
}

function makeSlide(templateId: string, contentText: string) {
  return {
    id: `${templateId}-${contentText}`,
    slideIndex: 0,
    contentText,
    description: null,
    classificationJson: null,
    elements: [],
  };
}

describe("Phase 36 artifact-aware inference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTemplateFindMany.mockReset();
    mockSlideEmbeddingFindMany.mockReset();
    mockFindFirst.mockResolvedValue(null);
    mockUpdate.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(undefined);
    mockExecuteRuntimeProviderNamedAgent.mockResolvedValue({
      text: JSON.stringify({
        sections: [
          {
            name: "Intro",
            order: 1,
            purpose: "Set context",
            isOptional: false,
            variationCount: 1,
            slideIds: ["slide-1"],
          },
        ],
        sequenceRationale: "Lead with context.",
      }),
      object: undefined,
      response: undefined,
      promptVersion: {
        agentId: "deck-structure-analyst",
        id: "version-1",
        version: 1,
        publishedAt: null,
        publishedBy: null,
      },
    });
  });

  it("filters touch_4 primary examples to the requested artifact", async () => {
    mockTemplateFindMany
      .mockResolvedValueOnce([
        makeTemplate({ id: "example-proposal", name: "Proposal Example", artifactType: "proposal" }),
        makeTemplate({ id: "example-faq", name: "FAQ Example", artifactType: "faq" }),
      ])
      .mockResolvedValueOnce([makeTemplate({ id: "template-shared", name: "Shared Template", contentClassification: "template" })])
      .mockResolvedValueOnce([
        { id: "example-proposal", touchTypes: JSON.stringify(["touch_4"]), artifactType: "proposal", contentClassification: "example" },
        { id: "example-faq", touchTypes: JSON.stringify(["touch_4"]), artifactType: "faq", contentClassification: "example" },
      ]);
    mockSlideEmbeddingFindMany
      .mockResolvedValueOnce([makeSlide("example-proposal", "Proposal primary slide")])
      .mockResolvedValueOnce([makeSlide("template-shared", "Shared template slide")]);

    await inferDeckStructure({ touchType: "touch_4", artifactType: "proposal" });

    expect(mockExecuteRuntimeProviderNamedAgent).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "deck-structure-analyst" }),
    );
    const prompt = mockExecuteRuntimeProviderNamedAgent.mock.calls[0][0]
      .messages[0].content as string;
    expect(prompt).toContain("Proposal primary slide");
    expect(prompt).not.toContain("FAQ Example");
  });

  it("keeps all touch_4 templates as secondary variation sources", async () => {
    mockTemplateFindMany
      .mockResolvedValueOnce([
        makeTemplate({ id: "example-proposal", name: "Proposal Example", artifactType: "proposal" }),
      ])
      .mockResolvedValueOnce([
        makeTemplate({ id: "template-shared", name: "Shared Template A", contentClassification: "template", artifactType: null }),
        makeTemplate({ id: "template-faq", name: "FAQ Template", contentClassification: "template", artifactType: "faq" }),
      ])
      .mockResolvedValueOnce([
        { id: "example-proposal", touchTypes: JSON.stringify(["touch_4"]), artifactType: "proposal", contentClassification: "example" },
      ]);
    mockSlideEmbeddingFindMany
      .mockResolvedValueOnce([makeSlide("example-proposal", "Proposal primary slide")])
      .mockResolvedValueOnce([makeSlide("template-shared", "Shared template slide")])
      .mockResolvedValueOnce([makeSlide("template-faq", "FAQ template slide")]);

    await inferDeckStructure({ touchType: "touch_4", artifactType: "proposal" });

    const prompt = mockExecuteRuntimeProviderNamedAgent.mock.calls[0][0]
      .messages[0].content as string;
    expect(prompt).toContain("Shared template slide");
    expect(prompt).toContain("FAQ template slide");
  });

  it("persists empty touch_4 artifact rows without falling back to null artifact", async () => {
    mockTemplateFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await inferDeckStructure({ touchType: "touch_4", artifactType: "faq" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          touchType: "touch_4",
          artifactType: "faq",
        }),
      }),
    );
  });

  it("hashes touch_4 example inputs separately per artifact", async () => {
    mockTemplateFindMany.mockResolvedValue([
      { id: "proposal-1", touchTypes: JSON.stringify(["touch_4"]), artifactType: "proposal", contentClassification: "example" },
      { id: "faq-1", touchTypes: JSON.stringify(["touch_4"]), artifactType: "faq", contentClassification: "example" },
    ]);

    const proposalHash = await computeDataHash({ touchType: "touch_4", artifactType: "proposal" });
    const faqHash = await computeDataHash({ touchType: "touch_4", artifactType: "faq" });

    expect(proposalHash).not.toBe(faqHash);
  });

  it("uses ArtifactType at public inference helper boundaries", () => {
    expect(_computeDataHashRejectsBroadArtifactString).toBe(true);
    expect(_isUnsupportedGenericTouch4RejectsBroadArtifactString).toBe(true);
  });
});
