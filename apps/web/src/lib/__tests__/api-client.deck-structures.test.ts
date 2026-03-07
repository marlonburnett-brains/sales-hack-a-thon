import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/env", () => ({
  env: {
    AGENT_SERVICE_URL: "http://test-agent:4111",
    AGENT_API_KEY: "test-key",
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Phase 36 deck structure api client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
  });

  it("appends artifactType for detail and infer requests when provided", async () => {
    const { getDeckStructure, triggerDeckInference } = await import("@/lib/api-client");

    await getDeckStructure("touch_4", "proposal");
    await triggerDeckInference("touch_4", "proposal");

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "http://test-agent:4111/deck-structures/touch_4?artifactType=proposal",
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "http://test-agent:4111/deck-structures/touch_4/infer?artifactType=proposal",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("omits artifactType when not provided", async () => {
    const { getDeckStructure, triggerDeckInference } = await import("@/lib/api-client");

    await getDeckStructure("touch_1");
    await triggerDeckInference("touch_1");

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "http://test-agent:4111/deck-structures/touch_1",
      expect.any(Object),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "http://test-agent:4111/deck-structures/touch_1/infer",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("exposes artifactType on summary and detail payloads", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: "deck-1",
              touchType: "touch_4",
              artifactType: "proposal",
              exampleCount: 2,
              confidence: 90,
              confidenceColor: "green",
              confidenceLabel: "High",
              sectionCount: 5,
              inferredAt: null,
              lastChatAt: null,
              updatedAt: null,
            },
          ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            touchType: "touch_4",
            artifactType: "proposal",
            structure: { sections: [], sequenceRationale: "" },
            exampleCount: 2,
            confidence: 90,
            confidenceColor: "green",
            confidenceLabel: "High",
            chatMessages: [],
            slideIdToThumbnail: {},
            inferredAt: null,
            lastChatAt: null,
          }),
      });

    const { getDeckStructures, getDeckStructure } = await import("@/lib/api-client");

    const summaries = await getDeckStructures();
    const detail = await getDeckStructure("touch_4", "proposal");

    expect(summaries[0].artifactType).toBe("proposal");
    expect(detail.artifactType).toBe("proposal");
  });
});
