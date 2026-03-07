# Phase 28: MCP Integration - Research

**Researched:** 2026-03-06
**Domain:** @mastra/mcp client lifecycle, AtlusAI SSE/MCP integration, OAuth token pool rotation, LLM-based result mapping
**Confidence:** HIGH

## Summary

Phase 28 replaces Drive API keyword search with AtlusAI MCP semantic search in all existing workflows. The `@mastra/mcp` v1.0.2 package is already installed and provides `MCPClient` with built-in HTTP/SSE transport, custom `fetch` callback for dynamic auth injection, session error auto-reconnection, and `disconnect()` for graceful shutdown. The MCPClient connects to `https://knowledge-base-api.lumenalta.com/sse` using pooled OAuth 2.0 Bearer tokens.

The search adapter must map MCP `knowledge_base_search_semantic` tool results to the existing `SlideSearchResult` interface using LLM extraction (user decision: always LLM, never raw parsing). Five consumer files import from `atlusai-search.ts` and must remain unchanged. The Drive API search path must be retained behind `ATLUS_USE_MCP` env flag as a degraded fallback with a `source` field on results for transparency.

The key engineering challenge is the singleton MCPClient wrapper: it must manage eager connection on boot, health checks via `listTools()`, lazy recycling on max lifetime, OAuth token refresh on 401, pool rotation on refresh failure, and graceful SIGTERM shutdown. The `fetch` callback in `@mastra/mcp` is the correct injection point for per-request token rotation -- it receives every HTTP request the transport makes.

**Primary recommendation:** Use `MCPClient` from `@mastra/mcp` with a custom `fetch` callback for token injection, wrap it in a singleton module (`mcp-client.ts`) that manages lifecycle, and swap `searchSlides()` internals to call MCP tools programmatically via the tool objects returned by `listTools()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- AtlusAI uses OAuth 2.0 with PKCE. Stored tokens are JSON: `{ access_token, refresh_token }`
- `getPooledAtlusAuth()` already parses this JSON and returns `{ token, refreshToken, source, userId }`
- On 401 (expired access_token): try refresh first using stored refresh_token, then rotate to next pool token if refresh fails
- `refreshAtlusToken()` utility lives in `atlus-auth.ts` (auth concern, not MCP concern) -- called by MCP wrapper on 401
- Refresh hits `https://knowledge-base-api.lumenalta.com/auth/token` (hardcoded, same as atlus-oauth.ts on web side)
- On successful refresh: update the encrypted token in DB with new access_token + same refresh_token
- On refresh failure (revoked/invalid refresh_token): mark token invalid, rotate to next pool token
- The MCPClient fetch callback stays thin -- injects Bearer header, MCP wrapper handles retry/rotate logic
- MCP semantic search result schema is unknown at build time
- Discovery + adaptive prompt: on the first real search call, inspect the raw MCP result shape, build a tailored LLM extraction prompt, and cache it
- The cached prompt template lives alongside the MCPClient singleton state -- resets when MCPClient recycles
- No test query at startup -- health check only uses `listTools()`
- Always use LLM for every MCP result (not as fallback) -- consistency over API cost savings
- Batch results in a single LLM call to reduce API overhead
- Search results include a `source: 'mcp' | 'drive'` field
- Both badge + toast: Sonner toast fires once per session on first fallback
- Add optional `relevanceScore: number` to `SlideSearchResult`
- Eager connection on agent boot, lazy recycle on max lifetime
- Startup health probe via `listTools()` -- pre-set fallback mode if MCP is down

