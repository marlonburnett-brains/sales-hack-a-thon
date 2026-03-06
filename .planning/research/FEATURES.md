# Feature Research

**Domain:** AtlusAI Authentication & Discovery (MCP-based knowledge base integration with token pool auth, access detection, and discovery UI)
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH (MCP client patterns well-documented via Mastra docs; AtlusAI-specific tool names inferred from project context and MCP KB server patterns)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **UserAtlusToken model with AES-256-GCM encryption** | Follows identical pattern to existing UserGoogleToken; users expect consistent credential handling across all external services | LOW | Copy UserGoogleToken model structure -- same fields (encryptedRefresh, iv, authTag, isValid, lastUsedAt, email). New Prisma model + forward-only migration. Reuse existing `token-encryption.ts` encrypt/decrypt functions. |
| **Token pool rotation for AtlusAI** | Background MCP calls need pooled auth identical to Google token pool. Without this, MCP client fails when a single token expires, breaking all AtlusAI search for everyone. | MEDIUM | Mirror `getPooledGoogleAuth()` from google-auth.ts. Iterate valid UserAtlusToken records ordered by lastUsedAt DESC. Mark invalid on failure, create ActionRequired on exhaustion. Key difference from Google pool: no service account fallback exists for AtlusAI -- pool exhaustion is a hard failure that must surface immediately via ActionRequired. |
| **Token capture on AtlusAI OAuth login** | Users should not manually configure tokens. Login flow should transparently capture and store the refresh token, same as Google OAuth flow in v1.3. | MEDIUM | AtlusAI OAuth callback extracts refresh token, encrypts via AES-256-GCM, upserts UserAtlusToken record. Requires knowing AtlusAI's OAuth endpoint and scopes. If AtlusAI uses API keys instead of OAuth, simplify to encrypted API key storage. |
| **MCPClient wired to AtlusAI SSE endpoint** | The entire v1.4 milestone premise is "direct AtlusAI integration via MCP." Without a working MCP connection, nothing else functions. | HIGH | Use `@mastra/mcp` MCPClient with SSE transport. Configure `url`, `requestInit`, and `eventSourceInit` with auth headers (both required for SSE per Mastra docs). Use custom `fetch` override to inject pooled access token per-request. MCPClient auto-falls back from Streamable HTTP to legacy SSE. Singleton instance with reconnection handling. |
| **3-tier access detection** | Users need clear, actionable feedback when AtlusAI access is missing. Three distinct states require distinct UX: (1) no AtlusAI account, (2) account but no project access, (3) full access. Cryptic MCP errors are unacceptable. | MEDIUM | Probe MCP connection on first use per user. Map error responses: auth failure = no account (tier 1), successful auth but empty/forbidden project list = no project access (tier 2), successful tool call = full access (tier 3). Cache access state per user in a lightweight column or session to avoid repeated probing. |
| **ActionRequired: atlus_account_required + atlus_project_required** | Existing ActionRequired system handles reauth_needed, share_with_sa, drive_access. AtlusAI access issues MUST surface through the same mechanism -- users already check this page and see the sidebar badge. | LOW | Add two new actionType string values. No schema migration needed (actionType is a String, not an enum). Add icon mappings in actions-client.tsx (new Lucide icons for AtlusAI states). Existing badge count, list page, and dismiss flow all work unchanged. |
| **MCP semantic search replacing Drive fallback** | Current atlusai-search.ts uses Drive API fullText search -- keyword-based, low recall, slow (exports each doc individually). Users expect semantic retrieval matching what they experience in AtlusAI directly. This is the core deliverable of v1.4. | HIGH | Call `knowledge_base_search_semantic` tool via MCPClient `listTools()`. Map MCP results to existing `SlideSearchResult` interface. Replace `searchSlides()` internals while preserving its public API signature so all callers (searchForProposal, searchByCapability) work unchanged. Keep Drive fallback as degraded-mode path during rollout. |
| **Discovery UI: sidebar nav entry** | Users need to access AtlusAI content from the main navigation. Adding a nav item is trivial but blocking -- without it, the discovery page is unreachable. | LOW | Add one entry to `navItems` array in sidebar.tsx: `{ href: "/atlusai", label: "AtlusAI", icon: Database }`. Same pattern as existing Deals, Templates, Slide Library, Actions entries. |
| **Discovery UI: browse knowledge bases** | Users need to see what content exists in AtlusAI before deciding what to ingest. A list/browse view of available knowledge bases and documents is the minimum discovery experience. | MEDIUM | Call MCP `discover_documents` or equivalent listing tool. Display as categorized list with document title, type, and metadata. Follow existing page patterns from templates list (table with status badges, action buttons). New route: `/atlusai` with server component + client component split. |
| **Discovery UI: semantic search** | Users expect to search AtlusAI content by meaning, not keywords. This IS the value proposition of v1.4 -- "direct AtlusAI integration" means semantic search available in our UI. | MEDIUM | Search input with debounced query (300ms). Call `knowledge_base_search_semantic` via MCP. Display ranked results with relevance indicators. Reuse search UI patterns from Slide Library page (color-coded results, similarity scores). Search and browse should be on the same page with tab or toggle. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Selective content ingestion** | Users cherry-pick which AtlusAI documents to ingest into the SlideEmbedding pipeline rather than bulk-importing everything. Prevents noise in vector space, keeps retrieval quality high. | HIGH | Multi-select checkboxes on discovery results. "Ingest Selected" button triggers existing SlideEmbedding pipeline (Vertex AI embedding + Gemini 8-axis classification). Requires a content adapter to transform MCP document shape into the `{contentText, speakerNotes, templateId, slideIndex}` format expected by the ingestion pipeline. Need a synthetic templateId for AtlusAI-sourced content vs Google Slides-sourced content. |
| **Structured search (knowledge_base_search_structured)** | Filter by metadata axes (industry, pillar, persona, stage) rather than free-text only. Power users narrow results precisely, reducing noise in large knowledge bases. | MEDIUM | Expose MCP `knowledge_base_search_structured` tool if available. Build filter dropdowns matching existing classification axes from `packages/schemas` constants. Combine with semantic search for hybrid retrieval (structured filters + semantic ranking). |
| **Pre-ingestion preview** | Before committing to ingestion (which costs Vertex AI API calls), users preview document content from AtlusAI in-app. Reduces wasted ingestion cycles and API spend. | LOW | Fetch document content via MCP resource read or tool call. Render in a slide-over panel or modal. Reuse existing slide viewer patterns from template preview (keyboard navigation, content display). No new API integration needed beyond MCP read. |
| **Ingestion status tracking per AtlusAI document** | Show which AtlusAI documents have already been ingested, which are pending, which failed. Prevents duplicate ingestion and wasted API costs. | MEDIUM | Track AtlusAI document IDs via a new field on SlideEmbedding or a lightweight junction table mapping AtlusAI doc IDs to SlideEmbedding records. Display status badges (ingested/not ingested/failed) inline on discovery UI results. Content hash comparison for dedup. |
| **Pool health indicator** | Show remaining valid AtlusAI tokens and pool health in discovery page header. Surfaces auth problems before they cause search failures. | LOW | Query `UserAtlusToken.count({ where: { isValid: true } })`. Display as status chip: green (3+ valid), yellow (1-2 valid), red (0 valid). Already have the pattern from Google pool console warnings -- just promoting to UI. |
| **Cross-source unified search** | Search both AtlusAI (via MCP) and local SlideEmbedding (via pgvector) simultaneously, deduplicating and ranking results. Eliminates "where should I search?" friction. | HIGH | Run MCP semantic search and pgvector cosine similarity in parallel. Merge and deduplicate by content hash. Rank by normalized relevance score. Complex due to different score scales between MCP results and pgvector distances. Defer unless both sources are individually stable. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Auto-ingest all AtlusAI content** | "Just import everything" feels efficient and thorough | Floods vector space with irrelevant content, degrades retrieval quality for Touch 1-4 deck assembly, wastes Vertex AI embedding API costs ($0.01-0.02 per document), makes Gemini classification noise worse, pollutes the curated SlideEmbedding corpus | Selective ingestion with preview. Let users curate what enters the pipeline. Quality over quantity. |
| **Persistent SSE connection keepalive** | SSE feels like it should be always-on for real-time updates | SSE connections are expensive to maintain server-side, AtlusAI may rate-limit persistent connections, reconnection logic adds error-handling complexity for zero user-visible benefit since searches are user-initiated | Connect-on-demand pattern. MCPClient handles reconnection automatically per the Mastra docs. Instantiate on first search, disconnect after idle timeout. |
| **Token management admin UI** | "Let admins see and manage all AtlusAI tokens" | Only ~20 users at Lumenalta. Admin UI is significant frontend work (table, revoke buttons, health charts) for a problem that ActionRequired notifications already solve. Token rotation happens automatically via OAuth refresh events. | ActionRequired notifications for expired tokens + automatic token capture on login. Console warnings for pool health. Same proven approach from v1.3 Google token pool. |
| **AtlusAI write-back (push corrections to AtlusAI)** | "Sync our tag corrections back to AtlusAI source" | Write access requires different auth scopes, introduces data integrity risks if AtlusAI has its own curation workflow, MCP write tools may not exist, and bidirectional sync creates reconciliation nightmares | Keep corrections local in SlideEmbedding metadata. Local corrections improve local retrieval quality. AtlusAI remains the source of truth for raw content. |
| **Custom MCP tool definitions** | "Build our own MCP tools wrapping AtlusAI" | Unnecessary abstraction. AtlusAI already exposes the tools we need via its MCP server. Custom wrappers mean maintaining compatibility with AtlusAI's evolving tool schema on both sides of the wrapper. | Use AtlusAI's MCP tools directly via `MCPClient.listTools()`. The Mastra MCPClient namespaces tools automatically (e.g., `atlusai_knowledge_base_search_semantic`). |
| **Real-time AtlusAI content sync** | "Show AtlusAI changes as they happen" | Requires MCP resource subscriptions, WebSocket infrastructure for pushing updates to the web UI, and cache invalidation logic. AtlusAI content changes infrequently (new decks added weekly, not continuously). | Refresh on page load. Add a manual "Refresh" button. Content changes are low-frequency enough that polling on navigation is sufficient. |

