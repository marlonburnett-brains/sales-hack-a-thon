# Phase 21: Preview & Review Engine - Research

**Researched:** 2026-03-06
**Domain:** Slide preview, classification review UI, pgvector similarity search
**Confidence:** HIGH

## Summary

Phase 21 builds a slide preview and review interface on top of the existing SlideEmbedding model (Phase 18/20) and Template model (Phase 19). The implementation requires: (1) new agent API endpoints for fetching slide thumbnails, listing slides with classifications, updating classification tags, and similarity search via pgvector cosine distance; (2) two new Next.js routes -- a per-template slide viewer at `/templates/:id/slides` and an all-slides library at `/slides`; (3) a new sidebar nav item for Slide Library.

The tech stack is entirely established: Next.js 15 App Router with Server/Client Component split, Mastra `registerApiRoute` for agent endpoints, Prisma raw SQL for pgvector operations, shadcn/ui for UI components, and Google Slides API `presentations.pages.getThumbnail` for slide images. No new libraries are needed. The primary complexity is the pgvector cosine distance query for similarity search and the thumbnail-fetching pipeline (agent proxies Google Slides API thumbnails to the web app).

**Primary recommendation:** Build agent-side endpoints first (thumbnails, slide list, tag update, similarity search), then the per-template viewer UI, then the Slide Library page. Use the established `registerApiRoute` + `api-client.ts` + Server Actions pattern throughout.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full-page viewer at dedicated route (/templates/:id/slides)
- Slide rendered as Google Slides API thumbnail images (up to 1600px wide)
- Horizontal thumbnail strip at bottom for navigation between slides (like Google Slides presenter view)
- Left/right arrow buttons + keyboard arrow key navigation
- Clicking a thumbnail jumps directly to that slide
- Slide counter shows position (e.g., "3 of 12")
- Right sidebar panel (~30% width) next to the slide (~70% width)
- Classification tags displayed as grouped tag chips by category: Industry, Pillar, Persona, Stage, Content Type
- Each category has a label header with colored chips for multi-value tags
- Confidence score shown as percentage per slide (e.g., "85% confident")
- Single overall thumbs up/down rating per slide (not per-category)
- Thumbs up = "classification correct" -- all tags accepted as-is
- Thumbs down = "needs correction" -- all tag categories become editable
- Corrections update pgvector metadata immediately
- "Find Similar" button in the right sidebar panel when viewing a slide
- Also a dedicated search page (Slide Library) for cross-template browsing
- Active (non-archived) slides only in results
- Click template card in grid/table navigates to /templates/:id/slides
- "View Slides" option in existing dropdown menu
- Per-template viewer as primary: browse one deck's slides sequentially
- All-slides "Slide Library" as a new sidebar nav item alongside Deals and Templates
- Default view: unfiltered (slides in presentation order), with optional filter by review status

### Claude's Discretion
- Inline tag editing UX (dropdown selectors, click-to-remove + add, or hybrid)
- Thumbnail strip styling, spacing, and active-slide highlighting
- Right sidebar panel width and responsive behavior
- Tag chip color scheme per category
- Keyboard shortcuts beyond arrow keys (e.g., T for thumbs up, R for reject)
- Slide Library page layout, filtering, and sorting implementation
- Similarity search result count and display format
- Loading states and skeleton UI for thumbnail fetching
- Mobile/responsive behavior for the viewer

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PREV-01 | User can preview slides at presentation size with navigation | Google Slides API getThumbnail (LARGE = 1600px), thumbnail strip + arrow nav pattern |
| PREV-02 | Each slide displays AI-assigned classification tags alongside preview | classificationJson column in SlideEmbedding, right sidebar panel with tag chips |
| PREV-03 | User can rate a slide classification as correct (thumbs up) or incorrect (thumbs down) | New reviewStatus column or classificationJson update, Server Action pattern |
| PREV-04 | User can correct individual classification tags via inline editing | Taxonomy constants from @lumenalta/schemas, Select dropdowns for enum fields |
| PREV-05 | Corrections update pgvector metadata immediately | Prisma raw SQL UPDATE on SlideEmbedding (same pattern as ingest-template.ts) |
| SLIDE-09 | User can find similar slides via vector similarity search | pgvector `<=>` cosine distance operator with HNSW index, new agent endpoint |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x | App Router, Server/Client Components | Already in use (apps/web) |
| Mastra | latest | Agent API routes via registerApiRoute | Already in use (apps/agent) |
| Prisma | 6.19.x | ORM + raw SQL for pgvector | Already in use, MUST stay on 6.19.x |
| pgvector | npm | Vector serialization (toSql) | Already installed in agent |
| shadcn/ui | latest | UI components (Select, Badge, Skeleton, Button) | Already in use |
| lucide-react | 0.576.x | Icons (ThumbsUp, ThumbsDown, Search, ChevronLeft, ChevronRight) | Already in use |
| googleapis | latest | Google Slides API for thumbnails | Already in use (agent) |
| @lumenalta/schemas | workspace | Taxonomy constants (INDUSTRIES, SOLUTION_PILLARS, etc.) | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.x | Toast notifications for rating/correction feedback | Already installed |
| date-fns | 4.1.x | Relative time display | Already installed |

