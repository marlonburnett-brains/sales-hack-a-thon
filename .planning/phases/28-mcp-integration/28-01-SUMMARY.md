---
phase: 28-mcp-integration
plan: 01
subsystem: api
tags: [mcp, sse, oauth, token-refresh, singleton, lifecycle]

# Dependency graph
requires:
  - phase: 27-auth-foundation
    provides: getPooledAtlusAuth(), encrypted AtlusAI token storage, token pool rotation
provides:
  - MCPClient singleton wrapper with lifecycle management (mcp-client.ts)
  - refreshAtlusToken() for OAuth refresh_token exchange
  - updateAtlusTokenInDb() for post-refresh DB persistence
  - registerAtlusClient() for agent-side dynamic client registration
  - ATLUS_USE_MCP kill switch, ATLUS_PROJECT_ID, ATLUS_MCP_MAX_LIFETIME_MS env vars
  - getCachedExtractionPrompt()/setCachedExtractionPrompt() for Plan 02 search adapter
affects: [28-02-search-adapter, mcp-integration]

# Tech tracking
tech-stack:
  added: ["@mastra/mcp MCPClient (SSE transport)"]
  patterns: [singleton-with-lifecycle, token-refresh-mutex, fallback-mode-presets]

key-files:
  created:
    - apps/agent/src/lib/mcp-client.ts
    - apps/agent/src/lib/__tests__/mcp-client.test.ts
  modified:
    - apps/agent/src/lib/atlus-auth.ts
    - apps/agent/src/env.ts
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Tool execute uses `{} as never` for MastraToolInvocationOptions second arg -- MCPClient tools require 2 args but options are internal"
  - "Auth injection via thin fetch callback -- only sets Authorization header, no refresh logic in callback per user decision"
  - "Token refresh mutex serializes concurrent 401 recovery to prevent thundering herd"

patterns-established:
  - "Singleton with lifecycle: module-level state + init/shutdown + lazy recycle on max lifetime"
  - "Fallback mode pre-set: health check at boot determines initial availability, no first-request penalty"
  - "Refresh-then-rotate: on 401, try refresh_token first, only consume pool tokens when refresh is dead"

requirements-completed: [MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06]

# Metrics
duration: 13min
completed: 2026-03-07
---

# Phase 28 Plan 01: MCP Client Foundation Summary

**MCPClient SSE singleton with pooled OAuth auth, health-check boot, max-lifetime recycle, refresh-then-rotate on 401, and SIGTERM shutdown**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-06T23:59:01Z
- **Completed:** 2026-03-07T00:12:10Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- MCPClient singleton connects to AtlusAI SSE endpoint with pooled OAuth Bearer tokens
- Token refresh mutex prevents race conditions on concurrent 401 errors
- Health check at boot pre-sets fallback mode so first search request is never slow
- Agent boots with eager MCP connection; shuts down cleanly on SIGTERM
- 17 unit tests covering all lifecycle behaviors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add refreshAtlusToken() to atlus-auth.ts and env vars** - `9aa3bd3` (feat)
2. **Task 2: Create MCPClient singleton with lifecycle management** - `6a6ce86` (feat)
3. **Task 3: Unit tests for MCP client lifecycle** - `74a4303` (test)

## Files Created/Modified
- `apps/agent/src/lib/mcp-client.ts` - MCPClient singleton wrapper with 6 exports: initMcp, getMcpClient, callMcpTool, isMcpAvailable, shutdownMcp, getCachedExtractionPrompt/setCachedExtractionPrompt
- `apps/agent/src/lib/atlus-auth.ts` - Added refreshAtlusToken(), updateAtlusTokenInDb(), registerAtlusClient()
- `apps/agent/src/env.ts` - Added ATLUS_USE_MCP, ATLUS_PROJECT_ID, ATLUS_MCP_MAX_LIFETIME_MS
- `apps/agent/src/mastra/index.ts` - Added initMcp() on boot, shutdownMcp() on SIGTERM
- `apps/agent/src/lib/__tests__/mcp-client.test.ts` - 17 unit tests for all lifecycle behaviors

## Decisions Made
- Used `{} as never` for tool.execute() second argument since MastraToolInvocationOptions is an internal type required by the Tool interface but not needed for MCP tool calls
- Thin fetch callback only injects Authorization header -- refresh/rotate logic lives in callMcpTool() wrapper per user decision in CONTEXT.md
- Token refresh mutex (refreshPromise) serializes concurrent 401 recovery to prevent thundering herd of refresh requests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed MCPClient tool.execute() type signature**
- **Found during:** Task 2 (MCPClient singleton creation)
- **Issue:** `tool.execute(args)` required 2 arguments per @mastra/core Tool type -- second arg is MastraToolInvocationOptions
- **Fix:** Added null check for `tool.execute` and passed `{} as never` as second argument
- **Files modified:** apps/agent/src/lib/mcp-client.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 6a6ce86 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type signature fix necessary to compile. No scope creep.

## Issues Encountered
- vi.fn().mockImplementation() does not work as a constructor mock in vitest -- needed class-based MockMCPClient instead
- vi.resetModules() required for fresh singleton state per test; mock functions must be recreated after each reset

## User Setup Required
None - no external service configuration required. ATLUS_USE_MCP defaults to 'true', ATLUS_MCP_MAX_LIFETIME_MS defaults to 1 hour.

## Next Phase Readiness
- MCPClient singleton ready for Plan 28-02 (search adapter) to consume via callMcpTool() and getCachedExtractionPrompt()/setCachedExtractionPrompt()
- isMcpAvailable() ready for search routing decisions
- No blockers

---
*Phase: 28-mcp-integration*
*Completed: 2026-03-07*