## Feature Dependencies

```
[UserAtlusToken Model]
    └──requires──> [AES-256-GCM Encryption] (already exists: token-encryption.ts)

[Token Capture on Login]
    └──requires──> [UserAtlusToken Model]
    └──requires──> [AtlusAI OAuth endpoint knowledge] (need to confirm OAuth vs API key)

[Token Pool Rotation]
    └──requires──> [UserAtlusToken Model]
    └──requires──> [Token Capture on Login] (pool needs tokens to rotate)

[MCP Client Connection]
    └──requires──> [Token Pool Rotation] (needs valid access token for auth headers)
    └──requires──> [@mastra/mcp package] (already in apps/agent/package.json)

[3-Tier Access Detection]
    └──requires──> [MCP Client Connection] (probes connection to determine state)
    └──outputs-to──> [ActionRequired Integration] (creates records for tiers 1 and 2)

[ActionRequired Integration]
    └──requires──> [ActionRequired Model] (already exists, just new actionType values)
    └──no-migration──> (actionType is String, not enum -- just add new values in code)

[MCP Semantic Search]
    └──requires──> [MCP Client Connection]

[Replace Drive Fallback]
    └──requires──> [MCP Semantic Search] (new implementation)
    └──preserves──> [searchSlides() public API] (callers unchanged)
    └──preserves──> [searchForProposal() public API] (callers unchanged)
    └──preserves──> [searchByCapability() public API] (callers unchanged)
    └──degrades-to──> [Drive fallback] (keep as backup during rollout)

[Discovery UI: Nav Entry]
    └──requires──> [sidebar.tsx navItems array] (add one entry)

[Discovery UI: Browse]
    └──requires──> [MCP Client Connection] (list/discover tools)
    └──requires──> [Discovery UI: Nav Entry] (reachable from sidebar)

[Discovery UI: Search]
    └──requires──> [MCP Semantic Search]
    └──enhances──> [Discovery UI: Browse] (same page, search tab)

[Selective Ingestion]
    └──requires──> [Discovery UI: Browse or Search] (user selects from results)
    └──requires──> [SlideEmbedding Pipeline] (already exists: Vertex AI + Gemini)
    └──requires──> [Content Adapter] (MCP document shape -> SlideEmbedding input)

[Structured Search]
    └──enhances──> [Discovery UI: Search] (adds filter dropdowns)
    └──requires──> [MCP Client Connection]

[Pre-Ingestion Preview]
    └──enhances──> [Selective Ingestion] (preview before committing)
    └──requires──> [MCP Client Connection]
```

