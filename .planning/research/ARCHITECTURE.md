# Architecture Patterns

**Domain:** v1.5 Review Polish & Deck Intelligence -- integration architecture for 7 features into existing AtlusAI sales platform
**Researched:** 2026-03-07
**Confidence:** HIGH (based on deep codebase analysis of all relevant source files)

## Existing Architecture Summary

Two-app monorepo with clear separation:

```
apps/web (Next.js 15, Vercel)          apps/agent (Mastra Hono, Railway)
  - Server Components + Server Actions    - REST API routes (registerApiRoute)
  - Supabase Auth (Google OAuth)          - Prisma + PostgreSQL + pgvector
  - api-client.ts (typed fetch wrapper)   - Google Workspace APIs
  - shadcn/ui components                  - Gemini 2.0 Flash (classification)
  - Sonner toasts                         - Vertex AI text-embedding-005
  - NavProgress (global)                  - Mastra workflows (HITL)
  - loading.tsx skeletons (all routes)    - IngestionQueue (sequential, singleton)
                                          - GCS thumbnail cache
                                          - MCP client (AtlusAI)
```

Communication: `fetchJSON` / `fetchWithGoogleAuth` in api-client.ts. Service auth via `Authorization: Bearer` API key. Google auth passthrough via `X-Google-Access-Token` header.

State sync: Polling-based. TemplateCard polls `GET /templates/:id/progress` every 2s during ingestion. DiscoveryClient polls `GET /discovery/ingest/:batchId/progress` every 2s.

**Critical invariants:**
- Web has ZERO direct database access -- all data flows through api-client.ts to agent
- Agent owns database via Prisma; only vector operations use raw SQL
- MCP client lives on agent only (Railway long-running vs Vercel serverless)
- Ingestion queue is sequential and in-memory (single agent instance)

---

## Feature Integration Map

### Feature 1: Discovery Document Card Thumbnails

**What changes:** Discovery cards currently show text-only (title + textContent preview). Need thumbnails for Google Slides documents and file-type icons for non-Slides documents.

**Integration point:** The DiscoveryDocCache model already caches Drive metadata per AtlusAI document. The existing `enrichDocsWithDriveMetadata()` in browse/search endpoints already calls `drive.files.get` per document. Extend the `fields` parameter to include `thumbnailLink,hasThumbnail,iconLink`.

**Architecture decision:** Reuse the existing GCS thumbnail caching pattern from `gcs-thumbnails.ts`. Drive `thumbnailLink` URLs are short-lived and CORS-blocked -- they MUST be fetched server-side and cached to GCS.

```
Drive API files.get (MODIFIED fields)
  |-- hasThumbnail=true --> fetch thumbnailLink server-side
  |                          --> uploadThumbnailToGCS() (EXISTING)
  |                          --> store in DiscoveryDocCache.thumbnailUrl
  |-- hasThumbnail=false --> Client uses mimeType to select lucide-react icon
```

**New/Modified components:**

| Layer | File | Change |
|-------|------|--------|
| Agent | `mastra/index.ts` (browse/search) | Add thumbnailUrl to enriched doc response; expand Drive fields |
| Agent | `lib/gcs-thumbnails.ts` | Add `cacheDiscoveryThumbnail(driveFileId, thumbnailLink)` helper |
| Agent | `prisma/schema.prisma` | Add `thumbnailUrl String?` to DiscoveryDocCache |
| Web | `api-client.ts` | Add `thumbnailUrl` to DiscoveryDocument interface |
| Web | `discovery-client.tsx` | Render `<img>` from GCS URL or file-type icon fallback |

**No new Prisma model.** One migration: ADD COLUMN.

### Feature 2: Consistent Ingestion Status Across Pages

**What changes:** Discovery and Templates pages each maintain independent ingestion state. Navigate between them and status resets.

**Root cause analysis:**
- Discovery page: tracks `itemStatuses` Map in React state. Lost on unmount/remount.
- Templates page: fetches fresh `listTemplatesAction()` on mount, reads `ingestionStatus` from Template model.
- Template model IS the source of truth (stores `ingestionStatus`, `ingestionProgress`).
- Discovery page does NOT read Template model status. It only tracks its own client-side state.

**Architecture decision: Polling with server-side source of truth.** NOT SSE, NOT shared client state.

