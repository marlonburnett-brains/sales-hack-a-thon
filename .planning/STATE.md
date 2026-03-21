---
gsd_state_version: 1.0
milestone: v1.10
milestone_name: In-App Tutorials & Feedback
status: completed
stopped_at: Completed 74-03-PLAN.md (FeedbackWidget slug page integration) — awaiting human verify checkpoint
last_updated: "2026-03-21T01:39:16.050Z"
last_activity: 2026-03-20 -- Completed 75-01 (Tutorials sidebar nav item with blue New badge, /tutorials/unwatched-count endpoint)
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 11
  completed_plans: 11
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.
**Current focus:** v1.10 Phase 71 complete, ready for Phase 72

## Current Position

Phase: 75 - Sidebar Integration (in progress)
Plan: 01 complete (1 of 1 planned so far)
Status: 75-01 complete
Last activity: 2026-03-20 -- Completed 75-01 (Tutorials sidebar nav item with blue New badge, /tutorials/unwatched-count endpoint)

Progress: [████████--] 82%

## Performance Metrics

**Velocity:**
- Total plans completed: 161 (v1.0: 27, v1.1: 6, v1.2: 10, v1.3: 10, v1.4: 12, v1.5: 8, v1.6: 20, v1.7: 30, v1.8: 12, v1.9: 24, v1.10: 2)
- Quick tasks: 32 total
- Total project time: ~18 days (2026-03-03 -> 2026-03-20)
- Total LOC: ~82,000 TypeScript/TSX/Prisma

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

- [71-01] Used manual migration + prisma migrate resolve for 0_init drift workaround (per CLAUDE.md no-reset rule)
- [71-01] AppFeedback has no updatedAt -- write-once feedback records
- [71-02] Manifest-bridge pattern: upload script writes JSON consumed by seed script (decoupled operations)
- [71-02] Sequential GCS uploads (not parallel) to avoid timeout on 5-19MB video files
- [Phase 72]: Tutorial.thumbnailUrl remains nullable so browse UI can ship before every thumbnail is uploaded
- [Phase 72]: Thumbnail backfill uses ffmpeg frame extraction at 1 second plus gcloud CLI uploads, matching the locked operational workflow
- [Phase 72]: Seed reads tutorial-thumbnails-manifest.json opportunistically and falls back to null thumbnailUrl when absent
- [Phase 72-02]: Fixed CATEGORY_META array in route handler drives category ordering independent of DB row order
- [Phase 72-02]: Promise.all for concurrent Tutorial+TutorialView fetch; views scoped to userId
- [Phase 72-03]: tutorials-browse-view.tsx lives in components/ not app/ for test relative import resolution
- [Phase 72-03]: Slug page calls listTutorialsAction() to validate slug; notFound() for unknowns
- [Phase 73-01]: viewsMap replaces watchedSet in GET /tutorials: single Map carries both watched and lastPosition
- [Phase 73-01]: PATCH routes use tutorialId_userId compound unique key for idempotent progress upserts
- [Phase 73-02]: dynamicImport alias avoids collision with Next.js export const dynamic in same page file
- [Phase 73-02]: TutorialVideoPlayer props use initialLastPosition (matching pre-written test fixture)
- [Phase 73-02]: hasMarkedWatched ref gate prevents duplicate markWatched calls at 90% currentTime/duration threshold
- [Phase 73-02]: gcsUrl added as required field to TutorialBrowseCard (additive, non-breaking change)
- [Phase 75-01]: Blue badge (bg-blue-500) for Tutorials New pill vs red for Action Required; total-watchedCount approach for unwatched count to avoid undercounting never-started tutorials
- [Phase 74-feedback-system]: 74-01: agentFetch duplicated in feedback-actions.ts for Next.js server action bundling safety
- [Phase 74-feedback-system]: 74-02: Character counter rendered only when comment.length > 0 to reduce visual noise on empty form
- [Phase 74-feedback-system]: 74-02: defaultTab extracted as const so form reset returns to originally-passed defaultFeedbackType
- [Phase 74-feedback-system]: 74-03: FeedbackWidget placed after TutorialVideoPlayer with key={tutorial.id} for automatic state reset on navigation

### Key Research Findings (v1.10)

- Use `VERTEX_SERVICE_ACCOUNT_KEY` for all GCS operations (never GOOGLE_SERVICE_ACCOUNT_KEY)
- GCS bucket CORS must allow `Range` header for HTML5 video byte-range requests
- Native HTML5 `<video>` with `dynamic({ ssr: false })` -- no react-player needed
- Fire watched state on `ended` event only, not `timeupdate` (4Hz flood risk)
- `FeedbackWidget` needs `key={tutorialId}` for state reset between tutorials
- All 3 Prisma models (Tutorial, TutorialView, AppFeedback) in one forward-only migration
- Zero new npm packages required -- shadcn/ui toggle-group only new component file

### Pending Todos

None.

### Blockers/Concerns

- Content library access: 14/17 Drive shortcut targets need Viewer access (not code-blocking)
- Prisma version constraint: Stay on 6.19.x -- Prisma 7.x has vector migration regression (#28867)
- 4 deferred gap-closure phases (58-61) carry forward as Active requirements

## Session Continuity

Last session: 2026-03-21T01:39:16.045Z
Stopped at: Completed 74-03-PLAN.md (FeedbackWidget slug page integration) — awaiting human verify checkpoint
Next action: Continue Phase 73 or next planned phase
