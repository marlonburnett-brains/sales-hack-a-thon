---
phase: 20-slide-ingestion-agent
plan: 01
subsystem: api, database, ingestion
tags: [vertex-ai, pgvector, prisma, embeddings, gemini, google-slides, ingestion-pipeline]

# Dependency graph
requires:
  - phase: 18-ci-cd-pipeline-pgvector-schema
    provides: pgvector SlideEmbedding table and HNSW index
  - phase: 19-navigation-template-management
    provides: Template model and CRUD endpoints
provides:
  - Slide ingestion pipeline (extract, classify, embed, store)
  - POST /templates/:id/ingest endpoint
  - GET /templates/:id/progress endpoint
  - Smart merge logic for re-ingestion idempotency
  - Content hash-based slide identity tracking
  - Confidence score (0-100) in classification
  - Sequential ingestion queue with crash recovery
affects: [20-02, slide-review-ui, template-management-ui]

# Tech tracking
tech-stack:
  added: [pgvector (npm)]
  patterns: [raw SQL upsert with pgvector toSql(), content hash identity, sequential queue]

key-files:
  created:
    - apps/agent/src/ingestion/embed-slide.ts
    - apps/agent/src/ingestion/smart-merge.ts
    - apps/agent/src/ingestion/ingest-template.ts
    - apps/agent/src/ingestion/ingestion-queue.ts
    - apps/agent/prisma/migrations/20260306000000_add_ingestion_columns/migration.sql
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/ingestion/classify-metadata.ts
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts

key-decisions:
  - "Used db execute + migrate resolve for ingestion migration (0_init drift, same as Phase 19-01)"
  - "Installed pgvector npm package (was referenced in research as existing but was not in package.json)"
  - "LLM self-assessed confidence score via Gemini structured output (added to response schema)"

patterns-established:
  - "pgvector raw SQL upsert: INSERT ON CONFLICT with toSql() for vector column"
  - "Content hash identity: SHA-256(text + notes + slideObjectId) truncated to 40 chars"
  - "Sequential queue pattern: in-memory queue with deduplication and crash recovery"

requirements-completed: [SLIDE-02, SLIDE-03, SLIDE-04, SLIDE-05, SLIDE-06, SLIDE-08]

# Metrics
duration: 7min
completed: 2026-03-06
---

# Phase 20 Plan 01: Slide Ingestion Pipeline Summary

**End-to-end ingestion pipeline with Vertex AI embeddings, Gemini classification with confidence scores, content-hash smart merge, and sequential queue processing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-06T00:35:04Z
- **Completed:** 2026-03-06T00:42:30Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Prisma schema migration adding 7 columns to SlideEmbedding and 2 to Template for ingestion tracking
- Full ingestion orchestrator that extracts slides via Google Slides API, classifies via Gemini, embeds via Vertex AI, and stores in pgvector
- Smart merge logic using SHA-256 content hashes for idempotent re-ingestion (unchanged preserved, changed re-classified, removed archived)
- API endpoints for triggering ingestion and polling progress
- Confidence score (0-100) integrated into Gemini structured output classification

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema migration for ingestion support columns** - `d923186` (feat)
2. **Task 2: Ingestion pipeline modules** - `3241853` (feat)
3. **Task 3: API endpoints and web api-client updates** - `c70aca6` (feat)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added ingestion columns to SlideEmbedding and Template
- `apps/agent/prisma/migrations/20260306000000_add_ingestion_columns/migration.sql` - Forward-only migration
- `apps/agent/src/ingestion/embed-slide.ts` - Vertex AI text-embedding-005 embedding generation
- `apps/agent/src/ingestion/smart-merge.ts` - Content hash computation and merge logic
- `apps/agent/src/ingestion/ingest-template.ts` - Main ingestion orchestrator
- `apps/agent/src/ingestion/ingestion-queue.ts` - Sequential queue with crash recovery
- `apps/agent/src/ingestion/classify-metadata.ts` - Added confidence to Gemini response schema
- `apps/agent/src/mastra/index.ts` - Added ingest and progress endpoints
- `apps/web/src/lib/api-client.ts` - Added ingestion types and functions

## Decisions Made
- Used db execute + migrate resolve for migration (same 0_init drift pattern as Phase 19-01)
- Installed pgvector npm package for vector serialization (referenced in research as existing but was missing from package.json -- Rule 3 auto-fix)
- Added confidence score directly to Gemini structured output response schema (LLM self-assessment approach per research recommendation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing pgvector npm dependency**
- **Found during:** Task 1
- **Issue:** Research stated pgvector was already installed but it was not in package.json
- **Fix:** Ran `pnpm --filter agent add pgvector@0.2.0`
- **Files modified:** apps/agent/package.json, pnpm-lock.yaml
- **Verification:** Build passes, import resolves
- **Committed in:** d923186 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential dependency for vector serialization. No scope creep.

## Issues Encountered
- Prisma migrate dev fails due to 0_init baseline drift (known issue from Phase 19-01). Resolved using the established pattern: write SQL manually, apply via db execute, mark as applied via migrate resolve.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ingestion pipeline is complete and callable via POST /templates/:id/ingest
- Progress polling available via GET /templates/:id/progress
- Plan 02 (progress UI, auto-trigger, staleness polling) can now build the web UI layer on top

---
*Phase: 20-slide-ingestion-agent*
*Completed: 2026-03-06*
