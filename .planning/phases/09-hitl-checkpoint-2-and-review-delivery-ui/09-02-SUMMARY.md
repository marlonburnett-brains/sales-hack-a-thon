---
phase: 09-hitl-checkpoint-2-and-review-delivery-ui
plan: 02
subsystem: ui
tags: [react, nextjs, shadcn-ui, iframe, google-drive, hitl, review-ui, workflow-stepper]

# Dependency graph
requires:
  - phase: 09-hitl-checkpoint-2-and-review-delivery-ui
    provides: "17-step Touch 4 workflow with brand compliance, HITL-2 suspend, typed asset review API (getAssetReview, approveAssets, rejectAssets)"
  - phase: 06-hitl-checkpoint-1-brief-approval
    provides: "Standalone review page pattern (server + client component split), BriefDisplay approval UI"
provides:
  - "Standalone asset review page at /deals/[dealId]/asset-review/[interactionId] with iframe previews"
  - "WorkflowStepper: 5-stage horizontal stepper (Transcript, Brief, Approved, Assets, Delivered)"
  - "BrandComplianceSection: pass/warn display for 8 brand compliance checks"
  - "AssetReviewPanel: 3 stacked artifact cards (deck, talk track, FAQ) with iframe previews and Drive links"
  - "AssetApprovalBar: name + role fields with approve/reject actions for multi-stakeholder review"
  - "Touch4Form extended with assetGenerating, awaitingAssetReview, delivered states (12-state machine)"
  - "Deal page blue alert banner for pending asset review with review link"
  - "DealCard pipeline badges (Assets Ready, Delivered) and blue Touch 4 indicator"
  - "TimelineEntry support for pending_asset_review and delivered statuses with object outputRefs parsing"
