# Phase 66: Visual Effects & Polish - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add professional visual enhancements to tutorial videos: zoom/pan effects on UI targets, text overlays and callout annotations, animated cursor with click indicators, cross-fade transitions between steps via TransitionSeries, and intro/outro branding slates. These effects layer on top of the existing TutorialStep/TutorialComposition from Phase 65.

</domain>

<decisions>
## Implementation Decisions

### Zoom/pan effects
- Smooth ease-in-out animation — gently accelerates into zoom, holds, eases back out
- Audio-driven hold: zoom in at step start, hold for entire step duration while narration plays, zoom out in last 0.5s
- Default zoom scale: 1.5x (already set in StepSchema, per-step override supported)
- Steps without zoomTarget remain static full-frame — no subtle motion or drift
- Zoom uses CSS transforms and Remotion `interpolate()` as specified in COMP-04

### Text overlays & callouts
- Step number badge: small pill badge ("Step 3 of 12") in top-left corner with small margin
- Callout style: rounded-rect label with subtle arrow pointing to target element
- Callouts are script-driven only — only render when tutorial script explicitly defines annotation text
- Keyboard shortcut badges: styled key badges (e.g., "⌘+S") when script specifies a shortcut for the step
- Visual style: semi-transparent dark background (rgba black ~80%) with white text, rounded corners, subtle shadow
- Callout animation: fade in with subtle upward slide (~0.3s)
- No narration subtitles/caption bar — audio carries the explanation, keep screenshots clean

### Cursor animation
- Cursor style: macOS default arrow — familiar and natural on the UI screenshots
- Movement: smooth bezier curve path from previous position to click target (natural human-like motion)
- Click indicator: brief expanding ripple ring at click point that fades out (~0.3s)
- Cursor visibility: only appears on steps with click/hover actions defined in the script — info-only steps stay cursor-free

### Transitions (TransitionSeries)
- 0.5s cross-fade between tutorial steps — matches the 0.5s trailing silence from Phase 64 audio
- Replaces hard cuts from Phase 65's current Sequence-based composition

### Intro slate
- Content: tutorial title (from script), AtlusDeck logo/wordmark, brief description line
- Duration: 3 seconds
- Fade in from black on entry

### Outro slate
- Content: AtlusDeck logo, "Tutorial Complete" text, "Next: [Tutorial Name]" prompt (if logical next tutorial exists)
- Duration: 4 seconds
- Fade to black on exit

### Claude's Discretion
- Exact intro/outro slate layout and typography
- Cursor bezier path control points and movement speed
- Ripple ring color and animation parameters
- How to source/embed the macOS cursor image (SVG, PNG, or CSS-drawn)
- Callout arrow positioning algorithm (avoid overlapping UI elements)
- How TransitionSeries integrates with existing TutorialComposition architecture
- Whether intro/outro slates have narration audio or are silent

</decisions>

<specifics>
## Specific Ideas

- Cross-fade duration matching the trailing silence from Phase 64 (0.5s) creates a natural audio-visual rhythm — the pause in speech aligns with the visual transition
- Cursor should only appear when there's an action to show — keeping info-only steps clean and uncluttered
- Step badge gives viewers orientation ("where am I in this tutorial?") without a heavy progress bar
- The "Next: [Tutorial Name]" on outro drives continued viewing across the tutorial series

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TutorialStep.tsx`: Current component renders screenshot + audio — needs to be extended (or wrapped) with zoom, overlay, and cursor layers
- `TutorialComposition.tsx`: Current Sequence-based layout needs migration to TransitionSeries for cross-fades
- `StepSchema.zoomTarget`: Already defines `selector` and `scale` fields — zoom effect reads these directly
- `StepSchema.actions`: Click/hover actions define cursor animation targets — cursor component reads action selectors

### Established Patterns
- Remotion `interpolate()` for animation — zoom and cursor movement use this
- `staticFile()` for asset loading — cursor image, logo assets loaded this way
- Step-indexed pipeline: screenshots at `step-001.png`, audio at `step-001.wav` — effects layer on top
- `@remotion/media` Audio component — already used in TutorialStep

### Integration Points
- `TutorialStep.tsx`: Extended with zoom transform, overlay layers, cursor component
- `TutorialComposition.tsx`: Migrated from Sequence to TransitionSeries with cross-fade presentations
- `StepSchema` in `tutorial-script.ts`: May need new optional fields for callout text, keyboard shortcut hints
- `Root.tsx`: Intro/outro slates added as additional Sequences wrapping the tutorial composition
- Brand assets (logo): need to be added to `apps/tutorials/public/` for staticFile() access

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 66-visual-effects-polish*
*Context gathered: 2026-03-19*
