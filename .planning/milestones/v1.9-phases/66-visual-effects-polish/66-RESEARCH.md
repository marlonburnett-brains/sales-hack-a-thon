# Phase 66: Visual Effects & Polish — Research

**Researched:** 2026-03-19
**Phase Goal:** Tutorial videos include professional visual enhancements that guide the viewer's attention and provide context
**Requirements:** COMP-04, COMP-05, COMP-06, COMP-07, COMP-08

## Existing Architecture

### Current Remotion Stack (Phase 65 Output)

The composition layer lives in `apps/tutorials/src/remotion/`:

- **Root.tsx** — `RemotionRoot` registers a single `<Composition id="tutorial">` with `calculateMetadata` that sums step durations. Exports `StepInput` (stepId, audioFile, durationMs) and `TutorialProps` (tutorialName, steps[], totalDurationMs). FPS=30, FALLBACK_DURATION_MS=3000.

- **TutorialComposition.tsx** — Maps `steps` to `<Sequence>` components with cumulative `from` offsets. Each sequence wraps `<TutorialStep>`. Uses `layout="none"`.

- **TutorialStep.tsx** — Renders `<AbsoluteFill>` → `<Img>` (edge-to-edge screenshot) + conditional `<Audio>`. Receives tutorialName, stepId, audioFile, durationMs, hasAudio.

- **index.ts** — `registerRoot(RemotionRoot)` entry point.

### Tutorial Script Schema (`src/types/tutorial-script.ts`)

StepSchema already defines:
- `zoomTarget?: { selector: string; scale: number (default 1.5) }` — ready for COMP-04
- `actions?: Array<ClickAction | FillAction | SelectAction | WaitAction | HoverAction | KeyboardAction>` — each has `selector` field, ready for COMP-06 cursor targets
- `id`, `url`, `narration`, `waitFor`, `emotion`, etc.

TutorialScriptSchema defines: `id`, `title`, `description`, `steps[]`, `fixtures?`, `touchType?`

### Schema Extensions Needed

StepSchema needs new optional fields for COMP-05:
- `callout?: { text: string; targetSelector: string }` — annotation text pointing at a UI element
- `shortcutKey?: string` — keyboard shortcut badge text (e.g., "⌘+S")

### Timing Manifest (`src/types/timing-manifest.ts`)

TimingEntry: stepId, audioFile, durationMs, narration, wordCount
TimingManifest: steps[], totalDurationMs, engine, generatedAt

### Render Pipeline (`scripts/render.ts`)

- Pre-validates timing.json, screenshots, audio
- Builds inputProps from manifest
- Uses `bundle()` + `selectComposition()` + `renderMedia()`
- Exports `renderTutorial()` for batch use

### Package State

Currently installed: remotion@4.0.436, @remotion/bundler, @remotion/cli, @remotion/media, @remotion/renderer
**Missing:** `@remotion/transitions@4.0.436` — required for COMP-07

## Technical Research

### COMP-04: Zoom/Pan Effects

**Approach:** CSS `transform: scale(X) translate(Y, Z)` animated via Remotion's `interpolate()`.

**Implementation pattern:**
```tsx
const frame = useCurrentFrame();
const durationInFrames = useVideoConfig().durationInFrames;
const zoomInDuration = 15; // 0.5s at 30fps
const zoomOutStart = durationInFrames - 15; // last 0.5s

const scale = interpolate(frame, 
  [0, zoomInDuration, zoomOutStart, durationInFrames],
  [1, targetScale, targetScale, 1],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);
```

**Key decisions from CONTEXT.md:**
- Ease-in-out with `Easing.inOut(Easing.ease)` from Remotion
- Audio-driven hold: zoom in at start, hold for step duration, zoom out in last 0.5s (15 frames)
- Default 1.5x scale (from StepSchema.zoomTarget.scale)
- Steps without zoomTarget: no transform applied (scale=1 passthrough)

**Transform origin:** Must compute from `zoomTarget.selector` coordinates. Since we're working with static screenshots (not live DOM), the selector is a reference for the planner/author — the actual pixel coordinates need to be stored or computed. Options:
1. Add `x`, `y` fields to zoomTarget (percentage-based coordinates)
2. Use selector during capture to extract bounding box and store in manifest

