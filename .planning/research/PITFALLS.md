# Pitfalls Research

**Domain:** v1.5 Review Polish & Deck Intelligence -- adding thumbnails, ingestion consistency, optimistic UI, rich descriptions, element maps, classification, and deck structures to existing AI sales platform
**Researched:** 2026-03-07
**Confidence:** HIGH (codebase-verified pitfalls with Google API documentation backing)

## Critical Pitfalls

### Pitfall 1: Drive thumbnailLink URLs Expire Within Hours and Have CORS Restrictions

**What goes wrong:**
Google Drive API `thumbnailLink` fields contain short-lived, authenticated URLs that expire after a few hours (variable, sometimes less than a day). If you store these URLs directly in the database for Discovery document card thumbnails, users see broken images the next session. The URLs also have CORS restrictions -- they cannot be fetched directly from a browser; they require server-side proxying or credential injection. Developers test it, see it work, ship it, then discover broken images the next day.

**Why it happens:**
Google intentionally makes `thumbnailLink` short-lived as a security measure. The field is "only populated when the requesting app can access the file's content" and the URL itself requires an authenticated client. A plain browser `<img src>` tag will get a 404 or 403.

**How to avoid:**
Follow the pattern already established for slide thumbnails in `gcs-thumbnails.ts`: fetch the thumbnail server-side using authenticated credentials, upload to GCS as a permanent public PNG, store the GCS URL. For Discovery document cards, extend `DiscoveryDocCache` with a `thumbnailGcsUrl` column. Trigger thumbnail caching during the `enrichDocsWithDriveMetadata()` call that already runs on browse/search. Use the same `THUMBNAIL_TTL_MS` (7 days) refresh cycle. Never store raw `thumbnailLink` URLs as the display URL.

**Warning signs:**
- Thumbnail images load on first visit but break on subsequent visits
- 404 or 403 errors in browser network tab for `lh3.googleusercontent.com` URLs
- Images work for the developer but not for other users (different auth context)

**Phase to address:**
Discovery document thumbnails phase (first phase). Solve this before any UI card rendering work.

---

### Pitfall 2: Optimistic UI State Overwritten by Background Polling

**What goes wrong:**
When a user clicks "Ingest" on a template card, the UI optimistically sets status to "Queued". Meanwhile, a background polling interval fetches template status from the server. The poll response arrives before the server has processed the ingest request, so it returns `ingestionStatus: "idle"`. The poll overwrites the optimistic state, making the button appear to reset. User clicks again, gets "already ingesting" error toast. This exact issue is documented in REVIEW-ISSUES.md #3 and is a well-known pattern (RTK Query issue #1512, various React Query discussions).

**Why it happens:**
The existing ingestion flow uses polling (`getDiscoveryIngestionProgressAction` and template status polling) with no coordination between optimistic state and poll responses. The in-memory ingestion queue (`ingestionQueue.ts`) processes asynchronously, so there is a window between "client sends ingest request" and "server updates Template.ingestionStatus in DB" where polls return stale data.

**How to avoid:**
1. **Monotonic status transitions**: The codebase already uses a monotonic set pattern for stepper progress (PROJECT.md key decisions). Apply the same principle: ingestion status can only move forward (idle -> queued -> ingesting -> done), never backward. Poll responses that would regress state are ignored.
2. **Timestamp-based stale rejection**: Record a `lastOptimisticAt` timestamp when applying optimistic updates. Discard poll responses initiated before that timestamp.
3. **Disable the action button immediately** on click (before the async call), and use a local ref or `useOptimistic` to track pending state independently from server state. Note: `useOptimistic` alone does not solve race conditions -- it needs to be combined with the monotonic transition guard.
4. **Return the updated status from the ingest endpoint** so the client can immediately reconcile without waiting for the next poll.

**Warning signs:**
- Status "flickers" between states (queued -> idle -> queued)
- Users report clicking ingest "doesn't work" on first try
- Error toasts about duplicate ingestion appear
- Template card briefly shows "Ready" during active ingestion

**Phase to address:**
Optimistic UI / immediate feedback phase. Must be solved before ingestion status consistency work, as the consistency fix depends on clean state transitions.

---

