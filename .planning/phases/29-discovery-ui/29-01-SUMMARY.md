---
phase: 29-discovery-ui
plan: 01
subsystem: ui, api
tags: [discovery, mcp, server-actions, next.js, mastra, pgvector]

# Dependency graph
requires:
  - phase: 28-mcp-integration
    provides: MCP client, callMcpTool, isMcpAvailable, searchSlides
  - phase: 27-atlus-auth
    provides: Token pool, getPooledAtlusAuth, AtlusAI access detection
provides:
  - 5 agent API endpoints for discovery (access-check, browse, search, ingest, progress)
  - 5 server actions for web-to-agent discovery communication
  - 5 typed API client functions for discovery
  - AtlusAI sidebar navigation item with Brain icon
  - /discovery route with server-side access gating
  - Placeholder DiscoveryClient component for Plan 02
  - Discovery batch ingestion infrastructure with async processing
affects: [29-02-browse-search-ui, 29-03-ingestion-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [discovery-batch-ingestion-map, access-gating-server-component]

key-files:
  created:
    - apps/web/src/lib/actions/discovery-actions.ts
    - apps/web/src/app/(authenticated)/discovery/page.tsx
    - apps/web/src/app/(authenticated)/discovery/discovery-client.tsx
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/components/sidebar.tsx

key-decisions:
  - "Used module-level Map for batch ingestion state (simple, in-memory, sufficient for single-instance agent)"
  - "Discovery ingest uses templateId='atlus-discovery' synthetic marker to distinguish from template-based slides"
  - "Used .issues instead of .errors for Zod v4 error details in new endpoints"
  - "Skipped LLM classification for discovery ingestion (stores raw metadata as classificationJson) -- can be enhanced later"

patterns-established:
  - "Access gating pattern: server component checks access before rendering, returns empty state per reason"
  - "Discovery batch map: batchId -> Map<itemId, status> for fire-and-forget async ingestion tracking"

requirements-completed: [DISC-01, DISC-02, DISC-06]

# Metrics
duration: 7min
completed: 2026-03-07
---

# Phase 29 Plan 01: Discovery UI Infrastructure Summary

**Agent API endpoints, server actions, sidebar nav, and access-gated /discovery route with initial browse data pass-through**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-07T00:59:48Z
- **Completed:** 2026-03-07T01:07:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 5 agent API endpoints for full discovery lifecycle (access-check, browse, search, ingest, progress)
- Complete web infrastructure: typed API client, server actions, sidebar navigation
- Server-side access gating with 3 distinct empty states (no_tokens, mcp_unavailable, disabled)
- Async batch ingestion with per-item status tracking and content dedup via SHA-256 hash

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent API endpoints for discovery** - `04d1382` (feat)
2. **Task 2: Server actions, API client, sidebar nav, /discovery page** - `7708ff4` (feat)

## Files Created/Modified
- `apps/agent/src/mastra/index.ts` - 5 new registerApiRoute endpoints + discovery batch Map + imports
- `apps/web/src/lib/api-client.ts` - 5 typed discovery functions + interfaces
- `apps/web/src/lib/actions/discovery-actions.ts` - 5 server actions wrapping API client
- `apps/web/src/components/sidebar.tsx` - AtlusAI nav item with Brain icon
- `apps/web/src/app/(authenticated)/discovery/page.tsx` - Server component with access gating
- `apps/web/src/app/(authenticated)/discovery/discovery-client.tsx` - Placeholder client component

## Decisions Made
- Used module-level Map for batch ingestion tracking -- simple and sufficient for single-instance Railway deployment
- templateId='atlus-discovery' as synthetic marker for discovery-originated SlideEmbedding records
- Skipped full LLM classification in discovery ingest endpoint -- stores raw metadata, can be enriched later
- Used Zod `.issues` (v4) instead of `.errors` (v3) for error response details

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 .errors -> .issues**
- **Found during:** Task 1 (Agent endpoints)
- **Issue:** Plan used `err.errors` for ZodError details, but Zod v4 uses `.issues`
- **Fix:** Changed to `err.issues` in search and ingest error handlers
- **Files modified:** apps/agent/src/mastra/index.ts
- **Verification:** tsc --noEmit passes for new code
- **Committed in:** 04d1382 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Zod v4 z.record() arity**
- **Found during:** Task 1 (Agent endpoints)
- **Issue:** `z.record(z.unknown())` requires 2 args in Zod v4: `z.record(z.string(), z.unknown())`
- **Fix:** Added key schema argument
- **Files modified:** apps/agent/src/mastra/index.ts
- **Verification:** tsc --noEmit passes for new code
- **Committed in:** 04d1382 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes required for compilation. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All plumbing complete for Plan 02 (browse/search UI) and Plan 03 (ingestion UI)
- DiscoveryClient placeholder ready to be replaced with full browse/search implementation
- All 5 server actions available for client component usage
- Ingested hash tracking ready for DISC-09 "already ingested" indicators

---
*Phase: 29-discovery-ui*
*Completed: 2026-03-07*
