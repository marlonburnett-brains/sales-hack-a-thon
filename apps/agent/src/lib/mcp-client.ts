/**
 * MCPClient Singleton Wrapper with Lifecycle Management
 *
 * Connects to the AtlusAI SSE endpoint using pooled OAuth Bearer tokens.
 * Manages health checks, max lifetime recycling, token refresh/rotation,
 * and graceful SIGTERM shutdown.
 *
 * Exports:
 *   initMcp()                  - Eager connection on agent boot
 *   getMcpClient()             - Get client with lazy recycle
 *   callMcpTool()              - Call a tool with retry/rotate on 401
 *   isMcpAvailable()           - Quick sync availability check
 *   shutdownMcp()              - Graceful disconnect
 *   getCachedExtractionPrompt() / setCachedExtractionPrompt() - Adaptive prompt cache
 */

import { MCPClient } from "@mastra/mcp";
import {
  getPooledAtlusAuth,
  refreshAtlusToken,
  updateAtlusTokenInDb,
  registerAtlusClient,
  type PooledAtlusAuthResult,
} from "./atlus-auth";
import { prisma } from "./db";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// Module state
// ────────────────────────────────────────────────────────────

let client: MCPClient | null = null;
let createdAt = 0;
let currentAuth: {
  token: string;
  refreshToken?: string;
  userId?: string;
  source: "pool" | "env";
} | null = null;
let fallbackMode = false;
let cachedExtractionPrompt: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let cachedClientId: string | null = null;

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

function createClient(): MCPClient {
  return new MCPClient({
    id: "atlus-mcp",
    servers: {
      atlus: {
        url: new URL("https://knowledge-base-api.lumenalta.com/sse"),
        timeout: 30_000,
        connectTimeout: 5_000,
        fetch: (input: string | URL | Request, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          if (currentAuth?.token) {
            headers.set("Authorization", `Bearer ${currentAuth.token}`);
          }
          return fetch(input, { ...init, headers });
        },
      },
    },
    timeout: 30_000,
  });
}

function isAuthError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("unauthorized") ||
      msg.includes("not authenticated") ||
      msg.includes("authentication")
    );
  }
  return false;
}

/**
 * Handle auth failure: try refresh first, then rotate to next pool token.
 * Uses refreshPromise mutex to serialize concurrent refresh attempts.
 *
 * @returns true if auth was refreshed successfully, false if rotation happened or failed
 */
async function handleAuthFailure(): Promise<boolean> {
  // Mutex: if a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      // Try refresh first if we have a refresh token
      if (currentAuth?.refreshToken && cachedClientId) {
        const result = await refreshAtlusToken(
          currentAuth.refreshToken,
          cachedClientId,
        );

        if (result) {
          // Refresh succeeded -- update DB and local state
          const newTokenJson = JSON.stringify({
            access_token: result.access_token,
            refresh_token: result.refresh_token ?? currentAuth.refreshToken,
          });

          if (currentAuth.userId) {
            try {
              await updateAtlusTokenInDb(currentAuth.userId, newTokenJson);
            } catch (err) {
              console.warn("[mcp] Failed to update refreshed token in DB:", err);
            }
          }

          currentAuth.token = result.access_token;
          if (result.refresh_token) {
            currentAuth.refreshToken = result.refresh_token;
          }

          // Disconnect and recreate client with new token
          if (client) {
            try {
              await client.disconnect();
            } catch {
              // ignore disconnect errors
            }
          }
          client = createClient();
          createdAt = Date.now();

          console.log("[mcp] Token refreshed successfully");
          return true;
        }
      }

      // Refresh failed or no refresh token -- mark token invalid and rotate
      if (currentAuth?.userId) {
        try {
          await prisma.userAtlusToken.update({
            where: { userId: currentAuth.userId },
            data: { isValid: false, revokedAt: new Date() },
          });
        } catch {
          // ignore DB errors during rotation
        }
      }

      // Get next token from pool
      const nextAuth = await getPooledAtlusAuth();
      if (!nextAuth) {
        console.error("[mcp] No more tokens available -- entering fallback mode");
        fallbackMode = true;
        if (client) {
          try {
            await client.disconnect();
          } catch {
            // ignore
          }
        }
        client = null;
        return false;
      }

      // Recreate with next pool token
      currentAuth = {
        token: nextAuth.token,
        refreshToken: nextAuth.refreshToken,
        userId: nextAuth.userId,
        source: nextAuth.source,
      };
      if (client) {
        try {
          await client.disconnect();
        } catch {
          // ignore
        }
      }
      client = createClient();
      createdAt = Date.now();

      console.log(`[mcp] Rotated to next pool token (source: ${nextAuth.source})`);
      return true;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Eager MCP connection on agent boot.
 * NEVER throws -- agent boot must not fail due to MCP.
 */
export async function initMcp(): Promise<void> {
  try {
    if (env.ATLUS_USE_MCP === "false") {
      console.log("[mcp] MCP disabled via ATLUS_USE_MCP=false");
      return;
    }

    // Get initial auth from pool
    const auth = await getPooledAtlusAuth();
    if (!auth) {
      fallbackMode = true;
      console.warn("[mcp] No AtlusAI tokens available -- fallback mode enabled");
      return;
    }

    currentAuth = {
      token: auth.token,
      refreshToken: auth.refreshToken,
      userId: auth.userId,
      source: auth.source,
    };

    // Register for a client_id (needed for future refresh)
    const registration = await registerAtlusClient();
    if (registration) {
      cachedClientId = registration.client_id;
      console.log("[mcp] Client registered for token refresh");
    } else {
      console.warn("[mcp] Client registration failed -- refresh will not be available");
    }

    // Create and health-check the client
    client = createClient();
    createdAt = Date.now();

    // Health check with 5s timeout
    const healthTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Health check timeout")), 5_000),
    );

    try {
      const tools = await Promise.race([client.listTools(), healthTimeout]);
      const toolCount = Object.keys(tools).length;
      fallbackMode = false;
      console.log(`[mcp] Connected -- ${toolCount} tool(s) available`);
    } catch (healthErr) {
      fallbackMode = true;
      console.warn("[mcp] Health check failed -- fallback mode enabled:", healthErr);
      try {
        await client.disconnect();
      } catch {
        // ignore
      }
      client = null;
    }
  } catch (err) {
    fallbackMode = true;
    console.error("[mcp] Init failed -- fallback mode enabled:", err);
    client = null;
  }
}

