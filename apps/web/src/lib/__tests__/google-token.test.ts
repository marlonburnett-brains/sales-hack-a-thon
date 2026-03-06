import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
    },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// ────────────────────────────────────────────────────────────
// PASS-03: getGoogleAccessToken retrieves provider_token and
//          userId from Supabase session
// ────────────────────────────────────────────────────────────

describe("getGoogleAccessToken", () => {
  it("returns accessToken and userId when session has provider_token and user exists", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { provider_token: "google-access-tok-123" },
      },
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-abc-456" } },
    });

    const { getGoogleAccessToken } = await import(
      "@/lib/supabase/google-token"
    );
    const result = await getGoogleAccessToken();

    expect(result).toEqual({
      accessToken: "google-access-tok-123",
      userId: "user-abc-456",
    });
  });

  it("returns null accessToken when session has no provider_token (subsequent request)", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { provider_token: null } },
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-abc-456" } },
    });

    const { getGoogleAccessToken } = await import(
      "@/lib/supabase/google-token"
    );
    const result = await getGoogleAccessToken();

    expect(result).toEqual({
      accessToken: null,
      userId: "user-abc-456",
    });
  });

  it("returns null accessToken when session is null (unauthenticated)", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const { getGoogleAccessToken } = await import(
      "@/lib/supabase/google-token"
    );
    const result = await getGoogleAccessToken();

    expect(result).toEqual({
      accessToken: null,
      userId: null,
    });
  });

  it("returns userId even when provider_token is absent (agent can refresh via userId)", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: {} },
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-xyz-789" } },
    });

    const { getGoogleAccessToken } = await import(
      "@/lib/supabase/google-token"
    );
    const result = await getGoogleAccessToken();

    expect(result).toEqual({
      accessToken: null,
      userId: "user-xyz-789",
    });
  });
});
