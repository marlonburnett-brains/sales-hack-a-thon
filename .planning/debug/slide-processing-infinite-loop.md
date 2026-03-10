---
status: awaiting_human_verify
trigger: "The agent continuously processes slides from all files in a loop, wasting resources and AI tokens. It should only check for modifications periodically (e.g., once a day), not run constantly."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:03:30Z
---

## Current Focus

hypothesis: CONFIRMED - Two-tier approach applied: frequent for new content, daily for re-checking existing
test: Verify agent behavior after restart
expecting: New templates still discovered quickly (10min), but staleness/inference only runs daily
next_action: Await human verification

## Symptoms

expected: Slide processing should happen periodically (e.g., once a day) or on-demand when modifications are detected
actual: The agent keeps constantly processing slides from all files in a loop, visible in terminal/console output
errors: No explicit errors - runs successfully each time, just too frequently
reproduction: Start the agent and watch the terminal output - it continuously processes slides
started: Has always been like this since the feature was built

## Eliminated

- hypothesis: Blanket 24h on all timers
  evidence: User clarified that new/uningested content should be processed ASAP (10min polling fine), only re-checking already-ingested content should be daily
  timestamp: 2026-03-09T00:02:30Z

## Evidence

- timestamp: 2026-03-09T00:00:30Z
  checked: apps/agent/src/mastra/index.ts - background timers
  found: THREE separate background polling loops:
    1. Staleness polling - checks already-ingested templates for updates (was 5min)
    2. Auto-classify + auto-ingest - discovers NEW templates + classifies (was 10min)
    3. Deck inference cron - re-infers deck structure from existing data (was 10min)
  implication: #1 and #3 are re-processing existing content (should be daily), #2 discovers new content (should stay frequent)

- timestamp: 2026-03-09T00:02:30Z
  checked: User feedback on blanket 24h fix
  found: Two-tier requirement confirmed

- timestamp: 2026-03-09T00:03:00Z
  checked: Applied two-tier fix and ran tests
  found: auto-infer-cron.test.ts 3/3 passed
  implication: Fix is safe

## Resolution

root_cause: Staleness polling (every 5min) and deck inference (every 10min) re-process already-ingested content far too frequently, creating near-continuous processing alongside the auto-classify/ingest timer.
fix: Two-tier approach:
  - Auto-classify/ingest (new content discovery): kept at 10min -- finds and processes new templates quickly
  - Staleness polling (re-checks already-ingested content for Drive modifications): changed from 5min to 24h
  - Deck inference cron (re-infers deck structure from existing data): changed from 10min to 24h
  - Staleness initial delay: changed from 10s to 1min (less startup pressure)
verification: Tests pass. Awaiting user verification.
files_changed:
  - apps/agent/src/mastra/index.ts (STALENESS_POLL_INTERVAL 300_000->86_400_000, STALENESS_INITIAL_DELAY 10_000->60_000, log messages updated)
  - apps/agent/src/deck-intelligence/auto-infer-cron.ts (INFERENCE_INTERVAL 600_000->86_400_000, log message updated)