### Alternatives Considered
None needed -- all required functionality is covered by the existing stack.

**Installation:**
No new packages required. shadcn/ui Badge component may need to be added via `npx shadcn@latest add badge` if not already present (it IS present as `badge.tsx`). The shadcn Select component is already installed.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/app/(authenticated)/
  templates/[id]/slides/
    page.tsx                    # Server Component: fetch template + slides data
    slide-viewer-client.tsx     # Client Component: full viewer with state
  slides/
    page.tsx                    # Server Component: Slide Library
    slide-library-client.tsx    # Client Component: filterable grid with similarity search

apps/web/src/lib/
  actions/
    slide-actions.ts            # Server Actions: list slides, update tags, rate, find similar
  api-client.ts                 # Add: slide API functions (existing file, extend)

apps/web/src/components/
  slide-viewer/
    slide-preview.tsx           # Main slide image display
    thumbnail-strip.tsx         # Bottom horizontal thumbnail navigation
    classification-panel.tsx    # Right sidebar: tags, rating, editing
    tag-editor.tsx              # Inline tag correction component
    similarity-results.tsx      # "Find Similar" results display

apps/agent/src/mastra/index.ts  # Add new API routes (existing file, extend)
```

### Pattern 1: Agent API Route Registration
**What:** All new endpoints follow the established `registerApiRoute` pattern in `mastra/index.ts`
**When to use:** Every new agent endpoint
**Example:**
```typescript
// Source: apps/agent/src/mastra/index.ts (existing pattern)
registerApiRoute("/templates/:id/slides", {
  method: "GET",
  handler: async (c) => {
    const id = c.req.param("id");
    const slides = await prisma.slideEmbedding.findMany({
      where: { templateId: id, archived: false },
      orderBy: { slideIndex: "asc" },
      select: {
        id: true,
        slideIndex: true,
        slideObjectId: true,
        contentText: true,
        classificationJson: true,
        confidence: true,
        needsReReview: true,
        industry: true,
        solutionPillar: true,
        persona: true,
        funnelStage: true,
        contentType: true,
      },
    });
    return c.json(slides);
  },
}),
```

### Pattern 2: Server Component + Client Component Split
**What:** Server Component fetches data, Client Component handles interactivity
**When to use:** All new pages (slide viewer, slide library)
**Example:**
```typescript
// page.tsx (Server Component)
import { SlideViewerClient } from "./slide-viewer-client";
import { listSlidesAction } from "@/lib/actions/slide-actions";

