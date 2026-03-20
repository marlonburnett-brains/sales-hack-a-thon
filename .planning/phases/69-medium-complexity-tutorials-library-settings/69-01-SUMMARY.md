---
phase: 69-medium-complexity-tutorials-library-settings
plan: 01
subsystem: tutorials
tags: [playwright, fixtures, mock-server, stage-switching, templates, slides, deck-structures, agent-prompts, atlus-integration]

# Dependency graph
requires:
  - phase: 62-tutorial-infrastructure
    provides: mock server, capture engine, fixture loader, generic capture loop
  - phase: 63-hitl-tutorial
    provides: stage ref pattern, stage fixture loading, mockStage on steps
  - phase: 67-low-complexity-tutorials
    provides: capture spec pattern, visual effects ratios, z.string() mockStage
  - phase: 68-medium-complexity-tutorials-deals-briefing
    provides: chatBootstrap pattern, URL-based navigation, mock user ownership
provides:
  - 5 tutorial scripts (template-library 12, slide-library 10, deck-structures 12, agent-prompts 12, atlus-integration 12)
  - Shared content library fixtures (5 templates, 17 slides with AI classification metadata)
  - 9 stage-aware mock server routes (templates, deck-structures x2, agent-configs x3, discovery x3)
  - Fixture loader extended to auto-load shared templates.json and slides.json
  - 19 stage fixture files across 5 tutorials for deterministic state transitions
  - 5 Playwright capture specs producing 58 total screenshots
affects: [69-02-PLAN, tutorials-tts, tutorials-render]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-content-library-fixtures, 7-stage-agent-lifecycle, chat-refinement-with-loading, discovery-access-stage-switching]

key-files:
  created:
    - apps/tutorials/fixtures/shared/templates.json
    - apps/tutorials/fixtures/shared/slides.json
    - apps/tutorials/fixtures/template-library/script.json
    - apps/tutorials/fixtures/template-library/overrides.json
    - apps/tutorials/fixtures/template-library/stages/ingesting.json
    - apps/tutorials/fixtures/template-library/stages/ingested.json
    - apps/tutorials/fixtures/slide-library/script.json
    - apps/tutorials/fixtures/slide-library/overrides.json
    - apps/tutorials/fixtures/deck-structures/script.json
    - apps/tutorials/fixtures/deck-structures/overrides.json
    - apps/tutorials/fixtures/deck-structures/stages/list.json
    - apps/tutorials/fixtures/deck-structures/stages/detail.json
    - apps/tutorials/fixtures/deck-structures/stages/chat-loading.json
    - apps/tutorials/fixtures/deck-structures/stages/chat-refined.json
    - apps/tutorials/fixtures/agent-prompts/script.json
    - apps/tutorials/fixtures/agent-prompts/overrides.json
    - apps/tutorials/fixtures/agent-prompts/stages/list.json
    - apps/tutorials/fixtures/agent-prompts/stages/view-published.json
    - apps/tutorials/fixtures/agent-prompts/stages/draft-created.json
    - apps/tutorials/fixtures/agent-prompts/stages/draft-edited.json
    - apps/tutorials/fixtures/agent-prompts/stages/published.json
    - apps/tutorials/fixtures/agent-prompts/stages/version-history.json
    - apps/tutorials/fixtures/agent-prompts/stages/rolled-back.json
    - apps/tutorials/fixtures/atlus-integration/script.json
    - apps/tutorials/fixtures/atlus-integration/overrides.json
    - apps/tutorials/fixtures/atlus-integration/stages/disconnected.json
    - apps/tutorials/fixtures/atlus-integration/stages/connected.json
    - apps/tutorials/fixtures/atlus-integration/stages/browse.json
    - apps/tutorials/fixtures/atlus-integration/stages/search-results.json
    - apps/tutorials/fixtures/atlus-integration/stages/ingesting.json
    - apps/tutorials/fixtures/atlus-integration/stages/ingested.json
    - apps/tutorials/capture/template-library.spec.ts
    - apps/tutorials/capture/slide-library.spec.ts
    - apps/tutorials/capture/deck-structures.spec.ts
    - apps/tutorials/capture/agent-prompts.spec.ts
    - apps/tutorials/capture/atlus-integration.spec.ts
  modified:
    - apps/tutorials/scripts/mock-server.ts
    - apps/tutorials/fixtures/loader.ts