### Pitfall 3: Google Slides API Element Extraction Produces Massive Response Payloads

**What goes wrong:**
`presentations.get` returns the full presentation resource including every page element's properties, text runs, transforms, styles, table cells, and embedded image references. For a 50-slide presentation with complex layouts, this response can be 5-15 MB of JSON. For 100+ slides, it can exceed 30 MB. Storing the full element map per slide in a `TEXT` column in PostgreSQL creates massive row sizes that degrade query performance, especially when joined with vector search results from SlideEmbedding.

**Why it happens:**
The Google Slides API returns deeply nested objects for each element: `PageElement` contains `Transform`, `Size`, `ElementProperties`, and then type-specific fields (`TextBox` with `TextRun[]` with `TextStyle`, `Table` with `TableCell[]` each with their own text/style, etc.). Developers fetch the full response for element mapping without realizing the data volume.

**How to avoid:**
1. **Use field masking on presentations.get**: Request only needed fields via the `fields` parameter. For element maps, something like: `slides(objectId,pageElements(objectId,size,transform,shape(shapeType,placeholder),table(rows,columns),image(contentUrl),description))`. Official docs confirm this can reduce response size by 60-80%.
2. **Store a reduced element map**: Extract and store only: element ID, type, placeholder type (if any), bounding box (position + size), and content summary. Do NOT store full text runs or detailed style information in the element map (text content is already stored in `contentText` on SlideEmbedding).
3. **Separate element map from embedding row**: Store element maps in a new `SlideElementMap` table or a JSONB column on a separate table, NOT in the same row as the 768-dim vector. This prevents element map queries from pulling vector data and vice versa.
4. **Use one presentations.get call per template, not per-slide pages.get**: A single field-masked `presentations.get` counts as 1 regular read (quota: 600/min/user) and returns all slide elements. This is far cheaper than N `pages.get` calls.

**Warning signs:**
- Ingestion times increase dramatically for larger presentations
- Memory spikes on the Railway agent container during ingestion
- Prisma query timeouts when loading slide detail views
- Database bloat: check `pg_total_relation_size('SlideEmbedding')`

**Phase to address:**
Element map extraction phase. Design the storage schema BEFORE implementing extraction.

---

### Pitfall 4: Ingestion Status Inconsistency Between Discovery and Templates Pages

**What goes wrong:**
The Discovery page and Templates page independently derive status using different logic. Discovery checks `ingestedHashes` (a set of `Template.presentationId` values), which only reflects whether a Template record exists. Templates checks `Template.ingestionStatus`, which reflects the actual pipeline state. Result: Discovery shows "Ingested" the moment the Template record is created (before any slides are processed), while Templates correctly shows "Ingesting... Slide 4 of 21". This is documented in REVIEW-ISSUES.md #2 and partially caused by the recent ingestion rewrite (see `ingestion-state-reverts.md`).

**Why it happens:**
The ingestion flow creates a Template record first, then enqueues it for processing. The Template record's existence immediately marks it as "ingested" in Discovery's dedup check (`ingestedHashes` includes all Template `presentationId` values regardless of ingestion status). There is no shared status abstraction -- each page implements its own status derivation logic independently.

**How to avoid:**
1. **Single source of truth**: Both pages should derive status from `Template.ingestionStatus`. Discovery should check not just "does Template exist?" but "does Template exist AND ingestionStatus === 'idle' AND lastIngestedAt IS NOT NULL?".
2. **Three-state model for Discovery**: `not_ingested` (no Template record), `ingesting` (Template exists, ingestionStatus !== 'idle' OR lastIngestedAt is null), `ingested` (Template exists, ingestionStatus === 'idle', lastIngestedAt set).
3. **Shared polling endpoint**: Create a single `/ingestion-status` endpoint that returns status for multiple templates by presentationId, usable by both pages. This eliminates divergent status logic.
4. **Include ingestion progress in Discovery response**: When the browse/search endpoint returns documents, include the corresponding Template's ingestionStatus and ingestionProgress for any that have been started.

**Warning signs:**
- Discovery shows "Ingested" badge while Templates shows "Ingesting..."
- Users go to Templates page expecting to see a completed template but find it mid-ingestion
- Confusion about whether ingestion actually succeeded

