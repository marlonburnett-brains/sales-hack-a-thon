---
phase: 21-preview-review-engine
plan: 01
subsystem: api
tags: [prisma, postgresql, mastra, google-slides-api, server-actions, next.js]

# Dependency graph
requires:
  - phase: 20-slide-ingestion
    provides: "SlideEmbedding model, Template model, ingestion pipeline"
  - phase: 18-pgvector-embeddings
    provides: "pgvector extension, embedding column, HNSW index"
provides:
  - "reviewStatus column on SlideEmbedding with index"
  - "GET /templates/:id/slides endpoint"
  - "GET /templates/:id/thumbnails endpoint"
  - "POST /slides/:id/update-classification endpoint"
  - "POST /slides/:id/similar endpoint"
  - "Typed api-client functions: listSlides, getSlideThumbnails, updateSlideClassification, findSimilarSlides"
  - "Server actions: listSlidesAction, getSlideThumbnailsAction, updateSlideClassificationAction, findSimilarSlidesAction"
affects: [21-02, 21-03, 21-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Review status tracking via string column with unreviewed/approved/needs_correction values"
    - "Batch thumbnail fetch from Google Slides API with sequential rate-limited calls"
    - "Raw SQL for atomic multi-column tag updates (Prisma $executeRaw)"
    - "Vector cosine similarity search via pgvector <=> operator"

key-files:
  created:
    - "apps/agent/prisma/migrations/20260306120000_add_review_status/migration.sql"
    - "apps/web/src/lib/actions/slide-actions.ts"
  modified:
    - "apps/agent/prisma/schema.prisma"
    - "apps/agent/src/mastra/index.ts"
    - "apps/web/src/lib/api-client.ts"

key-decisions:
  - "Used db execute + migrate resolve for migration (0_init drift pattern, consistent with Phase 19/20)"
  - "Used raw SQL for update-classification to atomically update multiple columns including classificationJson"
  - "Cast embedding to text for extraction, then back to vector for comparison in similarity search"

patterns-established:
  - "SlideEmbedding review workflow: unreviewed -> approved | needs_correction"
  - "Server actions re-export types from api-client for client component consumption"

requirements-completed: [PREV-01, PREV-02, PREV-03, PREV-04, PREV-05, SLIDE-09]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 21 Plan 01: API Foundation Summary

**4 preview/review API endpoints with reviewStatus tracking, typed client functions, and server actions for slide viewer/rating/similarity UI**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T12:26:39Z
- **Completed:** 2026-03-06T12:30:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- reviewStatus column on SlideEmbedding with migration and index for filtering slides by review state
- 4 new agent API endpoints: list slides, batch thumbnails, update classification, similarity search
- Typed api-client functions and server actions ready for UI consumption in Phase 21 plans 02-04

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + Agent API endpoints** - `402d819` (feat)
2. **Task 2: Web api-client functions + Server Actions** - `2d6967d` (feat)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added reviewStatus column and index to SlideEmbedding
- `apps/agent/prisma/migrations/20260306120000_add_review_status/migration.sql` - Forward-only migration SQL
- `apps/agent/src/mastra/index.ts` - 4 new API endpoints for preview/review engine
- `apps/web/src/lib/api-client.ts` - SlideData, SlideThumbnail, SimilarSlide, CorrectedTags types + 4 fetch functions
- `apps/web/src/lib/actions/slide-actions.ts` - Server action wrappers for all 4 endpoints

## Decisions Made
- Used db execute + migrate resolve for migration (0_init drift pattern, consistent with Phase 19/20)
- Used raw SQL ($executeRaw) for update-classification to atomically update multiple tag columns + classificationJson
- Cast embedding to text for extraction, then back to vector for comparison in similarity search
- Added getSlidesClient import from google-auth for thumbnail batch fetch

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in mastra/index.ts (lines 491, 505, 589, 773) related to Mastra workflow API changes -- these are in brief approval/asset review code from earlier phases, not caused by this plan's changes. Out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 API endpoints are live and ready for UI consumption
- Server actions provide the bridge for Next.js client components
- Plans 02-04 (slide viewer, rating/editing, similarity search) can now execute in parallel

## Self-Check: PASSED

All 5 files verified present. Both commit hashes (402d819, 2d6967d) confirmed in git log.

---
*Phase: 21-preview-review-engine*
*Completed: 2026-03-06*
