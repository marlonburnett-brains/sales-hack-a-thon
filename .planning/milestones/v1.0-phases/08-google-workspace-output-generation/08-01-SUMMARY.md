---
phase: 08-google-workspace-output-generation
plan: 01
subsystem: api
tags: [google-slides, google-docs, drive, deck-assembly, mastra, workflow]

# Dependency graph
requires:
  - phase: 07-rag-retrieval-and-slide-block-assembly
    provides: "SlideJSON with sectionType/sourceType from 11-step workflow output"
  - phase: 04-touch-1-3
    provides: "assembleFromTemplate, getOrCreateDealFolder, makePubliclyViewable, google-auth clients"
  - phase: 01-monorepo-foundation
    provides: "Google service account auth, Drive/Slides/Docs API scopes, env vars"
provides:
  - "createSlidesDeckFromJSON: hybrid deck assembly from SlideAssembly (template duplication + pageObjectIds text injection)"
  - "createGoogleDoc + buildDocRequests: Google Docs document builder with insert-then-style pattern"
  - "Step 12 (createSlidesDeck) wired into touch-4-workflow after generateCustomCopy"
  - "BuyerFaqLlmSchema Zod schema for Gemini FAQ generation (Plan 08-02)"
  - "Steps 13-14 (createTalkTrack, createBuyerFAQ) pre-wired in workflow (Plan 08-02 scope)"
affects: [09-pre-call-briefing-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [template-duplication-assembly, pageObjectIds-scoped-replaceAllText, insert-then-style-docs, per-slide-error-handling]

key-files:
  created:
    - apps/agent/src/lib/deck-assembly.ts
    - apps/agent/src/lib/doc-builder.ts
    - packages/schemas/llm/buyer-faq.ts
  modified:
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - packages/schemas/index.ts

key-decisions:
  - "Generic template slide fallback: all section types map to first template slide if no section-specific templates discovered via content scanning"
  - "Per-slide error handling: individual slide failures logged and skipped, not bubbled to crash entire deck generation"
  - "Template slide cleanup only when content slides exist: prevents deleting all slides if no content slides were created"
  - "Steps 13-14 pre-wired from context gathering: included in Task 2 commit to keep workflow file compilable (BuyerFaqLlmSchema import already present)"

patterns-established:
  - "Template duplication assembly: copy branded template, duplicate template slides per section, inject via scoped replaceAllText, clean up originals"
  - "Insert-then-style Docs pattern: single insertText at index 1, then apply heading/bold styles via updateParagraphStyle/updateTextStyle"
  - "Per-slide error containment: try/catch per slide in deck assembly for graceful degradation"

requirements-completed: [ASSET-03]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 8 Plan 01: Google Slides Deck Assembly Summary

**Deck assembly engine (createSlidesDeckFromJSON) with template duplication, pageObjectIds-scoped text injection, and Step 12 wired into 14-step Touch 4 workflow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T15:42:07Z
- **Completed:** 2026-03-04T15:46:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created deck-assembly.ts with createSlidesDeckFromJSON: copies branded template, discovers template slides via presentations.get(), duplicates per section type, injects bespoke copy via pageObjectIds-scoped replaceAllText, cleans up originals, makes publicly viewable
- Created doc-builder.ts with createGoogleDoc and buildDocRequests: insert-all-text-then-style pattern for Google Docs API, handles heading levels and bold ranges
- Wired Step 12 (createSlidesDeck) into touch-4-workflow after generateCustomCopy: fetches brief/deal/company from DB, creates per-deal folder, calls createSlidesDeckFromJSON, returns deckUrl
- Added BuyerFaqLlmSchema to packages/schemas for Plan 08-02 consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deck-assembly.ts and doc-builder.ts libraries** - `42398e5` (feat)
2. **Task 2: Wire createSlidesDeck as Step 12 in touch-4-workflow** - `295e1e2` (feat)

## Files Created/Modified
- `apps/agent/src/lib/deck-assembly.ts` - Deck assembly engine: createSlidesDeckFromJSON with template duplication, text injection, per-slide error handling
- `apps/agent/src/lib/doc-builder.ts` - Google Docs builder: createGoogleDoc + buildDocRequests with insert-then-style pattern
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - Steps 12-14 added, workflow chain extended, outputSchema updated with deckUrl/talkTrackUrl/faqUrl/dealFolderId
- `packages/schemas/llm/buyer-faq.ts` - BuyerFaqLlmSchema Zod schema for Gemini FAQ structured output
- `packages/schemas/index.ts` - Barrel export for BuyerFaqLlmSchema

## Decisions Made
- Generic template slide fallback: when the branded template deck lacks section-specific slides, all section types fall back to the first available template slide. Template content scanning attempts to match by keyword (title, problem, case study, roi, capability, next step) but gracefully defaults.
- Per-slide error handling: each slide is processed in its own try/catch block. A single slide failure is logged and skipped rather than crashing the entire deck generation. This is critical for production resilience.
- Steps 13-14 were pre-wired into the workflow during context gathering. Since the workflow file already imported BuyerFaqLlmSchema and Step 12 references needed to compile alongside 13/14, they were included in the Task 2 commit to maintain a compilable state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] doc-builder.ts and workflow steps pre-existing from context gathering**
- **Found during:** Task 1 and Task 2
- **Issue:** doc-builder.ts, buyer-faq.ts, and workflow steps 12-14 with imports were already written to disk during Phase 8 context gathering (before this plan execution)
- **Fix:** Verified existing code matches plan requirements, committed as-is rather than overwriting. Included all pre-existing changes in appropriate task commits.
- **Files modified:** apps/agent/src/lib/doc-builder.ts, apps/agent/src/mastra/workflows/touch-4-workflow.ts, packages/schemas/llm/buyer-faq.ts, packages/schemas/index.ts
- **Verification:** TypeScript compilation confirms no new errors in any of these files
- **Committed in:** 42398e5 (Task 1), 295e1e2 (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Pre-existing code from context gathering was production-quality and matched plan spec. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in apps/agent/src/mastra/index.ts (createRun/resume API) and touch-4-workflow.ts line 62 (z.record Zod v4 API change) are unrelated to this plan's changes and documented since Plan 07-01.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Step 12 (createSlidesDeck) is fully wired and ready for end-to-end testing when Google Workspace API access is available
- doc-builder.ts is ready for Plan 08-02 to consume via createGoogleDoc
- Steps 13-14 (createTalkTrack, createBuyerFAQ) are already implemented in the workflow file, Plan 08-02 execution may focus on verification and any refinements
- BuyerFaqLlmSchema is available in @lumenalta/schemas barrel export
- Workflow outputSchema includes deckUrl, talkTrackUrl, faqUrl, slideCount, dealFolderId for Phase 9 UI consumption

## Self-Check: PASSED

All 5 created/modified files verified on disk. All 2 task commits (42398e5, 295e1e2) verified in git log.

---
*Phase: 08-google-workspace-output-generation*
*Completed: 2026-03-04*
