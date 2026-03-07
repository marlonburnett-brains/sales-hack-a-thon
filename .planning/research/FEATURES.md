# Feature Landscape -- v1.5 Review Polish & Deck Intelligence

**Domain:** UX polish, slide intelligence deepening, content classification, and AI-assisted deck structure management for agentic sales platform
**Researched:** 2026-03-07
**Confidence:** HIGH (all features mapped from milestone spec with clear implementation paths; competitor patterns verified; existing codebase reviewed)

## Scope

Features for v1.5 milestone ONLY. Seven features targeting three tiers: UX gap fixes, slide intelligence deepening, and deck structure management.

---

## Table Stakes

Features that fix identified UX gaps. Missing = product feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **F1: Discovery document card thumbnails** | Grid view shows only title + text snippet -- indistinguishable cards. Users expect visual previews for presentation content. | LOW | Drive API `thumbnailLink` returns short-lived URLs (hours). Existing GCS caching pattern from v1.4 slide thumbnails applies. Add `thumbnailUrl` to `DiscoveryDocCache`. File-type icon fallback via `mimeType` already in `DiscoveryDocCache`. |
| **F2: Consistent ingestion status across pages** | Discovery tracks status in-memory `Map<string, ItemStatus>` (lost on navigation). Templates tracks via DB `ingestionStatus` column. Users see contradictory states. | MEDIUM | Promote Discovery batch status to DB. Extend `DiscoveryDocCache` with `ingestionStatus` + `batchId` columns. Agent mirrors in-memory batch state to DB on transitions. Both pages poll same DB source. |
| **F3: Immediate feedback on ingest click** | Gap between click and visual response feels broken. Users click multiple times, causing errors. | LOW | React 19 `useOptimistic` for instant status flip. Current `handleBatchIngest` sets pending before await but React batching may delay paint. Wrap server action in `startTransition` so pending UI paints first. |

## Differentiators

Features that add intelligence value beyond UX fixes.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **F4: Rich AI-generated slide descriptions** | Current metadata is taxonomy-only (8-axis classification). No human-readable description. Rich descriptions ("Financial services case study with before/after metrics and client testimonial") make slide library browsable without opening each slide. | MEDIUM | Add `description: z.string()` to Gemini classification prompt. Already sees full text + speaker notes. Marginal cost near zero. Store in new `aiDescription` column on `SlideEmbedding`. Consider appending to embedding input for richer vector representations. |
| **F5: Structured element map extraction** | Knowing a slide has "2 text boxes, 1 table with 4 rows, 1 image placeholder" enables intelligent assembly. System can match content to layout slots. No competitor analyzes existing Google Slides for structure -- all predefine or generate from scratch. | HIGH | Google Slides API returns 8 element types: Shape, Image, Table, SheetsChart, Line, Video, WordArt, Group. Extract per slide: shapes (with placeholder type: TITLE, SUBTITLE, BODY), tables (rows x cols), images (bounds, placeholder flag), charts. Store as `elementMapJson` on `SlideEmbedding`. Placeholder types from `shape.placeholder.type` are critical for slot filling. |
| **F6: Template vs Example classification with touch binding** | All presentations treated identically. No distinction between skeleton templates (reusable structures) and real client deliverables (examples for a touch). Classification changes retrieval behavior. | LOW-MEDIUM | Add `contentClassification` column to Template model ("template" / "example" / "case_study", default: "template"). Add `boundTouchType` for examples. Propagate to `SlideEmbedding` for vector search filtering. UI: radio group on template detail page. |
| **F7: Settings page with Deck Structures and AI chat** | Define expected deck structure per touch type. Foundation for intelligent assembly. AI analyzes ingested examples and proposes structures; chat refines conversationally. | HIGH | New `DeckStructure` model: `{ touchType, name, sections: JSON, isDefault }`. Sections: `[{ name, required, minSlides, maxSlides, slideCategories }]`. Settings page at `/settings`. AI chat uses Mastra agent + tool to read slide library stats. Structured JSON responses, not streaming. |

## Anti-Features

