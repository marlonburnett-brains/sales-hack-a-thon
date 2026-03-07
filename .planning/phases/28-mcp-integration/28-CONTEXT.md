# Phase 28: MCP Integration - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `@mastra/mcp` MCPClient to the AtlusAI SSE endpoint with pooled auth, replace Drive API keyword search with MCP semantic search in all existing workflows (`searchSlides`, `searchForProposal`, `searchByCapability`), and retain Drive as a degraded fallback behind an env flag. This phase does NOT include Discovery UI (Phase 29) or new search interfaces -- only the backend plumbing swap.

</domain>

<decisions>
## Implementation Decisions

### Token refresh strategy
- AtlusAI uses OAuth 2.0 with PKCE (discovered Phase 27-05). Stored tokens are JSON: `{ access_token, refresh_token }`
- `getPooledAtlusAuth()` already parses this JSON and returns `{ token, refreshToken, source, userId }`
- On 401 (expired access_token): try refresh first using stored refresh_token, then rotate to next pool token if refresh fails
- `refreshAtlusToken()` utility lives in `atlus-auth.ts` (auth concern, not MCP concern) -- called by MCP wrapper on 401
- Refresh hits `https://knowledge-base-api.lumenalta.com/auth/token` (hardcoded, same as atlus-oauth.ts on web side)
- On successful refresh: update the encrypted token in DB with new access_token + same refresh_token
- On refresh failure (revoked/invalid refresh_token): mark token invalid, rotate to next pool token
- The MCPClient fetch callback stays thin -- injects Bearer header, MCP wrapper handles retry/rotate logic

### MCP result shape discovery
- MCP semantic search result schema is unknown at build time
- Discovery + adaptive prompt: on the first real search call, inspect the raw MCP result shape, build a tailored LLM extraction prompt, and cache it
- The cached prompt template lives alongside the MCPClient singleton state -- resets when MCPClient recycles (max lifetime), forcing re-discovery with fresh results
- No test query at startup -- avoid burning an MCP/LLM call during health check. Health check only uses `listTools()`
- The LLM extraction prompt maps whatever raw content comes back into the `SlideSearchResult` interface fields
- Always use LLM for every MCP result (not as fallback) -- consistency over API cost savings
- Batch results in a single LLM call to reduce API overhead

### Fallback indicator UX
- Silent Drive fallback is NOT acceptable -- seller should see when results come from basic search
- Search results include a `source: 'mcp' | 'drive'` field so UI callers can display an indicator
- Both badge + toast: Sonner toast fires once per session on first fallback ("Results may be less relevant -- semantic search unavailable"), inline badge stays on results
- Tone: gentle warning -- factual that search is degraded, not alarming
- Toast frequency: once per session (first degraded search triggers toast, subsequent degraded searches show badge only)
- Badge placement and exact wording: Claude's discretion based on existing UI patterns

### Search result quality
- Add optional `relevanceScore: number` to `SlideSearchResult` -- MCP results get the score, Drive results get undefined
- Multi-pass strategy in `searchForProposal()` -- Claude decides whether to keep 3-pass structure or simplify based on semantic search capabilities

### Connection lifecycle
- Eager connection on agent boot -- MCPClient connects during startup, pairs with startup health probe
- Startup health probe via `listTools()` -- log result, pre-set fallback mode if MCP is down so first search isn't slow
- Lazy recycle on max lifetime -- check connection age before each request, disconnect and recreate with fresh token if expired (no background timer)

### Claude's Discretion
- Total failure handling (both MCP and Drive down): ActionRequired vs error toast vs empty results
- Whether to preserve or simplify multi-pass retrieval strategy with semantic search
- Retry count and backoff strategy for MCP health checks
- ATLUS_USE_MCP kill-switch scope (connection-level vs search-routing-level)
- MCP-05 max lifetime default value (requirement says 1 hour, adjust if needed)
- SIGTERM graceful shutdown implementation details
- Badge placement and exact wording for degraded search indicator
- Client registration: whether MCPClient needs to dynamically register (like web OAuth) or just use tokens directly

</decisions>

<specifics>
## Specific Ideas

- "Use LLM to parse results into the expected model" -- user wants LLM-based extraction for MCP-to-SlideSearchResult mapping rather than fragile regex/JSON parsing
- Always invoke LLM for every MCP result (not as fallback) -- consistency over API cost savings
- "Refresh then rotate" on 401 -- try refresh_token first, only burn through pool tokens when refresh is truly dead
- Discovery + adaptive prompt for unknown MCP result shapes -- inspect first real query results, cache tailored prompt alongside MCPClient singleton
- Both toast + badge for degraded search -- toast fires once per session (gentle warning tone), badge persists on results

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@mastra/mcp` v1.0.2: Already installed in agent package.json -- MCPClient class ready to use
- `getPooledAtlusAuth()` in `atlus-auth.ts`: Returns `{ token, refreshToken, source, userId }` -- token is access_token, refreshToken is for refresh flow
- `parseStoredToken()` in `atlus-auth.ts`: Already parses JSON `{ access_token, refresh_token }` format from DB
- `SlideSearchResult` interface in `atlusai-search.ts`: Stable interface with 5 consumer files -- adapter must preserve this contract
- `detectAtlusAccess()` in `atlus-auth.ts`: Has `TODO(phase-28)` stubs for MCP probe replacement
- AtlusAI OAuth endpoints in `atlus-oauth.ts`: `/auth/token` endpoint already known -- reuse for refresh_token exchange
- Mastra agent lifecycle in `apps/agent/src/mastra/index.ts`: Integration point for MCPClient singleton

### Established Patterns
- Token pool iteration: `findMany({ isValid: true, orderBy: { lastUsedAt: 'desc' } })` with fire-and-forget updates
- Fallback chain: User token -> pool -> env var (established in both Google and AtlusAI auth)
- Search consumers: 5 files import from `atlusai-search.ts` -- interface must not break
- OAuth token storage: JSON payload `{ access_token, refresh_token }` encrypted as single blob

### Integration Points
- `apps/agent/src/lib/mcp-client.ts` (NEW): MCPClient singleton wrapper with lifecycle management
- `apps/agent/src/lib/atlusai-search.ts`: Replace `searchSlides()` internals with MCP call + LLM parsing + Drive fallback
- `apps/agent/src/lib/atlus-auth.ts`: Add `refreshAtlusToken()`, replace `detectAtlusAccess()` TODO stubs with real MCP probes
- `apps/agent/src/lib/atlusai-client.ts`: Known MCP tool schemas (3 tools) -- reference for MCPClient configuration
- `apps/agent/src/mastra/index.ts`: MCPClient singleton registration + SIGTERM handler
- Agent boot sequence: Add eager MCP connection + health probe

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 28-mcp-integration*
*Context gathered: 2026-03-06*
