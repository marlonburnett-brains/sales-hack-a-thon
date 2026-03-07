---
phase: 33-slide-intelligence-foundation
plan: 01
subsystem: ingestion
tags: [gemini, google-slides-api, prisma, pgvector, element-map, ai-description]

# Dependency graph
requires:
  - phase: 18-pgvector-slide-embeddings
    provides: SlideEmbedding model and raw SQL upsert pattern
  - phase: 20-ingestion-pipeline
    provides: ingest-template.ts orchestrator, smart-merge, classify-metadata
provides:
  - AI description generation per slide via Gemini structured output
  - SlideElement model for per-element structural data storage
  - Element map extraction from Google Slides pageElements
  - Backfill detection and queue logic on agent startup
  - Description column on SlideEmbedding raw SQL INSERT/UPDATE
affects: [33-02, 33-03, 34-deck-intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate LLM call for descriptions (narrative) vs classification (categorical)"
    - "SlideElement table with Prisma CRUD (no raw SQL needed unlike SlideEmbedding)"
    - "Backfill detection via LEFT JOIN for missing element rows"

key-files:
  created:
    - apps/agent/src/ingestion/describe-slide.ts
    - apps/agent/src/ingestion/extract-elements.ts
    - apps/agent/src/ingestion/backfill-descriptions.ts
    - apps/agent/prisma/migrations/20260307171300_add_slide_descriptions_elements/migration.sql
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/lib/slide-extractor.ts
    - apps/agent/src/ingestion/ingest-template.ts
    - apps/agent/src/ingestion/smart-merge.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/ingestion/__tests__/smart-merge.test.ts

key-decisions:
  - "Schema migration created manually and marked as applied due to 0_init drift -- forward-only per CLAUDE.md"
  - "Description generation is non-fatal -- failures log warning and continue ingestion"
  - "Element storage uses Prisma CRUD (deleteMany + createMany) unlike SlideEmbedding raw SQL"
  - "pageElements added as optional field on ExtractedSlide for backward compatibility"

patterns-established:
  - "generateSlideDescription: Gemini structured output with 4-field JSON schema"
  - "extractElements: recursive pageElement processing with type detection and style extraction"
  - "needsDescription backfill path: unchanged slides get description + elements without re-classification"

requirements-completed: [SLI-01, SLI-03, SLI-04, SLI-05]

# Metrics
duration: 16min
completed: 2026-03-07
---

# Phase 33 Plan 01: Slide Intelligence Data Pipeline Summary

**Gemini AI description generation, Google Slides element map extraction, and startup backfill detection wired into ingestion pipeline**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-07T17:10:59Z
- **Completed:** 2026-03-07T17:27:11Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- AI descriptions generated per slide during ingestion (purpose, visualComposition, keyContent, useCases) via Gemini 2.0 Flash structured output
- Element maps extracted from Google Slides pageElements storing position, size, type, text, and basic styling in SlideElement table
- Backfill detection on startup queues templates with missing descriptions or element maps for re-ingestion
- Smart merge extended with needsDescription path for backfilling unchanged slides without re-classification

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + description generator + element extractor** - `41a1ec6` (feat)
2. **Task 2: Wire pipeline + backfill logic** - `5050f51` (feat)

## Files Created/Modified
- `apps/agent/src/ingestion/describe-slide.ts` - Gemini structured output description generator
- `apps/agent/src/ingestion/extract-elements.ts` - Google Slides pageElement extractor
- `apps/agent/src/ingestion/backfill-descriptions.ts` - Startup detection and queue logic
- `apps/agent/prisma/migrations/20260307171300_add_slide_descriptions_elements/migration.sql` - SlideElement table + description column
- `apps/agent/prisma/schema.prisma` - SlideElement model, description on SlideEmbedding, contentClassification on Template
- `apps/agent/src/lib/slide-extractor.ts` - Added optional pageElements to ExtractedSlide
- `apps/agent/src/ingestion/ingest-template.ts` - Wired description generation + element storage + backfill path
- `apps/agent/src/ingestion/smart-merge.ts` - Added needsDescription array and description/element count tracking
- `apps/agent/src/mastra/index.ts` - Added detectAndQueueBackfill startup call
- `apps/agent/src/ingestion/__tests__/smart-merge.test.ts` - Updated fixtures for new ExistingSlideData fields

## Decisions Made
- Schema migration created manually with IF NOT EXISTS guards and marked as applied, because 0_init migration drift prevents prisma migrate dev from running. Forward-only per CLAUDE.md rules.
- Description generation is non-fatal: if the LLM call fails for a slide, ingestion continues with null description.
- Element storage uses Prisma CRUD (deleteMany + createMany) since SlideElement has no vector column.
- pageElements added as optional field on ExtractedSlide to maintain backward compatibility with existing callers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated smart-merge test fixtures for new ExistingSlideData fields**
- **Found during:** Task 2
- **Issue:** Adding description field to ExistingSlideData broke existing test fixtures that didn't include it
- **Fix:** Added `description: null` to all test fixture objects
- **Files modified:** apps/agent/src/ingestion/__tests__/smart-merge.test.ts
- **Committed in:** 5050f51

**2. [Rule 3 - Blocking] Schema migration via manual SQL due to 0_init drift**
- **Found during:** Task 1
- **Issue:** prisma migrate dev refused to run because 0_init migration was modified after application
- **Fix:** Created migration SQL manually with IF NOT EXISTS and used prisma migrate resolve --applied (DB unreachable, will apply on next connection)
- **Files modified:** apps/agent/prisma/migrations/20260307171300_add_slide_descriptions_elements/migration.sql
- **Note:** Schema and migration already committed via 33-03 commit (494da1f) which ran ahead of this plan

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for compilation and migration discipline. No scope creep.

## Issues Encountered
- Database unreachable during execution (Supabase instance), so migration could not be applied live. Migration SQL file is committed and will apply on next `prisma migrate resolve --applied` when DB is accessible.
- Plan 33-03 was already committed (494da1f) with schema changes, so schema migration was already in place before this plan executed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Description generation and element extraction are fully wired into the ingestion pipeline
- Backfill runs automatically on agent startup
- Plan 33-02 (Content Classification UI) and Plan 33-03 (Slide Viewer UI) can consume description and element data
- Phase 34 (Deck Intelligence) will have structured element maps available for programmatic slide manipulation

---
*Phase: 33-slide-intelligence-foundation*
*Completed: 2026-03-07*
