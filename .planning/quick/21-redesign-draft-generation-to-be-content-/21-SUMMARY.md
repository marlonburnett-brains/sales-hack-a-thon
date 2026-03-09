---
phase: 21-redesign-draft-generation
plan: 01
subsystem: api
tags: [zod, structured-output, llm-schema, deck-structure, content-slots]

# Dependency graph
requires:
  - phase: 20-enrich-deck-structure-loader
    provides: loadDeckSectionsWithElements and element sample data
provides:
  - ContentSlotDraftSchema with structured content slots per section
  - deriveSectionSlotCounts() for element classification
  - formatSectionsWithSlotsForPrompt() for slot-count-aware LLM prompts
  - Structured slot UI rendering for lowfi stage
affects: [touch-1-workflow, regenerate-stage, touch-stage-content]

# Tech tracking
tech-stack:
  added: []
  patterns: [structured-slot-draft, element-classification, slot-count-derivation]

key-files:
  created: []
  modified:
    - packages/schemas/llm/section-aware-draft.ts
    - packages/schemas/index.ts
    - apps/agent/src/lib/deck-structure-loader.ts
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/lib/regenerate-stage.ts
    - apps/web/src/components/touch/touch-stage-content.tsx

key-decisions:
  - "contactName/contactRole are required strings (not optional) to avoid Zod optional issues with LLM structured output"
  - "Element classification order: metric > headline > body > bullet to prevent large metrics from being classified as headlines"
  - "Slot counts averaged across slide variations with Math.ceil to ensure minimum one of each detected type"

patterns-established:
  - "Structured slot pattern: headlines[], bodyParagraphs[], metrics[{value,label}], bulletPoints[], speakerNotes per section"
  - "Three-tier UI detection: structured slots (headlines array) > old section-aware (contentText) > legacy flat"

requirements-completed: [SLOT-SCHEMA, SLOT-DERIVATION, TOUCH1-INTEGRATION, REGEN-INTEGRATION, UI-STRUCTURED]

# Metrics
duration: 6min
completed: 2026-03-09
---

# Quick Task 21: Redesign Draft Generation to be Content-Type Aware Summary

**ContentSlotDraftSchema with per-section structured slots (headlines, metrics, bodyParagraphs, bulletPoints) replacing single contentText blob, with slot derivation from template elements and structured UI rendering**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T23:21:11Z
- **Completed:** 2026-03-09T23:27:20Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Replaced SectionDraftLlmSchema with ContentSlotDraftSchema providing structured content slots per section
- Added slot derivation logic that classifies template elements into headlines, body, metrics, and bullets
- Updated Touch 1 workflow and regeneration to use slot-count-aware prompts for precise content generation
- Redesigned lowfi UI to render structured slots with metrics as value+label cards, headlines as bold text, and bullets as lists
- Maintained full backward compatibility with old section-aware and legacy PagerContent formats

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace schema + add slot derivation** - `de50143` (feat)
2. **Task 2: Update Touch 1 workflow + regeneration** - `f124695` (feat)
3. **Task 3: Redesign lowfi UI for structured slots** - `dc44384` (feat)

## Files Created/Modified
- `packages/schemas/llm/section-aware-draft.ts` - New ContentSlotDraftSchema + SectionContentSlotSchema replacing old SectionDraftLlmSchema
- `packages/schemas/index.ts` - Updated barrel exports for new schema names
- `apps/agent/src/lib/deck-structure-loader.ts` - Added loadDeckSectionsForSlotAnalysis(), deriveSectionSlotCounts(), formatSectionsWithSlotsForPrompt()
- `apps/agent/src/mastra/workflows/touch-1-workflow.ts` - Uses ContentSlotDraftSchema with slot-aware prompts
- `apps/agent/src/lib/regenerate-stage.ts` - Uses ContentSlotDraftSchema with slot-aware prompts for regeneration
- `apps/web/src/components/touch/touch-stage-content.tsx` - Three-tier rendering: structured slots > old section-aware > legacy flat

## Decisions Made
- contactName and contactRole are required strings (empty string if unavailable) to avoid Zod optional issues with LLM structured output
- Element classification priority: metric value regex > headline (fontSize >= 18 or bold + short) > body (> 100 chars) > bullet (everything else)
- Slot counts are averaged across slide variations per section using Math.ceil to ensure minimum coverage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ContentSlotDraftSchema is the new standard for Touch 1 lowfi draft generation
- Touch 2 and Touch 3 workflows are completely untouched
- UI backward compatible with any existing interactions using old format

---
*Quick Task: 21-redesign-draft-generation*
*Completed: 2026-03-09*
