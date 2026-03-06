# Phase 28: MCP Integration - Research

**Researched:** 2026-03-06
**Domain:** @mastra/mcp MCPClient integration with AtlusAI SSE endpoint, search adapter pattern
**Confidence:** HIGH

## Summary

Phase 28 replaces the Drive API keyword search in `atlusai-search.ts` with MCP semantic search via the `@mastra/mcp` MCPClient (v1.0.2, already installed). The MCPClient class supports HTTP server definitions with a `fetch` callback for dynamic auth injection -- this is the exact mechanism needed for pooled token rotation (MCP-04). The existing `InternalMastraMCPClient` already has built-in session error detection with automatic reconnection via `forceReconnect()`, but the requirements call for a wrapper singleton that adds max-lifetime recycling, health probing via `listTools()`, and SIGTERM graceful shutdown.

The search adapter must map MCP `knowledge_base_search_semantic` tool results to the existing `SlideSearchResult` interface using LLM extraction (user decision: always LLM, never raw parsing). Five consumer files import from `atlusai-search.ts` and must remain unchanged. The Drive API search path must be retained behind `ATLUS_USE_MCP` env flag as a degraded fallback with a `source` field on results for transparency.

**Primary recommendation:** Create an `mcp-client.ts` singleton wrapper around `MCPClient` that manages lifecycle (eager connect, health probe, lazy recycle, SIGTERM shutdown), then modify `atlusai-search.ts` to route through MCP with LLM result parsing and Drive fallback -- keeping the public API surface identical.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Silent Drive fallback is NOT acceptable -- user should see a subtle indicator when results come from basic search
- Search results include a `source: 'mcp' | 'drive'` field (or similar) so UI callers can optionally display an indicator
- Add optional `relevanceScore: number` to `SlideSearchResult` -- MCP results get the score, Drive results get undefined
- Always use LLM to parse MCP results into the `SlideSearchResult` model -- every MCP result goes through LLM extraction for consistent quality (batch results in a single call to reduce API overhead)
- Eager connection on agent boot -- MCPClient connects during startup, pairs with startup health probe
- Startup health probe via `listTools()` -- log result, pre-set fallback mode if MCP is down so first search isn't slow
- Lazy recycle on max lifetime -- check connection age before each request, disconnect and recreate with fresh token if expired (no background timer)

### Claude's Discretion
- Indicator placement for degraded search mode (in results response, banner, or other pattern)
- Total failure handling (ActionRequired vs error toast vs empty results)
- Whether to preserve or simplify multi-pass retrieval strategy with semantic search
- Retry count and backoff strategy for MCP health checks
- ATLUS_USE_MCP kill-switch scope (connection-level vs search-routing-level)
- MCP-05 max lifetime default value (requirement says 1 hour, adjust if needed)
- SIGTERM graceful shutdown implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MCP-01 | MCPClient connects to AtlusAI SSE endpoint with pooled auth | `HttpServerDefinition` type supports `url` + `fetch` callback; `getPooledAtlusAuth()` provides tokens |
| MCP-02 | MCPClient lives ONLY on agent service | All code goes in `apps/agent/src/lib/` -- no web imports |
| MCP-03 | Singleton wrapper with health check via listTools() | `MCPClient.listTools()` returns tool map; singleton pattern with connection state tracking |
| MCP-04 | Auth injection via fetch callback for token rotation | `HttpServerDefinition.fetch` is `FetchLike` -- receives `(url, init)`, can inject `Authorization` header from pool |
| MCP-05 | Max lifetime recycling (configurable, default 1 hour) | `MCPClient.disconnect()` + recreate pattern; lazy check before each request |
| MCP-06 | Graceful shutdown on SIGTERM | `process.on('SIGTERM', ...)` + `mcp.disconnect()` |
| SRCH-01 | searchSlides() uses MCP semantic search | Route through `knowledge_base_search_semantic` tool via MCPClient |
| SRCH-02 | Adapter maps MCP results to SlideSearchResult | LLM extraction batch call; add optional `source` and `relevanceScore` fields |
| SRCH-03 | searchForProposal() multi-pass logic preserved | Inner `searchSlides()` swapped; outer multi-pass structure stays |
| SRCH-04 | searchByCapability() uses MCP semantic search | Delegates to searchSlides() which uses MCP |
| SRCH-05 | Drive API retained as degraded fallback | `ATLUS_USE_MCP=false` routes to existing Drive logic |
| SRCH-06 | MCP search scoped to ATLUS_PROJECT_ID | Pass project ID in tool arguments or as MCP config |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mastra/mcp` | 1.0.2 | MCPClient for SSE/HTTP connections | Already installed; provides `MCPClient` class with HTTP transport, fetch callback, auto-reconnect |
| `@google/genai` | (existing) | LLM for MCP result parsing | Project standard for Vertex AI calls; used in slide-selection.ts and proposal-assembly.ts |
| `@lumenalta/schemas` | (existing) | Zod schemas for LLM structured output | Project pattern: zodToLlmJsonSchema() for response schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@modelcontextprotocol/sdk` | (transitive) | MCP protocol types | Transitive dependency of @mastra/mcp; types for `FetchLike`, `CallToolResult` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @mastra/mcp MCPClient | Raw @modelcontextprotocol/sdk Client | MCPClient adds tool namespacing, auto-reconnect, session error handling -- no reason to go lower |
| LLM result parsing | Regex/JSON parsing | User explicitly chose LLM for consistency; MCP results may have variable formats |

