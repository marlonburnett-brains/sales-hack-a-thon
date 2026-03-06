/**
 * Phase 24 - UI-api-client: API client helpers fetchActions, fetchActionCount,
 * resolveAction call the correct endpoints with correct methods.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only to prevent import error in test env
vi.mock("server-only", () => ({}));

// Mock the env module
vi.mock("@/env", () => ({
  env: {
    AGENT_SERVICE_URL: "http://test-agent:4111",
    AGENT_API_KEY: "test-key",
  },
}));

// Mock google token (not needed for these calls, but imported by api-client)
vi.mock("@/lib/supabase/google-token", () => ({
  getGoogleAccessToken: vi.fn().mockResolvedValue({
    accessToken: null,
    userId: null,
  }),
}));

// Capture fetch calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { fetchActions, fetchActionCount, resolveAction } from "../api-client";

describe("UI-api-client: Action Required API client helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchActions calls GET /actions and returns action list", async () => {
    const mockActions = [
      { id: "a1", actionType: "reauth_needed", title: "Re-auth" },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockActions),
    });

    const result = await fetchActions();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/actions",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        }),
      })
    );
    expect(result).toEqual(mockActions);
  });

  it("fetchActionCount calls GET /actions/count and returns numeric count", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 7 }),
    });

    const count = await fetchActionCount();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/actions/count",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        }),
      })
    );
    expect(count).toBe(7);
  });

  it("resolveAction calls PATCH /actions/:id/resolve", async () => {
    const resolved = {
      id: "act-1",
      resolved: true,
      resolvedAt: "2026-03-06T12:00:00Z",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(resolved),
    });

    const result = await resolveAction("act-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-agent:4111/actions/act-1/resolve",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        }),
      })
    );
    expect(result).toEqual(resolved);
  });

  it("fetchActions throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(fetchActions()).rejects.toThrow("Agent API error (500)");
  });

  it("fetchActionCount returns a number, not the raw object", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 0 }),
    });

    const count = await fetchActionCount();
    expect(typeof count).toBe("number");
    expect(count).toBe(0);
  });
});
