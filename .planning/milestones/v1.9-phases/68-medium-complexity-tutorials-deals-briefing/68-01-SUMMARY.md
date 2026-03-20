---
phase: 68-medium-complexity-tutorials-deals-briefing
plan: 01
subsystem: tutorials
tags: [playwright, fixtures, mock-server, stage-switching, deals, deal-chat, briefing]

# Dependency graph
requires:
  - phase: 62-tutorial-infrastructure
    provides: mock server, capture engine, fixture loader, generic capture loop
  - phase: 63-hitl-tutorial
    provides: stage ref pattern, stage fixture loading, mockStage on steps
  - phase: 67-low-complexity-tutorials
    provides: capture spec pattern, visual effects ratios, z.string() mockStage
provides:
  - 4 tutorial scripts (deals 12 steps, deal-overview 8, deal-chat 12, briefing 12)
  - 7-deal fixture set with varied statuses for deals grid tutorial
  - Stage-aware chat GET route in mock server (chatBootstrap from stage fixtures)
  - Browser-side chat GET proxy to mock server for stage awareness
  - 5 deal-chat stage fixtures for chat message progression
  - 4 briefing stage fixtures (idle/generating/complete/history)
  - 4 Playwright capture specs producing deterministic screenshots
affects: [68-02-PLAN, tutorials-tts, tutorials-render]

# Tech tracking
tech-stack:
  added: []
  patterns: [chat-bootstrap-stage-aware, url-based-view-switching, mock-user-owned-deals]

key-files:
  created:
    - apps/tutorials/fixtures/deals/script.json
    - apps/tutorials/fixtures/deals/overrides.json
    - apps/tutorials/fixtures/deal-overview/script.json
    - apps/tutorials/fixtures/deal-overview/overrides.json
    - apps/tutorials/fixtures/deal-chat/script.json
    - apps/tutorials/fixtures/deal-chat/overrides.json
    - apps/tutorials/fixtures/deal-chat/stages/chat-initial.json
    - apps/tutorials/fixtures/deal-chat/stages/chat-exchange-1.json
    - apps/tutorials/fixtures/deal-chat/stages/chat-exchange-2.json
    - apps/tutorials/fixtures/deal-chat/stages/chat-note-saved.json
    - apps/tutorials/fixtures/deal-chat/stages/transcript-uploaded.json
    - apps/tutorials/fixtures/briefing/script.json
    - apps/tutorials/fixtures/briefing/overrides.json
    - apps/tutorials/fixtures/briefing/stages/idle.json
    - apps/tutorials/fixtures/briefing/stages/generating.json
    - apps/tutorials/fixtures/briefing/stages/complete.json
    - apps/tutorials/fixtures/briefing/stages/history.json
    - apps/tutorials/capture/deals.spec.ts
    - apps/tutorials/capture/deal-overview.spec.ts
    - apps/tutorials/capture/deal-chat.spec.ts
    - apps/tutorials/capture/briefing.spec.ts
  modified:
    - apps/tutorials/scripts/mock-server.ts
    - apps/tutorials/src/helpers/route-mocks.ts

key-decisions:
  - "Chat GET route made stage-aware via chatBootstrap field in stage fixtures"
  - "Browser-side chat GET proxies to mock server (same pattern as actions/count)"
  - "All deal fixtures use mock user ID as ownerId so SSR userId filter matches"
  - "URL-based view/filter switching (?view=table, ?status=won) instead of clicking UI buttons"
  - "All 4 tutorials use deal-001 (Meridian Dynamics) for narrative continuity"

patterns-established:
  - "chatBootstrap stage pattern: stage fixtures with chatBootstrap field for chat message progression"
  - "URL-based navigation for SSR search params: use ?param=value in script URLs instead of clicking filter/toggle buttons"
  - "Mock user ownership: tutorial-specific deal overrides set ownerId to mock Supabase user UUID"

requirements-completed: [TUT-04, TUT-05, TUT-06, TUT-07]

# Metrics
duration: 17min
completed: 2026-03-19
---

# Phase 68 Plan 01: Scripts, Fixtures & Captures Summary

**Stage-aware chat and briefing fixtures with 4 capture specs producing 44 deterministic screenshots across deals, deal-overview, deal-chat, and pre-call briefing tutorials**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-19T23:40:23Z
- **Completed:** 2026-03-19T23:57:23Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Made mock server GET /deals/:dealId/chat stage-aware, returning chatBootstrap from stage fixtures
- Browser-side chat GET handler now proxies to mock server for stage awareness (same pattern as actions/count)
- Created 4 tutorial scripts with narration, visual effects, and stage transitions totaling 44 steps
- Created 7-deal fixture set with varied statuses (3 open, 2 won, 1 lost, 1 abandoned) for deals grid
- Created 5 deal-chat stage fixtures showing progressive chat conversations (initial -> exchanges -> transcript -> note)
- Created 4 briefing stage fixtures for idle/generating/complete/history states
- All 4 capture specs produce correct screenshot counts: deals 12, deal-overview 8, deal-chat 12, briefing 12