**Installation:**
```bash
# No new packages needed -- @mastra/mcp 1.0.2 already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
├── lib/
│   ├── mcp-client.ts           # NEW: MCPClient singleton wrapper (MCP-01 through MCP-06)
│   ├── atlusai-search.ts       # MODIFIED: MCP search + Drive fallback + LLM parsing
│   ├── atlus-auth.ts           # MODIFIED: detectAtlusAccess() TODO stubs replaced
│   └── atlusai-client.ts       # UNCHANGED: ingestion logic stays
├── mastra/
│   └── index.ts                # MODIFIED: eager MCP boot + SIGTERM handler
└── env.ts                      # MODIFIED: add ATLUS_USE_MCP, ATLUS_PROJECT_ID, ATLUS_MCP_MAX_LIFETIME_MS
```

### Pattern 1: MCPClient Singleton Wrapper
**What:** A module-level singleton that manages MCPClient lifecycle with health checking, lazy recycling, and graceful shutdown.
**When to use:** Any time search code needs MCP access.

```typescript
// Source: @mastra/mcp dist/client/types.d.ts + configuration.d.ts
import { MCPClient } from "@mastra/mcp";
import { getPooledAtlusAuth } from "./atlus-auth";

const ATLUS_SSE_URL = "https://knowledge-base-api.lumenalta.com/sse";

let mcpClient: MCPClient | null = null;
let createdAt: number = 0;
let fallbackMode = false; // set true if MCP unreachable at boot

const MAX_LIFETIME_MS = parseInt(
  process.env.ATLUS_MCP_MAX_LIFETIME_MS || "3600000", // 1 hour default
  10
);

function createMCPClient(): MCPClient {
  return new MCPClient({
    id: "atlus-ai",
    servers: {
      "atlus-ai": {
        url: new URL(ATLUS_SSE_URL),
        fetch: async (url, init) => {
          const auth = await getPooledAtlusAuth();
          if (!auth) throw new Error("No AtlusAI token available");
          return fetch(url, {
            ...init,
            headers: {
              ...init?.headers,
              Authorization: `Bearer ${auth.token}`,
            },
          });
        },
        timeout: 15_000,
      },
    },
    timeout: 15_000,
  });
}

export async function getMCPClient(): Promise<MCPClient | null> {
  if (process.env.ATLUS_USE_MCP === "false") return null;
  if (fallbackMode) return null;

  // Lazy recycle on max lifetime (MCP-05)
  if (mcpClient && Date.now() - createdAt > MAX_LIFETIME_MS) {
    await mcpClient.disconnect().catch(() => {});
    mcpClient = null;
  }

  if (!mcpClient) {
    mcpClient = createMCPClient();
    createdAt = Date.now();
  }

  return mcpClient;
}
```

### Pattern 2: MCP Search with LLM Result Parsing
**What:** Call MCP tool, batch results through LLM for structured parsing into SlideSearchResult.
**When to use:** Every MCP search result must go through LLM.

