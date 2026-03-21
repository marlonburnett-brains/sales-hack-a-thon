---
phase: 72-tutorial-browsing
plan: 01
subsystem: database, infra
tags: [prisma, tutorial, thumbnails, ffmpeg, gcloud, gcs, manifest]

# Dependency graph
requires:
  - phase: 71-01
    provides: "Tutorial model and forward-only migration workflow"
  - phase: 71-02
    provides: "tutorials-manifest.json bridge and tutorial seed baseline"
provides:
  - "Tutorial.thumbnailUrl nullable persistence for browse-card media"
  - "ffmpeg + gcloud thumbnail extraction workflow with slug-to-thumbnail manifest"
  - "Seed-time thumbnail backfill that tolerates missing thumbnail manifest"
affects: [72-02-tutorial-api, 72-03-tutorial-ui, 73-video-playback]

# Tech tracking
tech-stack:
  added: []
  patterns: [manual-prisma-migration-resolve, ffmpeg-thumbnail-extraction, gcloud-manifest-bridge]

key-files:
  created:
    - apps/agent/prisma/migrations/20260320221000_add_tutorial_thumbnail_url/migration.sql
    - apps/tutorials/scripts/upload-thumbnails.ts
    - apps/tutorials/output/tutorial-thumbnails-manifest.json
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/prisma/seed.ts
    - apps/tutorials/.gitignore
    - apps/tutorials/output/tutorials-manifest.json

key-decisions:
  - "Tutorial.thumbnailUrl remains nullable so browse UI can ship before every thumbnail is uploaded"
  - "Thumbnail backfill uses ffmpeg frame extraction at 1 second plus gcloud CLI uploads, matching the locked operational workflow"
  - "Seed reads tutorial-thumbnails-manifest.json opportunistically and falls back to null thumbnailUrl when absent"

patterns-established:
  - "Manifest bridge: upload-thumbnails.ts writes tutorial-thumbnails-manifest.json for seed.ts consumption"
  - "Forward-only drift workaround: manual SQL + prisma db execute + prisma migrate resolve"

requirements-completed: [BROWSE-04]

# Metrics
duration: 29 min
completed: 2026-03-20
---

# Phase 72 Plan 01: Tutorial Thumbnail Persistence Summary

**Nullable tutorial thumbnail storage with ffmpeg frame extraction, gcloud upload workflow, and seed-time manifest backfill for browse cards.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-03-20T22:05:48Z
- **Completed:** 2026-03-20T22:35:36Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added nullable `thumbnailUrl` support to the canonical `Tutorial` Prisma model with a forward-only migration.
- Created a repeatable thumbnail helper that extracts 1-second JPG frames, targets `gcloud storage cp`, and writes a slug-to-thumbnail manifest.
- Extended tutorial seed upserts to merge thumbnail URLs from manifest data while safely defaulting to `null` when the manifest is missing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add nullable Tutorial.thumbnailUrl with forward-only migration** - `921014c` (feat)
2. **Task 2: Create thumbnail extraction/upload helper and seed backfill path** - `5844618` (feat)

Additional auto-fix commit:

- `a8e1886` (fix) - track generated manifest outputs required by the backfill workflow

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added nullable `Tutorial.thumbnailUrl` field.
- `apps/agent/prisma/migrations/20260320221000_add_tutorial_thumbnail_url/migration.sql` - Forward-only SQL adding the new nullable column.
- `apps/tutorials/scripts/upload-thumbnails.ts` - Extracts 1-second JPG thumbnails, uploads with `gcloud storage cp`, and writes manifest output.
- `apps/tutorials/output/tutorial-thumbnails-manifest.json` - 17-entry slug-to-thumbnailUrl bridge artifact for seed backfill.
- `apps/agent/prisma/seed.ts` - Reads thumbnail manifest and merges `thumbnailUrl` into tutorial upserts with null fallback.
- `apps/tutorials/.gitignore` - Narrowly unignores committed tutorial manifest artifacts.
- `apps/tutorials/output/tutorials-manifest.json` - Existing video manifest now tracked alongside thumbnail manifest.

## Decisions Made
- Kept `thumbnailUrl` nullable so browse cards can render fallback media states before backfill completes.
- Used ffmpeg + gcloud CLI instead of Google API uploads for thumbnails to match the locked operational workflow from phase context.
- Made thumbnail manifest loading non-fatal in `seed.ts` so missing thumbnails do not block browse-page delivery.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worked around Prisma migration drift for the new thumbnail column**
- **Found during:** Task 1 (Add nullable Tutorial.thumbnailUrl with forward-only migration)
- **Issue:** `prisma migrate dev --create-only` was blocked by the existing `0_init` drift and Prisma requested a destructive reset.
- **Fix:** Added the schema field, authored the migration SQL manually, applied it with `prisma db execute`, and marked it applied with `prisma migrate resolve --applied`.
- **Files modified:** `apps/agent/prisma/schema.prisma`, `apps/agent/prisma/migrations/20260320221000_add_tutorial_thumbnail_url/migration.sql`
- **Verification:** `pnpm --filter agent exec prisma validate && pnpm --filter agent exec prisma migrate status`
- **Committed in:** `921014c`

**2. [Rule 3 - Blocking] Unignored tutorial manifest outputs so required bridge artifacts could be committed**
- **Found during:** Task 2 (Create thumbnail extraction/upload helper and seed backfill path)
- **Issue:** `apps/tutorials/output/` was gitignored, which prevented the required thumbnail manifest artifact from being versioned with the workflow.
- **Fix:** Narrowed `apps/tutorials/.gitignore` to ignore generated output by default while explicitly tracking `tutorials-manifest.json` and `tutorial-thumbnails-manifest.json`.
- **Files modified:** `apps/tutorials/.gitignore`, `apps/tutorials/output/tutorial-thumbnails-manifest.json`, `apps/tutorials/output/tutorials-manifest.json`
- **Verification:** `git status --short --untracked-files=all apps/tutorials/output`
- **Committed in:** `a8e1886`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both deviations were required to keep the migration and manifest-backed seed workflow forward-only and commit-ready. No scope creep.

## Issues Encountered
- The first `pnpm --filter agent exec tsx prisma/seed.ts` verification run hit the shell timeout; rerunning with a longer timeout completed successfully with `Tutorials: 17 of 17 seeded successfully`.

## User Setup Required
None - no additional manual configuration required for this plan.

## Next Phase Readiness
- Phase 72 browse API work can now expose nullable `thumbnailUrl` safely to the web app.
- Phase 72 UI work can render committed thumbnail manifest data without inventing a new media pipeline.
- Phase 73 playback work inherits a stable tutorial record shape containing both `gcsUrl` and `thumbnailUrl`.