### Claude's Discretion
- Total failure handling (both MCP and Drive down): ActionRequired vs error toast vs empty results
- Whether to preserve or simplify multi-pass retrieval strategy with semantic search
- Retry count and backoff strategy for MCP health checks
- ATLUS_USE_MCP kill-switch scope (connection-level vs search-routing-level)
- MCP-05 max lifetime default value (requirement says 1 hour, adjust if needed)
- SIGTERM graceful shutdown implementation details
- Badge placement and exact wording for degraded search indicator
- Client registration: whether MCPClient needs to dynamically register (like web OAuth) or just use tokens directly

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | MCPClient connects to AtlusAI SSE endpoint with pooled auth | MCPClient `HttpServerDefinition` with `url: new URL('https://knowledge-base-api.lumenalta.com/sse')` and `fetch` callback for Bearer token injection |
| MCP-02 | MCPClient lives ONLY on agent service | Singleton module at `apps/agent/src/lib/mcp-client.ts`, no imports from `apps/web` |
| MCP-03 | Singleton MCPClient with health check: listTools() probe, disconnect+recreate on failure | `MCPClient.listTools()` returns tool map; on error, call `disconnect()` then recreate instance |
| MCP-04 | Auth injection via fetch callback for fresh token per request | `HttpServerDefinition.fetch` field accepts `FetchLike` -- inject Bearer header from `getPooledAtlusAuth()` |
| MCP-05 | Max lifetime with forced recycle | Track `createdAt` timestamp, check age before each request, disconnect+recreate if expired |
| MCP-06 | Graceful shutdown on SIGTERM | `process.on('SIGTERM', () => mcpClient.disconnect())` -- MCPClient has built-in `disconnect()` |
| SRCH-01 | searchSlides() uses MCP knowledge_base_search_semantic | Get tool via `listTools()`, call tool's `execute()` with `{ query }`, pipe results through LLM extraction |
| SRCH-02 | Adapter maps MCP results to SlideSearchResult | LLM extraction prompt maps raw MCP content to `{ slideId, documentTitle, textContent, speakerNotes, metadata }` |
| SRCH-03 | searchForProposal() multi-pass logic preserved | Only inner `searchSlides()` changes; multi-pass orchestration in `searchForProposal()` stays identical |
| SRCH-04 | searchByCapability() uses MCP semantic search | Calls `searchSlides()` internally -- already uses correct delegation pattern |
| SRCH-05 | Drive API retained as degraded fallback behind ATLUS_USE_MCP flag | Rename current `searchSlides` to `searchSlidesDrive`, new `searchSlides` checks flag and routes |
| SRCH-06 | MCP search scoped to ATLUS_PROJECT_ID | Pass project ID as parameter to MCP tool if supported, or validate in wrapper |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mastra/mcp` | 1.0.2 | MCP client with SSE/HTTP transport | Already installed in agent package.json; provides MCPClient with fetch callback, auto-reconnect, disconnect |
| `@google/genai` | ^1.43.0 | LLM calls for result extraction | Already used project-wide for Vertex AI structured output |
| `@mastra/core` | ^1.8.0 | Base classes, Tool type | MCPClient extends MastraBase; tool objects use Tool<> type |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@modelcontextprotocol/sdk` | (transitive) | MCP protocol types (CallToolResultSchema) | Transitively via @mastra/mcp, types only |
| `zod` | ^4.3.6 | Schema validation for LLM output | Already used for all structured output validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@mastra/mcp` MCPClient | Raw `@modelcontextprotocol/sdk` Client | More control but must manage transport, reconnect, tool wrapping manually -- unnecessary since @mastra/mcp already handles all this |
| LLM extraction | Direct JSON parsing of MCP results | Fragile -- MCP result schema unknown at build time, LLM handles schema drift gracefully |

**Installation:** No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/lib/
  mcp-client.ts          # NEW: MCPClient singleton wrapper with lifecycle
  atlusai-search.ts      # MODIFIED: searchSlides() routes MCP vs Drive
  atlus-auth.ts          # MODIFIED: add refreshAtlusToken()
```