```typescript
// Established project pattern from proposal-assembly.ts
import { GoogleGenAI } from "@google/genai";
import { zodToLlmJsonSchema } from "@lumenalta/schemas";

// Batch all results in single LLM call to reduce API overhead
const prompt = `Parse these search results into structured slide records...
${JSON.stringify(mcpResults)}`;

const ai = new GoogleGenAI({ vertexai: true, project, location });
const response = await ai.models.generateContent({
  model: "openai/gpt-oss-120b-maas",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToLlmJsonSchema(SlideSearchResultArraySchema),
  },
});
```

### Pattern 3: MCP Tool Invocation via listTools()
**What:** Get tools from MCPClient, then call a specific tool's execute method.
**When to use:** Invoking `knowledge_base_search_semantic`.

```typescript
// MCPClient.listTools() returns Record<string, Tool>
// Tool names are namespaced as "serverName_toolName"
const tools = await mcpClient.listTools();
const searchTool = tools["atlus-ai_knowledge_base_search_semantic"];
if (!searchTool?.execute) throw new Error("Search tool not available");

const result = await searchTool.execute({ query: "cloud migration healthcare" });
// result is the parsed tool output (auto-JSON-parsed by MCPClient)
```

### Pattern 4: Drive Fallback with Source Tagging
**What:** Try MCP first, fall back to Drive, tag results with source.
**When to use:** Every search call.

```typescript
export async function searchSlides(params: SearchParams): Promise<SlideSearchResult[]> {
  // Try MCP first
  const mcp = await getMCPClient();
  if (mcp) {
    try {
      const results = await searchViaMCP(mcp, params);
      return results.map(r => ({ ...r, source: 'mcp' as const }));
    } catch (err) {
      console.warn("[search] MCP failed, falling back to Drive:", err);
    }
  }

  // Drive fallback
  const results = await searchViaDrive(params);
  return results.map(r => ({ ...r, source: 'drive' as const }));
}
```

### Anti-Patterns to Avoid
- **Creating MCPClient per request:** SSE connections are expensive. Always reuse the singleton.
- **Blocking startup on MCP connection:** If MCP is down, agent should still boot. Set `fallbackMode = true` and log warning.
- **Parsing MCP results with regex:** User explicitly chose LLM parsing for consistency. Even if results look JSON-like, route through LLM.
- **Importing MCP in apps/web:** Vercel serverless kills SSE connections. MCP must stay in apps/agent only (MCP-02).
- **Using background timers for recycling:** User chose lazy recycling -- check age before each request, no setInterval.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol transport | Custom SSE client | `@mastra/mcp` MCPClient | Handles Streamable HTTP + SSE fallback, session errors, reconnection |
| Session error recovery | Manual reconnection logic | MCPClient's built-in `isSessionError()` + `forceReconnect()` | Already implemented in @mastra/mcp with proper error detection |
| Tool invocation | Raw HTTP calls to SSE endpoint | `MCPClient.listTools()` + `tool.execute()` | Handles serialization, timeout, error propagation |
| LLM structured output | Manual JSON parsing of LLM response | `zodToLlmJsonSchema()` + `responseMimeType: "application/json"` | Project-established pattern with Zod validation |

**Key insight:** The `@mastra/mcp` MCPClient already handles the hardest parts (transport negotiation, session management, auto-reconnect on session errors). The wrapper only needs to add: lifecycle management (max lifetime), eager boot, health probe, SIGTERM shutdown, and the env flag kill-switch.

## Common Pitfalls

### Pitfall 1: MCPClient connection blocks agent startup
**What goes wrong:** If AtlusAI endpoint is down, `MCPClient.listTools()` or `connect()` blocks for the full timeout period, delaying agent availability.
**Why it happens:** Eager connection at boot without proper timeout/fallback handling.
**How to avoid:** Set `fallbackMode = true` immediately if health probe fails. Use a short timeout (5s) for the startup probe. Don't await MCP connection in the Mastra constructor -- do it in a fire-and-forget startup function.
**Warning signs:** Agent takes >10s to start, `/health` endpoint unresponsive during MCP connection attempts.

