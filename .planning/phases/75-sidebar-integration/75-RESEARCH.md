# Phase 75: Sidebar Integration - Research

**Researched:** 2026-03-20
**Domain:** Next.js sidebar component, Next.js API route, Prisma count query
**Confidence:** HIGH

## Summary

Phase 75 is a narrow, low-risk integration task. All the building blocks exist in the codebase — the sidebar component, the badge rendering pattern, the API route pattern, the auth pattern, and the Prisma model. The entire implementation is a copy-adapt exercise: add one state variable, one `useEffect` fetch, one nav item entry, one API route, and two badge JSX blocks.

The sidebar (`apps/web/src/components/sidebar.tsx`) already implements the Action Required badge with a `pendingCount` state and `useEffect([pathname])` fetch pattern. The new Tutorials badge replicates this pattern exactly, using a new `unwatchedCount` state and fetching from a new `/api/tutorials/unwatched-count` route. The `TutorialView` Prisma model (`watched Boolean, userId String, tutorialId String`) already exists in the agent DB, but the count query runs through the **web app's** own Next.js API route using the existing `(authenticated)/api/` route group and its auth pattern.

The key architectural question — agent-side Prisma vs. web-side delegation to api-client — is resolved by the context: the `(authenticated)/api/actions/count/route.ts` delegates to `fetchActionCount(userId)` in `api-client.ts`, which calls the agent at `/actions/count?userId=...`. The new tutorial route should mirror this exact delegation pattern, adding a `fetchTutorialUnwatchedCount(userId)` helper that calls the agent at `/tutorials/unwatched-count?userId=...`.

**Primary recommendation:** Copy the `pendingCount` / `useEffect` / badge pattern from Action Required directly. The only new artifact is the API route and a matching agent endpoint for the count.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Badge style (expanded sidebar):** "New" text pill (blue) — right-aligned, like a product label. Descriptive, distinguishable from Action Required's red count badge.
- **Badge style (collapsed sidebar):** Blue dot — absolute-positioned top-right corner of the icon, matching the collapsed Action Required dot pattern.
- **Badge color:** Blue (not red). Blue = informational "new content available"; red is reserved for Action Required urgency.
- **Badge disappears when:** ALL tutorials are watched (`watched=true` for every tutorial for the user). 16/17 watched still shows the badge.
- **Data fetching approach:** New API route `/api/tutorials/unwatched-count` — mirrors `/api/actions/count` exactly. Returns `{ count: number }`. Re-fetches on every `pathname` change (same `useEffect([pathname])` pattern as Action Required). Badge updates immediately after a user watches the last tutorial and navigates.
- **Nav item position:** Tutorials appears **after Action Required** at the bottom of the nav list. Final order: Deals → Templates → Slide Library → AtlusAI → Action Required → Tutorials.
- **Icon:** `GraduationCap` (Lucide) — clear learning/education icon, distinct from all existing nav icons.

### Claude's Discretion

- Exact blue shade for the badge (use existing Tailwind blue palette — e.g., `bg-blue-500`)
- Badge text size and pill dimensions
- Whether to add an `aria-label` to the badge for accessibility

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BROWSE-01 | Tutorials nav item in sidebar with "New" dot badge indicating unwatched content | Sidebar badge pattern fully documented below; API route pattern confirmed; Prisma `TutorialView.watched` field confirmed |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide-react | already installed | `GraduationCap` icon | All nav icons use Lucide; no new package needed |
| Next.js API routes | already in use | `/api/tutorials/unwatched-count` route | Same file-system routing pattern as `(authenticated)/api/actions/count/route.ts` |
| Prisma | 6.19.x (per STATE.md constraint) | `TutorialView` count query in agent | TutorialView model already exists with `watched` and `userId` fields |
| Tailwind CSS | already in use | Badge styling (`bg-blue-500`, etc.) | All existing badges use Tailwind utility classes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/navigation` `usePathname` | already in use | Triggers badge re-fetch on route change | Already used in sidebar; no new import needed |
| `@supabase/ssr` createClient | already in use | Auth in new API route | Used in `(authenticated)/api/actions/count/route.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent-side count endpoint | Web-side Prisma direct query | Context locks to agent delegation pattern matching actions/count; consistent architecture |
| `useEffect([pathname])` refetch | SWR / React Query | Overkill; existing pattern works; no new packages per project history |

**Installation:**
```bash
# No new packages required. All dependencies already installed.
```

## Architecture Patterns

### Route File Location
The existing `(authenticated)/api/` group handles routes that require auth context. The new route belongs here:

```
apps/web/src/app/(authenticated)/api/
├── actions/count/route.ts        # reference implementation
└── tutorials/unwatched-count/route.ts   # NEW — mirrors actions/count exactly
```

The agent gets a new endpoint at `/tutorials/unwatched-count` (or reuses the existing `/tutorials` GET with a query param — see pattern decision below).

### Pattern 1: Sidebar Badge State (copy from pendingCount)

**What:** `useState` + `useEffect([pathname])` to hold badge count; badge renders inline in the nav item JSX.
**When to use:** Any sidebar nav item that needs a reactive badge tied to navigation changes.

```typescript
// Source: apps/web/src/components/sidebar.tsx (existing pattern)
const [unwatchedCount, setUnwatchedCount] = useState(0);

useEffect(() => {
  fetch("/api/tutorials/unwatched-count")
    .then((res) => res.json())
    .then((data: { count?: number }) => setUnwatchedCount(data.count ?? 0))
    .catch(() => {}); // silent fail
}, [pathname]);
```

### Pattern 2: Nav Item with Dual-mode Badge

**What:** Inline badge rendering inside the `navItems.map()` loop, conditioned on `label === "Tutorials"` and `unwatchedCount > 0`. Separate branches for expanded (text pill) and collapsed (dot).

```typescript
// Source: apps/web/src/components/sidebar.tsx (adapted from Action Required pattern)

// Expanded sidebar — "New" text pill (blue)
{!collapsed && label === "Tutorials" && unwatchedCount > 0 && (
  <span className="ml-auto flex h-5 items-center justify-center rounded-full bg-blue-500 px-2 text-xs font-medium text-white">
    New
  </span>
)}

// Collapsed sidebar — blue dot
{collapsed && label === "Tutorials" && unwatchedCount > 0 && (
  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-500" />
)}
```

### Pattern 3: Next.js API Route (authenticated group)

**What:** Route handler that reads Supabase user, delegates count query to agent via `api-client.ts`.
**When to use:** Any sidebar badge count that needs auth-scoped data.

```typescript
// Source: apps/web/src/app/(authenticated)/api/actions/count/route.ts (reference)
// New file: apps/web/src/app/(authenticated)/api/tutorials/unwatched-count/route.ts

import { fetchTutorialUnwatchedCount } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const count = await fetchTutorialUnwatchedCount(user?.id);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
```

### Pattern 4: Agent Count Endpoint

**What:** Prisma `count()` with `WHERE watched = false AND userId = ?` on the `TutorialView` table. Unlike Action Required which counts rows explicitly, unwatched tutorials also includes tutorials with NO `TutorialView` row for the user (never-started = unwatched).
**Critical:** Must count tutorials with no view row plus tutorials with `watched = false`. Two approaches:

```typescript
// Approach A: Count tutorials not in watched views (recommended — matches CONTEXT intent)
// Source: Prisma docs / existing agent patterns
const totalTutorials = await prisma.tutorial.count();
const watchedCount = await prisma.tutorialView.count({
  where: { userId, watched: true },
});
const unwatchedCount = totalTutorials - watchedCount;

// Approach B: Query TutorialView directly (only counts rows that exist)
// WRONG — misses tutorials user has never opened
const count = await prisma.tutorialView.count({
  where: { userId, watched: false },
});
```

Approach A is correct for the "badge disappears only when ALL tutorials are watched" requirement.

### Pattern 5: api-client.ts Helper Function

**What:** Add `fetchTutorialUnwatchedCount` to `apps/web/src/lib/api-client.ts`.

```typescript
// Source: api-client.ts fetchActionCount pattern (line ~1198)
export async function fetchTutorialUnwatchedCount(userId?: string): Promise<number> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const result = await fetchJSON<{ count: number }>(`/tutorials/unwatched-count${qs}`);
  return result.count;
}
```

### Anti-Patterns to Avoid

- **Fetching full tutorial list in sidebar:** The sidebar should only fetch a count, not the full browse data. Keep it lightweight.
- **Querying TutorialView directly for unwatched count:** Misses tutorials with no view row. Must use `total - watched` approach.
- **Using `bg-red-500` for the tutorial badge:** Red is reserved for Action Required urgency. Use blue per locked decision.
- **Adding GraduationCap to import without the lucide-react named export:** Confirm the icon exists in the installed version before assuming.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Badge count API auth | Custom JWT parsing | Supabase `createClient()` + `getUser()` | Existing pattern handles all edge cases |
| Badge count data | Inline Prisma in web API route | Delegate to agent via `fetchTutorialUnwatchedCount` | Keeps data access in agent layer; mirrors actions/count pattern |
| Icon for Tutorials | Custom SVG | Lucide `GraduationCap` | Already locked decision; already in project's icon library |