### Pattern 1: MCPClient Singleton with Lifecycle Management
**What:** A module-level singleton that wraps `MCPClient`, tracking connection state, creation time, and current auth context. Exposes `getClient()`, `healthCheck()`, `callTool()`, and `shutdown()`.
**When to use:** Always -- MCP-01 through MCP-06 all depend on this singleton.
**Example:**
```typescript
// Source: @mastra/mcp dist/client/types.d.ts (HttpServerDefinition)
import { MCPClient } from "@mastra/mcp";
import { getPooledAtlusAuth } from "./atlus-auth";

const ATLUS_SSE_URL = new URL("https://knowledge-base-api.lumenalta.com/sse");
const MAX_LIFETIME_MS = 60 * 60 * 1000; // 1 hour default

let client: MCPClient | null = null;
let createdAt: number = 0;
let currentAuth: { token: string; userId?: string } | null = null;
let fallbackMode = false;

function createClient(): MCPClient {
  return new MCPClient({
    id: "atlus-mcp",
    servers: {
      atlus: {
        url: ATLUS_SSE_URL,
        timeout: 30_000,
        fetch: async (url, init) => {
          // Thin fetch callback -- just injects Bearer header
          const auth = currentAuth;
          if (!auth) throw new Error("No AtlusAI auth available");
          return fetch(url, {
            ...init,
            headers: {
              ...init?.headers,
              Authorization: `Bearer ${auth.token}`,
            },
          });
        },
      },
    },
    timeout: 30_000,
  });
}

export async function getMcpClient(): Promise<MCPClient | null> {
  if (process.env.ATLUS_USE_MCP === "false") return null;

  // Lazy recycle on max lifetime
  if (client && Date.now() - createdAt > MAX_LIFETIME_MS) {
    await client.disconnect();
    client = null;
  }

  if (!client) {
    const auth = await getPooledAtlusAuth();
    if (!auth) return null;
    currentAuth = { token: auth.token, userId: auth.userId };
    client = createClient();
    createdAt = Date.now();
  }

  return client;
}
```

### Pattern 2: MCP Tool Invocation (Programmatic, Not Via Agent)
**What:** Get tool objects from `listTools()`, invoke them directly via their `execute()` method. This is NOT the agent-based pattern (where tools are passed to an Agent) -- this is direct programmatic invocation.
**When to use:** For `searchSlides()` to call `knowledge_base_search_semantic`.
**Example:**
```typescript
// Source: @mastra/mcp dist/index.js lines 940-1012 (tool wrapping implementation)
const tools = await client.listTools();
const searchTool = tools["atlus_knowledge_base_search_semantic"];
if (!searchTool) throw new Error("MCP search tool not available");

// execute() calls client.callTool() internally with auto-reconnect on session errors
const result = await searchTool.execute({ query: "healthcare solutions" });
// result is the raw MCP CallToolResult -- either structuredContent or content array
```

### Pattern 3: LLM-Based Result Extraction with Adaptive Prompt
**What:** Use LLM to map unknown MCP result shapes to `SlideSearchResult[]`. On first call, inspect raw result structure, build a tailored extraction prompt, and cache it. Reset cache when MCPClient recycles.
**When to use:** Every MCP search result mapping (user decision: always LLM, never raw parsing).
**Example:**
```typescript
// Source: Existing pattern from slide-selection.ts lines 255-262
import { GoogleGenAI } from "@google/genai";
import { env } from "../env";

let cachedExtractionPrompt: string | null = null;

async function extractSlideResults(
  rawResults: unknown,
  query: string
): Promise<SlideSearchResult[]> {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  // Build extraction prompt (with adaptive discovery on first call)
  const prompt = cachedExtractionPrompt
    ? `${cachedExtractionPrompt}\n\nQuery: ${query}\n\nRaw results:\n${JSON.stringify(rawResults, null, 2)}`
    : buildDiscoveryPrompt(rawResults, query);

  const response = await ai.models.generateContent({
    model: "openai/gpt-oss-120b-maas",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const parsed = JSON.parse(response.text ?? "[]");
  // Cache the prompt template after first successful extraction
  if (!cachedExtractionPrompt) {
    cachedExtractionPrompt = buildCachedPromptTemplate(rawResults);
  }
  return parsed;
}
```

