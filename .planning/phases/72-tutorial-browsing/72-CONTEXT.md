# Phase 72: Tutorial Browsing - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Display all 17 tutorials on a /tutorials page, grouped by 6 categories with per-category completion percentages and per-card watched/unwatched indicators. Cards link to the player page (built in Phase 73). This phase delivers the browse UI; video playback, progress tracking persistence, and sidebar nav item are separate phases.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<specifics>
## Specific Ideas

- Thumbnails: extract frame at 1-second mark from each MP4, upload to GCS via gcloud CLI, add `thumbnailUrl` column to Tutorial model via migration
- Duration badge placement inspired by YouTube/Loom — dark pill on bottom-right of thumbnail
- Play icon overlay on thumbnail for clear video affordance
- Category icon in headers for visual scanning aid
- Celebratory "All 17 completed!" state when user finishes all tutorials

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card`, `CardHeader`, `CardContent` (shadcn/ui): base card components for tutorial cards
- `Progress` (Radix): progress bar for category and page-level completion
- `Badge`: could be used for duration pill styling
- `Skeleton`: loading state component
- `TemplateCard`: established card pattern with click-through, status badges, and metadata chips
- Lucide icons: already used throughout (Briefcase, Layers, etc.)

### Established Patterns
- `(authenticated)` route group with layout for sidebar + content area
- Server components for data fetching, client components for interactivity
- Tailwind CSS for all styling
- shadcn/ui component library (Card, Badge, Progress, Skeleton all available)

### Integration Points
- New route: `apps/web/src/app/(authenticated)/tutorials/page.tsx`
- Tutorial model from Phase 71 (title, description, category, duration, gcsUrl, sortOrder)
- TutorialView model from Phase 71 (watched state per user — query for current user's views)
- Links to `/tutorials/[slug]` (Phase 73 builds player page)
- `thumbnailUrl` column needs adding to Tutorial model (new migration)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 72-tutorial-browsing*
*Context gathered: 2026-03-20*
