---
phase: 28-mcp-integration
plan: 02
subsystem: api
tags: [mcp, semantic-search, llm-extraction, drive-fallback, adaptive-prompt]

# Dependency graph
requires:
  - phase: 28-mcp-integration
    plan: 01
    provides: MCPClient singleton (callMcpTool, isMcpAvailable, getCachedExtractionPrompt, setCachedExtractionPrompt)
provides:
  - MCP-first search routing in searchSlides() with Drive API fallback
  - LLM extraction layer (extractSlideResults) with adaptive prompt caching
  - source ('mcp'|'drive') and relevanceScore fields on SlideSearchResult
  - ATLUS_PROJECT_ID scoping for MCP searches
affects: [29-discovery-ui, mcp-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [mcp-first-routing-with-drive-fallback, adaptive-llm-extraction-prompt, env-kill-switch]

key-files:
  created:
    - apps/agent/src/lib/__tests__/atlusai-search.test.ts
  modified:
    - apps/agent/src/lib/atlusai-search.ts

key-decisions:
  - "LLM extraction always used for MCP results (consistency over cost savings per user decision)"
  - "Multi-pass searchForProposal() strategy preserved unchanged -- semantic search improves individual passes but multi-pass provides diversity"
  - "On LLM extraction failure: return empty array (graceful degradation, avoid blocking workflows)"
  - "Adaptive prompt: first call discovers MCP result shape, caches template for subsequent calls"

patterns-established:
  - "MCP-first routing: check env kill switch, check availability, try MCP, catch and fall through to Drive"
  - "Adaptive LLM extraction: discovery prompt on first call, cached template on subsequent calls"
  - "Source tagging: all results tagged with origin ('mcp'|'drive') for UI fallback indicator"

requirements-completed: [SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06]

# Metrics
duration: 9min
completed: 2026-03-07
---

# Phase 28 Plan 02: Search Adapter Summary

**MCP semantic search routing in searchSlides() with LLM extraction, Drive fallback, and adaptive prompt caching**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-07T00:15:10Z
- **Completed:** 2026-03-07T00:24:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- searchSlides() routes MCP semantic search first with automatic Drive API keyword search fallback
- LLM extraction maps unknown MCP result shapes to SlideSearchResult interface using adaptive prompt
- All 5 consumer files (slide-selection, proposal-assembly, touch-4, pre-call, verify-rag-quality) compile unchanged
- 19 unit tests covering routing, extraction, fallback, scoping, multi-pass, and delegation

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor atlusai-search.ts with MCP search routing and LLM extraction** - `39e53f1` (feat)
2. **Task 2: Unit tests for search routing, LLM extraction, and fallback** - `ba72301` (test)

## Files Created/Modified
- `apps/agent/src/lib/atlusai-search.ts` - Refactored with MCP-first routing (searchSlidesMcp), LLM extraction (extractSlideResults), Drive fallback (searchSlidesDrive), source/relevanceScore fields
- `apps/agent/src/lib/__tests__/atlusai-search.test.ts` - 19 unit tests for all search behaviors

## Decisions Made
- LLM extraction always used for every MCP result (consistency over cost savings, per user decision in CONTEXT.md)
- Multi-pass searchForProposal() 3-pass structure preserved unchanged -- semantic search improves individual pass quality but multi-pass provides topic diversity (pillars, case studies) a single query cannot replicate
- On total LLM extraction failure: return empty array rather than crashing -- safest for workflow continuity
- Adaptive prompt caches template with {{RAW_RESULTS}} and {{SEARCH_QUERY}} placeholders after first successful extraction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed env override ordering in tests**
- **Found during:** Task 2 (unit tests)
- **Issue:** Setting env overrides before freshModule() was overwritten by freshModule()'s re-initialization of envOverrides
- **Fix:** Set env overrides after freshModule() call so Proxy picks up correct values
- **Files modified:** apps/agent/src/lib/__tests__/atlusai-search.test.ts
- **Verification:** All 19 tests pass
- **Committed in:** ba72301 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test fix necessary for correctness. No scope creep.

## Issues Encountered
None -- plan executed smoothly.

## User Setup Required
None - no external service configuration required. MCP client foundation from Plan 28-01 handles all auth.

## Next Phase Readiness
- MCP semantic search fully wired and tested
- All existing workflows automatically get semantic search quality via unchanged searchSlides() calls
- Drive fallback preserved behind ATLUS_USE_MCP=false kill switch
- Ready for Phase 29 (Discovery UI) which can use the `source` field for degraded search indicators

---
*Phase: 28-mcp-integration*
*Completed: 2026-03-07*
