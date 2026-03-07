# Phase 32: UX Polish - Research

**Researched:** 2026-03-07
**Domain:** Next.js frontend UX refinement (thumbnails, status unification, optimistic UI)
**Confidence:** HIGH

## Summary

This phase is a pure frontend UX refinement with targeted backend additions (thumbnail caching for cover images, server-side duplicate guard). The existing codebase has strong foundations: shadcn/ui components (Card, Progress, Skeleton, Badge, Sonner toast), GCS thumbnail caching infrastructure (`gcs-thumbnails.ts`), template status logic (`template-utils.ts` with 7 states), and polling-based ingestion progress. The Discovery page currently renders plain text-only cards with no thumbnails, its own ad-hoc status indicators, and no progress bars. The Templates page has rich cards with status badges and progress bars but uses different components.

The core work is: (1) extend the agent browse/search endpoints to return a cover thumbnail URL per document, (2) add a GCS-cached document cover thumbnail pipeline (first slide for Slides, Drive thumbnailLink for other types), (3) extract shared status/progress components used on both pages, (4) redesign Discovery cards as gallery-style hero-image cards, and (5) implement optimistic UI with client-side + server-side duplicate prevention.

**Primary recommendation:** Treat this as a component extraction and unification effort. The building blocks exist -- the work is reshaping Discovery cards, sharing status components, and adding thumbnail support.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Top hero image layout on Discovery cards -- full-width thumbnail at top, title and metadata below (gallery style)
- 16:9 widescreen aspect ratio to match Google Slides native ratio
- Thumbnail source: Google Slides API (first slide) for Slides documents, Drive API thumbnailLink for other file types (Docs, Sheets, PDF) -- both cached in GCS
- Skeleton shimmer placeholder while thumbnail loads
- File-type icon as fallback when no thumbnail is available
- Use lucide FileIcon variants: FileSliders (Slides), FileText (Docs), FileSpreadsheet (Sheets), File (PDF)
- Google-branded colors: Slides=yellow, Docs=blue, Sheets=green, PDF=red
- Small corner badge (bottom-right of thumbnail) on cards that have thumbnails -- shows file type even with a visual preview
- Non-ingestible file types (Docs, Sheets, PDF) shown at 80% opacity with no checkbox -- still browseable but clearly secondary
- Shared component and shared logic across Discovery and Templates pages -- extract existing TemplateStatusBadge + getTemplateStatus into shared ingestion-status component
- Discovery shows identical progress bar (Slide N of M) as Templates during active ingestion -- full visual parity
- Discovery shows live template status (Ready, Stale, Failed, etc.) when document maps to an existing template -- cross-reference by presentationId
- Slide count badge appears on Discovery cards for ingested documents -- consistent with Template cards
- Instant response on Ingest click: 1) Close dropdown menu, 2) Change card status to "Queued", 3) Show toast "Queued for ingestion" -- all before server responds
- Duplicate prevention: client-side disable (button/checkbox immediately disabled on click) + server-side guard (reject if ingestionStatus is 'ingesting' or 'queued')
- Progress toast: initial "Queued" toast, then single updating toast for progress ("Ingesting slide 3 of 12..."), then success/error -- reduces toast noise
- Batch ingestion: per-card independent status updates + single summary toast at batch completion ("5 of 6 documents ingested, 1 failed")

