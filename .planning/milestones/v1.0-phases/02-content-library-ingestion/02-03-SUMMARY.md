---
phase: 02-content-library-ingestion
plan: "03"
subsystem: database
tags: [prisma, image-registry, brand-guidelines, google-drive, google-slides-api, atlusai]

# Dependency graph
requires:
  - phase: 01-02
    provides: Prisma schema with WorkflowJob model, getDriveClient()/getSlidesClient() factories, T3 Env validation
provides:
  - apps/agent/prisma/schema.prisma: ImageAsset model for brand asset registry
  - apps/agent/src/ingestion/build-image-registry.ts: Script to discover and catalog curated image assets from Drive
  - apps/agent/src/ingestion/ingest-brand-guidelines.ts: Script to ingest Branded Basics as whole AtlusAI reference document
  - apps/agent/src/ingestion/manifest/image-registry-report.json: Generated report of curated image assets
affects: [04-forms, 07-slides, 10-polish]

# Tech tracking
tech-stack:
  added:
    - ImageAsset Prisma model with category/name/driveFileId(unique)/driveUrl/mimeType/tags fields
  patterns:
    - Image registry curation pattern: folder name matching (headshot/team/leadership/logo/brand/icon) with skip patterns for duplicates and stock photos
    - Idempotent upsert on driveFileId unique key for re-runnable ingestion
    - Brand guidelines ingested as whole-reference document (not split into structured rules) per RESEARCH.md recommendation
    - AtlusAI ingestion via Google Drive Doc creation (Drive folder auto-indexing strategy from Plan 02-01)
    - Graceful degradation for optional dependencies: dynamic import with try/catch for atlusai-client.ts

key-files:
  created:
    - apps/agent/prisma/schema.prisma (ImageAsset model added)
    - apps/agent/prisma/migrations/20260303214520_add_image_asset/migration.sql
    - apps/agent/src/ingestion/build-image-registry.ts
    - apps/agent/src/ingestion/ingest-brand-guidelines.ts
    - apps/agent/src/ingestion/manifest/image-registry-report.json
  modified: []

key-decisions:
  - "Brand guidelines kept as whole reference document in AtlusAI (not extracted into structured rules) per RESEARCH.md discretion recommendation"
  - "Image registry uses Prisma table (not JSON file) for structured queries by category/name — integrates with existing two-DB pattern"
  - "AtlusAI brand guide ingestion deferred: Google Docs API not enabled for service account project; re-run script after enabling API"
  - "No curated image folders found in accessible Drive scope — script handles gracefully with empty report; will populate when image folders become accessible"

patterns-established:
  - "Curated folder discovery: regex patterns against folder names to identify headshot/logo/icon/brand_element categories"
  - "Skip duplicate detection: numeric suffix (1).jpg, copy variants, stock photo indicators"
  - "Drive folder-based AtlusAI ingestion for whole-reference documents (brand guide pattern)"

requirements-completed: [CONT-03]

# Metrics
duration: 6min
completed: 2026-03-03
---

# Phase 2 Plan 03: ImageAsset Prisma registry and brand guidelines ingestion

**ImageAsset Prisma model with curated brand asset discovery from Google Drive, plus Branded Basics whole-reference document extraction for AtlusAI ingestion**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-03T21:44:48Z
- **Completed:** 2026-03-03T21:50:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- ImageAsset Prisma model added to schema with migration applied (category, name, driveFileId unique, driveUrl, mimeType, tags fields with indexes)
- Image registry build script discovers curated brand asset folders from Google Drive, filters duplicates/stock photos, and upserts into Prisma table
- Brand guidelines ingestion script finds "Branded Basics" presentation, extracts 738 chars of slide text content, prepares for AtlusAI ingestion as whole-reference document
- Both scripts are idempotent: image registry uses upsert on driveFileId, brand guide checks for existing Doc before creating

## Task Commits

Each task was committed atomically:

1. **Task 1: ImageAsset Prisma model and migration** - `6dc5596` (feat)
2. **Task 2: Image registry build script and brand guidelines ingestion** - `1a22b7a` (feat)

**Plan metadata:** `[pending]` (docs: complete plan)

## Files Created/Modified

