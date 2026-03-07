---
phase: quick-11
plan: 01
subsystem: ingestion
tags: [background-tasks, llm-classification, auto-ingest, cron]
key-files:
  created:
    - apps/agent/src/ingestion/auto-classify-templates.ts
  modified:
    - apps/agent/src/mastra/index.ts
decisions:
  - Used Vertex AI Gemini 2.0 Flash (same auth pattern as classify-metadata.ts)
  - 30-second initial delay to avoid startup contention with staleness poll
  - Auto-ingest runs before auto-classify so newly ingested templates get classified in next cycle
metrics:
  duration: 109s
  completed: "2026-03-07T18:07:28Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 11: Add Periodic Cron Job for Automatic Slide Classification

Periodic background job that auto-classifies ingested templates as "template" or "example" using Vertex AI Gemini 2.0 Flash and auto-enqueues accessible never-ingested templates for ingestion.

## Commits

| # | Hash | Message | Files |
|---|------|---------|-------|
| 1 | cef888c | feat(quick-11): add auto-classify and auto-ingest background module | auto-classify-templates.ts |
| 2 | 24c7b7e | feat(quick-11): wire auto-classify/ingest timer into agent startup | index.ts |

## What Was Built

### auto-classify-templates.ts (new)

Two exported async functions:

- **`autoClassifyTemplates()`** - Finds templates with null contentClassification that have been ingested. Loads first 3 slides from SlideEmbedding, sends to Gemini 2.0 Flash with structured output to classify as "template" or "example" and infer touchTypes. Updates template record via Prisma. 500ms rate limiting between LLM calls.

- **`autoIngestNewTemplates()`** - Finds accessible templates with idle ingestionStatus that have never been ingested (lastIngestedAt is null). Enqueues each via ingestionQueue.

### index.ts (modified)

Added periodic timer registration after existing staleness polling:
- AUTO_CLASSIFY_INTERVAL: 10 minutes
- AUTO_CLASSIFY_INITIAL_DELAY: 30 seconds
- Runs autoIngestNewTemplates first, then autoClassifyTemplates
- Purely additive -- no existing code modified

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- New file compiles without errors (no tsc errors referencing auto-classify-templates.ts)
- Existing staleness polling code unchanged (diff is purely additive)
- Both functions exported and imported correctly
- Timer registered at agent startup with proper logging

## Self-Check: PASSED
