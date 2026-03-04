# Phase 6: HITL Checkpoint 1 — Brief Approval - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the Mastra workflow suspend/resume at the brief approval checkpoint, build the brief review UI (both inline on deal page and standalone shareable review page), and verify that durable state survives a server restart before any asset generation is wired up. Building the RAG retrieval pipeline (Phase 7), Google Slides output (Phase 8), or the second HITL checkpoint (Phase 9) is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Approval review UX
- Both inline on deal page AND standalone shareable review page (`/deals/[dealId]/review/[briefId]`)
- Either path can trigger approval — inline view and standalone page connect to the same workflow resume
- Standalone review page shows deal context header (company name, industry, subsector, brief transcript summary) above the full brief with approval actions
- Three approval actions: Approve, Reject (Request Changes), Edit
- Reviewer enters their name before performing any action (self-identification, no auth) — name captured in the approval record (e.g., "Approved by Jane Doe")
- Reuse existing `BriefDisplay` component as the read-only brief view, extend with approval action bar below

### Rejection & resubmit flow
- On rejection, reviewer provides freeform text feedback explaining what needs to change
- Feedback is stored as a FeedbackSignal and displayed to the seller
- Seller has TWO resubmit paths after rejection:
  1. Edit extracted fields and re-trigger brief generation from pillar mapping step forward (reuses FieldReview component)
  2. Edit the brief content directly and resubmit for approval (manual fix without regeneration)
- Both paths lead back to the approval checkpoint
- Unlimited rejection/resubmit cycles — workflow stays suspended until approved
- Each rejection is recorded as a FeedbackSignal for knowledge base growth
- On resubmit, reviewer sees only the latest brief version (no diff or version history in the review UI)

### Deal page status visibility
- Touch 4 card shows amber "Awaiting Approval" status badge with a "Review Brief" action button
- Interaction timeline entry updates through lifecycle: "Brief Generated" → "Awaiting Approval" → "Brief Approved" / "Changes Requested" (single entry, not separate entries per state)
- Top-of-page alert banner on the deal page when a brief is awaiting approval (yellow alert: "Brief awaiting approval — Review now")
- Deals dashboard cards show an "Approval Pending" indicator so sellers and SMEs can quickly find deals needing action

### Brief editability
- ALL brief fields are editable: primary pillar, secondary pillars, evidence, use case names/descriptions, ROI outcomes, value hypotheses, and synthesized context fields
- Inline editing on cards: clicking "Edit" makes brief cards editable in-place — text fields become input/textarea, pillar becomes select dropdown, save button replaces edit button
- Edits captured as FeedbackSignal with diff (signal type "edited") — original brief stored as "before" snapshot in FeedbackSignal content, Brief record updated in-place with edited content
- Edited-and-approved brief is what Phase 7 RAG pipeline will consume — no separate "approved version" concept

### Claude's Discretion
- Exact Prisma model additions for approval state tracking (new model vs fields on Brief)
- Mastra workflow modifications to add the second suspend point after brief generation
- API endpoint design for approval/rejection/edit actions
- Polling mechanism implementation for real-time status updates (3-second interval per SC2)
- Server restart durability verification approach
- Alert banner and dashboard indicator styling/animation
- Inline edit mode implementation details (form validation, save/cancel UX)

</decisions>

<specifics>
## Specific Ideas

- The shareable review URL is a demo showpiece — shows the SME can review from a different browser/device without logging in
- Name prompt before action creates an audit trail: "Approved by Jane Doe (SME)" visible in the timeline
- Top-of-page alert banner makes the pending approval impossible to miss — critical for demonstrating the "hard stop" nature of HITL-1
- Two resubmit paths (edit fields to regenerate vs edit brief directly) demonstrate both AI-assisted and manual correction approaches — consistent with the "both paths" philosophy from Phase 4
- Single timeline entry updating through states keeps the deal page clean while showing the full approval lifecycle

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/touch/brief-display.tsx`: BriefDisplay component renders formatted brief cards (pillar badges, use case cards, ROI outcomes) — extend with approval action bar and inline edit mode
- `apps/web/src/components/touch/field-review.tsx`: FieldReview component for editing extracted fields — reuse for the "edit fields and regenerate" rejection path
- `apps/web/src/components/touch/generation-progress.tsx`: GenerationProgress component for loading states — reuse during brief regeneration after rejection
- `apps/web/src/components/touch/touch-4-form.tsx`: Touch 4 form with full state machine (input → extracting → fieldReview → generating → briefResult) — extend states for approval flow
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts`: 6-step workflow with one suspend point (awaitFieldReview) — add second suspend point for brief approval after recordInteraction
- `apps/web/src/components/touch/touch-flow-card.tsx`: Touch flow card on deal page — extend to show approval status badge and action button
- `apps/web/src/components/timeline/interaction-timeline.tsx`: Timeline component — extend to show approval lifecycle states
- `packages/schemas/llm/sales-brief.ts`: SalesBriefLlmSchema — used for inline edit form validation
- `packages/schemas/llm/roi-framing.ts`: ROIFramingLlmSchema — paired with brief in display/edit
- `apps/web/src/components/ui/`: shadcn/ui primitives (Card, Badge, Button, Select, Textarea, Alert) — available for approval UI

### Established Patterns
- Mastra workflow suspend/resume with `suspendSchema`/`resumeSchema` — Touch 1 and Touch 4 field review both use this pattern
- Client-side polling with `checkTouch4StatusAction` at 2-second intervals — shift to 3-second for approval (per SC2)
- Three-state form pattern (input/review/result) — extend to include approval states
- FeedbackSignal model for capturing all decision types (positive, negative, override, edited)
- Server actions → API client → Mastra workflow trigger for all web → agent communication
- LibSQLStore persists Mastra workflow state to `mastra.db` — durable across server restarts by design

### Integration Points
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` — add `awaitBriefApproval` step as second suspend point
- `apps/agent/src/mastra/index.ts` — add API routes for brief approval/rejection/edit actions and review page data
- `apps/agent/prisma/schema.prisma` — may need approval tracking fields on Brief or a new ApprovalState model
- `apps/web/src/app/deals/[dealId]/review/[briefId]/page.tsx` — new standalone review page
- `apps/web/src/lib/actions/touch-actions.ts` — new server actions for approval, rejection, brief edit
- `apps/web/src/lib/api-client.ts` — new API client functions for approval flow
- `apps/web/src/app/deals/[dealId]/page.tsx` — add approval alert banner
- `apps/web/src/app/deals/page.tsx` — add approval pending indicator to deal cards

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-hitl-checkpoint-1-brief-approval*
*Context gathered: 2026-03-03*
