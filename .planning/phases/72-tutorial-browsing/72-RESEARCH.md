# Phase 72: Tutorial Browsing - Research

**Researched:** 2026-03-20
**Domain:** Next.js App Router tutorial browse UI over agent-service/Prisma tutorial metadata
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Card design & density
- Compact cards: title, thumbnail, duration badge, and watched checkmark
- Thumbnail image from 1-second frame of each video, uploaded to GCS, stored as `thumbnailUrl` on Tutorial model (requires new column + manual upload via gcloud CLI)
- Centered semi-transparent play icon overlay on thumbnail — universal video affordance
- Duration badge: dark semi-transparent pill overlaid on bottom-right corner of thumbnail (YouTube/Loom style)
- Grid columns: Claude's discretion based on card count per category and content area width
- Cards are clickable — navigate to /tutorials/[slug] (Phase 73 builds the player page; Phase 72 creates the route/link)

### Category grouping style
- Section headers with category name + Lucide icon + completion info, then card grid below
- Vertical scroll through all 6 categories in fixed order: Getting Started → Deal Workflows → Touch Points → Content Management → Review → Settings & Admin
- Each category header includes a matching Lucide icon (e.g., Rocket for Getting Started, Briefcase for Deals)
- Completed categories get a subtle green checkmark or muted styling on the header

