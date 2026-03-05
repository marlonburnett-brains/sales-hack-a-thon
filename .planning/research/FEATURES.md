# Feature Research: v1.2 Templates & Slide Intelligence

**Domain:** Agentic sales platform -- template management, AI slide classification, HITL rating, CI/CD automation
**Researched:** 2026-03-05
**Confidence:** HIGH (well-understood patterns applied to specific domain; codebase read directly)

---

## Scope

This document covers ONLY the v1.2 milestone features. The v1.0 product (touches 1-4, pre-call briefing, HITL, RAG) and v1.1 infrastructure (Supabase PostgreSQL, Vercel + Railway deploy, Google OAuth, API key auth) are shipped. The v1.2 milestone adds six capabilities:

1. CI/CD pipeline (GitHub Actions to Vercel + Railway + Prisma migrations)
2. Side panel navigation (Deals + Templates sections)
3. Templates management page (CRUD with Google Slides links, touch assignment)
4. Slide ingestion agent (extract, embed, classify slides into Supabase pgvector)
5. Access awareness (flag unshared Google Slides files)
6. Preview and rating engine (slide classification review + real-time improvement)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that are non-negotiable for v1.2 to feel complete. Without these, the milestone adds no usable value.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Templates CRUD page** | Users need to register Google Slides source decks before any ingestion can happen. Without a place to add/view/delete template links, the entire slide intelligence pipeline has no input. | LOW | Simple form: Google Slides URL, display name, touch type assignment (touch_1/2/3/4). Validates URL format, extracts presentation ID. List view with status badges. Extends existing `ContentSource` model which already has `sourceType`, `contentType`, `touchTypes`, `driveFileId`, `accessStatus`, `slideCount`, `ingestedCount` fields. Very little new schema work. |
| **Touch type assignment on templates** | Sellers need to know which templates feed which touch points. The existing system already routes by touch type (touch_1 through touch_4). Templates without touch assignment are useless for deck assembly. | LOW | Multi-select dropdown or checkbox group on the template form. Maps directly to existing `touchTypes` JSON array field on `ContentSource`. Already modeled in the Prisma schema -- purely a UI concern. |
| **Side panel navigation** | Current nav is a single top bar linking only to Deals. Adding Templates as a second top-level section requires a navigation paradigm shift. A side panel is the standard pattern for apps with 2+ sections and provides room for future growth. Users expect persistent, predictable navigation. | MEDIUM | Replace or augment the top nav bar in `(authenticated)/layout.tsx` with a collapsible sidebar. Two sections: Deals (existing `/deals` routes), Templates (new `/templates` routes). Use shadcn/ui sidebar component or a custom `Sheet`-based layout. Must preserve all existing `/deals` routes without breakage. |
| **Slide ingestion trigger** | After adding a template, users expect a way to process it. "Add template, then nothing happens" is confusing. A manual trigger button to kick off slide ingestion is baseline UX. | LOW | "Ingest Slides" button on template row or detail view. Calls the agent API endpoint to launch a Mastra workflow. Shows a loading/progress state. Depends on: Templates CRUD existing. |
| **Slide thumbnail preview** | After ingestion, users need to see what was extracted. A grid of slide thumbnails with classification labels is the minimum viable confirmation that the AI did something useful. Without visual output, users cannot validate ingestion. | MEDIUM | Google Slides API `presentations.pages.getThumbnail` returns PNG URLs with a 30-minute TTL. Either cache thumbnails (download and store in Drive/Supabase Storage) or re-fetch on page load. Display as a responsive card grid with classification tag overlays. Depends on: slide ingestion completing successfully. |
| **Access awareness (file sharing check)** | 14/17 content sources are currently inaccessible due to Drive permissions. If a user adds a Google Slides URL that the service account cannot read, the system must tell them immediately -- not fail silently during ingestion minutes later. | LOW | On template add: call Google Drive API `files.get` with service account credentials. If 403/404, show a warning banner: "This file is not shared with the agent. Share with [service-account-email@project.iam.gserviceaccount.com] as Viewer to enable ingestion." Update `ContentSource.accessStatus` to `not_accessible`. Also display the service account email clearly in the UI so users can copy it for sharing. |
| **Basic classification display** | After AI classifies slides by industry, solution pillar, persona, and funnel stage, users need to see those labels. A read-only tag display on each slide thumbnail is the minimum viable intelligence output. | LOW | Color-coded tag badges on each slide card, pulled from vector store metadata. Industry tags in one color, pillar tags in another. No editing needed at table-stakes level -- just display. Depends on: slide ingestion + classification pipeline completing. |
| **CI/CD pipeline (GitHub Actions)** | The team deploys manually to two platforms (Vercel + Railway) and runs Prisma migrations by hand. With 224 commits in 3 days, manual deploys are a bottleneck. CI/CD is infrastructure table stakes for any multi-environment project past v1.0. | MEDIUM | GitHub Actions workflow triggered on push to `main`. Three jobs: (1) lint + type-check via Turborepo (`turbo run lint build`), (2) deploy web to Vercel via `vercel deploy --prod` using Vercel CLI with `VERCEL_TOKEN`, (3) deploy agent to Railway via `railway up --service=$SVC_ID` using Railway CLI with `RAILWAY_TOKEN`. Prisma migrations run as part of Railway deploy via entrypoint script or pre-deploy command. Secrets needed: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID`. |

### Differentiators (Competitive Advantage)

Features that elevate v1.2 beyond "template admin page" into an intelligent content management system that learns from human feedback.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI slide classification into pgvector** | The core differentiator of v1.2. Each slide gets embedded and classified by industry, solution pillar, persona, and funnel stage. This powers the existing RAG retrieval for Touch 1-4 deck assembly with vector similarity instead of keyword matching. Better retrieval = better generated decks. Directly improves the core v1.0 product. | HIGH | Pipeline: (1) Extract slide content via Google Slides API -- text from all shapes + speaker notes per slide, (2) Generate vector embedding via Vertex AI text embedding model (matches existing GPT-OSS/Vertex stack), (3) Classify metadata via LLM structured output with Zod schema (industry, pillar, persona, funnel_stage, confidence), (4) Store embedding + metadata in Supabase pgvector. Requires: enable pgvector extension in Supabase (`CREATE EXTENSION IF NOT EXISTS vector`), new table for slide embeddings (raw SQL or Prisma `Unsupported("vector(768)")` type), Mastra agent workflow with per-slide processing loop. |
| **Human rating and feedback on classifications** | Thumbs up/down plus optional tag correction on each slide's AI-assigned labels. Creates a feedback loop: human corrections improve future classification quality. Mirrors the approve/override pattern already proven in Touch 1. Makes the AI progressively smarter with each review session. | MEDIUM | UI: thumbs up/down icons on each slide card, click-to-edit on classification tags (inline dropdown editing). Backend: store ratings in a model following the existing `FeedbackSignal` pattern -- `signalType` (positive/negative/correction), `source` (slide_classification), `content` (JSON diff of original vs corrected tags). Link to the slide record via foreign key. |
| **Real-time classification improvement** | When a human corrects a classification, the system updates the metadata immediately -- not in a nightly batch. The corrected slide's tags in pgvector update on save. Immediate visual feedback makes the rating experience feel responsive and worthwhile for reviewers. | MEDIUM | On correction submit: update the metadata columns in the pgvector slide record. Optionally re-embed with the corrected classification context prepended to the slide text (improves future similarity matches for this slide). No model fine-tuning needed -- this is metadata correction + optional re-embedding, both synchronous operations. Depends on: rating system providing correction data. |
| **Batch ingestion with progress tracking** | Process all slides from a multi-slide presentation (some decks have 30+ slides) with real-time progress: "Slide 12/38: Classifying..." Transforms a potentially slow operation (1-3 minutes for a large deck) into a transparent, watchable process. | MEDIUM | Mastra workflow processes slides sequentially or in small parallel batches (rate-limited to avoid Google API quota issues). Progress reported via polling endpoint or WebSocket. Reuse the existing Monotonic Set stepper pattern from Touch 4 UI -- already proven to prevent progress bar flicker during polling. |
| **Classification confidence scores** | Display the AI's confidence for each assigned tag (e.g., "Financial Services: 92%"). Helps users prioritize reviews -- low-confidence classifications get reviewed first, saving time. Surfaces where the AI is uncertain rather than hiding it. | LOW | LLM structured output via Zod already supports confidence fields: add `confidence: z.number().min(0).max(1)` to the classification schema. Display as a percentage badge or color-coded ring (green >80%, yellow 50-80%, red <50%) on each tag. Sort "needs review" queue by ascending confidence. |
| **Template version tracking** | Detect when a Google Slides source has been modified since last ingestion. Show a "stale" badge on the template list, offer one-click re-ingestion. Prevents serving outdated slide content to the deck assembly pipeline. | LOW | Store `modifiedTime` from Google Drive API `files.get` response on each `ContentSource` record (new field). On template list page load, compare stored vs current `modifiedTime` for each template. Show "Updated since last ingestion" warning badge if they differ. Requires one batch API call on page load -- efficient with a single `files.list` call. |
| **Slide similarity search** | "Find slides similar to this one" -- click any slide thumbnail, see its nearest neighbors across all ingested presentations. Surfaces duplicate or near-duplicate content, helps curators identify redundancy, and validates that embeddings are working correctly. | LOW | Pure pgvector cosine similarity query: `SELECT * FROM slide_embeddings ORDER BY embedding <=> $1 LIMIT 5`. Display as a "Similar Slides" side panel when a slide is selected. Minimal UI, maximum insight. Depends on: pgvector populated with embeddings from multiple presentations. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Drag-and-drop slide reordering in browser** | "Let me visually rearrange slides before generating a deck." | Rebuilding a Google Slides editor in the browser is massive scope creep. The system already handles slide ordering algorithmically during Touch 1-4 deck assembly. Visual reordering creates complex state management (optimistic updates, conflict with AI ordering) and competes with the actual Google Slides UI where sellers edit anyway. | Keep slide ordering in the AI assembly step. Sellers reorder in Google Slides after generation. Show a read-only "suggested order" preview in the app. |
| **In-browser slide content editing** | "Let me fix slide text right here without opening Google Slides." | The Google Slides API is write-capable but there is no WYSIWYG editor for Slides content. Building one requires rendering fonts, layouts, images, and animations -- months of specialized work for a feature Google Slides already provides. | Link each slide thumbnail directly to Google Slides for editing. The preview in the app is read-only by design. |
| **Automated nightly re-classification** | "Re-classify all slides every night to catch changes." | Expensive LLM + embedding API calls for content that rarely changes. Most templates are updated monthly at most. A 38-slide deck costs ~$0.50-1.00 in API calls to re-process. Nightly runs burn budget with no value. | Template version tracking (check `modifiedTime` via Drive API -- free) + manual re-ingestion trigger. Only re-classify when content actually changed. |
| **Multi-tenant template libraries** | "Each seller should have their own template collection." | This is a single-team tool for ~20 Lumenalta sellers. Multi-tenancy adds auth complexity, data isolation, per-tenant vector indices, and UI overhead for zero current value. The shared template library IS the product -- everyone draws from the same curated content. | Single shared template library visible to all authenticated users. Filter by touch type and tags, not by owner. |
| **Custom embedding model selection** | "Let power users choose which embedding model to use per template." | Creates inconsistent vector spaces. If half the slides use text-embedding-004 and half use text-embedding-005, cosine similarity across models is meaningless. Similarity search breaks, classification quality becomes unpredictable, and the configuration surface area explodes. | Pick one embedding model (Vertex AI text-embedding), use it for all slides. If the model needs upgrading, re-embed everything in a single migration batch. Consistency over configurability. |
| **Real-time collaborative template curation** | "Multiple admins editing template metadata at the same time." | Requires optimistic concurrency control, conflict resolution, WebSocket infrastructure, and cursor presence indicators -- all for a low-frequency admin operation. Template curation is done by 1-2 people, not collaboratively in real time. | Simple last-write-wins semantics. Template metadata edits (tags, touch type) are infrequent and non-contentious. Show `updatedAt` timestamp to surface potential conflicts. |
| **Full-text search across slide content** | "Let me search for specific words inside slides." | Requires extracting and indexing all text content from every slide, maintaining a text search index alongside the vector index, and building a search UI. The vector similarity search already finds semantically related slides, which is more useful than exact keyword matching for this use case. | Use vector similarity search as the primary discovery mechanism. If exact keyword search is needed later, Supabase has built-in full-text search via `tsvector` -- add as a P3 enhancement. |

---

## Feature Dependencies

```
[CI/CD Pipeline]
    (independent -- pure infrastructure, no feature dependencies)

