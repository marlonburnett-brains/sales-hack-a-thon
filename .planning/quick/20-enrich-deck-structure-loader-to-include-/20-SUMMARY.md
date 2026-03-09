---
phase: quick-20
plan: 01
subsystem: api
tags: [prisma, llm-prompts, deck-structure, slide-elements]

# Dependency graph
requires:
  - phase: 50-01
    provides: DeckStructure schema and deck-structure-loader utility
provides:
  - loadDeckSectionsWithElements with batched element loading
  - formatSectionsWithElementsForPrompt with element text samples in LLM prompts
affects: [touch-1-workflow, regenerate-stage, deck-structure-loader]

# Tech tracking
tech-stack:
  added: []
  patterns: [batched-prisma-query-with-include, element-sample-dedup-and-truncation]

key-files:
  created: []
  modified:
    - apps/agent/src/lib/deck-structure-loader.ts
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/lib/regenerate-stage.ts

key-decisions:
  - "Batched single Prisma query for all slideIds to avoid N+1"
  - "Elements ordered by fontSize desc to prioritize headings over body text"
  - "5-element cap per section with 150-char truncation to limit prompt bloat"

patterns-established:
  - "Element enrichment pattern: load sections then batch-load elements via slideId Map"

requirements-completed: [QUICK-20]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Quick Task 20: Enrich Deck Structure Loader Summary

**Batched slide element loading with deduped, truncated text samples injected into Touch 1 draft and regenerate-stage prompts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T22:59:05Z
- **Completed:** 2026-03-09T23:02:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added loadDeckSectionsWithElements that batches element queries across all section slideIds in a single Prisma findMany
- Added formatSectionsWithElementsForPrompt that appends deduplicated, truncated element text samples per section
- Touch 1 draft generation and lowfi regeneration now include concrete example content from real slides
- Touch 2/3 workflows completely unmodified

## Task Commits

Each task was committed atomically:

1. **Task 1: Add loadDeckSectionsWithElements and formatSectionsWithElementsForPrompt** - `22f182e` (feat)
2. **Task 2: Wire enriched element content into Touch 1 and regenerate-stage** - `7cd5cab` (feat)

## Files Created/Modified
- `apps/agent/src/lib/deck-structure-loader.ts` - Added loadDeckSectionsWithElements, formatSectionsWithElementsForPrompt, SectionElementData, EnrichedDeckSections types
- `apps/agent/src/mastra/workflows/touch-1-workflow.ts` - Switched generateDraftText to use enriched element content in section-aware path
- `apps/agent/src/lib/regenerate-stage.ts` - Updated lowfi regeneration to pass elementsBySlideId through buildSectionAwareDraftPrompt

## Decisions Made
- Batched single Prisma query for all slideIds to avoid N+1 queries
- Elements ordered by fontSize desc to prioritize headings/titles over small body text
- 5-element cap per section with 150-char truncation to prevent prompt bloat
- Deduplicate by exact contentText match across slides within the same section

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Element-enriched prompts ready for production use
- Original loadDeckSections and formatSectionsForPrompt remain available for Touch 2/3 slide notes enrichment

---
*Quick Task: 20*
*Completed: 2026-03-09*
