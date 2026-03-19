---
phase: 62-workspace-mock-infrastructure
plan: 03
subsystem: infra
tags: [playwright, capture, screenshots, tutorial-scripts, orchestration]

# Dependency graph
requires:
  - "62-01: Workspace foundation with fixture loader and TutorialScriptSchema"
  - "62-02: Mock agent server, auth bypass, route mocks, determinism helpers"
provides:
  - "Capture orchestration script (pnpm --filter tutorials capture <name>)"
  - "Screenshot helper with deterministic step-NNN.png naming"
  - "Getting Started pilot tutorial with 8-step script and Playwright spec"
  - "Generic capture loop pattern reusable for any tutorial script"
affects: [63-PLAN, 64-PLAN, 65-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [capture-orchestration-with-mock-lifecycle, generic-script-driven-capture-loop, zero-padded-step-naming]

key-files:
  created:
    - apps/tutorials/scripts/capture.ts
    - apps/tutorials/src/helpers/screenshot.ts
    - apps/tutorials/capture/getting-started.spec.ts
    - apps/tutorials/fixtures/getting-started/script.json
    - apps/tutorials/fixtures/getting-started/overrides.json
  modified: []

key-decisions:
  - "8-step Getting Started script covers dashboard, deals, deal detail, templates, settings, and integrations pages"
  - "Generic capture loop in spec iterates any script JSON -- not hardcoded to Getting Started"
  - "Screenshot naming uses 3-digit zero-padding (step-001.png) for alphabetical sort up to 999 steps"

patterns-established:
  - "Capture script: load script.json, start mock server, run Playwright spec, shut down -- all in finally block"
  - "Capture spec: beforeEach injects auth + route mocks, main test loops script.steps with navigate/wait/action/capture"
  - "Fixture overrides: per-tutorial overrides.json adds templates and interactions for populated UI state"

requirements-completed: [INFRA-07, CAPT-01, CAPT-02]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 62 Plan 03: Capture Orchestration & Getting Started Pilot Summary

**Capture orchestration script with mock server lifecycle, screenshot helper with deterministic step-NNN.png naming, and 8-step Getting Started tutorial driven by script JSON**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T00:20:42Z
- **Completed:** 2026-03-19T00:23:10Z
- **Tasks:** 2 of 3 (Task 3 is human verification checkpoint)
- **Files modified:** 5

## Accomplishments
- Capture orchestration script loads tutorial script JSON, validates with Zod, starts mock server, runs Playwright, and shuts down with proper error handling
- Screenshot helper produces deterministic zero-padded paths (output/getting-started/step-001.png) and calls prepareForScreenshot before each capture
- Getting Started pilot tutorial with 8 steps covering dashboard, deals pipeline, deal detail, templates, settings, and integrations
- Generic capture loop pattern in the Playwright spec works with any TutorialScript JSON -- not hardcoded to Getting Started
- Fixture overrides add 2 templates and 1 completed interaction for a populated-looking UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Build capture orchestration script and screenshot helper** - `019ab53` (feat)
2. **Task 2: AI-generate Getting Started pilot tutorial script and Playwright spec** - `c3799b8` (feat)

## Files Created/Modified
- `apps/tutorials/scripts/capture.ts` - CLI orchestration: loads script, starts mock server, runs Playwright, shuts down
- `apps/tutorials/src/helpers/screenshot.ts` - Screenshot capture with naming conventions and step metadata
- `apps/tutorials/capture/getting-started.spec.ts` - Playwright spec that captures Getting Started tutorial screenshots
- `apps/tutorials/fixtures/getting-started/script.json` - 8-step tutorial script for Getting Started pilot
- `apps/tutorials/fixtures/getting-started/overrides.json` - Tutorial-specific fixture overrides with templates and interactions

## Decisions Made
- 8-step Getting Started tutorial covers the core user journey: dashboard -> deals -> deal detail -> templates -> settings -> integrations -> back to dashboard
- Generic capture loop in the spec iterates script.steps with navigate/wait/action/capture -- reusable for any future tutorial
- Screenshot naming uses 3-digit zero-padding (step-001.png through step-999.png) for clean alphabetical sorting
- Capture script always shuts down mock server in finally block, even on Playwright failure

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None beyond what was documented in Plan 01 (.env.example with Supabase credentials).

## Checkpoint: Human Verification Pending

Task 3 is a `checkpoint:human-verify` gate. The human needs to:
1. Run `pnpm --filter tutorials capture getting-started`
2. Verify screenshots in `apps/tutorials/output/getting-started/`
3. Confirm deterministic output across multiple runs

## Next Phase Readiness
- Complete capture infrastructure ready for Phase 63 (additional tutorials)
- Generic capture loop means new tutorials only need a script.json and optional overrides.json
- All infrastructure from Plans 01-03 validated through module-level imports and schema validation tests

---
*Phase: 62-workspace-mock-infrastructure*
*Completed: 2026-03-19*
