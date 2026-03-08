---
phase: 40-agent-typecheck-cleanup
plan: "02"
subsystem: testing
tags: [agent, mcp, vitest, typescript, atlus]
requires:
  - phase: 40-agent-typecheck-cleanup
    provides: shared schema, Mastra, and Zod compile cleanup from plan 01
provides:
  - Public-API-aligned MCP connection helper for Atlus health checks and tool calls
  - Regression coverage for MCP lifecycle, refresh recovery, and stale-client recycling
  - Vitest 4-safe callable mocks for Atlus search routing and prompt-cache coverage
affects: [40-03, agent-compile, mcp, atlus-search]
tech-stack:
  added: []
  patterns:
    - Contain the MCP internal connected-client escape hatch in one helper instead of typed reach-through at each call site
    - Declare Vitest mocks with explicit callable signatures when test doubles are invoked through wrapper functions
key-files:
  created:
    - .planning/phases/40-agent-typecheck-cleanup/40-02-SUMMARY.md
  modified:
    - apps/agent/src/lib/mcp-client.ts
    - apps/agent/src/lib/__tests__/mcp-client.test.ts
    - apps/agent/src/lib/__tests__/atlusai-search.test.ts
key-decisions:
  - "Keep the unsupported MCP connected-client access behind one local helper so the rest of the wrapper stays typed against the public MCPClient surface."
  - "Use explicit callable Vitest mock signatures for MCP, Drive, and GenAI wrappers so Vitest 4 preserves callability under TypeScript."
patterns-established:
  - "Health checks and raw tool calls share the same narrow Atlus SDK helper, which keeps MCP seam drift visible in one place."
  - "Wrapper-style mocks in agent tests should be declared with typed vi.fn signatures instead of broad ReturnType<typeof vi.fn> placeholders."
requirements-completed: []
duration: 4 min
completed: 2026-03-08
---

# Phase 40 Plan 02: MCP Client and Vitest Suite Cleanup Summary

**The agent MCP wrapper now uses one contained Atlus connection seam, and the MCP-adjacent Vitest suites compile and pass under Vitest 4 without losing routing or auth-recovery coverage.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T17:54:56Z
- **Completed:** 2026-03-08T17:58:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced the direct typed private-method calls in `apps/agent/src/lib/mcp-client.ts` with one narrow helper used by both the health check and raw tool execution path.
- Rebuilt `apps/agent/src/lib/__tests__/mcp-client.test.ts` around the current MCP lifecycle behavior, including health-check success, refresh retry, token rotation, and stale-client recycling.
- Updated `apps/agent/src/lib/__tests__/atlusai-search.test.ts` so its MCP and Drive mocks use Vitest 4-safe callable signatures while preserving routing, prompt-cache, and project-scoping assertions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the private MCP reach-through with a contained supported seam** - `cc75069` (test), `7406918` (feat)
2. **Task 2: Repair stale Vitest callable mocks in the search adapter suite** - `4fedff5` (test), `31a1da2` (feat)

**Plan metadata:** pending final `docs(40-02)` metadata commit at summary creation time.

## Files Created/Modified
- `apps/agent/src/lib/mcp-client.ts` - centralizes the Atlus connected-client escape hatch and reuses it for health checks plus raw tool calls
- `apps/agent/src/lib/__tests__/mcp-client.test.ts` - locks the current MCP lifecycle, auth recovery, and prompt-cache recycling behavior to the repaired seam
- `apps/agent/src/lib/__tests__/atlusai-search.test.ts` - keeps MCP-vs-Drive routing coverage while converting wrappers to Vitest 4-safe callable mocks

## Decisions Made
- Kept the unavoidable connected-client escape hatch isolated in one helper instead of broadening casts across `initMcp()` and `callMcpTool()`.
- Tightened callable mock typing at the wrapper boundary rather than weakening assertions or removing the MCP prompt-cache and project-scope coverage.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `pnpm --filter agent exec vitest run src/lib/__tests__/mcp-client.test.ts src/lib/__tests__/atlusai-search.test.ts` passes with the repaired seam and Vitest 4 mock typing.
- `pnpm --filter agent exec tsc --noEmit` now passes, so `40-03-PLAN.md` can focus on final verification and publication rather than remaining MCP/test compile debt.

## Self-Check: PASSED
- Verified `.planning/phases/40-agent-typecheck-cleanup/40-02-SUMMARY.md` exists.
- Verified commits `cc75069`, `7406918`, `4fedff5`, and `31a1da2` exist in git history.

---
*Phase: 40-agent-typecheck-cleanup*
*Completed: 2026-03-08*
