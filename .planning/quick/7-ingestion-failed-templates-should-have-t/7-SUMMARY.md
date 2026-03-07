---
phase: quick-7
plan: 1
subsystem: ui
tags: [react, dropdown, ingestion, template-card]

requires:
  - phase: none
    provides: existing template-card dropdown menu
provides:
  - Re-ingest dropdown option for failed templates
affects: [template-card]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/web/src/components/template-card.tsx

key-decisions:
  - "Reused existing handleTriggerIngestion handler -- no new logic needed for failed status"

patterns-established: []

requirements-completed: [QUICK-7]

duration: 1min
completed: 2026-03-07
---

# Quick Task 7: Failed Templates Re-ingest Option Summary

**Added "Re-ingest" dropdown menu item for templates with failed ingestion status, reusing existing trigger handler**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-07T01:42:38Z
- **Completed:** 2026-03-07T01:43:16Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Failed templates now show "Re-ingest" in their dropdown menu
- Label correctly shows "Re-ingest" (not "Ingest") for failed status
- Reuses existing handleTriggerIngestion/triggerIngestionAction -- no new handler needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failed status to re-ingest dropdown condition** - `8e900b0` (feat)

## Files Created/Modified
- `apps/web/src/components/template-card.tsx` - Added "failed" to dropdown condition and label logic

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Failed templates now have a recovery path via the dropdown menu
- No blockers

---
*Quick Task: 7*
*Completed: 2026-03-07*
