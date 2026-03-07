---
status: awaiting_human_verify
trigger: "Template slide ingestion completes and shows Ready status, but slide count shows 0"
created: 2026-03-06T00:00:00Z
updated: 2026-03-06T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- ingestTemplate completes "successfully" even when all slides fail per-slide processing, resulting in slideCount=0 and lastIngestedAt being set (showing "Ready" status with 0 slides)
test: Code trace confirmed the issue
expecting: N/A -- root cause found
next_action: Implement fix

## Symptoms

expected: After ingesting a Google Slides template with ~100 slides, the template card should show "Ready" with 100 slides
actual: Template card shows "Ready" with 0 slides. The ingestion process appears to complete successfully but no slides are saved.
errors: No errors visible in browser console or server logs
reproduction: Add a template, trigger ingestion. It processes and shows "Ready" but slide count stays at 0.
started: Has NEVER worked — slide count has always been 0 after ingestion

## Eliminated

- hypothesis: Frontend displaying wrong count (UI bug)
  evidence: template-card.tsx line 275 directly renders template.slideCount from API; data flow is correct
  timestamp: 2026-03-06

- hypothesis: slideCount being overwritten after ingestion by staleness poll or clearStaleIngestions
  evidence: Only ingest-template.ts:312 writes to Template.slideCount. clearStaleIngestions only resets ingestionStatus/ingestionProgress. Staleness poll only updates sourceModifiedAt.
  timestamp: 2026-03-06

- hypothesis: computeMerge incorrectly categorizing slides
  evidence: For first ingestion, existingEmbeddings is empty, so all slides correctly go to "added" array. Code is correct.
  timestamp: 2026-03-06

- hypothesis: Raw SQL INSERT failing due to schema mismatch
  evidence: INSERT columns match the SlideEmbedding table schema. Same ::vector pattern is used successfully elsewhere (index.ts:1731). ON CONFLICT clause matches @@unique constraint.
  timestamp: 2026-03-06

## Evidence

- timestamp: 2026-03-06
  checked: ingest-template.ts line 305-314 (final slideCount calculation)
  found: slideCount = mergeResult.unchanged.length + processed. For first ingestion with all slides failing, this is 0+0=0. Yet lastIngestedAt is still set and ingestionStatus set to "idle", causing "Ready" status.
  implication: Bug is in the success/failure logic -- ingestion "succeeds" even when zero slides are processed

- timestamp: 2026-03-06
  checked: ingest-template.ts lines 152-235 (per-slide processing loop)
  found: Each slide is individually try/caught. Errors increment "skipped" (not "processed"). If ALL slides error (e.g., Vertex AI auth failure, LLM error), processed=0 and skipped=N. The outer function still completes successfully.
  implication: Per-slide errors are silently absorbed. The function needs to detect and surface total failure.

- timestamp: 2026-03-06
  checked: template-utils.ts getTemplateStatus function
  found: Returns "ready" when lastIngestedAt is set, ingestionStatus is "idle", and accessStatus is not "not_accessible". No check on slideCount > 0.
  implication: Even with slideCount=0, template shows "Ready" if lastIngestedAt is set

- timestamp: 2026-03-06
  checked: classify-metadata.ts and embed-slide.ts
  found: Both depend on Vertex AI (GoogleGenAI with vertexai:true). classifySlide uses model "openai/gpt-oss-120b-maas" with structured JSON output. generateEmbedding uses "text-embedding-005". Either failing would cause every slide to be skipped.
  implication: The underlying cause of slides being skipped is likely Vertex AI call failures, but the critical bug is that the ingestion code doesn't detect or report this scenario

## Resolution

root_cause: ingestTemplate function in ingest-template.ts marks ingestion as successful (sets lastIngestedAt, ingestionStatus: "idle") even when ALL slides fail during per-slide processing. The per-slide try/catch (lines 217-223) catches classification/embedding errors and increments "skipped" but the function still "completes" with slideCount=0. The frontend then sees lastIngestedAt set + ingestionStatus "idle" = "Ready" status, displaying 0 slides.
fix: Two changes applied -- (1) ingest-template.ts now throws when all slides fail per-slide processing, causing the template to be marked "failed" instead of "idle"/"ready". Also warns on partial failures. (2) template-utils.ts getTemplateStatus now returns "failed" when slideCount is 0 and ingestionStatus is "idle" (catches existing templates that were incorrectly marked as ready).
verification: Existing template-utils tests pass (22/22). Template-card and template-actions tests have pre-existing configuration failures unrelated to this change.
files_changed:
  - apps/agent/src/ingestion/ingest-template.ts
  - apps/web/src/lib/template-utils.ts