### Dependency Notes

- **Token Pool requires UserAtlusToken populated:** Cannot rotate tokens without stored credentials. At least one user must have logged in and stored a token before any MCP call works. This means the very first v1.4 user experience requires onboarding flow awareness.
- **MCP Client requires Token Pool:** Every MCP request needs an auth header. The pooled auth function provides the access token dynamically via MCPClient's custom `fetch` override. The token is injected per-request, not at connection time, because tokens rotate.
- **Replace Drive Fallback requires MCP Semantic Search verified:** Cannot remove the Drive fallback until MCP search returns equivalent or better results. Keep Drive code in place as degradation path during rollout. Feature-flag the switch if possible.
- **Selective Ingestion requires Content Adapter:** AtlusAI MCP documents have a different shape than Google Slides content currently processed by the SlideEmbedding pipeline. Need a transformer mapping MCP document content to `{contentText, speakerNotes, slideObjectId, templateId}`. The `templateId` field needs a synthetic value strategy for AtlusAI-sourced content (e.g., `atlus-{knowledgeBaseId}`).
- **3-Tier Access Detection creates ActionRequired records:** Detection at MCP connection time produces `atlus_account_required` or `atlus_project_required` records. These surface in the existing Actions page and sidebar badge -- no new UI needed for notification delivery.
- **ActionRequired needs no migration:** The `actionType` field is a plain `String`, not a Prisma enum. New action type values are purely code-level additions (icon mapping, description text). Zero schema changes.

