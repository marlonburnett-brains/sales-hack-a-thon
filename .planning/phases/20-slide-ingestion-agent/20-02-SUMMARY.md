---
phase: 20-slide-ingestion-agent
plan: 02
subsystem: web-ui, agent
tags: [progress-ui, polling, auto-ingestion, staleness, shadcn]

# Dependency graph
requires:
  - phase: 20-slide-ingestion-agent
    plan: 01
    provides: Ingestion pipeline, ingest/progress API endpoints
provides:
  - Inline progress bar on template cards during ingestion
  - Auto-trigger ingestion on template add
  - Background staleness polling with auto-re-ingestion
  - Sonner toast notifications for ingestion completion
affects: [template-management-ui, slide-review-ui]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-progress (via shadcn)"]
  patterns: [useEffect polling, server action wrappers, background setInterval]

key-files:
  created:
    - apps/web/src/components/ui/progress.tsx
  modified:
    - apps/web/src/components/template-card.tsx
    - apps/web/src/lib/template-utils.ts
    - apps/web/src/lib/actions/template-actions.ts
    - apps/web/src/app/(authenticated)/templates/templates-page-client.tsx
    - apps/web/src/components/template-form.tsx
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Extended TemplateForm onSuccess callback to pass template result for auto-trigger ingestion flow"
  - "No manual Re-ingest button (per user decision) -- staleness polling handles re-ingestion automatically"

requirements-completed: [SLIDE-07]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 20 Plan 02: Progress UI & Staleness Polling Summary

**Inline progress bar on template cards with auto-trigger ingestion on add and 5-minute background staleness polling for automatic re-ingestion**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T00:44:39Z
- **Completed:** 2026-03-06T00:49:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- shadcn Progress component installed for inline progress bars on template cards
- TemplateStatus type extended with "ingesting", "queued", and "failed" statuses
- Template cards show real-time progress during ingestion (polling every 2s) with "Slide N of M" text
- Completion triggers Sonner toast with slide count and skipped count when applicable
- Auto-trigger ingestion immediately after successful template add when access is confirmed
- Background staleness polling every 5 minutes checks Drive modifiedTime against lastIngestedAt and auto-enqueues stale templates

## Task Commits

1. **Task 1: Progress UI on template card with polling and auto-trigger** - `42470c8` (feat)
2. **Task 2: Background staleness polling with auto-re-ingestion** - `9c48fcc` (feat)

## Files Created/Modified
- `apps/web/src/components/ui/progress.tsx` - shadcn Progress component (new)
- `apps/web/src/components/template-card.tsx` - Inline progress bar, polling useEffect, onRefresh prop
- `apps/web/src/lib/template-utils.ts` - Added ingesting/queued/failed to TemplateStatus and STATUS_CONFIG
- `apps/web/src/lib/actions/template-actions.ts` - Added triggerIngestionAction and getIngestionProgressAction
- `apps/web/src/app/(authenticated)/templates/templates-page-client.tsx` - Auto-trigger ingestion on add, pass onRefresh
- `apps/web/src/components/template-form.tsx` - Pass template result in onSuccess callback
- `apps/agent/src/mastra/index.ts` - Background staleness polling with 5-minute interval

## Decisions Made
- Extended TemplateForm onSuccess callback to pass template result data for auto-trigger ingestion flow
- No manual Re-ingest button per user decision -- background staleness polling handles re-ingestion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - all features are automatic.

## Next Phase Readiness
- Phase 20 (Slide Ingestion Agent) is now complete
- Ingestion pipeline + progress UI + auto-trigger + staleness polling are all operational
- Ready for Phase 21 (final phase)

---
*Phase: 20-slide-ingestion-agent*
*Completed: 2026-03-06*
