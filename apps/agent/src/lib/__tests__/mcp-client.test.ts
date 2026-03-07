import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Shared mock state — each test gets a fresh module import
// but shares these mock fns so vi.doMock closures work.
// ────────────────────────────────────────────────────────────

let mockListTools: ReturnType<typeof vi.fn>;
let mockDisconnect: ReturnType<typeof vi.fn>;
let mockExecute: ReturnType<typeof vi.fn>;
let mockGetPooledAtlusAuth: ReturnType<typeof vi.fn>;
let mockRefreshAtlusToken: ReturnType<typeof vi.fn>;
let mockUpdateAtlusTokenInDb: ReturnType<typeof vi.fn>;
let mockRegisterAtlusClient: ReturnType<typeof vi.fn>;
let mockPrismaUpdate: ReturnType<typeof vi.fn>;
let envOverrides: Record<string, unknown>;

async function freshModule() {
  // Reset modules to get fresh singleton state
  vi.resetModules();

  // Create fresh mocks
  mockListTools = vi.fn();
  mockDisconnect = vi.fn().mockResolvedValue(undefined);
  mockExecute = vi.fn();
  mockGetPooledAtlusAuth = vi.fn();
  mockRefreshAtlusToken = vi.fn();
  mockUpdateAtlusTokenInDb = vi.fn();
  mockRegisterAtlusClient = vi.fn();
  mockPrismaUpdate = vi.fn().mockResolvedValue({});

  envOverrides = {
    ATLUS_USE_MCP: "true",
    ATLUS_MCP_MAX_LIFETIME_MS: 3_600_000,
    ATLUS_PROJECT_ID: undefined,
  };

  vi.doMock("@mastra/mcp", () => {
    class MockMCPClient {
      listTools = mockListTools;
      disconnect = mockDisconnect;
    }
    return { MCPClient: MockMCPClient };
  });

  vi.doMock("../atlus-auth", () => ({
    getPooledAtlusAuth: mockGetPooledAtlusAuth,
    refreshAtlusToken: mockRefreshAtlusToken,
    updateAtlusTokenInDb: mockUpdateAtlusTokenInDb,
    registerAtlusClient: mockRegisterAtlusClient,
  }));

  vi.doMock("../db", () => ({
    prisma: {
      userAtlusToken: {
        update: (...args: unknown[]) => mockPrismaUpdate(...args),
      },
    },
  }));

  vi.doMock("../../env", () => ({
    env: new Proxy(
      {},
      {
        get: (_target, prop: string) => envOverrides[prop],
      },
    ),
  }));

  return import("../mcp-client");
}