**Key insight:** This phase has zero new infrastructure. Every pattern is a direct copy-and-adapt of the Action Required badge system.

## Common Pitfalls

### Pitfall 1: Unwatched Count Under-counts
**What goes wrong:** Counting `TutorialView WHERE watched = false` misses tutorials the user has never opened (no row exists). Badge disappears too early.
**Why it happens:** Natural assumption that a count query on a join table is sufficient.
**How to avoid:** Use `total - watchedCount` approach: `Tutorial.count()` minus `TutorialView.count({ watched: true, userId })`.
**Warning signs:** Badge disappears for a user who has only watched a few tutorials.

### Pitfall 2: Route File in Wrong Directory
**What goes wrong:** Creating the route at `apps/web/src/app/api/tutorials/unwatched-count/route.ts` (top-level `api/`) instead of `apps/web/src/app/(authenticated)/api/tutorials/unwatched-count/route.ts`.
**Why it happens:** Two `api/` directories exist; the top-level one lacks Supabase auth context from the authenticated layout.
**How to avoid:** Always place auth-required routes under `(authenticated)/api/`. Confirmed by the `actions/count` reference at `(authenticated)/api/actions/count/route.ts`.
**Warning signs:** `user` is null on every request; badges never show.

### Pitfall 3: Sidebar Fetch Uses Wrong URL
**What goes wrong:** `fetch("/api/tutorials/unwatched-count")` — but the route is under `(authenticated)/api/`, which in Next.js resolves to `/api/tutorials/unwatched-count` (the route group `(authenticated)` is transparent to URLs).
**Why it happens:** Route group directories with parentheses are URL-invisible in Next.js. The URL path omits the group name.
**How to avoid:** Use `/api/tutorials/unwatched-count` as the fetch URL — same pattern as `/api/actions/count`.
**Warning signs:** 404 on the fetch.

### Pitfall 4: GraduationCap Not in Current Lucide Version
**What goes wrong:** Import fails at build time if `GraduationCap` wasn't added until a later lucide-react version.
**Why it happens:** Lucide adds new icons across versions.
**How to avoid:** Verify icon exists by checking the `node_modules/lucide-react` exports or use `grep -r "GraduationCap" node_modules/lucide-react/dist` before coding.
**Warning signs:** TypeScript error on import.

### Pitfall 5: Sidebar Test File Not Updated
**What goes wrong:** Existing sidebar tests (`sidebar.test.tsx`) still only mock a single `fetch` returning `{ count }`, breaking when the sidebar now makes two fetch calls.
**Why it happens:** The test mocks `globalThis.fetch` globally — a second fetch for unwatched count runs on the same mock.
**How to avoid:** Update mock to handle both `/api/actions/count` and `/api/tutorials/unwatched-count` by inspecting the URL argument. New tests for the Tutorials badge should also be added.

## Code Examples

Verified patterns from actual codebase files:

### Existing pendingCount Pattern (exact code to copy)
```typescript
// Source: apps/web/src/components/sidebar.tsx lines 40-47
const [pendingCount, setPendingCount] = useState(0);

useEffect(() => {
  fetch("/api/actions/count")
    .then((res) => res.json())
    .then((data: { count?: number }) => setPendingCount(data.count ?? 0))
    .catch(() => {}); // silent fail
}, [pathname]);
```

### Existing Expanded Badge (exact code to adapt)
```typescript
// Source: apps/web/src/components/sidebar.tsx lines 98-104
{!collapsed && label === "Action Required" && pendingCount > 0 && (
  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
    {pendingCount}
  </span>
)}
```

### Existing Collapsed Dot Badge (exact code to adapt)
```typescript
// Source: apps/web/src/components/sidebar.tsx lines 105-109
{collapsed && label === "Action Required" && pendingCount > 0 && (
  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
)}
```

### Existing Actions Count Route (exact file to mirror)
```typescript
// Source: apps/web/src/app/(authenticated)/api/actions/count/route.ts
import { fetchActionCount } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const count = await fetchActionCount(user?.id);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
```

### Existing api-client fetchActionCount (exact function to copy/adapt)
```typescript
// Source: apps/web/src/lib/api-client.ts lines ~1198-1202
export async function fetchActionCount(userId?: string): Promise<number> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const result = await fetchJSON<{ count: number }>(`/actions/count${qs}`);
  return result.count;
}
```