### Pattern 4: OAuth Token Refresh Flow
**What:** On 401 from MCP endpoint, try refresh_token exchange first, then rotate to next pool token if refresh fails.
**When to use:** In the MCP wrapper's retry logic (not in the thin fetch callback).
**Example:**
```typescript
// Source: Existing pattern from atlus-oauth.ts (web side) -- adapted for agent side
const ATLUS_TOKEN_URL = "https://knowledge-base-api.lumenalta.com/auth/token";

export async function refreshAtlusToken(
  refreshToken: string,
  clientId: string,
): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const res = await fetch(ATLUS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
```

### Pattern 5: Search Routing with Fallback
**What:** `searchSlides()` checks `ATLUS_USE_MCP` flag and MCPClient availability, routes to MCP or Drive, adds `source` field to results.
**When to use:** The main switchover point for SRCH-01 through SRCH-05.
**Example:**
```typescript
export async function searchSlides(params: {
  query: string;
  industry?: string;
  touchType?: string;
  limit?: number;
}): Promise<SlideSearchResult[]> {
  const useMcp = process.env.ATLUS_USE_MCP !== "false";

  if (useMcp) {
    try {
      const results = await searchSlidesMcp(params);
      return results.map(r => ({ ...r, source: "mcp" as const }));
    } catch (err) {
      console.warn("[search] MCP search failed, falling back to Drive:", err);
      // Fall through to Drive
    }
  }

  const results = await searchSlidesDrive(params);
  return results.map(r => ({ ...r, source: "drive" as const }));
}
```

### Anti-Patterns to Avoid
- **Creating MCPClient per request:** MCPClient manages SSE/HTTP transport with session state. Creating per request wastes connections and loses session continuity. Use singleton.
- **Putting MCP imports in apps/web:** Vercel serverless kills long-lived SSE connections. MCPClient MUST live only on the Railway-hosted agent service.
- **Parsing MCP results with regex/JSON.parse:** MCP result schema is unknown and may change. LLM extraction is the user-mandated approach for resilience.
- **Using listTools() as a search health check:** `listTools()` is for startup probing only. During search, just try the tool call and handle failure -- avoids wasting an MCP round-trip.
- **Blocking on token refresh in the fetch callback:** The fetch callback should be thin (inject header only). Token refresh/rotation logic belongs in the wrapper's retry layer, not in the per-request fetch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE/HTTP transport management | Custom EventSource client | `@mastra/mcp` MCPClient | Handles SSE-to-StreamableHTTP upgrade, session management, auto-reconnect on session errors |
| MCP protocol serialization | Custom JSON-RPC over SSE | `@mastra/mcp` MCPClient (wraps `@modelcontextprotocol/sdk`) | Protocol has many edge cases (initialization, capability negotiation, progress tokens) |
| Tool invocation with auto-retry | Custom callTool + reconnect | MCPClient's `tools()` method wraps each tool with session error detection + `forceReconnect()` | Already implemented in @mastra/mcp dist/index.js lines 983-1001 |
| OAuth PKCE flow | Custom crypto + state management | Existing `atlus-oauth.ts` patterns | Already implemented with `generatePKCE()`, `exchangeCodeForTokens()` |
| Token encryption | Custom AES | Existing `token-encryption.ts` | Already battle-tested with AES-256-GCM |

**Key insight:** The `@mastra/mcp` MCPClient already handles the hardest parts (transport negotiation, session management, auto-reconnect). The custom work is the wrapper that manages lifecycle (max lifetime, token rotation) and the LLM extraction layer.

## Common Pitfalls

### Pitfall 1: SSE Connection Drops Without Detection
**What goes wrong:** SSE connections can silently die (network change, server restart, Railway deploy) without the client knowing. Next tool call hangs or fails.
**Why it happens:** SSE is a long-lived HTTP connection; intermediaries (load balancers, proxies) can kill it without sending a close frame.
**How to avoid:** Use `listTools()` as a health probe before first use and on reconnect. MCPClient's built-in `isSessionError()` detection + `forceReconnect()` handles mid-operation failures. The max lifetime recycle (MCP-05) provides an upper bound on stale connections.
**Warning signs:** Increasing tool call timeouts, "Not connected" errors in logs.

