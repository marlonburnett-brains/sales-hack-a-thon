# Phase 19: Navigation & Template Management - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can navigate to a Templates section and register, view, and manage Google Slides templates with access awareness. Delivers: collapsible sidebar navigation (replacing top nav), Template model + CRUD, status badges (Ready, No Access, Not Ingested, Stale), and Google Drive access checking. Slide ingestion, preview, and rating are separate phases (20-21).

</domain>

<decisions>
## Implementation Decisions

### Side panel design
- Replace existing top nav bar entirely with a left sidebar
- Sidebar contains: logo at top, section links (Deals, Templates), user avatar/menu at bottom
- Linear/Notion-style aesthetic -- clean, modern
- Collapsible to icon-only rail (~60px) via toggle button
- Default state: expanded on first load
- Collapse state persisted in localStorage
- Mobile: sidebar hidden by default, hamburger menu opens overlay drawer from left

### Template form fields
- Add template via dialog/modal (shadcn Dialog) -- "Add Template" button opens overlay
- Required fields only: Google Slides URL, display name, touch type assignments
- Touch type selection: multi-select chip toggles (Touch 1, Touch 2, Touch 3, Touch 4+) -- at least one required
- No optional metadata fields (description, industry tag) -- slide ingestion extracts everything
- URL format validated inline as user types; Drive access checked on form submit only
- On submit: validate URL format, extract presentation ID, check Drive access, save template

### Template list & status
- Two view modes: card grid and table rows, with a view toggle
- Default view: card grid (persist preference in localStorage)
- Card grid: responsive cards showing template name, touch type chips, status badge, last ingested date, actions menu
- Table view: columns for Name, Touch Types, Status, Last Ingested, Actions
- Status badges: Ready, No Access, Not Ingested, Stale -- visually distinct (shadcn Badge with color variants)
- Filters: by status and by touch type, default unfiltered
- Delete: confirmation dialog ("Delete '[name]'? This will also remove all ingested slides.") before destructive action
- Staleness detection: compare template source file modifiedTime from Drive API against last ingestion timestamp

### Access awareness
- Claude's Discretion: UX for communicating Drive access issues (inline banner vs modal vs toast) and how prominently to show the service account email for sharing

### Claude's Discretion
- Exact sidebar width (expanded and collapsed)
- Animation/transition style for collapse/expand and mobile drawer
- Card grid column count and breakpoints
- Filter component design (dropdown vs chip toggles)
- Empty state design for templates list
- Status badge color scheme
- Staleness threshold logic

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `(authenticated)/layout.tsx`: Current top nav layout -- will be replaced by sidebar layout
- `user-nav.tsx`: User avatar dropdown menu -- reuse in sidebar bottom section
- shadcn/ui components: Dialog, Form, Input, Badge, Button, Card, Dropdown Menu, Select, Skeleton
- Lucide icons: Already used for nav icons (Briefcase) -- extend with template/slides icons

### Established Patterns
- Route group `(authenticated)` for protected pages with auth check + redirect
- Server Components for layout with `createClient()` Supabase auth check
- Client Components (`"use client"`) for interactive elements (UserNav)
- Prisma + Supabase PostgreSQL with forward-only migrations (no db push, no reset)
- Server Actions for form submissions and mutations
- Sonner toast for notifications

### Integration Points
- `(authenticated)/layout.tsx`: Replace with sidebar layout component
- `apps/web/src/app/(authenticated)/templates/`: New route directory for templates pages
- `apps/agent/prisma/schema.prisma`: New Template model (no template model exists yet -- only SlideEmbedding)
- `apps/web/src/app/(authenticated)/api/`: Server-side API routes for Drive access checking
- Google Drive API: Check file access + get modifiedTime for staleness

</code_context>

<specifics>
## Specific Ideas

- Sidebar should feel like Linear or Notion -- clean, not cluttered
- Card grid as the default view gives a more modern feel; table toggle for power users who want density
- Touch type chips should be visually distinct toggles, not hidden in a dropdown

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 19-navigation-template-management*
*Context gathered: 2026-03-05*
