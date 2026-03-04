---
phase: 04-touch-1-3-asset-generation-interaction-tracking
plan: "03"
subsystem: workflow, ui, api
tags: [mastra, google-slides, google-drive, gemini, next.js, server-actions, shadcn-ui, lucide-react]

# Dependency graph
requires:
  - phase: 04-01
    provides: "Prisma models (Company, Deal, InteractionRecord, FeedbackSignal), deals dashboard, Touch 1 workflow, CRUD API routes, Server Actions proxy pattern, three-state form pattern"
  - phase: 04-02
    provides: "Shared slide selection engine (selectSlidesForDeck), deck assembly (assembleDeckFromSlides), deck customizer (applyDeckCustomizations), AtlusAI re-ingestion pipeline (ingestGeneratedDeck)"
provides:
  - "Touch 2 Mastra workflow (selectSlides -> assembleDeck -> recordInteraction) for Meet Lumenalta intro deck generation"
  - "Touch 3 Mastra workflow (selectSlides -> assembleDeck -> recordInteraction) for capability alignment deck generation"
  - "Touch 2 web form with pre-filled deal data, generation progress, and iframe preview"
  - "Touch 3 web form with capability area multi-select, generation progress, and iframe preview"
  - "All three Touch flow cards active on deal page (no more 'Coming soon')"
  - "Cross-touch context passing from prior interactions to new generation requests"
  - "Server Actions and API client functions for Touch 2/3 workflow invocation"