### Pitfall 2: Token Refresh Race Condition
**What goes wrong:** Multiple concurrent searches try to refresh the same expired token simultaneously, leading to duplicate DB writes or conflicting token states.
**Why it happens:** `searchSlides()` is called from multi-pass retrieval (`searchForProposal()`) which fires multiple searches sequentially but could overlap.
**How to avoid:** Serialize token refresh behind a mutex/promise cache: if a refresh is in-flight, subsequent callers await the same promise. Store the refresh promise alongside the singleton state.
**Warning signs:** "Token already revoked" errors after a successful refresh, multiple `lastUsedAt` updates in rapid succession.

### Pitfall 3: MCP Tool Name Namespacing
**What goes wrong:** `MCPClient.listTools()` returns tools namespaced as `serverName_toolName` (e.g., `atlus_knowledge_base_search_semantic`), not the raw tool name.
**Why it happens:** MCPClient namespaces to prevent conflicts when managing multiple servers.
**How to avoid:** Use the namespaced name `atlus_knowledge_base_search_semantic` when looking up tools from `listTools()`, not the raw `knowledge_base_search_semantic`.
**Warning signs:** "Tool not found" errors when using raw tool names.

### Pitfall 4: Eager Boot Blocking Agent Startup
**What goes wrong:** If MCP connection is slow or fails during agent boot, it blocks all workflows from starting.
**Why it happens:** Eager connection (user decision) means the boot sequence awaits MCP connection.
**How to avoid:** Set a short `connectTimeout` (5s), catch connection failures, pre-set `fallbackMode = true` so first search immediately falls back to Drive. Log clearly. Don't throw -- let agent boot succeed.
**Warning signs:** Agent startup taking > 10 seconds, "connection timeout" in boot logs.

### Pitfall 5: Client Registration for Token Refresh
**What goes wrong:** The OAuth token refresh requires a `client_id`, but the agent side doesn't have the dynamically registered client ID from the web OAuth flow.
**Why it happens:** The web side uses `registerAtlusClient()` to get a dynamic `client_id` per OAuth flow, stored only in cookies. The agent doesn't have this.
**How to avoid:** Two options: (a) store the `client_id` alongside the token in the DB (requires schema change), or (b) register a new client on the agent side for refresh-only use. Option (b) is simpler -- register once at agent boot, cache the `client_id`.
**Warning signs:** Refresh requests returning "invalid_client" errors.

### Pitfall 6: LLM Extraction Cost Amplification
**What goes wrong:** Multi-pass retrieval in `searchForProposal()` calls `searchSlides()` 4-6 times, each triggering an LLM extraction call. This can cost 4-6x the LLM API budget per proposal.
**Why it happens:** Each `searchSlides()` call independently extracts results via LLM.
**How to avoid:** Accept this cost (user decision: always LLM). Mitigate by batching all results in a single LLM call per `searchSlides()` invocation. Consider reducing multi-pass redundancy if semantic search returns more relevant results than Drive keyword search.
**Warning signs:** High Vertex AI API costs, slow proposal generation.

## Code Examples

### MCPClient Initialization with Custom Fetch
```typescript
// Source: @mastra/mcp dist/client/types.d.ts (HttpServerDefinition.fetch)
import { MCPClient } from "@mastra/mcp";

const client = new MCPClient({
  id: "atlus-mcp",
  servers: {
    atlus: {
      url: new URL("https://knowledge-base-api.lumenalta.com/sse"),
      timeout: 30_000,
      connectTimeout: 5_000,
      fetch: async (url, init) => {
        const token = await getCurrentToken();
        return fetch(url, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: `Bearer ${token}`,
          },
        });
      },
    },
  },
  timeout: 30_000,
});
```