key-decisions:
  - "Shared content library with 5 templates (4 ingested) and 17 classified slides provides lived-in feel across all tutorials"
  - "Fixture loader extended to auto-load templates.json and slides.json from shared directory"
  - "9 mock server routes made stage-aware using same loadStageFixtures pattern from Phase 63"
  - "Deck structure URLs use touch-1 hyphen format (Next.js slug) while mock server receives touch_1 underscore (VALID_SLUGS mapping)"
  - "Agent prompts lifecycle uses 7 stages: list, view-published, draft-created, draft-edited, published, version-history, rolled-back"
  - "AtlusAI discovery access-check stage-switching mirrors Google Drive Settings disconnected/connected pattern"
  - "Chat refinement fill selector targets textarea[placeholder*='Suggest changes'] for deck-structures chat bar"

patterns-established:
  - "Shared content library: templates.json and slides.json in fixtures/shared/ auto-loaded by fixture loader for all tutorials"
  - "7-stage agent lifecycle: stage fixtures include both agentConfigDetail and agentConfigVersions for parallel SSR fetch"
  - "Chat refinement with loading: delayMs on chat-loading stage before switching to chat-refined for visible AI processing"
  - "Discovery access switching: discoveryAccess field in stage fixtures controls hasAccess boolean for SSR conditional rendering"

requirements-completed: [TUT-08, TUT-09, TUT-10, TUT-11, TUT-12]

# Metrics
duration: 17min
completed: 2026-03-20
---

# Phase 69 Plan 01: Scripts, Fixtures & Captures Summary

**Shared content library fixtures, 9 stage-aware mock routes, and 5 Playwright capture specs producing 58 deterministic screenshots across template-library, slide-library, deck-structures, agent-prompts, and atlus-integration tutorials**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-20T00:25:45Z
- **Completed:** 2026-03-20T00:42:45Z
- **Tasks:** 2
- **Files modified:** 38

## Accomplishments
- Created shared content library with 5 templates (4 ingested with AI classifications) and 17 slides with classification metadata across 4 industries
- Made 9 mock server routes stage-aware for templates, deck-structures, agent-configs, and discovery domains
- Extended fixture loader to auto-load shared templates.json and slides.json
- Authored 5 tutorial scripts totaling 58 steps with narration, visual effects, and stage transitions
- Created 19 stage fixture files covering ingestion 3-stage, chat refinement with loading, 7-stage agent lifecycle, and discovery access switching
- All 5 Playwright capture specs produce correct screenshot counts: template-library 12, slide-library 10, deck-structures 12, agent-prompts 12, atlus-integration 12

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared content fixtures, mock server stage-awareness, and all fixture data** - `3cbcdc5` (feat)
2. **Task 2: Capture specs and end-to-end screenshot verification** - `e928211` (feat)

