# Phase 29: Discovery UI - Research

**Researched:** 2026-03-06
**Domain:** Next.js UI (React Server Components + Client Components), MCP tool integration, infinite scroll pagination, batch ingestion
**Confidence:** HIGH

## Summary

Phase 29 builds a new `/discovery` route that lets users browse and search AtlusAI content via MCP tools (`discover_documents` and `knowledge_base_search_semantic`), then selectively ingest items into the local SlideEmbedding pipeline. The architecture follows established project patterns: server component page with client component for interactivity, server actions for web-to-agent communication, and polling for progress updates.

The key complexity is the unified browse/search UX with infinite scroll, batch selection with floating toolbar, per-item ingestion progress tracking, and "already ingested" detection. All MCP calls MUST go through the agent service (Railway) per MCP-02 -- the web app calls server actions that hit agent API endpoints which invoke `callMcpTool()`. Access gating reuses the existing AtlusAI token pool and ActionRequired patterns from Phase 27.

**Primary recommendation:** Follow the established server-component-page + client-component pattern. Add 3 new agent API endpoints (browse, search, ingest-discovery), 3 new server actions, and a single `DiscoveryClient` component that manages browse/search/selection/ingestion state.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- "AtlusAI" sidebar nav item with brain icon, placed after Slide Library and before Action Required
- Route at `/discovery` under the authenticated layout
- Unified layout: single page with search bar at top. When empty, shows browse inventory. When typing, switches to semantic search results
- Browse results support toggle between card grid and list/table views (user can switch modes)
- Infinite scroll pagination for browse view (auto-loads next page on scroll)
- Search bar triggers MCP `knowledge_base_search_semantic` only -- no client-side title filtering of browse results
- Debounced input (300ms per DISC-04 requirement)
- Rich preview panel: clicking a search result opens a side panel with full content preview before deciding to ingest
- Relevance scores shown as visual indicator (color-coded bar or percentage badge) -- consistent with existing Slide Library similarity search
- Empty state with suggestions: "No results for [query]. Try broader terms like..." with 2-3 alternative search suggestions based on common content categories
- Batch selection with floating toolbar: checkboxes on each item, toolbar appears when 1+ selected showing "Ingest N selected" button
- Per-item status indication during ingestion: pending -> ingesting -> done/error (matches existing template ingestion polling pattern)
- Floating toolbar shows overall batch progress
- Already-ingested content: green "Ingested" badge + disabled/checked checkbox. Prevents re-selection
- Error resilience: failed items show error badge with tooltip, other items continue ingesting. User can retry failed items individually. No batch abort
- Server-side access check on page load (no flash of content)
- Inline empty state when access missing: full-page centered message with icon, specific issue description (no account vs no project), and CTA button to connect. Matches existing empty state patterns (Slide Library)
- Pool-based access: if token pool has valid tokens, show content even if current user hasn't personally connected (DISC-06 requirement)
- Auto-refresh after OAuth connect: when user returns from AtlusAI OAuth redirect to /discovery, page detects new credentials and loads content automatically

