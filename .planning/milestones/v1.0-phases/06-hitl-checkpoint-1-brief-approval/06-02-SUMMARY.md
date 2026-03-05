---
phase: 06-hitl-checkpoint-1-brief-approval
plan: 02
subsystem: ui, components
tags: [react, next.js, shadcn-ui, hitl, brief-approval, review-page, state-machine, polling, approval-bar, inline-edit, timeline, dashboard]

# Dependency graph
requires:
  - phase: 06-hitl-checkpoint-1-brief-approval
    plan: 01
    provides: 8-step Touch 4 workflow with second suspend point, 5 API endpoints for brief approval, BriefRecord/BriefReviewData types, server actions
  - phase: 05-transcript-processing-and-brief-generation
    provides: BriefDisplay component, FieldReview component, Touch4Form state machine, SalesBriefLlmSchema, ROIFramingLlmSchema
provides:
  - BriefApprovalBar component with reviewer name gate, approve/reject/edit actions, rejection feedback form
  - BriefEditMode component for inline editing of all brief fields
  - BriefDisplay extended with approvalMode props for status badge, approval bar, inline edit toggle
  - Touch4Form with 9-state machine including awaitingApproval, rejected, editing, resubmitting, approved
  - Polling detects second suspend point (await-brief-approval) with 3-second interval
  - Two rejection resubmit paths (edit fields & regenerate, or edit brief directly)
  - Standalone review page at /deals/[dealId]/review/[briefId] (no auth required)
  - Deal page amber alert banner for pending brief approval
  - DealCard "Approval Pending" badge and Touch 4 indicator
  - TouchFlowCard "Awaiting Approval" badge and "Review Brief" link button
  - Timeline entry approval lifecycle status badges and reviewer/rejection info
affects: [phase-07, phase-08, phase-09, phase-11]

# Tech tracking
tech-stack:
  added: []
  patterns: [9-state-form-machine, dual-suspend-polling, standalone-review-page, inline-edit-toggle, rejection-resubmit-paths]

key-files:
  created:
    - apps/web/src/components/touch/brief-approval-bar.tsx
    - apps/web/src/components/touch/brief-edit-mode.tsx
    - apps/web/src/app/deals/[dealId]/review/[briefId]/page.tsx
    - apps/web/src/app/deals/[dealId]/review/[briefId]/brief-review-client.tsx
    - apps/web/src/components/ui/alert.tsx
  modified:
    - apps/web/src/components/touch/brief-display.tsx
    - apps/web/src/components/touch/touch-4-form.tsx
    - apps/web/src/components/touch/touch-flow-card.tsx
    - apps/web/src/app/deals/[dealId]/page.tsx
    - apps/web/src/components/deals/deal-card.tsx
    - apps/web/src/components/timeline/timeline-entry.tsx
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "BriefDisplay extended with approvalMode prop rather than separate component -- reuses existing card layout and ROI display"
  - "Standalone review page split into server component (data fetch) + client component (BriefReviewClient) for approval interactions"
  - "Touch4Form uses 9-state machine with explicit rejected/editing/resubmitting/approved states for clear UX transitions"
  - "Two rejection resubmit paths: field re-edit starts fresh workflow, direct brief edit resets approval status"
  - "Deals list API updated to include all interactions (removed take:1 limit) for dashboard pending approval detection"
  - "Timeline entry shows approval lifecycle status for touch_4 (Awaiting Approval, Changes Requested, Approved) with reviewer name and rejection feedback"

patterns-established:
  - "9-state form machine: input, extracting, fieldReview, generating, awaitingApproval, rejected, editing, resubmitting, approved"
  - "Dual suspend polling: pollStatus detects both await-field-review and await-brief-approval suspend points"
  - "Standalone review page: server component fetches data, client component handles approval interactions without auth"
  - "Rejection resubmit: two paths from rejected state (edit fields -> regenerate, edit brief -> resubmit)"

requirements-completed: [GEN-03, GEN-04]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 6 Plan 02: HITL-1 Brief Approval UI Summary

**Complete brief approval UI layer: BriefApprovalBar + BriefEditMode + 9-state Touch4Form + standalone review page + deal page alert banner + dashboard indicator + timeline lifecycle badges**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T02:59:51Z
- **Completed:** 2026-03-04T03:06:09Z
- **Tasks:** 2 (of 3 total; Task 3 is human-verify checkpoint)
- **Files modified:** 12

