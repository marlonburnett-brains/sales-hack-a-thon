---
phase: 27-auth-foundation
plan: 02
subsystem: auth
tags: [atlus, token-pool, rotation, aes-256-gcm, prisma]

# Dependency graph
requires:
  - phase: 27-01
    provides: "UserAtlusToken model, encryptToken/decryptToken, upsertAtlusToken"
provides:
  - "getPooledAtlusAuth() function for background token access"
  - "PooledAtlusAuthResult interface"
affects: [28-mcp-integration, agent-background-jobs]

# Tech tracking
tech-stack:
  added: []
  patterns: [token-pool-rotation-with-env-fallback, fire-and-forget-db-updates, pool-health-monitoring]

key-files:
  created:
    - apps/agent/src/lib/__tests__/atlus-auth.test.ts
  modified:
    - apps/agent/src/lib/atlus-auth.ts

key-decisions:
  - "Cloned getPooledGoogleAuth pattern exactly -- same ordering, fire-and-forget, health check approach"
  - "No ActionRequired creation on token failure -- deferred to Plan 27-03 per plan spec"
  - "Pool health warning at < 3 valid tokens threshold, matching Google pool"

patterns-established:
  - "AtlusAI pool rotation: same pattern as Google pool but simpler (no OAuth refresh, just decrypt-and-return)"
  - "Env var fallback: ATLUS_API_TOKEN as last resort when all pool tokens exhausted"

requirements-completed: [POOL-01, POOL-02, POOL-03, POOL-04, POOL-05]

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 27 Plan 02: Token Pool Rotation Summary

**getPooledAtlusAuth() with pool rotation, failure marking, health monitoring, and ATLUS_API_TOKEN env var fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T20:58:36Z
- **Completed:** 2026-03-06T21:01:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- getPooledAtlusAuth() iterates valid tokens ordered by lastUsedAt desc
- Failed tokens marked isValid=false with revokedAt timestamp (fire-and-forget)
- Successful usage updates lastUsedAt (fire-and-forget)
- Pool health warning when < 3 valid tokens remain
- ATLUS_API_TOKEN env var fallback when pool exhausted
- Returns null when all sources exhausted
- Full TDD cycle: 7 unit tests all passing

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for getPooledAtlusAuth** - `5afea94` (test)
2. **Task 1 (GREEN): Implement getPooledAtlusAuth** - `af751af` (feat)

## Files Created/Modified
- `apps/agent/src/lib/atlus-auth.ts` - Added PooledAtlusAuthResult interface and getPooledAtlusAuth() function
- `apps/agent/src/lib/__tests__/atlus-auth.test.ts` - 7 unit tests covering all pool rotation behaviors

## Decisions Made
- Cloned getPooledGoogleAuth pattern exactly for consistency across the codebase
- No ActionRequired creation on token failure -- Plan 27-03 handles that integration
- Pool health warning threshold set to < 3 valid tokens, matching Google pool convention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- getPooledAtlusAuth() ready for Phase 28 MCP integration
- Plan 27-03 can now wire ActionRequired creation into the failure path
- Plan 27-04 can integrate pool into detection flow

---
*Phase: 27-auth-foundation*
*Completed: 2026-03-06*