## MVP Definition

### Launch With (v1.4 Core)

Minimum viable milestone -- what is needed to replace Drive fallback and enable AtlusAI discovery.

- [x] **UserAtlusToken model + migration** -- credential storage foundation (extends existing encryption infra)
- [x] **Token capture on AtlusAI login** -- populate the token pool transparently during user login
- [x] **Token pool rotation** -- reliable auth for background and on-demand MCP calls
- [x] **MCPClient wired to AtlusAI SSE** -- core integration point, singleton with reconnection
- [x] **3-tier access detection** -- know immediately if user can access AtlusAI, surface via ActionRequired
- [x] **ActionRequired: atlus_account_required + atlus_project_required** -- surface access issues through existing notification system
- [x] **MCP semantic search** -- call knowledge_base_search_semantic, map results to SlideSearchResult
- [x] **Replace atlusai-search.ts Drive fallback** -- swap searchSlides() implementation, preserve public API, keep Drive as degraded fallback
- [x] **Discovery UI: sidebar nav + browse + search** -- users can explore AtlusAI content from the app
- [x] **Selective ingestion** -- users pick documents to ingest into SlideEmbedding pipeline

### Add After Validation (v1.4.x)

Features to add once core MCP integration is working and users are actively searching.

- [ ] **Structured search filters** -- add after confirming which structured search tools AtlusAI's MCP server actually exposes
- [ ] **Pre-ingestion preview** -- add after ingestion flow is stable and users want to preview before committing
- [ ] **Ingestion status tracking** -- add after users have ingested enough AtlusAI content to need duplicate detection
- [ ] **Pool health indicator in UI** -- add after pool is populated with multiple user tokens

### Future Consideration (v2+)

Features to defer until the integration is mature and user patterns are established.

- [ ] **Cross-source unified search** -- complex relevance ranking across MCP + pgvector, defer until both sources are individually reliable
- [ ] **AtlusAI write-back** -- requires AtlusAI API support for writes, different auth scopes, bidirectional sync
- [ ] **Token management admin UI** -- unnecessary at ~20 users, ActionRequired handles the need
- [ ] **Real-time content sync via MCP subscriptions** -- overkill for weekly content change frequency

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| UserAtlusToken model | HIGH | LOW | P1 |
| Token capture on login | HIGH | MEDIUM | P1 |
| Token pool rotation | HIGH | MEDIUM | P1 |
| MCPClient SSE connection | HIGH | HIGH | P1 |
| 3-tier access detection | HIGH | MEDIUM | P1 |
| ActionRequired new types | MEDIUM | LOW | P1 |
| MCP semantic search | HIGH | HIGH | P1 |
| Replace Drive fallback | HIGH | MEDIUM | P1 |
| Discovery UI (nav + browse + search) | HIGH | MEDIUM | P1 |
| Selective ingestion | HIGH | HIGH | P1 |
| Structured search filters | MEDIUM | MEDIUM | P2 |
| Pre-ingestion preview | MEDIUM | LOW | P2 |
| Ingestion status tracking | MEDIUM | MEDIUM | P2 |
| Pool health indicator | LOW | LOW | P3 |
| Cross-source search | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.4 milestone completion
- P2: Should have, add within v1.4 if time permits
- P3: Nice to have, defer to future milestone

