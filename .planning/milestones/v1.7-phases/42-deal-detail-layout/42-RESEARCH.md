# Phase 42: Deal Detail Layout - Research

**Researched:** 2026-03-08
**Domain:** Next.js App Router nested layouts, CRM-style deal navigation, AI-driven briefing UX
**Confidence:** HIGH

## Summary

Phase 42 transforms the current monolithic deal detail page (`deals/[dealId]/page.tsx`) into a multi-page nested layout with a deal-specific sidebar, breadcrumbs, and two initial sub-pages (Overview and Briefing). The primary technical challenge is the Next.js App Router nested layout pattern: a `deals/[dealId]/layout.tsx` that renders breadcrumbs + deal sidebar while allowing sub-pages to render in a content slot. Existing sub-routes (`review/[briefId]`, `asset-review/[interactionId]`) must continue working within the new layout.

The codebase already has all the reusable components needed for the Overview page (DealStatusAction, DealAssignmentPicker, StackedAvatars, InteractionTimeline). The Briefing page requires a new conversational AI chat panel to replace the rigid PreCallForm, plus a prior-briefings list. The AI chat integration itself (CHAT-01 through CHAT-05) is deferred to Phase 45, so the Briefing page in this phase should build the UI shell with a placeholder or initial non-streaming implementation.

**Primary recommendation:** Use Next.js App Router nested layouts with a `deals/[dealId]/layout.tsx` that fetches the deal once and renders both the deal sidebar and breadcrumbs, passing deal data to sub-pages via the layout's server component context. The current `page.tsx` becomes a redirect to `/overview`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Nested sidebar pattern: global app sidebar stays visible on the left, deal sidebar appears as a narrower column next to it inside the content area (two visible sidebars, CRM-style)
- Navigation order: Overview, Briefing, Touch 1, Touch 2, Touch 3, Touch 4
- Touch items show status indicators: not started (empty), in progress (dot), completed (checkmark) -- derived from interaction data
- Deal sidebar is a new component specific to the deal detail layout, separate from the global Sidebar
- Breadcrumbs appear above the content area, at the top of the main content panel
- Path format: Deals > Company Name > Current Page (e.g., "Deals > Acme Corp > Overview")
- "Deals" links back to the pipeline list page; company name links to deal overview
- Create a shared reusable Breadcrumb component in ui/ -- replace the inline breadcrumb HTML in template slides too
- /deals/[id] redirects to /deals/[id]/overview (overview is the default sub-page)
- Deal header: company name, deal name, status badge, owner/collaborators with stacked avatars
- Status change action available directly from Overview header (same pattern as pipeline card)
- Assignment editing (owner/collaborators) available from Overview using the hybrid picker from Phase 41
- Key metrics cards: touches completed, days in pipeline, last activity date, etc.
- Activity timeline using existing InteractionTimeline component
- Alert banners for pending brief approval and asset review (moved from current monolithic page)
- Touch flow cards do NOT appear on Overview -- they live only on their dedicated touch sub-pages
- Briefing page consolidates: pre-call briefings, meeting notes/transcripts, company research data
- Replaces the rigid PreCallForm with a conversational AI-driven meeting prep experience
- Inline chat panel at the top: AI proactively surfaces context about the company, suggests research, discovery questions, and offers to generate full briefings
- AI suggestions include: "Dig deeper on their tech stack", "Suggest discovery questions", "Generate full briefing" -- results saved as briefing artifacts
- Previous briefings displayed below the chat panel, newest first, expandable/collapsible

### Claude's Discretion
- Deal sidebar visual treatment (width, styling, collapse behavior on mobile)
- Deal sidebar header content (deal name, status badge, or minimal)
- Briefing page section organization (stacked sections vs timeline vs hybrid)
- Key metrics card selection and visual layout
- Loading skeletons for sub-pages
- Mobile responsive behavior for nested sidebar layout
- Empty states for briefing page when no prior briefings exist