### Claude's Discretion
- Exact card grid layout and responsive breakpoints
- List view column design and density
- Side panel width and animation for rich preview
- Infinite scroll threshold and loading skeleton design
- Search suggestion categories for empty state
- Floating toolbar positioning and animation
- How to detect ingested status (content hash comparison vs tracking table)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DISC-01 | New "AtlusAI" sidebar nav item in `sidebar.tsx` with appropriate icon | Add entry to `navItems` array in sidebar.tsx with `Brain` icon from lucide-react, placed between Slide Library and Action Required |
| DISC-02 | New `/discovery` route with browse and search views | Server component at `apps/web/src/app/(authenticated)/discovery/page.tsx` + `DiscoveryClient` client component. Unified layout -- search bar determines mode |
| DISC-03 | Browse view: paginated document inventory from MCP `discover_documents` tool | New agent endpoint `GET /discovery/browse` calling `callMcpTool("discover_documents", ...)`. Cursor-based pagination for infinite scroll |
| DISC-04 | Search view: semantic search bar powered by MCP `knowledge_base_search_semantic` with debounced input (300ms) | New agent endpoint `POST /discovery/search` calling `callMcpTool("knowledge_base_search_semantic", ...)`. 300ms debounce via `useRef`+`setTimeout` pattern |
| DISC-05 | Search results show content previews with relevance scoring | LLM extraction (existing `extractSlideResults` pattern from atlusai-search.ts) maps MCP results to typed interface with relevanceScore. Color-coded percentage badge per existing Slide Library pattern |
| DISC-06 | Access gating: if user (or no user in pool) lacks AtlusAI access, page shows appropriate Action Required state | Server component checks pool access via agent endpoint. Shows centered empty state with icon + message + CTA (reuse actions-client.tsx pattern) |
| DISC-07 | Selective ingestion: users can select content from browse/search results and ingest into the local SlideEmbedding pipeline | New agent endpoint `POST /discovery/ingest` accepts array of document IDs. Each item goes through existing ingest pipeline. Batch selection UI with floating toolbar |
| DISC-08 | Ingestion progress shown per item (polling pattern matching existing template ingestion) | Polling via `setInterval` matching existing `getIngestionProgress` pattern. Per-item status: pending/ingesting/done/error |
| DISC-09 | Already-ingested content marked in browse/search results to prevent duplicate ingestion | Agent endpoint returns ingested status by comparing contentHash or documentTitle against existing SlideEmbedding records. Green "Ingested" badge + disabled checkbox |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (existing) | App router, server/client components | Project standard |
| React | 19.x (existing) | UI rendering | Project standard |
| lucide-react | existing | Icons (Brain icon for sidebar) | Already used throughout project |
| Tailwind CSS | existing | Styling | Project standard |
| sonner | existing | Toast notifications | Already used in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-intersection-observer` | latest | IntersectionObserver hook for infinite scroll | Detecting when user scrolls near bottom to load next page |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-intersection-observer | Raw IntersectionObserver | Library provides cleaner React hook, but adds dependency. Raw API is ~15 lines and avoids new dep -- **prefer raw IntersectionObserver** given this is the only use |
| Separate browse/search tabs | Unified single-page layout | User locked decision: unified layout with search bar determining mode |

**Installation:**
```bash
# No new packages needed -- all capabilities covered by existing stack
# IntersectionObserver is a browser API, no library needed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/app/(authenticated)/discovery/
  page.tsx                    # Server component: access check + initial browse data
  discovery-client.tsx        # Main client component: manages all UI state

apps/web/src/lib/actions/
  discovery-actions.ts        # Server actions: browse, search, ingest, check-access

apps/web/src/lib/
  api-client.ts               # Add: discoverBrowse, discoverSearch, discoverIngest, checkAtlusAccess

apps/agent/src/mastra/
  index.ts                    # Add routes: GET /discovery/browse, POST /discovery/search, POST /discovery/ingest, GET /discovery/access-check
```

### Pattern 1: Server Component Page with Access Gating
**What:** Server component checks AtlusAI access on the server side, then renders either the content UI or the empty state -- no flash of unauthorized content.
**When to use:** Page load for `/discovery`
**Example:**
```typescript
// apps/web/src/app/(authenticated)/discovery/page.tsx
import { checkAtlusAccessAction } from "@/lib/actions/discovery-actions";
import { DiscoveryClient } from "./discovery-client";

export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  const accessResult = await checkAtlusAccessAction();

  if (!accessResult.hasAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        {/* Icon + message + CTA matching existing empty state pattern */}
      </div>
    );
  }

  // Load initial browse page on server
  const initialBrowse = await browsDocumentsAction({ cursor: null, limit: 20 });
  return <DiscoveryClient initialDocuments={initialBrowse} />;
}
```

### Pattern 2: Unified Browse/Search Mode
**What:** Single page where the search bar controls which view is active. Empty search = browse inventory. Non-empty search = semantic search results.
**When to use:** Core UX pattern for the discovery page
**Example:**
```typescript
// Inside DiscoveryClient
const [searchQuery, setSearchQuery] = useState("");
const [mode, setMode] = useState<"browse" | "search">("browse");