**Phase to address:**
Ingestion status consistency phase. Must come after the optimistic UI fix (Pitfall 2) since both relate to status display.

---

### Pitfall 5: Prisma Migration With New Models Alongside Existing pgvector Columns

**What goes wrong:**
Adding new models (e.g., `SlideElementMap`, `DeckStructure`, `TouchBinding`) via `prisma migrate dev` when the schema already contains `Unsupported("vector(768)")` can trigger schema drift detection. Prisma's migration engine sees the vector column as an unknown type and sometimes generates incorrect diff SQL or warns about drift. On Prisma 6.19.x this is manageable but requires care. On Prisma 7.x, this is a known regression (GitHub issue #28867) that outright breaks migrations -- the project constraint to stay on 6.19.x exists for this reason.

**Why it happens:**
Prisma treats `Unsupported(...)` columns as opaque -- it cannot introspect or diff them reliably. When generating a new migration, the engine may produce ALTER statements that interact badly with the vector column or its HNSW index. The project rule requiring `prisma migrate dev --name <name>` (never `db push`) adds safety but doesn't eliminate the drift detection risk.

**How to avoid:**
1. **Always use `--create-only` first**: Generate migration SQL without applying it. Inspect the SQL for any unintended changes to `SlideEmbedding` or its indexes.
2. **Never modify SlideEmbedding in the same migration as new models**: If you need to add columns to SlideEmbedding (e.g., `description`, `elementMapJson`), do it in a separate migration from any new model creation.
3. **Stay on Prisma 6.19.x**: The constraint is already documented but bears repeating -- upgrading to 7.x will break vector migrations entirely.
4. **Test migrations against a throwaway database first**: Before running on the shared dev DB, apply to a local PostgreSQL with pgvector enabled to verify no drift.
5. **Use raw SQL for vector-adjacent schema changes**: If adding a column to a table with vector columns causes Prisma issues, write the migration SQL manually and mark it as applied with `prisma migrate resolve --applied`.

**Warning signs:**
- `prisma migrate dev` warns about schema drift
- Generated migration SQL contains DROP/CREATE statements for SlideEmbedding
- Migration fails with "column type vector does not exist" errors
- HNSW index gets dropped and recreated (kills query performance until rebuild completes)

**Phase to address:**
Every phase that adds new models. First migration should be tested thoroughly before subsequent phases build on it.

---

### Pitfall 6: Slides API Rate Limits on Thumbnails + Element Extraction Combined

**What goes wrong:**
The existing thumbnail caching (`gcs-thumbnails.ts`) uses `presentations.pages.getThumbnail` which counts as an "expensive read" -- limited to **60/minute/user** and **300/minute/project**. Regular reads (`presentations.get`, `presentations.pages.get`) have a separate, more generous quota of **600/minute/user** and **3000/minute/project**. If v1.5 adds element map extraction AND thumbnail caching AND rich description generation, the API budget gets tight. The existing code uses `BATCH_SIZE = 2` and `BATCH_DELAY_MS = 3000` for thumbnails, meaning a 50-slide template takes 75+ seconds just for thumbnails. Running this for 3+ templates queued in `ingestionQueue` serially adds minutes.

**Why it happens:**
Thumbnail fetching (`getThumbnail`) and regular reads (`presentations.get`) use different quota buckets but developers don't realize this. The sequential ingestion queue prevents concurrent template processing but doesn't coordinate API budget across thumbnail caching AND regular reads within a single template ingestion. The current thumbnail caching runs as part of `ingestTemplate()` (line 331-341), serially adding 75+ seconds to every ingestion after the "idle" status is already set.

**How to avoid:**
1. **Use one field-masked presentations.get for elements**: A single call returns all slide elements. This counts as 1 regular read (3000/min project quota), NOT an expensive read. Far cheaper than per-slide `pages.get` calls.
2. **Separate thumbnail caching from the ingestion critical path**: It already runs after status is set to "idle", but it should be truly decoupled -- a separate background job or queue entry that runs after ingestion completes.
3. **Budget-aware batching for thumbnails**: The current `BATCH_SIZE = 2` with `BATCH_DELAY_MS = 3000` is conservative. With 60/min/user quota, you could batch 4 with 4s delay. But if multiple templates queue, share a rate limiter instance.
4. **Cache element maps alongside content hashes**: If the element map hasn't changed (same contentHash from smart merge), skip re-extraction on re-ingestion.