**Recommended:** Add optional `x` and `y` percentage fields to zoomTarget. The capture pipeline can populate these from the selector's bounding box, or authors can specify manually. The zoom component uses these as `transformOrigin`.

### COMP-05: Text Overlays & Callouts

**Components needed:**

1. **StepBadge** — "Step 3 of 12" pill in top-left. Pure component using `useCurrentFrame()` for fade-in animation.
   - Style: semi-transparent dark bg (rgba(0,0,0,0.8)), white text, rounded corners, subtle shadow
   - Position: top-left with small margin (~16px)

2. **Callout** — Rounded-rect label with subtle arrow pointing to target element.
   - Only renders when step defines `callout` field
   - Animation: fade in with subtle upward slide (~0.3s = 9 frames at 30fps)
   - Needs target position (x, y percentages) for arrow direction

3. **ShortcutBadge** — Styled key badge (e.g., "⌘+S")
   - Only renders when step defines `shortcutKey` field
   - Style consistent with step badge (dark bg, white text, rounded)

**Animation pattern:** Use `interpolate()` with frame-based fade-in:
```tsx
const opacity = interpolate(frame, [0, 9], [0, 1], { extrapolateRight: 'clamp' });
const translateY = interpolate(frame, [0, 9], [10, 0], { extrapolateRight: 'clamp' });
```

### COMP-06: Animated Cursor

**Approach:** Render a cursor image (macOS arrow) as an absolutely-positioned element that moves via CSS transforms.

**Cursor image:** SVG of macOS default arrow cursor, loaded via `staticFile()`. Needs to be added to `apps/tutorials/public/` or project root (since publicDir=".").

**Movement pattern:** Smooth bezier curve from previous position to current click target.
- Use Remotion's `interpolate()` for X/Y position
- Apply easing for natural human-like motion: `Easing.bezier(0.25, 0.1, 0.25, 1)` (CSS ease equivalent)
- Movement phase: first ~0.5s of step (15 frames)
- Idle phase: hold at target position for rest of step

**Click indicator:** Expanding ripple ring at click point.
- Triggered after cursor arrives at target
- Duration: ~0.3s (9 frames)
- Style: circle border that expands and fades out
- Color: semi-transparent blue or neutral gray

**Visibility rules:**
- Only on steps with `actions` containing click or hover types
- Extract target selector from first click/hover action
- Steps without click/hover actions: no cursor rendered

**Position tracking:** Need to pass previous step's cursor position to current step. Options:
1. Compute all cursor positions upfront in TutorialComposition and pass as props
2. Each step receives `cursorFrom` and `cursorTo` coordinates

**Recommended:** Compute cursor path in TutorialComposition (or a helper), pass positions as props to each TutorialStep.

### COMP-07: TransitionSeries Cross-Fades

**Package:** `@remotion/transitions@4.0.436` (must match exact Remotion version)

**Migration path:** Replace `<Sequence>` in TutorialComposition with `<TransitionSeries>`:

```tsx
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

const CROSSFADE_FRAMES = 15; // 0.5s at 30fps

<TransitionSeries>
  {steps.flatMap((step, i) => {
    const elements = [];
    elements.push(
      <TransitionSeries.Sequence key={step.stepId} durationInFrames={stepFrames}>
        <TutorialStep ... />
      </TransitionSeries.Sequence>
    );
    if (i < steps.length - 1) {
      elements.push(
        <TransitionSeries.Transition
          key={`transition-${i}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: CROSSFADE_FRAMES })}
        />
      );
    }
    return elements;
  })}
