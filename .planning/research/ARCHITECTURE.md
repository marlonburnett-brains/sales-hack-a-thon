# Architecture Research: v1.4 AtlusAI Authentication & Discovery

**Domain:** AtlusAI token pool auth, Mastra MCP client integration, Drive fallback replacement, Action Required extension, Discovery UI
**Researched:** 2026-03-06
**Confidence:** HIGH (based on existing codebase analysis and v1.3 patterns)

---

## Existing Architecture (v1.3 -- What Already Exists)

```
lumenalta-hackathon/
  apps/
    web/                          # Next.js 15 on Vercel
      src/app/(authenticated)/    # Route group: deals, templates, slides, actions
      src/lib/api-client.ts       # ALL web->agent HTTP (Bearer auth)
      src/lib/actions/            # Server Actions proxying to agent
      src/components/             # sidebar.tsx, user-nav.tsx, ui/
    agent/                        # Mastra Hono on Railway (Docker)
      src/mastra/index.ts         # Mastra init + all API routes
      src/mastra/workflows/       # touch-1..4, pre-call, slide-ingest
      src/lib/google-auth.ts      # Dual-mode auth + token pool
      src/lib/token-encryption.ts # AES-256-GCM encrypt/decrypt
      src/lib/atlusai-client.ts   # SSE discovery (401s) + Drive ingestion
      src/lib/atlusai-search.ts   # Drive API fallback search
      prisma/schema.prisma        # PostgreSQL, UserGoogleToken, ActionRequired, etc.
  packages/schemas/               # Shared Zod types + constants
```

**Critical invariants:**
- Web has ZERO direct database access -- all data flows through api-client.ts to agent
- Agent owns database via Prisma
- MCPClient must live on agent (Railway) -- Vercel serverless kills SSE connections
- Token encryption uses shared AES-256-GCM pattern via token-encryption.ts
- ActionRequired items surface in sidebar badge count via /api/actions/count

---

## v1.4 Integration Architecture

```
                          EXISTING                           NEW (v1.4)
                +--------------------------+      +---------------------------+
                |       apps/web           |      |    apps/web additions     |
                |  (Next.js 15 / Vercel)   |      |                           |
                |                          |      |  /discovery (browse+search)|
                |  /deals (existing)       |      |  AtlusAI sidebar nav item  |
                |  /templates (existing)   |      |  New action type icons     |
                |  /slides (existing)      |      |  AtlusAI token setup form  |
                |  /actions (existing)     |      |                            |
                +-----------+--------------+      +------------+--------------+
                            |  Bearer Auth                      |
                            v                                   v
                +--------------------------+      +---------------------------+
                |       apps/agent         |      |   apps/agent additions    |
                |  (Mastra Hono / Railway) |      |                           |
                |                          |      |  atlusai-mcp-client.ts    |
                |  google-auth.ts          |      |  atlusai-auth.ts (pool)   |
                |  token-encryption.ts     |      |  /atlus/search routes     |
                |  atlusai-search.ts       |      |  /atlus/discover routes   |
                |  atlusai-client.ts       |      |  /atlus/token routes      |
                +-----------+--------------+      +------------+--------------+
                            |                                  |
                            v                                  v
                +----------------------------------------------------------+
                |                 Supabase PostgreSQL                       |
                |  UserGoogleToken (existing)  | UserAtlusToken [NEW]      |
                |  ActionRequired  (existing)  | + new actionType values   |
                +----------------------------------------------------------+
                                                               |
                                               +---------------v-----------+
                                               |   AtlusAI MCP Server       |
                                               |   SSE endpoint at          |
                                               |   knowledge-base-api       |
                                               |   .lumenalta.com/sse       |
                                               |                            |
                                               |   Tools:                   |
                                               |   - search_semantic        |
                                               |   - search_structured      |
                                               |   - discover_documents     |
                                               +----------------------------+
```

---

## New Components

| Component | Responsibility | Location |
|-----------|---------------|----------|
| **UserAtlusToken model** | Encrypted AtlusAI credential storage | `schema.prisma` (new model, mirrors UserGoogleToken) |
| **atlusai-auth.ts** | Token pool rotation for AtlusAI, 3-tier access detection | `apps/agent/src/lib/atlusai-auth.ts` |
| **atlusai-mcp-client.ts** | MCPClient singleton wrapper with reconnect + health check | `apps/agent/src/lib/atlusai-mcp-client.ts` |
| **AtlusAI agent routes** | Search, discover, token management API endpoints | `apps/agent/src/mastra/index.ts` (new registerApiRoute blocks) |
| **Discovery page** | Browse + search + selective ingestion UI | `apps/web/src/app/(authenticated)/discovery/` |
| **AtlusAI token setup** | Form for users to provide AtlusAI credentials | `apps/web/src/app/(authenticated)/discovery/` or settings |

## Modified Components