[Side Panel Navigation]
    (independent -- layout change, prerequisite for Templates section routing)

[pgvector Setup in Supabase]
    (independent -- database extension + schema, prerequisite for ingestion)

[Templates CRUD]
    └──requires──> [Side Panel Navigation] (needs nav entry point at /templates)

[Access Awareness]
    └──enhances──> [Templates CRUD] (validates sharing on template add/view)

[Slide Ingestion Agent]
    └──requires──> [Templates CRUD] (needs template records to know what to process)
    └──requires──> [pgvector Setup] (needs vector storage target for embeddings)
    └──requires──> [Access Awareness] (should only attempt accessible templates)

[Slide Thumbnail Preview]
    └──requires──> [Slide Ingestion Agent] (needs ingested slide records)

[Classification Display]
    └──requires──> [Slide Ingestion Agent] (needs classification results in pgvector)

[Human Rating System]
    └──requires──> [Classification Display] (needs visible classifications to rate)
    └──requires──> [Slide Thumbnail Preview] (needs visual context for meaningful feedback)

[Real-time Classification Improvement]
    └──requires──> [Human Rating System] (needs correction input to apply)

[Template Version Tracking]
    └──enhances──> [Templates CRUD] (adds staleness detection to template list)

[Slide Similarity Search]
    └──requires──> [Slide Ingestion Agent] (needs populated vector store with multiple decks)

