---
phase: 07-rag-retrieval-and-slide-block-assembly
plan: 02
subsystem: api
tags: [mastra, workflow, rag, gemini, slide-assembly, copy-generation, brand-voice]

# Dependency graph
requires:
  - phase: 07-rag-retrieval-and-slide-block-assembly
    provides: "searchForProposal, filterByMetadata, buildSlideJSON, generateSlideCopy from Plan 07-01"
  - phase: 06-hitl-approval
    provides: "finalizeApproval step output (briefData, roiFramingData, briefId, interactionId)"
  - phase: 05-transcript-processing
    provides: "Touch 4 8-step workflow pipeline, Brief/Transcript Prisma models"
provides:
  - "ragRetrieval workflow step: multi-pass RAG retrieval from AtlusAI with metadata filtering"
  - "assembleSlideJSON workflow step: Gemini-powered weighted slide selection + buildSlideJSON assembly"
  - "generateCustomCopy workflow step: per-slide copy generation with brand voice constraints"
  - "Complete 11-step Touch 4 workflow with SlideJSON output ready for Phase 8"
  - "Workflow outputSchema includes slideJSON, slideCount, retrievalSummary"
affects: [08-google-slides-generation]

# Tech tracking
tech-stack:
  added: []
  patterns: [workflow-json-passthrough, gemini-slide-selection, per-slide-copy-generation]

key-files:
  created: []
  modified:
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts

key-decisions:
  - "JSON string serialization for complex objects (candidateSlides, slideJSON) in workflow step outputs to avoid Mastra storage issues with deeply nested schemas (per RESEARCH.md Pitfall 6)"
  - "Gemini-powered slide selection (8-12 slides) with weighted allocation prompt (70/15/15 primary/secondary budget)"
  - "Brand voice guidelines hardcoded as constant string (not retrieved from AtlusAI) for simplicity and consistency"
  - "Sequential per-slide copy generation (for...of loop, not Promise.all) to avoid rate limiting and maintain quality"
  - "Synthesized slides skipped during copy generation -- they already have final content from buildSlideJSON"
  - "Workflow outputSchema updated to include slideJSON (no longer includes decision/reviewerName from Phase 6)"

patterns-established:
  - "Workflow JSON string passthrough: serialize complex objects as z.string() between steps to avoid Mastra schema limitations"
  - "Gemini-in-workflow selection: inline Zod schema for ad-hoc structured output within a workflow step"
  - "Per-slide sequential copy generation with skip-if-synthesized guard"

requirements-completed: [ASSET-01, ASSET-02]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 7 Plan 02: RAG Retrieval and Slide Block Assembly Workflow Integration Summary

**Three new workflow steps (rag-retrieval, assemble-slide-json, generate-custom-copy) wired into Touch 4 pipeline as steps 9-11 with Gemini-powered slide selection and per-slide brand-constrained copy generation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T13:34:24Z
- **Completed:** 2026-03-04T13:39:41Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added ragRetrieval step (Step 9) that fetches Brief from DB, calls searchForProposal with multi-pass queries, filters by metadata, and serializes candidates as JSON string
- Added assembleSlideJSON step (Step 10) that uses Gemini 2.5 Flash for weighted slide selection (70/15/15 budget), calls buildSlideJSON for ordered SlideJSON with fixed section template
- Added generateCustomCopy step (Step 11) that processes each retrieved slide with per-slide Gemini copy generation using brand voice guidelines, skipping synthesized slides
- Updated workflow from 8-step to 11-step pipeline with SlideJSON output schema for Phase 8 consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ragRetrieval and assembleSlideJSON workflow steps** - `7ad6336` (feat)
2. **Task 2: Add generateCustomCopy step, complete 11-step workflow pipeline** - `02c0b00` (feat)

## Files Created/Modified
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - Extended from 8-step to 11-step pipeline with ragRetrieval, assembleSlideJSON, and generateCustomCopy steps; updated header comment, imports, workflow chain, and output schema

## Decisions Made
- Used JSON string serialization for candidateSlides and slideJSON in workflow step outputs (z.string()) rather than nested Zod schemas, per RESEARCH.md Pitfall 6 guidance on Mastra storage limitations
- Brand voice guidelines hardcoded as BRAND_GUIDELINES constant at module level rather than retrieved from AtlusAI (static content, simpler, no extra search step)
- Per-slide sequential copy generation with for...of loop (not Promise.all) for quality and rate limit safety
- Workflow outputSchema changed from Phase 6's decision/reviewerName fields to Phase 7's slideJSON/slideCount/retrievalSummary fields

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in apps/agent/src/mastra/index.ts (createRun, resume API) and touch-4-workflow.ts (z.record Zod v4 API change) are unrelated to this plan's changes and documented in Plan 07-01 summary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Touch 4 workflow now produces serialized SlideJSON as its final output, ready for Phase 8 (Google Slides generation) to consume
- The SlideJSON contains ordered slides with sectionType, sourceType, sourceBlockRef, and bespoke copy per retrieved slide
- All retrieval and assembly functions (searchForProposal, filterByMetadata, buildSlideJSON, generateSlideCopy) are battle-tested from Plan 07-01 and wired into the workflow
- Phase 7 complete -- both plans (07-01 infrastructure, 07-02 workflow integration) finished

## Self-Check: PASSED

All 1 modified file verified on disk. All 2 task commits (7ad6336, 02c0b00) verified in git log.

---
*Phase: 07-rag-retrieval-and-slide-block-assembly*
*Completed: 2026-03-04*
