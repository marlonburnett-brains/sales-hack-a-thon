# Phase 65: Remotion Composition Core - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Build shared TutorialStep component, per-tutorial Remotion compositions, and MP4 render pipeline. Developer can render a complete tutorial MP4 from screenshots and narration audio with synchronized playback. Phase 66 handles all visual enhancements (zoom/pan, overlays, cursor animation, transitions, slates).

</domain>

<decisions>
## Implementation Decisions

### Video Format & Framerate
- Output resolution: 1920x1080 (4K captures from Phase 62 downscaled for crisp text)
- Framerate: 30 FPS — standard for screen recordings/tutorials
- Codec: H.264 — universal compatibility (browsers, Slack, YouTube, QuickTime)
- Quality: CRF 18 — visually lossless for text-heavy UI screenshots (~15-25 MB/min)
- Container: MP4

### Step Timing & Pacing
- Audio drives timing — each step's Remotion Sequence duration = audio duration from timing manifest
- No visual gaps between steps — Phase 64 already appends 0.5s trailing silence to each audio clip for natural breathing pause
- Missing audio fallback: show screenshot for 3 seconds with silence (don't skip, don't fail)
- Timing manifest (timing.json from Phase 64) is the single source of truth for all frame calculations

### Screenshot Presentation
- Scale to fill: downscale 4K (3840x2160) to exactly 1920x1080 — aspect ratio matches, no letterboxing
- Pure screenshot: full-frame edge-to-edge, no browser chrome or borders
- Hard cuts between steps — instant switch, no transitions (Phase 66 layers cross-fades via TransitionSeries)
- Remotion default interpolation for downscaling — no custom CSS image-rendering

### Render Pipeline & CLI
- `pnpm --filter tutorials render <tutorial-name>` for single tutorial
- `pnpm --filter tutorials render:all` for batch rendering all tutorials sequentially
- Output location: `apps/tutorials/videos/{tutorial-name}.mp4` — separate from screenshot output directory
- Pre-validation: check screenshots and timing.json exist before invoking Remotion, with clear "run capture and tts first" error
- Default `--concurrency=2` for M1 Pro memory safety, developer can override with `--concurrency N` flag

### Claude's Discretion
- Remotion project structure (root component, composition registration, webpack config)
- TutorialStep component internal architecture (how it loads images, sequences audio)
- How render:all discovers available tutorials (filesystem scan vs manifest)
- Turbo.json task configuration for render pipeline
- Whether to use Remotion's `<Audio>` component or `<OffthreadVideo>` for audio playback
- Internal error handling and progress reporting during renders

</decisions>

<specifics>
## Specific Ideas

- The timing manifest being self-contained is critical (decided in Phase 64) — Remotion compositions should load timing.json and have everything needed for frame calculation
- Follow existing CLI patterns from capture.ts and tts.ts — consistent developer experience across the pipeline
- videos/ directory should be gitignored like output/ and audio/

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/tutorials/src/types/timing-manifest.ts`: TimingManifestSchema with per-step duration, audio paths — Remotion reads this for Sequence durations
- `apps/tutorials/src/types/tutorial-script.ts`: StepSchema with step IDs, narration, zoomTarget — composition maps steps to screenshots
- `apps/tutorials/scripts/capture.ts`: subprocess management pattern — render script follows same spawn/lifecycle pattern
- `apps/tutorials/scripts/tts.ts`: CLI arg parsing pattern (no external lib, process.argv manual parsing) — render script follows same pattern

### Established Patterns
- Step-indexed pipeline: screenshots at `output/{tutorial}/step-001.png`, audio at `audio/{tutorial}/step-001.wav` — consistent naming for composition mapping
- Zod schema validation at load time — timing manifest validated before render
- No external CLI parsing library — process.argv manual parsing (Phase 64 decision)
- Subprocess lifecycle management with spawn — render script manages Remotion CLI process

### Integration Points
- `apps/tutorials/output/{tutorial}/step-*.png`: screenshot input files (from Phase 62 capture)
- `apps/tutorials/audio/{tutorial}/timing.json`: timing manifest input (from Phase 64 TTS)
- `apps/tutorials/audio/{tutorial}/step-*.wav`: audio input files (from Phase 64 TTS)
- `apps/tutorials/videos/{tutorial-name}.mp4`: render output (new)
- `apps/tutorials/package.json`: needs `render`, `render:all` scripts and Remotion dependencies
- `turbo.json`: needs `render` task definition (depends on `capture` and `tts`)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 65-remotion-composition-core*
*Context gathered: 2026-03-19*