// Debounce search input
const debounceRef = useRef<NodeJS.Timeout>(null);
function handleSearchChange(value: string) {
  setSearchQuery(value);
  if (debounceRef.current) clearTimeout(debounceRef.current);
  if (value.trim() === "") {
    setMode("browse");
    return;
  }
  debounceRef.current = setTimeout(() => {
    setMode("search");
    executeSearch(value);
  }, 300);
}
```

### Pattern 3: Infinite Scroll with IntersectionObserver
**What:** Load next page of browse results when a sentinel element enters the viewport
**When to use:** Browse view pagination
**Example:**
```typescript
const sentinelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!sentinelRef.current || mode !== "browse") return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && hasMore && !isLoadingMore) {
        loadNextPage();
      }
    },
    { rootMargin: "200px" }
  );
  observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, [hasMore, isLoadingMore, mode]);

// Sentinel at bottom of results
<div ref={sentinelRef} className="h-1" />
```

### Pattern 4: Batch Selection with Floating Toolbar
**What:** Checkboxes on items, floating toolbar appears when 1+ items selected showing count + ingest button
**When to use:** Selective ingestion flow
**Example:**
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

// Floating toolbar
{selectedIds.size > 0 && (
  <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-6 py-3 shadow-lg">
    <span className="text-sm font-medium text-slate-700">
      {selectedIds.size} selected
    </span>
    <Button onClick={handleBatchIngest} className="ml-4">
      Ingest {selectedIds.size} selected
    </Button>
  </div>
)}
```

### Pattern 5: Per-Item Ingestion Progress (Polling)
**What:** Track each ingesting item's status via polling, matching existing template ingestion pattern
**When to use:** After user clicks "Ingest N selected"
**Example:**
```typescript
type ItemStatus = "idle" | "pending" | "ingesting" | "done" | "error";
const [itemStatuses, setItemStatuses] = useState<Map<string, ItemStatus>>(new Map());

async function handleBatchIngest() {
  const ids = Array.from(selectedIds);
  // Mark all as pending
  setItemStatuses(prev => {
    const next = new Map(prev);
    ids.forEach(id => next.set(id, "pending"));
    return next;
  });

  // Start ingestion on agent
  const { batchId } = await startDiscoveryIngestionAction(ids);

  // Poll for progress
  const interval = setInterval(async () => {
    const progress = await getDiscoveryIngestionProgressAction(batchId);
    setItemStatuses(new Map(progress.items.map(i => [i.id, i.status])));
    if (progress.complete) clearInterval(interval);
  }, 2000);
}
```

### Anti-Patterns to Avoid
- **Importing MCP in web app:** MCP client lives ONLY on the agent (MCP-02). All MCP calls must go through agent API endpoints via server actions.
- **Client-side filtering of browse results:** User locked decision -- search bar triggers MCP semantic search, NOT client-side title filtering.
- **Separate tabs for browse/search:** User locked decision -- unified layout where search bar presence determines mode.
- **Pagination buttons for browse:** User locked decision -- infinite scroll, not paginated navigation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce logic | Custom debounce hook | `useRef` + `setTimeout` inline pattern | Simple enough for one use; no need for a hook library |
| Infinite scroll detection | Manual scroll position math | `IntersectionObserver` with sentinel div | Browser API is efficient, handles edge cases, cross-browser |
| Toast notifications | Custom toast component | `sonner` (already in project) | Already installed and used throughout |
| Content preview side panel | Custom slide-over animation | CSS `translate-x` transition with `fixed` positioning | Tailwind transitions are sufficient; no animation library needed |
| "Already ingested" check | Client-side dedup logic | Agent-side DB query matching contentHash or documentTitle | Source of truth is in the database; client cannot reliably check |

**Key insight:** All data operations (browse, search, ingest, ingestion-status-check) must route through the agent service. The web app is purely a presentation layer that calls server actions.