### Claude's Discretion
- Exact skeleton shimmer dimensions and animation
- Thumbnail image quality/size parameter for API calls
- GCS key naming convention for Drive thumbnails (vs existing slide-thumbnails/ pattern)
- Toast duration and positioning
- Error state visual treatment details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UXP-01 | User sees document thumbnail previews on Discovery page cards (cached via GCS) | Existing `gcs-thumbnails.ts` provides GCS upload + Slides API thumbnail fetching. Need to add: (a) cover image extraction during browse enrichment, (b) `document-covers/` GCS path for full-presentation thumbnails, (c) `thumbnailUrl` field on `DiscoveryDocument` type, (d) hero image card layout with 16:9 aspect ratio |
| UXP-02 | User sees file-type-specific icons when no thumbnail is available (Slides, Docs, Sheets, PDF) | Lucide icons already in use project-wide. `FileSliders`, `FileText`, `FileSpreadsheet`, `File` icons available. `mimeType` field already on `DiscoveryDocument`. Map MIME to icon+color in a shared utility |
| UXP-03 | User sees consistent ingestion status on Discovery and Templates pages (progress bar + slide count) | `TemplateStatusBadge` + `getTemplateStatus()` + `STATUS_CONFIG` already exist in `template-utils.ts`. `Progress` component from shadcn/ui used in `template-card.tsx`. Extract to shared components; Discovery needs template cross-reference by `presentationId` from browse response |
| UXP-04 | User receives immediate visual feedback when clicking Ingest (optimistic state, menu closes, button disabled) | Discovery already has `ItemStatus` type and `itemStatuses` Map for tracking. Need to: (a) set status to "pending" immediately before API call, (b) close dropdown, (c) fire Sonner toast synchronously. Templates page `handleTriggerIngestion` needs same optimistic pattern |
| UXP-05 | User cannot trigger duplicate ingestion by clicking Ingest multiple times | Client-side: `isDisabled` check already exists in `ItemCheckbox`. Need to extend to all ingest triggers (preview panel button, dropdown menu item). Server-side: discovery ingest handler currently skips already-existing templates but does NOT check `ingestionStatus`. Need guard: reject if template exists AND `ingestionStatus` is 'ingesting' or 'queued' |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x (existing) | App Router, server actions | Already in use |
| shadcn/ui | latest (existing) | Card, Progress, Skeleton, Badge, Sonner | Already integrated; use existing components |
| lucide-react | existing | FileSliders, FileText, FileSpreadsheet, File, Layers icons | Already the project icon library |
| Tailwind CSS | 4.x (existing) | Utility-first styling | Already in use |
| sonner | existing | Toast notifications | Already integrated via shadcn/ui |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| googleapis | existing | Drive API thumbnailLink, Slides API getThumbnail | Already in agent for GCS thumbnail caching |
| next/image | built-in | Optimized image loading with blur placeholder | For thumbnail rendering on Discovery cards |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next/image | Regular `<img>` | next/image handles lazy loading, sizing, and format optimization; requires `remotePatterns` config (already has `*.googleusercontent.com`, need `storage.googleapis.com`) |

**Installation:**
No new dependencies needed. All libraries are already installed.

## Architecture Patterns

### Recommended Component Structure
```
apps/web/src/
  components/
    ingestion-status.tsx        # Shared: IngestionStatusBadge (replaces TemplateStatusBadge usage)
    ingestion-progress.tsx      # Shared: IngestionProgress bar + "Slide N of M"
    document-type-icon.tsx      # Shared: file-type icon with Google-branded colors
    discovery-card.tsx           # New: gallery-style card with hero thumbnail
    template-card.tsx           # Modified: adopt shared status components
  lib/
    template-utils.ts           # Extended: add MIME-to-icon mapping, keep status logic
    document-types.ts           # New: MIME type constants, icon mapping, color mapping
```

### Pattern 1: Hero Image Card with Skeleton Loading
**What:** Discovery cards with full-width 16:9 thumbnail at top, content below
**When to use:** Grid view of Discovery documents
**Example:**
```typescript
// Discovery card structure
<Card className="overflow-hidden">
  <div className="relative aspect-video bg-slate-100">
    {thumbnailUrl ? (
      <Image src={thumbnailUrl} alt={title} fill className="object-cover" />
    ) : (
      <div className="flex h-full items-center justify-center">
        <DocumentTypeIcon mimeType={mimeType} size="lg" />
      </div>
    )}
    {/* File type corner badge */}
    <div className="absolute bottom-2 right-2">
      <DocumentTypeIcon mimeType={mimeType} size="sm" />
    </div>
  </div>
  <CardContent>
    <h3>{title}</h3>
    <IngestionStatusBadge status={status} />
  </CardContent>
</Card>
```