### Pitfall 2: Token rotation race condition
**What goes wrong:** Multiple concurrent searches each call `getPooledAtlusAuth()`, get same token, one invalidates it, others fail.
**Why it happens:** The fetch callback runs per-request; pool iteration is not request-isolated.
**How to avoid:** The fetch callback pattern is per-transport-request, not per-search-call. Token failures will trigger `isSessionError()` + `forceReconnect()` which creates a new transport with a fresh fetch. This is safe because each reconnect gets a fresh token from the pool.
**Warning signs:** Rapid cascading 401 errors in logs.

### Pitfall 3: LLM parsing adds latency to every search
**What goes wrong:** Each search call adds 2-5 seconds for LLM extraction on top of MCP search latency.
**Why it happens:** User requirement: always LLM parse, batch in single call.
**How to avoid:** Batch all results from a single search into one LLM call (not per-result). For `searchForProposal()` multi-pass, consider batching all passes' results into a single LLM call at the end rather than per-pass.
**Warning signs:** Search latency >10s regularly.

### Pitfall 4: SlideSearchResult interface changes break consumers
**What goes wrong:** Adding `source` and `relevanceScore` as required fields breaks 5 consumer files.
**Why it happens:** Interface contract violation.
**How to avoid:** Add `source` and `relevanceScore` as **optional** fields. Consumer files don't need to change. The `source` field is for UI callers to optionally display indicators.
**Warning signs:** TypeScript compilation errors in consumer files.

### Pitfall 5: SIGTERM handler not cleaning up MCPClient
**What goes wrong:** Railway sends SIGTERM, agent exits without disconnecting MCPClient, orphaned SSE connection.
**Why it happens:** No SIGTERM handler registered.
**How to avoid:** Register `process.on('SIGTERM', async () => { await mcpClient?.disconnect(); process.exit(0); })` early in startup. MCPClient.disconnect() is safe to call multiple times.
**Warning signs:** AtlusAI server logs showing stale connections.

## Code Examples

### MCPClient HTTP with fetch callback (from @mastra/mcp types)
```typescript
// Source: @mastra/mcp dist/client/types.d.ts HttpServerDefinition
// The fetch callback is called for EVERY HTTP request the transport makes.
// This is the injection point for dynamic auth.
const server: HttpServerDefinition = {
  url: new URL("https://knowledge-base-api.lumenalta.com/sse"),
  fetch: async (url, init) => {
    const auth = await getPooledAtlusAuth();
    if (!auth) throw new Error("No AtlusAI token available");
    return fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${auth.token}`,
      },
    });
  },
};
```

### Health probe via listTools()
```typescript
// Source: @mastra/mcp MCPClient.listTools()
// Returns Record<string, Tool> -- non-empty means server is healthy
try {
  const tools = await mcpClient.listTools();
  const toolNames = Object.keys(tools);
  console.log(`[mcp] Health probe OK: ${toolNames.length} tools available`);
  // Expected: atlus-ai_knowledge_base_search_semantic, atlus-ai_knowledge_base_search_structured, atlus-ai_discover_documents
} catch (err) {
  console.warn("[mcp] Health probe FAILED, entering fallback mode:", err);
  fallbackMode = true;
}
```

### LLM batch result parsing (project pattern)
```typescript
// Source: established pattern from proposal-assembly.ts lines 292-334
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToLlmJsonSchema } from "@lumenalta/schemas";

const SlideSearchResultSchema = z.object({
  slideId: z.string(),
  documentTitle: z.string(),
  textContent: z.string(),
  speakerNotes: z.string(),
  metadata: z.record(z.unknown()),
  presentationId: z.string().optional(),
  slideObjectId: z.string().optional(),
  relevanceScore: z.number().optional(),
});

const BatchResultSchema = z.array(SlideSearchResultSchema);