## Common Pitfalls

### Pitfall 1: MCP Tool Response Shape Unknown
**What goes wrong:** `discover_documents` MCP tool response format is not documented. The code in `atlusai-client.ts` lists it as a known tool but has never called it programmatically.
**Why it happens:** Phase 28 only integrated `knowledge_base_search_semantic`. The `discover_documents` tool has no usage examples in the codebase.
**How to avoid:** Use the same LLM extraction pattern from `atlusai-search.ts` to adaptively map raw MCP results to a typed interface. First call discovers the shape, subsequent calls use a cached prompt.
**Warning signs:** Empty results or parse errors on the first browse API call.

### Pitfall 2: Infinite Scroll Race Conditions
**What goes wrong:** Multiple page loads fire simultaneously when scroll events trigger faster than API responses.
**Why it happens:** IntersectionObserver fires repeatedly while sentinel is visible and previous request hasn't completed.
**How to avoid:** Use `isLoadingMore` boolean guard in the observer callback. Set it to true before fetch, false after.
**Warning signs:** Duplicate items appearing in the browse list.

### Pitfall 3: Stale Closure in Debounce
**What goes wrong:** Debounced search function captures stale state from an old render.
**Why it happens:** setTimeout callback closes over the search function reference from a previous render cycle.
**How to avoid:** Use `useCallback` with proper deps, or call the action directly in the setTimeout with the current value from the input.
**Warning signs:** Search results don't match the current query text.

### Pitfall 4: Flash of Unauthorized Content
**What goes wrong:** Discovery page briefly shows the browse UI before access check completes.
**Why it happens:** Access check is async; if done client-side, there's a flash.
**How to avoid:** Do access check in the server component (page.tsx) before rendering the client component. Already locked as a decision.
**Warning signs:** Brief glimpse of content before empty state appears.

### Pitfall 5: Ingestion Status Desync
**What goes wrong:** Items show "done" but ingestion actually failed, or vice versa.
**Why it happens:** Polling interval doesn't align with actual processing time; race between ingestion completion and next poll.
**How to avoid:** Agent endpoint returns definitive status per item. Client stops polling only when all items are terminal (done/error).
**Warning signs:** Items stuck in "ingesting" state indefinitely.

### Pitfall 6: "Already Ingested" Detection False Negatives
**What goes wrong:** Items that were ingested don't show as "Ingested" because the comparison logic doesn't match.
**Why it happens:** MCP document IDs may not directly correspond to SlideEmbedding records. The link between AtlusAI documents and local embeddings is through content or title, not a shared ID.
**How to avoid:** Store the MCP document identifier (or a hash) in a new field or lookup table when ingesting from discovery. Query this on browse/search to mark ingested items.
**Warning signs:** Items can be re-ingested without warning, creating duplicates.

## Code Examples

### Agent Endpoint: Browse Documents
```typescript
// In apps/agent/src/mastra/index.ts
registerApiRoute("/discovery/browse", {
  method: "GET",
  handler: async (c) => {
    const cursor = c.req.query("cursor") || undefined;
    const limit = parseInt(c.req.query("limit") || "20", 10);

    try {
      const raw = await callMcpTool("discover_documents", {
        project_id: env.ATLUS_PROJECT_ID,
        ...(cursor ? { cursor } : {}),
        limit,
      });

      // Return raw result -- client-side or LLM extraction handles mapping
      return c.json({ documents: raw, cursor: /* extract next cursor */ });
    } catch (err) {
      if (!isMcpAvailable()) {
        return c.json({ error: "AtlusAI not available", documents: [] }, 503);
      }
      throw err;
    }
  },
});
```

### Agent Endpoint: Access Check
```typescript
registerApiRoute("/discovery/access-check", {
  method: "GET",
  handler: async (c) => {
    // Check if MCP is available (implies valid pool token)
    const available = isMcpAvailable();
    if (!available) {
      // Determine specific reason
      const poolResult = await getPooledAtlusAuth();
      if (!poolResult) {
        return c.json({ hasAccess: false, reason: "no_tokens" });
      }
      return c.json({ hasAccess: false, reason: "mcp_unavailable" });
    }
    return c.json({ hasAccess: true });
  },
});
```