</TransitionSeries>
```

**Duration math impact:** Total duration = sum(step_frames) - (num_transitions * CROSSFADE_FRAMES). The `calculateMetadata` in Root.tsx MUST be updated to account for this.

**Rule constraint:** Transition durationInFrames (15) must be less than any step's durationInFrames. At 30fps, minimum step duration is 3s fallback = 90 frames, so 15-frame transitions are safe.

### COMP-08: Intro/Outro Slates

**IntroSlate component:**
- Content: tutorial title (from props), AtlusDeck logo/wordmark, brief description
- Duration: 3s = 90 frames at 30fps
- Animation: fade in from black (first ~1s = 30 frames)
- Layout: centered text over dark/branded background

**OutroSlate component:**
- Content: AtlusDeck logo, "Tutorial Complete" text, optional "Next: [Tutorial Name]"
- Duration: 4s = 120 frames at 30fps
- Animation: fade to black (last ~1s = 30 frames)

**Integration:** Intro and outro are additional TransitionSeries.Sequence items wrapping the tutorial steps. They need cross-fade transitions too.

**Brand assets needed:**
- AtlusDeck logo/wordmark — SVG or PNG, placed at project root for `staticFile()` access
- If no official asset exists yet, use text-based wordmark as placeholder

**Props extension:** TutorialProps needs `title`, `description`, and optionally `nextTutorialName` for the outro's "Next:" prompt.

### Duration Calculation Update

With intro (90f), outro (120f), and cross-fades (15f each), the total frame calculation becomes:

```
totalFrames = introFrames + sum(stepFrames) + outroFrames - (numTransitions * crossfadeFrames)
numTransitions = numSteps + 1 (intro→step1, between steps, lastStep→outro)
```

This must be reflected in `calculateMetadata` in Root.tsx.

### Props Extensions Required

**StepInput** (Root.tsx) needs additional fields:
- `zoomTarget?: { scale: number; x: number; y: number }` — zoom parameters
- `callout?: { text: string; x: number; y: number }` — overlay annotation
- `shortcutKey?: string` — keyboard shortcut badge
- `cursorTarget?: { x: number; y: number }` — cursor destination
- `hasCursorAction: boolean` — whether to show cursor
- `stepIndex: number` — for "Step N of M" badge
- `totalSteps: number` — for badge denominator

**TutorialProps** needs:
- `title: string` — for intro slate
- `description: string` — for intro slate
- `nextTutorialName?: string` — for outro slate "Next:" prompt

### Render Pipeline Updates

`scripts/render.ts` `buildInputProps()` must:
1. Load the tutorial script (not just timing manifest) to access zoomTarget, actions, callout, shortcutKey
2. Compute cursor positions from actions
3. Pass extended StepInput with visual effect data
4. Include title, description from script

## File Structure Plan

New files to create:
```
apps/tutorials/src/remotion/
├── effects/
│   ├── ZoomPan.tsx          # COMP-04: zoom/pan wrapper
│   ├── StepBadge.tsx        # COMP-05: step number pill
│   ├── Callout.tsx          # COMP-05: annotation callout
│   ├── ShortcutBadge.tsx    # COMP-05: keyboard shortcut badge
│   ├── AnimatedCursor.tsx   # COMP-06: cursor + click ripple
│   ├── IntroSlate.tsx       # COMP-08: intro branding slate
│   └── OutroSlate.tsx       # COMP-08: outro completion slate
```

Files to modify:
```
apps/tutorials/src/remotion/
├── TutorialStep.tsx         # Wire in zoom, overlays, cursor
├── TutorialComposition.tsx  # Migrate Sequence→TransitionSeries, add intro/outro
├── Root.tsx                 # Extend types, update calculateMetadata
apps/tutorials/src/types/
├── tutorial-script.ts       # Add callout, shortcutKey to StepSchema
apps/tutorials/scripts/
├── render.ts                # Load script, compute visual effect props
apps/tutorials/package.json  # Add @remotion/transitions
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| @remotion/transitions version mismatch | Build failure | Pin exact version 4.0.436 to match all other Remotion packages |
| TransitionSeries duration math error | Video too short/long | Thorough calculateMetadata update with explicit transition count |
| Cursor position data missing from scripts | Cursor won't render | Graceful fallback — cursor only renders when position data available |
| Brand logo asset missing | Intro/outro look incomplete | Text-based wordmark fallback |
| Performance: many overlays per frame | Slow render | CSS-only animations via interpolate() — no canvas/WebGL |

## Dependencies

- Phase 65 (complete): Remotion composition layer, render pipeline
- No external dependencies beyond @remotion/transitions@4.0.436

---

*Researched: 2026-03-19*
*Phase: 66-visual-effects-polish*