**Warning signs:**
- 429 errors in agent logs during ingestion
- Ingestion takes 5+ minutes for a 30-slide deck
- Thumbnail caching silently fails (current error handling logs but swallows 429s)
- `BATCH_DELAY_MS` increased reactively to avoid rate limits

**Phase to address:**
Element map extraction phase. Audit and document the rate budget before implementing.

---

### Pitfall 7: Deck Structure AI Analysis Produces Unreliable Results With Few Examples

**What goes wrong:**
The Settings page "Deck Structures" feature requires AI to infer the typical structure/flow of presentations per touch type. With only 5 accessible presentations (38 slides total) across potentially 4 touch types, some touches may have 0-1 examples. The AI will produce confident-sounding but unfounded structural analysis from a single example, presenting one deck's idiosyncratic structure as "the pattern." GPT-OSS 120b (like all LLMs) cannot distinguish "pattern from N=1" from "pattern from N=50."

**Why it happens:**
LLMs are excellent at pattern description but terrible at statistical significance. The model will describe whatever it sees as if it's representative. With the current content library status (38 slides from 5 presentations), there simply isn't enough data for meaningful structural inference for all 4 touch types.

**How to avoid:**
1. **Show example count per touch prominently**: Display "Based on N examples" alongside every structural inference. If N < 3, show a warning: "Insufficient examples for reliable structure inference."
2. **Template vs Example classification must come first**: You need to know which presentations ARE examples (bound to a specific touch) before analyzing their structure. Build classification before deck structures.
3. **Use the AI chat refinement as the primary mechanism**: Since automated analysis will be unreliable with few examples, make the chat interface the real tool. Let users correct and refine interactively rather than trusting initial AI analysis.
4. **Store structure as user-editable artifact**: Treat AI output as a draft. Store the final structure as a user-confirmed artifact, not a cached LLM response that gets regenerated.
5. **Graceful degradation**: When 0 examples exist for a touch, show "No examples classified for this touch yet" instead of fabricating a structure.

**Warning signs:**
- Deck structures look plausible but don't match what sellers actually use
- Different runs produce different structures for the same touch (non-deterministic with low data)
- Users immediately flag the AI analysis as wrong via the chat interface
- All 4 touches show similar structures (model generalizing from too few examples)

**Phase to address:**
Settings page / Deck Structures phase. This should be the LAST feature built in v1.5, after more examples have been classified and ingested via the Template vs Example classification feature.

---

### Pitfall 8: Adding Rich AI Descriptions During Ingestion Doubles LLM Costs and Time

**What goes wrong:**
The current ingestion pipeline already makes 2 LLM/API calls per slide: one for classification (Gemini via `classifySlide`) and one for embedding (Vertex AI `text-embedding-005`). Adding a rich description generation step adds a third LLM call per slide. For a 50-slide template, this means 150 API calls instead of 100. With the 300ms rate limit delay between slides (`ingest-template.ts` line 236), ingestion time increases by ~15 seconds for the descriptions alone, plus actual LLM latency (1-3 seconds per call). A 50-slide deck that took 3 minutes now takes 4-5 minutes.

**Why it happens:**
Each slide needs a contextual, human-readable description that captures purpose, visual composition, and use cases. This requires an LLM call that is separate from classification (different prompt, different output schema). Developers add it as a serial step in the per-slide loop without considering the cumulative time cost.

**How to avoid:**
1. **Combine classification and description in a single LLM call**: Extend the `classifySlide` prompt to also produce a `description` field. One call does both classification and description generation. This is the most impactful optimization.
2. **Use a smaller/faster model for descriptions if separate**: If the description prompt must be different from classification, consider using Gemini Flash instead of GPT-OSS 120b for descriptions (faster, cheaper, sufficient for summaries).
3. **Batch descriptions**: If keeping separate calls, process descriptions in parallel batches (Promise.allSettled) rather than sequentially, respecting rate limits.
4. **Store description alongside classification**: Add a `description` column to SlideEmbedding. Do NOT create a separate table for descriptions -- they are 1:1 with slides and always displayed together.