Rationale:
- SSE adds deployment complexity (Railway sticky sessions needed). Overkill for ~20 users.
- React Context at layout level couples unrelated pages and is lost on refresh anyway.
- The Template model already stores ingestion state. Discovery just needs to read it.

**Specific approach:**
1. On mount, DiscoveryClient fetches `GET /templates?status=ingesting` to get currently-ingesting template presentationIds.
2. Cross-reference with document list to seed initial statuses.
3. After triggering ingestion, poll `GET /templates/:id/progress` (same endpoint TemplateCard uses).

| Layer | File | Change |
|-------|------|--------|
| Agent | `mastra/index.ts` | Add optional `?status=ingesting` filter to GET /templates |
| Web | `discovery-client.tsx` | Mount-time check for ingesting templates; poll Template progress endpoint |

**No new models.** Template.ingestionStatus is the single source of truth for both pages.

### Feature 3: Immediate Feedback on Ingest Click (Optimistic UI)

**What changes:** Delay between click and visual feedback on Discovery page.

**Analysis of current code:** `handleBatchIngest()` already sets `itemStatuses.set(doc.slideId, "pending")` BEFORE awaiting the server action. The toast ("Ingestion complete") only fires on polling completion. The gap is:
1. No immediate toast when ingest is triggered.
2. The `await startDiscoveryIngestionAction(enrichedItems)` blocks before `startPolling(batchId)`.

**Architecture decision:** Optimistic state is already partially implemented. Complete it:
1. Add immediate toast: `toast.info("Queuing N items for ingestion...")` before the await.
2. The existing optimistic state setting is correct -- status updates to "pending" before the server call.
3. If the server call fails, the existing catch block already reverts status.

**Alternatively, use React 19 `useOptimistic`** for a cleaner pattern (already used in `actions-client.tsx`). However, given the complexity of the Map-based status tracking, the current pattern with an immediate toast is simpler and sufficient.

| Layer | File | Change |
|-------|------|--------|
| Web | `discovery-client.tsx` | Add immediate toast on ingest click |

**No backend changes.** Pure client-side UX.

### Feature 4: Rich AI-Generated Slide Descriptions

**What changes:** During ingestion, generate a 1-3 sentence description per slide alongside classification.

**Architecture decision: Add `description` column to SlideEmbedding. Generate in the SAME Gemini call as classification.**

Rationale:
- Description is a first-class display field (shown in slide viewer, search results).
- Adding to `classificationJson` would couple display data with classification and require JSON parsing everywhere.
- Dedicated column enables `SELECT description` without JSON parsing, consistent with `contentText` and `speakerNotes`.
- Same Gemini 2.0 Flash call already processes each slide -- add `description` to the response schema. Zero additional API cost.

**Generation approach:** Add to the Gemini response schema in `classify-metadata.ts`:
```javascript
description: {
  type: Type.STRING,
  description: "A 1-3 sentence description of this slide's content and purpose within the deck."
}
```

Add to the classification prompt:
```
9. Write a 1-3 sentence description of what this slide communicates and how it fits in the deck context.
```

| Layer | File | Change |
|-------|------|--------|
| Agent | `prisma/schema.prisma` | Add `description String?` to SlideEmbedding |
| Agent | `ingestion/classify-metadata.ts` | Add `description` to LLM_RESPONSE_SCHEMA and prompt |
| Agent | `ingestion/ingest-template.ts` | Store description in INSERT/UPDATE raw SQL |
| Agent | `mastra/index.ts` | Include description in GET /templates/:id/slides response |
| Web | `api-client.ts` | Add `description` to SlideData interface |
| Web | `slide-viewer-client.tsx` | Display description below slide thumbnail |
| Schemas | `llm/slide-metadata.ts` | Add optional `description: z.string().optional()` |

**One migration:** ADD COLUMN.

### Feature 5: Structured Element Map via Google Slides API

**This is the biggest architectural decision in v1.5.**

**What changes:** Extract structural composition of each slide (text boxes, images, tables, shapes, groups) as a typed element map.

#### Data Model: JSON Column vs New Model

**Decision: JSON column (`elementMap Json?`) on SlideEmbedding.**

