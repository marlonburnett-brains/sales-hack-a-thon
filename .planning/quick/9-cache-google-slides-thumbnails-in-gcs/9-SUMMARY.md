---
phase: quick-9
plan: 01
subsystem: agent/thumbnails
tags: [gcs, caching, thumbnails, performance]
dependency_graph:
  requires: [googleapis, prisma, google-auth]
  provides: [gcs-thumbnail-cache]
  affects: [thumbnail-endpoint, ingestion-pipeline]
tech_stack:
  added: []
  patterns: [gcs-upload-via-googleapis, ttl-cache, batch-rate-limiting]
key_files:
  created:
    - apps/agent/src/lib/gcs-thumbnails.ts
    - apps/agent/prisma/migrations/20260307001002_add_thumbnail_cache/migration.sql
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/env.ts
    - apps/agent/src/ingestion/ingest-template.ts
    - apps/agent/src/mastra/index.ts
decisions:
  - Used googleapis storage v1 (not @google-cloud/storage) to avoid new dependencies
  - Forward-only migration with resolve --applied due to 0_init checksum drift
  - 7-day TTL for thumbnail freshness
metrics:
  duration: 4min
  tasks: 2
  files: 6
  completed: "2026-03-07T03:13:00Z"
---

# Quick Task 9: Cache Google Slides Thumbnails in GCS Summary

GCS-backed thumbnail cache with 7-day TTL eliminating live Slides API calls from the thumbnail endpoint hot path.

## What Was Done

### Task 1: Schema migration + GCS thumbnail helper
**Commit:** `81e6eab`

- Added `thumbnailUrl` (String?) and `thumbnailFetchedAt` (DateTime?) to SlideEmbedding model
- Created forward-only migration `20260307001002_add_thumbnail_cache` applied via `resolve --applied`
- Added `GCS_THUMBNAIL_BUCKET` as optional env var in env.ts
- Created `gcs-thumbnails.ts` with:
  - `getStorageClient()` using googleapis storage v1 with service account auth
  - `uploadThumbnailToGCS()` for uploading PNG buffers with public read ACL
  - `cacheThumbnailsForTemplate()` for batch caching with rate limiting (5 per 1.5s)
  - `THUMBNAIL_TTL_MS` constant (7 days)

### Task 2: Wire GCS cache into ingestion and thumbnail endpoint
**Commit:** `40fc6d6`

- Added best-effort thumbnail caching step after ingestion completes (non-fatal on failure)
- Rewrote GET `/templates/:id/thumbnails` endpoint:
  - Cache HIT: returns GCS URLs instantly (zero Slides API calls)
  - Cache MISS/stale: refreshes via `cacheThumbnailsForTemplate`, re-queries DB
  - Fallback: live Slides API fetch for any still-uncached slides (backward compat)
- Response shape unchanged: `{ thumbnails: Array<{ slideObjectId, slideIndex, thumbnailUrl }> }`

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

1. `npx tsc --noEmit` -- no new type errors (all errors are pre-existing)
2. `npx prisma migrate status` -- database schema is up to date (9 migrations applied)
3. Manual verification pending: set GCS_THUMBNAIL_BUCKET in .env and re-ingest a template
