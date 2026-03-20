---
phase: 62-workspace-mock-infrastructure
plan: 02
subsystem: infra
tags: [express, playwright, supabase, mocking, determinism, screenshots]

# Dependency graph
requires:
  - "62-01: Workspace foundation with fixture loader and types"
provides:
  - "Express mock agent server handling all api-client.ts routes with fixture data"
  - "Supabase REST login auth bypass for Playwright captures"
  - "page.route() browser-side API mocking helpers"
  - "Deterministic screenshot preparation (CSS disable, network idle, font ready, skeleton wait)"
affects: [62-03-PLAN]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js", "@playwright/test"]
  patterns: [mock-server-full-route-catalog, supabase-cookie-injection, page-route-catch-all, css-animation-disable]

key-files:
  created:
    - apps/tutorials/scripts/mock-server.ts
    - apps/tutorials/src/helpers/auth.ts
    - apps/tutorials/src/helpers/route-mocks.ts
    - apps/tutorials/src/helpers/determinism.ts
  modified:
    - apps/tutorials/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Mock server serves all api-client.ts routes (40+ endpoints) rather than only Getting Started subset -- enables any future tutorial without mock server changes"
  - "Auth helper injects both localStorage session and SSR cookies to satisfy both middleware auth paths (getSession for RSC, getUser for page loads)"
  - "Browser route mocks catch-all returns 200 with warning instead of 404 to prevent UI errors during captures"

patterns-established:
  - "Mock server: createMockServer(tutorialName) loads fixtures, registers express routes, returns app"
  - "Auth bypass: signInWithPassword + cookie injection with chunked cookie support for large sessions"
  - "Determinism: disableAnimations + waitForStableState = prepareForScreenshot convenience"
  - "Route mocks: mockBrowserAPIs(page, fixtures) registers all /api/** interceptors"

requirements-completed: [INFRA-03, INFRA-04, INFRA-05]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 62 Plan 02: Mock Layers & Helpers Summary

**Express mock agent server with 40+ route handlers, Supabase REST auth bypass with cookie injection, page.route() browser API interceptors, and CSS animation disable + skeleton wait determinism helpers**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T00:13:51Z
- **Completed:** 2026-03-19T00:18:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Mock agent server handles every route from api-client.ts (companies, deals, users, workflows, templates, slides, briefs, actions, discovery, deck-structures, agent-configs, tokens)
- Auth helper produces real Supabase session tokens via signInWithPassword, injects both localStorage and chunked SSR cookies
- Browser-side route mocks intercept all /api/* polling and streaming routes (workflow status, generation logs, thumbnails, chat)
- Determinism helpers disable CSS animations, wait for network idle + fonts + skeleton removal

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Express mock agent server with full route catalog** - `cc841fc` (feat)
2. **Task 2: Build auth bypass, page.route() helpers, and determinism utilities** - `9991bea` (feat)
3. **Dependency fix: Add @supabase/supabase-js and @playwright/test** - `d74987b` (chore)

## Files Created/Modified
- `apps/tutorials/scripts/mock-server.ts` - Express mock server with all api-client.ts route handlers (639 lines)
- `apps/tutorials/src/helpers/auth.ts` - Supabase signInWithPassword + cookie injection for Playwright
- `apps/tutorials/src/helpers/route-mocks.ts` - page.route() factories for browser-side /api/* mocking
- `apps/tutorials/src/helpers/determinism.ts` - CSS animation disable, network idle wait, skeleton detection
- `apps/tutorials/package.json` - Added @supabase/supabase-js and @playwright/test deps
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Mock server covers all 40+ api-client.ts routes upfront rather than incrementally -- prevents missing-route surprises during any tutorial capture
- Auth helper sets google-token-status cookie to "valid" alongside session cookies -- prevents middleware token check timeout (3s delay per page load)
- Route mocks catch-all returns HTTP 200 (not 404) with warning JSON -- prevents browser-side errors breaking captures while still logging missing mocks
- Supabase session cookies use chunked format (`.0`, `.1` suffixes) for sessions exceeding 3KB -- matches @supabase/ssr behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSDoc comment with glob pattern breaking esbuild**
- **Found during:** Task 2 (route-mocks.ts verification)
- **Issue:** Comment containing `/api/presentations/*/thumbnails` had `*/` interpreted as end-of-comment by esbuild parser
- **Fix:** Changed glob patterns in JSDoc to use `{id}` placeholder syntax
- **Files modified:** apps/tutorials/src/helpers/route-mocks.ts
- **Verification:** tsx import test passes
- **Committed in:** 9991bea (Task 2 commit)

**2. [Rule 3 - Blocking] Added missing @supabase/supabase-js and @playwright/test dependencies**
- **Found during:** Post-Task 2 (dependency check)
- **Issue:** auth.ts imports @supabase/supabase-js, all helpers import @playwright/test types -- neither in package.json
- **Fix:** Added both packages via pnpm add
- **Files modified:** apps/tutorials/package.json, pnpm-lock.yaml
- **Verification:** All imports resolve, tsx test passes
- **Committed in:** d74987b (separate chore commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both essential for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - mock server uses existing fixtures from Plan 01. Auth helper requires env vars (already documented in .env.example from Plan 01).

## Next Phase Readiness
- All four helper modules ready for capture orchestration in Plan 03
- Mock server tested: starts, serves fixture data, handles /tokens/check, logs unhandled routes
- Auth, route-mocks, determinism all export expected functions and verified importable

---
*Phase: 62-workspace-mock-infrastructure*
*Completed: 2026-03-19*