- `apps/agent/prisma/schema.prisma` - Added ImageAsset model with category, name, driveFileId (unique), driveUrl, mimeType, tags fields and indexes on category/name
- `apps/agent/prisma/migrations/20260303214520_add_image_asset/migration.sql` - CREATE TABLE ImageAsset with unique index on driveFileId, indexes on category and name
- `apps/agent/src/ingestion/build-image-registry.ts` - Discovers curated image folders in Drive, filters duplicates, upserts into Prisma ImageAsset table, writes JSON report
- `apps/agent/src/ingestion/ingest-brand-guidelines.ts` - Finds Branded Basics presentation, extracts text from all slides, ingests as whole-reference document via AtlusAI Drive Doc strategy
- `apps/agent/src/ingestion/manifest/image-registry-report.json` - Generated report (currently empty — no curated image folders in accessible Drive scope)

## Decisions Made

- **Brand guidelines as whole reference:** Per RESEARCH.md Claude's Discretion recommendation, the Branded Basics document is ingested as a single whole-reference document, not split into structured rules. This preserves context between related brand guidelines.
- **Image registry uses Prisma table:** Chose Prisma table over JSON file per RESEARCH.md recommendation. Enables structured queries (WHERE category = 'headshot') and integrates with existing two-DB pattern.
- **AtlusAI ingestion via Drive Doc creation:** Brand guidelines ingestion uses the same Drive folder auto-indexing strategy discovered in Plan 02-01. Creates a Google Doc in the `_slide-level-ingestion` subfolder for AtlusAI to auto-index.
- **Graceful degradation for optional dependencies:** Brand guidelines script dynamically imports atlusai-client.ts at runtime; if Plan 02-01 hasn't completed, it logs a warning and provides re-run instructions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ingestDocument interface mismatch with atlusai-client.ts**
- **Found during:** Task 2 (brand guidelines ingestion)
- **Issue:** Initial implementation called `ingestDocument({ documentId, content, metadata })` but the actual interface from Plan 02-01's atlusai-client.ts expects `ingestDocument(doc: SlideDocument, driveFolderId: string)` with different field names
- **Fix:** Updated ingestToAtlusAI() to construct a SlideDocument-compatible object with presentationId, slideObjectId, folderPath, textContent fields mapped from the brand guidelines content
- **Files modified:** apps/agent/src/ingestion/ingest-brand-guidelines.ts
- **Verification:** Script runs successfully, creates ingestion folder in Drive, correctly defers ingestion when Docs API is not enabled
- **Committed in:** 1a22b7a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Interface mismatch fix was necessary for correct integration with Plan 02-01's atlusai-client.ts. No scope creep.

## Issues Encountered

- **Google Docs API not enabled:** The brand guidelines ingestion script successfully found and extracted content from the Branded Basics presentation but could not create the Google Doc in Drive because the Google Docs API is not enabled for the service account's GCP project (project 749490525472). The ingestion folder `_slide-level-ingestion` was created successfully in Drive, but the Doc creation step failed. Re-run the script after enabling the Docs API at the provided URL.
- **No curated image folders in accessible Drive scope:** The `GOOGLE_DRIVE_FOLDER_ID` points to the Hack-a-thon working folder which contains only `_templates` (with Branded Basics and master decks) and spike test files. The ~9,000 image files in `01 Resources/` are in the broader Shared Drive and not accessible via this folder ID. The image registry script handles this gracefully with an empty report and will populate when image folders become accessible.

## User Setup Required

The Google Docs API needs to be enabled for the service account's GCP project:
1. Visit: https://console.developers.google.com/apis/api/docs.googleapis.com/overview?project=749490525472
2. Click "Enable"
3. Wait a few minutes for propagation
4. Re-run: `cd apps/agent && npx tsx --require dotenv/config src/ingestion/ingest-brand-guidelines.ts`

## Next Phase Readiness

- ImageAsset Prisma model is migrated and available for Phase 4+ slide assembly
- Brand guidelines content (738 chars) is extractable and ready for AtlusAI ingestion once Docs API is enabled
- Image registry script is ready to populate when curated image folders are added to the accessible Drive scope
- Both scripts can be re-run idempotently as the content library grows during the hackathon

## Self-Check: PASSED

All 5 created files found on disk. Both task commits (6dc5596, 1a22b7a) verified in git history.

---
*Phase: 02-content-library-ingestion*
*Completed: 2026-03-03*
