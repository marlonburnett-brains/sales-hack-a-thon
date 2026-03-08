import { beforeEach, describe, expect, it, vi } from "vitest";

type StreamChatRefinement = typeof import("../chat-refinement").streamChatRefinement;

const _streamChatRefinementRejectsBroadArtifactString:
  string extends Parameters<StreamChatRefinement>[3] ? never : true = true;

const {
  mockDeckStructureFindFirst,
  mockDeckStructureUpdate,
  mockDeckChatMessageCreate,
  mockDeckChatMessageCount,
  mockDeckChatMessageFindMany,
  mockDeckChatMessageDeleteMany,
  mockExecuteRuntimeProviderNamedAgent,
  mockStreamRuntimeProviderNamedAgent,
  mockInferDeckStructure,
} = vi.hoisted(() => ({
  mockDeckStructureFindFirst: vi.fn(),
  mockDeckStructureUpdate: vi.fn(),
  mockDeckChatMessageCreate: vi.fn(),
  mockDeckChatMessageCount: vi.fn(),
  mockDeckChatMessageFindMany: vi.fn(),
  mockDeckChatMessageDeleteMany: vi.fn(),
  mockExecuteRuntimeProviderNamedAgent: vi.fn(),
  mockStreamRuntimeProviderNamedAgent: vi.fn(),
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

vi.mock("../../lib/agent-executor", () => ({
  createJsonResponseOptions: vi.fn((schema?: Record<string, unknown>) => ({
    responseFormat: schema
      ? { type: "json", schema }
      : { type: "json" },
  })),
  executeRuntimeProviderNamedAgent: mockExecuteRuntimeProviderNamedAgent,
  streamRuntimeProviderNamedAgent: mockStreamRuntimeProviderNamedAgent,
}));

describe("chat refinement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStreamRuntimeProviderNamedAgent.mockResolvedValue({
      stream: [{ text: "I'll add an Introduction section after the title slide." }],
      promptVersion: {
        agentId: "deck-structure-refinement-assistant",
        id: "version-1",
        version: 1,
        publishedAt: null,
        publishedBy: null,
      },
    });
    mockExecuteRuntimeProviderNamedAgent.mockResolvedValue({
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
      object: undefined,
      response: undefined,
      promptVersion: {
        agentId: "deck-structure-refinement-assistant",
        id: "version-1",
        version: 1,
        publishedAt: null,
        publishedBy: null,
      },
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
    expect(mockStreamRuntimeProviderNamedAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "deck-structure-refinement-assistant",
      }),
    );
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
    mockExecuteRuntimeProviderNamedAgent.mockResolvedValueOnce({
      text: "not-json",
      object: undefined,
      response: undefined,
      promptVersion: {
        agentId: "deck-structure-refinement-assistant",
        id: "version-1",
        version: 1,
        publishedAt: null,
        publishedBy: null,
      },
    });
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

  it("uses the shared ArtifactType contract at the chat helper boundary", () => {
    expect(_streamChatRefinementRejectsBroadArtifactString).toBe(true);
  });
});
