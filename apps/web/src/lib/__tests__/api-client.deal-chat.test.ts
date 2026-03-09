import type {
  DealChatMeta,
  DealChatRouteContext,
  DealContextSource,
} from "@lumenalta/schemas";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/env", () => ({
  env: {
    AGENT_SERVICE_URL: "http://test-agent:4111",
  },
}));

vi.mock("@/lib/supabase/get-access-token", () => ({
  getSupabaseAccessToken: vi.fn().mockResolvedValue("test-supabase-jwt"),
}));

const mockGetGoogleAccessToken = vi.fn();
vi.mock("@/lib/supabase/google-token", () => ({
  getGoogleAccessToken: mockGetGoogleAccessToken,
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const routeContext: DealChatRouteContext = {
  section: "briefing",
  touchType: null,
  pathname: "/deals/deal-1/briefing",
  pageLabel: "Briefing",
};

const source: DealContextSource = {
  id: null,
  sourceType: "transcript",
  touchType: null,
  title: null,
  rawText: "speaker 1 ??? joining late",
  refinedText: "Clean transcript text",
  routeContext,
};

const meta: DealChatMeta = {
  response: {
    directAnswer: "Grounded answer",
    supportingBullets: ["Deal context is loaded."],
    missingInfoCallouts: [],
    nextSteps: ["Confirm the transcript target."],
    knowledgeMatches: [],
  },
  suggestions: [],
  binding: null,
  refineBeforeSave: {
    required: true,
    reason: "Transcript looks messy.",
    suggestedPrompt: "Clean it before save.",
    draftText: "speaker 1 ??? joining late",
  },
  confirmationChips: [],
  promptVersion: {
    agentId: "deal-chat-assistant",
    id: "version-1",
    version: 1,
    publishedAt: "2026-03-08T23:00:00.000Z",
    publishedBy: "planner",
  },
};

describe("deal chat api client and actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetGoogleAccessToken.mockResolvedValue({
      accessToken: "google-token",
      userId: "user-1",
    });
  });

  it("exposes typed helpers for bootstrap, streaming turns, and binding confirmation", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messages: [
            {
              id: "message-1",
              role: "assistant",
              content: "Grounded answer",
              meta,
              createdAt: "2026-03-08T23:00:00.000Z",
            },
          ],
          greeting: null,
          suggestions: [],
        }),
      })
      .mockResolvedValueOnce(
        new Response(
          `Direct answer: Grounded answer\n---DEAL_CHAT_META---\n${JSON.stringify(meta)}`,
          {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          },
        ),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source: {
            id: "source-1",
            dealId: "deal-1",
            sourceType: "transcript",
            touchType: "touch_2",
            interactionId: null,
            originPage: "Briefing",
            rawText: source.rawText,
            refinedText: source.refinedText,
            status: "saved",
            bindingMetaJson: JSON.stringify({ action: "correct", touchType: "touch_2" }),
            createdAt: "2026-03-08T23:00:00.000Z",
            updatedAt: "2026-03-08T23:00:10.000Z",
          },
          confirmationChip: {
            id: "source-source-1",
            label: "Saved to touch 2",
            tone: "success",
            sourceType: "transcript",
            touchType: "touch_2",
          },
        }),
      });

    const apiClient = await import("@/lib/api-client");

    const bootstrap = await apiClient.getDealChatBootstrap("deal-1", routeContext);
    const streamResponse = await apiClient.sendDealChatMessage("deal-1", {
      message: source.rawText,
      routeContext,
    });
    const bindingResult = await apiClient.confirmDealChatBinding("deal-1", {
      action: "correct",
      touchType: "touch_2",
      source,
      refinedText: source.refinedText,
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "http://test-agent:4111/deals/deal-1/chat?section=briefing&pathname=%2Fdeals%2Fdeal-1%2Fbriefing&pageLabel=Briefing",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-supabase-jwt",
          "X-Google-Access-Token": "google-token",
        }),
      }),
    );
    expect(mockFetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("X-API-Key");
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "http://test-agent:4111/deals/deal-1/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dealId: "deal-1",
          message: source.rawText,
          routeContext,
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer test-supabase-jwt",
          "X-Google-Access-Token": "google-token",
        }),
      }),
    );
    expect(mockFetch.mock.calls[1]?.[1]?.headers).not.toHaveProperty("X-API-Key");
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      "http://test-agent:4111/deals/deal-1/chat/bindings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-supabase-jwt",
          "X-Google-Access-Token": "google-token",
        }),
      }),
    );
    expect(mockFetch.mock.calls[2]?.[1]?.headers).not.toHaveProperty("X-API-Key");
    expect(bootstrap.messages[0]?.meta?.refineBeforeSave?.draftText).toBe(
      "speaker 1 ??? joining late",
    );
    expect(await streamResponse.text()).toContain("---DEAL_CHAT_META---");
    expect(bindingResult.confirmationChip.label).toBe("Saved to touch 2");
    expectTypeOf<Awaited<ReturnType<typeof apiClient.getDealChatBootstrap>>>().toMatchTypeOf<{
      messages: Array<{ meta: DealChatMeta | null }>;
    }>();
  });

  it("server actions mirror the runtime contract and revalidate deal routes after confirmed saves", async () => {
    const mockActionGetDealChatBootstrap = vi.fn().mockResolvedValue({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content: "Grounded answer",
          meta,
          createdAt: "2026-03-08T23:00:00.000Z",
        },
      ],
      greeting: null,
      suggestions: [],
    });
    const mockActionConfirmDealChatBinding = vi.fn().mockResolvedValue({
      source: {
        id: "source-1",
        dealId: "deal-1",
        sourceType: "transcript",
        touchType: "touch_2",
        interactionId: null,
        originPage: "Briefing",
        rawText: source.rawText,
        refinedText: source.refinedText,
        status: "saved",
        bindingMetaJson: JSON.stringify({ action: "correct", touchType: "touch_2" }),
        createdAt: "2026-03-08T23:00:00.000Z",
        updatedAt: "2026-03-08T23:00:10.000Z",
      },
      confirmationChip: {
        id: "source-source-1",
        label: "Saved to touch 2",
        tone: "success",
        sourceType: "transcript",
        touchType: "touch_2",
      },
    });

    vi.doMock("@/lib/api-client", async () => {
      const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
      return {
        ...actual,
        getDealChatBootstrap: mockActionGetDealChatBootstrap,
        confirmDealChatBinding: mockActionConfirmDealChatBinding,
      };
    });

    const actions = await import("@/lib/actions/deal-chat-actions");

    const bootstrap = await actions.getDealChatBootstrap("deal-1", routeContext);
    const result = await actions.confirmDealChatBinding("deal-1", {
      action: "correct",
      touchType: "touch_2",
      source,
      refinedText: source.refinedText,
    });

    expect(mockActionGetDealChatBootstrap).toHaveBeenCalledWith("deal-1", routeContext);
    expect(bootstrap.messages[0]?.meta?.refineBeforeSave?.reason).toBe(
      "Transcript looks messy.",
    );
    expect(mockActionConfirmDealChatBinding).toHaveBeenCalledWith("deal-1", {
      action: "correct",
      touchType: "touch_2",
      source,
      refinedText: source.refinedText,
    });
    expect(result.source.originPage).toBe("Briefing");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/deals/deal-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/deals/deal-1/briefing");
  });
});
