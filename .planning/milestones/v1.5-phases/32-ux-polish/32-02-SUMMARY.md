---
phase: 32-ux-polish
plan: 02
subsystem: ui
tags: [next-image, shadcn, gallery-cards, optimistic-ui, toast, duplicate-prevention]

# Dependency graph
requires:
  - phase: 32-ux-polish
    provides: "Shared UI primitives (DocumentTypeIcon, IngestionStatusBadge, IngestionProgress), browse/search enrichment with templateData and thumbnailUrl, server-side duplicate guard"
provides:
  - "Gallery-style Discovery cards with 16:9 hero thumbnails and file-type corner badges"
  - "Unified ingestion status display across Discovery and Templates pages"
  - "Optimistic UI with per-item toast lifecycle and client-side duplicate prevention"
  - "Non-ingestible file type visual differentiation (80% opacity, no checkbox)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gallery card layout: Card > aspect-video thumbnail > CardContent metadata"
    - "itemStatusToTemplateStatus mapping for shared badge rendering from local state"
    - "ingestingRef (useRef<Set>) for synchronous duplicate prevention without React state delay"
    - "Stable toast IDs (ingest-{slideId}) for in-place toast updates during ingestion lifecycle"

key-files:
  created: []
  modified:
    - apps/web/src/app/(authenticated)/discovery/discovery-client.tsx
    - apps/web/src/components/template-card.tsx

key-decisions:
  - "Removed large centered DocumentTypeIcon from thumbnail area per user feedback -- only small corner badge remains"
  - "Stabilized thumbnail onLoad with useCallback to prevent re-render flickering"
  - "Priority: local itemStatuses over templateData for display status (local state is more current during active ingestion)"
  - "Batch summary toast shows after all per-item toasts complete (e.g. '5 of 6 documents ingested, 1 failed')"

patterns-established:
  - "getDisplayStatus pattern: local optimistic state > server templateData > ingested hash check"
  - "ThumbnailArea component: skeleton shimmer while loading, file-type icon when no URL, corner badge always"

requirements-completed: [UXP-01, UXP-02, UXP-03, UXP-04, UXP-05]

# Metrics
duration: 11min
completed: 2026-03-07
---

# Phase 32 Plan 02: Discovery Card Redesign & Optimistic Ingestion UI Summary

**Gallery-style Discovery cards with hero thumbnails, unified IngestionStatusBadge across Discovery/Templates, optimistic ingest with per-item toast lifecycle, and ref-based duplicate prevention**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-07T15:57:11Z
- **Completed:** 2026-03-07T16:08:24Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- Discovery page redesigned with gallery-style cards: 16:9 hero thumbnail area with skeleton shimmer, file-type corner badges, and opacity differentiation for non-ingestible types
- Unified status display: both Discovery and Templates pages now use shared IngestionStatusBadge and IngestionProgress components
- Optimistic ingestion UI: clicking Ingest immediately sets Queued status, shows per-item toast with stable ID that updates in-place through ingestion lifecycle
- Client-side duplicate prevention via synchronous useRef<Set> guard (no React state delay), complementing server-side guard from Plan 01

## Task Commits

Each task was committed atomically:

1. **Task 1: Redesign Discovery cards and unify status display** - `1671f1f` (feat)
2. **Task 2: Optimistic UI with toast lifecycle and client-side duplicate prevention** - `efaee17` (feat)
3. **Task 3: Visual and functional verification** - `7aa6a58` (fix, post-review)

## Files Created/Modified
- `apps/web/src/app/(authenticated)/discovery/discovery-client.tsx` - Full rewrite: gallery Card layout, ThumbnailArea with skeleton/next-image, CardStatusRow with IngestionStatusBadge, ingestingRef duplicate guard, per-item toast lifecycle, itemStatusToTemplateStatus mapping
- `apps/web/src/components/template-card.tsx` - Replaced TemplateStatusBadge with IngestionStatusBadge, replaced inline Progress bar with IngestionProgress component

## Decisions Made
- Removed large centered DocumentTypeIcon from thumbnail placeholder per user feedback -- cards show only the small corner badge, keeping the thumbnail area clean
- Stabilized thumbnail onLoad handler with useCallback to prevent re-render loops that caused flickering
- Local itemStatuses always take priority over server templateData for display (local state reflects optimistic updates more accurately during active ingestion)
- Batch operations show per-item toasts during ingestion + single summary toast at completion

## Deviations from Plan

### Post-Review Fixes

**1. [Rule 1 - Bug] Redundant large icon in thumbnail area**
- **Found during:** Task 3 (human verification)
- **Issue:** Large centered DocumentTypeIcon in thumbnail area was visually redundant alongside the corner badge
- **Fix:** Removed large icon, kept only corner badge
- **Files modified:** apps/web/src/app/(authenticated)/discovery/discovery-client.tsx
- **Committed in:** `7aa6a58`

**2. [Rule 1 - Bug] Thumbnail image flickering on load**
- **Found during:** Task 3 (human verification)
- **Issue:** onLoad handler caused re-render loops leading to thumbnail flickering
- **Fix:** Stabilized with useCallback, added opacity transition for smoother appearance
- **Files modified:** apps/web/src/app/(authenticated)/discovery/discovery-client.tsx
- **Committed in:** `7aa6a58`

---

**Total deviations:** 2 post-review fixes (both bugs caught during human verification)
**Impact on plan:** Both fixes improve visual polish. No scope creep.

## Issues Encountered
- `slideCount: number | null` from DiscoveryDocument.templateData was incompatible with `getTemplateStatus` which expects `slideCount?: number | undefined`. Fixed with nullish coalescing (`?? undefined`) at the call site.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 32 complete: all UX polish requirements (UXP-01 through UXP-05) satisfied
- Discovery and Templates pages share identical status components
- Ready for Phase 33 (Slide Intelligence Foundation) which builds on this visual foundation

---
*Phase: 32-ux-polish*
*Completed: 2026-03-07*

## Self-Check: PASSED
