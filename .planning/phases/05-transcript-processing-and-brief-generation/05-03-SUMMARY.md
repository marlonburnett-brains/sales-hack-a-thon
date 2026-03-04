---
phase: 05-transcript-processing-and-brief-generation
plan: 03
subsystem: workflow, ui
tags: [mastra, gemini, workflow, pillar-mapping, brief-generation, roi-framing, prisma, shadcn, touch-4]

# Dependency graph
requires:
  - phase: 05-transcript-processing-and-brief-generation
    provides: touch-4-workflow steps 1-3 (parseTranscript, validateFields, awaitFieldReview), FieldReview component, Touch 4 form
  - phase: 03-zod-schema-layer
    provides: SalesBriefLlmSchema, ROIFramingLlmSchema, TranscriptFieldsLlmSchema, zodToGeminiSchema
provides:
  - Complete 6-step touch-4-workflow (parse, validate, review, pillar mapping, ROI framing, persistence)
  - Gemini pillar mapping step selecting primary + secondary Lumenalta solution pillars with evidence
  - Gemini ROI framing step generating 2-3 quantifiable outcomes per use case
  - Database persistence for InteractionRecord, Transcript, Brief, and FeedbackSignal
  - BriefDisplay component with pillar badges, use case cards, and inline ROI outcomes
  - End-to-end Touch 4 flow: input -> extracting -> fieldReview -> generating -> briefResult
affects: [phase-06, phase-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [gemini-pillar-mapping, gemini-roi-enrichment, structured-brief-persistence, brief-card-display]

key-files:
  created:
    - apps/web/src/components/touch/brief-display.tsx
  modified:
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/web/src/components/touch/touch-4-form.tsx

key-decisions:
  - "Combined mapPillars and generateBrief into single Gemini call (mapPillarsAndGenerateBrief) for efficiency -- SalesBriefLlmSchema already includes pillar fields"
  - "ROI framing is a separate enrichment step so pillar mapping quality is not degraded by ROI generation in same prompt"
  - "Brief recordInteraction step outputs briefData and roiFramingData for immediate UI rendering without extra API call"

patterns-established:
  - "Gemini pillar mapping: SOLUTION_PILLARS provided as numbered list, reviewed fields as ground truth, no hallucinated capabilities"
  - "ROI enrichment: separate Gemini call takes use cases as input, generates 2-3 quantifiable outcomes with industry benchmarks"
  - "BriefDisplay merges roiFramingData into use case cards by matching useCaseName, with fallback to brief's roiOutcome"

requirements-completed: [TRANS-05, GEN-01, GEN-02, DATA-02]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 5 Plan 03: Brief Generation, ROI Framing, and Brief Display Summary

**Complete touch-4-workflow with Gemini pillar mapping, ROI framing enrichment, structured persistence (Transcript + Brief + FeedbackSignal), and BriefDisplay component with pillar badges and use case cards**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T02:03:51Z
- **Completed:** 2026-03-04T02:10:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Complete 6-step touch-4-workflow: parseTranscript -> validateFields -> awaitFieldReview -> mapPillarsAndGenerateBrief -> generateROIFraming -> recordInteraction
- Gemini 2.5 Flash pillar mapping selects primary pillar with evidence and secondary pillars from SOLUTION_PILLARS constant
- Gemini ROI framing generates 2-3 specific, quantifiable ROI outcome statements per use case with industry benchmarks
- Full database persistence: InteractionRecord, Transcript (with reviewed fields), Brief (with pillar data + use cases + ROI framing), FeedbackSignal
- BriefDisplay component renders structured cards: primary pillar highlight, secondary pillar badges, use case cards with ROI outcomes and value hypotheses
- Touch 4 form fully functional end-to-end: input -> extracting -> fieldReview -> generating -> briefResult with real brief display

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete touch-4-workflow with brief generation, ROI framing, and persistence steps** - `9c9d21b` (feat)
2. **Task 2: Brief display component and Touch 4 form completion** - `924bfd4` (feat)

## Files Created/Modified
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - Extended from 3 steps to 6: added mapPillarsAndGenerateBrief, generateROIFraming, recordInteraction; updated workflow chain and outputSchema
- `apps/web/src/components/touch/brief-display.tsx` - New component: primary pillar card with evidence, secondary pillar badges, use case cards with merged ROI outcomes and value hypotheses
- `apps/web/src/components/touch/touch-4-form.tsx` - Replaced briefResult placeholder with BriefDisplay; updated polling to extract briefData and roiFramingData from workflow completion

## Decisions Made
- Combined pillar mapping and brief generation into a single Gemini call (mapPillarsAndGenerateBrief) since SalesBriefLlmSchema already includes primaryPillar, secondaryPillars, and evidence fields -- avoids an extra API call
- Kept ROI framing as a separate enrichment step to keep prompts focused (pillar mapping quality + brief quality in one prompt, ROI depth in another)
- Workflow outputSchema includes briefData and roiFramingData so the UI can render immediately from the workflow completion response -- no separate API call needed (follows Touch 1 pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type casting for resume action result**
- **Found during:** Task 2 (Touch 4 form update)
- **Issue:** `result as Record<string, unknown>` failed type check because WorkflowRunResult type lacks index signature
- **Fix:** Changed to `result as unknown as Record<string, unknown>` for safe intermediate cast
- **Files modified:** apps/web/src/components/touch/touch-4-form.tsx
- **Verification:** Web build passes successfully
- **Committed in:** 924bfd4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal -- standard TypeScript strictness fix, no scope creep.

## Issues Encountered
None beyond the type casting fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 is now complete: all 3 plans delivered (data layer, workflow + field review, brief generation + display)
- Touch 4 end-to-end flow works: transcript paste -> field extraction -> seller review -> pillar mapping -> brief generation -> ROI framing -> structured persistence -> brief display
- Ready for Phase 6 (HITL brief approval checkpoint) which builds on the brief generated here
- Ready for Phase 7+ (slide generation) which can consume brief data from the Brief Prisma model

## Self-Check: PASSED

All 4 files verified (3 source + 1 summary). Both task commits (9c9d21b, 924bfd4) confirmed in git log. Artifact line counts verified: touch-4-workflow.ts (578 lines, min 250), brief-display.tsx (138 lines, min 60).

---
*Phase: 05-transcript-processing-and-brief-generation*
*Completed: 2026-03-04*
