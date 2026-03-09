import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/env", () => ({
  env: {
    AGENT_SERVICE_URL: "http://test-agent:4111",
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-supabase-jwt" } },
      }),
    },
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("deal chat binding proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        source: {
          id: "source-1",
          sourceType: "transcript",
          touchType: "touch_2",
          status: "saved",
          refinedText: "Clean transcript text",
          originPage: "Briefing",
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
  });

  it("forwards confirmation or correction payloads and returns saved source metadata", async () => {
    const { POST } = await import("@/app/api/deals/[dealId]/chat/bindings/route");
    const request = new NextRequest("http://localhost/api/deals/deal-1/chat/bindings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Google-Access-Token": "google-token",
        "X-User-Id": "user-1",
      },
      body: JSON.stringify({
        action: "correct",
        touchType: "touch_2",
        source: {
          id: null,
          sourceType: "transcript",
          touchType: null,
          title: null,
          rawText: "speaker 1 ???",
          refinedText: "Clean transcript text",
          routeContext: {
            section: "briefing",
            touchType: null,
            pathname: "/deals/deal-1/briefing",
            pageLabel: "Briefing",
          },
        },
        refinedText: "Clean transcript text",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ dealId: "deal-1" }),
    });
    const payload = await response.json();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/deals/deal-1/chat/bindings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "X-Google-Access-Token": "google-token",
          "X-User-Id": "user-1",
        }),
      }),
    );
    expect(mockFetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("X-API-Key");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body as string)).toEqual({
      action: "correct",
      touchType: "touch_2",
      source: {
        id: null,
        sourceType: "transcript",
        touchType: null,
        title: null,
        rawText: "speaker 1 ???",
        refinedText: "Clean transcript text",
        routeContext: {
          section: "briefing",
          touchType: null,
          pathname: "/deals/deal-1/briefing",
          pageLabel: "Briefing",
        },
      },
      refinedText: "Clean transcript text",
    });
    expect(payload).toMatchObject({
      source: {
        id: "source-1",
        status: "saved",
        refinedText: "Clean transcript text",
      },
      confirmationChip: {
        label: "Saved to touch 2",
      },
    });
  });
});