[Confidence Scores]
    └──requires──> [Classification Display] (adds confidence overlay to existing tags)

[Batch Progress Tracking]
    └──enhances──> [Slide Ingestion Agent] (adds progress UI to existing trigger)
```

### Dependency Notes

- **CI/CD Pipeline is fully independent:** Can be built first and in parallel with all other features. Should be first because it accelerates deployment of every subsequent feature.
- **Side Panel Navigation gates Templates CRUD:** Templates need a `/templates` route accessible from navigation. Building the CRUD page without a nav entry means users cannot reach it. However, the nav and CRUD page can be built together in a single phase.
- **pgvector Setup gates Slide Ingestion:** Embeddings need a storage target. The Supabase pgvector extension must be enabled and the slide embeddings table must exist before the ingestion agent can write data. This is a schema/migration task, not a feature.
- **Templates CRUD gates Slide Ingestion:** The ingestion agent needs `ContentSource` records with `driveFileId` values to know which presentations to process. No templates registered = nothing to ingest.
- **Human Rating requires both Preview AND Classification Display:** Users need to (a) see the slide visually (thumbnail) and (b) see its current classification (tags) to provide meaningful feedback. Rating without either context is useless.
- **Real-time Improvement requires Human Rating:** Corrections flow from the rating UI. No correction input = nothing to improve in the vector store.
- **Access Awareness enhances Templates CRUD (not blocks it):** Templates can be created without access checks, but the UX is much better with immediate sharing validation. Build them together.

---

## Existing System Dependencies

These features directly build on what v1.0/v1.1 already shipped. Understanding these integration points is critical for implementation planning.

| New Feature | Existing System It Extends | Integration Point |
|-------------|---------------------------|-------------------|
| Templates CRUD | `ContentSource` Prisma model (v1.0) | Reuse and extend existing model fields: `driveFileId`, `touchTypes`, `accessStatus`, `slideCount`, `ingestedCount`, `lastCheckedAt`. May need 1-2 new fields (e.g., `modifiedTime` for version tracking). No new model needed. |
| Access Awareness | Google Drive service account auth (v1.0) | Same `googleapis` client and same credential injection pattern (entrypoint writes JSON to temp file). Use `files.get` with `fields: 'id,name,modifiedTime'` -- if 403, file is not shared. |
| Slide Ingestion Agent | Mastra AI workflows + Google Slides API (v1.0) | Same agent server on Railway, same `presentations.get` API already used for copy-and-prune deck assembly. New: `presentations.pages.getThumbnail` for previews. New: per-slide text extraction loop. |
| Classification Display | AtlusAI taxonomy (v1.0) | Same classification categories: 11 industries, solution pillars, personas, funnel stages. Constants already defined in `packages/schemas`. |
| Human Rating | `FeedbackSignal` model + approve/override pattern (v1.0) | Same signal pattern: `signalType` (positive/negative/correction), `source` (slide_classification), `content` (JSON payload). Extends existing feedback infrastructure. |
| Slide Thumbnail Preview | Google Slides API (v1.0) | Same API client. New endpoint: `presentations.pages.getThumbnail`. Returns PNG URL with 30-min TTL. |
| Side Panel Navigation | shadcn/ui component library (v1.0) | Same design system. New sidebar layout component replacing current top-bar-only layout in `(authenticated)/layout.tsx`. |
| CI/CD Pipeline | Turborepo + Vercel + Railway deploy targets (v1.1) | Automates existing manual `vercel deploy --prod` and `railway up` commands. Turbo already has `build`, `lint`, `db:generate`, `db:migrate` tasks defined in `turbo.json`. |

---

## MVP Definition (v1.2 Scope)

### Launch With (v1.2 Core)

The minimum feature set to demonstrate template intelligence with human-in-the-loop improvement.

- [x] **CI/CD Pipeline** -- eliminates manual deploy friction, accelerates iteration on all subsequent features
- [x] **Side Panel Navigation** -- structural prerequisite; provides room for Templates + future sections
- [x] **Templates CRUD** -- users can register Google Slides templates with display name and touch type assignment
- [x] **Access Awareness** -- immediate feedback when templates are not shared with agent service account
- [x] **pgvector Setup** -- enable extension, create slide embeddings table, write Prisma migration
- [x] **Slide Ingestion Agent** -- core AI pipeline: extract text per slide, generate embedding, classify with structured output, store in pgvector
- [x] **Slide Thumbnail Preview** -- visual grid of ingested slides with thumbnails
- [x] **Classification Display** -- AI-assigned tags (industry, pillar, persona, funnel stage) shown on each slide card
- [x] **Human Rating (thumbs up/down + tag correction)** -- basic feedback loop on classifications
- [x] **Real-time Classification Improvement** -- corrections update pgvector metadata immediately on save

### Add After Validation (v1.2.x)

Features to add once the core pipeline is working and users are reviewing classifications.

- [ ] **Confidence scores on classification tags** -- add when users ask "which slides should I review first?"
- [ ] **Template version tracking (staleness detection)** -- add when templates are updated in Google Slides and stale content is noticed
- [ ] **Batch ingestion progress tracking** -- add when ingesting large presentations (30+ slides) feels like a black box
- [ ] **Slide similarity search** -- add after multiple presentations are ingested and users want to find cross-deck duplicates

### Future Consideration (v2+)

- [ ] **Cross-template deduplication** -- automatically flag near-duplicate slides across presentations for curator review
- [ ] **Classification analytics dashboard** -- distribution of slides by industry/pillar/persona, coverage gaps, review completion rates
- [ ] **Drive webhook auto-re-ingestion** -- Google Drive push notifications trigger re-ingestion when template source files change
- [ ] **Full-text slide content search** -- Supabase `tsvector` index for exact keyword search alongside vector similarity

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Builds On |
|---------|------------|---------------------|----------|-----------|
| CI/CD Pipeline | HIGH | MEDIUM | P1 | Turborepo, Vercel CLI, Railway CLI |
| Side Panel Navigation | MEDIUM | LOW | P1 | shadcn/ui, existing layout |
| Templates CRUD | HIGH | LOW | P1 | `ContentSource` model (existing) |
| Access Awareness | HIGH | LOW | P1 | Google Drive service account (existing) |
| pgvector Setup | HIGH | LOW | P1 | Supabase PostgreSQL (existing) |
| Slide Ingestion Agent | HIGH | HIGH | P1 | Mastra workflows, Google Slides API, Vertex AI embeddings |
| Slide Thumbnail Preview | HIGH | MEDIUM | P1 | Google Slides `getThumbnail` API |
| Classification Display | HIGH | LOW | P1 | Ingestion pipeline output |
| Human Rating (basic) | HIGH | MEDIUM | P1 | `FeedbackSignal` pattern (existing) |
| Real-time Improvement | MEDIUM | MEDIUM | P1 | Rating system output |
| Confidence Scores | MEDIUM | LOW | P2 | Classification Zod schema |
| Template Version Tracking | MEDIUM | LOW | P2 | Drive API `modifiedTime` field |
| Batch Progress Tracking | MEDIUM | MEDIUM | P2 | Monotonic Set stepper pattern (existing) |
| Slide Similarity Search | LOW | LOW | P3 | pgvector cosine similarity |

**Priority key:**
- P1: Must have for v1.2 launch (10 features -- the full intelligence pipeline end-to-end)
- P2: Should have, add in v1.2.x iterations when users request them
- P3: Nice to have, future consideration

---

## Detailed Feature Descriptions

### 1. CI/CD Pipeline (GitHub Actions)

**What it automates:**

Currently, deploying requires manually running `vercel deploy --prod` for the web app and `railway up` for the agent server, plus manually running `prisma migrate deploy` against production. With 224 commits in 3 days, this manual process is unsustainable.

**What the workflow looks like:**

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  check:
    # Run turbo lint + type-check + build
    # Uses Turborepo caching for speed

  deploy-web:
    needs: check
    # Install Vercel CLI
    # Run: vercel deploy --prod --token=$VERCEL_TOKEN
    # Vercel handles monorepo root detection via vercel.json

  deploy-agent:
    needs: check
    # Install Railway CLI
    # Run: railway up --service=$RAILWAY_SERVICE_ID
    # Railway Dockerfile handles prisma generate + prisma migrate deploy + mastra build
```