**Warning signs:**
- Ingestion time increases noticeably compared to v1.4
- Sellers complain about waiting longer for templates to be ready
- LLM costs increase (check Vertex AI billing dashboard)
- Rate limit 429 errors appear during ingestion (too many LLM calls too fast)

**Phase to address:**
Rich description phase. Combine with classification in a single call from the start.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing element maps as JSON text in SlideEmbedding row | No schema change needed | Bloated rows degrade vector queries, awkward to index or query elements | Never -- create a separate table or JSONB column |
| Combining description into existing classificationJson | No migration needed | classificationJson becomes overloaded, harder to update independently | Acceptable short-term if description is a simple string field |
| Adding description column to SlideEmbedding via raw SQL | Avoids Prisma drift issues | Manual migration maintenance | Acceptable -- use `--create-only` and hand-edit SQL |
| In-memory Map for batch ingestion state (existing) | Avoids DB complexity | Lost on agent restart, no cross-instance state | Acceptable for single Railway instance with ~20 users |
| Polling for ingestion status (existing) | Simple implementation | Stale data races, polling load | Acceptable at current scale; SSE for v2 |
| Single LLM call for deck structure analysis | Fast to implement | Unreliable with few examples | Only in v1.5 MVP with prominent confidence indicators and example counts |
| Hardcoded touch type list in classification UI | No DB lookup needed | Adding Touch 5+ requires code change | Acceptable for current 4-touch scope |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Slides API `presentations.get` | Fetching full response for 50+ slide decks (5-15MB JSON) | Use `fields` parameter to mask response to only needed fields |
| Google Slides API `pages.getThumbnail` | Treating as regular read quota (600/min) | It is an "expensive read" -- 60/min/user, 300/min/project. Separate quota bucket. |
| Google Drive API `thumbnailLink` | Storing the URL directly in DB for display | URL expires in hours, has CORS issues. Proxy to GCS for permanent storage. |
| Google Drive API `files.get` for thumbnails | Calling per-document on every browse request | Cache results in `DiscoveryDocCache` (already exists) -- extend with thumbnailGcsUrl |
| Prisma + pgvector migrations | Adding columns to vector table in same migration as new models | Separate migrations. Use `--create-only`. Inspect SQL. Never modify SlideEmbedding and other tables in one migration. |
| Prisma `Unsupported("vector")` | Assuming Prisma can introspect and diff these columns | Prisma cannot. Manual SQL may be needed. Use `prisma migrate resolve --applied` for hand-written migrations. |
| User-delegated OAuth for thumbnails | Assuming token is always available for background thumbnail fetch | Token pool may be empty. Service account fallback must work. Follow existing `getPooledGoogleAuth()` pattern. |
| Ingestion pipeline extension | Adding new per-slide steps as serial calls in the loop | Combine where possible (classification + description in one LLM call). Keep element extraction separate (API vs LLM). |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full `presentations.get` response stored per slide | Slow ingestion, memory spikes, DB bloat | Field masking + reduced element map + separate table | Presentations with 30+ complex slides |
| Serial LLM calls for classification + description + embedding per slide | 4-5 min ingestion for 50 slides | Combine classification + description in single call; parallelize embedding | Any deck over 20 slides |
| Concurrent thumbnail caching across queued templates | 429 rate limit errors, silent failures | Sequential queue (already exists) + budget-aware batching | 3+ templates queued simultaneously |
| Polling from multiple browser tabs (Discovery + Templates) | N * polling_rate requests to agent per interval | Use Visibility API to pause polling in background tabs; debounce | 5+ concurrent users with multiple tabs |
| Loading full SlideEmbedding rows for Discovery dedup | Slow browse page with unnecessary data transfer | Select only `presentationId` for dedup check, not full rows | 100+ ingested templates |
| Element map stored in same row as 768-dim vector | Vector similarity queries pull MB of element JSON per result | Separate table for element maps; join only when needed | 10+ results in similarity search with element-heavy slides |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing raw Drive `thumbnailLink` to client | URL may contain auth tokens; leaks Google session info; CORS blocks it anyway | Always proxy through GCS; never send `thumbnailLink` to browser |
| Storing element map with image `contentUrl` from Slides API | Image URLs contain short-lived tokens; could be used to access other Drive resources | Strip or replace image URLs with GCS-cached versions before storage |
| Service account used for all Drive thumbnail fetches | SA may not have access to user-shared files in personal Drives | Use pooled user auth with SA fallback, matching existing `getPooledGoogleAuth()` pattern |
| Description generation prompt including raw slide text | LLM could echo sensitive client content in descriptions visible to all users | Descriptions should be structural (purpose, layout, element types) not content-reproducing |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "Ingested" immediately on Discovery while actually ingesting | User navigates to Templates expecting completed template, finds it in progress | Show real 3-state status on both pages (not ingested / ingesting / ingested) |
| No feedback for 2-5 seconds after clicking "Ingest" | User clicks again, gets error toast about duplicate ingestion | Disable button immediately, show spinner, update status optimistically with monotonic guard |
| AI deck structure presented without data confidence context | User trusts wrong structure, builds decks with incorrect flow | Show "Based on N examples" with score; warning when N < 3; highlight low-confidence sections |
| Element map data shown raw in UI | Technical JSON blob confuses non-technical sellers | Show element map as visual diagram or structured summary; raw JSON only in dev/debug view |
| Template vs Example classification required retroactively for all existing templates | Existing templates show "Action Required" banners, cluttering the page | Batch classification flow with smart defaults (infer from existing `touchTypes` field) |
| Rich description missing for already-ingested slides | Inconsistent UX where some slides have descriptions and others don't | Backfill descriptions for existing slides on first load or via background re-classification job |

