# Technology Stack — v1.5 Review Polish & Deck Intelligence

**Project:** AtlusAI Agentic Sales Orchestration
**Researched:** 2026-03-07
**Confidence:** HIGH (all features use existing installed packages)

## Scope

This research covers ONLY stack additions/changes for v1.5 (Review Polish & Deck Intelligence). The existing validated stack (Next.js 15, Mastra AI 1.8, Prisma 6.19 + Supabase PostgreSQL + pgvector, Google Workspace APIs via `googleapis` v144, shadcn/ui, React 19, Supabase Auth + Google OAuth, Sonner, GCS thumbnail caching) is NOT re-researched.

**Focus areas:**
1. Google Slides API element map extraction from `presentations.get`
2. Google Drive API file metadata/thumbnails for Discovery cards
3. Optimistic UI patterns for ingest click feedback
4. AI chat interface for deck structure refinement
5. Rich AI-generated slide descriptions during ingestion
6. Template vs Example classification with touch binding

---

## Executive Summary

v1.5 requires **zero new package dependencies**. Every feature builds on existing installed libraries:

- **Element maps:** The `presentations.get` response already contains full `pageElements[]` structure -- `slide-extractor.ts` just discards it today
- **Discovery thumbnails:** `drive.files.get` with `fields=thumbnailLink,hasThumbnail,iconLink,mimeType` plus existing GCS caching pattern
- **Optimistic UI:** React 19 `useOptimistic` hook (already used in `actions-client.tsx`)
- **AI chat:** shadcn/ui primitives + existing `fetchJSON` API client + new Mastra Hono route
- **Rich descriptions:** Additional LLM prompt step in existing ingestion pipeline
- **Classification:** Prisma schema addition + shadcn/ui Select component

---

## Recommended Stack (v1.5) -- No New Packages

### 1. Google Slides API — Structured Element Map Extraction