**Secrets required:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID`

**Prisma migrations:** Run automatically during Railway deploy as part of the Docker entrypoint or Dockerfile `CMD` -- execute `npx prisma migrate deploy` before starting the agent. This follows the project's forward-only migration discipline.

**What the user experiences:** Push to `main`, everything deploys automatically. No manual steps. Failures surface as GitHub Actions notifications.

### 2. Templates CRUD Page

**What the user sees:**

```
/templates
+------------------------------------------+
| Templates                    [+ Add New]  |
+------------------------------------------+
| Name          | Touch   | Slides | Status |
|---------------|---------|--------|--------|
| Meet Lumenalta| T2      | 12/12  | Ready  |
| AtlusAI Deck  | T3, T4  | 38/38  | Ready  |
| NBC Case Study| T3      | 0/0    | No Access |
| First Contact | T1      | 8/8    | Stale  |
+------------------------------------------+
```

**Add Template form:**
- Google Slides URL (validated: must match `docs.google.com/presentation/d/{id}`)
- Display name (auto-populated from presentation title via API if accessible)
- Touch type assignment (multi-select: Touch 1, Touch 2, Touch 3, Touch 4)
- On submit: extract presentation ID from URL, check access via Drive API, create `ContentSource` record

**Status badges:**
- "Ready" (green) -- ingested, all slides classified
- "Ingesting..." (blue, animated) -- ingestion in progress
- "No Access" (red) -- service account cannot read the file
- "Stale" (yellow) -- template modified since last ingestion (v1.2.x)
- "Not Ingested" (gray) -- template added but never processed

### 3. Slide Ingestion Agent

**What the pipeline does for each slide:**

```
Input: ContentSource record with driveFileId (presentation ID)