### Pattern 2: Optimistic UI with Toast Lifecycle
**What:** Instant visual feedback before server response, with progressive toast updates
**When to use:** Ingest button clicks (single and batch)
**Example:**
```typescript
async function handleIngest(doc: DiscoveryDocument) {
  // 1. Optimistic: update UI immediately
  setItemStatuses(prev => new Map(prev).set(doc.slideId, "pending"));

  // 2. Close menu (if in dropdown context)
  setDropdownOpen(false);

  // 3. Show toast immediately
  const toastId = toast("Queued for ingestion", { id: `ingest-${doc.slideId}` });

  // 4. Fire API call
  try {
    const { batchId } = await startDiscoveryIngestionAction([doc]);
    startPolling(batchId, toastId); // Update same toast with progress
  } catch {
    setItemStatuses(prev => { const m = new Map(prev); m.delete(doc.slideId); return m; });
    toast.error("Failed to start ingestion", { id: toastId });
  }
}
```

### Pattern 3: Shared Status Component Extraction
**What:** Single source of truth for ingestion status display
**When to use:** Both Discovery and Templates pages
**Example:**
```typescript
// Shared ingestion-status.tsx
import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG, type TemplateStatus } from "@/lib/template-utils";

export function IngestionStatusBadge({ status }: { status: TemplateStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

// Shared ingestion-progress.tsx
import { Progress } from "@/components/ui/progress";

export function IngestionProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="space-y-1.5">
      <Progress value={(current / total) * 100} className="h-1.5" />
      <p className="text-xs text-indigo-600">Slide {current} of {total}</p>
    </div>
  );
}
```

### Pattern 4: Cross-Reference Discovery Documents with Templates
**What:** Discovery browse/search returns template status for documents already ingested
**When to use:** Showing live template status on Discovery cards
**Example:**
```typescript
// Agent-side: in browse handler, after enrichment
const presentationIds = documents
  .filter(d => d.presentationId)
  .map(d => d.presentationId);

const templates = await prisma.template.findMany({
  where: { presentationId: { in: presentationIds } },
  select: {
    presentationId: true,
    ingestionStatus: true,
    lastIngestedAt: true,
    sourceModifiedAt: true,
    accessStatus: true,
    slideCount: true,
    ingestionProgress: true,
  },
});

// Attach template data to documents
const templateMap = new Map(templates.map(t => [t.presentationId, t]));
for (const doc of documents) {
  if (doc.presentationId && templateMap.has(doc.presentationId)) {
    doc.templateData = templateMap.get(doc.presentationId);
  }
}
```

### Anti-Patterns to Avoid
- **Separate status implementations:** Discovery currently has its own `StatusIndicator` and `ItemStatus` type that diverges from `TemplateStatusBadge`/`getTemplateStatus`. Must unify, not maintain two systems.
- **Ephemeral Drive thumbnail URLs:** Drive API `thumbnailLink` URLs expire. Always cache to GCS first, return GCS URL to client.
- **Blocking thumbnail fetch on browse:** Thumbnail caching should be async/background. Return placeholder if not cached yet, populate on next browse.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image optimization | Custom resize/format logic | `next/image` with `fill` + `sizes` | Handles lazy loading, format negotiation, responsive sizing |
| Skeleton loading | Custom CSS animation | shadcn/ui `<Skeleton />` | Already in project, consistent styling |
| Toast management | Custom notification system | Sonner (already integrated) | Supports toast IDs for update-in-place, already styled |
| Progress bar | Custom progress div | shadcn/ui `<Progress />` | Already used in template-card.tsx |
| Aspect ratio | Padding-bottom hack | Tailwind `aspect-video` (16:9) | Built into Tailwind, responsive |

**Key insight:** Every UI primitive needed already exists in the project. This phase is about composition and unification, not new infrastructure.

## Common Pitfalls

### Pitfall 1: GCS URL Not in next/image remotePatterns
**What goes wrong:** `next/image` rejects GCS-hosted thumbnail URLs
**Why it happens:** `next.config.ts` only has `*.googleusercontent.com` in `remotePatterns`
**How to avoid:** Add `storage.googleapis.com` to `remotePatterns` in `next.config.ts`
**Warning signs:** Build error or runtime 400 from Next.js image optimization proxy

