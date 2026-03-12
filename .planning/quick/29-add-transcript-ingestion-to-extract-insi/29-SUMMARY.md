---
phase: quick-29
plan: 01
subsystem: generation-pipeline
tags: [transcript, deal-context, modification-planner, deck-generation]
dependency_graph:
  requires: [DealContext, buildDealContext, modification-planner]
  provides: [TranscriptInsight type, transcript-aware modification planner]
  affects: [touch-1-workflow, touch-2-workflow, touch-3-workflow, touch-4-workflow, regenerate-stage]
tech_stack:
  added: []
  patterns: [async-deal-context, transcript-insight-injection, graceful-fallback]
key_files:
  created: []
  modified:
    - packages/schemas/generation/types.ts
    - packages/schemas/index.ts
    - apps/agent/src/generation/route-strategy.ts
    - apps/agent/src/generation/modification-planner.ts
    - apps/agent/src/generation/structure-driven-workflow.ts
    - apps/agent/src/lib/regenerate-stage.ts
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-2-workflow.ts
    - apps/agent/src/mastra/workflows/touch-3-workflow.ts
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/agent/src/generation/__tests__/route-strategy.test.ts
    - apps/agent/src/generation/__tests__/blueprint-resolver.test.ts
    - apps/agent/src/generation/__tests__/section-matcher.test.ts
    - apps/agent/src/generation/__tests__/structure-driven-workflow.test.ts
decisions:
  - "TranscriptInsight source field uses 'transcript' | 'context_source' to distinguish touch-4 pipeline vs deal-chat origins"
  - "DealContextSource transcripts map refinedText/rawText to customerContext field with empty strings for other structured fields"
  - "Transcript insight fields truncated to 300 chars in prompt to avoid bloat (vs 500 for element content)"
  - "Maximum 3 transcript insights per deal context, sorted newest first"
metrics:
  duration: "5 min"
  completed: "2026-03-12"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 14
---

# Quick Task 29: Add Transcript Ingestion to Deck Generation

Enriched DealContext with transcript insights from Transcript and DealContextSource records so touches 2/3 produce slide content grounded in actual customer conversation data (pain points, business outcomes, stakeholders).

## What Changed

### Task 1: TranscriptInsight type and async buildDealContext
- Added `TranscriptInsight` interface to shared schemas with source, customerContext, businessOutcomes, constraints, stakeholders, timeline, budget fields
- Added required `transcriptInsights: TranscriptInsight[]` field to `DealContext`
- Made `buildDealContext` async -- queries `Transcript` (touch-4 pipeline) and `DealContextSource` (deal chat) records in parallel
- Combines both sources sorted newest first, limited to 3 insights
- Graceful fallback: returns empty array on query failure
- Updated all 8 callers across touch workflows, regenerate-stage, and structure-driven-workflow to `await`
- Updated 4 test files with the new required field
- Commit: `e1c8cee`

### Task 2: Transcript-aware modification planner prompt
- Added `formatTranscriptInsights` helper that renders a "Transcript Insights" section with customer context, business outcomes, constraints, stakeholders, timeline, and budget
- Each insight field truncated to 300 chars to prevent prompt bloat
- Section inserted after Deal Context and before Approved Draft Content in the LLM prompt
- No empty section rendered when `transcriptInsights` is empty (clean fallback)
- Commit: `86c4fda`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing transcriptInsights in DealContext literals across codebase**
- **Found during:** Task 1
- **Issue:** Adding required `transcriptInsights` field to DealContext broke all existing DealContext object literals in tests and source files
- **Fix:** Added `transcriptInsights: []` to all DealContext fixtures in blueprint-resolver.test.ts, section-matcher.test.ts, structure-driven-workflow.test.ts, route-strategy.test.ts, and structure-driven-workflow.ts
- **Files modified:** 5 test/source files
- **Commit:** e1c8cee

**2. [Rule 3 - Blocking] Fixed missing await in regenerate-stage.ts**
- **Found during:** Task 1
- **Issue:** `regenerate-stage.ts` also calls `buildDealContext` but was not listed in the plan's scope
- **Fix:** Added `await` to both call sites in regenerate-stage.ts
- **Files modified:** apps/agent/src/lib/regenerate-stage.ts
- **Commit:** e1c8cee

## Verification

- TypeScript compilation: No new errors introduced (pre-existing implicit-any errors unchanged)
- All related tests pass (structure-driven-workflow, section-matcher, blueprint-resolver)
- route-strategy tests have pre-existing env validation failure (unrelated to this change)

## Self-Check: PASSED

All 14 modified files verified present. Both commits verified in git log.
