# Research Summary: v1.4 AtlusAI Authentication & Discovery

**Synthesized:** 2026-03-06
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Key Findings

### Stack
- **Zero new npm packages needed.** `@mastra/mcp@1.0.2` already in `package.json` (just needs `pnpm install`). All UI via existing shadcn/ui + Radix.
- **One new Prisma model:** `UserAtlusToken` mirroring `UserGoogleToken` pattern. Forward-only migration.
- **One new env var:** `ATLUS_API_TOKEN` (optional fallback). Reuse `GOOGLE_TOKEN_ENCRYPTION_KEY` for encryption.
- **MCPClient SSE auth requires `fetch` callback** covering both Streamable HTTP and SSE transports.

### Features
- **Table stakes (10 features):** Token model, pool rotation, token capture, MCPClient, 3-tier access detection, ActionRequired types, MCP semantic search, Drive fallback replacement, Discovery UI, selective ingestion.
- **Differentiators (6 features):** Structured search filters, pre-ingestion preview, ingestion status tracking, pool health indicator, cross-source unified search.
- **Anti-features to avoid:** Auto-ingest all content, persistent SSE keepalive, token admin UI, AtlusAI write-back, custom MCP tool wrappers, real-time sync.

### Architecture
- **MCPClient lives ONLY on agent (Railway)** -- Vercel serverless kills SSE connections.
- **Singleton with health check wrapper** -- disconnect+recreate on failure, `id` param prevents memory leaks.
- **Adapter pattern** for MCP results -> existing `SlideSearchResult` interface. All workflow consumers unchanged.
- **3 phases recommended:** Auth Foundation (27) -> MCP Integration (28) -> Discovery UI (29).

### Pitfalls (9 critical)
1. SSE in Vercel serverless = silent failures -> MCPClient agent-side only
2. Railway restarts kill SSE without reconnect -> wrapper with health check
3. Two token pools create cascade failures -> independent pools, distinct action types, pre-check both
4. requestInit-only auth misses SSE fallback -> use `fetch` callback
5. Drive replacement breaks multi-pass retrieval -> adapter swap only, keep orchestration
6. New ActionRequired types break switch statements -> shared constants in packages/schemas
7. Discovery UI state spaghetti -> useReducer from start
8. Token rotation creates stale SSE credentials -> `fetch` callback for fresh tokens per POST
9. 3-tier detection false negatives -> re-trigger on resolution

## Open Questions (BLOCKING)

1. **AtlusAI SSE endpoint auth mechanism** -- What header format? Bearer token? API key? OAuth?
   - Impact: BLOCKING for MCPClient configuration
   - Recommendation: First task must be auth discovery

2. **AtlusAI token acquisition flow** -- How do users get tokens? OAuth flow? API key from dashboard?
   - Impact: Determines token capture UX
   - Recommendation: Design flexible (encrypted blob), simple "Enter token" form initially

3. **MCP tool response schemas** -- What fields come back from each tool?
   - Impact: Adapter layer design
   - Recommendation: Discover via `client.listTools()` + sample invocations in Phase 27

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AtlusAI auth mechanism unknown | HIGH | BLOCKING | First phase task: auth discovery |
| MCP search quality < Drive search | MEDIUM | HIGH | Side-by-side comparison; Drive fallback flag |
| SSE connection instability | MEDIUM | MEDIUM | Singleton + health check + reconnect wrapper |
| Token pool exhaustion (no users have AtlusAI) | HIGH early | MEDIUM | Env fallback token; clear onboarding UX |

---
*Research synthesis for: v1.4 AtlusAI Authentication & Discovery*
