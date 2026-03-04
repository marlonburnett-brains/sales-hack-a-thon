# Phase 12: Content Library Re-ingestion - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-run the Phase 2 ingestion pipeline with access fixes so AtlusAI has complete coverage. This means: granting Drive service account access to shortcut target files, enabling Google Docs API on the GCP project, re-running the full ingestion pipeline (discover → extract → classify → ingest), ingesting brand guidelines as a whole-reference document, populating the image registry, and verifying coverage across all 11 industries.

No new pipeline code or UI changes — this phase fixes access blockers and re-runs existing infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Drive access approach
- Manual sharing: grant the service account email viewer access to each Shared Drive or folder containing shortcut targets (Meet Lumenalta, L2 capability decks, 1-2 pager templates, case study decks)
- If some shortcut targets remain inaccessible after grants, log them as warnings and proceed — don't block the pipeline on 100% access
- Re-run `discover-content.ts` after access grants to validate the expanded discovery set before proceeding to extraction

### Brand guidelines handling
- Enable Google Docs API on GCP project 749490525472
- Re-run `ingest-brand-guidelines.ts` which already handles Google Slides format (concatenates all slides' text as one document)
- If Branded Basics is a Google Doc (not Slides), add Docs API text extraction to the script
- Ingest as single AtlusAI document with `content_type: brand_guide` (not slide-level)

### Image registry population
- Re-run `build-image-registry.ts` after service account has expanded access
- If curated image folders still aren't accessible, accept empty registry — images are served from Drive URLs at assembly time and the system functions without a pre-populated registry
- Don't attempt to catalog the ~9,000 files in `01 Resources/` — only curate accessible subsets (headshots, logos, brand icons)

### Coverage gap handling
- Accept industry coverage gaps if content doesn't exist in Drive — don't create synthetic content
- Coverage report documents gaps for the content team
- RAG fallback tiers (industry-specific → broad → cross-industry) already handle missing content gracefully at retrieval time

### Claude's Discretion
- Whether to update `discover-content.ts` to better handle access errors (currently warns and continues)
- Manifest cleanup strategy (reset existing manifest vs append new entries)
- Batch sizes and rate limiting for re-ingestion run
- Whether to run full pipeline or manifest-only first for validation

</decisions>

<specifics>
## Specific Ideas

- Phase 2 coverage report shows only 5 presentations discovered (200A Master Deck, Branded Basics, + 3 spike tests) — the bulk of content lives behind shortcuts the service account couldn't follow
- Known shortcut targets from Phase 2 CONTEXT: Meet Lumenalta, NBCUniversal, Bleecker Street Group, Master Solutions, 2026 GTM Solutions, Alaska Airlines, MasterControl, Encompass, WSA, Satellite Industries, Gravie
- GCP project ID for API enablement: 749490525472
- AtlusAI project ID: b455bbd9-18c7-409d-8454-24e79591ee97
- All 11 industries currently show 0 case studies in coverage report

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/ingestion/run-ingestion.ts`: Full 5-phase pipeline (A-E) with --manifest-only and --ingest-only modes
- `apps/agent/src/ingestion/discover-content.ts`: Recursive Drive traversal with shortcut resolution and folder shortcuts
- `apps/agent/src/ingestion/extract-slides.ts`: Google Slides API text extraction per slide
- `apps/agent/src/ingestion/classify-metadata.ts`: Gemini-based metadata classification
- `apps/agent/src/ingestion/ingest-brand-guidelines.ts`: Brand guide discovery and ingestion script
- `apps/agent/src/ingestion/build-image-registry.ts`: Image folder discovery and Prisma registry builder
- `apps/agent/src/lib/atlusai-client.ts`: AtlusAI ingestion via Google Drive Docs creation
- `apps/agent/src/lib/slide-extractor.ts`: Slide text + speaker notes extraction
- `apps/agent/src/lib/ingestion-pipeline.ts`: Re-ingestion pipeline for generated/approved decks (feedback loop)

### Established Patterns
- Idempotent ingestion: content-manifest.json tracks status per slide (pending/ingested/error)
- Content type overrides: `CONTENT_TYPE_OVERRIDES` array matches known presentation names to touch types
- Coverage report: automatic gap detection against all 11 INDUSTRIES
- Batch processing with rate limiting (10 per batch, 500ms delay)

### Integration Points
- Google Drive API v3 via `getDriveClient()` from `apps/agent/src/lib/google-auth.ts`
- Google Slides API via `getSlidesClient()` for presentation content reading
- Google Docs API (needs enabling) for Branded Basics text extraction
- Gemini API via `GEMINI_API_KEY` for slide classification
- Prisma `ImageAsset` model for image registry storage
- AtlusAI auto-indexes documents created in the connected Drive folder

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-content-library-reingestion*
*Context gathered: 2026-03-04*
