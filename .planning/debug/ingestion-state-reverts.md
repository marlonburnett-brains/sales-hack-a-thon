---
status: awaiting_human_verify
trigger: "ingestion-state-reverts: Document shows Ingested briefly then reverts, nothing on Templates page"
created: 2026-03-07T00:00:00Z
updated: 2026-03-07T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - AtlusAI URLs use google-drive:// format, not docs.google.com. Server-side Drive API MIME type lookup now resolves this.
test: Added enrichDocsWithDriveMetadata() that does parallel Drive API files.get calls
expecting: N/A - fix applied
next_action: Awaiting human verification

## Symptoms

expected: After clicking ingest on Discovery page, the document should appear as a template on the Templates page, and its "Ingested" status should persist on the Discovery page.
actual: Document shows "Ingested" briefly, then reverts. Nothing appears on Templates page.
errors: No visible errors reported by user - silent failure.
reproduction: Select a document on Discovery page, observe "Ingested" badge, go to Templates page (empty except "All Slide Layouts"), go back to Discovery - Ingested badge is gone.
started: Current behavior.

## Eliminated

## Evidence

- timestamp: 2026-03-07T00:01
  checked: discovery-client.tsx isIngested() function (line 191-196)
  found: Client checks `hashes.has(doc.slideId)` where hashes = ingestedHashes from server
  implication: Client compares slideId against contentHash values - these are different types of IDs

- timestamp: 2026-03-07T00:02
  checked: Agent browse endpoint (mastra/index.ts ~line 1617-1623)
  found: ingestedHashes = SlideEmbedding.contentHash values (SHA-256 hashes)
  implication: Server sends contentHash values but client needs slideObjectId values

- timestamp: 2026-03-07T00:03
  checked: Agent ingest endpoint (mastra/index.ts ~line 1826-1840)
  found: Stores slideObjectId = item.slideId, contentHash = computeContentHash(...)
  implication: slideObjectId field holds the AtlusAI document ID, contentHash is a SHA-256 hash - never match

- timestamp: 2026-03-07T00:04
  checked: Templates page (templates/page.tsx) and GET /templates endpoint
  found: Templates page queries Template table, but discovery ingestion only creates SlideEmbedding records with templateId='atlus-discovery'
  implication: Discovery items were never intended to appear on Templates page - this is a separate concern (Templates = Google Slides templates, Discovery = AtlusAI content)

- timestamp: 2026-03-07T00:05
  checked: User clarification on intended behavior
  found: Discovery-ingested Google Slides SHOULD create Template records. Non-Slides docs should not be ingestable.
  implication: Previous fix was wrong - need to rewrite ingestion to create Templates, not SlideEmbeddings

- timestamp: 2026-03-07T00:06
  checked: Add Template flow (POST /templates + POST /templates/:id/ingest)
  found: Creates Template record with Drive access check, then enqueues for ingestion via ingestionQueue
  implication: Discovery ingestion should reuse same pattern

- timestamp: 2026-03-07T00:07
  checked: Browse endpoint document metadata
  found: Each doc has metadata.url field; Google Slides URLs match docs.google.com/presentation/d/PRESENTATION_ID
  implication: Can detect Google Slides and extract presentationId from URL

- timestamp: 2026-03-07T00:08
  checked: User reports client-side Slides detection fails
  found: AtlusAI URLs use google-drive://FILE_ID format, not docs.google.com. All docs show as "Drive".
  implication: Must use Drive API MIME type lookup (application/vnd.google-apps.presentation) server-side

- timestamp: 2026-03-07T00:09
  checked: Existing Drive API integration (google-auth.ts)
  found: getDriveClient() and getPooledGoogleAuth() already available; Drive files.get supports mimeType field
  implication: Can do parallel files.get calls per document to check MIME type

## Resolution

root_cause: |
  1. Discovery ingestion created raw SlideEmbedding records instead of Template records,
     so ingested docs never appeared on the Templates page.
  2. Browse/search endpoints returned contentHash values as ingestedHashes, but client
     compared doc.slideId against them -- types never matched, so persisted status was lost.
  3. Non-Google Slides documents were ingestable even though only Slides can be templates.
fix: |
  AGENT (apps/agent/src/mastra/index.ts):
  - Added extractDriveFileId() to parse file IDs from google-drive://, docs.google.com, drive.google.com URLs
  - Added enrichDocsWithDriveMetadata() that does parallel Drive API files.get calls
    to resolve MIME types. Marks each doc with mimeType, isGoogleSlides, presentationId.
    Uses getPooledGoogleAuth() + getDriveClient() following existing patterns.
  - Browse and search endpoints call enrichDocsWithDriveMetadata() before returning
  - Rewrote POST /discovery/ingest to create Template records (with Drive access check)
    and enqueue for ingestion via ingestionQueue, matching the Add Template flow
  - Changed browse/search ingestedHashes to query Template.presentationId values
  - Removed unused imports (generateEmbedding, computeContentHash, toSql)

  CLIENT (apps/web/src/lib/api-client.ts):
  - Added mimeType, isGoogleSlides, googleSlidesUrl fields to DiscoveryDocument interface

  CLIENT (apps/web/src/app/(authenticated)/discovery/discovery-client.tsx):
  - isGoogleSlides() now uses server-provided doc.isGoogleSlides flag
  - getPresentationId() now returns doc.presentationId directly (set by server)
  - isIngested() checks presentationId against ingestedHashes (Template.presentationId)
  - handleBatchIngest() filters to Google Slides only, constructs googleSlidesUrl
  - handleRetry() similarly enriched
  - Checkbox hidden for non-Google Slides documents
  - Preview panel shows explanatory text for non-Slides documents
verification: Pending human verification
files_changed:
  - apps/agent/src/mastra/index.ts
  - apps/web/src/lib/api-client.ts
  - apps/web/src/app/(authenticated)/discovery/discovery-client.tsx