Features to explicitly NOT build in v1.5.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Drag-and-drop slide reordering** | Out of scope per PROJECT.md. Sellers reorder in Google Slides directly. | Link to Google Slides for editing |
| **In-browser slide content editing** | Out of scope per PROJECT.md. Massive scope, fragile API. | Link to Google Slides |
| **Real-time WebSocket status updates** | Over-engineering for ~20 users. Polling at 2s is smooth. Adds WS infra to Hono + Railway. | 2s polling (already implemented) |
| **Streaming AI chat responses** | Deck structure responses are short structured JSON. Streaming adds complexity without UX benefit. | Standard request/response |
| **Auto-classify template vs example** | Classification requires understanding organizational intent (skeleton vs deliverable). AI cannot reliably distinguish structurally identical slides by intent. | Default to "template", user overrides to "example". Batch classify from Discovery page. |
| **Auto deck structure generation without examples** | Without real examples, AI-generated structures are hallucinated. Need ground truth from touch-bound examples. | Only enable structure inference when 2+ examples exist for a touch |
| **Element map visual editor** | Canvas rendering of element positions is complex and unnecessary for v1.5 data model. | Show element inventory as metadata list in slide detail view |
| **Thumbnail generation for non-Slides files** | Requires server-side rendering (puppeteer). Most Discovery items are Google Slides. | File-type icon + title for non-Slides docs. Drive API `thumbnailLink` covers Google Workspace files. |

## Feature-by-Feature Deep Analysis

### F1: Discovery Document Card Thumbnails

**What users expect:** Visual preview on each Discovery card. File-type icon when thumbnail unavailable.

**Table stakes:**
- Thumbnail image on card (not just title + text)
- File-type icon fallback (Slides, Docs, Sheets icons via lucide)
- Graceful degradation: broken thumbnails show icon, not broken image
- Progressive loading (skeleton while fetching)

**Differentiator:** Thumbnail in preview side panel. Hover-to-enlarge.

**Implementation:**
- Drive API `thumbnailLink` is short-lived (hours), requires auth. Known stability issues (404s reported in Google Issue Tracker).
- Reuse `gcs-thumbnails.ts` pattern: fetch Drive thumbnail, upload to GCS, store permanent URL.
- `DiscoveryDocCache` already has `driveFileId` -- add `thumbnailUrl` + `thumbnailFetchedAt` columns (same pattern as `SlideEmbedding`).
- Populate during Drive metadata resolution phase of Discovery browse/search.
- File-type detection: `DiscoveryDocCache.mimeType` already populated. Map: `application/vnd.google-apps.presentation` -> Slides icon, `application/vnd.google-apps.document` -> Doc icon, etc.

**Depends on:** GCS thumbnail caching (v1.4), DiscoveryDocCache (v1.4).

---

### F2: Consistent Ingestion Status Across Pages

**What users expect:** Start ingestion on Discovery, navigate to Templates, see same in-progress status. Return to Discovery, see completion.

**Table stakes:**
- Status survives page navigation
- Same status on Discovery cards and Template cards for same presentation
- Completion toast fires regardless of active page

**Differentiator:** Global ingestion indicator in nav bar ("3 items ingesting...").

**Implementation:**
- Current Discovery: in-memory `Map<string, ItemStatus>` in `discovery-client.tsx` state -- lost on unmount (line 68-73).
- Current Templates: DB-backed `Template.ingestionStatus` -- persists.
- Fix: Extend `DiscoveryDocCache` with `ingestionStatus` ("idle" | "pending" | "ingesting" | "done" | "error") + `batchId` columns.
- Agent's in-memory batch state (`Module-level Map`) mirrors to DB on each status transition.
- Both pages poll same DB state via server actions. Discovery page hydrates `itemStatuses` from DB on mount.
- Alternative: New `IngestionBatch` + `IngestionItem` tables. More normalized but more complex. Recommend extending DiscoveryDocCache for simplicity.

**Depends on:** Agent batch system (v1.4), DiscoveryDocCache (v1.4).

---

### F3: Immediate Feedback on Ingest Click

**What users expect:** Click "Ingest" and button/card state changes in same frame. No perceptible delay.

**Table stakes:**
- Visual state change within 16ms of click
- Revert on server error with toast
- Button disabled to prevent double-click

**Implementation:**
- Current `handleBatchIngest` (line 301-352): sets statuses to "pending" synchronously before `await`, which looks correct. However, React concurrent rendering may batch the state update with the async call.
- Fix: Use `React.useOptimistic` or `React.startTransition` to ensure pending state paints before server action executes.
- Also clear selection set and disable Ingest button immediately (already partially implemented at line 335).
- Bonus: add subtle pulse animation on status badge transition.

