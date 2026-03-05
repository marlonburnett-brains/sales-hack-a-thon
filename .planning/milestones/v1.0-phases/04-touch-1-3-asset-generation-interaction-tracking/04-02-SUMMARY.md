---
phase: 04-touch-1-3-asset-generation-interaction-tracking
plan: "02"
subsystem: api
tags: [google-slides, google-drive, gemini, atlusai, slide-selection, deck-assembly, ingestion, rag]

# Dependency graph
requires:
  - phase: 01-03
    provides: Google Slides API spike patterns (copy template, read objectIds, batchUpdate)
  - phase: 02-01
    provides: AtlusAI ingestion client (ingestDocument), slide extractor (extractSlidesFromPresentation)
  - phase: 03-01
    provides: IntroDeckSelectionLlmSchema, CapabilityDeckSelectionLlmSchema, zodToGeminiSchema
provides:
  - apps/agent/src/lib/atlusai-search.ts: Drive API fallback for searching ingested slide content
  - apps/agent/src/lib/slide-selection.ts: AI-driven slide selection using Gemini 2.5 Flash with LLM schemas
  - apps/agent/src/lib/deck-customizer.ts: Salesperson/customer customization injection and copy-and-prune assembly
  - apps/agent/src/lib/ingestion-pipeline.ts: Re-ingestion of generated/approved decks into AtlusAI knowledge base