## Files Created/Modified
- `apps/tutorials/fixtures/shared/templates.json` - 5 templates (4 ingested with classification metadata)
- `apps/tutorials/fixtures/shared/slides.json` - 17 slides with industry, persona, funnel stage, content type classifications
- `apps/tutorials/scripts/mock-server.ts` - 9 routes made stage-aware (templates, deck-structures x2, agent-configs x3, discovery x3)
- `apps/tutorials/fixtures/loader.ts` - Extended to auto-load shared templates and slides
- `apps/tutorials/fixtures/template-library/script.json` - 12-step template registration and ingestion tutorial
- `apps/tutorials/fixtures/template-library/stages/*.json` - 2 stages (ingesting, ingested)
- `apps/tutorials/fixtures/slide-library/script.json` - 10-step slide browsing and search tutorial
- `apps/tutorials/fixtures/deck-structures/script.json` - 12-step structure viewing and chat refinement tutorial
- `apps/tutorials/fixtures/deck-structures/stages/*.json` - 4 stages (list, detail, chat-loading, chat-refined)
- `apps/tutorials/fixtures/agent-prompts/script.json` - 12-step prompt editing lifecycle tutorial
- `apps/tutorials/fixtures/agent-prompts/stages/*.json` - 7 stages (list through rolled-back)
- `apps/tutorials/fixtures/atlus-integration/script.json` - 12-step AtlusAI connection and discovery tutorial
- `apps/tutorials/fixtures/atlus-integration/stages/*.json` - 6 stages (disconnected through ingested)
- `apps/tutorials/capture/*.spec.ts` - 5 capture specs following generic capture loop pattern

## Decisions Made
- Shared content library with 5 templates and 17 slides gives all tutorials a "lived-in" feel without per-tutorial duplication
- Fixture loader extended to auto-load templates.json and slides.json from shared/ directory (Rule 2 - missing functionality for new shared fixtures)
- Deck structure URLs use touch-1 hyphen format (Next.js slug) while the mock server API receives touch_1 underscore (page.tsx VALID_SLUGS mapping handles translation)
- Agent prompts lifecycle uses 7 stage fixtures, each containing BOTH agentConfigDetail and agentConfigVersions to satisfy Promise.all SSR fetch (Pitfall 5 from RESEARCH.md)
- AtlusAI discovery access-check stage switching mirrors Google Drive Settings disconnected/connected pattern from Phase 67
- Chat refinement uses delayMs: 1500 on chat-loading stage for visible AI processing state (not instant switch like Deal Chat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed deck-structures URLs from touch_1 to touch-1**
- **Found during:** Task 2 (capture verification)
- **Issue:** Script used `/settings/deck-structures/touch_1` but Next.js route expects `/settings/deck-structures/touch-1` (hyphen format)
- **Fix:** Changed all deck-structures URLs to use hyphen format (touch-1, touch-3)
- **Files modified:** apps/tutorials/fixtures/deck-structures/script.json
- **Verification:** Capture completed successfully with all 12 screenshots

**2. [Rule 1 - Bug] Fixed deck-structures chat fill selector**
- **Found during:** Task 2 (capture verification)
- **Issue:** Generic selector `textarea, input[type='text'][placeholder*='message']` didn't match the chat bar textarea
- **Fix:** Changed to `textarea[placeholder*='Suggest changes']` matching the actual ChatBar component placeholder
- **Files modified:** apps/tutorials/fixtures/deck-structures/script.json
- **Verification:** Fill action succeeds, step-008 captured with text in chat bar

**3. [Rule 2 - Missing Critical] Extended fixture loader for shared templates/slides**
- **Found during:** Task 1 (shared fixtures authoring)
- **Issue:** Fixture loader only loaded companies, deals, users from shared/ -- no template or slide auto-loading
- **Fix:** Added templates.json and slides.json loading to loadFixtures() function
- **Files modified:** apps/tutorials/fixtures/loader.ts
- **Verification:** Slide Library page renders 17 slides from shared fixtures

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for captures to produce screenshots. No scope creep.

## Issues Encountered
- AtlusAI integration capture hit SIGKILL (OOM) on first attempt due to combined memory pressure from Playwright worker + Next.js compiling /discovery route. Succeeded on retry with cached compilations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 58 screenshots captured and stored in output/ directories (gitignored)
- Plan 02 (TTS + MP4 rendering) can proceed immediately
- Stage-aware mock server routes for templates, deck-structures, agent-configs, and discovery are available for any future tutorials

## Self-Check: PASSED

All 38 created/modified files verified present. Both task commits (3cbcdc5, e928211) confirmed in git log.

---
*Phase: 69-medium-complexity-tutorials-library-settings*
*Completed: 2026-03-20*