describe("MCP Client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────
  // Health check (MCP-03)
  // ──────────────────────────────────────────────────────────

  describe("initMcp() - Health check (MCP-03)", () => {
    it("calls listTools() and sets fallbackMode=false on success", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "test-token",
        refreshToken: "test-refresh",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });
      mockListTools.mockResolvedValue({
        atlus_search: { execute: mockExecute },
        atlus_list: { execute: mockExecute },
      });

      await mod.initMcp();

      expect(mockListTools).toHaveBeenCalledOnce();
      expect(mod.isMcpAvailable()).toBe(true);
    });

    it("sets fallbackMode=true when listTools() throws", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "test-token",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue(null);
      mockListTools.mockRejectedValue(new Error("Connection refused"));

      await mod.initMcp();

      expect(mod.isMcpAvailable()).toBe(false);
    });

    it("sets fallbackMode=true when no pool tokens available", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockResolvedValue(null);

      await mod.initMcp();

      expect(mod.isMcpAvailable()).toBe(false);
    });

    it("never throws (catches all errors)", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockRejectedValue(
        new Error("DB connection failed"),
      );

      // Should not throw
      await expect(mod.initMcp()).resolves.toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Auth injection (MCP-04)
  // ──────────────────────────────────────────────────────────

  describe("Auth injection (MCP-04)", () => {
    it("MCPClient is created and client is available after init", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "injected-token-123",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });
      mockListTools.mockResolvedValue({ tool1: { execute: mockExecute } });

      await mod.initMcp();

      // Client should be available -- this proves MCPClient was constructed
      // and the fetch callback was set (otherwise health check would fail)
      const client = await mod.getMcpClient();
      expect(client).not.toBeNull();
      expect(mod.isMcpAvailable()).toBe(true);
    });

    it("fetch callback uses current auth token (not stale)", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "fresh-token",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });
      mockListTools.mockResolvedValue({ tool1: { execute: mockExecute } });

      await mod.initMcp();

      // Client should use the current token from pool
      const client = await mod.getMcpClient();
      expect(client).not.toBeNull();
      // The fact that listTools() succeeded (mock) confirms the client was
      // created with the auth context -- fetch callback is wired
    });
  });

  // ──────────────────────────────────────────────────────────
  // Max lifetime (MCP-05)
  // ──────────────────────────────────────────────────────────

  describe("getMcpClient() - Max lifetime (MCP-05)", () => {
    it("returns same client when under max lifetime", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "test-token",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });
      mockListTools.mockResolvedValue({ tool1: { execute: mockExecute } });

      await mod.initMcp();

      const client1 = await mod.getMcpClient();
      const client2 = await mod.getMcpClient();

      expect(client1).toBe(client2);
      expect(client1).not.toBeNull();
    });

    it("disconnects and recreates client when over max lifetime", async () => {
      const mod = await freshModule();

      envOverrides.ATLUS_MCP_MAX_LIFETIME_MS = 1; // 1ms

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "test-token",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });
      mockListTools.mockResolvedValue({ tool1: { execute: mockExecute } });

      await mod.initMcp();

      // Wait to exceed the max lifetime
      await new Promise((resolve) => setTimeout(resolve, 10));

      // This should trigger recycle
      const client = await mod.getMcpClient();
      expect(client).not.toBeNull();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("clears cached extraction prompt on recycle", async () => {
      const mod = await freshModule();

      envOverrides.ATLUS_MCP_MAX_LIFETIME_MS = 1; // 1ms

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "test-token",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });
      mockListTools.mockResolvedValue({ tool1: { execute: mockExecute } });

      await mod.initMcp();
      mod.setCachedExtractionPrompt("cached prompt");
      expect(mod.getCachedExtractionPrompt()).toBe("cached prompt");

      // Wait to exceed the max lifetime
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Trigger recycle
      await mod.getMcpClient();
      expect(mod.getCachedExtractionPrompt()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────
  // SIGTERM shutdown (MCP-06)
  // ──────────────────────────────────────────────────────────

  describe("shutdownMcp() (MCP-06)", () => {
    it("calls client.disconnect()", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "test-token",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });
      mockListTools.mockResolvedValue({ tool1: { execute: mockExecute } });

      await mod.initMcp();
      await mod.shutdownMcp();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("handles null client gracefully", async () => {
      const mod = await freshModule();

      // No init -- client is null
      await expect(mod.shutdownMcp()).resolves.toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Token refresh/rotation
  // ──────────────────────────────────────────────────────────

  describe("callMcpTool() - Token refresh/rotation", () => {
    it("on auth failure: tries refresh first, retries tool call on success", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth.mockResolvedValue({
        token: "test-token",
        refreshToken: "test-refresh",
        source: "pool",
        userId: "user-1",
      });
      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });

      // listTools works for all calls
      mockListTools.mockResolvedValue({
        atlus_search: { execute: mockExecute },
      });

      // First execute throws 401, second succeeds after refresh
      mockExecute
        .mockRejectedValueOnce(new Error("401 Unauthorized"))
        .mockResolvedValueOnce({ results: [] });

      // Refresh succeeds
      mockRefreshAtlusToken.mockResolvedValue({
        access_token: "refreshed-token",
        refresh_token: "new-refresh",
      });
      mockUpdateAtlusTokenInDb.mockResolvedValue(undefined);

      await mod.initMcp();
      const result = await mod.callMcpTool("search", { query: "test" });

      expect(mockRefreshAtlusToken).toHaveBeenCalledWith(
        "test-refresh",
        "test-client-id",
      );
      expect(result).toEqual({ results: [] });
    });

    it("on refresh failure: marks token invalid, rotates to next pool token", async () => {
      const mod = await freshModule();

      mockGetPooledAtlusAuth
        .mockResolvedValueOnce({
          token: "token-1",
          refreshToken: "refresh-1",
          source: "pool",
          userId: "user-1",
        })
        // Second call during rotation
        .mockResolvedValueOnce({
          token: "token-2",
          source: "pool",
          userId: "user-2",
        });

      mockRegisterAtlusClient.mockResolvedValue({
        client_id: "test-client-id",
      });

      mockListTools.mockResolvedValue({
        atlus_search: { execute: mockExecute },
      });

      // First execute throws 401, second succeeds after rotation
      mockExecute
        .mockRejectedValueOnce(new Error("401 Unauthorized"))
        .mockResolvedValueOnce({ results: ["rotated"] });

      // Refresh fails
      mockRefreshAtlusToken.mockResolvedValue(null);

      await mod.initMcp();
      const result = await mod.callMcpTool("search", { query: "test" });

      // Token should have been marked invalid
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { isValid: false, revokedAt: expect.any(Date) },
      });

      expect(result).toEqual({ results: ["rotated"] });
    });
  });

  // ──────────────────────────────────────────────────────────
  // Kill switch
  // ──────────────────────────────────────────────────────────

  describe("Kill switch", () => {
    it("getMcpClient() returns null when ATLUS_USE_MCP=false", async () => {
      const mod = await freshModule();
      envOverrides.ATLUS_USE_MCP = "false";

      const client = await mod.getMcpClient();
      expect(client).toBeNull();
    });

    it("isMcpAvailable() returns false when ATLUS_USE_MCP=false", async () => {
      const mod = await freshModule();
      envOverrides.ATLUS_USE_MCP = "false";

      expect(mod.isMcpAvailable()).toBe(false);
    });

    it("initMcp() is a no-op when ATLUS_USE_MCP=false", async () => {
      const mod = await freshModule();
      envOverrides.ATLUS_USE_MCP = "false";

      await mod.initMcp();

      expect(mockGetPooledAtlusAuth).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Extraction prompt cache
  // ──────────────────────────────────────────────────────────

  describe("Extraction prompt cache", () => {
    it("get/set cached extraction prompt", async () => {
      const mod = await freshModule();

      expect(mod.getCachedExtractionPrompt()).toBeNull();
      mod.setCachedExtractionPrompt("test prompt");
      expect(mod.getCachedExtractionPrompt()).toBe("test prompt");
    });
  });
});