| Component | Change | Why |
|-----------|--------|-----|
| `atlusai-search.ts` | Replace Drive API internals of `searchSlides()` with MCP calls; keep public API | Core v1.4 deliverable |
| `sidebar.tsx` | Add Discovery nav item (line 25-30 navItems array) | Discovery page needs sidebar entry |
| `actions-client.tsx` | Add icon cases for `atlus_account_required`, `atlus_project_required` (line 8-18 switch) | New action types need visual identity |
| `schema.prisma` | Add UserAtlusToken model | Credential storage |
| `packages/schemas` | Add AtlusAI action type constants, shared Zod types | Type safety across apps |
| `api-client.ts` | Add AtlusAI search/discover/token API functions | Web needs typed wrappers for new agent endpoints |

---

## Data Flow

### AtlusAI Token Capture Flow
```
User (web) -> Settings/Discovery page -> "Enter AtlusAI token" form
  -> Server Action -> POST /atlus/token (agent)
  -> Agent: encrypt token via token-encryption.ts
  -> Agent: upsert UserAtlusToken record
  -> Agent: probe MCP connection with token (3-tier detection)
  -> Agent: create ActionRequired if tier 1 or 2 failure
  -> Return access status to web
```

### MCP Search Flow (replacing Drive fallback)
```
Workflow calls searchSlides({ query, industry, touchType })
  -> atlusai-search.ts (same public API)
  -> NEW: getPooledAtlusAuth() from atlusai-auth.ts
  -> NEW: getAtlusAIMCPClient() from atlusai-mcp-client.ts
  -> NEW: client.callTool('knowledge_base_search_semantic', { query })
  -> NEW: adapter maps MCP results -> SlideSearchResult interface
  -> Callers (touch-1..4, pre-call) unchanged
  FALLBACK: if MCP fails -> Drive API search (existing code, behind flag)
```

### Discovery Browse/Search Flow
```
User (web) -> /discovery page
  -> Server Action -> GET /atlus/discover (agent)
  -> Agent: getAtlusAIMCPClient() -> client.callTool('discover_documents')
  -> Return document inventory to web
  -> User sees categorized browse list

User types search query -> Server Action -> POST /atlus/search (agent)
  -> Agent: MCPClient -> knowledge_base_search_semantic
  -> Return ranked results with relevance
  -> User selects items -> POST /atlus/ingest (agent)
  -> Agent: fetches content, runs through SlideEmbedding pipeline
```

---

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| MCPClient lives ONLY on agent (Railway) | Vercel serverless kills SSE connections; Railway is long-running |
| Singleton MCPClient with health check wrapper | Avoids 2-5s SSE handshake per request; disconnect+recreate on failure |
| `fetch` callback for token injection | Fresh token per POST request; SSE connection also gets auth |
| Adapter pattern for MCP -> SlideSearchResult | Preserves existing interface; zero changes to workflow consumers |
| Drive fallback retained behind flag | Rollback path if MCP search quality is worse |
| Separate UserAtlusToken model (not column on UserGoogleToken) | Different auth systems; user may have one without the other |
| Reuse GOOGLE_TOKEN_ENCRYPTION_KEY | Same AES-256-GCM, same security posture; fewer env vars |
| useReducer for Discovery UI state | Multi-mode UI (browse/search/ingest) with shared selection state |

---

## Build Order (Dependency-Driven)

```
1. UserAtlusToken Model + Migration
   |
2. Token Encryption Reuse + Pool Rotation (atlusai-auth.ts)
   |   |
   |   3. 3-Tier Access Detection + ActionRequired Integration
   |
4. MCPClient Singleton Wrapper (atlusai-mcp-client.ts)
   |   requires pooled auth from step 2
   |
5. Replace Drive Fallback (atlusai-search.ts internals)
   |   requires MCPClient from step 4
   |   preserves searchSlides/searchForProposal/searchByCapability API
   |
6. Agent API Routes (/atlus/search, /atlus/discover, /atlus/token)
   |   requires steps 2, 4, 5
   |
7. Discovery UI (sidebar + browse + search + ingest)
      requires step 6 for data fetching
```

**Recommended phase grouping:**
1. **Phase 27: Auth Foundation** -- UserAtlusToken model, migration, pool rotation, access detection, ActionRequired types
2. **Phase 28: MCP Integration** -- MCPClient wrapper, Drive fallback replacement, agent API routes
3. **Phase 29: Discovery UI** -- Sidebar nav, browse page, semantic search, selective ingestion

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Wrong | Do Instead |
|--------------|-----------|------------|
| MCPClient on Vercel (web app) | SSE killed by serverless lifecycle | Agent-side only; web calls agent API |
| Global MCPClient without `id` param | Memory leak on re-creation | Use `id: 'atlus-ai'` parameter |
| requestInit headers only (no eventSourceInit) | SSE fallback gets no auth headers | Use `fetch` callback covering all transports |
| Removing Drive fallback before MCP validated | No rollback path | Feature flag; keep both during v1.4 |
| Unified token pool abstraction | Google OAuth != AtlusAI auth | Keep pools independent, share patterns not code |
| Auto-ingesting all AtlusAI content | Pollutes vector space | Selective ingestion with user curation |

---

*Architecture research for: v1.4 AtlusAI Authentication & Discovery*
*Researched: 2026-03-06*