## "Looks Done But Isn't" Checklist

- [ ] **Discovery thumbnails:** Often missing GCS caching -- verify thumbnails survive browser cache clear AND new session AND 24hr gap
- [ ] **Discovery thumbnails:** Often missing file-type icons for non-Slides docs -- verify PDFs, Docs, Sheets show appropriate icons
- [ ] **Ingestion status sync:** Often only tested on Templates page -- verify Discovery page shows matching status during active ingestion (check both pages simultaneously)
- [ ] **Optimistic UI:** Often only tested happy path -- verify rollback on network error AND no flicker when poll arrives during optimistic state AND button disabled during pending
- [ ] **Element map extraction:** Often missing field masking -- verify `presentations.get` uses `fields` parameter (check agent request logs for response size)
- [ ] **Element map storage:** Often stored in same table as vectors -- verify separate storage that doesn't bloat vector query results
- [ ] **Rich descriptions:** Often missing for existing slides -- verify backfill strategy for slides ingested before descriptions were added
- [ ] **Template classification:** Often missing migration for existing data -- verify existing templates prompt for classification AND don't show broken state
- [ ] **Deck structure analysis:** Often tested with good examples only -- verify behavior when 0 examples exist for a touch type (should show helpful empty state, not hallucinated structure)
- [ ] **Rate limit handling:** Often only tested with 1 template -- verify 429 handling when 3+ templates are queued with both thumbnails and element extraction
- [ ] **Prisma migrations:** Often tested with `db push` accidentally -- verify migration file exists in `prisma/migrations/` and was applied via `prisma migrate dev --name`
- [ ] **Thumbnail CORS:** Often tested via server-side fetch only -- verify thumbnails render in actual browser across origins (not just API response check)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stored raw Drive thumbnailLinks that expired | LOW | Batch job: query all rows with non-GCS thumbnailUrl, re-fetch via Drive API, upload to GCS |
| Optimistic state desync from server | LOW | Force refresh (re-fetch all template statuses), clear local state, page reload |
| Element map bloated SlideEmbedding table | MEDIUM | Create separate SlideElementMap table, migrate data, null out old column, VACUUM FULL |
| Prisma migration dropped HNSW index | HIGH | `CREATE INDEX CONCURRENTLY` to rebuild without locking table; 30-60 sec for current scale; minutes at 1000+ rows |
| Rate limit exhausted during batch ingestion | LOW | Queue will process next on `processNext()`. Add exponential backoff delay. Retry after quota resets (60 seconds). |
| Deck structure analysis produced wrong results | LOW | User corrects via AI chat. Store corrections as authoritative. Re-run analysis when more examples added. |
| Migration broke vector column | HIGH | Restore from Supabase point-in-time backup. Re-apply migration with hand-corrected SQL. |
| Descriptions missing for existing slides | LOW | Background job: query slides where description IS NULL, generate via LLM batch, update. Non-blocking. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Drive thumbnailLink expiration + CORS | Discovery thumbnails (Phase 1) | Thumbnails survive 24hr+ without refresh; render in browser without CORS error |
| Optimistic UI overwritten by poll | Immediate feedback / optimistic UI (Phase 2) | Click ingest, wait 10s, status never flickers backward |
| Element map response size | Element extraction (Phase 3) | `presentations.get` request includes `fields` param; response < 500KB for 50-slide deck |
| Ingestion status inconsistency | Status consistency (Phase 2-3) | Both Discovery and Templates show identical status during ingestion (test simultaneously) |
| Prisma + pgvector migration | Every phase with schema changes | `--create-only` used, SQL inspected, no SlideEmbedding DROP/ALTER in new-model migrations |
| Slides API rate limits combined | Element extraction + thumbnails (Phase 1, 3) | 50-slide template ingests without 429 errors in agent logs |
| Deck structure insufficient data | Deck structures (last phase) | "Based on N examples" shown; warning when N < 3; graceful empty state when N = 0 |
| Rich description doubles LLM cost | Rich descriptions (Phase 3) | Single LLM call produces both classification AND description; no separate description call |

