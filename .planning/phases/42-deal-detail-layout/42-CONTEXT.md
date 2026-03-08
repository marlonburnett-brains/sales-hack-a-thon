# Phase 42: Deal Detail Layout - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can navigate within a deal through organized sub-pages with a deal-level sidebar. The deal detail view has breadcrumbs for orientation, a nested sidebar for sub-page navigation (Overview, Briefing, Touch 1-4), an Overview page with deal state and activity, and a Briefing page with conversational AI-driven meeting prep. Touch page content and AI chat (CHAT-01 through CHAT-05) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Deal sidebar navigation
- Nested sidebar pattern: global app sidebar stays visible on the left, deal sidebar appears as a narrower column next to it inside the content area (two visible sidebars, CRM-style)
- Navigation order: Overview, Briefing, Touch 1, Touch 2, Touch 3, Touch 4
- Touch items show status indicators: not started (empty), in progress (dot), completed (checkmark) — derived from interaction data
- Deal sidebar is a new component specific to the deal detail layout, separate from the global Sidebar

### Breadcrumb & back navigation
- Breadcrumbs appear above the content area, at the top of the main content panel
- Path format: Deals > Company Name > Current Page (e.g., "Deals > Acme Corp > Overview")
- "Deals" links back to the pipeline list page; company name links to deal overview
- Create a shared reusable Breadcrumb component in ui/ — replace the inline breadcrumb HTML in template slides too
- /deals/[id] redirects to /deals/[id]/overview (overview is the default sub-page)

### Overview page content
- Deal header: company name, deal name, status badge, owner/collaborators with stacked avatars
- Status change action available directly from Overview header (same pattern as pipeline card)
- Assignment editing (owner/collaborators) available from Overview using the hybrid picker from Phase 41
- Key metrics cards: touches completed, days in pipeline, last activity date, etc.
- Activity timeline using existing InteractionTimeline component
- Alert banners for pending brief approval and asset review (moved from current monolithic page)
- Touch flow cards do NOT appear on Overview — they live only on their dedicated touch sub-pages
- Claude has discretion on additional meaningful content, metrics layout, and visual treatment

### Briefing page structure
- Consolidates: pre-call briefings, meeting notes/transcripts, company research data
- Replaces the rigid PreCallForm with a conversational AI-driven meeting prep experience
- Inline chat panel at the top: AI proactively surfaces context about the company, suggests research, discovery questions, and offers to generate full briefings
- AI suggestions include: "Dig deeper on their tech stack", "Suggest discovery questions", "Generate full briefing" — results saved as briefing artifacts
- Previous briefings displayed below the chat panel, newest first, expandable/collapsible

### Claude's Discretion
- Deal sidebar visual treatment (width, styling, collapse behavior on mobile)
- Deal sidebar header content (deal name, status badge, or minimal)
- Briefing page section organization (stacked sections vs timeline vs hybrid)
- Key metrics card selection and visual layout
- Loading skeletons for sub-pages
- Mobile responsive behavior for nested sidebar layout
- Empty states for briefing page when no prior briefings exist

</decisions>

<specifics>
## Specific Ideas

- "Reimagine the pre-call briefing — make it more AI-driven, avoid strict forms, allow conversational input data. Give suggestions of what might be meaningful and what you can do to help the salesperson prepare more for their meeting, as a personal assistant."
- Nested sidebar should feel like a CRM (HubSpot/Salesforce) — familiar to sales users
- Touch status indicators in sidebar give a quick progress glance without opening each page
- Shared Breadcrumb component should be consistent with the existing template slide viewer breadcrumb style

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/sidebar.tsx`: Global sidebar with collapsible behavior — deal sidebar should mirror styling but remain separate
- `apps/web/src/components/deals/deal-card.tsx`: Status badges and stacked avatars already implemented
- `apps/web/src/components/deals/deal-status-action.tsx`: Status change action component — reuse on Overview
- `apps/web/src/components/deals/deal-assignment-picker.tsx`: Hybrid owner/collaborator picker — reuse on Overview
- `apps/web/src/components/deals/stacked-avatars.tsx`: Stacked avatar circles for assignments
- `apps/web/src/components/timeline/interaction-timeline.tsx`: Timeline component — reuse on Overview
- `apps/web/src/components/pre-call/pre-call-section.tsx`: Current pre-call section with form + prior briefings — will be refactored for conversational UX
- `apps/web/src/components/pre-call/pre-call-form.tsx`: Current rigid form — to be replaced by AI chat panel
- `apps/web/src/app/(authenticated)/templates/[id]/slides/page.tsx`: Inline breadcrumb pattern — extract into shared component

### Established Patterns
- Server actions in `apps/web/src/lib/actions/deal-actions.ts` for API calls
- `dynamic = "force-dynamic"` on deal pages
- Next.js App Router nested layouts: deal layout can use `deals/[dealId]/layout.tsx` for sidebar + breadcrumbs
- Toast notifications via `sonner` for user feedback
- shadcn/ui components: Badge, Separator, Alert, Button, etc.

### Integration Points
- `apps/web/src/app/(authenticated)/deals/[dealId]/page.tsx`: Current monolithic page — refactor into layout + redirect to overview
- New route structure: `deals/[dealId]/layout.tsx` (deal sidebar + breadcrumbs), `deals/[dealId]/overview/page.tsx`, `deals/[dealId]/briefing/page.tsx`, `deals/[dealId]/touch/[touchNumber]/page.tsx`
- `apps/web/src/app/(authenticated)/layout.tsx`: Global sidebar wraps everything — deal sidebar nests inside
- Existing sub-routes (`review/[briefId]`, `asset-review/[interactionId]`) need to work within new layout

</code_context>

<deferred>
## Deferred Ideas

- AI chat bar persistent across all deal sub-pages (CHAT-01 through CHAT-05) — Phase 45/46
- Touch page HITL workflows (TOUCH-01 through TOUCH-07) — Phase 45/46
- Meeting notes and transcript upload via chat — Phase 45/46

</deferred>

---

*Phase: 42-deal-detail-layout*
*Context gathered: 2026-03-08*