### Pitfall 2: Race Condition in Optimistic UI Rollback
**What goes wrong:** User clicks Ingest, API fails, but UI still shows "Queued" because state update was batched
**Why it happens:** React state updates are asynchronous; rollback may not apply correctly if other updates are in flight
**How to avoid:** Use functional state updates (`setItemStatuses(prev => ...)`) and ensure rollback uses the same slideId key. Keep the toastId stable for error replacement.
**Warning signs:** Card stuck in "Queued" state after a failed ingestion attempt

### Pitfall 3: Thumbnail Missing on First Load
**What goes wrong:** User browses Discovery, no thumbnails appear even for Slides documents
**Why it happens:** Cover thumbnails are fetched and cached on first request; initial browse has no cached thumbnails
**How to avoid:** Implement a two-pass approach: (1) return null thumbnailUrl on first browse, (2) kick off async caching, (3) client retries/refetches after initial load or uses skeleton placeholder. Alternatively, populate thumbnails during ingestion so they exist before Discovery browse.
**Warning signs:** Blank thumbnail areas that never populate

### Pitfall 4: Drive API thumbnailLink CORS Issues
**What goes wrong:** Trying to use Drive thumbnailLink directly in `<img>` or `next/image` fails
**Why it happens:** Drive thumbnail URLs have CORS restrictions and are short-lived (ephemeral)
**How to avoid:** Always proxy through GCS cache -- fetch on agent side, upload to GCS, return GCS URL. Never expose Drive thumbnailLink directly to the client.
**Warning signs:** CORS errors in browser console, broken images after ~30 minutes