| Aspect | Detail |
|--------|--------|
| **Library** | `googleapis` v144.0.0 (already in `apps/agent/package.json`) |
| **API Method** | `slides.presentations.get({ presentationId })` -- already called at `slide-extractor.ts` line 151 |
| **Current gap** | `extractSlidesFromPresentation()` extracts text only, discards structural element data |
| **v1.5 approach** | Extend the same function to also return a structured element map per slide -- no additional API calls |
| **Confidence** | HIGH -- verified against current codebase and [Google Slides API page elements docs](https://developers.google.com/workspace/slides/api/concepts/page-elements) |

**What `presentations.get` already returns per slide (currently discarded):**

Eight `pageElement` types, each with:
- `objectId` -- stable ID for `batchUpdate` operations (critical for downstream deck generation)
- `size` / `transform` -- position, dimensions, rotation
- Type-specific properties:

| Element Type | Key Properties | Why It Matters for Deck Intelligence |
|-------------|----------------|--------------------------------------|
| **Shape** | `shapeProperties`, `text.textElements[]`, `placeholder.type` (TITLE, SUBTITLE, BODY, etc.) | Identifies slide layout structure, text content, and placeholder positions for template replacement |
| **Image** | `imageProperties.contentUrl`, `sourceUrl`, `cropProperties` | Tracks image positions for swap operations during deck generation |
| **Table** | `tableRows[].tableCells[].text`, `rows`, `columns` | Identifies data tables for content injection |
| **Line** | `lineProperties`, `lineType` (STRAIGHT, BENT, CURVED) | Tracks decorative/connector elements |
| **Video** | `videoProperties.videoUri` | Identifies embedded media |
| **WordArt** | `renderedText` | Visual text elements |
| **SheetsChart** | `chartId`, `spreadsheetId` | Embedded chart tracking |
| **Group** | `children[]` (recursive `PageElement[]`) | Nested element containers |

**Implementation: extend `ExtractedSlide` interface:**

```typescript
interface SlideElement {
  objectId: string;
  type: 'shape' | 'image' | 'table' | 'line' | 'video' | 'wordArt' | 'sheetsChart' | 'group';
  position: { x: number; y: number }; // from transform
  size: { width: number; height: number };
  placeholderType?: string; // TITLE, SUBTITLE, BODY, etc.
  textContent?: string; // for shapes/tables
  imageUrl?: string; // for images
  childCount?: number; // for groups/tables
}

interface ExtractedSlide {
  // ... existing fields ...
  elementMap: SlideElement[]; // NEW
}
```

**Storage:** `SlideEmbedding.elementMapJson` (new `String?` column) -- JSON serialized. Read as a whole per slide, not queried individually, so JSON column is appropriate over a normalized table.

### 2. Google Drive API — Discovery Document Thumbnails

| Aspect | Detail |
|--------|--------|
| **Library** | `googleapis` v144.0.0 (already installed) |
| **API Method** | `drive.files.get({ fileId, fields: 'thumbnailLink,hasThumbnail,iconLink,mimeType,name' })` |
| **Current usage** | `drive.files.get` already called in 6+ places in `mastra/index.ts` |
| **Confidence** | HIGH -- verified against [Google Drive API file metadata docs](https://developers.google.com/workspace/drive/api/guides/file-metadata) |

**Key fields to request:**

| Field | Type | Notes |
|-------|------|-------|
| `thumbnailLink` | string | Short-lived URL (hours), **blocked by CORS** -- must proxy server-side |
| `hasThumbnail` | boolean | Check before attempting fetch |
| `iconLink` | string | Always available, small icon, no CORS issues |
| `mimeType` | string | For file-type icon fallback |

**CORS constraint and solution:**

`thumbnailLink` URLs cannot be used directly in `<img>` tags due to CORS policy. Two approaches:

1. **Reuse existing GCS caching pattern** (RECOMMENDED): Fetch `thumbnailLink` server-side, upload to GCS via existing `uploadThumbnailToGCS()` from `gcs-thumbnails.ts`, store the GCS URL in `DiscoveryDocCache.cachedThumbnailUrl`. This is the same pattern already proven for slide thumbnails.

2. **Fallback for non-Slides documents**: For Docs/Sheets/PDFs where Slides API thumbnails aren't available, fetch `thumbnailLink` server-side and cache to GCS using the same pattern.

3. **Icon fallback**: When `hasThumbnail` is false, use `iconLink` or hardcoded lucide-react icons (`FileText`, `Sheet`, `Presentation`, `FileImage`).

**No new packages needed.** `gcs-thumbnails.ts` already handles GCS uploads via `googleapis` storage client (not `@google-cloud/storage`).

### 3. React 19 — Optimistic UI for Ingest Click

| Aspect | Detail |
|--------|--------|
| **Library** | `react` v19.0.0 (already installed) |
| **Hook** | `useOptimistic(state, updateFn)` -- built into React 19 |
| **Existing usage** | Already used in `apps/web/src/app/(authenticated)/actions/actions-client.tsx` |
| **Confidence** | HIGH -- verified via [React 19 useOptimistic docs](https://react.dev/reference/react/useOptimistic) and existing codebase |

**Pattern for Templates page ingest button:**

```typescript
const [optimisticStatus, setOptimisticStatus] = useOptimistic(
  template.ingestionStatus,
  (_current: string, newStatus: string) => newStatus
);

async function handleIngest() {
  setOptimisticStatus("queued"); // Instant UI update
  startTransition(async () => {
    await triggerIngestionAction(templateId);
    // On success: server revalidation updates real status
    // On error: optimistic state automatically rolls back
  });
}
```

**Also needed:** `useTransition` (already used throughout codebase) to wrap the server action call, providing `isPending` state for loading indicators.

**Discovery page pattern:** Same approach for the batch ingest flow in `discovery-client.tsx`. Currently uses manual `itemStatuses` Map state -- replace with `useOptimistic` over the statuses.

### 4. AI Chat Interface — Deck Structure Refinement (Settings Page)

| Aspect | Detail |
|--------|--------|
| **Library** | shadcn/ui primitives (all already installed) -- NO new packages |
| **Why NOT Vercel AI SDK** | Agent uses Mastra AI with custom Hono routes. Adding `@ai-sdk/react` introduces a parallel streaming layer that conflicts with the established `fetchJSON` -> Mastra route architecture. |
| **Why NOT streaming** | Deck structure refinement produces short structured responses (JSON deck outlines), not long-form text. Standard request/response via POST is sufficient and simpler. |
| **Confidence** | HIGH -- architectural decision based on existing patterns |

**Build from existing shadcn/ui components:**

| Component | Source | Purpose |
|-----------|--------|---------|
| `ScrollArea` | `@radix-ui/react-scroll-area` (add via `npx shadcn@latest add scroll-area`) | Message list container |
| `Card` | Already installed | Message bubbles |
| `Input` + `Button` | Already installed | Message input |
| `Loader2` | `lucide-react` (already installed) | Typing indicator |
| `Avatar` | `@radix-ui/react-avatar` (already installed) | User/AI message differentiation |

**Note:** `ScrollArea` is the only shadcn/ui component that may need to be added via the CLI. It's a thin wrapper around `@radix-ui/react-scroll-area` and does not add a new package dependency since Radix is already in the project.

**Chat architecture:**

```
User types message
  -> POST /api/chat/deck-structure (new Mastra route)
  -> Mastra agent processes with LLM (GPT-OSS 120b)
  -> Returns structured JSON response
  -> Client appends to messages array
  -> Rendered in ScrollArea with Card components
```

**State management:** Simple `useState<Message[]>` + `useTransition` for pending state. No external state library needed.

### 5. Rich AI-Generated Slide Descriptions

| Aspect | Detail |
|--------|--------|
| **Library** | Existing Gemini/GPT-OSS via Mastra AI |
| **Current pattern** | 8-axis classification runs during ingestion, stored in `classificationJson` |
| **v1.5 approach** | Add description generation step alongside classification in the ingestion pipeline |
| **Confidence** | HIGH -- follows existing ingestion pipeline pattern in `ingest-template.ts` |

**No new packages.** The LLM call uses the same Mastra AI / Vertex AI integration already in place. The prompt includes:
- Slide text content (already extracted)
- Speaker notes (already extracted)
- Element map structure (new from feature #1)
- Thumbnail URL (already cached in GCS)

**Storage:** New `description` `String?` column on `SlideEmbedding` model.

### 6. Template vs Example Classification + Touch Binding

| Aspect | Detail |
|--------|--------|
| **Library** | Prisma (existing), shadcn/ui Select (existing) |
| **Confidence** | HIGH -- standard schema addition + UI component |

**Schema additions:**

```prisma
// Template model additions
contentRole    String    @default("template") // "template" | "example"
boundTouchType String?   // Only for examples: "touch_1" | "touch_2" | etc.
```

**UI:** Existing `@radix-ui/react-select` for the dropdown. Existing `touchTypes` field on `Template` model shows this pattern is already established.

---

## Schema Migrations Required

All via `prisma migrate dev --name <name>` (never `db push` per CLAUDE.md rules):

```prisma
// Migration 1: Slide intelligence additions
// Add to SlideEmbedding model:
description    String?   // Rich AI-generated description
elementMapJson String?   // JSON: structured element map from Slides API

// Migration 2: Template classification
// Add to Template model:
contentRole    String    @default("template") // "template" | "example"
boundTouchType String?   // null for templates, required for examples

// Migration 3: Discovery thumbnail cache
// Add to DiscoveryDocCache model:
cachedThumbnailUrl String?  // GCS URL for cached document thumbnail
```

---

## Alternatives Considered

| Feature | Recommended | Alternative | Why Not Alternative |
|---------|-------------|-------------|-------------------|
| Chat UI | Custom shadcn/ui primitives | Vercel AI SDK `@ai-sdk/react` + `useChat` | Conflicts with Mastra route architecture; adds unnecessary streaming for short structured responses; would require new API route pattern incompatible with existing `fetchJSON` |
| Chat UI | Custom shadcn/ui primitives | `shadcn-chatbot-kit` (Blazity) | External dependency for 3-4 components; copy-paste approach means no version management; existing primitives sufficient |
| Discovery thumbnails | GCS cache (reuse existing pattern) | Direct `thumbnailLink` in `<img>` tags | CORS-blocked; thumbnailLink URLs expire in hours |
| Discovery thumbnails | GCS cache | `iconLink` only (no thumbnails) | Loses visual distinction -- thumbnails are the primary UX improvement requested in REVIEW-ISSUES.md #1 |
| Element map storage | JSON column (`elementMapJson`) | Separate `SlideElement` model with relations | Over-normalized; element maps read as a whole per slide, never queried individually; JSON simpler and faster |
| Optimistic UI | React 19 `useOptimistic` | Manual `useState` with rollback logic | `useOptimistic` is purpose-built, handles pending state automatically, already used in codebase |
| Ingestion status sync | Polling (existing pattern) | WebSocket / SSE real-time push | Over-engineering for ~20 users; polling at 2-3s intervals already works on Templates page |
| Slide descriptions | LLM during ingestion | Pre-computed static templates | Descriptions must reflect actual slide content; static templates can't capture this |

---

## What NOT to Add

| Package | Why NOT |
|---------|---------|
| `@ai-sdk/react` / `ai` (Vercel AI SDK) | Mastra handles LLM orchestration; adding a second AI framework creates architectural confusion and dual streaming patterns |
| `@google-cloud/storage` | Already using `googleapis` storage v1 client for GCS (see `gcs-thumbnails.ts` line 36); two GCS clients is redundant |
| `socket.io` / `ws` | Real-time push is over-engineering for ~20 users with existing polling |
| `react-markdown` / `remark` | Chat responses are structured JSON deck outlines, not markdown prose |
| `@tanstack/react-query` | Server Actions + `useOptimistic` + `useTransition` cover all data fetching; client-side cache layer conflicts with Next.js server-first architecture |
| `swr` | Same rationale as react-query above |
| `prompt-kit` / `ai-elements` | Designed for Vercel AI SDK `useChat` pattern, not Mastra route pattern |

---

## Installation

```bash
# No new packages to install. Zero changes to package.json.
# All features use existing dependencies.

# Only action: run migrations for new schema columns
cd apps/agent
pnpm exec prisma migrate dev --name add-slide-description-element-map
pnpm exec prisma migrate dev --name add-template-classification
pnpm exec prisma migrate dev --name add-discovery-thumbnail-cache

# Optional: add ScrollArea shadcn component if not already generated
cd apps/web
npx shadcn@latest add scroll-area
```

---

## Integration Points with Existing Code

### Element Map Extraction
- **Modify:** `apps/agent/src/lib/slide-extractor.ts` -- extend `ExtractedSlide` interface and `extractSlidesFromPresentation()` to parse `pageElements` fully
- **Modify:** `apps/agent/src/ingestion/ingest-template.ts` -- pass element map to DB storage
- **Data source:** Same `presentations.get` response already fetched (line 151) -- zero additional API calls

### Discovery Document Thumbnails
- **Modify:** `apps/agent/src/mastra/index.ts` -- discovery enrichment routes to include `thumbnailLink` in Drive API field selectors
- **Reuse:** `apps/agent/src/lib/gcs-thumbnails.ts` -- `uploadThumbnailToGCS()` for caching
- **Modify:** `apps/web/src/app/(authenticated)/discovery/discovery-client.tsx` -- render thumbnails in document cards

### Optimistic Ingest UI
- **Modify:** `apps/web/src/components/template-card.tsx` -- wrap ingest action with `useOptimistic`
- **Modify:** `apps/web/src/app/(authenticated)/discovery/discovery-client.tsx` -- replace manual `itemStatuses` Map with `useOptimistic`

### Ingestion Status Consistency
- **Modify:** Discovery client to poll same agent endpoint as Templates page
- **Key insight:** Agent already exposes ingestion progress per template. Discovery page currently tracks its own state via `itemStatuses` Map -- must switch to polling the canonical source

### AI Chat for Deck Structures
- **New:** `apps/agent/src/mastra/routes/` -- new Hono route for deck structure chat
- **New:** `apps/web/src/components/deck-structure-chat.tsx` -- chat UI component
- **New:** `apps/web/src/app/(authenticated)/settings/` -- Settings page with deck structures

### Rich Slide Descriptions
- **Modify:** `apps/agent/src/ingestion/ingest-template.ts` -- add LLM description generation step
- **Input:** Slide text + speaker notes + element map + classification context
- **Output:** 2-3 sentence description stored in `SlideEmbedding.description`

---

## Version Compatibility

| Package | Version | Compatible | Notes |
|---------|---------|------------|-------|
| `googleapis` | 144.0.0 | YES | Slides API v1 and Drive API v3 both stable; element map fields have been available since API launch |
| `react` | 19.0.0 | YES | `useOptimistic` is stable in React 19 (not experimental) |
| `prisma` | 6.3.1+ | YES | New `String?` columns are trivial migrations. Stay on 6.19.x (Prisma 7.x has vector regression #28867) |
| `@radix-ui/react-scroll-area` | latest | YES | Compatible with React 19, already in Radix ecosystem used by project |
| shadcn/ui | latest | YES | All needed components either installed or available via CLI |

---

## Sources

### HIGH Confidence
- [Google Slides API -- Page Elements](https://developers.google.com/workspace/slides/api/concepts/page-elements) -- 8 element types, properties per type
- [Google Slides API -- Pages Resource REST Reference](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages) -- full response schema
- [Google Drive API -- File Metadata](https://developers.google.com/workspace/drive/api/guides/file-metadata) -- thumbnailLink, hasThumbnail, iconLink fields
- [React 19 useOptimistic](https://react.dev/reference/react/useOptimistic) -- official hook documentation
- Existing codebase: `slide-extractor.ts` (lines 58-183), `gcs-thumbnails.ts`, `api-client.ts`, `discovery-client.tsx`, `actions-client.tsx`

### MEDIUM Confidence
- [Google Drive thumbnailLink 404 issues](https://issuetracker.google.com/issues/229184403) -- known instability with short-lived thumbnail URLs; reinforces GCS caching approach
- [shadcn/ui AI Components](https://www.shadcn.io/ai) -- evaluated and rejected for this project's architecture
- [Vercel AI Elements](https://github.com/vercel/ai-elements) -- evaluated and rejected due to Mastra architecture incompatibility

---
*Stack research for: Lumenalta v1.5 Review Polish & Deck Intelligence*
*Researched: 2026-03-07*
