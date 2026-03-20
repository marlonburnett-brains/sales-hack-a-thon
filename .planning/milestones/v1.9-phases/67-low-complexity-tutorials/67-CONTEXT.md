# Phase 67: Low-Complexity Tutorials - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Author scripts, fixtures, and captures for three introductory tutorials (Getting Started, Google Drive Settings, Action Center), then run TTS + render to produce final MP4 videos. The infrastructure (mock server, capture engine, TTS pipeline, Remotion composition, visual effects) is fully built from Phases 62-66. This phase is content authoring only.

</domain>

<decisions>
## Implementation Decisions

### Tutorial scope & depth
- Getting Started (TUT-01): Keep as broad tour, ~8-10 steps. Quick orientation of dashboard, deals, templates, settings, integrations. Refine existing 8-step pilot script in place (update narration, add zoom/callout/cursor fields) — do not regenerate from scratch
- Google Drive Settings (TUT-02): Happy path only, 5-7 steps. Start from unconfigured state (no folder selected), walk through selecting root folder, verifying access, confirming save. Error recovery lives in Action Center tutorial
- Action Center (TUT-03): Cover all issue types the system can surface (OAuth expired, Drive sharing issue, missing access). Show full before-and-after resolution flow using mockStage/sequence switching — issue present → click resolve → show resolved state

### Fixture & data strategy
- All 3 tutorials share the same fictional company from existing shared fixtures (users.json, companies.json, deals.json)
- Per-tutorial override files for specific needs: Action Center gets error state fixtures, Google Drive Settings gets unconfigured state
- Error state fixtures must be realistic — mimic actual error payloads the app would receive (OAuth token expired, Drive folder not shared with service account, missing permissions)
- Action Center resolution flow needs before/after fixture states via mockStage or sequence switching

### Narration & pacing
- Warmer intro tone for Getting Started ("Welcome to AtlusDeck! Let me show you around..."). Google Drive Settings and Action Center shift to normal conversational pace
- Light cross-references to other tutorials ("We'll cover deal creation in detail in another tutorial") — builds series cohesion without overloading
- Getting Started ends with open-ended exploration: "You're all set to explore! Try creating a deal or browsing templates." — does NOT direct to next tutorial
- Slightly longer holds (~1s extra) on first-time UI reveals (dashboard, sidebar, settings pages). Standard timing for navigation steps

### Visual effects usage
- Zoom effects on key moments only (~30-40% of steps) — first time seeing sidebar, important buttons, settings panels. Most steps stay full-frame for orientation
- Selective callouts (~20-30% of steps) — use for non-obvious UI elements (sidebar sections, specific settings, action items). Skip where narration + zoom already make it clear
- Cursor appears on ALL click/hover steps — consistent visual language where cursor = action. Info-only steps stay cursor-free (already decided Phase 66)
- No "Next: [Tutorial Name]" on outro slates — each tutorial ends standalone with just "Tutorial Complete"

### Claude's Discretion
- Exact step count per tutorial (within the ranges above)
- Which specific steps get zoom, callouts, and cursor targets
- Callout text and positioning
- Zoom scale overrides per step (default 1.5x from Phase 66)
- Action Center issue types to include (based on what the component actually supports)
- Fixture structure for Drive unconfigured state and Action Center error states

</decisions>

<specifics>
## Specific Ideas

- Refine the existing Getting Started pilot (8 steps) rather than starting fresh — preserves validated capture selectors from Phase 62/66 work
- Action Center tutorial should feel like a troubleshooting guide — "Here's what you might see, and here's how to fix it"
- The warmth in Getting Started is a deliberate first-impression choice — it should feel welcoming, not corporate

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fixtures/getting-started/script.json`: Existing 8-step pilot script with validated selectors — refine, don't regenerate
- `fixtures/getting-started/overrides.json`: Per-tutorial fixture overrides pattern already established
- `fixtures/shared/`: companies.json, deals.json, users.json — shared across all tutorials
- `capture/getting-started.spec.ts`: Generic capture loop pattern — new tutorials follow this pattern exactly
- `src/helpers/route-mocks.ts`: mockBrowserAPIs with stageGetter closure — reuse for Action Center state transitions
- `scripts/mock-server.ts`: Mock agent server with stage/sequence support — handles SSR API mocking

### Established Patterns
- Generic capture loop: iterates script.steps JSON, navigates, waits, performs actions, captures screenshots
- Stage ref pattern: mutable variable in capture loop shared via closure with browser mocks (from Phase 63)
- Fixture loader: `loadFixtures(tutorialId)` loads shared + per-tutorial overrides
- StepSchema fields: zoomTarget, callout, cursorTarget, shortcutKey, emotion — all optional, drive visual effects
- mockStage on steps: sets mock server stage before step executes — enables before/after state transitions

### Integration Points
- New capture specs: `capture/google-drive-settings.spec.ts` and `capture/action-center.spec.ts`
- New fixture dirs: `fixtures/google-drive-settings/` and `fixtures/action-center/`
- New script JSONs: `fixtures/google-drive-settings/script.json` and `fixtures/action-center/script.json`
- Web app routes: `/settings/drive` (Drive settings), `/actions` (Action Center)
- TTS pipeline: `scripts/tts.ts` processes any tutorial's script.json → audio files
- Render pipeline: `scripts/render.ts` composes any tutorial's screenshots + audio → MP4

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 67-low-complexity-tutorials*
*Context gathered: 2026-03-19*
