import { afterEach, describe, expect, it, vi } from "vitest";

type McpToolResult = {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
};

type MockedMcpConnection = {
  client: {
    callTool: (
      params: Record<string, unknown>,
      schema?: unknown,
      options?: Record<string, unknown>,
    ) => Promise<McpToolResult>;
  };
};

type MockPoolAuth = {
  token: string;
  refreshToken?: string;
  source: "pool" | "env";
  userId?: string;
  clientId?: string;
};

let mockGetConnectedClientForServer: ReturnType<
  typeof vi.fn<(serverName: string) => Promise<MockedMcpConnection>>
>;
let mockDisconnect: ReturnType<typeof vi.fn<() => Promise<void>>>;
let mockCallTool: ReturnType<
  typeof vi.fn<
    (
      params: Record<string, unknown>,
      schema?: unknown,
      options?: Record<string, unknown>,
    ) => Promise<McpToolResult>
  >
>;
let mockGetPooledAtlusAuth: ReturnType<
  typeof vi.fn<() => Promise<MockPoolAuth | null>>
>;
let mockRefreshAtlusToken: ReturnType<
  typeof vi.fn<
    (refreshToken: string, clientId: string) =>
      Promise<{ access_token: string; refresh_token?: string } | null>
  >
>;
let mockUpdateAtlusTokenInDb: ReturnType<
  typeof vi.fn<(userId: string, tokenJson: string) => Promise<void>>
>;
let mockRegisterAtlusClient: ReturnType<
  typeof vi.fn<() => Promise<{ client_id: string } | null>>
>;
let mockPersistAtlusClientId: ReturnType<
  typeof vi.fn<(userId: string, clientId: string) => Promise<void>>
>;
let mockPrismaUpdate: ReturnType<
  typeof vi.fn<(args: unknown) => Promise<unknown>>
>;
let envOverrides: Record<string, unknown>;

function createConnectedClient(): MockedMcpConnection {
  return {
    client: {
      callTool: (params, schema, options) =>
        mockCallTool(params, schema, options),
    },
  };
}