### Deferred Ideas (OUT OF SCOPE)
- AI chat bar persistent across all deal sub-pages (CHAT-01 through CHAT-05) -- Phase 45/46
- Touch page HITL workflows (TOUCH-01 through TOUCH-07) -- Phase 45/46
- Meeting notes and transcript upload via chat -- Phase 45/46
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | User sees breadcrumbs for navigating back to deals list from any deal sub-page | Shared Breadcrumb component in `components/ui/breadcrumb.tsx`; rendered in `deals/[dealId]/layout.tsx` |
| NAV-02 | Deal detail has a left sidebar with links to Overview, Briefing, Touch 1-4 | New `DealSidebar` component rendered in layout; touch status derived from interactions |
| NAV-03 | Each sidebar link navigates to its own sub-page within the deal detail | Next.js App Router nested routes: `overview/page.tsx`, `briefing/page.tsx`, `touch/[touchNumber]/page.tsx` (placeholder) |
| OVER-01 | User can view deal state and status on the overview page | Reuse `DealStatusAction` from deal-card; deal data fetched in layout |
| OVER-02 | User can see accumulated data and key metrics for the deal | Metrics cards: touches completed count, days in pipeline, last activity date, total interactions |
| OVER-03 | User can see activity summary and timeline for the deal | Reuse existing `InteractionTimeline` component directly |
| OVER-04 | User can see assignment info (owner + collaborators) on the overview | Reuse `StackedAvatars` + `DealAssignmentPicker` from Phase 41 |
| BRIEF-01 | User can view consolidated pre-call briefing, research data, and meeting notes on a single briefing page | New briefing page with AI chat panel (shell) + prior briefings list from interaction data |
| BRIEF-02 | All prep/context material for the deal is accessible from the briefing page | Briefing page aggregates pre_call interactions, consolidates prior briefing display |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x | App Router nested layouts, server components | Already in use; nested layouts are first-class |
| React | 19.x | UI rendering | Already in use |
| Tailwind CSS | 3.4.x | Styling | Already in use |
| shadcn/ui | latest | UI primitives (Badge, Card, Separator, Skeleton, Tabs, Avatar) | Already in use |
| lucide-react | 0.576.x | Icons | Already in use |
| sonner | 2.x | Toast notifications | Already in use |
| date-fns | 4.1.x | Date formatting/calculations | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-tabs | 1.1.x | Tab primitives (already installed) | If briefing page uses tab organization |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom breadcrumb | shadcn/ui breadcrumb | shadcn has one but project already has inline pattern; build a lightweight custom one matching existing style |
| React Context for deal data | Prop drilling from layout | Context adds complexity; Next.js layout pattern with parallel fetching is simpler |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Route Structure
```
apps/web/src/app/(authenticated)/deals/[dealId]/
  layout.tsx              # NEW: fetches deal, renders breadcrumbs + deal sidebar + {children}
  page.tsx                # MODIFIED: redirect to ./overview
  loading.tsx             # MODIFIED: skeleton for layout level
  overview/
    page.tsx              # NEW: deal overview content
    loading.tsx           # NEW: overview skeleton
  briefing/
    page.tsx              # NEW: briefing content with AI chat shell
    loading.tsx           # NEW: briefing skeleton
  touch/
    [touchNumber]/
      page.tsx            # NEW: placeholder for Phase 46
  review/
    [briefId]/            # EXISTING: unchanged, inherits new layout
  asset-review/
    [interactionId]/      # EXISTING: unchanged, inherits new layout
```

### Pattern 1: Nested Layout with Deal Data Fetching
**What:** The `deals/[dealId]/layout.tsx` server component fetches the deal once, renders the deal sidebar and breadcrumbs, and passes children through.
**When to use:** All deal sub-pages.
**Example:**
```typescript
// deals/[dealId]/layout.tsx
import { notFound } from "next/navigation";
import { getDealAction } from "@/lib/actions/deal-actions";
import { DealSidebar } from "@/components/deals/deal-sidebar";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default async function DealLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const deal = await getDealAction(dealId);
  if (!deal) notFound();

  return (
    <div className="flex h-full">
      <DealSidebar deal={deal} />
      <div className="flex-1 min-w-0 overflow-auto">
        <Breadcrumb
          items={[
            { label: "Deals", href: "/deals" },
            { label: deal.company?.name ?? "Deal", href: `/deals/${dealId}/overview` },
          ]}
        />
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
```

