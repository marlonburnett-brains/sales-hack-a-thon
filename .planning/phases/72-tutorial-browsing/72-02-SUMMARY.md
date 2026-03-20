---
phase: 72-tutorial-browsing
plan: 02
subsystem: api
tags: [tutorials, browse, hono, prisma, server-action, typed-fetch]

requires:
  - phase: 72-01
    provides: Tutorial + TutorialView Prisma models with thumbnailUrl column

provides:
  - GET /tutorials route returning fixed-order categories with per-user watched aggregation
  - TutorialBrowseCard, TutorialBrowseCategory, TutorialBrowseResponse TypeScript interfaces in api-client.ts
  - listTutorials() fetch helper in api-client.ts
  - listTutorialsAction() server action in tutorial-actions.ts
  - Regression test suite locking browse DTO contract and per-user aggregation rules

affects:
  - 72-03 (UI page consumes listTutorialsAction)
  - Any future phase adding tutorial playback, resume, or progress mutation

tech-stack:
  added: []
  patterns:
    - "Browse-only route: no writes, no playback position, no mutations — pure read aggregation"
    - "Fixed category metadata array drives category ordering independent of DB row order"
    - "getVerifiedUserId as 401 gate pattern (direct use, not via extractGoogleAuth)"
    - "TDD RED-GREEN: test file committed before implementation, tests drive the contract"

key-files:
  created:
    - apps/agent/src/mastra/__tests__/tutorial-browse-route.test.ts
    - apps/web/src/lib/actions/tutorial-actions.ts
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts

key-decisions:
  - "Fixed CATEGORY_META array in the route handler drives category ordering - DB sort order is ignored for grouping"
  - "Promise.all([tutorial.findMany, tutorialView.findMany]) for concurrent fetch with userId-scoped views"
  - "Math.round for completionPercent (matches plan spec rounding requirement)"
  - "thumbnailUrl defaults to null via ?? null (handles Prisma optional string)"

requirements-completed:
  - BROWSE-02
  - BROWSE-03
  - BROWSE-04

duration: 10min
completed: 2026-03-20
---

# Phase 72 Plan 02: Tutorial Browse Route Summary

**Typed GET /tutorials browse endpoint with fixed six-category order, per-user watched aggregation, and matching web server action**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20T23:09:22Z
- **Completed:** 2026-03-20T23:19:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 4

## Accomplishments

- Added `GET /tutorials` route to the agent: 401-gated via JWT, returns all tutorials grouped into six fixed categories with per-user completion math
- Added `TutorialBrowseCard`, `TutorialBrowseCategory`, `TutorialBrowseResponse` interfaces plus `listTutorials()` to `api-client.ts`
- Added `listTutorialsAction()` server action with `"use server"` for the tutorials page to use
- Wrote 5 regression tests locking the browse DTO shape, fixed category order, per-user scoping, nullable thumbnailUrl, and empty-state safety

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock tutorial browse route contract with regression coverage (RED)** - `9914255` (test)
2. **Task 2: Implement GET /tutorials and web-side typed fetch wrappers (GREEN)** - `2ca3c5f` (feat)

## Files Created/Modified

- `apps/agent/src/mastra/__tests__/tutorial-browse-route.test.ts` - 5 regression tests encoding browse DTO contract and per-user aggregation rules
- `apps/agent/src/mastra/index.ts` - Added GET /tutorials route with fixed category order and per-user progress aggregation
- `apps/web/src/lib/api-client.ts` - Added TutorialBrowseCard, TutorialBrowseCategory, TutorialBrowseResponse interfaces and listTutorials() helper
- `apps/web/src/lib/actions/tutorial-actions.ts` - Server action wrapping listTutorials() for the tutorials page

## Decisions Made

- Fixed `CATEGORY_META` array in the route handler controls category ordering, completely independent of DB storage order
- `Promise.all` for concurrent Tutorial + TutorialView queries (userId-scoped)
- `Math.round` for completionPercent consistent with plan spec
- No revalidatePath in the server action - browse is read-only and page will fetch fresh data on each load

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `Type` enum to `@google/genai` mock and `init` method to `PostgresStore` mock**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Test file failed with "No Type export defined on @google/genai mock" and "Cannot read properties of undefined (reading bind)" from PostgresStore
- **Fix:** Added `Type: { OBJECT, ARRAY, STRING, NUMBER, BOOLEAN }` to genai mock (matching pattern from deck-structure-routes.test.ts) and added `init = vi.fn()` to PostgresStore mock class
- **Files modified:** apps/agent/src/mastra/__tests__/tutorial-browse-route.test.ts
- **Verification:** Tests ran and failed with "Missing route GET /tutorials" - correct RED state
- **Committed in:** 9914255 (Task 1 test commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking mock configuration)
**Impact on plan:** Necessary to match existing test infrastructure pattern. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `apps/web` (user-nav.tsx, test files) unrelated to our changes - out of scope per deviation rule scope boundary

## Next Phase Readiness

- GET /tutorials is live and typed - 72-03 (UI page) can import `listTutorialsAction` and render categories
- No blockers

---
*Phase: 72-tutorial-browsing*
*Completed: 2026-03-20*

## Self-Check: PASSED

- apps/agent/src/mastra/__tests__/tutorial-browse-route.test.ts: FOUND
- apps/web/src/lib/actions/tutorial-actions.ts: FOUND
- .planning/phases/72-tutorial-browsing/72-02-SUMMARY.md: FOUND
- Commit 9914255: FOUND
- Commit 2ca3c5f: FOUND