### Watched/unwatched indicator
- Watched: small green checkmark icon in the corner of the card
- Unwatched: clean, no indicator — absence of checkmark is the signal
- No "New" dot on cards (that's Phase 75 sidebar badge, not card-level)

### Completion display
- Per-category: "X of Y" text + inline Progress bar in the section header
- Page header: "Tutorials" title + "X of 17 completed" text + progress bar (same style as category)
- All-complete state: progress bar goes green, text changes to "All 17 tutorials completed!" with a check icon
- Empty state: "No tutorials available yet" with a video icon (edge case for empty DB)

### Claude's Discretion
- Grid column count (responsive breakpoints)
- Exact Lucide icons per category
- Loading skeleton design
- Exact spacing, typography, and color choices
- Data fetching approach (server component vs client)
- Card hover effects

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BROWSE-02 | Tutorials page displays cards grouped by category (Getting Started, Deal Workflows, Touch Points, Content Management, Settings & Admin, Review) | Use a fixed category metadata map and seeded `sortOrder`; fetch tutorials once and group in server-rendered browse payload. |
| BROWSE-03 | Each category group shows completion percentage based on user's watched tutorials | Fetch `TutorialView` rows scoped to the current user and derive per-category `watchedCount`, `totalCount`, and percent server-side. |
| BROWSE-04 | Tutorial cards show title, description, duration, and watched/unwatched visual indicator | Render cards from `Tutorial` metadata plus derived `watched` boolean; use existing Card/Progress/Icon primitives and duration formatting helper. |
</phase_requirements>

## Summary

Phase 72 fits the project's existing pattern well: an authenticated App Router page in `apps/web` should fetch browse data on the server, and the underlying data should come from the existing agent service rather than direct Prisma access in the web app. The web app already uses server actions + `api-client.ts` + agent routes for authenticated reads, so tutorial browsing should follow the same architecture instead of introducing a parallel data path.

The UI stack is already present. `Card`, `Progress`, `Skeleton`, `Badge`, Lucide icons, Tailwind, and `next/image` cover the browse screen without adding packages. `next.config.ts` already allows `storage.googleapis.com`, so GCS-hosted tutorial thumbnails will work once `Tutorial.thumbnailUrl` exists. Because watched state is user-specific and derived from `TutorialView`, the page should be dynamic and server-rendered.

The biggest planning nuance is scope discipline. This phase is browse-only: grouping, progress summaries, watched indicators, thumbnails, and links. Do not pull in playback, resume, periodic progress persistence, or sidebar badge logic. Also note a roadmap inconsistency: the locked context explicitly wants a page-level overall progress bar even though `TRACK-03` is mapped to Phase 73. Plan for that now, since it comes "for free" from the same watched-state dataset.

**Primary recommendation:** Implement `/tutorials` as a server-rendered authenticated page backed by one new agent `GET /tutorials` browse endpoint plus a Prisma migration for `Tutorial.thumbnailUrl`; render with existing shadcn/Tailwind primitives and fixed category metadata.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | `^15.5.12` | Authenticated route, server rendering, `loading.tsx`, `next/image` | Already the app standard for data-backed pages and route-segment loading UI. |
| React | `^19.0.0` | Server + client component rendering | Already paired with App Router; no extra client data library is needed here. |
| Prisma Client (agent app) | `^6.3.1` | Query `Tutorial` and `TutorialView`, add `thumbnailUrl` migration | Existing source of truth for tutorial metadata and watched state. |
| Agent service route layer (`apps/agent/src/mastra/index.ts`) | existing project pattern | API boundary between web and database | Web app already reads app data through agent routes via `api-client.ts`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | `^3.4.17` | Layout, spacing, responsive grid, state styling | All browse page styling. |
| shadcn/ui local components | local | `Card`, `Skeleton`, `Badge` | Tutorial cards, loading states, duration pill styling. |
| `@radix-ui/react-progress` via local `Progress` | `^1.1.8` | Category and page-level completion bars | Any watched completion UI. |
| `lucide-react` | `^0.576.0` | Category icons, play overlay, watched checkmark | Header/category/card iconography. |
| `@supabase/ssr` | `^0.9.0` | Current-user auth in App Router | Required because watched state is per-user. |
| `next/image` | built into Next 15 | Remote GCS thumbnail rendering with reserved aspect ratio | Use for tutorial thumbnails instead of raw `<img>`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-rendered page + server action + agent route | Client-side SWR/React Query | Only worth it if browse data must live-refresh; Phase 72 is read-only and fits server rendering better. |
| Agent-backed tutorial endpoint | Direct Prisma in `apps/web` | Would bypass current project architecture and duplicate auth/data-access concerns. |
| `next/image` | Plain `<img>` | Plain `<img>` is only justified if thumbnail host is unsupported; current GCS host is already allowed. |
| Existing `Progress` component | Custom width-based progress div | Custom bars add styling/a11y inconsistency for no benefit. |

**Installation / setup:**
```bash
# No new npm packages required
pnpm --filter agent prisma migrate dev --name add-tutorial-thumbnail-url
```

## Architecture Patterns

### Recommended Project Structure
```text
apps/web/src/app/(authenticated)/tutorials/
├── page.tsx                    # server-rendered browse page
└── loading.tsx                 # route-level skeletons

apps/web/src/components/tutorials/
├── tutorial-card.tsx           # presentational card
├── tutorial-category-section.tsx
└── tutorials-page-header.tsx

apps/web/src/lib/
├── actions/tutorial-actions.ts # server action wrapper
└── api-client.ts               # typed fetch to agent /tutorials

apps/agent/
├── prisma/schema.prisma        # add Tutorial.thumbnailUrl
└── src/mastra/index.ts         # GET /tutorials browse endpoint
```

### Pattern 1: Server-rendered authenticated browse page
**What:** Put the `/tutorials` page in the authenticated route group, fetch data in the page server component, and keep the browse UI mostly presentational.
**When to use:** Default for this phase; only introduce client components for truly interactive subparts.
**Example:**
```tsx
// Source: apps/web/src/app/(authenticated)/templates/page.tsx
import { listTutorialsAction } from "@/lib/actions/tutorial-actions";

export const dynamic = "force-dynamic";

export default async function TutorialsPage() {
  let data = { tutorials: [], categorySummaries: [], overall: null };

  try {
    data = await listTutorialsAction();
  } catch (err) {
    console.error("[tutorials-page] Failed to fetch tutorials:", err);
  }

  return <TutorialsBrowseView data={data} />;
}
```

### Pattern 2: Build one browse payload from tutorials + user views
**What:** Query tutorial metadata and the current user's `TutorialView` rows, then derive watched flags and category/page progress in one place.
**When to use:** Always; avoids duplicate counting logic in multiple UI components.
**Example:**
```ts
// Source: Prisma read/query patterns from
// https://www.prisma.io/docs/orm/prisma-client/queries/crud
// and route style from apps/agent/src/mastra/index.ts
const [tutorials, views] = await Promise.all([
  prisma.tutorial.findMany({ orderBy: { sortOrder: "asc" } }),
  prisma.tutorialView.findMany({ where: { userId } }),
]);

const watchedByTutorialId = new Set(
  views.filter((view) => view.watched).map((view) => view.tutorialId),
);

const cards = tutorials.map((tutorial) => ({
  ...tutorial,
  watched: watchedByTutorialId.has(tutorial.id),
}));
```

### Pattern 3: Separate storage enums from UI metadata
**What:** Keep a single constant map for category label, icon, and display order.
**When to use:** Always; DB categories are snake_case, UI labels are humanized, and order is fixed by product requirements rather than alphabetic sort.
**Example:**
```ts
const CATEGORY_META = [
  { key: "getting_started", label: "Getting Started", icon: Rocket },
  { key: "deal_workflows", label: "Deal Workflows", icon: Briefcase },
  { key: "touch_points", label: "Touch Points", icon: Hand },
  { key: "content_management", label: "Content Management", icon: Layers3 },
  { key: "review", label: "Review", icon: ClipboardCheck },
  { key: "settings_admin", label: "Settings & Admin", icon: Settings },
] as const;
```

### Pattern 4: Route-level loading skeletons, not spinner-only loading
**What:** Add `loading.tsx` beside the page and reserve card thumbnail space with `aspect-video` skeleton blocks.
**When to use:** For all authenticated App Router browse pages with server data.
**Example:**
```tsx
// Source: apps/web/src/app/(authenticated)/discovery/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <Skeleton className="aspect-video w-full rounded-md" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Direct DB reads in `apps/web`:** the web app currently goes through `api-client.ts` and agent routes for authenticated data.
- **Alphabetical category grouping:** product requires fixed seeded order.
- **Client-only fetch for initial browse render:** adds unnecessary hydration delay for a read-heavy page.
- **Combining playback/resume logic into browse cards:** that belongs to Phases 73+.
- **Hard-coding green progress logic per component:** derive once from counts and pass down.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Progress bars | Custom nested div widths | Existing `Progress` component | Already standardized and visually consistent. |
| Remote thumbnails | Raw `<img>` with manual responsive logic | `next/image` | Handles optimization path, aspect ratio, and responsive sizing. |
| Watched persistence | LocalStorage/card state | `TutorialView` from Prisma | Requirement is per-user persistent watched state. |
| Loading UI | Global spinner only | `loading.tsx` + `Skeleton` | Better perceived performance and no layout jump. |
| Category display mapping | Repeated switch statements | Single category metadata constant | Prevents label/order/icon drift. |
| Interactive cards | `div` with `onClick` only | `next/link` wrapping card | Better accessibility and existing project pattern. |

**Key insight:** almost everything Phase 72 needs already exists in the project except the tutorial browse API surface and `Tutorial.thumbnailUrl`; the safest plan is to compose existing primitives, not invent a new client-state-heavy subsystem.

## Common Pitfalls

### Pitfall 1: Using the wrong category order
**What goes wrong:** Cards render in alphabetical or query order instead of the locked product order.
**Why it happens:** DB stores snake_case categories and `findMany` alone does not encode section order.
**How to avoid:** Use a fixed category metadata array and always render sections from that array.
**Warning signs:** Review appears before Settings, or empty categories disappear/reorder unpredictably.

### Pitfall 2: Computing completion globally instead of per user
**What goes wrong:** Completion percentages reflect all `TutorialView` rows or no auth scope.
**Why it happens:** `TutorialView` is keyed by both `tutorialId` and `userId`.
**How to avoid:** Resolve the authenticated user first and filter `TutorialView` by `userId` before deriving counts.
**Warning signs:** Two users see the same watched state or percentages do not reset for a new user.

### Pitfall 3: Forgetting phase boundary discipline
**What goes wrong:** Browse work expands into playback controls, save-on-ended logic, or resume tracking.
**Why it happens:** The browse UI sits next to future playback phases and uses the same models.
**How to avoid:** Treat `watched` as read-only input in Phase 72; no new playback-side mutations beyond what Phase 71 already created structurally.
**Warning signs:** Plans mention HTML5 `<video>`, `timeupdate`, or last-position writes.

### Pitfall 4: Thumbnail layout shift or broken remote images
**What goes wrong:** Cards jump during load or thumbnails fail in production.
**Why it happens:** Missing reserved aspect ratio, missing `thumbnailUrl`, or thumbnail host mismatch.
**How to avoid:** Use an `aspect-video` thumbnail container, `next/image` with `fill` and `sizes`, and keep a null-safe fallback when `thumbnailUrl` is absent.
**Warning signs:** CLS on navigation or 400 errors from the Next image optimizer.

### Pitfall 5: Breaking Prisma migration discipline
**What goes wrong:** Developer reaches for `db push` or reset because the change looks small.
**Why it happens:** `thumbnailUrl` is “just one column,” so it is easy to underestimate process requirements.
**How to avoid:** Use a forward-only migration via `prisma migrate dev --name add-tutorial-thumbnail-url`; never use `db push` or `migrate reset` in this project.
**Warning signs:** Plan text mentions reset, recreate, or schema-only sync.

### Pitfall 6: Duplicating progress calculations in page and sections
**What goes wrong:** Page header progress and section progress disagree.
**Why it happens:** Counts are recalculated in multiple components with slightly different filters.
**How to avoid:** Build one normalized browse DTO on the server and pass final counts/percents to components.
**Warning signs:** Overall completed count does not match the sum of watched cards.

## Code Examples

Verified patterns from official docs and existing project code:

### Server data fetch in an App Router page
```tsx
// Source: apps/web/src/app/(authenticated)/templates/page.tsx
export const dynamic = "force-dynamic";

export default async function Page() {
  let records = [];

  try {
    records = await listTutorialsAction();
  } catch (err) {
    console.error("[tutorials-page] Failed to fetch tutorials:", err);
  }

  return <TutorialsBrowseView records={records} />;
}
```

### Responsive remote thumbnail with preserved space
```tsx
// Source: https://nextjs.org/docs/app/api-reference/components/image
import Image from "next/image";

<div className="relative aspect-video overflow-hidden rounded-md bg-slate-100">
  <Image
    src={tutorial.thumbnailUrl}
    alt={tutorial.title}
    fill
    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
    className="object-cover"
  />
</div>
```

### Route-level loading state
```tsx
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/loading
export default function Loading() {
  return <TutorialsPageSkeleton />;
}
```

### Prisma read pattern for browse aggregation
```ts
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/crud
const tutorials = await prisma.tutorial.findMany({
  orderBy: { sortOrder: "asc" },
});

const views = await prisma.tutorialView.findMany({
  where: { userId },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-only data fetch after hydration | App Router server data fetching with `loading.tsx` streaming support | Next App Router era; current docs updated 2026-03-13 | Better authenticated first render and simpler browse pages. |
| Plain remote `<img>` tags | `next/image` with strict `remotePatterns` | Current Next guidance; Image docs updated 2026-03-10 | Better CLS control and safer remote image handling. |
| Ad hoc CSS progress bars | Standardized `Progress` built on Radix | Current project UI pattern | Consistent visuals and less custom code. |

**Deprecated/outdated:**
- `next/image` `priority`: deprecated in Next 16 in favor of `preload`; not needed for this card grid anyway.
- `prisma db push` for schema changes: explicitly disallowed by project rules and inferior to migrations for this project.

## Open Questions

1. **Should Phase 72 create a minimal `/tutorials/[slug]` placeholder page to avoid broken navigation before Phase 73?**
   - What we know: locked decisions require clickable cards that navigate to `/tutorials/[slug]`, but Phase 73 owns the real player page.
   - What's unclear: whether a temporary placeholder is acceptable or whether this phase can tolerate a future route target.
   - Recommendation: decide during planning; if user-facing navigation will be exercised before Phase 73, add a minimal stub route now.

2. **How will `thumbnailUrl` be backfilled operationally?**
   - What we know: user chose 1-second frame extraction, manual GCS upload via gcloud CLI, and storage on `Tutorial.thumbnailUrl`.
   - What's unclear: whether backfill is a one-off DB update, a seed-script enhancement, or a dedicated helper script.
   - Recommendation: plan an explicit migration + backfill step, but keep UI null-safe so browse page works before all thumbnails are populated.

3. **Should the page-level overall progress bar ship in this phase despite roadmap mapping it to Phase 73?**
   - What we know: locked context requires it on this page.
   - What's unclear: whether roadmap traceability will be updated or this phase intentionally pulls that display work forward.
   - Recommendation: implement it now from the same browse DTO and note the roadmap overlap in planning.

## Sources

### Primary (HIGH confidence)
- Repository: `apps/web/package.json` - confirmed Next 15.5.12, React 19, Radix Progress, Lucide, Tailwind, Vitest.
- Repository: `apps/web/src/app/(authenticated)/templates/page.tsx` - confirmed server-rendered page fetch pattern.
- Repository: `apps/web/src/app/(authenticated)/discovery/loading.tsx` - confirmed route-level skeleton pattern.
- Repository: `apps/web/src/components/sidebar.tsx` - confirmed authenticated route shell and existing nav conventions.
- Repository: `apps/web/next.config.ts` - confirmed `storage.googleapis.com` is already allowed for remote images.
- Repository: `apps/agent/prisma/schema.prisma` - confirmed `Tutorial` / `TutorialView` schema and uniqueness model.
- Repository: `apps/agent/prisma/seed.ts` - confirmed seeded category keys and fixed tutorial ordering.
- Repository: `apps/tutorials/scripts/upload-to-gcs.ts` - confirmed GCS upload pattern uses `VERTEX_SERVICE_ACCOUNT_KEY` and writes manifest data.
- Official docs: https://nextjs.org/docs/app/getting-started/fetching-data - verified server component data-fetching guidance (last updated 2026-03-13).
- Official docs: https://nextjs.org/docs/app/api-reference/file-conventions/loading - verified `loading.tsx` route behavior (last updated 2026-03-13).
- Official docs: https://nextjs.org/docs/app/api-reference/components/image - verified remote image and `fill`/`sizes` requirements (last updated 2026-03-10).
- Official docs: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production - verified `migrate dev` / `--create-only` workflow and production-vs-dev guidance.
- Official docs: https://www.prisma.io/docs/orm/prisma-client/queries/crud - verified Prisma read/query patterns used for browse aggregation.

### Secondary (MEDIUM confidence)
- Repository: `apps/web/src/components/template-card.tsx` - analogous clickable card pattern with hover, metadata chips, and progress-like subcomponents.
- Skill guidance: `ui-ux-pro-max` - reinforced hover/focus/cursor/skeleton/a11y recommendations for card grids.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - derived directly from repository dependencies and existing code paths.
- Architecture: MEDIUM - strongly supported by adjacent project patterns, but tutorial routes/components do not exist yet.
- Pitfalls: MEDIUM - based on project constraints, seeded data shape, and official Next/Prisma guidance.

**Research date:** 2026-03-20
**Valid until:** 2026-04-19