affects: [05-transcript-processing, 08-google-workspace-output, 11-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct end-to-end generation: Touch 2/3 AI selects slides and assembles final deck without intermediate review step (unlike Touch 1 two-step)"
    - "Regeneration creates new InteractionRecord and new Drive file; old versions preserved"
    - "Cross-touch continuity: priorTouchOutputs passed from earlier interactions to AI slide selection"
    - "Capability area multi-select with predefined Lumenalta capability list (10 areas)"

key-files:
  created:
    - apps/agent/src/mastra/workflows/touch-2-workflow.ts
    - apps/agent/src/mastra/workflows/touch-3-workflow.ts
    - apps/web/src/components/touch/touch-2-form.tsx
    - apps/web/src/components/touch/touch-3-form.tsx
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/env.ts
    - apps/web/src/app/deals/[dealId]/page.tsx
    - apps/web/src/components/touch/touch-flow-card.tsx
    - apps/web/src/lib/actions/touch-actions.ts
    - apps/web/src/lib/api-client.ts

key-decisions:
  - "Touch 2/3 use direct end-to-end generation (no intermediate slide review) per locked decision -- seller reviews final deck via iframe preview"
  - "Regeneration creates new versions (new InteractionRecord + new Drive file) while preserving old versions"
  - "Cross-touch context flows from prior interactions via priorTouchOutputs parameter to Gemini slide selection"
  - "Ten predefined Lumenalta capability areas for Touch 3 selector (Data Engineering, Cloud Migration, AI/ML, Digital Transformation, Product Development, DevOps, Analytics, Cybersecurity, IoT, Blockchain)"

patterns-established:
  - "Two-state form pattern (input/result) for direct-generation touch flows (vs three-state input/review/result for Touch 1)"
  - "Regeneration UX: 'Regenerate with Different Inputs' button returns to pre-filled form; each regeneration is a new interaction"
  - "Capability area multi-select with badge-based selection UI"

requirements-completed: [TOUCH2-01, TOUCH2-04, TOUCH3-01, TOUCH3-04, DATA-01]

# Metrics
duration: 8min
completed: 2026-03-04
---

# Phase 4 Plan 03: Touch 2/3 Flows Summary

**Touch 2 intro deck and Touch 3 capability deck Mastra workflows with AI slide selection, deck assembly, Drive output, web UI forms with capability area selector, and cross-touch context continuity**

## Performance

- **Duration:** 8 min (across 2 executor sessions with checkpoint approval)
- **Started:** 2026-03-04T00:47:00Z
- **Completed:** 2026-03-04T01:00:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 10

## Accomplishments
- Touch 2 Mastra workflow with three chained steps (selectSlides, assembleDeck, recordInteraction) using shared assembly engine for Meet Lumenalta intro deck generation with salesperson/customer customization
- Touch 3 Mastra workflow with same pattern plus capabilityAreas parameter for capability alignment deck generation from predefined list of 10 Lumenalta capability areas
- Touch 2 web form with pre-filled company/industry from deal, salesperson name/photo, customer logo URL, additional context textarea, and generation progress with iframe preview
- Touch 3 web form with capability area multi-select (1-2 areas), additional context, and same generation/preview pattern
- All three Touch flow cards now active on deal page with functional Generate buttons (no more "Coming soon" on Touch 2/3)
- Cross-touch context passing: prior interaction outputs fed to AI slide selection for industry-aligned continuity
- Server Actions and API client additions for Touch 2/3 workflow invocation via agent service
- Both workflows registered in Mastra instance alongside Touch 1

## Task Commits

Each task was committed atomically:

1. **Task 1: Touch 2 and Touch 3 Mastra workflows with interaction recording** - `370b6f1` (feat)
2. **Task 2: Touch 2/3 web UI forms, Server Actions, and deal page integration** - `67cabcc` (feat)
3. **Task 3: Verify Touch 2 and Touch 3 end-to-end flows** - checkpoint approved (no commit)

## Files Created/Modified

**Agent app (backend):**
- `apps/agent/src/mastra/workflows/touch-2-workflow.ts` - Touch 2 Mastra workflow with selectSlides, assembleDeck, recordInteraction steps using shared assembly engine
- `apps/agent/src/mastra/workflows/touch-3-workflow.ts` - Touch 3 Mastra workflow with same pattern plus capabilityAreas parameter for capability-specific slide selection
- `apps/agent/src/mastra/index.ts` - Touch 2 and Touch 3 workflow registration
- `apps/agent/src/env.ts` - MEET_LUMENALTA_PRESENTATION_ID and CAPABILITY_DECK_PRESENTATION_ID env vars added

**Web app (frontend):**
- `apps/web/src/components/touch/touch-2-form.tsx` - Touch 2 input form with salesperson/customer fields, generation progress, iframe preview, regenerate button
- `apps/web/src/components/touch/touch-3-form.tsx` - Touch 3 input form with capability area multi-select (10 areas), generation progress, iframe preview
- `apps/web/src/components/touch/touch-flow-card.tsx` - All three Touch cards now active (removed "Coming soon" state for Touch 2/3)
- `apps/web/src/app/deals/[dealId]/page.tsx` - Deal page integration for Touch 2/3 form toggling
- `apps/web/src/lib/actions/touch-actions.ts` - generateTouch2DeckAction, generateTouch3DeckAction Server Actions
- `apps/web/src/lib/api-client.ts` - startTouch2Workflow, startTouch3Workflow API client functions

## Decisions Made
- Touch 2/3 use direct end-to-end generation without intermediate slide review per locked context decision -- seller reviews the final deck via embedded iframe preview and can regenerate with tweaked inputs
- Regeneration creates new versions (new InteractionRecord + new Drive file) while old versions remain accessible in Drive
- Cross-touch context flows automatically: prior interaction outputs from the same deal are passed as priorTouchOutputs to the Gemini slide selection prompt
- Ten predefined capability areas for Touch 3 (Data Engineering, Cloud Migration, AI/ML, Digital Transformation, Product Development, DevOps, Analytics, Cybersecurity, IoT, Blockchain)
- MEET_LUMENALTA_PRESENTATION_ID and CAPABILITY_DECK_PRESENTATION_ID added as optional env vars (source presentations for slide selection)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both tasks compiled and built cleanly on first pass.

## User Setup Required

**Environment variables** (optional -- defaults to template if not set):
- `MEET_LUMENALTA_PRESENTATION_ID` - Google Slides presentation ID of the Meet Lumenalta deck to select slides from
- `CAPABILITY_DECK_PRESENTATION_ID` - Google Slides presentation ID of capability deck to select slides from

## Next Phase Readiness
- Phase 4 is now complete: all three Touch flows (1, 2, 3) are functional with interaction tracking
- Shared assembly engine from Plan 04-02 confirmed working for multiple touch types without modification
- Interaction tracking infrastructure captures all touch types with cross-touch context
- Server Action proxy pattern and form patterns established for all future touch type forms
- Ready for Phase 5 (Transcript Processing) which depends on Phase 3 (complete) and Phase 4 interaction tracking infrastructure (now complete)

## Self-Check: PASSED

- All 4 key created files verified present on disk
- All 6 key modified files verified present on disk
- Commit 370b6f1: FOUND (Task 1)
- Commit 67cabcc: FOUND (Task 2)

---
*Phase: 04-touch-1-3-asset-generation-interaction-tracking*
*Completed: 2026-03-04*