**Depends on:** Nothing. Pure frontend change.

---

### F4: Rich AI-Generated Slide Descriptions

**What users expect:** Each slide has a 1-2 sentence human-readable description beyond raw extracted text and taxonomy tags.

**Table stakes:**
- Description generated during ingestion (not separate step)
- Visible in slide viewer alongside classification
- Coherent English, not tag concatenation

**Differentiator:**
- References specific elements ("Features 3-column comparison table with deployment options")
- Useful for search (append to embedding input)
- Editable by humans (like existing tag correction)

**Implementation:**
- Current `SlideMetadataSchema` has 8 fields (industries, subsectors, solutionPillars, funnelStages, contentType, slideCategory, buyerPersonas, touchType). No description.
- Add `description: z.string()` to classification prompt. Gemini already sees full text + speaker notes. Near-zero marginal cost per slide.
- If element map (F5) is extracted first, include element summary in description prompt for richer output.
- Store in `SlideEmbedding.aiDescription` column (new migration).

**Depends on:** Gemini classification pipeline (v1.2). Enhanced by F5 (element maps).

---

### F5: Structured Element Map Extraction

**What users expect:** System understands slide layout structure for smarter assembly.

**Table stakes:**
- Element inventory per slide: count of shapes, tables, images, charts
- Table dimensions (rows x cols)
- Stored and viewable in slide detail

**Differentiator:**
- Placeholder type detection (TITLE, SUBTITLE, BODY, SLIDE_NUMBER) -- enables slot filling
- Layout type inference via heuristics ("comparison", "data table", "hero image")
- Element map used for matching slides to deck structure slots

**How competitors handle deck structure:**

| Tool | Approach | Key Insight |
|------|----------|-------------|
| **Beautiful.ai** | ~60+ predefined Smart Slide types (comparison, timeline, Venn, org chart). Content auto-adapts. | Structure is opinionated and predefined, not inferred. |
| **Pitch** | Team-defined slide masters. Slides inherit structure. No dynamic inference. | Structure from organizational design systems. |
| **Tome** | Generates structure from scratch per prompt. No templates. | Structure is generative, not analytical. |
| **Gamma** | Card-based (not slide-based). Flexible layout blocks. | Avoids the structure problem with a different paradigm. |
| **Prezent.ai** | Storytelling frameworks (pyramid principle, problem-solution). Maps to narrative, not visual layout. | Structure = narrative pattern, not element arrangement. |

**None analyze existing Google Slides to infer structure.** AtlusAI's approach (infer from corporate slides) is genuinely novel.

**Implementation:**
- Google Slides API `presentations.get` already called during ingestion. Currently only text is extracted; `pageElements[]` array is discarded.
- Parse each page's elements: `{ shapes: [{id, placeholderType, hasText, bounds}], tables: [{id, rows, cols}], images: [{id, bounds, isPlaceholder}], charts: [{id, type}], lines: count, groups: [{id, childCount}] }`
- Store as `elementMapJson` column on `SlideEmbedding` (TEXT, not JSON type -- Prisma PostgreSQL compatibility).
- Layout type inference via rule-based heuristics:
  - 2 side-by-side text shapes = "comparison"
  - 1 large image + 1 text shape = "hero"
  - Table with 4+ rows = "data table"
  - Only TITLE + SUBTITLE placeholders = "title/divider"
- Heuristic classification stored alongside element map. LLM refinement deferred unless heuristics prove insufficient.

**Depends on:** Google Slides API (v1.3 credentials), ingestion pipeline (v1.2).

---

### F6: Template vs Example Classification with Touch Binding

**What users expect:** Tag content as "template" (reusable skeleton), "example" (past deliverable), or "case_study". Each with touch binding.

**Table stakes:**
- Classification dropdown on template detail page
- Touch type multi-select (exists, make more prominent)
- Visible on template cards and discovery cards
- Filterable in template list and slide library

**Differentiator:**
- Different icons per classification (blueprint, lightbulb, trophy)
- Classification influences RAG: templates for assembly, examples for reference, case studies for proof
- Batch classify from Discovery: "Ingest these 5 as examples for Touch 3"

