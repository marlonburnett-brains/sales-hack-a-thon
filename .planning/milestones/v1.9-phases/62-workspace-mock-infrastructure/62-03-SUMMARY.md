---
phase: 62-workspace-mock-infrastructure
plan: 03
subsystem: infra
tags: [playwright, capture, screenshots, tutorial-scripts, orchestration, mock-auth]

# Dependency graph
requires:
  - "62-01: Workspace foundation with fixture loader and TutorialScriptSchema"
  - "62-02: Mock agent server, auth bypass, route mocks, determinism helpers"
provides:
  - "Capture orchestration script (pnpm --filter tutorials capture <name>)"
  - "Screenshot helper with deterministic step-NNN.png naming"
  - "Getting Started pilot tutorial with 8-step script and Playwright spec"
  - "Generic capture loop pattern reusable for any tutorial script"
  - "MOCK_AUTH bypass for Edge Runtime middleware (no Supabase needed)"
affects: [63-PLAN, 64-PLAN, 65-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [capture-orchestration-with-mock-lifecycle, generic-script-driven-capture-loop, zero-padded-step-naming, mock-auth-edge-runtime-bypass, spawn-based-playwright-runner]

key-files:
  created:
    - apps/tutorials/scripts/capture.ts
    - apps/tutorials/src/helpers/screenshot.ts
    - apps/tutorials/capture/getting-started.spec.ts
    - apps/tutorials/fixtures/getting-started/script.json
    - apps/tutorials/fixtures/getting-started/overrides.json
  modified:
    - apps/web/src/middleware.ts
    - apps/web/src/lib/supabase/server.ts
    - apps/web/src/lib/supabase/get-access-token.ts
    - apps/tutorials/fixtures/loader.ts
    - apps/tutorials/scripts/mock-server.ts

key-decisions:
  - "MOCK_AUTH=true env var bypasses all Supabase auth in middleware, createClient, and getAccessToken"
  - "capture.ts manages both mock server AND Next.js dev server lifecycle end-to-end"
  - "spawn replaces execSync for Playwright to keep event loop unblocked for mock server"
  - "Dedicated port 3099 for tutorial captures avoids conflicts with dev server on 3000"
  - "Edge Runtime middleware cannot make HTTP requests to localhost -- MOCK_AUTH bypass required"

patterns-established:
  - "Capture script: load script.json, start mock server + Next.js dev, run Playwright, shut down all -- in finally block"
  - "Capture spec: beforeEach injects auth + route mocks, main test loops script.steps with navigate/wait/action/capture"
  - "Fixture overrides: per-tutorial overrides.json adds templates and interactions for populated UI state"
  - "MOCK_AUTH pattern: set env var to skip all real auth checks in middleware and server helpers"

requirements-completed: [INFRA-07, CAPT-01, CAPT-02]

# Metrics
duration: 45min
completed: 2026-03-19
---

# Phase 62 Plan 03: Capture Orchestration & Getting Started Pilot Summary

**End-to-end capture pipeline with mock server + Next.js lifecycle management, MOCK_AUTH Edge Runtime bypass, and 8-step Getting Started tutorial producing 8 deterministic screenshots in 22 seconds**

## Performance

- **Duration:** ~45 min (including verification fixes across multiple sessions)
- **Started:** 2026-03-19T00:20:42Z
- **Completed:** 2026-03-19T01:10:00Z
- **Tasks:** 3 of 3 (all complete, Task 3 human-verified)
- **Files modified:** 17

## Accomplishments
- Capture orchestration script manages full lifecycle: mock server start, Next.js dev server start, Playwright run, graceful shutdown
- Screenshot helper produces deterministic zero-padded paths (output/getting-started/step-001.png) with prepareForScreenshot before each capture
- Getting Started pilot tutorial with 8 steps covering dashboard, deals pipeline, deal detail, templates, settings, and integrations
- MOCK_AUTH bypass added to Edge Runtime middleware, createClient server helper, and getAccessToken -- zero external dependencies needed
- All 8 screenshots captured successfully in 22 seconds with no Supabase, no external APIs, no credentials required
- Generic capture loop in the Playwright spec works with any TutorialScript JSON -- not hardcoded to Getting Started

## Task Commits

Each task was committed atomically:

1. **Task 1: Build capture orchestration script and screenshot helper** - `019ab53` (feat)
2. **Task 2: AI-generate Getting Started pilot tutorial script and Playwright spec** - `c3799b8` (feat)
3. **Task 3: Verify end-to-end capture** - verified by human (checkpoint:human-verify approved)

### Verification Fix Commits (Task 3 deviations)

- `306b9b4` - fix: replace real Supabase auth with fully mocked auth layer
- `f3d1e21` - fix: use process.cwd() in fixture loader for CJS compatibility
- `ef9351f` - fix: use dedicated port 3099 for tutorial captures
- `d503b3b` - fix: capture.ts manages Next.js server lifecycle directly
- `20806be` - fix: add SUPABASE_URL runtime override for Edge Runtime middleware
- `dc94fe5` - fix: use MOCK_AUTH bypass for Edge Runtime middleware
- `ea265b3` - fix: add MOCK_AUTH support to middleware, layout, and access token
- `46c74b6` - fix: centralize MOCK_AUTH in createClient() server helper
- `dbaa8b5` - fix: use spawn instead of execSync for Playwright to unblock event loop
- `7ee6a80` - chore: filter auth routes from mock server request logging

## Files Created/Modified
- `apps/tutorials/scripts/capture.ts` - CLI orchestration: loads script, starts mock + Next.js servers, runs Playwright, shuts down
- `apps/tutorials/src/helpers/screenshot.ts` - Screenshot capture with naming conventions and step metadata
- `apps/tutorials/capture/getting-started.spec.ts` - Playwright spec that captures Getting Started tutorial screenshots
- `apps/tutorials/fixtures/getting-started/script.json` - 8-step tutorial script for Getting Started pilot
- `apps/tutorials/fixtures/getting-started/overrides.json` - Tutorial-specific fixture overrides with templates and interactions
- `apps/web/src/middleware.ts` - Added MOCK_AUTH bypass for Edge Runtime compatibility
- `apps/web/src/lib/supabase/server.ts` - Added MOCK_AUTH support to createClient()
- `apps/web/src/lib/supabase/get-access-token.ts` - Added MOCK_AUTH early return
- `apps/tutorials/fixtures/loader.ts` - Fixed process.cwd() for CJS compatibility
- `apps/tutorials/scripts/mock-server.ts` - Added auth route filtering in logs

## Decisions Made
- MOCK_AUTH=true env var provides a clean bypass for all auth in Edge Runtime middleware -- Edge Runtime cannot make HTTP requests to localhost, so real Supabase client cannot function during capture
- capture.ts manages both mock server AND Next.js dev server lifecycle -- single command starts everything, single Ctrl+C stops everything
- spawn replaces execSync for Playwright execution -- execSync blocks the event loop which prevents the mock server from responding
- Dedicated port 3099 for tutorial captures avoids conflicts with development server on port 3000
- Auth route logging filtered from mock server to reduce noise during captures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Edge Runtime middleware cannot reach localhost mock server**
- **Found during:** Task 3 (end-to-end verification)
- **Issue:** Next.js Edge Runtime middleware tried to validate Supabase sessions via HTTP to localhost, which Edge Runtime cannot do
- **Fix:** Added MOCK_AUTH=true env var bypass in middleware.ts that skips all Supabase auth checks
- **Files modified:** apps/web/src/middleware.ts
- **Committed in:** dc94fe5

**2. [Rule 1 - Bug] execSync blocks event loop, preventing mock server responses**
- **Found during:** Task 3 (end-to-end verification)
- **Issue:** Using execSync for Playwright blocked Node.js event loop, so the mock server could never respond to requests
- **Fix:** Replaced execSync with spawn to keep event loop unblocked
- **Files modified:** apps/tutorials/scripts/capture.ts
- **Committed in:** dbaa8b5

**3. [Rule 3 - Blocking] fixture loader path resolution fails in CJS context**
- **Found during:** Task 3 (end-to-end verification)
- **Issue:** Fixture loader used import.meta.url which fails when transpiled to CJS by tsx
- **Fix:** Changed to process.cwd() based path resolution
- **Files modified:** apps/tutorials/fixtures/loader.ts
- **Committed in:** f3d1e21

**4. [Rule 1 - Bug] createClient and getAccessToken need MOCK_AUTH support**
- **Found during:** Task 3 (end-to-end verification)
- **Issue:** Even with middleware bypassed, server-side createClient and getAccessToken still tried real Supabase calls
- **Fix:** Added MOCK_AUTH checks to server.ts createClient() and get-access-token.ts
- **Files modified:** apps/web/src/lib/supabase/server.ts, apps/web/src/lib/supabase/get-access-token.ts
- **Committed in:** 46c74b6, ea265b3

**5. [Rule 3 - Blocking] Port conflicts with dev server**
- **Found during:** Task 3 (end-to-end verification)
- **Issue:** Capture tried to use port 3000 which conflicts with running dev server
- **Fix:** Dedicated port 3099 for tutorial captures
- **Files modified:** apps/tutorials/scripts/capture.ts, apps/tutorials/playwright.config.ts
- **Committed in:** ef9351f

---

**Total deviations:** 5 auto-fixed (3 bugs, 2 blocking)
**Impact on plan:** All fixes were necessary for the capture pipeline to function. Edge Runtime limitations were not foreseeable from plan alone. No scope creep -- all changes directly serve the capture use case.

## Issues Encountered
- Edge Runtime in Next.js middleware cannot make HTTP requests to localhost -- this is a fundamental platform limitation that required the MOCK_AUTH bypass approach instead of the originally planned Supabase session mocking
- The combination of mock server + Playwright runner in a single process required spawn (not execSync) to avoid event loop blocking

## User Setup Required
None - the MOCK_AUTH approach eliminates all external credential requirements. No Supabase credentials needed for tutorial capture.

## Next Phase Readiness
- Complete capture infrastructure ready for Phase 63 (HITL & async mock patterns)
- Generic capture loop means new tutorials only need a script.json and optional overrides.json
- MOCK_AUTH pattern established for all future tutorial captures
- All 8 screenshots verified deterministic across multiple runs

## Self-Check: PASSED

- All 8 key files verified present on disk
- All 12 commits verified in git history

---
*Phase: 62-workspace-mock-infrastructure*
*Completed: 2026-03-19*
