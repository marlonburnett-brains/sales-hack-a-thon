# Phase 41: Deal Pipeline Page - Research

**Researched:** 2026-03-08
**Domain:** Next.js 15 / React 19 deal pipeline UI with Prisma schema evolution
**Confidence:** HIGH

## Summary

Phase 41 adds deal lifecycle management to the existing deals page: status tracking (Open/Won/Lost/Abandoned), dual view toggle (card grid vs. table), assignment (owner + collaborators), and filtering by status and assignee. The existing codebase already has a working DealDashboard with DealCard, server actions, API routes, and a Prisma Deal model -- this phase extends all of those.

The schema evolution is straightforward: add `status`, `ownerId`, and `collaborators` fields to the Deal model via a Prisma migration. The UI work extends existing patterns (TemplateFilters pill buttons, TemplateTable sortable table) and adds new components (stacked avatars, view toggle, assignee picker). All filter state persists via URL query params for shareability.

**Primary recommendation:** Extend the existing Deal model with 3 new fields via migration, add 3 new agent API endpoints (PATCH status, PATCH assignment, GET filtered listing with query params), and build the UI as progressive enhancement on top of existing DealDashboard/DealCard components.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Statuses: Open, Won, Lost, Abandoned
- Terminal statuses (Won, Lost, Abandoned) require a confirmation dialog before applying
- All transitions are fully reversible -- any status can change to any other status
- Status changes persist immediately after confirmation (or immediately for Open transitions)
- Default view is card grid (existing DealDashboard pattern)
- Users can toggle between card grid and list/table view
- View preference should persist (URL or local storage)
- Hybrid user picker for both owner and collaborators: dropdown populated from known users (Supabase Auth users who have logged in) + freeform entry for @lumenalta.com email addresses not yet in the system
- Collaborators use multi-select with the same hybrid picker
- Stacked avatar circles (like GitHub PR reviewers) on deal cards for owner + collaborators
- "Assigned to me" matches deals where current user is owner OR collaborator
- Can also filter by specific team member or show all deals
- Status filter: horizontal pill toggle buttons -- Open (active by default), Won, Lost, Abandoned, All
- One status active at a time (single-select pills)
- Deal count badge showing number of matching deals
- All filters persist in URL query params (?status=open&assignee=me) -- shareable, survives refresh

### Claude's Discretion
- Status badge visual treatment (color-coded pill vs icon+text)
- Status change trigger mechanism (inline dropdown on card vs action menu)
- Card information density in grid view (what fields beyond company, name, status, avatars)
- Table/list view column set and whether columns are sortable
- View toggle placement (page header vs inline with filters)
- Assignee filter layout (dropdown next to pills vs separate row)
- Empty state design for filtered results with no matches
- Loading skeleton design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEAL-01 | User can see deal status (Open, Won, Lost, Abandoned) on the deals page | Schema migration adds `status` field with default "open"; DealCard extended with color-coded status badge |
| DEAL-02 | User can change a deal's status through its lifecycle | New PATCH /deals/:id/status endpoint; confirmation dialog for terminal statuses; inline dropdown or action menu on card |
| DEAL-03 | User can toggle between card grid view and list/table view | View toggle component; DealDashboard conditional render; view pref in URL param or localStorage |
| DEAL-04 | Deals page defaults to showing Open deals with ability to filter by other statuses | Single-select status pill bar (adapting TemplateFilters); GET /deals with ?status= query param; server-side filtering |
| DEAL-05 | User can assign a primary owner to a deal | Schema adds `ownerId` field; hybrid user picker component; PATCH /deals/:id/assignment endpoint |
| DEAL-06 | User can add collaborators/secondary assignees to a deal | Schema adds `collaborators` JSON field; multi-select hybrid picker; stacked avatar display |
| DEAL-07 | User can filter deals by "Assigned to me," a specific team member, or all | Assignee filter dropdown; ?assignee= URL param; server-side WHERE clause on ownerId/collaborators |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x | App Router, Server Components, server actions | Already in use |
| React | 19.x | UI framework | Already in use |
| Prisma | 6.3.x (stay on 6.19.x max) | ORM, migrations | Already in use; v7 has vector regression |
| Tailwind CSS | 3.4.x | Styling | Already in use |
| shadcn/ui | latest | UI primitives (Badge, Dialog, Select, Tabs, Avatar, Popover) | Already in use |
| Lucide React | latest | Icons | Already in use |
| sonner | 2.x | Toast notifications | Already in use |
| date-fns | 4.x | Date formatting | Already in use |

