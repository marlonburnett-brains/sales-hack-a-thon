# Phase 75: Sidebar Integration - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Tutorials nav item to the global sidebar that navigates to /tutorials. Show a badge on the item when the user has unwatched tutorials; hide the badge once all tutorials are watched. This phase is purely the sidebar integration — the /tutorials page and video player are built in prior phases.

</domain>

<decisions>
## Implementation Decisions

### Badge style
- Expanded sidebar: "New" text pill (blue) — right-aligned, like a product label. Descriptive, distinguishable from Action Required's red count badge.
- Collapsed sidebar: blue dot — absolute-positioned top-right corner of the icon, matching the collapsed Action Required dot pattern.
- Badge color: blue (not red). Blue = informational "new content available"; red is reserved for Action Required urgency.
- Badge disappears when ALL tutorials are watched (watched=true for every tutorial in the DB). 16/17 watched still shows the badge.

### Data fetching approach
- New API route: `/api/tutorials/unwatched-count` — mirrors `/api/actions/count` exactly.
- Returns `{ count: number }` — same shape as the actions route; sidebar checks `count > 0` to show badge.
- Re-fetches on every `pathname` change (same `useEffect([pathname])` pattern as Action Required). Badge updates immediately after a user watches the last tutorial and navigates.

### Nav item position
- Tutorials appears **after Action Required** at the bottom of the nav list.
- Final order: Deals → Templates → Slide Library → AtlusAI → Action Required → Tutorials
- Icon: `GraduationCap` (Lucide) — clear learning/education icon, distinct from all existing nav icons.

### Claude's Discretion
- Exact blue shade for the badge (use existing Tailwind blue palette — e.g., bg-blue-500)
- Badge text size and pill dimensions
- Whether to add an aria-label to the badge for accessibility

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sidebar.tsx` (`apps/web/src/components/sidebar.tsx`): `navItems` array — simply append the Tutorials entry. Badge rendering logic exists inline for Action Required, apply the same pattern.
- Existing collapsed dot badge: `absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500` — replicate with blue.
- Existing expanded count badge: `ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white` — adapt as a "New" pill with blue.
- `/api/actions/count` route: reference implementation for `/api/tutorials/unwatched-count`.
- `pendingCount` state + `useEffect([pathname])` pattern: copy for `unwatchedCount`.

### Established Patterns
- API routes in `apps/web/src/app/api/` with Prisma queries and auth checks.
- `useEffect` fetch in sidebar triggered by `pathname` for reactive badge state.
- Lucide icons imported at top of `sidebar.tsx` — add `GraduationCap` to the import list.

### Integration Points
- `TutorialView` model: query `WHERE watched = false AND userId = currentUser` (or count tutorials with no TutorialView record for the user) — any unwatched = count > 0.
- `/tutorials` route: already built in Phase 72 — just link to it.
- `navItems` array in `sidebar.tsx:28-34`: add `{ href: "/tutorials", label: "Tutorials", icon: GraduationCap }`.

</code_context>

<specifics>
## Specific Ideas

- Badge label exactly "New" (text pill, not a number) — acts as a semantic label for new/unread content.
- Blue chosen intentionally to distinguish from Action Required red: two badge types coexist on the sidebar, each with its own visual identity.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 75-sidebar-integration*
*Context gathered: 2026-03-20*
