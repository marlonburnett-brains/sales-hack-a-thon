import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const {
  mockDeckStructureFindFirst,
  mockDeckStructureUpdate,
  mockDeckChatMessageCreate,
  mockDeckChatMessageCount,
  mockDeckChatMessageFindMany,
  mockDeckChatMessageDeleteMany,
  mockGenerateContentStream,
  mockGenerateContent,
  mockInferDeckStructure,
} = vi.hoisted(() => ({
  mockDeckStructureFindFirst: vi.fn(),
  mockDeckStructureUpdate: vi.fn(),
  mockDeckChatMessageCreate: vi.fn(),
  mockDeckChatMessageCount: vi.fn(),
  mockDeckChatMessageFindMany: vi.fn(),
  mockDeckChatMessageDeleteMany: vi.fn(),
  mockGenerateContentStream: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockInferDeckStructure: vi.fn(),
}));

vi.mock("../../lib/db", () => ({
  prisma: {
    deckStructure: {
      findFirst: mockDeckStructureFindFirst,
      update: mockDeckStructureUpdate,
    },
    deckChatMessage: {
      create: mockDeckChatMessageCreate,
      count: mockDeckChatMessageCount,
      findMany: mockDeckChatMessageFindMany,
      deleteMany: mockDeckChatMessageDeleteMany,
    },
  },
}));

vi.mock("../../env", () => ({
  env: {
    GOOGLE_CLOUD_PROJECT: "test-project",
    GOOGLE_CLOUD_LOCATION: "us-central1",
  },
}));

vi.mock("../../deck-intelligence/infer-deck-structure", () => ({
  GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE: "unavailable",
  buildEmptyDeckStructureOutput: vi.fn(() => ({ sections: [], sequenceRationale: "" })),
  inferDeckStructure: mockInferDeckStructure,
  isUnsupportedGenericTouch4: vi.fn(() => false),
}));

vi.mock("@google/genai", () => ({
  Type: {
    OBJECT: "OBJECT",
    ARRAY: "ARRAY",
    STRING: "STRING",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
  },
  GoogleGenAI: class {
    models = {
      generateContentStream: mockGenerateContentStream,
      generateContent: mockGenerateContent,
    };
  },
}));

describe("Phase 36 route and chat artifact contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGenerateContentStream.mockResolvedValue([
      { text: "Proposal response chunk" },
    ]);
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        sections: [
          {
            order: 1,
            name: "Title Slide",
            purpose: "Open the deck.",
            isOptional: false,
            variationCount: 1,
            slideIds: ["slide-1"],
          },
        ],
        sequenceRationale: "Lead with the title slide.",
      }),
    });
    mockInferDeckStructure.mockResolvedValue({
      sections: [],
      sequenceRationale: "Updated proposal sequence",
    });
    mockDeckStructureFindFirst
      .mockResolvedValueOnce({
        id: "proposal-row",
        touchType: "touch_4",
        artifactType: "proposal",
        structureJson: JSON.stringify({ sections: [], sequenceRationale: "Current" }),
        chatContextJson: "Keep ROI focus",
        chatMessages: [],
      })
      .mockResolvedValueOnce({
        id: "proposal-row",
        touchType: "touch_4",
        artifactType: "proposal",
      });
    mockDeckChatMessageCreate.mockResolvedValue(undefined);
    mockDeckChatMessageCount.mockResolvedValue(2);
    mockDeckChatMessageFindMany.mockResolvedValue([]);
    mockDeckChatMessageDeleteMany.mockResolvedValue(undefined);
    mockDeckStructureUpdate.mockResolvedValue(undefined);
  });

  it("threads artifactType through chat refinement row lookup and structured update", async () => {
    const { streamChatRefinement } = await import("../../deck-intelligence/chat-refinement");

    await streamChatRefinement(
      "touch_4",
      "Emphasize ROI before implementation details",
      () => {},
      "proposal",
    );

    expect(mockDeckStructureFindFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          touchType: "touch_4",
          artifactType: "proposal",
        },
      }),
    );
    expect(mockDeckStructureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proposal-row" },
        data: expect.objectContaining({
          structureJson: expect.any(String),
          chatContextJson: expect.stringContaining("Emphasize ROI before implementation details"),
        }),
      }),
    );
  });

  it("updates only the matching artifact-specific deck structure row", async () => {
    const { streamChatRefinement } = await import("../../deck-intelligence/chat-refinement");

    await streamChatRefinement("touch_4", "Tighten proposal flow", () => {}, "proposal");

    expect(mockDeckStructureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proposal-row" },
        data: expect.objectContaining({
          chatContextJson: expect.stringContaining("Tighten proposal flow"),
          lastChatAt: expect.any(Date),
        }),
      }),
    );
    expect(mockDeckChatMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deckStructureId: "proposal-row" }),
      }),
    );
  });

  it("lists seven logical entries and includes artifactType in the route contract source", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/mastra/index.ts"),
      "utf8",
    );

    expect(source).toMatch(/getDeckStructureListKeys\(\)/);
    expect(source).toMatch(/artifactType:\s*key\.artifactType/);
  });

  it("validates artifactType query params for detail infer and chat route handlers", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/mastra/index.ts"),
      "utf8",
    );

    expect(source).toMatch(/registerApiRoute\("\/deck-structures\/:touchType\/chat"/);
    expect(source).not.toMatch(/registerApiRoute\("\/api\/deck-structures\/:touchType\/chat"/);
    expect(source).toMatch(/c\.req\.query\(\)/);
    expect(source).toMatch(/resolveDeckStructureKey\(touchType,\s*query\.artifactType/);
    expect(source).toMatch(/streamChatRefinement\([\s\S]*key\.artifactType/);
  });
});
