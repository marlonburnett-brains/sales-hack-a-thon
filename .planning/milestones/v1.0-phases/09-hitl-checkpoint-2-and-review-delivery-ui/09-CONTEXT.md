# Phase 9: HITL Checkpoint 2 and Review Delivery UI - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the second HITL checkpoint for final asset review after Google Workspace artifacts are generated (Phase 8 output), build the review panel with Drive artifact links, run a brand compliance check before HITL-2 triggers, and display the full workflow lifecycle status from transcript submission through final delivery. Building new asset generation pipelines, modifying RAG retrieval, or adding new touch-point flows is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Review panel layout
- Stacked cards with embedded iframe previews for all 3 artifacts (deck, talk track, FAQ) on the standalone review page
- Both inline on deal page AND standalone shareable review page (like HITL-1): `/deals/[dealId]/asset-review/[interactionId]`
- Deal page shows compact summary — artifact cards with name, type icon, and status — plus a prominent "Review Assets" button linking to the standalone page
- Full iframe previews only on the standalone review page (deal page stays lightweight)
- Deck gets a tall iframe; Google Docs (talk track, FAQ) get shorter iframes
- Vertical scroll through all three artifact cards on standalone page

### Review workflow
- Single approve/reject action covers the whole asset set (not per-artifact)
- Two actions only: Approve and Reject (no inline Edit — edits happen directly in Google Drive since artifacts are Slides/Docs)
- Reviewer enters name AND selects their role (Seller, SME, Marketing, Solutions) before acting — captured in audit trail, no gating
- On rejection: reviewer provides freeform feedback, feedback logged as FeedbackSignal, reviewer (or seller) edits directly in Google Drive, then comes back to click Approve
- No regeneration on rejection — the Drive artifacts are already editable in place
- Unlimited rejection/re-approve cycles — workflow stays suspended until approved

### Brand compliance check
- Programmatic checks only (pure logic, no LLM call) — fast, runs before HITL-2 triggers
- Issues surfaced as warnings (amber badges) in the review panel — reviewer can still approve despite warnings
- Dedicated "Brand Compliance" section at the top of the review panel showing pass/warn status with specific issue descriptions
- Slide structure checks: all slides have titles, bullet count 3-6 per slide, speaker notes present on every slide, deck length within 8-18 range
- Content quality checks: no empty content blocks, client name appears in deck, problem restatement slide present, next steps slide exists

### Workflow lifecycle display
- Both horizontal stepper (quick status at a glance) AND extended InteractionTimeline (detailed history with timestamps)
- 5 grouped stages in stepper: Transcript -> Brief -> Approved -> Assets -> Delivered
- Stepper appears on both the standalone asset review page (gives reviewer pipeline context) AND the deal page Touch 4 card
- Deals dashboard shows a compact pipeline stage badge per deal card (e.g., "Brief Pending", "Assets Ready", "Delivered")
- InteractionTimeline extended with richer lifecycle entries — each major step gets a timestamped entry as it completes

### Claude's Discretion
- Artifact card display style (icon+title vs thumbnail preview from Google API)
- Exact iframe dimensions for Slides vs Docs previews
- Stepper component implementation (CSS steps, shadcn/ui, or custom)
- Brand compliance check implementation details (how to read SlideJSON for validation)
- API endpoint design for asset approval/rejection
- Mastra workflow step structure for awaitAssetReview suspend point
- Polling mechanism for asset generation status updates
- InteractionTimeline entry format for new lifecycle states
- Deal dashboard badge styling and placement

</decisions>

<specifics>
## Specific Ideas

- The standalone asset review page is the HITL-2 demo showpiece — shows that Marketing and Solutions team members can review from a shared link without logging in
- Role selection before action creates a rich audit trail: "Approved by Jane Doe (Marketing)" visible in the timeline — demonstrates multi-stakeholder review governance
- "Edit in Drive + re-approve" flow is realistic — nobody edits slides in a web app when Google Slides is right there
- The 5-stage stepper makes the full pipeline visible at a glance — critical for demonstrating the end-to-end value proposition
- Brand compliance warnings (not blocks) reflect reality — minor issues don't stop deals, but governance is visible
- Compact dashboard badges let the demo show a portfolio view of deals at different pipeline stages

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/app/deals/[dealId]/review/[briefId]/page.tsx` + `brief-review-client.tsx`: Standalone review page pattern (server/client split) — clone for asset review page
- `apps/web/src/components/touch/brief-display.tsx`: BriefDisplay with approval mode — pattern for building AssetReviewPanel
- `apps/web/src/components/touch/touch-4-form.tsx`: 9-state form machine — extend with assetGenerating/awaitingAssetReview/delivered states
- `apps/web/src/components/timeline/interaction-timeline.tsx`: Timeline component — extend with new lifecycle states
- `apps/web/src/components/touch/touch-flow-card.tsx`: Touch flow card — extend to show stepper and compact asset summary
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts`: 11-step workflow (14 after Phase 8) — append awaitAssetReview + finalizeDelivery steps
- `apps/agent/src/mastra/index.ts`: API route registration — clone brief approval endpoints for asset approval
- `apps/agent/src/lib/proposal-assembly.ts`: BRAND_GUIDELINES constant + buildSlideJSON section ordering — inputs for brand compliance validation
- `apps/web/src/components/ui/`: shadcn/ui primitives (Card, Badge, Button, Alert, Separator) — available for review panel and stepper

### Established Patterns
- Mastra workflow suspend/resume with `suspendSchema`/`resumeSchema` — HITL-1 uses this for brief approval; clone for HITL-2
- `workflowRunId` stored on model record for resume targeting — same pattern needed for asset review
- POST endpoint calls `wf.createRun({ runId }).resume({ stepId, resumeData })` — direct clone for asset approval
- FeedbackSignal for all decision types (positive approve, negative reject) — reuse for asset review decisions
- Server actions -> API client -> Mastra workflow trigger for web -> agent communication
- `InteractionRecord.outputRefs` stores Drive URLs as JSON array — Phase 8 populates, Phase 9 reads for review panel
- `InteractionRecord.status` tracks lifecycle ("pending", "pending_approval", "approved", "completed") — add "pending_asset_review" and "delivered"
- LibSQLStore persists Mastra workflow state durably across server restarts

### Integration Points
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` — append awaitAssetReview + finalizeDelivery after Phase 8 steps
- `apps/agent/src/mastra/index.ts` — add POST /interactions/:id/approve-assets and POST /interactions/:id/reject-assets endpoints
- `apps/agent/prisma/schema.prisma` — InteractionRecord.status field already exists (add new status values), outputRefs field exists (JSON array)
- `apps/web/src/app/deals/[dealId]/asset-review/[interactionId]/page.tsx` — new standalone review page
- `apps/web/src/lib/actions/touch-actions.ts` — new server actions for asset approval/rejection
- `apps/web/src/lib/api-client.ts` — new API client functions for asset review
- `apps/web/src/app/deals/[dealId]/page.tsx` — add second alert banner for pending asset review + stepper on Touch 4 card
- `apps/web/src/app/deals/page.tsx` — add pipeline stage badge to deal cards

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-hitl-checkpoint-2-and-review-delivery-ui*
*Context gathered: 2026-03-04*
