import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ArtifactType } from "@lumenalta/schemas";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

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
            chatContext: null,
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

  it("types deck structure payload artifactType as the shared contract", async () => {
    const apiClient = await import("@/lib/api-client");
    const actions = await import("@/lib/actions/deck-structure-actions");

    expectTypeOf<apiClient.DeckStructureSummary["artifactType"]>().toEqualTypeOf<
      ArtifactType | null | undefined
    >();
    expectTypeOf<apiClient.DeckStructureDetail["artifactType"]>().toEqualTypeOf<
      ArtifactType | null | undefined
    >();
    expectTypeOf(actions.getDeckStructureAction).parameters.toEqualTypeOf<
      [touchType: string, artifactType?: ArtifactType | null]
    >();
    expectTypeOf(actions.triggerInferenceAction).parameters.toEqualTypeOf<
      [touchType: string, artifactType?: ArtifactType | null]
    >();
  });

  it("defines deck structure artifact seams with ArtifactType instead of string", () => {
    const apiClientSource = readFileSync(
      resolve(process.cwd(), "src/lib/api-client.ts"),
      "utf8",
    );
    const actionsSource = readFileSync(
      resolve(process.cwd(), "src/lib/actions/deck-structure-actions.ts"),
      "utf8",
    );

    expect(apiClientSource).toMatch(/artifactType\?: ArtifactType \| null;/);
    expect(apiClientSource).not.toMatch(/artifactType\?: string \| null;/);
    expect(apiClientSource).toMatch(/artifactType\?: ArtifactType \| null,/);
    expect(apiClientSource).not.toMatch(/artifactType\?: string,/);
    expect(actionsSource).toMatch(/artifactType\?: ArtifactType \| null,/);
    expect(actionsSource).not.toMatch(/artifactType\?: string,/);
  });
});