Step 1: Fetch presentation structure
  - Google Slides API: presentations.get(presentationId)
  - Extract: list of page IDs, slide count

Step 2: For each slide (page):
  a. Extract text content
     - Iterate all page elements (shapes, tables, groups)
     - Concatenate text from each element + speaker notes
     - Result: plain text representation of slide content

  b. Generate thumbnail
     - Google Slides API: presentations.pages.getThumbnail(presentationId, pageId)
     - Result: PNG URL (30-min TTL)
     - Store URL or download + store in Supabase Storage

  c. Generate embedding
     - Vertex AI text-embedding model (e.g., text-embedding-004)
     - Input: slide text content
     - Output: 768-dimensional vector

  d. Classify metadata via LLM
     - GPT-OSS 120b structured output with Zod schema:
       {
         industry: z.enum([...11 industries]),
         solutionPillar: z.string(),
         persona: z.string(),
         funnelStage: z.enum(["awareness", "consideration", "decision", "retention"]),
         contentType: z.enum(["title", "agenda", "case_study", "capability", "process", ...]),
         confidence: z.number().min(0).max(1)
       }
     - Input: slide text + context (presentation title, position in deck)

  e. Store in pgvector
     - INSERT into slide_embeddings table:
       (id, content_source_id, slide_index, text_content, embedding, metadata,
        thumbnail_url, created_at)

