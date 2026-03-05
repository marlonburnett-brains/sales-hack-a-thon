# Phase 19: Navigation & Template Management - Research

**Researched:** 2026-03-05
**Domain:** Next.js App Router layout refactoring, Prisma model creation, Google Drive API integration
**Confidence:** HIGH

## Summary

Phase 19 replaces the existing top navigation bar with a collapsible left sidebar (Linear/Notion style) and adds a complete template management system. The web app uses Next.js 15 with App Router, shadcn/ui components, Tailwind CSS, and communicates with a Mastra-based agent service via REST. Template CRUD follows the established pattern: server actions in the web app call the agent API, which uses Prisma for persistence and Google Drive API for access checking.

The Template model does not exist in the schema yet (only `SlideEmbedding` references `templateId` as a plain string). A new Prisma migration is required. Google Drive access checking and staleness detection use the existing `googleapis` package in the agent app via `getDriveClient()`. The service account email for sharing instructions is extracted from the `GOOGLE_SERVICE_ACCOUNT_KEY` JSON credential.

**Primary recommendation:** Build the sidebar as a client component in the authenticated layout, create the Template model via forward-only Prisma migration, add template CRUD API routes to the agent's Mastra server, and proxy all mutations through server actions in the web app -- following the exact patterns already established for Deals.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace existing top nav bar entirely with a left sidebar
- Sidebar contains: logo at top, section links (Deals, Templates), user avatar/menu at bottom
- Linear/Notion-style aesthetic -- clean, modern
- Collapsible to icon-only rail (~60px) via toggle button
- Default state: expanded on first load
- Collapse state persisted in localStorage
- Mobile: sidebar hidden by default, hamburger menu opens overlay drawer from left
- Add template via dialog/modal (shadcn Dialog) -- "Add Template" button opens overlay
- Required fields only: Google Slides URL, display name, touch type assignments
- Touch type selection: multi-select chip toggles (Touch 1, Touch 2, Touch 3, Touch 4+) -- at least one required
- URL format validated inline as user types; Drive access checked on form submit only
- On submit: validate URL format, extract presentation ID, check Drive access, save template
- Two view modes: card grid and table rows, with a view toggle
- Default view: card grid (persist preference in localStorage)
- Status badges: Ready, No Access, Not Ingested, Stale -- visually distinct (shadcn Badge with color variants)
- Filters: by status and by touch type, default unfiltered
- Delete: confirmation dialog before destructive action
- Staleness detection: compare template source file modifiedTime from Drive API against last ingestion timestamp

### Claude's Discretion
- Exact sidebar width (expanded and collapsed)
- Animation/transition style for collapse/expand and mobile drawer
- Card grid column count and breakpoints
- Filter component design (dropdown vs chip toggles)
- Empty state design for templates list
- Status badge color scheme
- Staleness threshold logic
- UX for communicating Drive access issues (inline banner vs modal vs toast) and how prominently to show the service account email for sharing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | User can navigate between Deals and Templates via a persistent side panel | Sidebar layout component replaces top nav in `(authenticated)/layout.tsx` |
| NAV-02 | Side panel is collapsible and preserves all existing authenticated routes | Client component with localStorage state; no route changes needed since layout wraps all `(authenticated)` children |
| TMPL-01 | User can add a Google Slides template by pasting a URL with display name and touch type assignment | shadcn Dialog form with Zod validation, server action calling agent API |
| TMPL-02 | User can view a list of all registered templates with status badges | Templates page with card grid + table view, Badge component with color variants |
| TMPL-03 | User can delete a registered template | Confirmation Dialog + DELETE API route + server action |
| TMPL-04 | User can assign multiple touch types to each template | Multi-select chip toggle component, stored as JSON array in Template model |
| TMPL-05 | System validates Google Slides URL format and extracts presentation ID on add | Regex extraction on client, verified on server; pattern: `/presentation/d/([a-zA-Z0-9_-]+)` |
| TMPL-06 | System checks file access on add and flags inaccessible files with service account email | Agent API calls `drive.files.get()`, extracts `client_email` from service account JSON |
| TMPL-07 | System detects when template source file has been modified since last ingestion and shows staleness badge | Agent API calls `drive.files.get({ fields: 'modifiedTime' })`, compares against `lastIngestedAt` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x | App Router, Server Components, Server Actions | Already in use |
| shadcn/ui | latest | Dialog, Badge, Card, Button, Form, DropdownMenu, Skeleton | Already installed; consistent with existing UI |
| Tailwind CSS | 3.4.x | Styling, responsive design, animations | Already configured with CSS variables |
| react-hook-form | 7.71.x | Form state management | Already in use for deal creation |
| zod | 4.3.x | Schema validation | Already in use for form + API validation |
| Prisma | 6.19.x | ORM for Template model | Already in use; MUST stay on 6.19.x (vector regression in 7.x) |
| googleapis | 144.x | Drive API for access check + staleness | Already in agent app |
| lucide-react | 0.576.x | Icons for sidebar nav + template UI | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.x | Toast notifications | Success/error feedback on template operations |
| tailwindcss-animate | 1.0.x | Sidebar transition animations | Already installed |
| class-variance-authority | 0.7.x | Badge variant styling | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage for sidebar state | Cookie/server state | localStorage is simpler, no SSR hydration flash concern since sidebar is client component |
| Custom chip toggles | @radix-ui/react-toggle-group | Toggle group is more accessible but chips are more visually aligned with Linear aesthetic |