**Implementation:**
- `Template` model: add `contentClassification` column (String, default "template"). Add `boundTouchType` (String, nullable -- set when classification is "example").
- Propagate to `SlideEmbedding` via `contentClassification` column for vector search filtering.
- `ContentSource` already has `contentType` and `touchTypes` for Discovery-side. Bridge on ingestion.
- UI: Radio group + touch type multi-select on template creation form and detail page.

**Depends on:** Template CRUD (v1.2), SlideEmbedding (v1.2).

---

### F7: Settings Page with Deck Structures and AI Chat

**What users expect:** Define "Touch 2 decks have: title, team intro, 3-5 capability slides, case study, next steps."

**Table stakes:**
- Settings page at `/settings` with sidebar nav entry
- Per-touch-type deck structure CRUD
- Ordered section list with name, required flag, slide count range

**Differentiator:**
- AI-suggested structures from ingested examples ("Based on 5 Touch 2 examples, typical structure is...")
- Chat interface for refinement ("Add competitive analysis after problem statement")
- Structure validation on assembly (warn on deviation)
- Multiple variants per touch ("short pitch" vs "deep dive")

**Implementation:**
- New `DeckStructure` model: `{ id, touchType, name, sections: String (JSON), isDefault: Boolean, createdAt, updatedAt }`
- Sections JSON schema: `[{ name: string, required: boolean, minSlides: number, maxSlides: number, slideCategories: string[], description?: string }]`
- AI inference: Mastra agent with tool that reads SlideEmbedding stats grouped by touch-bound examples. Requires F6 (classification) and F5 (element maps) to be meaningful.
- Chat: Non-streaming request/response. POST to Mastra route. LLM takes current structure JSON + user message, returns updated structure JSON.
- Settings page: Next.js at `/settings` with tabs per touch type. AI suggestions shown as proposed structures user can accept/modify.
- Only enable AI inference when 2+ examples exist for a touch (prevents hallucinated structures).

**Depends on:** F5 (element maps for structural analysis), F6 (classification for touch-bound examples), Mastra agent (v1.0).

## Feature Dependencies

```
F1: Discovery Thumbnails (standalone)
    depends on: GCS caching (v1.4), DiscoveryDocCache (v1.4)

F2: Consistent Ingestion Status (standalone)
    depends on: Agent batch system (v1.4), DiscoveryDocCache (v1.4)

F3: Immediate Feedback (standalone)
    depends on: nothing new

F4: Rich AI Descriptions
    depends on: Gemini classification pipeline (v1.2)
    enhanced by: F5 (element maps enrich description prompts)

F5: Structured Element Map
    depends on: Google Slides API (v1.3), ingestion pipeline (v1.2)
    enables: F7 (structural analysis for deck structure suggestions)

F6: Template vs Example Classification
    depends on: Template CRUD (v1.2), SlideEmbedding (v1.2)
    enables: F7 (touch-bound examples as input for structure inference)

F7: Settings + Deck Structures + AI Chat
    depends on: F5 (element maps), F6 (classification)
    enhances: all touch generation workflows (v1.0)
```

### Dependency Notes

- **F1, F2, F3 are fully independent** of each other and of F4-F7. Ship first.
- **F4 and F5 both modify the ingestion pipeline** -- implement together to avoid double-migration and double-deployment of ingestion flow.
- **F5 extracts data during the same API call** as existing text extraction (same `presentations.get` response, just parse more fields).
- **F6 is a prerequisite for F7** -- deck structures reference content classification to know which slides to pull per section.
- **F7 depends on F5 and F6** -- AI structure suggestions need element maps (from F5) and touch-bound examples (from F6) to be meaningful.

## MVP Recommendation

**Phase 1 -- UX Polish (no new models, minimal risk):**
1. F3: Immediate feedback on ingest (LOW, pure frontend, 30min fix)
2. F1: Discovery thumbnails (LOW, extends existing GCS pattern)
3. F2: Consistent ingestion status (MEDIUM, requires DB migration for DiscoveryDocCache extension)

**Phase 2 -- Slide Intelligence Foundation (pipeline changes):**
4. F5: Element map extraction (HIGH, parse and store page elements during ingestion)
5. F4: Rich AI descriptions (MEDIUM, extend Gemini prompt + new column)
6. F6: Template vs Example classification (LOW-MEDIUM, model + UI changes)