Step 3: Update ContentSource
  - Set slideCount = total slides
  - Set ingestedCount = successfully processed slides
  - Set lastCheckedAt = now()
```

**What a slide embedding record looks like in the database:**

```sql
CREATE TABLE slide_embeddings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  content_source_id TEXT NOT NULL REFERENCES "ContentSource"(id),
  slide_index INTEGER NOT NULL,
  page_object_id TEXT NOT NULL,
  text_content TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  -- Classification metadata (from LLM)
  industry TEXT,
  solution_pillar TEXT,
  persona TEXT,
  funnel_stage TEXT,
  content_type TEXT,
  confidence FLOAT,
  -- Thumbnail
  thumbnail_url TEXT,
  -- Human feedback
  human_rating TEXT, -- 'positive' | 'negative' | null
  human_corrections JSONB, -- {industry: "corrected_value", ...}
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(content_source_id, slide_index)
);

-- HNSW index for fast similarity search
CREATE INDEX ON slide_embeddings USING hnsw (embedding vector_cosine_ops);
```

**Note on Prisma:** Prisma does not natively support the `vector` type. Use `Unsupported("vector(768)")` in the Prisma schema for the column definition, and use raw SQL (`prisma.$queryRaw`) for vector operations (similarity search, embedding insert). The migration creating this table should be written as raw SQL via `prisma migrate dev --create-only`, then edited to include the `vector` column and HNSW index.

### 4. Human Rating and Classification Improvement

**What the review UX looks like:**

```
/templates/[id]/review
+--------------------------------------------------+
| Meet Lumenalta - Slide Review          12/12 done |
+--------------------------------------------------+
| [Thumbnail]     Industry: Financial Services  [x] |
|                 Pillar: Digital Transformation [x] |
| Slide 3/12      Persona: CTO                 [x] |
|                 Stage: Consideration          [x] |
|                 Confidence: 87%                   |
|                                                   |
|                 [thumbs-down] [thumbs-up]         |
+--------------------------------------------------+
```

**Interaction patterns:**

1. **Thumbs up:** User confirms classification is correct. Stores positive signal. Slide marked as "reviewed."
2. **Thumbs down:** User indicates classification is wrong. Opens inline tag correction:
   - Each tag becomes an editable dropdown with the full taxonomy
   - User selects correct values
   - On save: stores negative signal + correction diff, updates pgvector metadata immediately
3. **Click [x] on any tag:** Opens inline correction for that specific tag without requiring thumbs-down first (shortcut for partial corrections)
4. **Keyboard navigation:** Arrow keys to move between slides, Enter to approve, Tab to move between tags

**Feedback storage:** Extends the existing `FeedbackSignal` pattern:
```
signalType: "positive" | "negative" | "correction"
source: "slide_classification_review"
content: JSON {
  slideEmbeddingId: "...",
  originalTags: { industry: "Healthcare", pillar: "AI/ML" },
  correctedTags: { industry: "Financial Services", pillar: "AI/ML" },
  diff: { industry: { from: "Healthcare", to: "Financial Services" } }
}
```

**Real-time improvement flow:**
1. User corrects a tag -> frontend sends PATCH to agent API
2. Agent updates `slide_embeddings` metadata columns (industry, pillar, etc.)
3. Agent optionally re-embeds: prepend corrected classification context to slide text, generate new embedding, update vector in pgvector
4. Frontend refreshes the slide card to show updated tags
5. Next similarity search or Touch 1-4 deck assembly uses the corrected metadata

### 5. Access Awareness

**What the user sees when adding an inaccessible template:**

```
+--------------------------------------------------+
| Add Template                                      |
+--------------------------------------------------+
| URL: https://docs.google.com/presentation/d/1abc  |
| Name: NBC Universal Case Study                    |
| Touch: [Touch 3] [Touch 4]                       |
|                                                   |
| [!] Cannot access this presentation.              |
|     Share it with:                                |
|     agent@lumenalta-sales.iam.gserviceaccount.com |
|     [Copy Email]                                  |
|                                                   |
|     The template will be saved but cannot be       |
|     ingested until access is granted.             |
|                                                   |
| [Save Anyway]  [Cancel]                           |
+--------------------------------------------------+
```

**Implementation:** On URL input blur or form submit:
1. Extract presentation ID from URL
2. Call `drive.files.get({ fileId: presentationId, fields: 'id,name,modifiedTime' })` with service account
3. Success (200): populate display name from response, set `accessStatus: "accessible"`
4. Error (403/404): show warning banner, set `accessStatus: "not_accessible"`, disable "Ingest" button
5. Display service account email prominently with copy button

**Periodic re-check:** On template list page load, re-validate access for `not_accessible` templates. If access has been granted since last check, update status automatically.

---

## Sources

- [Supabase pgvector documentation](https://supabase.com/docs/guides/database/extensions/pgvector) -- extension setup, vector columns, similarity search functions
- [Supabase vector columns guide](https://supabase.com/docs/guides/ai/vector-columns) -- data types, dimensions, indexing
- [Supabase semantic search guide](https://supabase.com/docs/guides/ai/semantic-search) -- match functions, threshold tuning
- [Google Slides API getThumbnail](https://developers.google.com/slides/api/reference/rest/v1/presentations.pages/getThumbnail) -- thumbnail extraction, PNG format, 30-min URL TTL
- [Google Drive API permissions.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/list) -- checking file access for service accounts
- [Google Drive API sharing guide](https://developers.google.com/workspace/drive/api/guides/manage-sharing) -- permission model, roles
- [Railway GitHub Actions guide](https://blog.railway.com/p/github-actions) -- project tokens, CLI deploy, service IDs
- [Vercel GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) -- Vercel CLI, token auth, monorepo support
- [Vercel monorepo CI/CD academy](https://vercel.com/academy/production-monorepos/github-actions) -- Turborepo integration, caching
- [Railway monorepo deployment docs](https://docs.railway.com/guides/monorepo) -- root directory configuration
- [HITL AI design patterns 2025](https://blog.ideafloats.com/human-in-the-loop-ai-in-2025/) -- review queue UX, feedback types, rating patterns
- [pgvector 2026 guide](https://www.instaclustr.com/education/vector-database/pgvector-key-features-tutorial-and-pros-and-cons-2026-guide/) -- HNSW indexing, performance tuning
- Codebase analysis: `apps/agent/prisma/schema.prisma` -- 9 existing models, `ContentSource` with ingestion tracking fields (HIGH confidence, read directly)
- Codebase analysis: `apps/web/src/app/(authenticated)/layout.tsx` -- current top-bar navigation, shadcn/ui components (HIGH confidence, read directly)
- Codebase analysis: `turbo.json` -- existing build, lint, db:generate, db:migrate task definitions (HIGH confidence, read directly)

---

*Feature research for: v1.2 Templates & Slide Intelligence milestone*
*Researched: 2026-03-05*
