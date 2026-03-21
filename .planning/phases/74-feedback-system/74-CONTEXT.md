# Phase 74: Feedback System - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

A reusable `FeedbackWidget` component with a segmented control (Tutorial feedback / Feature feedback) and free-text textarea, placed on the tutorial player page and wired to persist rows in the `AppFeedback` table. This phase delivers the widget, the server action, and inline documentation for future extension. Sidebar integration and other page placements are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Widget placement & prominence
- Placed below the prev/next navigation buttons — natural end-of-page position, doesn't compete with content
- Separated from the content above by a subtle horizontal divider + small section heading ("Leave feedback")
- Segmented control uses shadcn/ui `Tabs`/`TabsList`/`TabsTrigger` — reuses existing component, consistent with app patterns

### Post-submission UX
- On success: toast notification ("Thanks for your feedback!") + form resets (textarea clears, tab resets to default "Tutorial feedback")
- Submit button shows Loader2 spinner + "Submitting..." label and disables during the async call (same pattern as StageApprovalBar)
- On failure: error toast ("Failed to submit feedback. Please try again.") + form stays populated (user doesn't lose their comment) + button re-enables

### Validation & empty state
- Comment is required: Submit button stays disabled until at least 1 character is typed (no inline error needed — disabled state is self-explanatory)
- 500 character soft limit with a live character counter (e.g., "120/500"); Submit disables if limit is exceeded
- Default selected tab: "Tutorial feedback" (primary use case on a tutorial player page)
- Feedback type defaults back to "Tutorial feedback" after form reset

### Component location & naming
- Component: `apps/web/src/components/feedback/FeedbackWidget.tsx` — dedicated folder signals reusability
- Server action: `apps/web/src/lib/actions/feedback-actions.ts` — consistent with existing actions/ pattern, function named `submitFeedbackAction`
- Documentation: JSDoc comments on the props interface explaining each prop (`sourceType`, `sourceId`, default feedbackType) — self-contained, lives with the code

### Claude's Discretion
- Exact textarea height (rows)
- Exact toast duration
- Whether the character counter appears only when text is entered or always
- Exact styling of the divider and section heading

</decisions>

<specifics>
## Specific Ideas

- The `key={tutorialId}` prop on the widget (applied at the player page level) handles state reset on tutorial navigation — no manual reset logic needed in the component
- `feedbackType` maps directly to AppFeedback column values: `"tutorial_feedback"` or `"feature_feedback"`
- `sourceType` = `"tutorial"`, `sourceId` = the tutorial's DB id (not slug)
- Sonner toast library is already wired in the app — no new toast setup needed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` (shadcn/ui): segmented control — no new component needed
- `Textarea` (shadcn/ui): free-text input — already available
- `Button` (shadcn/ui): submit button with disabled state support
- `Loader2` (Lucide): spinner icon for loading state
- Sonner (`sonner` package, already configured): `toast.success()` and `toast.error()` for feedback
- `agentFetch` pattern in `tutorial-actions.ts`: use same pattern for `submitFeedbackAction` in `feedback-actions.ts`
- `StageApprovalBar`: established pattern for async button with spinner + disable state — mirror this

### Established Patterns
- Server actions in `apps/web/src/lib/actions/` for all mutations
- `agentFetch` helper handles auth token, base URL, and error throwing — reuse directly
- Client components use `"use client"` directive; widget requires state so it must be a client component
- `revalidatePath` not needed here (feedback submission doesn't affect any server-rendered list)

### Integration Points
- Tutorial player page: `/tutorials/[slug]/page.tsx` (or its client component) — add `<FeedbackWidget key={tutorialId} sourceType="tutorial" sourceId={tutorial.id} />` below the prev/next buttons
- AppFeedback table: ready to receive inserts (Phase 71 created the model with sourceType, sourceId, feedbackType, comment, userId)
- Agent API: needs a POST `/feedback` endpoint (or similar) that the server action calls — check if this already exists or needs to be added in the agent

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 74-feedback-system*
*Context gathered: 2026-03-20*