Rationale:
- Element map is 1:1 with a slide -- no independent querying needed.
- Always read as a unit (never "find all slides with a table element").
- Separate model adds JOINs for zero benefit.
- Data is structured but variable per slide. JSON is the natural fit.
- Prisma handles `Json` type natively (unlike vector, which needs raw SQL).

#### Element Map Shape (Zod schema in packages/schemas)

```typescript
interface SlideElementMap {
  width: number;   // Slide width in EMU
  height: number;  // Slide height in EMU
  elements: SlideElement[];
}

interface SlideElement {
  objectId: string;
  type: "text_box" | "image" | "table" | "shape" | "group" | "video" | "line";
  position: { x: number; y: number; width: number; height: number }; // EMU
  textContent?: string;       // For text_box, shape
  imageUrl?: string;          // For image elements
  tableSize?: { rows: number; cols: number };
  placeholderType?: string;   // "TITLE", "SUBTITLE", "BODY", etc.
  children?: SlideElement[];  // For groups
}
```

#### Extraction Point

**Zero additional API calls.** `extractSlidesFromPresentation()` in `slide-extractor.ts` already calls `presentations.get` which returns full `pageElements` with positions, types, and properties. Currently only text is extracted via `extractTextFromPageElements()`. Extend to also build the element map from the same response.

The existing code already handles shapes, tables, and groups (for text extraction). The element map extraction reuses these traversals and adds position/type data.

| Layer | File | Change |
|-------|------|--------|
| Agent | `prisma/schema.prisma` | Add `elementMap Json?` to SlideEmbedding |
| Agent | `lib/slide-extractor.ts` | Add `elementMap` to ExtractedSlide interface; build from pageElements |
| Agent | `ingestion/ingest-template.ts` | Store elementMap as JSON in INSERT/UPDATE SQL |
| Agent | `mastra/index.ts` | Include elementMap in GET /templates/:id/slides response |
| Web | `api-client.ts` | Add `elementMap` to SlideData interface |
| Web | `slide-viewer-client.tsx` | Render element map summary (element count, types) |
| Schemas | New `slide-element-map.ts` | Zod schema for SlideElementMap |

**One migration:** ADD COLUMN (JSONB).

### Feature 6: Template vs Example Classification with Touch Binding

**What changes:** Distinguish between templates (reusable deck structures) and examples (real client decks). Bind examples to specific touch types.

**Architecture decision: Add two columns to Template model.**

```prisma
contentRole    String   @default("template") // "template" | "example"
```

Note: `touchTypes` already exists as a JSON array on Template. For examples, this field gets populated with the specific touch type(s) the example deck represents.

Rationale:
- Template model is where the operational data lives (not ContentSource, which is a discovery tracking table).
- `contentRole` (not `contentType`) to avoid confusion with the existing `contentType` field on SlideEmbedding classification.
- Default `"template"` preserves backward compatibility with existing data.

**How classification affects deck assembly:**
- Templates: used as structural patterns (copy-and-prune approach)
- Examples: used as content patterns (AI learns from real decks what content goes where)
- The deck structure inference (Feature 7) queries examples grouped by touch type.

| Layer | File | Change |
|-------|------|--------|
| Agent | `prisma/schema.prisma` | Add `contentRole String @default("template")` to Template |
| Agent | `mastra/index.ts` | Accept/return contentRole in template CRUD routes |
| Web | `api-client.ts` | Add `contentRole` to Template interface |
| Web | `templates-page-client.tsx` | Add filter tabs: All / Templates / Examples |
| Web | `template-card.tsx` | Show contentRole badge, dropdown to change |
| Web | `discovery-client.tsx` | Allow setting contentRole when ingesting from Discovery |
| Schemas | `constants.ts` | Add `CONTENT_ROLES = ["template", "example"] as const` |

**One migration:** ADD COLUMN with default.

### Feature 7: Settings Page with Deck Structures + AI Chat

**Two architectural decisions here: data model and chat approach.**

#### Route Structure

```
apps/web/src/app/(authenticated)/settings/
  page.tsx              -- Server component, fetches deck structures
  settings-client.tsx   -- Client component with touch-type tabs
  loading.tsx           -- Skeleton
```

Fits the existing `(authenticated)` layout pattern. Add `{ href: "/settings", label: "Settings", icon: Settings }` to `navItems` in `sidebar.tsx`.

