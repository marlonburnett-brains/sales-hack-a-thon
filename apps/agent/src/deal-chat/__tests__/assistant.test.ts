import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DealChatRouteContext } from "@lumenalta/schemas";

const {
  mockLoadDealChatContext,
  mockSearchSlides,
  mockStreamRuntimeProviderNamedAgent,
} = vi.hoisted(() => ({
  mockLoadDealChatContext: vi.fn(),
  mockSearchSlides: vi.fn(),
  mockStreamRuntimeProviderNamedAgent: vi.fn(),
}));

vi.mock("../context", () => ({
  loadDealChatContext: mockLoadDealChatContext,
}));

vi.mock("../../lib/atlusai-search", () => ({
  searchSlides: mockSearchSlides,
}));

vi.mock("../../lib/agent-executor", () => ({
  streamRuntimeProviderNamedAgent: mockStreamRuntimeProviderNamedAgent,
}));

const briefingRoute: DealChatRouteContext = {
  section: "briefing",
  touchType: null,
  pathname: "/deals/deal-1/briefing",
  pageLabel: "Briefing",
};

describe("runDealChatTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadDealChatContext.mockResolvedValue({
      deal: {
        id: "deal-1",
        name: "Acme expansion",
        company: { name: "Acme", industry: "Retail" },
      },
      interactions: [
        {
          id: "interaction-3",
          touchType: "touch_3",
          status: "approved",
          updatedAt: new Date("2026-03-08T22:00:00Z"),
        },
        {
          id: "interaction-2",
          touchType: "touch_2",
          status: "approved",
          updatedAt: new Date("2026-03-08T21:00:00Z"),
        },
      ],
      sources: [
        {
          id: "source-1",
          sourceType: "note",
          touchType: "touch_2",
          originPage: "Briefing",
          rawText: "Buyer needs stronger migration proof points before the next call.",
          refinedText: null,
          status: "saved",
          bindingMetaJson: null,
          createdAt: new Date("2026-03-08T20:00:00Z"),
        },
      ],
      recentMessages: [
        { role: "user", content: "What changed since Touch 2?" },
      ],
      promptSummary: "Seller is preparing for the next customer conversation.",
      routeContext: briefingRoute,
    });

    mockSearchSlides.mockResolvedValue([]);
    mockStreamRuntimeProviderNamedAgent.mockResolvedValue({
      stream: [{ text: "Grounded text chunk." }],
      promptVersion: {
        agentId: "deal-chat-assistant",
        id: "version-1",
        version: 3,
        publishedAt: new Date("2026-03-08T20:00:00Z"),
        publishedBy: "planner",
      },
    });
  });

  it("uses deal, interaction, and source context to answer in the locked short-first format", async () => {
    const { runDealChatTurn } = await import("../assistant");

    const result = await runDealChatTurn({
      dealId: "deal-1",
      message: "What changed since Touch 2?",
      routeContext: briefingRoute,
    });

    expect(result.text.split("\n")[0]).toMatch(/^Direct answer:/);
    expect(result.text).toContain("Supporting details:");
    expect(result.text).toContain("Next steps:");
    expect(result.meta.response.supportingBullets.join(" ")).toContain("Touch 3");
    expect(result.meta.response.supportingBullets.join(" ")).toContain("migration proof points");
  });

  it("calls searchSlides for knowledge queries and returns structured why-fit match cards", async () => {
    mockSearchSlides.mockResolvedValue([
      {
        slideId: "slide-1",
        documentTitle: "Retail modernization proof",
        textContent: "Retail case study on migration acceleration and ROI.",
        speakerNotes: "Strong fit for data modernization conversations.",
        metadata: { touchType: "touch_3" },
        relevanceScore: 0.94,
        source: "mcp",
      },
    ]);

    const { runDealChatTurn } = await import("../assistant");

    const result = await runDealChatTurn({
      dealId: "deal-1",
      message: "Show similar retail cases for migration ROI",
      routeContext: briefingRoute,
    });

    expect(mockSearchSlides).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "Show similar retail cases for migration ROI",
        industry: "Retail",
      }),
    );
    expect(result.meta.response.knowledgeMatches).toEqual([
      expect.objectContaining({
        title: "Retail modernization proof",
        whyFit: expect.stringContaining("Retail"),
      }),
    ]);
    expect(result.text).toContain("Top matches:");
  });

  it("returns pending confirmation and refine-before-save guidance for messy transcript-like input", async () => {
    const { runDealChatTurn } = await import("../assistant");

    const result = await runDealChatTurn({
      dealId: "deal-1",
      message: "... joining late ... ??? can you hear me ... [inaudible] ...",
      routeContext: briefingRoute,
    });

    expect(result.meta.binding?.status).toBe("needs_confirmation");
    expect(result.meta.refineBeforeSave).toMatchObject({
      required: true,
      suggestedPrompt: expect.stringContaining("clean up"),
    });
    expect(result.meta.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "save_transcript" }),
      ]),
    );
  });

  it("routes prompt-bearing turns through the named deal-chat assistant runtime", async () => {
    const { runDealChatTurn } = await import("../assistant");

    await runDealChatTurn({
      dealId: "deal-1",
      message: "Summarize the latest deal risk.",
      routeContext: briefingRoute,
    });

    expect(mockStreamRuntimeProviderNamedAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "deal-chat-assistant",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user" }),
        ]),
      }),
    );
  });
});
