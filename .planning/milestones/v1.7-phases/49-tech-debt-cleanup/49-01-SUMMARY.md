---
phase: 49-tech-debt-cleanup
plan: 01
subsystem: testing
tags: [vitest, vi-mock, auth, mastra, env-isolation]

# Dependency graph
requires:
  - phase: 43-agent-architecture
    provides: agent-registry and named-agent executor
  - phase: 45-deal-chat
    provides: auth header workaround context
provides:
  - env-isolated agent-registry test suite
  - AUTH-CONTRACT.md documenting web-agent auth header behavior
affects: [future-mastra-upgrades, agent-auth-changes]

# Tech tracking
tech-stack:
  added: []
  patterns: [vi.mock for env module isolation in agent tests]

key-files:
  created:
    - .planning/AUTH-CONTRACT.md
  modified:
    - apps/agent/src/mastra/__tests__/agent-registry.test.ts
    - apps/web/src/lib/api-client.ts
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Used vi.mock for env module to prevent eager t3-env validation during dynamic import"
  - "Used expect.objectContaining for generate() assertion to match current executor signature"

patterns-established:
  - "Env isolation: vi.mock('../../env') with stub values for agent tests that dynamically import modules with eager env validation"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 49 Plan 01: Tech Debt Cleanup Summary

**Env-isolated agent-registry test with vi.mock and auth header contract documentation in AUTH-CONTRACT.md**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T02:49:08Z
- **Completed:** 2026-03-09T02:51:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Agent-registry test now passes in isolation without requiring real env vars
- AUTH-CONTRACT.md documents the fragile Bearer/X-API-Key mapping and recommended fixes
- Inline AUTH-CONTRACT comments in both api-client.ts and index.ts for discoverability

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix env-coupled agent-registry test** - `8b37727` (fix)
2. **Task 2: Document auth header contract** - `88129b0` (docs)

## Files Created/Modified
- `apps/agent/src/mastra/__tests__/agent-registry.test.ts` - Added vi.mock for env module and fixed stale generate() assertion
- `.planning/AUTH-CONTRACT.md` - Auth header contract documentation
- `apps/web/src/lib/api-client.ts` - Added AUTH-CONTRACT inline comment
- `apps/agent/src/mastra/index.ts` - Added AUTH-CONTRACT inline comment

## Decisions Made
- Used vi.mock for env module to prevent eager t3-env validation during dynamic import
- Fixed stale generate() assertion to use expect.objectContaining matching current executor signature

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale generate() call assertion in third test case**
- **Found during:** Task 1 (Fix env-coupled agent-registry test)
- **Issue:** Test expected `generate()` to be called with `undefined` as second arg, but agent-executor now passes `{instructions: ...}`
- **Fix:** Changed assertion to use `expect.objectContaining` matching the current executor signature
- **Files modified:** apps/agent/src/mastra/__tests__/agent-registry.test.ts
- **Verification:** All 3 tests pass
- **Committed in:** 8b37727 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Pre-existing test bug that would have prevented Task 1 from passing. Essential fix.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tech debt plan 01 complete, ready for plan 02
- AUTH-CONTRACT.md provides clear guidance for future Mastra auth alignment

---
*Phase: 49-tech-debt-cleanup*
*Completed: 2026-03-09*