async function parseMCPResults(rawResults: unknown[], query: string): Promise<SlideSearchResult[]> {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContent({
    model: "openai/gpt-oss-120b-maas",
    contents: [
      "Parse these MCP search results into structured slide records.",
      `Original query: "${query}"`,
      "For each result, extract slideId, documentTitle, textContent, speakerNotes, metadata, presentationId, slideObjectId.",
      "Assign a relevanceScore (0-1) based on how well the result matches the query.",
      "",
      "Raw results:",
      JSON.stringify(rawResults, null, 2),
    ].join("\n"),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToLlmJsonSchema(BatchResultSchema),
    },
  });

  const text = response.text ?? "[]";
  return BatchResultSchema.parse(JSON.parse(text));
}
```

### SIGTERM graceful shutdown
```typescript
// Register in mcp-client.ts module scope
process.on("SIGTERM", async () => {
  console.log("[mcp] SIGTERM received, disconnecting MCPClient...");
  try {
    await mcpClient?.disconnect();
    console.log("[mcp] MCPClient disconnected cleanly");
  } catch (err) {
    console.error("[mcp] Error during MCPClient shutdown:", err);
  }
  // Don't call process.exit() here -- let Mastra's own handler finish
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drive API fullText search | MCP semantic search | Phase 28 | Semantic relevance vs keyword matching |
| Direct SSE with static auth | MCPClient with fetch callback | @mastra/mcp 1.0.2 | Dynamic token rotation per request |
| Raw result parsing | LLM-based extraction | Phase 28 (user decision) | Consistent quality, handles variable MCP output formats |

**Important version notes:**
- `@mastra/mcp` 1.0.2 supports both Streamable HTTP and SSE fallback automatically
- The MCPClient will try Streamable HTTP first, then fall back to SSE -- this is correct for the AtlusAI endpoint which uses `/sse`
- `connectTimeout` defaults to 3000ms for transport protocol detection; `timeout` defaults to 60000ms for operations

## Open Questions

1. **MCP tool input schema for project scoping (SRCH-06)**
   - What we know: The `knowledge_base_search_semantic` tool schema in `atlusai-client.ts` shows only `query` as input. ATLUS_PROJECT_ID env var exists but unclear how it maps to MCP tool arguments.
   - What's unclear: Does the MCP endpoint scope by project based on auth token, URL path, or tool argument?
   - Recommendation: Try passing `project_id` as an additional tool argument first. If that fails, check if the SSE URL can include project scoping (e.g., `/projects/{id}/sse`). Fall back to assuming the auth token implicitly scopes to a project.

2. **MCP result format**
   - What we know: MCP tools return `CallToolResult` with `content` array of text/blob items. The `InternalMastraMCPClient` auto-parses JSON text content.
   - What's unclear: Exact structure of `knowledge_base_search_semantic` results -- fields, relevance scoring, document IDs.
   - Recommendation: The LLM parsing approach handles this well regardless of format. First invocation should log raw results for debugging.

3. **Multi-pass simplification with semantic search**
   - What we know: `searchForProposal()` has 3 passes + 3-tier fallback because keyword search is imprecise. Semantic search may return better results in fewer passes.
   - What's unclear: Whether semantic search quality eliminates the need for multi-pass.
   - Recommendation: Keep multi-pass structure initially (preserve existing behavior). Mark as a follow-up optimization after measuring MCP result quality.

## Sources

### Primary (HIGH confidence)
- `@mastra/mcp` v1.0.2 type definitions -- `dist/client/types.d.ts`, `dist/client/configuration.d.ts`, `dist/client/client.d.ts`
- `@mastra/mcp` v1.0.2 implementation -- `dist/index.js` (tool wrapping, session error handling, reconnect logic)
- Existing codebase: `atlusai-search.ts`, `atlus-auth.ts`, `atlusai-client.ts`, `mastra/index.ts`, `proposal-assembly.ts`, `slide-selection.ts`
- `.claude/settings.local.json` -- whitelisted MCP tool names

### Secondary (MEDIUM confidence)
- `atlusai-client.ts` tool schema documentation (documented during Phase 27 discovery, may be incomplete)

### Tertiary (LOW confidence)
- MCP tool argument schema for project scoping -- not verified against live endpoint

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @mastra/mcp already installed, types verified from source
- Architecture: HIGH - MCPClient API surface fully mapped from type definitions and implementation
- Pitfalls: HIGH - Based on actual code analysis of MCPClient internals and project patterns
- MCP result format: MEDIUM - Tool schemas documented but not verified against live endpoint
- Project scoping: LOW - ATLUS_PROJECT_ID mapping to MCP unclear

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- @mastra/mcp API unlikely to change within minor version)
