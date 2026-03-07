# Phase 32: UX Polish - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Polished Discovery and Templates pages with visual document previews (thumbnails), consistent ingestion status indicators, and instant feedback on ingest actions. Covers UXP-01 through UXP-05. No new features — this is visual/UX refinement of existing pages.

</domain>

<decisions>
## Implementation Decisions

### Thumbnail presentation
- Top hero image layout on Discovery cards — full-width thumbnail at top, title and metadata below (gallery style)
- 16:9 widescreen aspect ratio to match Google Slides native ratio
- Thumbnail source: Google Slides API (first slide) for Slides documents, Drive API thumbnailLink for other file types (Docs, Sheets, PDF) — both cached in GCS
- Skeleton shimmer placeholder while thumbnail loads
- File-type icon as fallback when no thumbnail is available

### File type icons
- Use lucide FileIcon variants: FileSliders (Slides), FileText (Docs), FileSpreadsheet (Sheets), File (PDF)
- Google-branded colors: Slides=yellow, Docs=blue, Sheets=green, PDF=red
- Small corner badge (bottom-right of thumbnail) on cards that have thumbnails — shows file type even with a visual preview
- Non-ingestible file types (Docs, Sheets, PDF) shown at 80% opacity with no checkbox — still browseable but clearly secondary

### Status unification
- Shared component and shared logic across Discovery and Templates pages — extract existing TemplateStatusBadge + getTemplateStatus into shared ingestion-status component
- Discovery shows identical progress bar (Slide N of M) as Templates during active ingestion — full visual parity
- Discovery shows live template status (Ready, Stale, Failed, etc.) when document maps to an existing template — cross-reference by presentationId
- Slide count badge appears on Discovery cards for ingested documents — consistent with Template cards

### Ingest feedback (optimistic UI)
- Instant response on Ingest click: 1) Close dropdown menu, 2) Change card status to "Queued", 3) Show toast "Queued for ingestion" — all before server responds
- Duplicate prevention: client-side disable (button/checkbox immediately disabled on click) + server-side guard (reject if ingestionStatus is 'ingesting' or 'queued')
- Progress toast: initial "Queued" toast, then single updating toast for progress ("Ingesting slide 3 of 12..."), then success/error — reduces toast noise
- Batch ingestion: per-card independent status updates + single summary toast at batch completion ("5 of 6 documents ingested, 1 failed")

### Claude's Discretion
- Exact skeleton shimmer dimensions and animation
- Thumbnail image quality/size parameter for API calls
- GCS key naming convention for Drive thumbnails (vs existing slide-thumbnails/ pattern)
- Toast duration and positioning
- Error state visual treatment details

</decisions>

<specifics>
## Specific Ideas

- Discovery cards should feel like a visual gallery (Notion database gallery view reference for the hero image layout)
- File-type icons should feel immediately familiar to Google Workspace users through brand color association
- Status should be a single source of truth — user should never see different status for the same document on Discovery vs Templates

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gcs-thumbnails.ts`: GCS upload + Slides API thumbnail fetching already implemented — extend for document-level cover images and Drive API thumbnails
- `TemplateStatusBadge` + `template-utils.ts`: Status component and logic (7 states) — extract into shared component
- `Progress` component (shadcn/ui): Already used in template-card.tsx for ingestion progress bar
- `Skeleton` component (shadcn/ui): Available for shimmer loading states
- `Sonner` toast: Already integrated across both pages
- `Card` component (shadcn/ui): Used in template-card.tsx — Discovery cards are plain divs, could adopt

### Established Patterns
- Polling pattern: Both pages poll for ingestion progress at 2-second intervals
- Badge-based status: Colored badge with outline variant for status display
- Infinite scroll: Discovery uses IntersectionObserver with sentinel element
- Batch operations: Discovery has floating toolbar for multi-select actions

### Integration Points
- Discovery `DiscoveryDocument` type needs thumbnailUrl field added
- `browseDocumentsAction` / `searchDocumentsAction` need to return template status for ingested documents
- Agent ingestion endpoint needs server-side duplicate guard
- GCS bucket (GCS_THUMBNAIL_BUCKET) already configured in env

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-ux-polish*
*Context gathered: 2026-03-07*
