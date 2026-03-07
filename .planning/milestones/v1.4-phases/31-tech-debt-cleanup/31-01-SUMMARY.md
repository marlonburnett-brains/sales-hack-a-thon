---
phase: 31-tech-debt-cleanup
plan: 01
subsystem: auth, api
tags: [prisma, oauth, mcp, llm, chunking, dead-code]

# Dependency graph
requires:
  - phase: 28-mcp-integration
    provides: MCP client, AtlusAI search with LLM extraction
  - phase: 27-atlus-auth
    provides: AtlusAI token pool, OAuth registration
provides:
  - Persisted OAuth client_id on UserAtlusToken (skips re-registration)
  - Chunked LLM extraction for large MCP results (no data loss)
  - Removed dead recheckAtlusAccess code from web app
affects: [28-mcp-integration, 27-atlus-auth]

# Tech tracking
tech-stack:
  added: []
  patterns: [array-level chunking for LLM context windows, fire-and-forget persistence of OAuth metadata]

key-files:
  created:
    - apps/agent/prisma/migrations/20260307001511_add_atlus_client_id/migration.sql
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/lib/atlus-auth.ts
    - apps/agent/src/lib/mcp-client.ts
    - apps/agent/src/lib/atlusai-search.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/lib/actions/action-required-actions.ts

key-decisions:
  - "Manual migration with resolve --applied due to 0_init checksum drift (consistent with Phase 27 approach)"
  - "Fire-and-forget persistAtlusClientId to avoid blocking MCP init on DB write"

patterns-established:
  - "Array-level chunking: split JSON arrays at element boundaries to fit LLM context windows"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 31 Plan 01: Tech Debt Cleanup Summary

**Persisted OAuth client_id to skip re-registration, chunked LLM extraction for large MCP results (32K limit with parallel array splitting), removed dead recheckAtlusAccess code**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T03:14:16Z
- **Completed:** 2026-03-07T03:18:33Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- UserAtlusToken now stores clientId, eliminating unnecessary registerAtlusClient API call on every agent restart
- extractSlideResults handles results of any size via array-level chunking instead of truncating at 8000 chars
- Removed unused recheckAtlusAccess and recheckAtlusAccessAction from web app, reducing code surface

## Task Commits

Each task was committed atomically:

1. **Task 1: Persist OAuth client_id and skip re-registration** - `29653f4` (feat)
2. **Task 2: Chunked LLM extraction for large MCP results** - `41637da` (feat)
3. **Task 3: Remove dead recheckAtlusAccess code** - `05f81a2` (chore)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added clientId column to UserAtlusToken
- `apps/agent/prisma/migrations/20260307001511_add_atlus_client_id/migration.sql` - Forward-only migration
- `apps/agent/src/lib/atlus-auth.ts` - Extended PooledAtlusAuthResult, added persistAtlusClientId
- `apps/agent/src/lib/mcp-client.ts` - initMcp uses persisted clientId, skips registration when available
- `apps/agent/src/lib/atlusai-search.ts` - Extracted extractSingleBatch, added array-level chunking
- `apps/web/src/lib/api-client.ts` - Removed recheckAtlusAccess function
- `apps/web/src/lib/actions/action-required-actions.ts` - Removed recheckAtlusAccessAction and its import

## Decisions Made
- Used manual migration with `resolve --applied` due to 0_init checksum drift (consistent with Phase 27 approach, follows project rules against db reset)
- Fire-and-forget `persistAtlusClientId` call to avoid blocking MCP init on DB write

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Prisma migration drift (0_init modified) prevented `prisma migrate dev`. Resolved with manual migration SQL + `resolve --applied` per project rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Auth flow is cleaner with persisted client_id
- Large MCP results are handled without data loss
- Codebase is smaller with dead code removed

## Self-Check: PASSED

All files verified present. All 3 task commits verified in git log.

---
*Phase: 31-tech-debt-cleanup*
*Completed: 2026-03-07*