export default async function SlidesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slides = await listSlidesAction(id);
  return <SlideViewerClient templateId={id} initialSlides={slides} />;
}
```

### Pattern 3: pgvector Cosine Distance Query
**What:** Raw SQL using the `<=>` operator for cosine distance with the existing HNSW index
**When to use:** Similarity search endpoint
**Example:**
```typescript
// Cosine distance query against SlideEmbedding
const similar = await prisma.$queryRaw`
  SELECT id, "templateId", "slideIndex", "slideObjectId", "contentText",
         "classificationJson", confidence,
         1 - (embedding <=> ${referenceEmbedding}::vector) AS similarity
  FROM "SlideEmbedding"
  WHERE archived = false
    AND id != ${sourceSlideId}
  ORDER BY embedding <=> ${referenceEmbedding}::vector
  LIMIT ${limit}
`;
```

### Pattern 4: Thumbnail Proxy via Agent API
**What:** Agent fetches Google Slides thumbnails and returns URLs to the web app
**When to use:** Slide preview images
**Example:**
```typescript
// Agent endpoint: GET /templates/:id/slides/:slideObjectId/thumbnail
registerApiRoute("/templates/:id/slides/:slideObjectId/thumbnail", {
  method: "GET",
  handler: async (c) => {
    const presentationId = c.req.param("id"); // Template's presentationId
    const slideObjectId = c.req.param("slideObjectId");
    const slides = getSlidesClient();
    const result = await slides.presentations.pages.getThumbnail({
      presentationId,
      pageObjectId: slideObjectId,
      "thumbnailProperties.thumbnailSize": "LARGE", // 1600px wide
    });
    return c.json({ thumbnailUrl: result.data.contentUrl });
  },
}),
```

### Pattern 5: Tag Update via Raw SQL
**What:** Update classification columns AND classificationJson atomically
**When to use:** When user corrects tags (PREV-04/PREV-05)
**Example:**
```typescript
// Update both single-value columns and classificationJson
await prisma.$executeRaw`
  UPDATE "SlideEmbedding"
  SET
    industry = ${correctedTags.industries[0] ?? null},
    "solutionPillar" = ${correctedTags.solutionPillars[0] ?? null},
    persona = ${correctedTags.buyerPersonas[0] ?? null},
    "funnelStage" = ${correctedTags.funnelStages[0] ?? null},
    "contentType" = ${correctedTags.contentType},
    "classificationJson" = ${JSON.stringify(correctedTags)},
    "needsReReview" = false,
    "updatedAt" = NOW()
  WHERE id = ${slideId}
`;
```

### Anti-Patterns to Avoid
- **Fetching thumbnails on the web app side:** The web app does NOT have Google API credentials. All Google API calls go through the agent.
- **Using Prisma ORM for vector queries:** Prisma cannot handle the `vector` type or the `<=>` operator. Use raw SQL (`$queryRaw`/`$executeRaw`).
- **Storing review status in a separate table:** Keep it on SlideEmbedding -- add a `reviewStatus` column or encode in `classificationJson`. The existing `needsReReview` boolean can be extended to a tri-state or new column.
- **Re-generating embeddings on tag correction:** Tag corrections only update metadata, NOT the embedding vector. The embedding is based on slide content, not classifications.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Thumbnail images | Custom slide rendering | Google Slides API getThumbnail | Pixel-perfect, handles all element types, up to 1600px |
| Similarity search | Custom cosine similarity | pgvector `<=>` with HNSW index | Hardware-optimized, already indexed, sub-second queries |
| Tag dropdowns | Custom multi-select | shadcn Select component | Keyboard accessible, already styled, consistent UX |
| Toast feedback | Custom notification | Sonner toast | Already used project-wide |
| Skeleton loading | Custom shimmer | shadcn Skeleton component | Already available in ui/ |

**Key insight:** Every piece of infrastructure needed for this phase already exists in the codebase. The work is wiring up existing patterns in new combinations, not building new abstractions.

## Common Pitfalls

### Pitfall 1: Google Slides Thumbnail URL Expiration
**What goes wrong:** Thumbnail URLs from `getThumbnail` are temporary signed URLs that expire after ~30 minutes.
**Why it happens:** Google returns a time-limited content URL, not a permanent image.
**How to avoid:** Either (a) fetch thumbnail URLs on page load and treat them as ephemeral, or (b) cache them on the agent side with a short TTL. Do NOT store them in the database.
**Warning signs:** Broken images after the page has been open for a while.

### Pitfall 2: N+1 Thumbnail Requests
**What goes wrong:** Fetching thumbnails one-by-one for every slide in a presentation causes rate limiting and slow loads.
**Why it happens:** Each `getThumbnail` call is a separate API request.
**How to avoid:** Use a batch endpoint: fetch all slide thumbnail URLs in one agent call by iterating through slides server-side and returning all URLs at once. Add a loading skeleton while thumbnails load.
**Warning signs:** Slow initial page load, Google API 429 errors.

### Pitfall 3: Missing classificationJson Parsing
**What goes wrong:** `classificationJson` is stored as a JSON string in the database. Forgetting to parse it causes the UI to display raw JSON.
**Why it happens:** Prisma returns it as a string, not a parsed object.
**How to avoid:** Always `JSON.parse(slide.classificationJson)` when reading, and `JSON.stringify(tags)` when writing.
**Warning signs:** Raw JSON strings appearing in tag chips.

### Pitfall 4: Updating Single-Value Columns Without classificationJson
**What goes wrong:** Updating only `industry`, `solutionPillar` etc. without also updating `classificationJson` causes data drift between the two sources.
**Why it happens:** The schema has both single-value columns (backward compat) and the JSON column (source of truth).
**How to avoid:** Always update BOTH in the same SQL statement (see Pattern 5 above).
**Warning signs:** Classification panel showing different tags after page refresh vs. after correction.

### Pitfall 5: Vector Column in Similarity Results
**What goes wrong:** Including `embedding` in SELECT results causes Prisma to fail because it cannot deserialize the vector type.
**Why it happens:** Prisma's `$queryRaw` returns all columns by default if you use `SELECT *`.
**How to avoid:** Always explicitly list columns in similarity search queries, excluding `embedding`.
**Warning signs:** Prisma runtime error about unsupported column type.

### Pitfall 6: Review Status Schema Extension
**What goes wrong:** Adding a new column (e.g., `reviewStatus`) without a Prisma migration violates the project's migration discipline.
**Why it happens:** Temptation to use `prisma db push` for quick iteration.
**How to avoid:** Use `prisma migrate dev --name add-review-status`. If schema drift exists, use `prisma migrate resolve --applied` per CLAUDE.md rules.
**Warning signs:** Migration history out of sync with actual schema.

## Code Examples

### Batch Thumbnail Fetching (Agent Endpoint)
```typescript
// GET /templates/:id/thumbnails - Fetch all slide thumbnails at once
registerApiRoute("/templates/:id/thumbnails", {
  method: "GET",
  handler: async (c) => {
    const templateId = c.req.param("id");
    const template = await prisma.template.findUniqueOrThrow({
      where: { id: templateId },
    });

    const slides = await prisma.slideEmbedding.findMany({
      where: { templateId, archived: false },
      orderBy: { slideIndex: "asc" },
      select: { slideObjectId: true, slideIndex: true },
    });

    const slidesApi = getSlidesClient();
    const thumbnails: { slideObjectId: string; slideIndex: number; thumbnailUrl: string }[] = [];

    for (const slide of slides) {
      if (!slide.slideObjectId) continue;
      try {
        const result = await slidesApi.presentations.pages.getThumbnail({
          presentationId: template.presentationId,
          pageObjectId: slide.slideObjectId,
          "thumbnailProperties.thumbnailSize": "LARGE",
        });
        thumbnails.push({
          slideObjectId: slide.slideObjectId,
          slideIndex: slide.slideIndex,
          thumbnailUrl: result.data.contentUrl ?? "",
        });
      } catch (err) {
        console.error(`[thumbnails] Failed for slide ${slide.slideObjectId}:`, err);
      }
    }

    return c.json({ thumbnails });
  },
}),
```

### pgvector Similarity Search (Agent Endpoint)
```typescript
// POST /slides/:id/similar - Find similar slides by embedding
registerApiRoute("/slides/:id/similar", {
  method: "POST",
  handler: async (c) => {
    const slideId = c.req.param("id");
    const body = await c.req.json();
    const limit = body.limit ?? 10;

    // Get the source slide's embedding via raw SQL
    const sourceRows = await prisma.$queryRaw<Array<{ embedding: string }>>`
      SELECT embedding::text FROM "SlideEmbedding" WHERE id = ${slideId}
    `;

    if (sourceRows.length === 0) {
      return c.json({ error: "Slide not found" }, 404);
    }

    const embedding = sourceRows[0].embedding;

    // Find similar slides using cosine distance
    const similar = await prisma.$queryRaw`
      SELECT id, "templateId", "slideIndex", "slideObjectId",
             "contentText", "classificationJson", confidence,
             1 - (embedding <=> ${embedding}::vector) AS similarity
      FROM "SlideEmbedding"
      WHERE archived = false
        AND id != ${slideId}
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT ${limit}
    `;

    return c.json({ results: similar });
  },
}),
```

### Tag Correction Server Action
```typescript
// apps/web/src/lib/actions/slide-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { updateSlideClassification } from "@/lib/api-client";

