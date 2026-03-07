# Phase 37: Frontend UI - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can classify Touch 4 examples by artifact type and view/refine separate Touch 4 deck structures for Proposal, Talk Track, and FAQ in Settings. This phase covers the frontend behavior and presentation for those flows, not new backend capabilities or broader classification features.

</domain>

<decisions>
## Implementation Decisions

### Touch 4 classification flow
- In classification UI, artifact type appears inline under touch selection once the user is classifying as `Example` and selects `Touch 4`
- Artifact type is required for Touch 4 examples and must be a single choice: `Proposal`, `Talk Track`, or `FAQ`
- Artifact choices should be shown as visible radio-card style options, not hidden in a dropdown
- Saved classification should surface the artifact in the card badge/label so users can see the decision without reopening the dialog

### Example vs template touch assignment
- Examples can only be assigned to one touch type total
- Templates may still be assigned to multiple touch types
- Artifact type applies only to the Touch 4 classification context, not as a global type for every touch
- If Touch 4 is deselected in the form, any selected artifact type should clear immediately
- Saving should be blocked with inline validation if Touch 4 is selected without an artifact type

### Touch 4 settings navigation
- Keep the existing Settings left-nav structure; do not add new sidebar entries for each artifact type
- On the Touch 4 Settings page, show `Proposal`, `Talk Track`, and `FAQ` as in-page top tabs
- Default the Touch 4 page to the `Proposal` tab
- Each tab should keep its own structure view, confidence display, and chat refinement in the tab content
- The tab strip should expose confidence context at a glance, not just inside the active panel

### Per-artifact empty and confidence states
- Each Touch 4 artifact tab gets its own empty state and CTA back to Templates for classification
- Low-confidence tabs should still show the confidence badge, with wording that makes the low-confidence state explicit
- Empty artifact tabs should still allow chat refinement rather than showing a disabled-only chat area
- Users should be able to compare confidence across Proposal, Talk Track, and FAQ directly from the tab strip

### Claude's Discretion
- Exact tab visual styling and spacing
- Exact wording of inline validation and low-confidence helper copy
- Whether artifact detail appears inside the existing classification badge text or as a closely related visual variant, as long as the artifact is visible on the card

</decisions>

<specifics>
## Specific Ideas

- Keep Touch 4 artifact selection tightly coupled to the existing classify flow rather than turning classification into a separate wizard
- For examples, single-touch assignment is preferred so artifact-specific examples stay unambiguous
- Touch 4 Settings should feel like one page with artifact-specific tabs, not a larger nested navigation system
- Even if an artifact has no examples yet, the tab should remain visible and actionable

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/template-card.tsx`: existing classify dialog already supports Template vs Example and touch selection; Phase 37 can extend this surface with Touch 4 artifact controls
- `apps/web/src/components/slide-viewer/classification-panel.tsx`: second classification UI with nearly identical example/template logic; likely needs the same artifact-aware behavior to avoid divergence
- `apps/web/src/components/ui/tabs.tsx`: reusable Radix tabs already exist for the Touch 4 Settings tabbed view
- `apps/web/src/components/settings/touch-type-detail-view.tsx`: existing detail view already handles confidence, empty states, section flow, and chat; likely base for per-artifact Touch 4 tabs
- `apps/web/src/components/settings/chat-bar.tsx`: existing chat UI can likely be reused once artifact context is threaded through props and request payloads

### Established Patterns
- Template classification currently uses lightweight inline controls in both `template-card.tsx` and `classification-panel.tsx`, with `classifyTemplateAction()` as the write path
- Settings already uses persistent left navigation plus touch-specific detail pages in `apps/web/src/app/(authenticated)/settings/layout.tsx` and `apps/web/src/app/(authenticated)/settings/deck-structures/[touchType]/page.tsx`
- Deck structure data is loaded through thin server actions over `apps/web/src/lib/api-client.ts`, which already supports optional `artifactType` for detail and infer requests
- Current Touch 4 settings/detail components still behave like single-key touch views; planner should account for converting Touch 4 into a tabbed artifact-aware presentation without disturbing Touch 1-3

### Integration Points
- `apps/web/src/lib/actions/template-actions.ts` and `apps/web/src/lib/api-client.ts`: classification payload needs to carry artifact type from the UI to the existing `/templates/:id/classify` flow
- `apps/web/src/app/(authenticated)/settings/deck-structures/[touchType]/page.tsx`: Touch 4 route is the entry point for introducing artifact tabs while keeping other touch routes unchanged
- `apps/web/src/lib/actions/deck-structure-actions.ts`: action layer currently accepts only `touchType`; Touch 4 UI decisions require artifact-aware detail/infer calls from the web layer
- `apps/web/src/components/settings/chat-bar.tsx` and `apps/web/src/app/api/deck-structures/chat/route.ts`: chat refinement must receive artifact context for Touch 4 tabs so each conversation stays scoped to the correct structure

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 37-frontend-ui*
*Context gathered: 2026-03-07*