## Task Commits

Each task was committed atomically:

1. **Task 1: Mock server chat route + browser proxy + all fixture data** - `9425bb4` (feat)
2. **Task 2: Capture specs and end-to-end verification** - `5403840` (feat)

## Files Created/Modified
- `apps/tutorials/scripts/mock-server.ts` - Stage-aware GET /deals/:dealId/chat route
- `apps/tutorials/src/helpers/route-mocks.ts` - Chat GET proxy to mock server
- `apps/tutorials/fixtures/deals/script.json` - 12-step deals grid tutorial
- `apps/tutorials/fixtures/deals/overrides.json` - 7 deals with varied statuses, mock user ownership
- `apps/tutorials/fixtures/deal-overview/script.json` - 8-step deal overview tutorial
- `apps/tutorials/fixtures/deal-overview/overrides.json` - 5 interactions for metrics/timeline
- `apps/tutorials/fixtures/deal-chat/script.json` - 12-step deal chat tutorial
- `apps/tutorials/fixtures/deal-chat/overrides.json` - Empty (stages handle state)
- `apps/tutorials/fixtures/deal-chat/stages/*.json` - 5 stage fixtures for chat progression
- `apps/tutorials/fixtures/briefing/script.json` - 12-step pre-call briefing tutorial
- `apps/tutorials/fixtures/briefing/overrides.json` - Empty (stages handle state)
- `apps/tutorials/fixtures/briefing/stages/*.json` - 4 stage fixtures (idle/generating/complete/history)
- `apps/tutorials/capture/deals.spec.ts` - Playwright capture spec for deals
- `apps/tutorials/capture/deal-overview.spec.ts` - Playwright capture spec for deal overview
- `apps/tutorials/capture/deal-chat.spec.ts` - Playwright capture spec for deal chat
- `apps/tutorials/capture/briefing.spec.ts` - Playwright capture spec for briefing

## Decisions Made
- Chat GET route made stage-aware via chatBootstrap field in stage fixtures (matches research Example 1)
- Browser-side chat GET proxies to mock server (matches research Example 2, same pattern as actions/count)
- All deal fixtures use mock user ID (00000000-0000-0000-0000-000000000001) as ownerId so the SSR userId filter returns deals
- URL-based view/filter switching (?view=table, ?status=won) instead of clicking UI buttons -- more reliable in Playwright since Next.js handles these via searchParams
- All 4 tutorials use deal-001 (Meridian Dynamics) for narrative continuity per CONTEXT.md

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed deals script fill selector**
- **Found during:** Task 2 (capture verification)
- **Issue:** Script used `input[name='name']` but actual dialog input has `id="dealName"`
- **Fix:** Changed selector to `#dealName`
- **Files modified:** apps/tutorials/fixtures/deals/script.json
- **Verification:** Capture completed successfully
- **Committed in:** 5403840 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed deal ownership for mock user**
- **Found during:** Task 2 (capture verification)
- **Issue:** Deals page SSR filters by userId=mock-user-id, but all deals had different ownerIds, so grid showed 0 deals
- **Fix:** Set all deal ownerIds to mock Supabase user UUID
- **Files modified:** apps/tutorials/fixtures/deals/overrides.json
- **Verification:** Deals grid shows all open deals during capture
- **Committed in:** 5403840 (Task 2 commit)

**3. [Rule 1 - Bug] Replaced click-based view/filter switching with URL navigation**
- **Found during:** Task 2 (capture verification)
- **Issue:** Click selectors for view toggle and status filter buttons were unreliable (comma-separated CSS selectors don't work in Playwright)
- **Fix:** Changed to URL-based navigation (/deals?view=table, /deals?status=won) which is how Next.js handles these features via searchParams
- **Files modified:** apps/tutorials/fixtures/deals/script.json
- **Verification:** All 12 steps capture successfully
- **Committed in:** 5403840 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for captures to produce screenshots. No scope creep.

## Issues Encountered
- First deals capture attempt timed out at 60s due to cold Next.js compilation (31s for deal overview route). Second run succeeded with cached compilations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 44 screenshots captured and stored in output/ directories (gitignored)
- Plan 02 (TTS + MP4 rendering) can proceed immediately
- Stage-aware chat and briefing infrastructure is ready for any future tutorials needing these patterns

## Self-Check: PASSED

All 22 created files verified present. Both task commits (9425bb4, 5403840) confirmed in git log.

---
*Phase: 68-medium-complexity-tutorials-deals-briefing*
*Completed: 2026-03-19*
