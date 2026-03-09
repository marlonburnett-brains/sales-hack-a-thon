---
phase: 42-deal-detail-layout
plan: 01
subsystem: ui
tags: [nextjs, app-router, nested-layout, breadcrumb, sidebar, navigation]

requires:
  - phase: 41-deal-pipeline
    provides: Deal model, getDealAction, deal-card touch status patterns
provides:
  - Shared reusable Breadcrumb component (components/ui/breadcrumb.tsx)
  - DealSidebar component with touch status indicators
  - Nested deal layout with sidebar + breadcrumbs wrapping all deal sub-pages
  - Route redirect from /deals/[id] to /deals/[id]/overview
  - Placeholder sub-pages for overview, briefing, and touch/[touchNumber]
affects: [42-deal-detail-layout, 45-ai-chat, 46-touch-hitl]

tech-stack:
  added: []
  patterns: [nested-layout-with-sidebar, shared-breadcrumb, touch-status-derivation, negative-margin-layout-override]

key-files:
  created:
    - apps/web/src/components/ui/breadcrumb.tsx
    - apps/web/src/components/deals/deal-sidebar.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/overview/page.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/briefing/page.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/page.tsx
  modified:
    - apps/web/src/app/(authenticated)/deals/[dealId]/page.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/loading.tsx
    - apps/web/src/app/(authenticated)/templates/[id]/slides/page.tsx
    - apps/web/src/app/(authenticated)/templates/[id]/slides/slide-viewer-client.tsx

key-decisions:
  - "Deal layout uses negative margins (-mx-4 -my-6) to reclaim global sidebar padding for full-bleed sidebar"
  - "Breadcrumb component is generic with items array + optional current prop, usable across deal and template contexts"
  - "Touch status indicators reuse same derivation logic as deal-card.tsx for consistency"

patterns-established:
  - "Nested layout pattern: layout.tsx fetches deal once, renders sidebar + breadcrumbs, passes children through"
  - "Shared Breadcrumb component with items[] and current prop for consistent navigation"
  - "DealSidebar as client component using usePathname for active link highlighting"

requirements-completed: [NAV-01, NAV-02, NAV-03]

duration: 4min
completed: 2026-03-08
---

# Phase 42 Plan 01: Deal Detail Navigation Summary

**Nested deal layout with shared Breadcrumb component, DealSidebar with touch status indicators, route redirect, and placeholder sub-pages for overview/briefing/touch**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T20:14:14Z
- **Completed:** 2026-03-08T20:18:12Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created shared reusable Breadcrumb component and replaced inline breadcrumb HTML in template slides page/viewer
- Built DealSidebar client component with Overview, Briefing, Touch 1-4 navigation and status indicators (not_started/in_progress/completed)
- Established nested deal layout with sidebar + breadcrumbs wrapping all deal sub-pages including existing review/asset-review routes
- Created redirect from /deals/[id] to /deals/[id]/overview and placeholder sub-pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Breadcrumb component and DealSidebar component** - `bdae3c9` (feat)
2. **Task 2: Create deal layout, redirect, and placeholder sub-pages** - `25cc530` (feat)

## Files Created/Modified
- `apps/web/src/components/ui/breadcrumb.tsx` - Shared reusable Breadcrumb with items array and current prop
- `apps/web/src/components/deals/deal-sidebar.tsx` - Deal-specific sidebar with nav links and touch status indicators
- `apps/web/src/app/(authenticated)/deals/[dealId]/layout.tsx` - Nested layout rendering breadcrumbs + deal sidebar + children
- `apps/web/src/app/(authenticated)/deals/[dealId]/page.tsx` - Redirect to /overview (replaced monolithic page)
- `apps/web/src/app/(authenticated)/deals/[dealId]/loading.tsx` - Layout-level skeleton with sidebar + content placeholders
- `apps/web/src/app/(authenticated)/deals/[dealId]/overview/page.tsx` - Placeholder overview page
- `apps/web/src/app/(authenticated)/deals/[dealId]/briefing/page.tsx` - Placeholder briefing page
- `apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/page.tsx` - Placeholder touch page with 1-4 validation
- `apps/web/src/app/(authenticated)/templates/[id]/slides/page.tsx` - Updated to use shared Breadcrumb
- `apps/web/src/app/(authenticated)/templates/[id]/slides/slide-viewer-client.tsx` - Updated to use shared Breadcrumb

## Decisions Made
- Deal layout uses negative margins to reclaim global sidebar padding for full-bleed deal sidebar
- Breadcrumb component designed as generic reusable with items[] and current prop
- Touch status indicators reuse exact same derivation logic as deal-card.tsx
- DealSidebar hidden on mobile (hidden md:flex), users navigate via breadcrumbs on mobile

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Layout shell is complete and ready for Overview content (Plan 02) and Briefing content (Plan 03)
- Existing review and asset-review sub-routes render correctly within the new layout
- Touch placeholder pages ready for Phase 46 workflow content

---
*Phase: 42-deal-detail-layout*
*Completed: 2026-03-08*