### Supporting (may need install)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Avatar | -- | Stacked avatar circles | Install via `npx shadcn@latest add avatar` if not present (already present in ui/) |
| shadcn/ui Popover | -- | Hybrid user picker combobox | Already present in ui/ |
| shadcn/ui DropdownMenu | -- | Status change action menu, assignee picker | Already present in ui/ |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| URL params for filter state | zustand/jotai | URL params are shareable, survive refresh, already pattern in project -- no external state needed |
| JSON collaborators field | Many-to-many join table | Only ~20 sellers; JSON array of {id, email, name} is simpler, no join table overhead; querying via Prisma `string_contains` is adequate |

**Installation:**
No new packages needed. All shadcn/ui primitives (Avatar, Badge, Dialog, Select, Popover, DropdownMenu) already exist in `apps/web/src/components/ui/`.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── app/(authenticated)/deals/
│   └── page.tsx                    # Server component: fetch filtered deals, render page shell
├── components/deals/
│   ├── deal-dashboard.tsx          # EXTEND: conditional grid vs table render
│   ├── deal-card.tsx               # EXTEND: status badge, stacked avatars, status action
│   ├── deal-table.tsx              # NEW: table view (adapting TemplateTable pattern)
│   ├── deal-status-filter.tsx      # NEW: single-select pill bar
│   ├── deal-assignee-filter.tsx    # NEW: assignee filter dropdown
│   ├── deal-view-toggle.tsx        # NEW: grid/table toggle buttons
│   ├── deal-status-action.tsx      # NEW: status change dropdown + confirmation dialog
│   ├── deal-assignment-picker.tsx  # NEW: hybrid user picker (owner + collaborators)
│   ├── stacked-avatars.tsx         # NEW: overlapping avatar circles with +N
│   └── create-deal-dialog.tsx      # EXTEND: add owner/collaborator fields
├── lib/
│   ├── actions/deal-actions.ts     # EXTEND: new server actions for status, assignment, filtered list
│   └── api-client.ts               # EXTEND: new API functions
apps/agent/
├── prisma/
│   └── schema.prisma               # EXTEND: Deal model + migration
├── src/mastra/
│   └── index.ts                    # EXTEND: new API routes
```

### Pattern 1: Server-Side Filtering with URL Params
**What:** Deals page reads filter params from URL on server, passes filtered data to client components
**When to use:** All list pages with filters that should be shareable/bookmarkable
**Example:**
```typescript
// apps/web/src/app/(authenticated)/deals/page.tsx
export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignee?: string; view?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "open";
  const assignee = params.assignee || "all";
  const view = params.view || "grid";

  const deals = await listDealsFilteredAction({ status, assignee });

  return (
    <div className="space-y-6">
      {/* Filter bar + view toggle */}
      <DealFilters currentStatus={status} currentAssignee={assignee} currentView={view} dealCount={deals.length} />
      {/* Conditional view */}
      {view === "grid" ? <DealDashboard deals={deals} /> : <DealTable deals={deals} />}
    </div>
  );
}
```

### Pattern 2: Client-Side Filter Navigation (URL push)
**What:** Filter components use `useRouter().push()` or `useSearchParams` to update URL without full page reload
**When to use:** Interactive filter pills that feel instant but persist state in URL
**Example:**
```typescript
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function DealStatusFilter({ currentStatus }: { currentStatus: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStatus(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    router.push(`${pathname}?${params.toString()}`);
  }
  // ...render pills
}
```

### Pattern 3: Confirmation Dialog for Terminal Status
**What:** AlertDialog wraps destructive/terminal status changes (Won, Lost, Abandoned)
**When to use:** Any status transition to a terminal state
**Example:**
```typescript
// Reuse the AlertDialog pattern from TemplateTable
<AlertDialog open={!!confirmTarget} onOpenChange={(v) => !v && setConfirmTarget(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Change status to {confirmTarget?.status}?</AlertDialogTitle>
      <AlertDialogDescription>
        This marks the deal as {confirmTarget?.status}. You can change it back later.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleStatusChange}>Confirm</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Pattern 4: Stacked Avatars
**What:** Overlapping circular avatars showing owner + collaborators, with +N overflow
**When to use:** Deal cards and table rows
**Example:**
```typescript
function StackedAvatars({ people, max = 3 }: { people: { name: string; email: string }[]; max?: number }) {
  const visible = people.slice(0, max);
  const overflow = people.length - max;

  return (
    <div className="flex -space-x-2">
      {visible.map((person, i) => (
        <Avatar key={i} className="h-7 w-7 border-2 border-white" title={person.name || person.email}>
          <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
            {getInitials(person.name || person.email)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-600">
          +{overflow}
        </div>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Client-side filtering of all deals:** Always filter server-side via the API. Even with ~20 sellers the pattern should be correct for when data grows.
- **Storing filter state in React state only:** Use URL params so filters survive refresh and are shareable.
- **Using `prisma db push` for schema changes:** NEVER. Always `prisma migrate dev --name <name>`.
- **Building a full user management system:** The ~20-seller scale means we query UserGoogleToken for known users and allow freeform email entry for unknowns. No user profiles table needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirmation dialogs | Custom modal | shadcn/ui AlertDialog | Already used in TemplateTable; handles focus trap, escape, overlay |
| Avatar with fallback | Custom circle div | shadcn/ui Avatar + AvatarFallback | Handles image loading states, fallback initials |
| Dropdown menus | Custom positioned div | shadcn/ui DropdownMenu | Handles positioning, keyboard nav, focus management |
| Pill toggle buttons | Custom button group | Adapt TemplateFilters pattern | Already proven in project, consistent styling |
| Toast feedback | Custom notification | sonner toast() | Already used throughout project |
| Date formatting | Manual date strings | date-fns formatDistanceToNow | Already used in TemplateTable |

**Key insight:** Every UI primitive needed already exists in the project's shadcn/ui installation. The only new components are compositions of existing primitives.

## Common Pitfalls

### Pitfall 1: Prisma Migration vs DB Push
**What goes wrong:** Using `prisma db push` instead of `prisma migrate dev`
**Why it happens:** Push is faster for prototyping
**How to avoid:** CLAUDE.md explicitly prohibits this. All schema changes MUST use `prisma migrate dev --name <descriptive-name>`
**Warning signs:** No migration file in `prisma/migrations/` for schema changes

### Pitfall 2: Next.js 15 searchParams is a Promise
**What goes wrong:** Accessing `searchParams.status` directly throws because searchParams is now a Promise in Next.js 15
**Why it happens:** Breaking change in Next.js 15 -- searchParams must be awaited in server components
**How to avoid:** Always `const params = await searchParams;` before accessing properties
**Warning signs:** Runtime error about accessing properties of a Promise

### Pitfall 3: Collaborators JSON Field Querying
**What goes wrong:** Using Prisma's JSON filtering for collaborator matching fails or is slow
**Why it happens:** PostgreSQL JSON querying through Prisma has limited expressiveness
**How to avoid:** Store collaborators as a JSON string array of objects `[{id, email, name}]`. For "assigned to me" filtering, use Prisma's `contains` on the raw string (matching by userId/email substring) or use `$queryRaw` for proper JSON array containment. For ~20 users with ~100 deals max, even loading all and filtering in JS is acceptable.
**Warning signs:** Complex Prisma JSON queries that don't work as expected

### Pitfall 4: Status Default on Existing Records
**What goes wrong:** Existing deals in the database have NULL status after migration
**Why it happens:** Adding a new column without a default or without backfilling
**How to avoid:** Migration MUST set `DEFAULT 'open'` on the status column. Use `--create-only` to inspect the SQL and verify the DEFAULT clause before applying.
**Warning signs:** Deals page shows no status badge for existing deals

### Pitfall 5: Race Condition on Status Updates
**What goes wrong:** Two users change status simultaneously, last write wins without feedback
**Why it happens:** No optimistic locking
**How to avoid:** For ~20 sellers this is extremely unlikely. Use `updatedAt` in the response and show toast feedback. No need for optimistic locking at this scale.
**Warning signs:** User changes status but sees stale state on refresh

### Pitfall 6: View Toggle Causes Full Page Reload
**What goes wrong:** Switching between grid and table view triggers a server roundtrip
**Why it happens:** View mode stored in URL params causes Next.js to re-render the server component
**How to avoid:** Store view preference in localStorage AND URL. The client component reads localStorage first for instant switching; URL param is for shareability. Alternatively, make view switching purely client-side (both components rendered, one hidden) if data is already loaded.
**Warning signs:** Visible loading state when toggling views

## Code Examples

### Schema Migration (Deal model extension)
```prisma
// In schema.prisma -- Deal model additions
model Deal {
  id               String              @id @default(cuid())
  companyId        String
  company          Company             @relation(fields: [companyId], references: [id])
  name             String
  status           String              @default("open")  // "open" | "won" | "lost" | "abandoned"
  ownerId          String?             // Supabase user ID or email
  ownerEmail       String?             // Display email
  ownerName        String?             // Display name
  collaborators    String              @default("[]") // JSON: [{id?, email, name?}]
  salespersonName  String?
  salespersonPhoto String?
  driveFolderId    String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  interactions     InteractionRecord[]

  @@index([companyId])
  @@index([status])
  @@index([ownerId])
}
```

### Agent API: Status Update Endpoint
```typescript
// PATCH /deals/:id/status
registerApiRoute("/deals/:id/status", {
  method: "PATCH",
  handler: async (c) => {
    const id = c.req.param("id");
    const { status } = await c.req.json();

    if (!["open", "won", "lost", "abandoned"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: { status },
      include: { company: true },
    });

    return c.json(deal);
  },
});
```

### Agent API: Assignment Update Endpoint
```typescript
// PATCH /deals/:id/assignment
registerApiRoute("/deals/:id/assignment", {
  method: "PATCH",
  handler: async (c) => {
    const id = c.req.param("id");
    const { ownerId, ownerEmail, ownerName, collaborators } = await c.req.json();

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ownerId,
        ownerEmail,
        ownerName,
        collaborators: JSON.stringify(collaborators ?? []),
      },
      include: { company: true },
    });

    return c.json(deal);
  },
});
```

### Agent API: Filtered Deals Listing
```typescript
// GET /deals?status=open&assignee=me&userId=xxx
registerApiRoute("/deals", {
  method: "GET",
  handler: async (c) => {
    const status = c.req.query("status");
    const assignee = c.req.query("assignee");
    const userId = c.req.query("userId");

    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (assignee === "me" && userId) {
      where.OR = [
        { ownerId: userId },
        { collaborators: { contains: userId } },
      ];
    } else if (assignee && assignee !== "all") {
      where.OR = [
        { ownerId: assignee },
        { collaborators: { contains: assignee } },
      ];
    }

    const deals = await prisma.deal.findMany({
      where,
      include: { company: true, interactions: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });

    return c.json(deals);
  },
});
```

### Known Users Endpoint (for Assignment Picker)
```typescript
// GET /users/known -- returns users who have logged in (from UserGoogleToken)
registerApiRoute("/users/known", {
  method: "GET",
  handler: async (c) => {
    const tokens = await prisma.userGoogleToken.findMany({
      where: { isValid: true },
      select: { userId: true, email: true },
      orderBy: { lastUsedAt: "desc" },
    });

    return c.json(tokens.map(t => ({
      id: t.userId,
      email: t.email,
      name: t.email.split("@")[0], // Best we can do without user profiles
    })));
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Next.js 14 `searchParams` as plain object | Next.js 15 `searchParams` is a Promise | Next.js 15 | Must `await searchParams` in server components |
| React 18 `useTransition` for navigation | React 19 + Next.js 15 `router.push` with automatic transitions | React 19 | Navigation feels smoother by default |
| Prisma `db push` for quick iteration | Forward-only migrations always | Project rule | CLAUDE.md mandates `prisma migrate dev` |

**Deprecated/outdated:**
- `searchParams` as synchronous object: Must await in Next.js 15 server components

## Open Questions

1. **User display names**
   - What we know: UserGoogleToken stores `userId` and `email` but not display name
   - What's unclear: Whether to extract name from email (john.smith@lumenalta.com -> John Smith) or add a name field
   - Recommendation: Extract from email for now (split on @, replace dots/hyphens with spaces, title case). A full user profiles table is overkill for ~20 sellers.

2. **Current user identity in server components**
   - What we know: Supabase server client can get current user via `createClient().auth.getUser()`
   - What's unclear: Whether the agent API needs the userId passed from the web app or can derive it
   - Recommendation: Pass userId from the web app's Supabase session as a query param to the agent API for "assigned to me" filtering. The web server action can extract it from the Supabase session.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: schema.prisma, api-client.ts, deal-actions.ts, deal-dashboard.tsx, deal-card.tsx, template-filters.tsx, template-table.tsx, create-deal-dialog.tsx
- Existing codebase: apps/web/src/app/(authenticated)/deals/page.tsx
- Existing codebase: apps/agent/src/mastra/index.ts (agent routes)
- CLAUDE.md: Prisma migration discipline rules

### Secondary (MEDIUM confidence)
- Next.js 15 searchParams Promise change: verified by existing project usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - extending existing proven patterns (TemplateFilters, TemplateTable, DealCard)
- Pitfalls: HIGH - most pitfalls are from direct codebase analysis and project rules
- Schema design: HIGH - straightforward field additions with sensible defaults

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- extending existing patterns)