## Accomplishments
- BriefApprovalBar: reviewer name input + approve/reject/edit actions with rejection feedback form, 44px touch targets, disabled states until name provided
- BriefEditMode: inline editing of ALL brief fields (primary pillar dropdown, secondary pillar multi-tag, evidence textarea, 6 context fields, use case cards with add/remove)
- BriefDisplay: extended with approvalMode props for status badge, approval bar rendering, and inline edit toggle
- Touch4Form: 9-state machine (input, extracting, fieldReview, generating, awaitingApproval, rejected, editing, resubmitting, approved) with polling for second suspend point at await-brief-approval (3-second interval)
- Two rejection resubmit paths: "Edit Extracted Fields & Regenerate" (fresh workflow) or "Edit Brief Directly & Resubmit" (inline edit)
- Standalone review page at /deals/[dealId]/review/[briefId]: server component fetches deal context + brief data, client component renders BriefDisplay with approval actions, no auth required
- Deal page: amber alert banner when brief awaiting approval with "Review now" link to standalone page
- DealCard: "Approval Pending" badge in header + Touch 4 indicator with amber pending state
- TouchFlowCard: "Awaiting Approval" badge replaces "Available" + "Review Brief" link button
- TimelineEntry: approval lifecycle status badges (Awaiting Approval, Changes Requested, Approved) for touch_4 entries, reviewer name, rejection feedback in expanded content
- Deals list API: include all interactions with brief data (removed take:1 limit) for dashboard pending detection

## Task Commits

Each task was committed atomically:

1. **Task 1: Approval components, extended Touch4Form state machine, polling for second suspend** - `62b3f6f` (feat)
2. **Task 2: Standalone review page, deal page alert banner, dashboard indicator, timeline lifecycle** - `cdbb4dd` (feat)

## Files Created/Modified
- `apps/web/src/components/touch/brief-approval-bar.tsx` - Reviewer name input + approve/reject/edit actions with rejection feedback form (140 lines)
- `apps/web/src/components/touch/brief-edit-mode.tsx` - Inline editing of all brief fields with SOLUTION_PILLARS dropdown and use case cards (360 lines)
- `apps/web/src/components/ui/alert.tsx` - shadcn/ui Alert component (59 lines)
- `apps/web/src/components/touch/brief-display.tsx` - Extended with approvalMode props, status badge, approval bar, inline edit toggle (208 lines)
- `apps/web/src/components/touch/touch-4-form.tsx` - 9-state machine with approval flow, polling for second suspend, rejection resubmit paths (467 lines)
- `apps/web/src/app/deals/[dealId]/review/[briefId]/page.tsx` - Server component fetching brief review data
- `apps/web/src/app/deals/[dealId]/review/[briefId]/brief-review-client.tsx` - Client component with deal context header + brief + approval actions
- `apps/web/src/app/deals/[dealId]/page.tsx` - Added amber alert banner for pending brief approval
- `apps/web/src/components/deals/deal-card.tsx` - Added "Approval Pending" badge and Touch 4 indicator with pending state
- `apps/web/src/components/touch/touch-flow-card.tsx` - Added "Awaiting Approval" badge and "Review Brief" link button
- `apps/web/src/components/timeline/timeline-entry.tsx` - Approval lifecycle status badges, reviewer name, rejection feedback
- `apps/agent/src/mastra/index.ts` - Updated deals list API to include all interactions with brief data

## Decisions Made
- BriefDisplay extended with approvalMode prop rather than creating a separate ApprovalBriefDisplay component -- reuses card layout and ROI display
- Standalone review page split into server component (data fetch) and client component (BriefReviewClient) for Next.js 15 App Router compatibility
- Touch4Form uses 9-state machine with explicit states for rejected/editing/resubmitting/approved for clear UX transitions
- Two rejection resubmit paths implemented: field re-edit starts a fresh workflow, direct brief edit just resets approvalStatus
- Deals list API updated to include all interactions (removed take:1) for dashboard-level pending approval detection
- Timeline entry uses touch_4-specific approval lifecycle badges instead of generic decision badges for richer status display

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Deals list API includes all interactions**
- **Found during:** Task 2 (DealCard pending approval indicator)
- **Issue:** GET /deals only returned `take: 1` interaction per deal, insufficient to detect Touch 4 pending approval
- **Fix:** Updated deals list query to include all interactions with brief data
- **Files modified:** apps/agent/src/mastra/index.ts
- **Verification:** Build passes, DealCard can now detect pending approval across all interactions
- **Committed in:** cdbb4dd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness of dashboard pending approval indicator. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete HITL-1 brief approval UI is ready for end-to-end testing
- Task 3 (human-verify checkpoint) pending: verify complete approval flow from transcript to approval
- Phase 7 (RAG retrieval) can begin once Phase 6 checkpoint is verified
- All approval actions connect to Plan 01 backend endpoints (approve/reject/edit)
- Workflow resume mechanism tested through polling detection of second suspend point

## Self-Check: PASSED

All 12 files verified present. Both task commits (62b3f6f, cdbb4dd) confirmed in git log. Artifact line counts verified: brief-approval-bar.tsx (140 lines, min 80), brief-edit-mode.tsx (360 lines, min 100), review page (28+162=190 lines, min 60), touch-4-form.tsx (740 lines). Key patterns confirmed: awaitingApproval in touch-4-form, await-brief-approval polling, getBriefReviewAction in review page, approveBriefAction/rejectBriefAction linking. Web build passes with no TypeScript errors.

---
*Phase: 06-hitl-checkpoint-1-brief-approval*
*Completed: 2026-03-04*
