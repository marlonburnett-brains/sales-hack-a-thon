import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock token-cache (only dependency of request-auth)
const mockGetAccessTokenForUser = vi.fn();
vi.mock("../token-cache", () => ({
  getAccessTokenForUser: mockGetAccessTokenForUser,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

/** Helper to create a minimal Hono-like request context */
function makeCtx(headers: Record<string, string> = {}) {
  return {
    req: {
      header: (name: string) => headers[name],
    },
  };
}

describe("extractGoogleAuth", () => {
  it("returns accessToken and userId when both headers present", async () => {
    const { extractGoogleAuth } = await import("../request-auth");
    const result = await extractGoogleAuth(
      makeCtx({
        "X-Google-Access-Token": "direct-token",
        "X-User-Id": "user-123",
      })
    );

    expect(result).toEqual({
      accessToken: "direct-token",
      userId: "user-123",
    });
    // Should NOT call token-cache when direct token is present
    expect(mockGetAccessTokenForUser).not.toHaveBeenCalled();
  });

  it("returns accessToken only when only X-Google-Access-Token present", async () => {
    const { extractGoogleAuth } = await import("../request-auth");
    const result = await extractGoogleAuth(
      makeCtx({ "X-Google-Access-Token": "direct-token" })
    );

    expect(result).toEqual({ accessToken: "direct-token", userId: undefined });
    expect(mockGetAccessTokenForUser).not.toHaveBeenCalled();
  });

  it("returns refreshed accessToken when only X-User-Id present and cache returns token", async () => {
    mockGetAccessTokenForUser.mockResolvedValue("refreshed-token");

    const { extractGoogleAuth } = await import("../request-auth");
    const result = await extractGoogleAuth(
      makeCtx({ "X-User-Id": "user-123" })
    );

    expect(result).toEqual({
      accessToken: "refreshed-token",
      userId: "user-123",
    });
    expect(mockGetAccessTokenForUser).toHaveBeenCalledWith("user-123");
  });

  it("returns userId only when X-User-Id present but cache returns null", async () => {
    mockGetAccessTokenForUser.mockResolvedValue(null);

    const { extractGoogleAuth } = await import("../request-auth");
    const result = await extractGoogleAuth(
      makeCtx({ "X-User-Id": "user-123" })
    );

    expect(result).toEqual({ userId: "user-123" });
  });

  it("returns empty object when no headers present (service account fallback)", async () => {
    const { extractGoogleAuth } = await import("../request-auth");
    const result = await extractGoogleAuth(makeCtx());

    expect(result).toEqual({});
    expect(mockGetAccessTokenForUser).not.toHaveBeenCalled();
  });
});