**Installation:**
No new packages needed. Everything is already installed.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── app/(authenticated)/
│   ├── layout.tsx              # REPLACE: sidebar layout (Server Component shell + Client sidebar)
│   ├── deals/                  # Existing -- no changes
│   └── templates/
│       └── page.tsx            # Templates list page (Server Component)
├── components/
│   ├── sidebar.tsx             # NEW: collapsible sidebar (Client Component)
│   ├── user-nav.tsx            # Existing -- reuse in sidebar bottom
│   ├── template-card.tsx       # NEW: template card for grid view
│   ├── template-table.tsx      # NEW: template table for list view
│   ├── template-form.tsx       # NEW: add template dialog form
│   └── template-filters.tsx    # NEW: status + touch type filter bar
├── lib/
│   ├── actions/
│   │   └── template-actions.ts # NEW: server actions for template CRUD
│   └── api-client.ts           # EXTEND: add template API functions

apps/agent/
├── prisma/
│   └── schema.prisma           # EXTEND: add Template model
│   └── migrations/             # NEW: add_template_model migration
└── src/
    └── mastra/
        └── index.ts            # EXTEND: add template CRUD + Drive check routes
```

### Pattern 1: Server Action -> Agent API (Established)
**What:** Web app server actions call the agent REST API; agent handles Prisma + external APIs
**When to use:** All mutations and data fetching
**Example:**
```typescript
// apps/web/src/lib/actions/template-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { createTemplate, listTemplates, deleteTemplate } from "@/lib/api-client";