### Pattern 2: Redirect from Base to Default Sub-Page
**What:** `/deals/[id]` redirects to `/deals/[id]/overview`.
**When to use:** When user navigates to deal without a sub-page.
**Example:**
```typescript
// deals/[dealId]/page.tsx
import { redirect } from "next/navigation";

export default async function DealPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  redirect(`/deals/${dealId}/overview`);
}
```

### Pattern 3: Layout-Level Data Sharing via Refetch
**What:** Since Next.js App Router does not allow passing props from layout to page components, sub-pages re-fetch the deal using the same server action. Next.js deduplicates fetch calls within the same request, so this is efficient.
**When to use:** Overview and Briefing pages that need deal data.
**Important:** The layout fetch and page fetch use the same `getDealAction` -- Next.js request deduplication ensures only one actual API call occurs.

### Pattern 4: Shared Breadcrumb Component
**What:** Extract a reusable `Breadcrumb` component to `components/ui/breadcrumb.tsx`.
**When to use:** Deal detail layout + template slides page (replace inline breadcrumbs).
**Example:**
```typescript
// components/ui/breadcrumb.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  current?: string;
}

export function Breadcrumb({ items, current }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm px-6 py-3" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
          {item.href ? (
            <Link
              href={item.href}
              className="text-slate-500 hover:text-slate-900 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-500">{item.label}</span>
          )}
        </span>
      ))}
      {current && (
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium text-slate-900">{current}</span>
        </span>
      )}
    </nav>
  );
}
```