### Health Check via listTools()
```typescript
// Source: @mastra/mcp dist/client/configuration.d.ts (MCPClient.listTools)
async function healthCheck(client: MCPClient): Promise<boolean> {
  try {
    const tools = await client.listTools();
    const toolNames = Object.keys(tools);
    console.log(`[mcp] Health check OK: ${toolNames.length} tools available`);
    return toolNames.length > 0;
  } catch (err) {
    console.error("[mcp] Health check failed:", err);
    return false;
  }
}
```

### Programmatic Tool Invocation
```typescript
// Source: @mastra/mcp dist/index.js lines 940-982 (tool wrapping + execute)
const tools = await client.listTools();
const searchTool = tools["atlus_knowledge_base_search_semantic"];

// The tool's execute() method calls client.callTool() internally
// and handles session error detection + auto-reconnect
const rawResult = await searchTool.execute({
  query: "healthcare digital transformation case studies",
});

// rawResult is CallToolResult: { content: [{type: 'text', text: '...'}], isError?: boolean }
// or structuredContent if the server supports it
```

### Graceful Shutdown
```typescript
// Source: @mastra/mcp dist/client/configuration.d.ts (MCPClient.disconnect)
let shutdownInProgress = false;

process.on("SIGTERM", async () => {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  console.log("[mcp] SIGTERM received, disconnecting...");
  if (client) {
    await client.disconnect();
    console.log("[mcp] Disconnected cleanly");
  }
  process.exit(0);
});
```

### SlideSearchResult Interface Extension
```typescript
// Source: apps/agent/src/lib/atlusai-search.ts (existing interface)
export interface SlideSearchResult {
  slideId: string;
  documentTitle: string;
  textContent: string;
  speakerNotes: string;
  metadata: Record<string, unknown>;
  presentationId?: string;
  slideObjectId?: string;
  // NEW fields (Phase 28)
  source?: "mcp" | "drive";
  relevanceScore?: number;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drive API fullText search | MCP semantic search via AtlusAI | Phase 28 | Much higher relevance for natural language queries; semantic understanding vs keyword matching |
| Direct API calls for search | MCP protocol with tool abstraction | Phase 28 | Standardized tool interface, server-managed search implementation |
| Static auth headers | Dynamic fetch callback with token pool rotation | Phase 28 | Handles token expiry gracefully, auto-rotates through pool |

**Deprecated/outdated:**
- Drive API fullText search: Retained only as degraded fallback behind `ATLUS_USE_MCP=false`
- `discoverAtlusAITools()` in `atlusai-client.ts`: Was a static documentation function; replaced by actual `listTools()` calls via MCPClient

## Open Questions

1. **Client ID for token refresh on agent side**
   - What we know: Web side dynamically registers a client per OAuth flow. Agent needs a `client_id` to refresh tokens.
   - What's unclear: Whether the agent can use a pre-registered static client ID, or must dynamically register like the web side.
   - Recommendation: Try registering once at agent boot and caching the `client_id`. If AtlusAI requires per-redirect-URI registration, store the `client_id` alongside the token (small schema addition).

2. **MCP tool input schema for project scoping**
   - What we know: The known tool `knowledge_base_search_semantic` has `{ query: string }` as input schema (from `atlusai-client.ts` discovery). SRCH-06 requires project scoping via `ATLUS_PROJECT_ID`.
   - What's unclear: Whether the MCP tool accepts a `project_id` parameter, or if project scoping is handled server-side based on the auth token's project associations.
   - Recommendation: Discover actual tool schema via `listTools()` at runtime. If no `project_id` param exists, project scoping is implicit (server-side based on token). Document finding.

3. **MCP result shape**
   - What we know: Result is `CallToolResult` with `content: [{type: 'text', text: '...'}]` or `structuredContent`. Actual document structure unknown.
   - What's unclear: Exact fields, nesting, whether results include relevance scores.
   - Recommendation: User decision already covers this -- discovery + adaptive prompt on first real call. Log raw result shape on first search for debugging.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | apps/agent/vitest.config.ts (if exists) or default |
| Quick run command | `cd apps/agent && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-01 | MCPClient connects to SSE endpoint | integration (manual-only) | N/A -- requires live AtlusAI endpoint | N/A |
| MCP-02 | No MCP imports in apps/web | smoke | `grep -r "@mastra/mcp" apps/web/` should return empty | Wave 0 |
| MCP-03 | Health check via listTools(), reconnect on failure | unit (mock) | `npx vitest run src/lib/__tests__/mcp-client.test.ts` | Wave 0 |
| MCP-04 | Fetch callback injects Bearer token | unit (mock) | `npx vitest run src/lib/__tests__/mcp-client.test.ts` | Wave 0 |
| MCP-05 | Max lifetime recycle | unit | `npx vitest run src/lib/__tests__/mcp-client.test.ts` | Wave 0 |
| MCP-06 | SIGTERM graceful shutdown | unit (mock) | `npx vitest run src/lib/__tests__/mcp-client.test.ts` | Wave 0 |
| SRCH-01 | searchSlides uses MCP semantic search | unit (mock) | `npx vitest run src/lib/__tests__/atlusai-search.test.ts` | Wave 0 |
| SRCH-02 | MCP results mapped to SlideSearchResult | unit | `npx vitest run src/lib/__tests__/atlusai-search.test.ts` | Wave 0 |
| SRCH-05 | Drive fallback behind ATLUS_USE_MCP flag | unit | `npx vitest run src/lib/__tests__/atlusai-search.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run --reporter=verbose`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green + manual integration test against live endpoint

