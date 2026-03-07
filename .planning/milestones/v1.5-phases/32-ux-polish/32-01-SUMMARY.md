---
phase: 32-ux-polish
plan: 01
subsystem: ui, api
tags: [lucide-react, gcs, thumbnails, next-image, shadcn, prisma]

# Dependency graph
requires:
  - phase: 29-discovery
    provides: "Discovery browse/search/ingest endpoints and MCP integration"
  - phase: 20-ingestion
    provides: "Template ingestion pipeline and GCS thumbnail caching"
provides:
  - "DocumentTypeIcon component with MIME-to-icon mapping (4 types, 3 sizes)"
  - "IngestionStatusBadge shared component (neutral import path)"
  - "IngestionProgress shared component (Progress bar + slide count)"
  - "DOCUMENT_TYPE_CONFIG and getDocumentTypeConfig utility"
  - "cacheDocumentCover and checkGcsCoverExists GCS functions"
  - "Browse/search template cross-reference (templateData per document)"
  - "Server-side duplicate ingestion guard (rejects ingesting/queued)"
  - "DiscoveryDocument.thumbnailUrl and templateData fields"
affects: [32-02-discovery-cards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Background GCS cover caching (fire-and-forget on first browse)"
    - "Template cross-reference via prisma.template.findMany with presentationId IN"
    - "Shared UI components at neutral paths (not template-specific)"

key-files:
  created:
    - apps/web/src/lib/document-types.ts
    - apps/web/src/components/document-type-icon.tsx
    - apps/web/src/components/ingestion-status.tsx
    - apps/web/src/components/ingestion-progress.tsx
  modified:
    - apps/web/next.config.ts
    - apps/web/src/lib/api-client.ts
    - apps/agent/src/lib/gcs-thumbnails.ts
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Used Presentation icon from lucide-react for Google Slides (standard icon name)"
  - "Cover thumbnails use fire-and-forget pattern: first browse triggers caching, second browse returns cached URL"
  - "Duplicate guard allows re-ingestion for idle templates but blocks ingesting/queued"

patterns-established:
  - "DocumentTypeConfig pattern: MIME type -> icon/label/color/bgColor mapping"
  - "Non-blocking GCS cover caching via void cacheDocumentCover()"

requirements-completed: [UXP-01, UXP-02, UXP-03, UXP-05]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 32 Plan 01: Backend Thumbnail Pipeline & Shared UI Primitives Summary

**GCS cover thumbnail caching with template cross-reference enrichment, shared DocumentTypeIcon/IngestionStatusBadge/IngestionProgress components, and server-side duplicate ingestion guard**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T15:50:46Z
- **Completed:** 2026-03-07T15:54:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created shared UI primitives (DocumentTypeIcon, IngestionStatusBadge, IngestionProgress) ready for Discovery cards redesign
- Agent browse and search endpoints now return templateData (ingestion status, slide count) and thumbnailUrl per document
- Cover thumbnails cached to GCS with TTL-based freshness check (fire-and-forget on first load)
- Server-side duplicate ingestion guard rejects documents already in ingesting/queued state

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared UI primitives and type utilities** - `550b578` (feat)
2. **Task 2: Agent browse enrichment and duplicate guard** - `4b04ebe` (feat)

## Files Created/Modified
- `apps/web/src/lib/document-types.ts` - MIME-to-icon/color mapping with getDocumentTypeConfig and isIngestible utilities
- `apps/web/src/components/document-type-icon.tsx` - DocumentTypeIcon with sm/md/lg size variants using lucide-react
- `apps/web/src/components/ingestion-status.tsx` - IngestionStatusBadge shared component (neutral import path)
- `apps/web/src/components/ingestion-progress.tsx` - IngestionProgress with shadcn Progress bar and "Slide N of M"
- `apps/web/next.config.ts` - Added storage.googleapis.com to next/image remotePatterns
- `apps/web/src/lib/api-client.ts` - Added thumbnailUrl and templateData to DiscoveryDocument interface
- `apps/agent/src/lib/gcs-thumbnails.ts` - Added cacheDocumentCover and checkGcsCoverExists functions
- `apps/agent/src/mastra/index.ts` - Browse/search enrichment with templateData and thumbnailUrl; ingest duplicate guard

## Decisions Made
- Used `Presentation` icon from lucide-react for Google Slides (the standard lucide icon name, plan referenced `FileSliders` which doesn't exist)
- Cover thumbnails use fire-and-forget pattern: first browse triggers background caching, second browse returns cached URL from GCS
- Duplicate guard allows re-ingestion for idle templates (triggers queue) but blocks ingesting/queued with "Already ingesting" status
- For failed templates, the duplicate guard marks them as "done" since the template record already exists

## Deviations from Plan

None - plan executed exactly as written (minor icon name correction: Presentation vs FileSliders).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared UI primitives ready for Plan 02 (Discovery cards redesign)
- Agent endpoints return enriched data (thumbnailUrl, templateData) for card rendering
- Server-side duplicate guard active for safe re-ingestion behavior

---
*Phase: 32-ux-polish*
*Completed: 2026-03-07*

## Self-Check: PASSED