**Phase 3 -- Deck Intelligence Capstone (depends on Phase 2):**
7. F7: Settings page + deck structures + AI chat (HIGH, new model + page + agent integration)

**Defer to v1.6:** Element map-powered slide matching (query engine for structural matching during assembly).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| F3: Immediate feedback | HIGH | LOW | P1 | Eliminates perceived latency. Quick win. |
| F1: Discovery thumbnails | HIGH | LOW | P1 | Visual browsing is table stakes. Pattern exists. |
| F2: Consistent status | HIGH | MEDIUM | P1 | Fixes contradictory cross-page states. |
| F4: Rich AI descriptions | MEDIUM | MEDIUM | P1 | Marginal cost on existing pipeline. Browsability. |
| F5: Element map | HIGH | HIGH | P2 | Foundation for deck intelligence. Enables F7. |
| F6: Classification | MEDIUM | LOW-MEDIUM | P2 | Enables filtered retrieval. Prerequisite for F7. |
| F7: Deck structures + AI | HIGH | HIGH | P3 | Capstone. Depends on P2 completion. |

**Priority key:**
- P1: Must have -- ship first, closes UX gaps
- P2: Should have -- builds intelligence layer
- P3: Valuable but depends on P2 completion

## Competitor Feature Analysis

| Feature Area | Beautiful.ai | Pitch | Tome | Gamma | AtlusAI (v1.5) |
|-------------|-------------|-------|------|-------|-----------------|
| **Template structure** | ~60 predefined Smart Slide types | Team-defined slide masters | No templates -- pure generation | Card-based blocks | Inferred from existing Google Slides via element map (novel) |
| **Content categorization** | By slide type (data, comparison, quote) | By team/brand library | By AI topic | By card content | 8-axis classification + template/example/case_study + touch |
| **Deck structure** | Implicit in template selection | Team design systems | AI generates per prompt | Flexible cards | Explicit per-touch structures with AI inference from examples (novel for sales) |
| **Thumbnails** | Native rendering engine | Native | Native | Native | GCS-cached from Google Drive API |
| **AI descriptions** | Auto-generated alt text | None | AI content descriptions | AI summaries | Per-slide AI descriptions during ingestion |
| **Status feedback** | Instant (local-first) | Instant | Instant | Instant | Optimistic UI + persistent DB status sync |

**Key positioning:** AtlusAI does not compete as a presentation creator. It competes as a sales content intelligence platform that works WITH Google Slides. The differentiator is understanding existing corporate content (element maps, classification, structure inference) for intelligent assembly -- something competitors do not do because they own their rendering engines.

## Sources

- [Google Slides API: Page Elements](https://developers.google.com/workspace/slides/api/concepts/page-elements) -- 8 element types, placeholder types, structured properties (HIGH confidence)
- [Google Slides API: Element Operations](https://developers.google.com/workspace/slides/api/samples/elements) -- extraction and manipulation capabilities (HIGH confidence)
- [Google Drive API: File Metadata](https://developers.google.com/workspace/drive/api/guides/file-metadata) -- `thumbnailLink` behavior, short-lived URLs, auth requirements (HIGH confidence)
- [Drive API thumbnailLink stability issues](https://issuetracker.google.com/issues/229184403) -- known 404 issues with thumbnail URLs (MEDIUM confidence)
- [React 19 useOptimistic](https://react.dev/reference/react/useOptimistic) -- canonical optimistic UI pattern for instant feedback (HIGH confidence)
- [Beautiful.ai Smart Slides](https://www.beautiful.ai/smart-slides) -- predefined layout type approach (MEDIUM confidence)
- [Beautiful.ai vs Pitch](https://www.beautiful.ai/comparison/beautiful-ai-vs-pitch) -- competitor structure approaches (MEDIUM confidence)
- [Optimistic UI Architecture Patterns](https://javascript.plainenglish.io/optimistic-ui-in-frontend-architecture-do-it-right-avoid-pitfalls-7507d713c19c) -- rollback, idempotency, error handling (MEDIUM confidence)
- Existing codebase: `discovery-client.tsx`, `template-card.tsx`, `schema.prisma`, `slide-metadata.ts`, `constants.ts` (HIGH confidence, read directly)

---
*Feature research for: Lumenalta v1.5 Review Polish & Deck Intelligence*
*Researched: 2026-03-07*