## Existing Infrastructure Reuse

Critical for v1.4 -- these assets already exist and should be leveraged, not rebuilt.

| Existing Asset | Reuse For | Location |
|----------------|-----------|----------|
| UserGoogleToken model pattern | Clone for UserAtlusToken | `schema.prisma` line 252-267 |
| `getPooledGoogleAuth()` | Pattern for `getPooledAtlusAuth()` | `google-auth.ts` line 92-174 |
| `token-encryption.ts` | Shared AES-256-GCM encrypt/decrypt (no changes needed) | `apps/agent/src/lib/token-encryption.ts` |
| ActionRequired model | Add new action types (no schema change) | `schema.prisma` line 274-290 |
| ActionRequired UI + icons | Add icon cases for new types | `actions-client.tsx` line 8-19 |
| Sidebar navItems array | Add one entry for AtlusAI | `sidebar.tsx` line 25-30 |
| Sidebar badge count | Already works for any ActionRequired type | `sidebar.tsx` line 37-43 |
| SlideEmbedding pipeline | Target for selective ingestion | Vertex AI embedding + Gemini classification |
| Slide Library search UI | Pattern for discovery search results | `apps/web/src/app/(authenticated)/slides/` |
| Template preview viewer | Pattern for pre-ingestion preview | Keyboard nav + thumbnail strip + content display |
| `@mastra/mcp` package | Already in package.json, ready to use | `apps/agent/package.json` |
| `atlusai-search.ts` public API | Preserve SlideSearchResult, ProposalSearchResult interfaces | `apps/agent/src/lib/atlusai-search.ts` |
| searchForProposal multi-pass logic | Keep pass structure, swap inner search implementation | `atlusai-search.ts` line 299-384 |

## Competitor Feature Analysis

| Feature | AtlusAI Direct (browser UI) | Current Drive Fallback (v1.3) | v1.4 MCP Integration (target) |
|---------|----------------------------|-------------------------------|-------------------------------|
| Search quality | Semantic (native vector index) | Keyword-only (Drive fullText contains) | Semantic (MCP knowledge_base_search_semantic) |
| Search speed | Fast (native index) | Slow (Drive API list + per-doc export) | Fast (single MCP tool call, results in response) |
| Browse content | Full web UI with categories | None (no browsing capability) | Discovery page with categorized browse |
| Filter by metadata | Full filter axes | None (query string concatenation only) | Structured search via MCP (if tool available) |
| Access control | Per-user AtlusAI credentials | Service account only (single point of failure) | Per-user token pool with rotation |
| Content ingestion | N/A (content lives in AtlusAI) | Manual via template registration | Selective from discovery results |
| Fallback behavior | None (requires AtlusAI access) | Always works (Drive always accessible) | Degrades to Drive fallback if MCP unavailable |
| Integration depth | Standalone (no deck assembly) | Embedded in deck assembly pipeline | Embedded + standalone discovery |

## Sources

- [Mastra MCPClient Reference](https://mastra.ai/reference/tools/mcp-client) -- SSE transport config, auth headers, tool listing, resource operations (HIGH confidence)
- [Mastra MCP Overview](https://mastra.ai/docs/mcp/overview) -- Transport auto-detection, Streamable HTTP to SSE fallback behavior (HIGH confidence)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) -- Client-server protocol patterns, tool and resource primitives (HIGH confidence)
- [Knowledge Base MCP Server reference implementation](https://github.com/jeanibarz/knowledge-base-mcp-server) -- KB search tool patterns, semantic + structured search (MEDIUM confidence)
- [Document360 KB Search Patterns](https://document360.com/blog/knowledge-base-search/) -- Search UI patterns, indexing approaches (MEDIUM confidence)
- [Cobbai AI Knowledge Base Navigation](https://cobbai.com/blog/ai-for-intuitive-knowledge-base-navigation) -- Browse + search UX patterns (MEDIUM confidence)
- Existing codebase: `atlusai-search.ts`, `google-auth.ts`, `schema.prisma`, `sidebar.tsx`, `actions-client.tsx` (HIGH confidence, read directly)

---
*Feature research for: v1.4 AtlusAI Authentication & Discovery*
*Researched: 2026-03-06*