/**
 * Get the MCP client, recycling if past max lifetime.
 * Returns null if MCP is disabled or in fallback mode.
 */
export async function getMcpClient(): Promise<MCPClient | null> {
  if (env.ATLUS_USE_MCP === "false" || fallbackMode) {
    return null;
  }

  // Check max lifetime -- recycle if expired
  if (client && Date.now() - createdAt > env.ATLUS_MCP_MAX_LIFETIME_MS) {
    console.log("[mcp] Max lifetime exceeded -- recycling client");
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
    client = null;
    cachedExtractionPrompt = null;
  }

  // Lazy-create if no client
  if (!client) {
    const auth = await getPooledAtlusAuth();
    if (!auth) {
      console.warn("[mcp] No tokens available for lazy client creation");
      return null;
    }

    currentAuth = {
      token: auth.token,
      refreshToken: auth.refreshToken,
      userId: auth.userId,
      source: auth.source,
    };

    client = createClient();
    createdAt = Date.now();
  }

  return client;
}

/**
 * Call an MCP tool by name with retry/rotate on auth failure.
 *
 * Tool names are namespaced as `atlus_${toolName}` by the MCP server.
 *
 * @throws Error if MCP is not available or tool call fails after retry
 */
export async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const mcpClient = await getMcpClient();
  if (!mcpClient) {
    throw new Error("MCP not available");
  }

  const namespacedName = `atlus_${toolName}`;

  async function attemptCall(c: MCPClient): Promise<unknown> {
    const tools = await c.listTools();
    const tool = tools[namespacedName];
    if (!tool) {
      throw new Error(`MCP tool not found: ${namespacedName}`);
    }
    if (!tool.execute) {
      throw new Error(`MCP tool has no execute method: ${namespacedName}`);
    }
    return tool.execute(args, {} as never);
  }

  try {
    return await attemptCall(mcpClient);
  } catch (err) {
    if (isAuthError(err)) {
      console.warn("[mcp] Auth failure on tool call -- attempting recovery");
      const recovered = await handleAuthFailure();
      if (recovered && client) {
        // Retry once with new client/token
        return attemptCall(client);
      }
      throw new Error("MCP auth recovery failed");
    }
    throw err;
  }
}

/**
 * Quick synchronous check for MCP availability.
 */
export function isMcpAvailable(): boolean {
  return !fallbackMode && env.ATLUS_USE_MCP !== "false";
}

/**
 * Graceful shutdown -- disconnect MCP client.
 */
export async function shutdownMcp(): Promise<void> {
  if (client) {
    try {
      await client.disconnect();
    } catch (err) {
      console.warn("[mcp] Error during disconnect:", err);
    }
    client = null;
  }
  console.log("[mcp] Disconnected cleanly");
}

/**
 * Get the cached adaptive extraction prompt (used by search adapter in Plan 02).
 * Returns null if no prompt has been cached yet or if client was recycled.
 */
export function getCachedExtractionPrompt(): string | null {
  return cachedExtractionPrompt;
}

/**
 * Set the cached adaptive extraction prompt.
 * Cleared automatically when client is recycled past max lifetime.
 */
export function setCachedExtractionPrompt(prompt: string): void {
  cachedExtractionPrompt = prompt;
}
