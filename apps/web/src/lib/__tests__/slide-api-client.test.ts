/**
 * Phase 21 - PREV-05: Classification updates hit server action/endpoint
 * Tests that api-client slide functions call fetchJSON with correct paths, methods, and payloads.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only to prevent import error in test env
vi.mock("server-only", () => ({}));

// Mock the env module
vi.mock("@/env", () => ({
  env: {
    AGENT_SERVICE_URL: "http://test-agent:4111",
  },
}));

vi.mock("@/lib/supabase/get-access-token", () => ({
  getSupabaseAccessToken: vi.fn().mockResolvedValue("test-supabase-jwt"),
}));

vi.mock("@/lib/supabase/google-token", () => ({
  getGoogleAccessToken: vi.fn().mockResolvedValue({
    accessToken: "google-token",
    userId: "user-1",
  }),
}));

// Capture fetch calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("PREV-05: Slide api-client functions call correct endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it("listSlides calls GET /templates/:id/slides", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "s1",
            slideIndex: 0,
            reviewStatus: "unreviewed",
          },
        ]),
    });

    const { listSlides } = await import("@/lib/api-client");
    const result = await listSlides("tmpl-123");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/templates/tmpl-123/slides",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        }),
      })
    );
    expect(mockFetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("X-API-Key");
    expect(result).toEqual([
      { id: "s1", slideIndex: 0, reviewStatus: "unreviewed" },
    ]);
  });

  it("getSlideThumbnails calls GET /templates/:id/thumbnails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          thumbnails: [
            { slideObjectId: "obj1", slideIndex: 0, thumbnailUrl: "http://thumb.png" },
          ],
        }),
    });

    const { getSlideThumbnails } = await import("@/lib/api-client");
    const result = await getSlideThumbnails("tmpl-456");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/templates/tmpl-456/thumbnails",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        }),
      })
    );
    expect(mockFetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("X-API-Key");
    expect(result.thumbnails).toHaveLength(1);
    expect(result.thumbnails[0].thumbnailUrl).toBe("http://thumb.png");
  });

  it("updateSlideClassification calls POST /slides/:id/update-classification with approved status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { updateSlideClassification } = await import("@/lib/api-client");
    const result = await updateSlideClassification("slide-1", {
      reviewStatus: "approved",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/slides/slide-1/update-classification",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reviewStatus: "approved" }),
      })
    );
    expect(result.success).toBe(true);
  });

  it("updateSlideClassification sends correctedTags with needs_correction status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { updateSlideClassification } = await import("@/lib/api-client");
    const correctedTags = {
      industries: ["Healthcare"],
      solutionPillars: ["AI, ML & LLM"],
      buyerPersonas: ["CTO"],
      funnelStages: ["First Contact"],
      contentType: "template",
      slideCategory: "title",
    };

    await updateSlideClassification("slide-2", {
      reviewStatus: "needs_correction",
      correctedTags,
    });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.reviewStatus).toBe("needs_correction");
    expect(body.correctedTags.industries).toEqual(["Healthcare"]);
    expect(body.correctedTags.slideCategory).toBe("title");
  });

  it("findSimilarSlides calls POST /slides/:id/similar with limit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            { id: "s2", similarity: 0.92, templateId: "t1", slideIndex: 3 },
          ],
        }),
    });

    const { findSimilarSlides } = await import("@/lib/api-client");
    const result = await findSimilarSlides("slide-5", 8);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/slides/slide-5/similar",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ limit: 8 }),
      })
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].similarity).toBe(0.92);
  });

  it("findSimilarSlides defaults limit to 10 when not specified", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    const { findSimilarSlides } = await import("@/lib/api-client");
    await findSimilarSlides("slide-6");

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.limit).toBe(10);
  });

  it("throws on non-ok response with status and error text", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Slide not found"),
    });

    const { listSlides } = await import("@/lib/api-client");
    await expect(listSlides("bad-id")).rejects.toThrow("Agent API error (404): Slide not found");
  });
});
