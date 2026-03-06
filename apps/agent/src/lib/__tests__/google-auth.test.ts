import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mocks must be declared before any dynamic import of the
// module under test so the hoisted vi.mock() calls are in place.
// ────────────────────────────────────────────────────────────

// 1. Env mock -- prevents @t3-oss/env-core validation
vi.mock("../../env", () => ({
  env: {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_SERVICE_ACCOUNT_KEY: JSON.stringify({
      type: "service_account",
      project_id: "test-project",
      private_key: "fake-key",
      client_email: "test@test.iam.gserviceaccount.com",
    }),
  },
}));

// 2. googleapis mock
const mockGoogleAuth = vi.fn();
const mockSlides = vi.fn().mockReturnValue({ presentations: {} });
const mockDrive = vi.fn().mockReturnValue({ files: {} });
const mockDocs = vi.fn().mockReturnValue({ documents: {} });

vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: mockGoogleAuth },
    slides: mockSlides,
    drive: mockDrive,
    docs: mockDocs,
  },
}));

// 3. google-auth-library mock
const mockSetCredentials = vi.fn();
const mockGetAccessToken = vi.fn();
const mockOn = vi.fn();

vi.mock("google-auth-library", () => {
  return {
    OAuth2Client: class MockOAuth2Client {
      constructor(..._args: unknown[]) {
        mockOAuth2ClientConstruct(..._args);
      }
      setCredentials = mockSetCredentials;
      getAccessToken = mockGetAccessToken;
      on = mockOn;
    },
  };
});

const mockOAuth2ClientConstruct = vi.fn();

// 4. @prisma/client mock
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();

vi.mock("@prisma/client", () => {
  return {
    PrismaClient: class MockPrismaClient {
      userGoogleToken = {
        findMany: mockFindMany,
        update: mockUpdate,
        count: mockCount,
      };
      actionRequired = {
        findFirst: mockFindFirst,
        create: mockCreate,
      };
    },
  };
});

