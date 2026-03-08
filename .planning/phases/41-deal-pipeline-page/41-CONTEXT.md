# Phase 41: Deal Pipeline Page - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage their deal pipeline with status tracking (Open/Won/Lost/Abandoned), toggle between card grid and list/table views, filter by status and assignee, and assign owners and collaborators to deals. This phase covers the deals list page — deal detail navigation and sub-pages are Phase 42.

</domain>

<decisions>
## Implementation Decisions

### Status lifecycle
- Statuses: Open, Won, Lost, Abandoned
- Terminal statuses (Won, Lost, Abandoned) require a confirmation dialog before applying
- All transitions are fully reversible — any status can change to any other status
- Status changes persist immediately after confirmation (or immediately for Open transitions)

### View toggle
- Default view is card grid (existing DealDashboard pattern)
- Users can toggle between card grid and list/table view
- View preference should persist (URL or local storage)

### Assignment model
- Hybrid user picker for both owner and collaborators:
  - Dropdown populated from known users (Supabase Auth users who have logged in)
  - Freeform entry for @lumenalta.com email addresses not yet in the system
- Collaborators use multi-select with the same hybrid picker
- Stacked avatar circles (like GitHub PR reviewers) on deal cards for owner + collaborators

### Assignee filtering
- "Assigned to me" matches deals where current user is owner OR collaborator
- Can also filter by specific team member or show all deals

### Filter bar
- Status filter: horizontal pill toggle buttons — Open (active by default), Won, Lost, Abandoned, All
- One status active at a time (single-select pills)
- Deal count badge showing number of matching deals
- All filters persist in URL query params (?status=open&assignee=me) — shareable, survives refresh

### Claude's Discretion
- Status badge visual treatment (color-coded pill vs icon+text)
- Status change trigger mechanism (inline dropdown on card vs action menu)
- Card information density in grid view (what fields beyond company, name, status, avatars)
- Table/list view column set and whether columns are sortable
- View toggle placement (page header vs inline with filters)
- Assignee filter layout (dropdown next to pills vs separate row)
- Empty state design for filtered results with no matches
- Loading skeleton design

</decisions>

<specifics>
## Specific Ideas

- ~20 sellers using the app — lightweight assignment model is fine, no need for heavy team management
- Stacked avatars should follow the GitHub PR reviewer pattern (overlapping circles with +N overflow)
- Status pills should match the existing TemplateFilters pattern for visual consistency
- Deal count gives users pipeline-at-a-glance context without needing analytics (analytics deferred to v2)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/deals/deal-dashboard.tsx`: Existing grid layout with empty state — extend with status badge, avatars, and filter integration
- `apps/web/src/components/deals/deal-card.tsx`: Card showing company, deal name, touch indicators, last activity — extend with status badge and stacked avatars
- `apps/web/src/components/deals/create-deal-dialog.tsx`: Dialog pattern for deal creation — extend with owner/collaborator fields
- `apps/web/src/components/template-filters.tsx`: Multi-select pill button filter pattern — adapt for single-select status pills
- `apps/web/src/components/template-table.tsx`: Table with sorting and actions — adapt for deal list view
- `apps/web/src/components/ui/badge.tsx`, `tabs.tsx`, `select.tsx`, `dialog.tsx`: shadcn/ui primitives ready to use

### Established Patterns
- Server actions in `apps/web/src/lib/actions/deal-actions.ts` for API calls
- API client in `apps/web/src/lib/api-client.ts` with typed fetchJSON wrapper
- Agent routes in `apps/agent/src/mastra/index.ts` for backend endpoints
- `dynamic = "force-dynamic"` on deal pages to avoid caching
- Toast notifications via `sonner` for user feedback

### Integration Points
- Prisma schema (`apps/agent/prisma/schema.prisma`): Deal model needs `status`, `ownerId`, `collaboratorIds` fields + migration
- Agent API routes: New endpoints for status update, assignment update, filtered listing
- `apps/web/src/lib/api-client.ts`: New functions for status/assignment mutations and filtered queries
- `apps/web/src/app/(authenticated)/deals/page.tsx`: Entry point for filter bar, view toggle, enhanced listing
- Supabase Auth: Query for known users list to populate assignment picker

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 41-deal-pipeline-page*
*Context gathered: 2026-03-08*
