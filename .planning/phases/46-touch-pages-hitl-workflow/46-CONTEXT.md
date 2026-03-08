# Phase 46: Touch Pages & HITL Workflow - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can generate artifacts for each touch (1-4) through a visible 3-stage human-in-the-loop workflow with AI chat refinement at each stage. Each touch has a dedicated page within the deal detail sidebar. Drive saving is Phase 47. The persistent deal-wide chat bar is Phase 45 (parallel) — this phase ensures touch pages provide the right context to that chat.

</domain>

<decisions>
## Implementation Decisions

### 3-Stage HITL Model
- Each touch follows a 3-stage progression adapted to touch complexity:
  - **Touch 1 (Pager):** Skeleton = content outline, Low-fi = draft text, High-fi = Google Slides pager
  - **Touch 2 (Intro Deck):** Skeleton = slide selection rationale, Low-fi = draft slide order + notes, High-fi = Google Slides deck
  - **Touch 3 (Capability Deck):** Skeleton = slide selection rationale, Low-fi = draft slide order + notes, High-fi = Google Slides deck
  - **Touch 4 (Proposal):** Skeleton = full multi-pillar sales brief (extraction + pillars + ROI), Low-fi = full draft text of proposal deck content, talk track, and FAQ (rendered as readable text, not yet in Slides), High-fi = final Google Slides deck + Google Docs
- Stage count adapts per touch — simpler touches may have fewer meaningful stages, but the stepper always reflects actual stages needed
- Stage indicator labels: Claude's discretion (touch-specific descriptive labels vs universal labels)

### Stage Transitions & Approval
- User advances between stages by clicking "Approve" or by refining via chat first, then approving
- No separate "reject" action — user iterates via chat refinement until satisfied, then approves
- User can go back to any previous stage at any time by clicking it in the stepper — downstream stages regenerate
- Final High-fi approval marks the artifact as "Ready" in-app (no auto-save to Drive — that's Phase 47)
- Multiple generation runs per touch are supported; previous runs are preserved and viewable (matches existing "Generate Another" pattern)

### Chat Refinement
- The Phase 45 deal-wide chat bar is the single chat interface — no separate touch-specific refinement UI
- When on a touch page, the chat automatically receives touch context (current stage, artifact content, touch type)
- Same chat capabilities available at every stage — no artificial restrictions per stage
- Chat is passive (waits for user to ask) — no proactive suggestions after stage generation
- Update display mode (in-place with diff, in-place without diff, or side-by-side comparison) is user-selectable with saved preference

### Touch Page Layout
- User can toggle between two layout modes with saved preference:
  - **Full-width mode:** Stage content takes full content area, chat bar overlays/docks
  - **Split mode:** Stage content on left, chat panel permanently visible on right
- Initial state (before first generation): AI-guided start — page shows deal context and AI suggests what it can generate based on available data, user confirms via chat or simple "Generate" button (no rigid form)
- Generation history: collapsible section — current/active run is the focus, previous runs available via expandable "History" section
- Touch 4 multi-artifact display: tabbed interface (Proposal, Talk Track, FAQ) within the stage view — user reviews each artifact separately, approves the stage as a whole

### Claude's Discretion
- Stage indicator label style (touch-specific descriptive vs universal)
- Stepper visual design and placement
- Loading states during generation
- Back-navigation UX (warning dialog vs instant)
- AI-guided start page content and suggestions per touch type
- History section visual treatment
- Mobile/responsive behavior for layout mode toggle
- Tab design for Touch 4 multi-artifact view

</decisions>

<specifics>
## Specific Ideas

- User preferences are a theme: layout mode (full-width vs split), update display mode (diff vs no-diff vs side-by-side) — both user-selectable and persisted
- AI-guided start mirrors the briefing page approach (Phase 42) — conversational, not form-based
- "Approve or refine" flow: iterate via chat until satisfied, then advance. No explicit reject action needed
- Going back to earlier stages should feel natural — click any stage in the stepper to revisit

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/page.tsx`: Touch page route placeholder — ready to receive content
- `apps/web/src/components/touch/touch-{1-4}-form.tsx`: Existing generation forms — will be refactored into AI-guided start experience
- `apps/web/src/components/touch/touch-flow-card.tsx`: TouchFlowCard with status badges and "Generate Another" pattern — reuse status logic
- `apps/web/src/components/deals/deal-sidebar.tsx`: Already shows touch status indicators (not_started, in_progress, completed)
- `PipelineStepper` / `WorkflowStepper`: Existing stepper components — adapt for 3-stage HITL visualization
- `BriefDisplay`, `BriefEditMode`, `BriefApprovalBar`: Existing HITL review components — pattern reference for approve/refine UX
- `AssetReviewPanel`: Tabbed multi-artifact review — pattern reference for Touch 4 tabbed view
- `FieldReview`: Touch 4 field validation step — integrate into Skeleton stage
- `GenerationProgress`: Polling-based generation status — reuse for stage generation progress

### Established Patterns
- Mastra suspend/resume for HITL checkpoints — adapt for multi-stage workflow
- Server actions in `apps/web/src/lib/actions/touch-actions.ts` for workflow orchestration
- Named agent execution via `executeNamedAgent(agentId, messages, options)` with versioned prompts
- Touch 4 workflow has 17 steps with 3 suspend points — map to 3-stage model
- `dynamic = "force-dynamic"` on deal pages
- shadcn/ui components (Badge, Tabs, Button, etc.)

### Integration Points
- Phase 45 chat bar must receive touch context when on touch pages — coordinate interface
- Touch page route already exists: `deals/[dealId]/touch/[touchNumber]/page.tsx`
- Deal layout provides sidebar + breadcrumbs — touch pages render inside
- Existing workflows (touch-1 through touch-4) need stage-aware status tracking
- InteractionRecord model tracks touch generation state — may need stage field addition
- User preference storage for layout mode and update display mode

</code_context>

<deferred>
## Deferred Ideas

- Drive artifact saving (folder selection, sharing controls) — Phase 47
- Cross-touch intelligence (AI references prior touch interactions) — v2 (CROSS-01, CROSS-02)
- Proactive chat suggestions at each stage — could revisit if sellers request guided experience

</deferred>

---

*Phase: 46-touch-pages-hitl-workflow*
*Context gathered: 2026-03-08*