affects: [10-pre-call-briefing-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Google Drive iframe embed URLs for Slides and Docs previews", "Multi-stakeholder approval bar with name + role selection", "Object outputRefs format (deckUrl, talkTrackUrl, faqUrl) alongside legacy array format"]

key-files:
  created:
    - apps/web/src/components/touch/workflow-stepper.tsx
    - apps/web/src/components/touch/brand-compliance-section.tsx
    - apps/web/src/components/touch/asset-review-panel.tsx
    - apps/web/src/components/touch/asset-approval-bar.tsx
    - apps/web/src/app/deals/[dealId]/asset-review/[interactionId]/page.tsx
    - apps/web/src/app/deals/[dealId]/asset-review/[interactionId]/asset-review-client.tsx
  modified:
    - apps/web/src/components/touch/touch-4-form.tsx
    - apps/web/src/components/touch/touch-flow-card.tsx
    - apps/web/src/app/deals/[dealId]/page.tsx
    - apps/web/src/components/deals/deal-card.tsx
    - apps/web/src/components/timeline/timeline-entry.tsx

key-decisions:
  - "Deck gets tall iframe (450px), docs get shorter iframes (350px) for optimal preview proportions"
  - "Reviewer enters name AND selects role from 4 options (Seller, SME, Marketing, Solutions) before any action"
  - "Rejection shows inline feedback textarea (min 10 chars) instead of modal dialog"
  - "Touch4Form approved state includes info alert about asset generation progress (user navigates to deal page for review link)"
  - "TouchFlowCard renders WorkflowStepper only for Touch 4 cards (touchNumber === 4)"
  - "Asset review badges (Assets Ready, Delivered) take priority over brief approval badges in DealCard"
  - "TimelineEntry handles both array outputRefs (Touch 1-3) and object outputRefs (Touch 4) formats"

patterns-established:
  - "Google Drive embed pattern: extract document ID from /d/{ID}/ in URL, construct /embed or /preview URL"
  - "Multi-stakeholder approval: reviewer identity (name + role) required before approve/reject actions"
  - "Vertical scroll review page (max-w-4xl): header -> stepper -> separator -> compliance -> artifacts -> approval bar"
  - "Priority-ordered status badges: pending_asset_review > pending_approval > delivered > completed"

requirements-completed: [REVW-01, REVW-02, REVW-03]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 9 Plan 2: HITL-2 Review Delivery UI Summary

**Standalone asset review page with iframe previews for deck/talk track/FAQ, brand compliance display, multi-stakeholder approval bar, 5-stage workflow stepper, and lifecycle state extensions across deal page, dashboard, and timeline**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T16:29:45Z
- **Completed:** 2026-03-04T16:35:05Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created 6 new components for the complete HITL-2 review experience: WorkflowStepper, BrandComplianceSection, AssetReviewPanel, AssetApprovalBar, standalone review page (server + client)
- Extended Touch4Form from 9-state to 12-state machine with asset generation, review, and delivery states plus info alert about asset generation
- Added lifecycle status indicators across TouchFlowCard (stepper + Review Assets button), deal page (blue alert banner), DealCard (pipeline badges), and TimelineEntry (status labels/colors + artifact links)
- Implemented Google Drive iframe embed URL extraction for Slides (embed) and Docs (preview) with proper height differentiation (450px vs 350px)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create review UI components and standalone asset review page** - `1754d00` (feat)
2. **Task 2: Extend Touch4Form, TouchFlowCard, deal page, DealCard, and TimelineEntry with lifecycle states** - `6be0120` (feat)

## Files Created/Modified
- `apps/web/src/components/touch/workflow-stepper.tsx` - 5-stage horizontal stepper with green/blue/slate coloring and status-to-stage mapping
- `apps/web/src/components/touch/brand-compliance-section.tsx` - Card with pass/warn display using CheckCircle/AlertTriangle icons
- `apps/web/src/components/touch/asset-review-panel.tsx` - 3 stacked artifact cards with iframe previews and "Open in Drive" buttons
- `apps/web/src/components/touch/asset-approval-bar.tsx` - Reviewer name + role selection with approve/reject actions and inline feedback textarea
- `apps/web/src/app/deals/[dealId]/asset-review/[interactionId]/page.tsx` - Server component fetching asset review data via server action
- `apps/web/src/app/deals/[dealId]/asset-review/[interactionId]/asset-review-client.tsx` - Client component with full review experience (header, stepper, compliance, panels, approval bar)
- `apps/web/src/components/touch/touch-4-form.tsx` - Extended to 12-state machine with asset generation info alert in approved state
- `apps/web/src/components/touch/touch-flow-card.tsx` - WorkflowStepper on Touch 4 card, "Review Assets" button, priority-ordered status badges
- `apps/web/src/app/deals/[dealId]/page.tsx` - Blue alert banner for pending asset review with "Review now" link
- `apps/web/src/components/deals/deal-card.tsx` - "Assets Ready" and "Delivered" pipeline badges, blue Touch 4 indicator for asset review
- `apps/web/src/components/timeline/timeline-entry.tsx` - New status labels/colors, object outputRefs parsing, 3 artifact links for Touch 4

## Decisions Made
- Deck gets tall iframe (450px), docs get shorter iframes (350px) for optimal content visibility proportions
- Reviewer enters name AND selects role from 4 options (Seller, SME, Marketing, Solutions) for multi-stakeholder review tracking
- Rejection uses inline feedback textarea (min 10 chars) instead of modal dialog for simplicity
- Touch4Form approved state shows info alert about asset generation (user navigates to deal page for review link, not in-form polling)
- Asset review badges take priority over brief approval badges in DealCard header (later pipeline stage)
- TimelineEntry handles both array outputRefs (Touch 1-3 legacy) and object outputRefs (Touch 4 Phase 8+) formats

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Complete HITL-2 review UI ready for visual verification (checkpoint:human-verify pending)
- All typed API contracts consumed correctly from Plan 09-01
- Phase 9 fully implemented pending human verification of the review experience

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (1754d00, 6be0120) verified in git log.

---
*Phase: 09-hitl-checkpoint-2-and-review-delivery-ui*
*Completed: 2026-03-04*
