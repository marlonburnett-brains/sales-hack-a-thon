import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/env", () => ({
  env: {
    AGENT_SERVICE_URL: "http://test-agent:4111",
    AGENT_API_KEY: "test-key",
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createStreamResponse(body: string) {
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
  };
}

describe("deal chat proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [], greeting: null, suggestions: [] }),
      })
      .mockResolvedValue(
        createStreamResponse(
          [
            "Direct answer: I can help with this deal.",
            "",
            "---DEAL_CHAT_META---",
            JSON.stringify({
              response: {
                directAnswer: "I can help with this deal.",
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
                suggestedPrompt: "Clean this transcript before save.",
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
            }),
          ].join("\n"),
        ),
      );
  });

  it("forwards dealId, route context, and message body to the agent route", async () => {
    const { GET, POST } = await import("@/app/api/deals/[dealId]/chat/route");

    const getRequest = new NextRequest(
      "http://localhost/api/deals/deal-1/chat?section=briefing&pathname=%2Fdeals%2Fdeal-1%2Fbriefing&pageLabel=Briefing",
      {
        headers: {
          "X-Google-Access-Token": "google-token",
          "X-User-Id": "user-1",
        },
      },
    );

    await GET(getRequest, { params: Promise.resolve({ dealId: "deal-1" }) });

    const postRequest = new NextRequest("http://localhost/api/deals/deal-1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Google-Access-Token": "google-token",
        "X-User-Id": "user-1",
      },
      body: JSON.stringify({
        dealId: "should-be-overwritten",
        message: "Save these notes for touch 2",
        routeContext: {
          section: "briefing",
          touchType: null,
          pathname: "/deals/deal-1/briefing",
          pageLabel: "Briefing",
        },
      }),
    });

    const response = await POST(postRequest, {
      params: Promise.resolve({ dealId: "deal-1" }),
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "http://test-agent:4111/deals/deal-1/chat?section=briefing&pathname=%2Fdeals%2Fdeal-1%2Fbriefing&pageLabel=Briefing",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "X-API-Key": "test-key",
          "X-Google-Access-Token": "google-token",
          "X-User-Id": "user-1",
        }),
      }),
    );
    expect(mockFetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Authorization");
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "http://test-agent:4111/deals/deal-1/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dealId: "deal-1",
          message: "Save these notes for touch 2",
          routeContext: {
            section: "briefing",
            touchType: null,
            pathname: "/deals/deal-1/briefing",
            pageLabel: "Briefing",
          },
        }),
        headers: expect.objectContaining({
          "X-API-Key": "test-key",
          "X-Google-Access-Token": "google-token",
          "X-User-Id": "user-1",
        }),
      }),
    );
    expect(mockFetch.mock.calls[1]?.[1]?.headers).not.toHaveProperty("Authorization");
    expect(response.status).toBe(200);
  });

  it("preserves the stream and keeps refine-before-save metadata intact", async () => {
    const { POST } = await import("@/app/api/deals/[dealId]/chat/route");
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(
      createStreamResponse(
        [
          "Direct answer: I can help with this deal.",
          "",
          "---DEAL_CHAT_META---",
          JSON.stringify({
            response: {
              directAnswer: "I can help with this deal.",
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
              suggestedPrompt: "Clean this transcript before save.",
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
          }),
        ].join("\n"),
      ),
    );
    const request = new NextRequest("http://localhost/api/deals/deal-1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "speaker 1 ??? joining late and rough notes",
        routeContext: {
          section: "briefing",
          touchType: null,
          pathname: "/deals/deal-1/briefing",
          pageLabel: "Briefing",
        },
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ dealId: "deal-1" }),
    });
    const text = await response.text();

    expect(text).toContain("Direct answer: I can help with this deal.");
    expect(text).toContain("---DEAL_CHAT_META---");
    expect(text).toContain('"refineBeforeSave"');
    expect(text).toContain('"draftText":"speaker 1 ??? joining late"');
  });

  it("forwards uploaded transcript payloads through the existing JSON proxy route", async () => {
    const { POST } = await import("@/app/api/deals/[dealId]/chat/route");
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(createStreamResponse("Direct answer: Uploaded transcript received"));

    const request = new NextRequest("http://localhost/api/deals/deal-1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Please review this uploaded transcript",
        transcriptUpload: {
          fileName: "briefing-call.txt",
          mimeType: "text/plain",
          text: "speaker 1: we need timing proof points",
        },
        routeContext: {
          section: "briefing",
          touchType: null,
          pathname: "/deals/deal-1/briefing",
          pageLabel: "Briefing",
        },
      }),
    });

    await POST(request, {
      params: Promise.resolve({ dealId: "deal-1" }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/deals/deal-1/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dealId: "deal-1",
          message: "Please review this uploaded transcript",
          transcriptUpload: {
            fileName: "briefing-call.txt",
            mimeType: "text/plain",
            text: "speaker 1: we need timing proof points",
          },
          routeContext: {
            section: "briefing",
            touchType: null,
            pathname: "/deals/deal-1/briefing",
            pageLabel: "Briefing",
          },
        }),
      }),
    );
  });
});