### Server Action Pattern
```typescript
// apps/web/src/lib/actions/discovery-actions.ts
"use server";

import { fetchJSON } from "@/lib/api-client";

export async function checkAtlusAccessAction(): Promise<{ hasAccess: boolean; reason?: string }> {
  return fetchJSON("/discovery/access-check");
}

export async function browseDocumentsAction(params: {
  cursor: string | null;
  limit: number;
}): Promise<BrowseResult> {
  const qs = new URLSearchParams({ limit: String(params.limit) });
  if (params.cursor) qs.set("cursor", params.cursor);
  return fetchJSON(`/discovery/browse?${qs}`);
}

export async function searchDocumentsAction(query: string): Promise<SearchResult> {
  return fetchJSON("/discovery/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}
```

### Sidebar Nav Item Addition
```typescript
// In sidebar.tsx navItems array (between Layers/Slide Library and AlertTriangle/Action Required)
import { Brain } from "lucide-react";

const navItems = [
  { href: "/deals", label: "Deals", icon: Briefcase },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/slides", label: "Slide Library", icon: Layers },
  { href: "/discovery", label: "AtlusAI", icon: Brain },          // NEW
  { href: "/actions", label: "Action Required", icon: AlertTriangle },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drive API keyword search | MCP semantic search (Phase 28) | 2026-03-06 | Discovery UI uses MCP tools exclusively for browse/search |
| No discovery page | Phase 29 adds /discovery | Now | Users can browse and selectively ingest AtlusAI content |

**Deprecated/outdated:**
- Drive API search is retained as fallback behind `ATLUS_USE_MCP` flag but discovery UI ONLY uses MCP tools (no Drive fallback for browse/search views)

## Design Decisions for Claude's Discretion

### Card Grid Layout
**Recommendation:** 4-column grid on large screens (matches existing Slide Library), 3 on medium, 2 on small, 1 on mobile. Use `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4` (same as slide-library-client.tsx).

### List View Column Design
**Recommendation:** Compact table layout with columns: Title, Content Preview (truncated), Source/Category, Ingested Status, Checkbox. Use `text-sm` density matching existing action items list.

### Side Panel for Rich Preview
**Recommendation:** Fixed right panel, `w-[480px]` on desktop, full-width sheet on mobile. Use `translate-x` transition with `duration-200`. Show document title, full content text, speaker notes, metadata tags, relevance score, and "Ingest" button.

### Infinite Scroll Threshold
**Recommendation:** `rootMargin: "200px"` on IntersectionObserver (preload when sentinel is 200px from viewport). Show 3-4 skeleton cards as loading indicator.

### Floating Toolbar Positioning
**Recommendation:** `fixed bottom-6 left-1/2 -translate-x-1/2 z-40` with `shadow-lg` and `transition-transform duration-200`. Slide up from bottom when items selected.

### Ingested Status Detection
**Recommendation:** Use a **content hash comparison** approach. When the agent returns browse/search results, also query `SlideEmbedding` table for matching `contentHash` values. This avoids a new tracking table and leverages the existing `@@unique([templateId, contentHash])` constraint. For MCP documents, compute a hash from the document content and compare against stored hashes. If no hash match is reliable (MCP content may differ from stored embeddings), fall back to title/documentId matching.

## Open Questions

1. **`discover_documents` Response Format**
   - What we know: The tool exists and is whitelisted. It "lists/browses document inventory."
   - What's unclear: Exact response schema, whether it supports pagination (cursor/offset), filtering by project_id.
   - Recommendation: Use LLM extraction pattern (adaptive prompt) to handle unknown schema. Add logging on first call to capture response shape. If pagination is not supported by the tool, implement client-side virtual pagination over the full result set.

2. **MCP Document ID to SlideEmbedding Mapping**
   - What we know: SlideEmbedding has `contentHash` and `slideObjectId`. MCP search results go through LLM extraction which assigns `slideId`.
   - What's unclear: Whether MCP document IDs are stable and whether they correspond to any field in SlideEmbedding.
   - Recommendation: On first integration, log and compare. Use content hash as the dedup key. If unreliable, create a lightweight mapping table (`DiscoveryIngestion` model tracking MCP doc ID -> SlideEmbedding ID).

3. **Ingestion Pipeline for Discovery Items**
   - What we know: Existing pipeline in `ingest-template.ts` takes a templateId and processes all slides from a Google Slides presentation.
   - What's unclear: How to ingest individual AtlusAI documents (which are already slide-level content) into SlideEmbedding without a parent Template.
   - Recommendation: Create a dedicated `ingestDiscoveryItem()` function that takes MCP document content, classifies it, generates an embedding, and stores it in SlideEmbedding with a synthetic templateId (e.g., "atlus-discovery") or a new nullable field.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing in project) |
| Config file | `apps/agent/vitest.config.ts` / `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter agent test -- --run` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | Sidebar nav item appears for AtlusAI | manual-only | Visual check | N/A |
| DISC-02 | /discovery route renders browse and search | integration | Manual verification | N/A |
| DISC-03 | Browse returns paginated documents from MCP | unit | `pnpm --filter agent test -- --run -t "discovery browse"` | Wave 0 |
| DISC-04 | Search with 300ms debounce | unit | `pnpm --filter agent test -- --run -t "discovery search"` | Wave 0 |
| DISC-05 | Search results include content previews and relevance scores | unit | `pnpm --filter agent test -- --run -t "discovery search"` | Wave 0 |
| DISC-06 | Access gating shows appropriate state | unit | `pnpm --filter agent test -- --run -t "discovery access"` | Wave 0 |
| DISC-07 | Selective ingestion into SlideEmbedding pipeline | unit | `pnpm --filter agent test -- --run -t "discovery ingest"` | Wave 0 |
| DISC-08 | Ingestion progress shown per item | unit | `pnpm --filter agent test -- --run -t "discovery progress"` | Wave 0 |
| DISC-09 | Already-ingested content marked | unit | `pnpm --filter agent test -- --run -t "discovery ingested"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter agent test -- --run`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/lib/__tests__/discovery-api.test.ts` -- covers DISC-03, DISC-04, DISC-05, DISC-06, DISC-07, DISC-08, DISC-09
- [ ] Agent endpoint handlers for `/discovery/*` routes

