# Phase 70: High-Complexity Tutorials - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Five tutorials covering multi-stage HITL touch workflows (Touches 1-4) and asset review are captured, narrated, and rendered as MP4 videos. The tutorials are: Touch 1 First-Contact Pager (TUT-13), Touch 2 Intro Deck (TUT-14), Touch 3 Capability Deck (TUT-15), Touch 4 Transcript-to-Proposal (TUT-16), and Asset Review & Approval (TUT-17). Infrastructure (mock server, capture engine, TTS, Remotion, visual effects) is fully built from Phases 62-66. Stage/sequence patterns from Phase 63 are available for all HITL flows. This phase is content authoring only.

</domain>

<decisions>
## Implementation Decisions

### HITL gate depth
- Full gates at every HITL stage (Skeleton → Low-fi → High-fi) for all touch tutorials — each gate gets its own step showing content + explicit approve action
- One refine demo per touch tutorial — show request change → AI regenerates → approve at the most meaningful gate per touch (Claude picks which gate per touch)
- All other gates are review + approve only
- Touch 1 includes manual upload override demonstration as a separate flow after the HITL workflow completes (adds 2-3 steps)

### Touch 4 expansion
- Existing pilot script (6 steps) is replaced entirely — the expanded tutorial IS the Touch 4 tutorial
- Dedicated steps per artifact — proposal deck, talk track, and FAQ each get their own step(s) for content review
- Show paste action for transcript input — tutorial shows clicking text area, stage switch simulates pasted text, then submit
- Final step shows Drive links for each artifact as a "here's where to find them" moment after the Saved-to-Drive confirmation

### Cross-touch structure
- Tutorials are adapted per touch, not formulaic — each structures itself around what's unique to that touch
  - Touch 1: focuses on pager generation + manual upload override
  - Touch 2: focuses on strategy resolution + slide selection + reordering (demonstrate reordering via drag/UI controls)
  - Touch 3: focuses on multi-capability area selection (select 2-3 areas) + structure-driven assembly
  - Touch 4: focuses on full 6-phase pipeline with 3 output artifacts + transcript paste entry
- Same HITL gate pattern (full gates + one refine) across all touches, but emphasis and pacing differ
- All 4 touch tutorials use the same deal as Phase 68 medium-complexity tutorials ("Meridian Health Partnership") — creates a full narrative arc where viewers see one deal go through all 4 touches

### Asset Review scope
- TUT-17 covers artifacts from all 4 touches in the review queue — comprehensive view of full pipeline output
- Full brand compliance walkthrough — show compliance check results in detail (flagged issues, severity levels), demonstrate one fix and re-check cycle
- Demonstrate reject + regeneration flow — reject one artifact, show it go back through regeneration, then re-review the updated version
- Asset Review narrative framing is Claude's discretion (standalone entry vs. series continuation)

### Narration & pacing (carried forward)
- Conversational tone, standard pacing — consistent with Phase 67/68
- Light cross-references where natural
- Standalone outro slates — "Tutorial Complete" only, no next-tutorial direction
- Standard timing for navigation, slightly longer holds on first UI reveals

### Visual effects usage (carried forward)
- Zoom ~30-40% of steps, callouts ~20-30%, cursor on all click/hover steps
- No "Next: [Tutorial Name]" on outro slates

### Fixture & data continuity
- All 5 tutorials use the same deal ("Meridian Health Partnership") from shared fixtures — consistent with Phase 62/67/68 decisions
- Stage fixtures needed per touch: idle, generating, skeleton, lowfi, hifi, completed (plus touch-specific stages as needed)
- Asset Review fixtures need artifacts from all 4 touches in the review queue, plus at least one with compliance issues

### Claude's Discretion
- Exact step count per tutorial (Touch 1-3 likely ~12-18 steps each; Touch 4 likely ~15-20 steps; Asset Review likely ~15-20 steps)
- Which gate gets the refine demo per touch
- Which specific steps get zoom, callouts, and cursor targets
- Callout text and positioning
- Zoom scale overrides per step (default 1.5x from Phase 66)
- Touch-specific stage names and fixture file structure
- Asset Review narrative framing (standalone vs. series continuation)
- Fixture content details (transcript text, compliance issue types, artifact content)

</decisions>

<specifics>
## Specific Ideas

- "Adapted per touch" means each tutorial highlights what's unique — Touch 2 is about slide curation, Touch 4 is about the full pipeline. The HITL gates are the shared backbone, not the whole story
- Touch 4 replaces the pilot entirely — one tutorial per touch, no variants
- Manual upload on Touch 1 is deliberately included to show it's not just AI-only — there's a human override path
- Asset Review showing all 4 touches creates a "capstone" feel — you've seen everything get generated, now see it all reviewed in one place
- Full compliance walkthrough + reject/regen demonstrates the quality control story — this isn't just rubber-stamping AI output

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fixtures/touch-4-hitl/`: Existing pilot script (6 steps) and stage fixtures (idle, generating, skeleton, lowfi, hifi, completed) — replace script, reuse/expand stage fixtures
- `fixtures/shared/`: companies.json, deals.json, users.json — shared base data for all tutorials
- Generic capture loop in `capture/*.spec.ts`: Iterates script.steps JSON — new tutorials follow this pattern exactly
- `src/helpers/route-mocks.ts`: mockBrowserAPIs with stageGetter closure — reuse for all HITL state transitions
- `scripts/mock-server.ts`: Mock agent server with stage/sequence support — handles SSR API mocking
- `scripts/tts.ts`: TTS pipeline processes any tutorial's script.json → audio files
- `scripts/render.ts`: Render pipeline composes any tutorial's screenshots + audio → MP4

### Established Patterns
- Stage ref pattern: mutable variable in capture loop shared via closure with browser mocks (Phase 63)
- Fixture loader: `loadFixtures(tutorialId)` loads shared + per-tutorial overrides
- StepSchema fields: zoomTarget, callout, cursorTarget, shortcutKey, emotion, mockStage — all optional
- mockStage on steps: sets mock server stage before step executes — enables HITL state transitions

### Integration Points
- New capture specs: `capture/touch-1-pager.spec.ts`, `capture/touch-2-intro-deck.spec.ts`, `capture/touch-3-capability-deck.spec.ts`, `capture/touch-4-proposal.spec.ts`, `capture/asset-review.spec.ts`
- New fixture dirs: `fixtures/touch-1-pager/`, `fixtures/touch-2-intro-deck/`, `fixtures/touch-3-capability-deck/`, `fixtures/asset-review/`
- Existing `fixtures/touch-4-hitl/` directory gets expanded (script replaced, stages may need additions)
- Web app routes: `/deals/[dealId]/touch/1`, `/deals/[dealId]/touch/2`, `/deals/[dealId]/touch/3`, `/deals/[dealId]/touch/4`, review/approval page route
- Stage fixtures needed per tutorial: match HITL stages + touch-specific states (refine, manual-upload, compliance-check, etc.)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 70-high-complexity-tutorials*
*Context gathered: 2026-03-19*
