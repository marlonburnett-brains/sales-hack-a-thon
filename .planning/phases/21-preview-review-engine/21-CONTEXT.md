# Phase 21: Preview & Review Engine - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can visually preview ingested slides at presentation size, review AI-assigned classification tags, provide thumbs-up/down ratings with inline tag corrections, and find similar slides across all ingested templates via vector similarity search. Deck assembly, slide editing, and analytics are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### Slide preview layout
- Full-page viewer at dedicated route (/templates/:id/slides)
- Slide rendered as Google Slides API thumbnail images (up to 1600px wide)
- Horizontal thumbnail strip at bottom for navigation between slides (like Google Slides presenter view)
- Left/right arrow buttons + keyboard arrow key navigation
- Clicking a thumbnail jumps directly to that slide
- Slide counter shows position (e.g., "3 of 12")

### Classification display
- Right sidebar panel (~30% width) next to the slide (~70% width)
- Classification tags displayed as grouped tag chips by category: Industry, Pillar, Persona, Stage, Content Type
- Each category has a label header with colored chips for multi-value tags
- Confidence score shown as percentage per slide (e.g., "85% confident") to help prioritize review

### Rating interaction
- Single overall thumbs up/down rating per slide (not per-category)
- Thumbs up = "classification correct" — all tags accepted as-is
- Thumbs down = "needs correction" — all tag categories become editable
- Corrections update pgvector metadata immediately so next page load reflects changes

### Inline tag editing
- Claude's Discretion: editing UX for tag correction (dropdown selectors, click-to-remove + add, or hybrid) — Claude picks based on taxonomy size and multi-value nature

### Similarity search
- "Find Similar" button in the right sidebar panel when viewing a slide
- Also a dedicated search page (Slide Library) for cross-template browsing
- Active (non-archived) slides only in results — matches Phase 20 decision
- Claude's Discretion: results display format (thumbnail grid vs list) and default result count

### Navigation & entry points
- Click template card in grid/table navigates to /templates/:id/slides (card already has cursor-pointer)
- Also add "View Slides" option in the existing dropdown menu for discoverability
- Per-template viewer as primary: browse one deck's slides sequentially
- All-slides "Slide Library" as a new sidebar nav item alongside Deals and Templates
- Default view: unfiltered (slides in presentation order), with optional filter by review status (unreviewed, approved, needs correction)

### Claude's Discretion
- Thumbnail strip styling, spacing, and active-slide highlighting
- Right sidebar panel width and responsive behavior
- Tag chip color scheme per category
- Keyboard shortcuts beyond arrow keys (e.g., T for thumbs up, R for reject)
- Slide Library page layout, filtering, and sorting implementation
- Similarity search result count and display format
- Loading states and skeleton UI for thumbnail fetching
- Mobile/responsive behavior for the viewer

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TemplateCard` (template-card.tsx): Already has cursor-pointer, progress polling, status badges — add click-to-navigate
- `TemplateStatusBadge` (template-status-badge.tsx): Reuse for status indicators in slide viewer
- `Progress` (ui/progress): shadcn progress bar, reusable for confidence display
- `AlertDialog`, `Dialog` (shadcn): For confirmation flows and modals
- `Sidebar` (sidebar.tsx): Existing collapsible sidebar — add Slide Library nav item
- Taxonomy constants (packages/schemas/constants.ts): 11 industries, 6 pillars, 9 personas, 4 stages, 14 slide categories — populate editing dropdowns
- `SlideMetadataSchema` (packages/schemas/llm/slide-metadata.ts): Multi-value array schema for classifications
- `generateEmbedding` (apps/agent/src/ingestion/embed-slide.ts): 768-dim Vertex AI embeddings for similarity queries
- `api-client.ts`: Typed fetch wrapper with Bearer token auth for web-to-agent calls

### Established Patterns
- Server Components for layout, Client Components ("use client") for interactive elements
- Server Actions for mutations (template-actions.ts pattern)
- Prisma raw SQL for pgvector operations (INSERT/UPDATE with ::vector cast)
- Sonner toast for notifications
- localStorage for persisting user preferences (view mode)
- Polling pattern for async operations (ingestion progress polling in TemplateCard)

### Integration Points
- `apps/web/src/app/(authenticated)/templates/[id]/slides/`: New route for per-template viewer
- `apps/web/src/app/(authenticated)/slides/`: New route for Slide Library (all-slides browser)
- `SlideEmbedding` model: Has all classification columns, contentHash, archived, needsReReview, confidence, classificationJson
- Agent API: Need new endpoints for similarity search (pgvector cosine distance query) and tag update
- Sidebar component: Add "Slide Library" nav item with icon
- Google Slides API: Fetch slide thumbnail images via presentations.pages.getThumbnail

</code_context>

<specifics>
## Specific Ideas

- Confidence score helps sellers prioritize which slides to review — show low confidence first when filtering
- "Find Similar" is the cross-template bridge — per-template viewer stays focused on one deck, similarity search connects them
- The viewer should feel like a focused review tool, not a general-purpose slide editor — rate and move on quickly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-preview-review-engine*
*Context gathered: 2026-03-06*