// 5. token-encryption mock
const mockDecryptToken = vi.fn().mockReturnValue("decrypted-refresh-token");
const mockEncryptToken = vi.fn().mockReturnValue({
  encrypted: "enc",
  iv: "iv",
  authTag: "tag",
});
vi.mock("../token-encryption", () => ({
  decryptToken: mockDecryptToken,
  encryptToken: mockEncryptToken,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  // Re-set return values cleared by clearAllMocks
  mockDecryptToken.mockReturnValue("decrypted-refresh-token");
  mockEncryptToken.mockReturnValue({ encrypted: "enc", iv: "iv", authTag: "tag" });
  mockSlides.mockReturnValue({ presentations: {} });
  mockDrive.mockReturnValue({ files: {} });
  mockDocs.mockReturnValue({ documents: {} });
});

// ────────────────────────────────────────────────────────────
// Dual-mode auth factories
// ────────────────────────────────────────────────────────────

describe("Dual-mode auth factories", () => {
  it("getSlidesClient with no args uses service account (GoogleAuth)", async () => {
    const { getSlidesClient } = await import("../google-auth");
    getSlidesClient();

    expect(mockGoogleAuth).toHaveBeenCalled();
    expect(mockSlides).toHaveBeenCalledWith(
      expect.objectContaining({ version: "v1" })
    );
    expect(mockOAuth2ClientConstruct).not.toHaveBeenCalled();
  });

  it("getDriveClient with undefined uses service account", async () => {
    const { getDriveClient } = await import("../google-auth");
    getDriveClient(undefined);

    expect(mockGoogleAuth).toHaveBeenCalled();
    expect(mockDrive).toHaveBeenCalledWith(
      expect.objectContaining({ version: "v3" })
    );
    expect(mockOAuth2ClientConstruct).not.toHaveBeenCalled();
  });

  it("getDocsClient with empty options (no accessToken) falls back to service account", async () => {
    const { getDocsClient } = await import("../google-auth");
    getDocsClient({});

    // getUserAuth returns null for no accessToken, so falls back to GoogleAuth
    expect(mockGoogleAuth).toHaveBeenCalled();
    expect(mockDocs).toHaveBeenCalledWith(
      expect.objectContaining({ version: "v1" })
    );
  });

  it("getSlidesClient with accessToken uses OAuth2Client", async () => {
    const { getSlidesClient } = await import("../google-auth");
    getSlidesClient({ accessToken: "user-token" });

    expect(mockOAuth2ClientConstruct).toHaveBeenCalled();
    expect(mockSetCredentials).toHaveBeenCalledWith({
      access_token: "user-token",
    });
  });

  it("getDriveClient with accessToken uses OAuth2Client", async () => {
    const { getDriveClient } = await import("../google-auth");
    getDriveClient({ accessToken: "user-token" });

    expect(mockOAuth2ClientConstruct).toHaveBeenCalled();
    expect(mockSetCredentials).toHaveBeenCalledWith({
      access_token: "user-token",
    });
  });

  it("getDocsClient with accessToken uses OAuth2Client", async () => {
    const { getDocsClient } = await import("../google-auth");
    getDocsClient({ accessToken: "user-token" });

    expect(mockOAuth2ClientConstruct).toHaveBeenCalled();
    expect(mockSetCredentials).toHaveBeenCalledWith({
      access_token: "user-token",
    });
  });
});

// ────────────────────────────────────────────────────────────
// getPooledGoogleAuth
// ────────────────────────────────────────────────────────────

describe("getPooledGoogleAuth", () => {
  const makeToken = (overrides = {}) => ({
    id: "token-1",
    userId: "user-123",
    email: "user@example.com",
    encryptedRefresh: "enc-refresh",
    iv: "enc-iv",
    authTag: "enc-tag",
    isValid: true,
    lastUsedAt: new Date(),
    ...overrides,
  });

  it("returns pool source with accessToken when valid token found", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    mockGetAccessToken.mockResolvedValue({ token: "fresh-access-token" });
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(5);

    const { getPooledGoogleAuth } = await import("../google-auth");
    const result = await getPooledGoogleAuth();

    expect(result).toEqual({
      accessToken: "fresh-access-token",
      source: "pool",
      userId: "user-123",
    });
  });

  it("updates lastUsedAt on success (fire-and-forget)", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    mockGetAccessToken.mockResolvedValue({ token: "fresh-access-token" });
    const catchFn = vi.fn();
    mockUpdate.mockReturnValue({ catch: catchFn });
    mockCount.mockResolvedValue(5);

    const { getPooledGoogleAuth } = await import("../google-auth");
    await getPooledGoogleAuth();

    // update called for lastUsedAt
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "token-1" },
        data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      })
    );
  });

  it("marks token isValid=false with revokedAt on failure", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    mockGetAccessToken.mockRejectedValue(new Error("Token revoked"));
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});

    const { getPooledGoogleAuth } = await import("../google-auth");
    await getPooledGoogleAuth();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "token-1" },
        data: expect.objectContaining({
          isValid: false,
          revokedAt: expect.any(Date),
        }),
      })
    );
  });

  it("creates ActionRequired record on token failure when none exists", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    mockGetAccessToken.mockRejectedValue(new Error("Token revoked"));
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});

    const { getPooledGoogleAuth } = await import("../google-auth");
    await getPooledGoogleAuth();

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-123",
          actionType: "reauth_needed",
          resolved: false,
        },
      })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-123",
          actionType: "reauth_needed",
        }),
      })
    );
  });

  it("does NOT create ActionRequired if one already exists", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    mockGetAccessToken.mockRejectedValue(new Error("Token revoked"));
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue({ id: "existing-action" });

    const { getPooledGoogleAuth } = await import("../google-auth");
    await getPooledGoogleAuth();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns service_account when all tokens fail", async () => {
    mockFindMany.mockResolvedValue([
      makeToken({ id: "t1" }),
      makeToken({ id: "t2" }),
    ]);
    mockGetAccessToken.mockRejectedValue(new Error("Revoked"));
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(0);
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});

    const { getPooledGoogleAuth } = await import("../google-auth");
    const result = await getPooledGoogleAuth();

    expect(result).toEqual({ source: "service_account" });
  });

  it("returns service_account when no tokens in pool", async () => {
    mockFindMany.mockResolvedValue([]);

    const { getPooledGoogleAuth } = await import("../google-auth");
    const result = await getPooledGoogleAuth();

    expect(result).toEqual({ source: "service_account" });
  });

  it("warns when valid token count < 3 (pool health)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFindMany.mockResolvedValue([makeToken()]);
    mockGetAccessToken.mockResolvedValue({ token: "fresh-token" });
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(2);

    const { getPooledGoogleAuth } = await import("../google-auth");
    await getPooledGoogleAuth();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("2 valid token(s) remaining")
    );
    warnSpy.mockRestore();
  });

  it("token rotation: 'tokens' event handler updates encrypted refresh token", async () => {
    mockFindMany.mockResolvedValue([makeToken()]);
    mockGetAccessToken.mockResolvedValue({ token: "fresh-token" });
    mockUpdate.mockReturnValue({ catch: vi.fn() });
    mockCount.mockResolvedValue(5);

    // Capture the 'tokens' event handler
    let tokensHandler: ((tokens: { refresh_token?: string }) => void) | undefined;
    mockOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === "tokens") {
        tokensHandler = handler as (tokens: { refresh_token?: string }) => void;
      }
    });

    const { getPooledGoogleAuth } = await import("../google-auth");
    await getPooledGoogleAuth();

    expect(tokensHandler).toBeDefined();

    // Simulate Google sending a new refresh token
    tokensHandler!({ refresh_token: "new-refresh-token" });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "token-1" },
        data: expect.objectContaining({
          encryptedRefresh: "enc",
          iv: "iv",
          authTag: "tag",
        }),
      })
    );
  });
});