#### Deck Structure Data Model

**New Prisma model: `DeckStructure`.**

```prisma
model DeckStructure {
  id          String   @id @default(cuid())
  touchType   String   @unique // "touch_1" | "touch_2" | "touch_3" | "touch_4"
  name        String   // "First Contact Pager" | "Intro Deck" | etc.
  sections    String   // JSON array of DeckSection objects
  createdBy   String?  // User ID who last modified
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([touchType])
}
```

Rationale for NEW model (not extending Template):
- Deck structures are per-touch-type (one structure for ALL Touch 2 decks).
- Templates are individual Google Slides files.
- 1:1 relationship between touch type and deck structure (@@unique on touchType).
- Separate model avoids coupling template CRUD with structure management.

Sections JSON shape:
```typescript
interface DeckSection {
  name: string;           // "Title Slide", "About Us", "Industry Focus"
  description: string;    // Purpose description
  required: boolean;      // Must appear in every deck of this type?
  order: number;          // Assembly order
  slideCategory?: string; // Maps to SLIDE_CATEGORIES for auto-matching
}
```

#### AI Chat Architecture

**Where it runs: Agent side, as a simple Hono route. NOT a Mastra workflow.**

Rationale:
- Stateless request/response. No HITL checkpoints, no suspend/resume.
- Deck structure refinement is a single LLM call, not a multi-step pipeline.
- Mastra workflows are overkill here.

**Why NOT streaming:** Responses are structured JSON (deck outline, 10-20 sections). Entire response must be valid JSON to update the structure. Streaming partial JSON adds complexity for zero UX benefit (responses complete in <3s).

```
POST /settings/deck-structures/:touchType/refine
  Body: { message: string, currentSections: DeckSection[] }
  Response: { sections: DeckSection[], explanation: string }
```

The LLM call uses GPT-OSS 120b via Mastra's `generate()` with:
- System prompt: Lumenalta deck structure expert context
- Current sections as structured context
- User message as the refinement request
- Response schema enforcing DeckSection[] output

| Layer | File | Change |
|-------|------|--------|
| Agent | `prisma/schema.prisma` | New DeckStructure model |
| Agent | `mastra/index.ts` | CRUD routes + refine endpoint |
| Web | `sidebar.tsx` | Add Settings nav item |
| Web | `settings/page.tsx` | Server component |
| Web | `settings/settings-client.tsx` | Client with touch-type tabs + section editor + chat |
| Web | `settings/loading.tsx` | Skeleton |
| Web | `api-client.ts` | DeckStructure types + API functions |
| Web | `lib/actions/settings-actions.ts` | Server actions |
| Schemas | New `deck-structure.ts` | Zod schema for DeckSection |

**One migration** (CREATE TABLE).

---

## Complete Schema Changes Summary

### New Models

| Model | Purpose | Columns |
|-------|---------|---------|
| DeckStructure | Per-touch deck section ordering | id, touchType (unique), name, sections (JSON), createdBy, timestamps |

### Modified Models

| Model | Column | Type | Default | Purpose |
|-------|--------|------|---------|---------|
| SlideEmbedding | `description` | `String?` | null | AI-generated slide description |
| SlideEmbedding | `elementMap` | `Json?` | null | Structural element map from Slides API |
| Template | `contentRole` | `String` | `"template"` | Template vs Example classification |
| DiscoveryDocCache | `thumbnailUrl` | `String?` | null | Cached GCS thumbnail URL |

**Total: 5 migrations** (4 ALTER TABLE + 1 CREATE TABLE). All additive, no data loss.

---

## Complete API Routes Summary

### New Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/settings/deck-structures` | List all deck structures |
| GET | `/settings/deck-structures/:touchType` | Get structure for touch type |
| PUT | `/settings/deck-structures/:touchType` | Create/update structure |
| POST | `/settings/deck-structures/:touchType/refine` | AI chat refinement |

### Modified Routes

| Method | Path | Change |
|--------|------|--------|
| GET | `/templates` | Add optional `?status=ingesting` filter |
| POST | `/templates` | Accept `contentRole` field |
| PATCH | `/templates/:id` | New: update `contentRole` |
| GET | `/templates/:id/slides` | Include `description` + `elementMap` in response |
| GET | `/discovery/browse` | Include `thumbnailUrl` in enriched docs |
| POST | `/discovery/search` | Include `thumbnailUrl` in enriched docs |

