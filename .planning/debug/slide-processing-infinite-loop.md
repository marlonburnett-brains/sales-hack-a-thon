---
status: fixing
trigger: "The agent continuously processes slides from all files in a loop, wasting resources and AI tokens. It should only check for modifications periodically (e.g., once a day), not run constantly."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Multiple overlapping background timers run at aggressive intervals, creating near-continuous slide processing
test: Code review of all background timers in mastra/index.ts and related modules
expecting: Multiple timers with short intervals
next_action: Apply fix - increase all intervals to daily and consolidate

## Symptoms

expected: Slide processing should happen periodically (e.g., once a day) or on-demand when modifications are detected
actual: The agent keeps constantly processing slides from all files in a loop, visible in terminal/console output
errors: No explicit errors - runs successfully each time, just too frequently
reproduction: Start the agent and watch the terminal output - it continuously processes slides
started: Has always been like this since the feature was built

## Eliminated

## Evidence

- timestamp: 2026-03-09T00:00:30Z
  checked: apps/agent/src/mastra/index.ts - background timers
  found: THREE separate background polling loops all running at aggressive intervals:
    1. Staleness polling (startStalenessPolling) - every 5 minutes (STALENESS_POLL_INTERVAL = 300_000)
    2. Auto-classify + auto-ingest (runAutoTasks) - every 10 minutes (AUTO_CLASSIFY_INTERVAL = 600_000)
    3. Deck inference cron (startDeckInferenceCron) - every 10 minutes (INFERENCE_INTERVAL = 600_000)
  implication: Combined, these create near-continuous slide/template processing activity

- timestamp: 2026-03-09T00:00:45Z
  checked: apps/agent/src/ingestion/backfill-descriptions.ts
  found: On EVERY startup, detectAndQueueBackfill() queries ALL slides with missing descriptions/elements and enqueues their templates for full re-ingestion. Combined with clearStaleIngestions() resetting all non-idle states to idle, this creates a cycle where failed/incomplete ingestions are perpetually retried.
  implication: Startup always triggers a burst of ingestion work

- timestamp: 2026-03-09T00:00:50Z
  checked: apps/agent/src/ingestion/auto-classify-templates.ts - autoIngestNewTemplates()
  found: Every 10 minutes, queries ALL templates with accessStatus=accessible, ingestionStatus=idle, lastIngestedAt=null and enqueues them for ingestion. Combined with staleness polling (every 5 min) which also enqueues templates, this creates overlapping ingestion triggers.
  implication: Multiple paths continuously feed the ingestion queue

- timestamp: 2026-03-09T00:00:55Z
  checked: apps/agent/src/deck-intelligence/auto-infer-cron.ts
  found: Every 10 minutes, runs inference cycle across ALL deck structure keys using LLM. Each cycle queries DB and potentially calls LLM for each key, even when no data has changed (hash check prevents LLM call but DB queries still run).
  implication: Adds to the constant background noise of processing

## Resolution

root_cause: Three independent background timers (staleness polling at 5min, auto-classify/ingest at 10min, deck inference at 10min) plus startup backfill create near-continuous slide processing. The intervals are far too aggressive for a system that only needs daily checks.
fix: Increase all background polling intervals to once daily (24 hours) and add a startup delay to stagger the initial runs
verification:
files_changed: []