## Sources

### Primary (HIGH confidence)
- Project codebase: `apps/web/src/components/sidebar.tsx` -- nav item pattern
- Project codebase: `apps/web/src/app/(authenticated)/slides/` -- server component + client component pattern
- Project codebase: `apps/agent/src/lib/mcp-client.ts` -- `callMcpTool()` API
- Project codebase: `apps/agent/src/lib/atlusai-search.ts` -- MCP search + LLM extraction pattern
- Project codebase: `apps/agent/src/lib/atlusai-client.ts` -- `discover_documents` tool documentation
- Project codebase: `apps/agent/src/mastra/index.ts` -- `registerApiRoute` pattern for agent endpoints
- Project codebase: `apps/web/src/lib/api-client.ts` -- `fetchJSON` wrapper pattern
- Project codebase: `apps/web/src/lib/actions/template-actions.ts` -- server action pattern

### Secondary (MEDIUM confidence)
- MDN IntersectionObserver API docs -- well-established browser API for infinite scroll

### Tertiary (LOW confidence)
- `discover_documents` MCP tool response schema -- undocumented, requires runtime discovery

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies needed
- Architecture: HIGH - follows established project patterns exactly (server component + client component, server actions, agent API endpoints)
- Pitfalls: HIGH - based on direct codebase analysis of existing patterns and known MCP integration gaps
- `discover_documents` integration: MEDIUM - tool exists and is whitelisted but response format is unknown; LLM extraction pattern mitigates this

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable project patterns, no external library version concerns)
