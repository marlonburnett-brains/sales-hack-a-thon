---
phase: 27-auth-foundation
plan: 03
subsystem: auth
tags: [atlus, access-detection, action-required, cascade, dedup, silence]

# Dependency graph
requires:
  - phase: 27-01
    provides: ActionRequired model with silenced/seenAt fields, ACTION_TYPES constants, upsertAtlusToken/decryptAtlusToken helpers
provides:
  - detectAtlusAccess() 3-tier cascade (auth probe -> project probe -> full access)
  - upsertActionRequired() with dedup and re-surface semantics
  - resolveActionsByType() for auto-resolve
  - PATCH /actions/:id/silence endpoint
  - POST /atlus/detect on-demand re-check endpoint
  - GET /actions sorted by updatedAt desc
  - GET /actions/count excludes silenced items
  - POST /tokens triggers detectAtlusAccess fire-and-forget
affects: [27-04-ui-components]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget detection on login, 3-tier cascade with auto-resolve, dedup via findFirst before create, re-surface via un-silence + bump updatedAt]

key-files:
  created: []
  modified:
    - apps/agent/src/lib/atlus-auth.ts
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Network errors and timeouts in AtlusAI probes treated as auth failure (safe default)"
  - "Missing ATLUS_PROJECT_ID env var skips project check (treat as ok) to avoid false positives in dev"
  - "detectAtlusAccess wired as fire-and-forget on POST /tokens to avoid delaying login response"

patterns-established:
  - "Dedup pattern: findFirst by userId+actionType+resolved:false before create"
  - "Re-surface pattern: un-silence + bump updatedAt on existing record"
  - "Fire-and-forget pattern: .catch(console.error) for non-blocking background checks"

requirements-completed: [TIER-01, TIER-02, TIER-03, TIER-04, TIER-05, ACTN-01, ACTN-02, ACTN-04]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 27 Plan 03: Access Detection & Actions Summary

**3-tier AtlusAI access cascade with dedup/re-surface ActionRequired helpers, silence endpoint, and login-triggered detection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T20:58:45Z
- **Completed:** 2026-03-06T21:03:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- detectAtlusAccess() implements 3-tier cascade: auth probe (401/403 check) -> project probe (project tools endpoint) -> full access (store token)
- ActionRequired dedup via findFirst + re-surface (un-silence, bump updatedAt) ensures no duplicate cards
- Agent routes updated: actions sorted by updatedAt, badge excludes silenced, new silence and detect endpoints
- detectAtlusAccess automatically fires on login (POST /tokens) and is available on-demand (POST /atlus/detect)

## Task Commits

Each task was committed atomically:

1. **Task 1: ActionRequired helpers** - `32e66d3` (feat)
2. **Task 2: 3-tier detection, route updates, trigger wiring** - `b729e30` (feat)

## Files Created/Modified
- `apps/agent/src/lib/atlus-auth.ts` - Added upsertActionRequired, resolveActionsByType, detectAtlusAccess (3-tier cascade with stubbed probes)
- `apps/agent/src/mastra/index.ts` - Updated action routes (updatedAt sort, silenced exclusion), added silence endpoint, POST /atlus/detect, wired detectAtlusAccess to POST /tokens

## Decisions Made
- Network errors and timeouts in AtlusAI probes treated as auth failure (safe default -- better to show action card than silently fail)
- Missing ATLUS_PROJECT_ID env var skips project check rather than failing (avoids false positives in dev environments)
- detectAtlusAccess fires as fire-and-forget on POST /tokens so login response is not delayed by external AtlusAI probe

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All backend logic for AtlusAI access detection is complete
- Plan 27-04 (UI) can now render action cards with silence/re-check functionality
- Probe endpoints are stubbed with TODO comments for phase-28 when auth mechanism is discovered

---
*Phase: 27-auth-foundation*
*Completed: 2026-03-06*