---

## Data Flow Changes

### v1.5 Ingestion Flow (additions marked with +)

```
User clicks Ingest
  -> + Immediate toast ("Queuing N items...")
  -> + Optimistic "pending" status in UI
  -> Server Action -> POST /discovery/ingest
  -> Creates Template record (+ with contentRole)
  -> Enqueues in IngestionQueue
  -> IngestionQueue processes:
     -> extract (+ element map from same presentations.get call)
     -> classify (+ description from same Gemini call)
     -> embed -> store (+ description + elementMap columns)
     -> cache thumbnails (+ discovery thumbnail via GCS)
  -> Client polls progress every 2s (+ uses Template progress endpoint)
  -> + On mount, cross-check with ingesting templates for consistency
```

### Settings Data Flow

```
User opens Settings -> Server fetches DeckStructure records (4 max)
  -> Tabs per touch type -> Edit sections inline (drag to reorder)
  -> Save: PUT /settings/deck-structures/:touchType
  -> AI Refine: POST /settings/deck-structures/:touchType/refine
     -> Agent calls GPT-OSS 120b with current structure + user message
     -> Returns modified structure + explanation
  -> User reviews diff, accepts or rejects
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: SSE for Ingestion Status
**What:** Server-Sent Events for real-time ingestion updates.
**Why bad:** Railway needs sticky sessions for SSE. Connection management and reconnection logic adds complexity. For ~20 users with 2s polling, overhead is unjustified.
**Instead:** Keep polling. Template model is the source of truth.

### Anti-Pattern 2: Shared React Context for Cross-Page State
**What:** IngestionContext at layout level to sync status between pages.
**Why bad:** Couples unrelated pages, lost on refresh anyway, adds layout complexity.
**Instead:** Server-side source of truth queried on mount.

### Anti-Pattern 3: Separate Element Map Table
**What:** `SlideElement` model with FK to SlideEmbedding.
**Why bad:** Element maps are always read as a unit. Separate table adds JOINs for zero queryability benefit.
**Instead:** `elementMap Json?` column. JSONB in PostgreSQL is efficient.

### Anti-Pattern 4: Two LLM Calls Per Slide
**What:** Separate Gemini call for classification and description.
**Why bad:** Doubles API cost and ingestion time (~300ms rate limit per call).
**Instead:** Add description to existing classification prompt. One call, both outputs.

### Anti-Pattern 5: Mastra Workflow for AI Chat
**What:** Suspend/resume workflow for settings page chat.
**Why bad:** Overkill. Workflows are for multi-step, stateful, durable HITL operations.
**Instead:** Simple POST endpoint with `generate()`.

### Anti-Pattern 6: Multiple presentations.get Calls
**What:** Calling Slides API separately for text extraction and element map extraction.
**Why bad:** Google Slides API has strict quotas (60 reads/min). Doubles consumption.
**Instead:** Extract all data from the single existing `presentations.get` response.

---

## Patterns to Follow

### Pattern 1: Extend Existing Extractors
Existing `presentations.get` call already returns all element data. Parse more of it, do not add new API calls.

### Pattern 2: GCS Cache for External Thumbnails
Never serve Google-hosted thumbnail URLs directly to browser. Always fetch server-side and cache to GCS. Existing pattern in `gcs-thumbnails.ts`.

### Pattern 3: Column-per-display-field
Add `description` as a dedicated column, not inside JSON. Consistent with `contentText`, `speakerNotes`.

### Pattern 4: Fire-and-forget with polling
Return immediately, poll for progress. Established in TemplateCard and DiscoveryClient.

### Pattern 5: Additive migrations only
Per CLAUDE.md: no resets, forward-only. All changes as nullable columns or new tables.

### Pattern 6: Server-side enrichment
Enrich API responses on the server (thumbnailUrl, isGoogleSlides). Client stays thin.

---

## Build Order (Dependency-Aware)

```
Phase 1: Schema + Infrastructure (no UI changes, no functional changes)
  1.1 Migration: SlideEmbedding.description
  1.2 Migration: SlideEmbedding.elementMap
  1.3 Migration: Template.contentRole
  1.4 Migration: DiscoveryDocCache.thumbnailUrl
  1.5 Migration: CREATE TABLE DeckStructure