### Wave 0 Gaps
- [ ] `apps/agent/src/lib/__tests__/mcp-client.test.ts` -- covers MCP-03, MCP-04, MCP-05, MCP-06
- [ ] `apps/agent/src/lib/__tests__/atlusai-search.test.ts` -- covers SRCH-01, SRCH-02, SRCH-05
- [ ] Vitest config verification (may need to create if not present)

## Sources

### Primary (HIGH confidence)
- `@mastra/mcp` v1.0.2 installed package -- `dist/client/types.d.ts`, `dist/client/client.d.ts`, `dist/client/configuration.d.ts` (MCPClient API, HttpServerDefinition with fetch callback, connect/disconnect/listTools/tools methods)
- `@mastra/mcp` v1.0.2 implementation -- `dist/index.js` lines 940-1012 (tool wrapping with session error auto-reconnect, callTool invocation)
- Existing codebase: `apps/agent/src/lib/atlusai-search.ts` (SlideSearchResult interface, searchSlides/searchForProposal/searchByCapability implementations, 5 consumer files)
- Existing codebase: `apps/agent/src/lib/atlus-auth.ts` (getPooledAtlusAuth, parseStoredToken, detectAtlusAccess, upsertActionRequired)
- Existing codebase: `apps/web/src/lib/atlus-oauth.ts` (OAuth endpoints, PKCE flow, token exchange, client registration)
- Existing codebase: `apps/agent/src/lib/slide-selection.ts` (LLM invocation pattern via GoogleGenAI + Vertex AI)

### Secondary (MEDIUM confidence)
- `@mastra/mcp` dist/client/types.d.ts comments and JSDoc (fetch callback usage pattern, connectTimeout behavior)

### Tertiary (LOW confidence)
- MCP tool input schema for `knowledge_base_search_semantic` -- based on `atlusai-client.ts` static discovery, not verified via live `listTools()` call. Actual schema may differ.
- AtlusAI token refresh endpoint behavior -- inferred from web-side `exchangeCodeForTokens()` pattern, not tested with `grant_type=refresh_token`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed, API surface verified from dist type declarations
- Architecture: HIGH - Patterns derived from actual @mastra/mcp implementation code and existing project patterns
- Pitfalls: MEDIUM - Some pitfalls (client registration, result shape) require runtime validation
- Token refresh: MEDIUM - Inferred from web OAuth flow, not tested against agent-side refresh

**Research date:** 2026-03-06
**Valid until:** 2026-03-20 (14 days -- @mastra/mcp is pinned at 1.0.2, AtlusAI API stable)
