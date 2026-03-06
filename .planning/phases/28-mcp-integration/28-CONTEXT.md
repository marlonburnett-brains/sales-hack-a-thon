# Phase 28: MCP Integration - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `@mastra/mcp` MCPClient to the AtlusAI SSE endpoint with pooled auth, replace Drive API keyword search with MCP semantic search in all existing workflows (`searchSlides`, `searchForProposal`, `searchByCapability`), and retain Drive as a degraded fallback behind an env flag. This phase does NOT include Discovery UI (Phase 29) or new search interfaces -- only the backend plumbing swap.

</domain>

<decisions>
## Implementation Decisions

### Failure transparency
- Silent Drive fallback is NOT acceptable -- user should see a subtle indicator when results come from basic search
- Search results include a `source: 'mcp' | 'drive'` field (or similar) so UI callers can optionally display an indicator
- Exact indicator placement and wording is Claude's discretion based on existing patterns
- Total failure (both MCP and Drive down): Claude decides based on existing error handling patterns

### Search result quality
- Add optional `relevanceScore: number` to `SlideSearchResult` -- MCP results get the score, Drive results get undefined
- Always use LLM to parse MCP results into the `SlideSearchResult` model -- every MCP result goes through LLM extraction for consistent quality (batch results in a single call to reduce API overhead)
- Multi-pass strategy in `searchForProposal()` -- Claude decides whether to keep 3-pass structure or simplify based on semantic search capabilities

### Connection lifecycle
- Eager connection on agent boot -- MCPClient connects during startup, pairs with startup health probe
- Startup health probe via `listTools()` -- log result, pre-set fallback mode if MCP is down so first search isn't slow
- Lazy recycle on max lifetime -- check connection age before each request, disconnect and recreate with fresh token if expired (no background timer)
- Retry count on health check failure -- Claude decides based on AtlusAI endpoint reliability
- `ATLUS_USE_MCP` env flag behavior -- Claude decides (full kill-switch vs search routing only)

### Claude's Discretion
- Indicator placement for degraded search mode (in results response, banner, or other pattern)
- Total failure handling (ActionRequired vs error toast vs empty results)
- Whether to preserve or simplify multi-pass retrieval strategy with semantic search
- Retry count and backoff strategy for MCP health checks
- ATLUS_USE_MCP kill-switch scope (connection-level vs search-routing-level)
- MCP-05 max lifetime default value (requirement says 1 hour, adjust if needed)
- SIGTERM graceful shutdown implementation details

</decisions>

<specifics>
## Specific Ideas

- "Use LLM to parse results into the expected model" -- user wants LLM-based extraction for MCP-to-SlideSearchResult mapping rather than fragile regex/JSON parsing
- Always invoke LLM for every MCP result (not as fallback) -- consistency over API cost savings
- Subtle degradation indicator preferred over silent or loud approaches -- seller should know results may be less relevant without being alarmed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@mastra/mcp` v1.0.2: Already installed in agent package.json -- MCPClient class ready to use
- `getPooledAtlusAuth()` in `atlus-auth.ts`: Returns `{ token, source, userId }` -- feed tokens to MCPClient fetch callback
- `SlideSearchResult` interface in `atlusai-search.ts`: Stable interface with 5 consumer files -- adapter must preserve this contract
- `detectAtlusAccess()` in `atlus-auth.ts`: Has `TODO(phase-28)` stubs for MCP probe replacement
- Mastra agent lifecycle in `apps/agent/src/mastra/index.ts`: Integration point for MCPClient singleton

### Established Patterns
- Token pool iteration: `findMany({ isValid: true, orderBy: { lastUsedAt: 'desc' } })` with fire-and-forget updates
- Fallback chain: User token -> pool -> env var (established in both Google and AtlusAI auth)
- Search consumers: 5 files import from `atlusai-search.ts` -- interface must not break

### Integration Points
- `apps/agent/src/lib/atlusai-search.ts`: Replace `searchSlides()` internals with MCP call + LLM parsing + Drive fallback
- `apps/agent/src/lib/atlus-auth.ts`: Replace `detectAtlusAccess()` TODO stubs with real MCP probes
- `apps/agent/src/lib/atlusai-client.ts`: Known MCP tool schemas (3 tools) -- reference for MCPClient configuration
- `apps/agent/src/mastra/index.ts`: MCPClient singleton registration
- Agent boot sequence: Add eager MCP connection + health probe

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 28-mcp-integration*
*Context gathered: 2026-03-06*