### Pitfall 5: Duplicate Ingestion via Rapid Click
**What goes wrong:** User rapid-clicks Ingest, multiple ingestion jobs start for the same document
**Why it happens:** Client-side disable is async (React state update), server-side discovery ingest handler only checks if template *exists* (not if it's *currently ingesting*)
**How to avoid:** (1) Client: use `useRef` or immediate variable for click guard (not just state). (2) Server: check `ingestionStatus !== 'idle'` before creating/queuing. (3) Use Prisma's `findUnique` + conditional update in a single operation.
**Warning signs:** Multiple template records or duplicate slide embeddings

## Code Examples

### MIME Type to Icon Mapping
```typescript
// document-types.ts
import { FileSliders, FileText, FileSpreadsheet, File } from "lucide-react";

export const DOCUMENT_TYPE_CONFIG = {
  "application/vnd.google-apps.presentation": {
    icon: FileSliders,
    label: "Google Slides",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
  },
  "application/vnd.google-apps.document": {
    icon: FileText,
    label: "Google Docs",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  "application/vnd.google-apps.spreadsheet": {
    icon: FileSpreadsheet,
    label: "Google Sheets",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  "application/pdf": {
    icon: File,
    label: "PDF",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
} as const;

export function getDocumentTypeConfig(mimeType?: string) {
  if (!mimeType) return DOCUMENT_TYPE_CONFIG["application/vnd.google-apps.presentation"];
  return DOCUMENT_TYPE_CONFIG[mimeType as keyof typeof DOCUMENT_TYPE_CONFIG]
    ?? DOCUMENT_TYPE_CONFIG["application/pdf"]; // fallback
}
```

### Sonner Toast with Updatable ID
```typescript
// Sonner supports updating an existing toast by passing the same ID
import { toast } from "sonner";

// Initial toast
toast("Queued for ingestion", { id: "ingest-abc123" });

// Update same toast during progress
toast("Ingesting slide 3 of 12...", { id: "ingest-abc123" });

// Replace with success
toast.success("Ingestion complete", { id: "ingest-abc123" });

// Or error
toast.error("Ingestion failed", { id: "ingest-abc123" });
```

### Next.js Image with GCS Remote Pattern
```typescript
// next.config.ts addition needed
images: {
  remotePatterns: [
    { protocol: "https", hostname: "*.googleusercontent.com" },
    { protocol: "https", hostname: "storage.googleapis.com" },
  ],
},
```

### Non-Ingestible Card Opacity
```typescript
const isSlides = doc.isGoogleSlides === true;
// Card wrapper
<Card className={cn(
  "overflow-hidden transition-shadow duration-200 hover:shadow-md",
  !isSlides && "opacity-80"
)}>
  {/* No checkbox for non-Slides */}
  {isSlides && <ItemCheckbox doc={doc} />}
</Card>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Discovery: plain div cards, text-only | Phase 32: Card component with hero thumbnail | Now | Visual gallery experience |
| Discovery: ad-hoc StatusIndicator | Phase 32: shared IngestionStatusBadge from template-utils | Now | Single source of truth |
| Discovery: no progress tracking | Phase 32: identical progress bar as Templates | Now | Visual parity |
| Templates: TemplateStatusBadge exclusive | Phase 32: shared component used by both pages | Now | Code reuse, consistency |
| Ingest: fire-and-hope | Phase 32: optimistic UI with toast lifecycle | Now | Instant feedback |

## Open Questions

1. **Thumbnail caching timing for browse results**
   - What we know: `cacheThumbnailsForTemplate` caches per-slide thumbnails during ingestion. For Discovery browse, documents may not be ingested yet.
   - What's unclear: Should we cache cover thumbnails during browse enrichment (slows browse) or return null and let client show skeleton until a background job populates them?
   - Recommendation: Cache on first browse lazily -- kick off async GCS upload, return skeleton on first load. On subsequent browse, return cached URL. Use `document-covers/{presentationId}.png` GCS path.

2. **DiscoveryDocument type extension**
   - What we know: `DiscoveryDocument` needs `thumbnailUrl` and `templateData` (for cross-referencing).
   - What's unclear: Should `templateData` be a nested object or flat fields?
   - Recommendation: Nested object `templateData?: { ingestionStatus, lastIngestedAt, slideCount, etc. }` to keep the type clean and avoid field name collisions.

3. **Drive API thumbnailLink for non-Slides files**
   - What we know: Drive API `files.get` returns `thumbnailLink` for Docs/Sheets/PDFs. These are ephemeral.
   - What's unclear: Quality and reliability of Drive thumbnailLink for non-Slides documents.
   - Recommendation: Use Drive thumbnailLink as source, cache to GCS same as Slides thumbnails. Fall back to file-type icon if thumbnailLink fetch fails.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/web/src/app/(authenticated)/discovery/discovery-client.tsx` -- current Discovery card implementation (1049 lines, text-only cards)
- Codebase analysis: `apps/web/src/components/template-card.tsx` -- Templates card with status badges, progress bar, polling
- Codebase analysis: `apps/web/src/lib/template-utils.ts` -- getTemplateStatus() with 7 states, STATUS_CONFIG
- Codebase analysis: `apps/web/src/components/template-status-badge.tsx` -- Badge component wrapping STATUS_CONFIG
- Codebase analysis: `apps/agent/src/lib/gcs-thumbnails.ts` -- GCS upload, Slides API thumbnail fetching, batch processing
- Codebase analysis: `apps/agent/src/mastra/index.ts` -- Discovery browse/search/ingest endpoints, enrichment pipeline
- Codebase analysis: `apps/web/src/lib/api-client.ts` -- DiscoveryDocument type, BrowseResult, API functions
- Codebase analysis: `apps/web/next.config.ts` -- Image remotePatterns (needs GCS hostname)
- Codebase analysis: `apps/agent/prisma/schema.prisma` -- Template model (ingestionStatus, slideCount), SlideEmbedding (thumbnailUrl)

### Secondary (MEDIUM confidence)
- shadcn/ui component inventory: Card, Progress, Skeleton, Badge, Sonner verified as installed in `components/ui/`
- Project skill: `ui-ux-pro-max` SKILL.md -- accessibility, touch targets, loading states, animation timing guidelines

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - clear extraction/unification path from existing code
- Pitfalls: HIGH - identified from actual codebase analysis (CORS, remotePatterns, race conditions, duplicate guard gaps)

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- internal UX polish, no external API changes expected)
