# Phase 29: Discovery UI - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

New AtlusAI sidebar page with browse and semantic search views for discovering AtlusAI content, plus selective batch ingestion into the local SlideEmbedding pipeline. Access gating shows appropriate state when AtlusAI credentials are missing. This phase does NOT include structured search filters (DISC-10), pre-ingestion content preview panel (DISC-11), or cross-source unified search (DISC-14) -- those are v1.4+ deferred requirements.

</domain>

<decisions>
## Implementation Decisions

### Page layout & navigation
- "AtlusAI" sidebar nav item with brain icon, placed after Slide Library and before Action Required
- Route at `/discovery` under the authenticated layout
- Unified layout: single page with search bar at top. When empty, shows browse inventory. When typing, switches to semantic search results
- Browse results support toggle between card grid and list/table views (user can switch modes)
- Infinite scroll pagination for browse view (auto-loads next page on scroll)

### Search experience
- Search bar triggers MCP `knowledge_base_search_semantic` only -- no client-side title filtering of browse results
- Debounced input (300ms per DISC-04 requirement)
- Rich preview panel: clicking a search result opens a side panel with full content preview before deciding to ingest
- Relevance scores shown as visual indicator (color-coded bar or percentage badge) -- consistent with existing Slide Library similarity search
- Empty state with suggestions: "No results for [query]. Try broader terms like..." with 2-3 alternative search suggestions based on common content categories

### Ingestion flow
- Batch selection with floating toolbar: checkboxes on each item, toolbar appears when 1+ selected showing "Ingest N selected" button
- Per-item status indication during ingestion: pending -> ingesting -> done/error (matches existing template ingestion polling pattern)
- Floating toolbar shows overall batch progress
- Already-ingested content: green "Ingested" badge + disabled/checked checkbox. Prevents re-selection
- Error resilience: failed items show error badge with tooltip, other items continue ingesting. User can retry failed items individually. No batch abort

### Access gating UX
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

</decisions>

<specifics>
## Specific Ideas

- User wants both card grid AND list view with a toggle -- not just one layout mode
- Rich preview panel for search results (side panel with full content) before committing to ingest
- Infinite scroll preferred over pagination or load-more button
- Unified search + browse on one page (no tabs) -- search bar presence determines which mode is active

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sidebar.tsx`: Static `navItems` array -- add new entry with `lucide-react` brain icon (`Brain` or `Sparkles`)
- `actions-client.tsx`: ActionRequired rendering with icon mapping -- access gating can reuse icon patterns
- `slide-library-client.tsx`: Color-coded similarity search results -- pattern for relevance score display
- `template-card.tsx`: Card component pattern for browse view cards
- `api-client.ts`: `fetchJSON()` and `fetchWithGoogleAuth()` -- agent API communication
- `ingestion-queue.ts` / `ingest-template.ts`: Existing ingestion pipeline with progress tracking
- Sonner toast library for notifications

### Established Patterns
- Server component page with client component for interactivity (slides/page.tsx -> SlideLibraryClient)
- Server actions in `lib/actions/*.ts` for web-to-agent communication
- Polling for progress updates (template ingestion pattern)
- Empty state: centered div with icon + message + CTA (used in Slide Library, Actions)
- OAuth redirect with query params for success/error feedback (actions-client.tsx handles `atlus_success`/`atlus_error`)

### Integration Points
- `apps/web/src/components/sidebar.tsx`: Add nav item to `navItems` array
- `apps/web/src/app/(authenticated)/discovery/`: New route directory
- `apps/agent/src/lib/mcp-client.ts`: MCPClient singleton for `discover_documents` and `knowledge_base_search_semantic` tools
- `apps/agent/src/lib/atlusai-search.ts`: Existing search infrastructure
- `apps/agent/src/ingestion/ingest-template.ts`: Ingestion pipeline to wire selective ingestion into
- `apps/web/src/lib/actions/`: New server actions for discovery browse, search, and ingestion

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 29-discovery-ui*
*Context gathered: 2026-03-06*