affects: [04-03-touch-workflows, 08-output-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drive API fullText search as AtlusAI MCP fallback for slide content retrieval"
    - "Copy-and-prune assembly: files.copy source -> deleteObject unwanted -> updateSlidesPosition to reorder"
    - "Template merge via replaceAllText ({{salesperson-name}}, {{customer-name}}) + replaceAllShapesWithImage ({{salesperson-photo}}, {{customer-logo}})"
    - "Generated deck re-ingestion with decision signal metadata (approved/edited/overridden) for knowledge base growth"

key-files:
  created:
    - apps/agent/src/lib/atlusai-search.ts
    - apps/agent/src/lib/slide-selection.ts
    - apps/agent/src/lib/deck-customizer.ts
    - apps/agent/src/lib/ingestion-pipeline.ts
  modified: []

key-decisions:
  - "Drive API fullText search used as AtlusAI MCP fallback since MCP tools require Claude Code auth and cannot be called from standalone Node.js"
  - "Copy-and-prune strategy for deck assembly (copy entire source, delete unwanted slides, reorder remaining) preserves original formatting perfectly"
  - "makePubliclyViewable inlined in deck-customizer.ts since drive-folders.ts (Plan 04-01) not yet created; refactor to import when 04-01 executes"
  - "All decision outcomes (approved, edited, overridden) are ingested into AtlusAI with decision signal metadata for weighted positive/negative examples"
  - "Generated deck document IDs use 'generated:' namespace prefix to avoid collisions with original library content"

patterns-established:
  - "AtlusAI search pattern: find ingestion folder -> fullText search Google Docs -> export text/plain -> parse slide content and speaker notes sections"
  - "Gemini slide selection pattern: search candidates -> build contextual prompt with candidate list -> zodToGeminiSchema for responseJsonSchema -> parse with Zod"
  - "Cross-touch continuity: priorTouchOutputs parameter included in Gemini prompt for consistent slide selection across touch points"
  - "Deck customization: tagged placeholder shapes ({{salesperson-name}}, {{customer-name}}, {{salesperson-photo}}, {{customer-logo}}) swapped via batchUpdate"

requirements-completed: [TOUCH2-02, TOUCH2-03, TOUCH3-02, TOUCH3-03, DATA-04]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 4 Plan 02: Slide Selection & Assembly Engine Summary

**AI-driven slide selection via Gemini 2.5 Flash with Drive API search fallback, copy-and-prune deck assembly with salesperson/customer customization injection, and AtlusAI re-ingestion pipeline for knowledge base growth**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T00:19:42Z
- **Completed:** 2026-03-04T00:25:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- AtlusAI search wrapper that queries ingested slide documents via Drive API fullText search, parsing document titles and descriptions for metadata extraction
- AI-driven slide selection engine using Gemini 2.5 Flash with IntroDeckSelectionLlmSchema (Touch 2) and CapabilityDeckSelectionLlmSchema (Touch 3), including cross-touch continuity via priorTouchOutputs
- Deck customizer with copy-and-prune assembly strategy (copy source, delete unwanted, reorder, apply branding) and salesperson/customer customization via replaceAllText + replaceAllShapesWithImage
- AtlusAI re-ingestion pipeline that extracts slide content from generated decks and ingests with decision signal metadata (approved/edited/overridden + generatedBy attribution)

## Task Commits

Each task was committed atomically:

1. **Task 1: AtlusAI search wrapper and AI-driven slide selection engine** - `c6656cb` (feat)
2. **Task 2: Deck customizer, cross-presentation assembly, and AtlusAI re-ingestion pipeline** - `d4fdfbf` (feat)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified

- `apps/agent/src/lib/atlusai-search.ts` - Drive API fallback search for ingested slide content; exports searchSlides, searchByCapability, SlideSearchResult interface
- `apps/agent/src/lib/slide-selection.ts` - Gemini 2.5 Flash slide selection with IntroDeckSelectionLlmSchema and CapabilityDeckSelectionLlmSchema; exports selectSlidesForDeck
- `apps/agent/src/lib/deck-customizer.ts` - Salesperson/customer customization injection and copy-and-prune deck assembly; exports applyDeckCustomizations, assembleDeckFromSlides
- `apps/agent/src/lib/ingestion-pipeline.ts` - AtlusAI re-ingestion for generated decks with deal context metadata; exports ingestGeneratedDeck, shouldIngest

## Decisions Made

- **Drive API search as MCP fallback:** AtlusAI MCP tools require Claude Code's internal auth (SSE endpoint returns 401 for standalone scripts). The Drive API fullText search against the _slide-level-ingestion folder provides equivalent functionality since all ingested content exists as Google Docs.
- **Copy-and-prune assembly strategy:** Per Research recommendation, copying the entire source presentation and deleting unwanted slides preserves original formatting perfectly. This handles 90% of cases; multi-source assembly (slides from multiple presentations) is documented but deferred to Phase 8.
- **Inline makePubliclyViewable:** The `drive-folders.ts` module (Plan 04-01) has not been created yet. Since deck-customizer needs to make assembled decks publicly viewable for iframe preview, the function was inlined with a clear comment for future refactoring.
- **Generated document ID namespace:** Uses `generated:` prefix in SHA-256 input to avoid ID collisions with original library content, ensuring re-ingested slides don't overwrite source material.
- **All outcomes ingested:** shouldIngest returns true for approved, edited, and overridden decisions, per the locked decision that approved AI pagers are positive examples.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inlined makePubliclyViewable from missing drive-folders.ts**
- **Found during:** Task 2 (deck-customizer.ts assembly function)
- **Issue:** Plan references `makePubliclyViewable` from `drive-folders.ts` (created in Plan 04-01), but Plan 04-01 has not been executed yet
- **Fix:** Inlined the `makePubliclyViewable` function directly in deck-customizer.ts with a comment noting it should be refactored to import from drive-folders.ts when Plan 04-01 is executed
- **Files modified:** apps/agent/src/lib/deck-customizer.ts
- **Verification:** TypeScript compiles cleanly; function uses the same Drive permissions.create pattern documented in Research
- **Committed in:** d4fdfbf (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to handle missing dependency from unexecuted Plan 04-01. No scope creep. Function will be deduplicated when 04-01 creates drive-folders.ts.

## Issues Encountered

- Pre-existing TypeScript errors in `src/ingestion/discover-content.ts`, `src/ingestion/run-ingestion.ts`, `src/mastra/index.ts`, and `packages/schemas/app/` were present before execution and are unrelated to this plan. All four new modules compile without errors.

## User Setup Required

None - no external service configuration required. The modules use existing GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID, and GEMINI_API_KEY environment variables.

## Next Phase Readiness

- All four library modules are generic (no Touch-specific logic) and ready for consumption by Plan 04-03 (Touch 2/3 workflow wiring)
- The shared slide assembly engine (deck-customizer.ts) handles both single-source copy-and-prune and documents the multi-source limitation for Phase 8
- AtlusAI re-ingestion pipeline is ready to be called after any deck approval/override/edit decision
- slide-selection.ts provides cross-touch continuity via priorTouchOutputs parameter

## Self-Check: PASSED

- `apps/agent/src/lib/atlusai-search.ts` exists on disk (committed at c6656cb)
- `apps/agent/src/lib/slide-selection.ts` exists on disk (committed at c6656cb)
- `apps/agent/src/lib/deck-customizer.ts` exists on disk (committed at d4fdfbf)
- `apps/agent/src/lib/ingestion-pipeline.ts` exists on disk (committed at d4fdfbf)
- Commit c6656cb verified in git log
- Commit d4fdfbf verified in git log
- No TypeScript errors in any of the four new modules

---
*Phase: 04-touch-1-3-asset-generation-interaction-tracking*
*Completed: 2026-03-04*