export async function updateSlideTagsAction(
  slideId: string,
  templateId: string,
  correctedTags: {
    industries: string[];
    solutionPillars: string[];
    buyerPersonas: string[];
    funnelStages: string[];
    contentType: string;
    slideCategory: string;
  }
): Promise<{ success: boolean }> {
  const result = await updateSlideClassification(slideId, correctedTags);
  revalidatePath(`/templates/${templateId}/slides`);
  return result;
}
```

### Inline Tag Editor Component Pattern
```typescript
// Recommended: hybrid approach for tag editing
// - Multi-value fields (industries, pillars, personas, stages):
//   Use shadcn Select with multi-select behavior
// - Single-value fields (contentType, slideCategory):
//   Use shadcn Select with single selection
//
// Each category gets its own Select populated from constants.ts:
// - INDUSTRIES (11 options) -> Select dropdown
// - SOLUTION_PILLARS (6 options) -> Select dropdown
// - BUYER_PERSONAS (9 options) -> Select dropdown
// - FUNNEL_STAGES (4 options) -> Select dropdown
// - SLIDE_CATEGORIES (14 options) -> Select dropdown
// - CONTENT_TYPES (5 options) -> Select dropdown
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drive API fullText search (atlusai-search.ts) | pgvector cosine distance | Phase 18 (HNSW index) | Much faster, semantic similarity vs keyword match |
| Single-value classification columns | classificationJson (multi-value) | Phase 20 | Supports multiple industries/pillars per slide |
| Manual re-ingestion | Background staleness polling | Phase 20 Plan 02 | Automatic re-ingestion when source changes |