## Sources

- [Google Slides API Usage Limits](https://developers.google.com/workspace/slides/api/limits) -- 60/min expensive reads (getThumbnail), 600/min regular reads, 3000/min project-level (HIGH confidence)
- [Google Slides API Performance Guide](https://developers.google.com/slides/api/guides/performance) -- field masking to reduce response size (HIGH confidence)
- [Google Drive thumbnailLink expiration](https://groups.google.com/g/google-drive-api-and-sdk/c/8bmHrbTPvaM) -- short-lived URLs confirmed by community (MEDIUM confidence)
- [Drive API thumbnailLink 404 issues](https://issuetracker.google.com/issues/229184403) -- Google-acknowledged expiration behavior (HIGH confidence)
- [Drive API thumbnailLink 404 on public files](https://issuetracker.google.com/issues/188567656) -- auth requirements for thumbnail access (HIGH confidence)
- [Prisma 7.x vector migration regression](https://github.com/prisma/prisma/issues/28867) -- confirmed breaking change, stay on 6.19.x (HIGH confidence)
- [RTK Query polling race condition with optimistic updates](https://github.com/reduxjs/redux-toolkit/issues/1512) -- documented pattern matching this exact pitfall (MEDIUM confidence)
- [React useOptimistic limitations](https://www.columkelly.com/blog/use-optimistic) -- useOptimistic alone doesn't solve race conditions (MEDIUM confidence)
- Codebase: `apps/agent/src/lib/gcs-thumbnails.ts` -- existing thumbnail caching pattern with BATCH_SIZE=2, BATCH_DELAY_MS=3000 (HIGH confidence)
- Codebase: `apps/agent/src/ingestion/ingestion-queue.ts` -- existing sequential queue, singleton pattern (HIGH confidence)
- Codebase: `apps/agent/src/ingestion/ingest-template.ts` -- existing pipeline: extract -> smart merge -> classify + embed -> store -> thumbnails (HIGH confidence)
- Codebase: `.planning/debug/ingestion-state-reverts.md` -- recent state revert bug with Discovery vs Templates inconsistency (HIGH confidence)
- Codebase: `REVIEW-ISSUES.md` -- all 7 UX issues driving v1.5 scope (HIGH confidence)
- Codebase: `apps/agent/prisma/schema.prisma` -- current schema with Unsupported("vector(768)"), DiscoveryDocCache, Template models (HIGH confidence)

---
*Pitfalls research for: v1.5 Review Polish & Deck Intelligence*
*Researched: 2026-03-07*