### Agent actions/count Handler (pattern for new agent endpoint)
```typescript
// Source: apps/agent/src/mastra/index.ts lines 2544-2554
registerApiRoute("/actions/count", {
  method: "GET",
  handler: async (c) => {
    const userId = c.req.query("userId");
    const where: Record<string, unknown> = { resolved: false, silenced: false };
    if (userId) where.userId = userId;
    const count = await prisma.actionRequired.count({ where });
    return c.json({ count });
  },
}),
```

### navItems Array (exact location for new entry)
```typescript
// Source: apps/web/src/components/sidebar.tsx lines 28-34
const navItems = [
  { href: "/deals", label: "Deals", icon: Briefcase },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/slides", label: "Slide Library", icon: Layers },
  { href: "/discovery", label: "AtlusAI", icon: Brain },
  { href: "/actions", label: "Action Required", icon: AlertTriangle },
  // ADD: { href: "/tutorials", label: "Tutorials", icon: GraduationCap },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | Sidebar badge pattern fully established via Action Required | Phase prior to v1.10 | No migration needed — just extend |

**No deprecated patterns apply to this phase.**

## Open Questions

1. **GraduationCap availability in installed lucide-react**
   - What we know: The icon is named `GraduationCap` in recent lucide-react versions
   - What's unclear: The exact installed version — needs a quick check during implementation (`grep -r "GraduationCap" node_modules/lucide-react/dist/index.js`)
   - Recommendation: Verify in Wave 0 task; fallback icon `BookOpen` if not found

2. **Agent endpoint name: `/tutorials/unwatched-count` vs. using existing `/tutorials` with a query param**
   - What we know: Context locks to `/api/tutorials/unwatched-count` route name for the web API
   - What's unclear: Whether to add a new agent route or extend the existing `GET /tutorials` with `?countOnly=true`
   - Recommendation: New dedicated agent route `/tutorials/unwatched-count` — matches the action/count precedent, avoids modifying stable Phase 72/73 logic

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx` |
| Full suite command | `pnpm --filter web test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BROWSE-01 | Tutorials nav item appears in sidebar | unit | `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx` | ✅ (extend existing) |
| BROWSE-01 | "New" text pill appears in expanded sidebar when unwatchedCount > 0 | unit | same | ✅ (extend existing) |
| BROWSE-01 | Blue dot appears in collapsed sidebar when unwatchedCount > 0 | unit | same | ✅ (extend existing) |
| BROWSE-01 | Badge hidden when unwatchedCount === 0 | unit | same | ✅ (extend existing) |
| BROWSE-01 | Sidebar fetches `/api/tutorials/unwatched-count` on mount | unit | same | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx`
- **Per wave merge:** `pnpm --filter web test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/mastra/__tests__/tutorial-unwatched-count-route.test.ts` — covers the new agent count endpoint (optional but consistent with Phase 72/73 agent test pattern)

The existing `sidebar.test.tsx` already tests the fetch mock pattern — it must be **updated** to handle dual fetch calls (actions/count + tutorials/unwatched-count). No new file needed for sidebar tests, only new `describe` blocks appended to the existing file.

## Sources

### Primary (HIGH confidence)
- Direct file read: `apps/web/src/components/sidebar.tsx` — exact implementation of existing badge pattern
- Direct file read: `apps/web/src/app/(authenticated)/api/actions/count/route.ts` — exact route pattern to mirror
- Direct file read: `apps/agent/src/mastra/index.ts` lines 2544-2554 — exact agent endpoint pattern
- Direct file read: `apps/agent/prisma/schema.prisma` — `TutorialView` model confirmed with `watched Boolean`, `userId String`, `tutorialId String`
- Direct file read: `apps/web/src/components/__tests__/sidebar.test.tsx` — existing test patterns for badge behavior
- Direct file read: `apps/web/src/lib/api-client.ts` — `fetchActionCount` as template for new `fetchTutorialUnwatchedCount`
- Direct file read: `.planning/phases/75-sidebar-integration/75-CONTEXT.md` — all implementation decisions locked

### Secondary (MEDIUM confidence)
- None required — all critical patterns verified from source files

### Tertiary (LOW confidence)
- GraduationCap icon existence in installed lucide-react version — verify during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from actual source files; no new packages
- Architecture: HIGH — direct copy of established Action Required badge pattern; all files read
- Pitfalls: HIGH — derived from actual code inspection, not speculation

**Research date:** 2026-03-20
**Valid until:** Stable — this is a low-churn codebase area; valid until sidebar.tsx is significantly refactored
