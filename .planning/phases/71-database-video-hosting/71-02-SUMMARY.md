---
phase: 71-database-video-hosting
plan: 02
subsystem: database, infra
tags: [gcs, prisma, seed, ffprobe, googleapis, video-hosting]

# Dependency graph
requires:
  - phase: 71-01
    provides: "Tutorial, TutorialView, AppFeedback Prisma models and migration"
provides:
  - "17 tutorial MP4 files publicly hosted on GCS with stable URLs"
  - "tutorials-manifest.json bridging upload metadata to seed script"
  - "17 Tutorial rows seeded in database with full metadata from fixtures + manifest"
  - "Idempotent seed script for Tutorial table"
affects: [72-tutorial-browsing, 73-video-playback]

# Tech tracking
tech-stack:
  added: []
  patterns: [googleapis-storage-upload, ffprobe-duration-probing, manifest-bridge-pattern]

key-files:
  created:
    - apps/tutorials/scripts/upload-to-gcs.ts
    - apps/tutorials/output/tutorials-manifest.json
  modified:
    - apps/agent/prisma/seed.ts
    - apps/tutorials/package.json

key-decisions:
  - "Used VERTEX_SERVICE_ACCOUNT_KEY for GCS uploads per CLAUDE.md credential separation"
  - "Sequential file upload (not parallel) to avoid timeout issues with 5-19MB files"
  - "Hardcoded TUTORIAL_CATALOG in seed.ts for category/sortOrder mapping (per CONTEXT.md decision)"
  - "Manifest-bridge pattern: upload script writes JSON manifest consumed by seed script"

patterns-established:
  - "Manifest bridge: upload-to-gcs.ts -> tutorials-manifest.json -> seed.ts"
  - "GCS public video URL format: https://storage.googleapis.com/{bucket}/{slug}.mp4"

requirements-completed: [HOST-01, HOST-03]

# Metrics
duration: 12min
completed: 2026-03-20
---

# Phase 71 Plan 02: GCS Upload & Database Seeding Summary

**GCS upload automation for 17 tutorial MP4s with ffprobe duration probing, manifest generation, and Prisma seed script extending Tutorial table from fixtures + manifest**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-20T20:55:00Z
- **Completed:** 2026-03-20T21:07:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created GCS upload script using googleapis storage client with ffprobe duration probing for accurate video lengths
- Generated tutorials-manifest.json with 17 entries (slug, gcsUrl, durationSec) bridging upload output to seed input
- Extended Prisma seed script with Tutorial upserts merging catalog metadata, fixture data, and manifest data
- All 17 MP4 files publicly accessible at stable GCS URLs (HTTP/2 200, Content-Type: video/mp4)
- Database seeded with 17 Tutorial rows containing complete metadata (title, description, category, gcsUrl, durationSec, sortOrder, stepCount)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GCS upload script with ffprobe duration probing and manifest generation** - `aff0814` (feat)
2. **Task 2: Extend Prisma seed script with Tutorial upserts from fixtures + manifest** - `a9db6aa` (feat)
3. **Task 3: Verify GCS upload and database seeding end-to-end** - checkpoint:human-verify (approved)

## Files Created/Modified
- `apps/tutorials/scripts/upload-to-gcs.ts` - GCS upload automation with ffprobe duration probing and manifest generation
- `apps/tutorials/output/tutorials-manifest.json` - 17-entry manifest with slug, gcsUrl, durationSec
- `apps/agent/prisma/seed.ts` - Extended with Tutorial upserts from TUTORIAL_CATALOG + fixtures + manifest
- `apps/tutorials/package.json` - Added tsx script dependency

## Decisions Made
- Used VERTEX_SERVICE_ACCOUNT_KEY for all GCS operations (per CLAUDE.md credential separation rule)
- Sequential file uploads to avoid timeout issues with large video files (5-19MB each)
- Hardcoded TUTORIAL_CATALOG array in seed.ts with category and sortOrder mappings (per CONTEXT.md decision to avoid external config)
- Manifest-bridge pattern: upload script outputs JSON consumed by seed script, decoupling the two operations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** GCS bucket setup was completed during the checkpoint verification:
- GCS bucket `atlusdeck-tutorials` created with uniform bucket-level public access
- `allUsers` granted objectViewer role for public read access
- CORS policy configured allowing Range header for HTML5 video byte-range requests
- Environment variable `GCS_TUTORIAL_BUCKET` set (default: "atlusdeck-tutorials")

## Verification Results

Checkpoint approved with the following confirmation:
- 17/17 MP4 files uploaded to gs://atlusdeck-tutorials bucket
- GCS URLs return HTTP/2 200 with Content-Type: video/mp4
- Prisma seed completed: "Tutorials: 17 of 17 seeded successfully"
- Bucket has public read access (allUsers objectViewer) and CORS configured
- Seed is idempotent (re-running produces same result)

## Next Phase Readiness
- All 17 tutorial videos are publicly accessible via GCS URLs -- ready for HTML5 video player in Phase 73
- Tutorial table has complete metadata -- ready for browse page in Phase 72
- Phase 71 fully complete (both plans) -- Phase 72 can begin

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 71-database-video-hosting*
*Completed: 2026-03-20*