async function freshModule() {
  vi.resetModules();

  mockGetConnectedClientForServer = vi.fn();
  mockDisconnect = vi.fn().mockResolvedValue(undefined);
  mockCallTool = vi.fn();
  mockGetPooledAtlusAuth = vi.fn();
  mockRefreshAtlusToken = vi.fn();
  mockUpdateAtlusTokenInDb = vi.fn().mockResolvedValue(undefined);
  mockRegisterAtlusClient = vi.fn();
  mockPersistAtlusClientId = vi.fn().mockResolvedValue(undefined);
  mockPrismaUpdate = vi.fn().mockResolvedValue({});

  envOverrides = {
    ATLUS_USE_MCP: "true",
    ATLUS_MCP_MAX_LIFETIME_MS: 3_600_000,
  };

  vi.doMock("@mastra/mcp", () => {
    class MockMCPClient {
      disconnect = mockDisconnect;
      getConnectedClientForServer = mockGetConnectedClientForServer;
    }

    return { MCPClient: MockMCPClient };
  });

  vi.doMock("../atlus-auth", () => ({
    getPooledAtlusAuth: mockGetPooledAtlusAuth,
    refreshAtlusToken: mockRefreshAtlusToken,
    updateAtlusTokenInDb: mockUpdateAtlusTokenInDb,
    registerAtlusClient: mockRegisterAtlusClient,
    persistAtlusClientId: mockPersistAtlusClientId,
  }));

  vi.doMock("../db", () => ({
    prisma: {
      userAtlusToken: {
        update: (args: unknown) => mockPrismaUpdate(args),
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

describe("mcp-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initMcp() only marks MCP available after the health-check seam succeeds", async () => {
    const mod = await freshModule();

    mockGetPooledAtlusAuth.mockResolvedValue({
      token: "test-token",
      refreshToken: "test-refresh",
      source: "pool",
      userId: "user-1",
    });
    mockRegisterAtlusClient.mockResolvedValue({ client_id: "client-123" });
    mockGetConnectedClientForServer.mockResolvedValue(createConnectedClient());

    await mod.initMcp();

    expect(mockGetConnectedClientForServer).toHaveBeenCalledOnce();
    expect(mockGetConnectedClientForServer).toHaveBeenCalledWith("atlus");
    expect(mockPersistAtlusClientId).toHaveBeenCalledWith("user-1", "client-123");
    expect(mod.isMcpAvailable()).toBe(true);
  });

  it("initMcp() keeps fallback mode when the health-check seam fails", async () => {
    const mod = await freshModule();

    mockGetPooledAtlusAuth.mockResolvedValue({
      token: "test-token",
      source: "pool",
      userId: "user-1",
      clientId: "persisted-client",
    });
    mockGetConnectedClientForServer.mockRejectedValue(
      new Error("connection refused"),
    );

    await mod.initMcp();

    expect(mockRegisterAtlusClient).not.toHaveBeenCalled();
    expect(mod.isMcpAvailable()).toBe(false);
  });

  it("callMcpTool() retries once after refresh and preserves JSON result parsing", async () => {
    const mod = await freshModule();

    mockGetPooledAtlusAuth.mockResolvedValue({
      token: "test-token",
      refreshToken: "refresh-1",
      source: "pool",
      userId: "user-1",
      clientId: "persisted-client",
    });
    mockGetConnectedClientForServer.mockResolvedValue(createConnectedClient());
    mockCallTool
      .mockRejectedValueOnce(new Error("401 Unauthorized"))
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({ results: [{ id: "slide-1" }] }),
          },
        ],
      });
    mockRefreshAtlusToken.mockResolvedValue({
      access_token: "refreshed-token",
      refresh_token: "refresh-2",
    });

    await mod.initMcp();
    const result = await mod.callMcpTool("knowledge_base_search_semantic", {
      query: "cloud migration",
    });

    expect(mockRefreshAtlusToken).toHaveBeenCalledWith(
      "refresh-1",
      "persisted-client",
    );
    expect(mockUpdateAtlusTokenInDb).toHaveBeenCalledWith(
      "user-1",
      JSON.stringify({
        access_token: "refreshed-token",
        refresh_token: "refresh-2",
      }),
    );
    expect(result).toEqual({ results: [{ id: "slide-1" }] });
  });

  it("callMcpTool() rotates to the next token after refresh failure", async () => {
    const mod = await freshModule();

    mockGetPooledAtlusAuth
      .mockResolvedValueOnce({
        token: "token-1",
        refreshToken: "refresh-1",
        source: "pool",
        userId: "user-1",
        clientId: "persisted-client",
      })
      .mockResolvedValueOnce({
        token: "token-2",
        source: "pool",
        userId: "user-2",
      });
    mockGetConnectedClientForServer.mockResolvedValue(createConnectedClient());
    mockCallTool
      .mockRejectedValueOnce(new Error("401 Unauthorized"))
      .mockResolvedValueOnce({
        structuredContent: { results: ["rotated"] },
      });
    mockRefreshAtlusToken.mockResolvedValue(null);

    await mod.initMcp();
    const result = await mod.callMcpTool("knowledge_base_search_semantic", {
      query: "rotated search",
    });

    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isValid: false, revokedAt: expect.any(Date) },
    });
    expect(result).toEqual({ results: ["rotated"] });
  });

  it("getMcpClient() recycles stale clients and clears the cached extraction prompt", async () => {
    const mod = await freshModule();

    envOverrides.ATLUS_MCP_MAX_LIFETIME_MS = 1;

    mockGetPooledAtlusAuth.mockResolvedValue({
      token: "test-token",
      source: "pool",
      userId: "user-1",
      clientId: "persisted-client",
    });
    mockGetConnectedClientForServer.mockResolvedValue(createConnectedClient());

    await mod.initMcp();
    mod.setCachedExtractionPrompt("cached prompt");

    await new Promise((resolve) => setTimeout(resolve, 10));

    const recycledClient = await mod.getMcpClient();

    expect(recycledClient).not.toBeNull();
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mod.getCachedExtractionPrompt()).toBeNull();
  });
});
