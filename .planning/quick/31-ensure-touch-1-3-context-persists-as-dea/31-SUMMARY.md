---
phase: quick-31
plan: 01
subsystem: generation
tags: [context-persistence, deal-context, touch-workflows]
dependency_graph:
  requires: [DealContextSource model, InteractionRecord]
  provides: [touch-1-3-context-persistence, broadened-transcript-insights]
  affects: [deck-generation-pipeline, queryTranscriptInsights]
tech_stack:
  patterns: [conditional-persist-after-create, broadened-prisma-filter]
key_files:
  created: []
  modified:
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-2-workflow.ts
    - apps/agent/src/mastra/workflows/touch-3-workflow.ts
    - apps/agent/src/generation/route-strategy.ts
decisions:
  - Persist context as sourceType "note" (not "transcript") to distinguish user-provided context from extracted transcripts
  - Guard persistence with trim check to avoid empty DealContextSource records
metrics:
  duration: 2 min
  completed: "2026-03-13T11:37:07Z"
  tasks: 2
  files: 4
---

# Quick Task 31: Ensure Touch 1-3 Context Persists as DealContextSource

Context input strings from touch 1-3 workflows now persist as DealContextSource records with sourceType "note", and queryTranscriptInsights includes note/upload sources with an increased limit of 5.

## What Changed

### Task 1: Persist context as DealContextSource in touch 1-3 workflows (02c763f)

Added `prisma.dealContextSource.create()` calls in all three touch workflows immediately after `InteractionRecord` creation. Each persists the user-provided `context` string as a DealContextSource record with:
- `sourceType: "note"` -- distinguishes from transcript-extracted and file-uploaded sources
- `touchType: "touch_1"` / `"touch_2"` / `"touch_3"` -- identifies origin workflow
- `interactionId` -- linked to the InteractionRecord for traceability
- `status: "saved"` -- immediately available for downstream queries
- Guard: only creates when `context` is non-empty after trim

### Task 2: Broaden queryTranscriptInsights filter and increase limit (a6a2b80)

Two changes in `route-strategy.ts`:
1. `MAX_TRANSCRIPT_INSIGHTS` increased from 3 to 5
2. DealContextSource query filter broadened from `sourceType: "transcript"` to `sourceType: { in: ["transcript", "note", "upload"] }`

This ensures context saved by touch workflows (note), deal chat (note), and file uploads (upload) all flow into the deck generation pipeline alongside transcript-extracted insights.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- TypeScript compilation: No new errors in modified files (pre-existing errors in unrelated files)
- `dealContextSource.create` confirmed in all three touch workflow files
- Broadened filter confirmed: `sourceType: { in: ["transcript", "note", "upload"] }`
- Increased limit confirmed: `MAX_TRANSCRIPT_INSIGHTS = 5`

## Self-Check: PASSED

- [x] apps/agent/src/mastra/workflows/touch-1-workflow.ts modified with dealContextSource.create
- [x] apps/agent/src/mastra/workflows/touch-2-workflow.ts modified with dealContextSource.create
- [x] apps/agent/src/mastra/workflows/touch-3-workflow.ts modified with dealContextSource.create
- [x] apps/agent/src/generation/route-strategy.ts modified with broadened filter and limit=5
- [x] Commit 02c763f exists
- [x] Commit a6a2b80 exists
