# Phase 20: Slide Ingestion Agent - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can trigger AI-powered ingestion that extracts text from each slide in a Google Slides template, generates vector embeddings via Vertex AI, and classifies each slide by industry, solution pillar, persona, funnel stage, content type, and slide category into Supabase pgvector. Ingestion auto-triggers on template add and on staleness detection. Preview, rating, and similarity search are separate phases (Phase 21).

</domain>

<decisions>
## Implementation Decisions

### Progress experience
- Inline progress on the template card itself: progress bar + "Slide N of M" text
- Ingestion runs server-side in background -- user can navigate away and return to see current progress
- Completion notification: Sonner toast ("AtlusAI Master Deck ingested (12 slides)") + card updates to Ready status with slide count
- If individual slides fail (empty, API error): skip and continue, show count at end ("10 of 12 slides ingested, 2 skipped")

### Classification depth
- Multi-value classification: each slide can have MULTIPLE industries, solution pillars, personas, funnel stages, and slide categories (stored as JSON arrays in TEXT columns)
- Single overall confidence score per slide (0-100%), not per-field
- All slides classified including low-content slides (title, divider) -- they're useful for deck assembly ordering

### Ingestion trigger & flow
- Auto-ingest on add: when user adds a template and access is confirmed, ingestion starts automatically
- Auto-ingest on stale: system periodically checks Drive modifiedTime for all templates and auto-re-ingests stale ones (background polling)
- Sequential processing: one template at a time (queue model) to avoid Google API rate limits
- Manual "Re-ingest" button NOT needed -- system handles staleness automatically

### Re-ingestion behavior (smart merge)
- Smart merge strategy: track slides by content hash (not slide index position), compare with previous ingestion
- Unchanged slides: preserve all data including human ratings from Phase 21
- Reordered slides (same content, different index): silently update slide index positions, no notification
- Changed slides: re-classify with new content, keep previous human rating as reference but lower confidence and flag for re-review
- Removed slides: soft delete (mark as 'archived'), excluded from similarity search by default, preserves history and ratings
- New slides: ingest and classify normally

### Claude's Discretion
- Background polling interval for staleness detection
- Rate limiting between API calls (200-500ms delays based on existing patterns)
- Content hash algorithm for smart merge
- Exact progress bar styling and animation
- Queue implementation details for sequential processing
- How to store "previous rating reference" on changed slides

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/lib/slide-extractor.ts`: Extracts text from slides via Google Slides API (handles tables, groups, speaker notes, low-content detection)
- `apps/agent/src/ingestion/classify-metadata.ts`: Classifies slides with Gemini 2.5 Flash structured output using existing taxonomy
- `packages/schemas/constants.ts`: All taxonomy constants (11 industries, 6 solution pillars, 9 personas, 4 funnel stages, 14 slide categories, 62 subsectors)
- `packages/schemas/llm/slide-metadata.ts`: SlideMetadataSchema with multi-value arrays -- matches the multi-value classification decision
- `apps/agent/src/lib/google-auth.ts`: Service account auth with getSlidesClient(), getDriveClient()
- `apps/web/src/lib/api-client.ts`: Typed fetch wrapper with Bearer token auth for web-to-agent communication
- `apps/web/src/lib/actions/template-actions.ts`: Server Actions for template mutations with revalidatePath
- Template UI components: TemplateCard, TemplateForm, TemplateFilters, TemplateTable, TemplateStatusBadge

### Established Patterns
- Mastra workflows with createWorkflow()/createStep() for multi-step pipelines
- Mastra suspend/resume for HITL checkpoints (adaptable for progress tracking)
- GoogleGenAI initialization: `new GoogleGenAI({ vertexai: true, project, location })`
- Prisma with Supabase PostgreSQL, forward-only migrations
- registerApiRoute() for agent HTTP endpoints
- Sonner toast for notifications in web app
- 200ms rate limiting between Google API calls (from existing ingestion scripts)

### Integration Points
- `apps/agent/src/mastra/index.ts`: Add ingestion endpoint (POST /templates/:id/ingest) and background polling
- `SlideEmbedding` Prisma model: Already migrated with pgvector, HNSW index, all classification columns
- `Template` model: Has lastIngestedAt, sourceModifiedAt, slideCount fields for tracking ingestion state
- Template cards in web UI: Add inline progress display and auto-trigger on successful add
- Schema migration needed: Add `archived` boolean and `contentHash` field to SlideEmbedding for smart merge + soft delete

</code_context>

<specifics>
## Specific Ideas

- Slide identity is by content hash, not position index -- slides can be reordered in Google Slides without triggering re-classification
- Changed slides should keep previous human rating as a "reference" with lowered confidence, clearly flagged as needing re-review (not silently accepted)
- The system should be fully automatic: add a template and walk away, come back to see it fully ingested and classified

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 20-slide-ingestion-agent*
*Context gathered: 2026-03-05*
