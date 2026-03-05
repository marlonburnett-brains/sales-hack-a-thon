# Phase 11: End-to-End Integration and Demo Polish - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect all pipeline steps across all four touch points (Touch 1-4) and the pre-call briefing flow, validate full end-to-end runs for each touch type, add step-by-step progress indicators to every flow, harden error handling with clear seller-facing messages, and produce a demo-ready scenario using a Financial Services deal. Building new touch flows, new features, or modifying the core pipeline logic is out of scope — this phase wires, polishes, and validates what's already built.

</domain>

<decisions>
## Implementation Decisions

### Progress indicators
- Step-by-step progress for ALL touch types, not just Touch 4
- Each flow shows named stages as they complete (e.g., Touch 2: "Selecting slides → Assembling deck → Saving to Drive")
- Touch 4 keeps its existing 5-stage WorkflowStepper (Transcript → Brief → Approved → Assets → Delivered) from Phase 9
- Touches 1-3 and pre-call get lighter steppers with 2-4 stages matching their pipeline steps
- Animated indicator on active step (spinning icon), checkmarks on completed steps — no time estimates
- After completion, stepper stays visible showing all steps checked (demo visibility), then result panel appears below

### Error handling UX
- Toast notification + inline stepper error: toast pops for immediate attention, stepper shows the failed step with red marker and error message
- Toast library needed (sonner or similar) — currently not installed
- Friendly + actionable error tone: "We couldn't generate the talk track. Try again, or contact support if this continues." — warm, clear next step, no raw stack traces
- Partial failure handling: deliver successful artifacts with Drive links + warning about what failed + retry option for failed pieces — seller gets value from what worked
- Retry restarts the whole flow (not per-step resume) — simpler implementation, avoids stale state issues in Mastra workflows

### Demo scenario design
- Pre-seeded Financial Services company/deal with some Touch 1 history already in DB — shows cross-touch context flowing
- Demo walks through the natural sales journey: Pre-call → Touch 1 → Touch 2 → Touch 3 → Touch 4 — demonstrates the complete seller workflow narrative
- Prepared realistic Financial Services transcript stored as a repo fixture — default for demo, presenter can swap in their own
- Deep demo on Financial Services, quick Touch 1 or Touch 2 runs on 2 additional industries (e.g., Healthcare, Technology) to show breadth across the 11-industry taxonomy

### Integration validation
- Demo-focused validation: validate the Financial Services demo scenario end-to-end across all touch types, fix issues found in that path
- Claude discovers integration gaps by running each flow end-to-end — no pre-known broken flows assumed
- Interaction history verified during integration: explicitly test that records are captured for every flow and cross-touch context works
- Demo-ready visual polish: fix functional issues AND do a visual pass (consistent spacing, loading states, responsive layout) — make it look polished for the hackathon audience

### Claude's Discretion
- Update mechanism for progress (polling vs SSE) — pick what's simplest given existing patterns
- Exact step names and count per touch type stepper
- Toast library selection (sonner vs react-hot-toast vs similar)
- Demo seed script implementation details
- Which 2 additional industries to use for breadth demo
- Visual polish scope — prioritize what the demo audience will actually see
- Smoke test approach for non-demo industries

</decisions>

<specifics>
## Specific Ideas

- The stepper across all flows makes the "AI pipeline" feel tangible — sellers (and demo audience) see the system doing real work, not a black box spinner
- Toast + inline error is a "belt and suspenders" approach — catches attention even if seller scrolled away from the stepper
- Pre-seeded Touch 1 history for the demo deal shows the knowledge base growing with each interaction — the asset timeline visually accumulates
- Natural sales journey demo order (Pre-call → T1 → T2 → T3 → T4) tells a compelling story: "Prepare for the meeting, send a pager, do the intro, align on capabilities, then the full proposal after discovery"
- Prepared transcript as repo fixture is both a demo safety net and a developer convenience for testing

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/touch/workflow-stepper.tsx`: 5-stage WorkflowStepper for Touch 4 — extend or generalize for all touch types
- `apps/web/src/components/touch/touch-flow-card.tsx`: TouchFlowCard with loading/progress state handling
- `apps/web/src/components/touch/touch-{1,2,3,4}-form.tsx`: All four touch form components with three-state pattern
- `apps/web/src/components/timeline/interaction-timeline.tsx`: Timeline component showing interaction history
- `apps/web/src/components/deals/deal-card.tsx`: Dashboard deal cards with pipeline stage badges
- `apps/agent/src/mastra/workflows/`: All 5 workflow files (touch-1 through touch-4, pre-call)
- `apps/agent/src/lib/drive-folders.ts`: getOrCreateDealFolder() for Drive output
- `apps/agent/src/lib/doc-builder.ts`: Google Docs creation utility
- `apps/web/src/components/ui/`: shadcn/ui primitives (Card, Badge, Button, Alert, etc.)
- `apps/web/src/app/deals/[dealId]/asset-review/`: Standalone asset review page pattern

### Established Patterns
- Three-state client form pattern (input/review/result) across all touch types
- Server Actions → api-client → agent service proxy for web-to-agent communication
- Mastra workflow steps with createStep, sequential .then() chaining
- HITL-1 uses 3-second polling for approval status updates — reusable pattern for progress
- WorkflowStepper component exists for Touch 4 lifecycle visualization
- InteractionRecord.status tracks lifecycle states across all flows
- Per-deal Drive folders via getOrCreateDealFolder()
- No toast/notification library currently installed

### Integration Points
- All 5 workflow files need progress reporting wired (step status accessible via workflow run state)
- All touch form components need stepper integration
- `apps/web/src/app/layout.tsx` — needs toast provider wrapper
- `apps/agent/src/mastra/index.ts` — may need progress/status endpoints if not already exposed via workflow run API
- Demo seed script → Prisma DB + potentially Drive folder pre-creation
- Demo transcript fixture → repo fixture file (e.g., `fixtures/demo-transcript-financial-services.txt`)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-end-to-end-integration-and-demo-polish*
*Context gathered: 2026-03-04*
