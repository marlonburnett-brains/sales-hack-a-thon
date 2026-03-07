# Phase 33: Slide Intelligence Foundation - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Ingestion pipeline produces rich AI descriptions and structured element maps per slide. Users can classify presentations as Template or Example with touch binding. Existing slides are automatically backfilled with descriptions and element maps. Requirements: SLI-01 through SLI-05, CCL-01 through CCL-04.

</domain>

<decisions>
## Implementation Decisions

### Slide descriptions
- Separate LLM call from classification (accuracy over cost) -- different prompt strategies for categorical vs narrative tasks
- Descriptions cover all four aspects: purpose, visual composition, key content, use cases
- Displayed as dedicated collapsible section in ClassificationPanel (above classification tags), expanded by default
- Slides missing descriptions are auto-flagged for re-ingestion -- no manual action needed
- Placeholder shows "Generating description..." while backfill is in progress

### Element maps
- Full structural detail: element ID, type (shape/text/image/table/group), position (x, y, width, height), content text, basic styling (font size, color, bold)
- Stored in separate `SlideElement` table (one row per element, FK to SlideEmbedding) -- needed for downstream programmatic slide manipulation (copy, edit content, adjust position, add/remove elements)
- Extracted during the same ingestion pass as slide text (Google Slides API already returns page element data)
- Visible in slide viewer UI with shrinkable/expandable thumbnail layout -- users need to verify element data and flag issues via AI chat

### Content classification
- Users can classify presentations as "Template" or "Example" from both template cards (quick action dropdown) and template detail/viewer page
- When classifying as "Example", touch type binding is required immediately (inline selector, can't save without selecting at least one touch)
- "Classify" amber badge on template cards for unclassified presentations -- consistent with existing badge patterns (Ready, Stale, Failed)
- New `contentClassification` enum field on Template model ('template' | 'example' | null) -- separate from existing touchTypes field which has different semantics
- Classification visible on template cards and detail views

### Backfill strategy
- Auto-detect on agent startup: find all slides with null description or null element map, queue their templates for re-ingestion
- Description-only pass for unchanged slides: run only description LLM call + element extraction, skip re-classification and re-embedding to preserve existing human ratings
- Fresh Google Slides API call during backfill for element extraction (one call per template via presentations.get)
- Background execution with summary toast on completion: "Backfill complete: N slides updated with descriptions"
- Templates show normal 'ingesting' status during backfill

### Claude's Discretion
- Exact description LLM prompt engineering and model selection
- SlideElement table schema details (column types, indexes)
- Element map viewer UI layout specifics (how thumbnail resize works)
- Backfill queue ordering and concurrency
- Rate limiting between description LLM calls
- Toast duration and backfill progress polling interval

</decisions>

<specifics>
## Specific Ideas

- Element maps are foundational for future programmatic slide manipulation: "Once we identify which slides to use in composition structure, use AI to change contents on them -- creating copies, changing content, adjusting position, removing unneeded content, adding more content." This is the primary use case for element maps.
- The system should be fully automatic -- slides missing descriptions get auto-flagged and backfilled without user intervention (consistent with Phase 20's "add template and walk away" philosophy)
- Separate LLM call for descriptions ensures each prompt is optimized for its task type (classification = structured enums, description = open narrative)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/ingestion/ingest-template.ts`: Main orchestrator -- extend with description generation step and element extraction
- `apps/agent/src/ingestion/classify-metadata.ts`: LLM classification with Google GenAI structured output -- pattern for the new description LLM call
- `apps/agent/src/lib/slide-extractor.ts`: Google Slides API extraction -- already reads page elements, currently only captures text content
- `apps/web/src/components/slide-viewer/classification-panel.tsx`: Side panel with classification tags + rating -- add description section here
- `apps/web/src/components/template-status-badge.tsx`: Badge component with status variants -- add "Classify" amber variant
- `apps/web/src/components/template-card.tsx`: Template card with actions dropdown -- add classification quick action
- `apps/agent/src/ingestion/smart-merge.ts`: Content hash merge logic -- extend to handle description-only backfill pass

### Established Patterns
- Raw SQL for SlideEmbedding upserts (Prisma can't handle vector type) -- new SlideElement table can use normal Prisma operations
- JSON structured output via Google GenAI `responseSchema` -- use same pattern for description generation
- `classificationJson` TEXT column for multi-value JSON data -- precedent for JSON storage
- Sequential ingestion with 300ms delay between API calls
- Progress tracking via Template.ingestionProgress JSON field

### Integration Points
- SlideEmbedding model: Add `description` TEXT column for AI-generated descriptions
- New `SlideElement` model: FK to SlideEmbedding, stores per-element structural data
- Template model: Add `contentClassification` enum field
- slide-extractor.ts: Extend to return full page element data (not just text)
- ingest-template.ts: Add description generation step after classification + element storage step
- Agent startup: Add backfill detection and queue logic
- Prisma schema migration for all new fields/models

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 33-slide-intelligence-foundation*
*Context gathered: 2026-03-07*