### Pattern 5: Deal Sidebar with Touch Status Indicators
**What:** Deal sidebar renders navigation links with status indicators for touches.
**When to use:** `deals/[dealId]/layout.tsx` renders this component.
**Key details:**
- Width: ~200-220px (narrower than global sidebar's 240px)
- Touch status derived from `deal.interactions`: check for completed/in-progress/not-started per touch type
- Active link highlighted based on `usePathname()` (client component)
- Mobile: hidden by default, toggle via hamburger or overlay

### Anti-Patterns to Avoid
- **Layout wrapper removing global sidebar padding:** The global `Sidebar` component wraps content in `mx-auto max-w-7xl px-4 py-6`. The deal layout must work within this constraint or override it for the deal sidebar to sit flush. Solution: the deal layout's flex container fills the available space within the global content area.
- **Fetching deal data in every sub-page independently:** While Next.js deduplicates within a request, avoid unnecessary client-side fetches. Layout fetches once per navigation.
- **Using React Context for deal data across layout/page boundary:** Not needed; server component re-fetch with deduplication is the standard Next.js pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status badges | Custom badge styling | Existing `DealStatusAction` component | Already handles all status colors, transitions, confirmation dialogs |
| Assignment picker | Custom user selector | Existing `DealAssignmentPicker` component | Already handles owner/collaborator with search, freeform email, save |
| Avatar stacking | Custom avatar layout | Existing `StackedAvatars` component | Already handles initials, overflow count, sizing |
| Interaction timeline | Custom timeline | Existing `InteractionTimeline` component | Already handles sorting, empty state, entry rendering |
| Date formatting | Manual date string manipulation | `date-fns` (already installed) | Handles locales, relative dates, edge cases |
| Toast notifications | Custom notification system | `sonner` (already installed) | Already configured app-wide |

**Key insight:** The Overview page is largely a composition of existing Phase 41 components. The main new work is the layout/sidebar/breadcrumb infrastructure and the Briefing page.

## Common Pitfalls

### Pitfall 1: Global Sidebar Content Area Conflict
**What goes wrong:** The global `Sidebar` component wraps `{children}` in `<div className="mx-auto max-w-7xl px-4 py-6">`. Adding a deal sidebar inside this creates awkward padding/max-width constraints.
**Why it happens:** The deal sidebar needs to sit at the left edge of the content area, but the global layout adds padding.
**How to avoid:** The deal layout should work within the padded content area. The deal sidebar + content flex layout sits inside the max-w-7xl container. Alternatively, detect deal routes and remove the max-w/padding at the global level, but this is more invasive. The simpler approach: keep the container but let the deal layout use negative margins or simply accept the sidebar is within the padded area (this is how CRM tools like HubSpot handle nested nav).
**Warning signs:** Deal sidebar appears indented or with extra left padding.

### Pitfall 2: Breadcrumb "Current Page" Detection
**What goes wrong:** Breadcrumb shows wrong current page because pathname parsing is fragile.
**Why it happens:** Sub-pages have nested paths like `/deals/[id]/overview` but also `/deals/[id]/review/[briefId]`.
**How to avoid:** Layout passes breadcrumb items as props based on the route. Sub-pages can optionally set the current page label. Use a simple approach: layout renders the first two crumbs (Deals > Company), and each page.tsx adds its own final crumb.
**Warning signs:** Breadcrumb shows "review" or "[briefId]" as the current page.

### Pitfall 3: Existing Sub-Routes Breaking Under New Layout
**What goes wrong:** The `review/[briefId]` and `asset-review/[interactionId]` pages break because the new layout adds a sidebar they weren't designed for.
**Why it happens:** Adding `layout.tsx` to `deals/[dealId]/` wraps ALL nested routes.
**How to avoid:** These pages should work fine with the deal sidebar visible -- they're part of the deal context. The breadcrumb will show appropriate context. Verify these pages still render correctly within the new layout.
**Warning signs:** Review pages have broken styling or double sidebars.

### Pitfall 4: Next.js Params Promise Pattern
**What goes wrong:** Build errors when accessing `params.dealId` directly.
**Why it happens:** Next.js 15 changed params to be a Promise in server components.
**How to avoid:** Always `const { dealId } = await params;` in both layout and page components.
**Warning signs:** TypeScript errors about Promise, or runtime "cannot read property" errors.

### Pitfall 5: Request Deduplication Not Working
**What goes wrong:** Deal data fetched twice (layout + page) resulting in two API calls.
**Why it happens:** Next.js only deduplicates native `fetch()` calls, not arbitrary async functions.
**How to avoid:** The `getDealAction` uses server actions which call `fetchJSON` which uses `fetch()`. The deduplication should work for `GET`-equivalent requests. If not, use React `cache()` wrapper around the deal fetch function.
**Warning signs:** Agent service logs show duplicate deal fetches per page load.

### Pitfall 6: Briefing AI Chat Scope Creep
**What goes wrong:** Phase 42 tries to implement full AI chat functionality (CHAT-01 through CHAT-05).
**Why it happens:** The briefing page description mentions AI-driven conversational prep.
**How to avoid:** Build the UI shell for the chat panel with placeholder suggestions/buttons. Wire up basic non-streaming briefing generation if possible. Full persistent chat is Phase 45.
**Warning signs:** Implementing WebSocket/streaming, message history persistence, or cross-page chat state.

## Code Examples

### Existing Inline Breadcrumb to Extract (templates slides page)
```typescript
// Current pattern in templates/[id]/slides/page.tsx (line 55-64)
<nav className="flex items-center gap-1 text-sm px-4 pt-3" aria-label="Breadcrumb">
  <Link href="/templates" className="text-slate-500 hover:text-slate-900 transition-colors">
    Templates
  </Link>
  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
  <span className="font-medium text-slate-900">{templateName}</span>
</nav>
```

### Touch Status Derivation (from deal-card.tsx pattern)
```typescript
// Derive touch statuses from interactions -- reuse same logic as DealCard
function getTouchStatus(interactions: InteractionRecord[], touchType: string): "completed" | "in_progress" | "not_started" {
  const touchInteractions = interactions.filter(i => i.touchType === touchType);
  if (touchInteractions.length === 0) return "not_started";
  const hasCompleted = touchInteractions.some(i =>
    i.status === "approved" || i.status === "edited" || i.status === "overridden" || i.status === "delivered"
  );
  if (hasCompleted) return "completed";
  return "in_progress";
}
```

### Key Metrics Calculation
```typescript
// Metrics for Overview page
function computeDealMetrics(deal: Deal) {
  const interactions = deal.interactions ?? [];
  const touchTypes = ["touch_1", "touch_2", "touch_3", "touch_4"];
  const completedTouches = touchTypes.filter(t =>
    interactions.some(i => i.touchType === t &&
      (i.status === "approved" || i.status === "edited" || i.status === "overridden" || i.status === "delivered"))
  ).length;

  const daysInPipeline = Math.floor(
    (Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const lastActivity = interactions.length > 0
    ? new Date(Math.max(...interactions.map(i => new Date(i.createdAt).getTime())))
    : null;

  return {
    touchesCompleted: completedTouches,
    totalTouches: 4,
    daysInPipeline,
    lastActivityDate: lastActivity,
    totalInteractions: interactions.length,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic deal page | Nested layout with sub-pages | This phase | All deal content organized into dedicated pages |
| Inline breadcrumbs | Shared Breadcrumb component | This phase | Consistent navigation across deal and template views |
| PreCallForm (rigid form) | AI-driven conversational briefing | This phase | More flexible, context-aware meeting prep |

## Open Questions

1. **Layout padding interaction with global sidebar**
   - What we know: Global sidebar wraps content in `mx-auto max-w-7xl px-4 py-6`. Deal sidebar needs to be inside this.
   - What's unclear: Whether the deal sidebar looks right nested within the padded/max-width container, or whether the global layout needs modification for deal routes.
   - Recommendation: Start with the deal sidebar inside the container. If it looks cramped, adjust the global layout to conditionally remove max-width/padding for deal detail routes (check pathname).

2. **Briefing AI chat panel scope in Phase 42**
   - What we know: CONTEXT.md describes a conversational AI experience with suggestions. CHAT-01-05 are Phase 45.
   - What's unclear: How much AI functionality to wire up in Phase 42 vs. leaving as UI shell.
   - Recommendation: Build the chat UI shell with hardcoded suggestion buttons. Wire up a single "Generate full briefing" action that calls the existing pre-call workflow. Leave streaming/conversation history for Phase 45.

3. **Deal data re-fetching pattern**
   - What we know: Layout fetches deal for sidebar/breadcrumbs. Pages need the same deal data.
   - What's unclear: Whether Next.js request deduplication works with the `fetchJSON` wrapper through server actions.
   - Recommendation: Wrap `getDealAction` with React `cache()` to guarantee deduplication. This is a one-line change.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `apps/web/src/app/(authenticated)/deals/[dealId]/page.tsx` -- current monolithic page structure
- Codebase analysis: `apps/web/src/components/sidebar.tsx` -- global sidebar patterns (collapsed state, mobile overlay, nav items)
- Codebase analysis: `apps/web/src/components/deals/deal-card.tsx` -- touch status derivation, component reuse patterns
- Codebase analysis: `apps/web/src/components/deals/deal-status-action.tsx` -- status change with confirmation
- Codebase analysis: `apps/web/src/components/deals/deal-assignment-picker.tsx` -- hybrid picker with search
- Codebase analysis: `apps/web/src/components/timeline/interaction-timeline.tsx` -- timeline component
- Codebase analysis: `apps/web/src/components/pre-call/pre-call-section.tsx` -- current briefing section with prior briefings list
- Codebase analysis: `apps/web/src/app/(authenticated)/templates/[id]/slides/page.tsx` -- inline breadcrumb pattern to extract
- Codebase analysis: `apps/web/src/app/(authenticated)/layout.tsx` -- global sidebar integration
- Codebase analysis: `apps/web/src/lib/actions/deal-actions.ts` -- all deal server actions available

### Secondary (MEDIUM confidence)
- Next.js App Router nested layouts -- well-documented pattern, verified against Next.js 15 params Promise behavior
- React `cache()` for request deduplication -- standard React 19 pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - Next.js nested layouts are well-established; codebase patterns are clear
- Pitfalls: HIGH - derived from direct codebase analysis of existing components and layout structure
- Briefing page AI chat: MEDIUM - scope boundary between Phase 42 and Phase 45 needs careful planning

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable; no external dependencies changing)
