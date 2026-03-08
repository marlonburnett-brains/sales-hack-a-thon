import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../infer-deck-structure", () => ({
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

describe("chat refinement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGenerateContentStream.mockResolvedValue([{ text: "I'll add an Introduction section after the title slide." }]);
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        sections: [
          {
            order: 1,
            name: "Title Slide",
            purpose: "Open the presentation.",
            isOptional: false,
            variationCount: 2,
            slideIds: ["title-1"],
          },
          {
            order: 2,
            name: "Introduction",
            purpose: "Orient the audience before divider slides.",
            isOptional: false,
            variationCount: 0,
            slideIds: [],
          },
          {
            order: 3,
            name: "Divider/Transition Slides",
            purpose: "Provide visual breaks.",
            isOptional: true,
            variationCount: 1,
            slideIds: ["divider-1"],
          },
        ],
        sequenceRationale:
          "Lead with the title, add an introduction to frame the story, then use divider slides sparingly.",
      }),
    });
    mockInferDeckStructure.mockResolvedValue({
      sections: [],
      sequenceRationale: "fallback",
    });
    mockDeckStructureFindFirst
      .mockResolvedValueOnce({
        id: "proposal-row",
        touchType: "touch_4",
        artifactType: "proposal",
        structureJson: JSON.stringify({
          sections: [
            {
              order: 1,
              name: "Title Slide",
              purpose: "Open the presentation.",
              isOptional: false,
              variationCount: 2,
              slideIds: ["title-1"],
            },
            {
              order: 2,
              name: "Divider/Transition Slides",
              purpose: "Provide visual breaks.",
              isOptional: true,
              variationCount: 1,
              slideIds: ["divider-1"],
            },
          ],
          sequenceRationale: "Current proposal flow.",
        }),
        chatContextJson: "Keep proposal narrative concise.",
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

  it("applies direct structured edits from chat feedback before falling back to re-inference", async () => {
    const { streamChatRefinement } = await import("../chat-refinement");

    const result = await streamChatRefinement(
      "touch_4",
      "Add an Introduction section after the Title Slide.",
      () => {},
      "proposal",
    );

    expect(mockInferDeckStructure).not.toHaveBeenCalled();
    expect(result.updatedStructure.sections.map((section) => section.name)).toEqual([
      "Title Slide",
      "Introduction",
      "Divider/Transition Slides",
    ]);
    expect(mockDeckStructureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proposal-row" },
        data: expect.objectContaining({
          structureJson: expect.stringContaining("Introduction"),
          chatContextJson: expect.stringContaining(
            'User requested: "Add an Introduction section after the Title Slide."',
          ),
        }),
      }),
    );
  });

  it("falls back to full re-inference if structured refinement output is invalid", async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: "not-json" });
    mockInferDeckStructure.mockResolvedValueOnce({
      sections: [
        {
          order: 1,
          name: "Fallback Intro",
          purpose: "Recovered via inference.",
          isOptional: false,
          variationCount: 0,
          slideIds: [],
        },
      ],
      sequenceRationale: "Fallback used.",
    });

    const { streamChatRefinement } = await import("../chat-refinement");

    const result = await streamChatRefinement(
      "touch_4",
      "Add an Introduction section after the Title Slide.",
      () => {},
      "proposal",
    );

    expect(mockInferDeckStructure).toHaveBeenCalledTimes(1);
    expect(result.updatedStructure.sections[0]?.name).toBe("Fallback Intro");
  });
});