Phase 2: Agent-side extraction enhancements (backend only)
  2.1 Element map extraction in slide-extractor.ts (depends on 1.2)
  2.2 Description generation in classify-metadata.ts (depends on 1.1)
  2.3 Store description + elementMap in ingest-template.ts (depends on 2.1, 2.2)

Phase 3: Agent-side API routes (backend only)
  3.1 Discovery thumbnail caching + enrichment (depends on 1.4)
  3.2 Template contentRole in CRUD routes (depends on 1.3)
  3.3 Slides endpoint with description + elementMap (depends on 2.3)
  3.4 Ingesting templates filter on GET /templates (no schema dependency)
  3.5 Deck structure CRUD routes (depends on 1.5)
  3.6 AI refinement endpoint (depends on 3.5)

Phase 4: Web-side UX improvements (can start in parallel with Phase 2)
  4.1 Optimistic UI for ingest click (no backend dependency)
  4.2 Cross-page ingestion status consistency (depends on 3.4)
  4.3 Discovery thumbnails in card grid (depends on 3.1)

Phase 5: Web-side new features
  5.1 Rich descriptions in slide viewer (depends on 3.3)
  5.2 Element map display in slide viewer (depends on 3.3)
  5.3 Template vs Example filter + classification UI (depends on 3.2)
  5.4 Settings page with deck structures + AI chat (depends on 3.5, 3.6)
```

**Critical path:** Phase 1 (migrations) -> Phase 2 (extraction) -> Phase 3 (routes) -> Phase 5 (features).

**Parallelism opportunities:**
- Phase 4.1 (optimistic UI) can start immediately -- no backend dependency.
- Phase 5.4 (Settings) is fully independent of Phases 2-3 extraction work.
- All 5 migrations in Phase 1 are independent and can be created in any order.
- Phase 3.4 and 3.5 have no dependency on Phase 2.

---

## Scalability Considerations

| Concern | Current (~38 slides, 5 templates) | At 500 slides, 50 templates | At 5000 slides |
|---------|----------------------------------|----------------------------|----------------|
| Element map storage | Negligible (<5KB per slide JSONB) | ~2.5MB total | ~25MB. Still fine. |
| Description generation | +0s per slide (same LLM call) | Same | Same |
| Ingestion time | ~2min per template | Same per-template | Queue serializes. OK. |
| Thumbnail caching | Existing GCS infra | ~500 GCS objects | ~5000. GCS scales infinitely. |
| Polling load | 1 user * 2s = negligible | 5 concurrent = 2.5 req/s | Consider SSE at this point. |

---

## Sources

- Codebase: `apps/agent/prisma/schema.prisma` (341 lines, 14 models)
- Codebase: `apps/agent/src/ingestion/ingest-template.ts` (375 lines, full pipeline)
- Codebase: `apps/agent/src/ingestion/classify-metadata.ts` (321 lines, Gemini schema)
- Codebase: `apps/agent/src/lib/slide-extractor.ts` (184 lines, presentations.get parsing)
- Codebase: `apps/agent/src/lib/gcs-thumbnails.ts` (198 lines, GCS cache pattern)
- Codebase: `apps/agent/src/mastra/index.ts` (~1900 lines, all API routes)
- Codebase: `apps/web/src/lib/api-client.ts` (863 lines, typed fetch wrappers)
- Codebase: `apps/web/src/components/sidebar.tsx` (190 lines, nav items)
- Codebase: `apps/web/src/components/template-card.tsx` (358 lines, polling pattern)
- Codebase: `apps/web/src/app/(authenticated)/discovery/discovery-client.tsx` (1049 lines, ingestion state)
- Debug: `.planning/debug/ingestion-state-reverts.md` (Drive metadata enrichment fix)
- Debug: `.planning/debug/slow-navigation-no-feedback.md` (loading.tsx + NavProgress fix)
- Google Slides API: `presentations.get` returns full pageElements (HIGH confidence -- verified in slide-extractor.ts)

---
*Architecture research for: Lumenalta v1.5 Review Polish & Deck Intelligence*
*Researched: 2026-03-07*