export async function createTemplateAction(formData: {
  name: string;
  googleSlidesUrl: string;
  touchTypes: string[];
}) {
  const template = await createTemplate(formData);
  revalidatePath("/templates");
  return template;
}
```

### Pattern 2: Collapsible Sidebar with localStorage Persistence
**What:** Client component sidebar that reads/writes collapse state to localStorage
**When to use:** The authenticated layout
**Example:**
```typescript
// apps/web/src/components/sidebar.tsx
"use client";
import { useState, useEffect } from "react";
import { Briefcase, LayoutTemplate, PanelLeftClose, PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const SIDEBAR_KEY = "sidebar-collapsed";

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_KEY, String(next));
  };

  return (
    <div className="flex h-screen">
      <aside className={`flex flex-col border-r bg-white transition-all duration-200
        ${collapsed ? "w-[60px]" : "w-[240px]"}`}>
        {/* Logo */}
        {/* Nav links */}
        {/* Toggle button */}
        {/* User nav at bottom */}
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

### Pattern 3: Google Slides URL Validation + Presentation ID Extraction
**What:** Regex to validate Google Slides URLs and extract the presentation ID
**When to use:** Template add form (client-side inline validation + server-side verification)
**Example:**
```typescript
// Shared validation (can go in @lumenalta/schemas or inline)
const SLIDES_URL_REGEX = /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;

function extractPresentationId(url: string): string | null {
  const match = url.match(SLIDES_URL_REGEX);
  return match ? match[1] : null;
}

// Zod schema for template form
const templateFormSchema = z.object({
  name: z.string().min(1, "Display name is required"),
  googleSlidesUrl: z.string()
    .url("Must be a valid URL")
    .regex(SLIDES_URL_REGEX, "Must be a Google Slides URL"),
  touchTypes: z.array(z.enum(["touch_1", "touch_2", "touch_3", "touch_4"]))
    .min(1, "Select at least one touch type"),
});
```

### Pattern 4: Drive Access Check via Agent API
**What:** Agent route checks if the service account can access the presentation file
**When to use:** On template form submit, before saving
**Example:**
```typescript
// In agent API route handler
const drive = getDriveClient();
try {
  const file = await drive.files.get({
    fileId: presentationId,
    fields: "id,name,modifiedTime",
    supportsAllDrives: true,
  });
  return { accessible: true, modifiedTime: file.data.modifiedTime };
} catch (err: any) {
  if (err.code === 404 || err.code === 403) {
    // Extract service account email from credentials
    const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    return {
      accessible: false,
      serviceAccountEmail: creds.client_email,
      error: "File not shared with service account",
    };
  }
  throw err;
}
```

### Anti-Patterns to Avoid
- **Calling Google APIs from the web app:** The web app has NO Google credentials. All Drive/Slides API calls go through the agent service.
- **Using `prisma db push`:** CLAUDE.md explicitly forbids this. Always use `prisma migrate dev --name <name>`.
- **Storing touch types as separate columns:** Use a JSON string array column (matches `ContentSource.touchTypes` pattern).
- **Building sidebar as a Server Component:** Collapse state requires client interactivity. Use Client Component with `useEffect` for localStorage hydration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validation logic | zod + react-hook-form + @hookform/resolvers | Already set up, handles async validation |
| Status badges | Custom styled divs | shadcn Badge with cva variants | Consistent with existing UI, accessible |
| Confirmation dialogs | window.confirm() | shadcn AlertDialog | Better UX, consistent styling |
| Toast notifications | Custom notification system | Sonner (already installed) | Already wired up in the app |
| URL parsing | Manual string splitting | Regex with named groups | Edge cases in Google Slides URLs (query params, fragments) |
| Mobile drawer | Custom drawer from scratch | Conditional sidebar rendering with overlay | Simpler than pulling in a drawer library |

**Key insight:** The project already has every UI primitive needed. No new dependencies required -- just compose existing shadcn components.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch on Sidebar Initial State
**What goes wrong:** Server renders expanded sidebar, client reads localStorage and collapses -- flash of wrong layout
**Why it happens:** localStorage is not available during SSR
**How to avoid:** Default to expanded (matching server render), then update via `useEffect` on mount. The brief expanded flash is acceptable and matches "default expanded on first load" requirement.
**Warning signs:** Content layout shift on page load

### Pitfall 2: Breaking Existing Routes When Replacing Layout
**What goes wrong:** Removing the top nav and restructuring the layout breaks the `deals` pages or the `api` directory
**Why it happens:** The `(authenticated)/layout.tsx` wraps ALL routes including `deals/` and `api/`
**How to avoid:** Keep the layout change minimal -- replace the `<nav>` + `<main>` with the sidebar wrapper. Ensure `<main>` still has proper padding/scrolling. Test deals pages after change.
**Warning signs:** Deals page content disappearing or overlapping sidebar

### Pitfall 3: Prisma Migration Discipline Violation
**What goes wrong:** Using `db push` or `migrate reset` destroys production-like data
**Why it happens:** Habit from prototyping
**How to avoid:** Always use `prisma migrate dev --name add-template-model`. Use `--create-only` first to inspect SQL. Never reset.
**Warning signs:** Any mention of `db push` or `migrate reset` in commands

### Pitfall 4: Google Drive API 403 vs 404 Confusion
**What goes wrong:** File exists but is not shared -- API returns 404 (not 403) for files the service account cannot see
**Why it happens:** Google Drive API returns 404 for files the caller has no access to (for privacy)
**How to avoid:** Treat both 403 AND 404 as "not accessible" and prompt user to share with service account email
**Warning signs:** Showing "file not found" when the file actually exists but isn't shared

### Pitfall 5: Forgetting supportsAllDrives Flag
**What goes wrong:** Files in shared drives return 404 even when shared
**Why it happens:** Google Drive API requires `supportsAllDrives: true` for shared drive files
**How to avoid:** Always include `supportsAllDrives: true` in Drive API calls (already done in existing codebase)
**Warning signs:** Some templates work, others don't -- correlates with shared vs personal drive

### Pitfall 6: SlideEmbedding.templateId Foreign Key
**What goes wrong:** Creating a Template model without considering the existing `SlideEmbedding.templateId` column
**Why it happens:** `SlideEmbedding` already has a `templateId` string field but no foreign key relation
**How to avoid:** When creating the Template model, add a relation to SlideEmbedding. However, since SlideEmbedding uses `Unsupported("vector(768)")`, Prisma may have issues with migrations. Consider adding the relation in a subsequent phase (Phase 20) when slide ingestion is implemented. For now, keep Template standalone.
**Warning signs:** Migration errors related to SlideEmbedding

## Code Examples

### Template Prisma Model
```prisma
// Add to apps/agent/prisma/schema.prisma
model Template {
  id               String   @id @default(cuid())
  name             String   // Display name
  presentationId   String   @unique // Extracted Google Slides presentation ID
  googleSlidesUrl  String   // Original URL pasted by user
  touchTypes       String   // JSON array: ["touch_1", "touch_2"]
  accessStatus     String   @default("not_checked") // "accessible" | "not_accessible" | "not_checked"
  lastIngestedAt   DateTime? // When slides were last ingested (null = never)
  sourceModifiedAt DateTime? // Drive file modifiedTime at last check
  slideCount       Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([accessStatus])
}
```

### Agent API Routes for Templates
```typescript
// GET /templates -- list all
registerApiRoute("/templates", {
  method: "GET",
  handler: async (c) => {
    const templates = await prisma.template.findMany({
      orderBy: { createdAt: "desc" },
    });
    return c.json(templates);
  },
});

// POST /templates -- create with Drive access check
registerApiRoute("/templates", {
  method: "POST",
  handler: async (c) => {
    const body = await c.req.json();
    const data = z.object({
      name: z.string().min(1),
      googleSlidesUrl: z.string().url(),
      presentationId: z.string().min(1),
      touchTypes: z.array(z.string()).min(1),
    }).parse(body);

    // Check Drive access
    const drive = getDriveClient();
    let accessStatus = "not_accessible";
    let sourceModifiedAt: string | null = null;
    let serviceAccountEmail: string | null = null;

    try {
      const file = await drive.files.get({
        fileId: data.presentationId,
        fields: "id,modifiedTime",
        supportsAllDrives: true,
      });
      accessStatus = "accessible";
      sourceModifiedAt = file.data.modifiedTime ?? null;
    } catch {
      const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
      serviceAccountEmail = creds.client_email;
    }

    const template = await prisma.template.create({
      data: {
        name: data.name,
        googleSlidesUrl: data.googleSlidesUrl,
        presentationId: data.presentationId,
        touchTypes: JSON.stringify(data.touchTypes),
        accessStatus,
        sourceModifiedAt: sourceModifiedAt ? new Date(sourceModifiedAt) : null,
      },
    });

    return c.json({ template, serviceAccountEmail });
  },
});

// DELETE /templates/:id
registerApiRoute("/templates/:id", {
  method: "DELETE",
  handler: async (c) => {
    const id = c.req.param("id");
    await prisma.template.delete({ where: { id } });
    return c.json({ success: true });
  },
});
```

### Staleness Check Endpoint
```typescript
// POST /templates/:id/check-staleness
registerApiRoute("/templates/:id/check-staleness", {
  method: "POST",
  handler: async (c) => {
    const id = c.req.param("id");
    const template = await prisma.template.findUniqueOrThrow({ where: { id } });

    const drive = getDriveClient();
    try {
      const file = await drive.files.get({
        fileId: template.presentationId,
        fields: "modifiedTime",
        supportsAllDrives: true,
      });

      const driveModified = new Date(file.data.modifiedTime!);
      const isStale = template.lastIngestedAt
        ? driveModified > template.lastIngestedAt
        : false; // Never ingested = Not Ingested status, not Stale

      await prisma.template.update({
        where: { id },
        data: {
          accessStatus: "accessible",
          sourceModifiedAt: driveModified,
        },
      });

      return c.json({ isStale, modifiedTime: driveModified });
    } catch {
      await prisma.template.update({
        where: { id },
        data: { accessStatus: "not_accessible" },
      });

      const creds = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
      return c.json({
        isStale: false,
        accessError: true,
        serviceAccountEmail: creds.client_email,
      });
    }
  },
});
```

### Status Badge Logic
```typescript
// Derive status from template data (no separate status column needed)
type TemplateStatus = "ready" | "no_access" | "not_ingested" | "stale";

function getTemplateStatus(template: {
  accessStatus: string;
  lastIngestedAt: string | null;
  sourceModifiedAt: string | null;
}): TemplateStatus {
  if (template.accessStatus === "not_accessible") return "no_access";
  if (!template.lastIngestedAt) return "not_ingested";
  if (template.sourceModifiedAt && template.lastIngestedAt) {
    const modified = new Date(template.sourceModifiedAt);
    const ingested = new Date(template.lastIngestedAt);
    if (modified > ingested) return "stale";
  }
  return "ready";
}

// Badge color mapping
const statusConfig: Record<TemplateStatus, { label: string; variant: string; className: string }> = {
  ready:        { label: "Ready",        variant: "default",     className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  no_access:    { label: "No Access",    variant: "destructive", className: "bg-red-100 text-red-800 border-red-200" },
  not_ingested: { label: "Not Ingested", variant: "secondary",   className: "bg-amber-100 text-amber-800 border-amber-200" },
  stale:        { label: "Stale",        variant: "outline",     className: "bg-orange-100 text-orange-800 border-orange-200" },
};
```

### Sidebar Width Recommendations
```typescript
// Sidebar dimensions (Claude's Discretion)
const SIDEBAR_EXPANDED_WIDTH = 240;  // px -- matches Linear's sidebar
const SIDEBAR_COLLAPSED_WIDTH = 60;  // px -- icon-only rail
const MOBILE_BREAKPOINT = 768;       // px -- md breakpoint in Tailwind

// Animation
// Use CSS transition: `transition-all duration-200 ease-in-out`
// Mobile drawer: translate-x transform with backdrop overlay
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Top nav bar | Collapsible sidebar | This phase | All authenticated pages affected |
| No Template model | Template + CRUD | This phase | New Prisma migration required |
| Hardcoded template IDs (env vars) | Dynamic template registry | This phase | Replaces `GOOGLE_TEMPLATE_PRESENTATION_ID`, `MEET_LUMENALTA_PRESENTATION_ID` env vars over time |

**Note:** The existing `ContentSource` model has overlapping concepts (sourceType, touchTypes, accessStatus) but serves a different purpose (discovery pipeline tracking). The new `Template` model is user-facing and purpose-built for the template management UI. Do NOT reuse ContentSource.

## Open Questions

1. **SlideEmbedding FK relationship**
   - What we know: `SlideEmbedding.templateId` exists as a plain string (no FK)
   - What's unclear: Should we add a formal FK relation in this phase?
   - Recommendation: Do NOT add the FK in this phase. SlideEmbedding uses `Unsupported("vector(768)")` which complicates migrations. Phase 20 (slide ingestion) is the right place to wire this up.

2. **Batch staleness checking**
   - What we know: Templates list needs status badges including staleness
   - What's unclear: Should we check staleness on every page load (N Drive API calls) or lazily?
   - Recommendation: Check staleness lazily -- show cached status on page load, add a "Refresh Status" button that triggers batch check. Avoids rate limiting on large template lists.

3. **Service account email visibility**
   - What we know: When a template is not accessible, user needs the service account email
   - Recommendation: Show an inline alert banner within the template card/row with the email and a "Copy" button. More discoverable than a toast, less disruptive than a modal.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `apps/web/src/app/(authenticated)/layout.tsx` -- current top nav implementation
- Codebase inspection: `apps/agent/src/mastra/index.ts` -- all existing API route patterns
- Codebase inspection: `apps/agent/prisma/schema.prisma` -- current models and patterns
- Codebase inspection: `apps/agent/src/lib/google-auth.ts` -- Drive API client setup
- Codebase inspection: `apps/web/package.json` -- all dependencies confirmed installed
- Codebase inspection: `apps/web/src/lib/api-client.ts` -- web-to-agent communication pattern
- Codebase inspection: `apps/web/src/lib/actions/deal-actions.ts` -- server action pattern

### Secondary (MEDIUM confidence)
- Google Drive API v3 `files.get` behavior for 403/404 responses -- based on established API behavior and existing codebase usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - follows exact patterns from existing Deals feature
- Pitfalls: HIGH - based on codebase inspection and known Google API behaviors
- Prisma migration: HIGH - CLAUDE.md has explicit rules, existing migration patterns in repo

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable stack, no external dependency changes expected)