**Deprecated/outdated:**
- The Drive-based AtlusAI search (`atlusai-search.ts`) is still used by Mastra workflows but should NOT be used for Phase 21 similarity search. Use pgvector directly.

## Open Questions

1. **Review status persistence**
   - What we know: `needsReReview` boolean exists on SlideEmbedding. There is no `reviewStatus` field.
   - What's unclear: Whether to add a new `reviewStatus` column ("unreviewed" | "approved" | "rejected") or repurpose `needsReReview` plus a new flag.
   - Recommendation: Add a new `reviewStatus` column via migration. Values: "unreviewed" (default), "approved" (thumbs up), "needs_correction" (thumbs down). This preserves `needsReReview` for its original re-ingestion purpose and gives clean filtering for the Slide Library. Use `prisma migrate dev --name add-review-status`.

2. **Thumbnail caching strategy**
   - What we know: Google Slides thumbnail URLs expire after ~30 minutes.
   - What's unclear: Whether to cache thumbnails in-memory on the agent, or fetch fresh on every page load.
   - Recommendation: Fetch fresh on page load. For a 20-slide deck, batch fetching takes <3 seconds. Cache in the client component state for the duration of the session. No server-side caching needed for hackathon scope.

3. **Slide Library pagination**
   - What we know: Could have hundreds of slides across all templates.
   - What's unclear: Whether to paginate or virtual-scroll.
   - Recommendation: Simple offset/limit pagination (20 per page) with server-side filtering. Virtual scroll is overkill for this use case.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `apps/agent/src/mastra/index.ts` -- registerApiRoute pattern, all existing API endpoints
- Codebase inspection: `apps/agent/prisma/schema.prisma` -- SlideEmbedding model with all columns
- Codebase inspection: `packages/schemas/constants.ts` -- Full taxonomy constants (11 industries, 6 pillars, etc.)
- Codebase inspection: `apps/agent/src/ingestion/ingest-template.ts` -- Raw SQL INSERT/UPDATE pattern for SlideEmbedding
- Codebase inspection: `apps/web/src/lib/api-client.ts` -- Typed fetch wrapper pattern
- Codebase inspection: `apps/web/src/lib/actions/template-actions.ts` -- Server Actions pattern
- Codebase inspection: `apps/web/src/components/sidebar.tsx` -- Sidebar nav structure
- [Google Slides API getThumbnail](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/getThumbnail) -- SMALL 200px, MEDIUM 800px, LARGE 1600px

### Secondary (MEDIUM confidence)
- [Google Slides getThumbnail documentation](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations.pages/getThumbnail) -- Thumbnail URL expiration behavior

### Tertiary (LOW confidence)
- Thumbnail URL expiration timeframe (~30 minutes) is approximate based on observed behavior, not officially documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- entirely existing codebase, no new libraries
- Architecture: HIGH -- follows established patterns exactly (registerApiRoute, Server Actions, raw SQL)
- Pitfalls: HIGH -- derived from direct code inspection of existing patterns (vector column handling, classificationJson dual-write)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- all patterns are established in the codebase)
