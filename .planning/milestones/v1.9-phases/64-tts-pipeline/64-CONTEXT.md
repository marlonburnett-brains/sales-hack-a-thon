# Phase 64: TTS Pipeline - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate Kokoro (draft) and Chatterbox-Turbo (production) TTS engines into the tutorials workspace. Developer can generate narration audio files from tutorial script text using either engine, with a timing manifest that feeds Remotion composition frame counts. Pipeline supports single-step and full-tutorial generation with an `--engine` flag to switch between draft and production.

</domain>

<decisions>
## Implementation Decisions

### Voice & Tone
- Single consistent narrator voice across all ~17 tutorials — brand consistency
- Female, warm & professional tone — think product demo narrator (confident but approachable)
- Kokoro voice preset: warm female (e.g., af_heart or similar — Claude picks best-sounding preset)
- Chatterbox reference audio: Claude sources a short (~10s) female narrator reference clip (royalty-free or Kokoro-generated) for voice consistency
- Fixed global speaking pace — same rate for all tutorials, no per-tutorial or per-step speed overrides
- Light emotion hints via Chatterbox emotion tags — [cheerful] for intros, [encouraging] for completions, etc.
- Emotion tags are explicit per step: add optional `emotion` field to StepSchema (AI script generation sets these)
- 0.5 seconds trailing silence appended to each step's audio for natural breathing pause

### Audio Specifications
- Sample rate: 24kHz (native output of both Kokoro and Chatterbox — no resampling)
- Channels: Mono (speech is inherently mono, half the file size)
- Format: WAV (lossless, consistent with Phase 62 PNG quality-first approach)
- Loudness normalization: -16 LUFS broadcast standard applied as post-processing step (ffmpeg or Node audio lib)
- Trailing silence: 0.5s appended to each .wav file by the TTS pipeline

### Timing Manifest
- Per-tutorial `timing.json` file alongside audio files in `apps/tutorials/audio/{tutorial}/timing.json`
- Generated automatically as a side effect of TTS generation — no separate command
- Per-step fields: step ID, audio file path (relative), duration in milliseconds, narration text, word count
- Per-tutorial fields: total duration (sum of all steps), engine used (kokoro/chatterbox), generation timestamp
- Self-contained: Remotion only needs timing.json to build the composition (no cross-referencing with script.json)

### Python Sidecar Setup
- Local venv at `apps/tutorials/.venv/` managed by `scripts/setup-chatterbox.sh`
- Setup script creates venv, installs chatterbox-tts + PyTorch with MPS support, and downloads the Chatterbox model (~2GB)
- Single setup = everything ready — developer runs once, TTS pipeline detects and uses the venv
- Error with clear setup instructions when `--engine chatterbox` is used but venv/model doesn't exist — no silent fallback to Kokoro
- `.venv/` directory gitignored

### Pipeline Granularity
- Default: process all steps in a tutorial
- `--step step-003` flag: regenerate a single step's audio (useful for iteration)
- `--tutorial getting-started` flag: target a specific tutorial (established in Phase 62)
- Single-step regeneration updates the corresponding entry in timing.json without rewriting the whole manifest

### Claude's Discretion
- Exact Kokoro voice preset selection (test a few warm female presets, pick best)
- Chatterbox reference clip sourcing approach
- Loudness normalization implementation (ffmpeg subprocess vs Node audio library)
- Whether to use kokoro-js ONNX quantization level (q8 vs fp32) — balance quality vs speed
- Internal pipeline orchestration (sequential vs parallel step generation)
- Exact emotion tag vocabulary and placement heuristics for AI script generation

</decisions>

<specifics>
## Specific Ideas

- Emotion should be light and natural — not every step needs a tag, just key moments (intro, completion, complex workflow transitions)
- The manifest being self-contained is important — Remotion compositions should load a single file and have everything they need
- Single-step regeneration is for iteration speed — don't want to wait for all 20 steps when tweaking one narration line

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/tutorials/scripts/capture.ts`: subprocess management pattern (spawn, lifecycle, port management) — same pattern applies to Python sidecar process
- `apps/tutorials/src/types/tutorial-script.ts`: StepSchema with `narration: z.string()` — TTS reads narration text from here, needs `emotion` field added
- `apps/tutorials/fixtures/loader.ts`: file loading with Zod validation — timing manifest can follow same validation pattern

### Established Patterns
- Step-indexed pipeline: screenshots at `step-001.png`, audio will be `step-001.wav` — consistent naming
- Subprocess lifecycle: capture.ts manages mock server + Next.js with spawn — Chatterbox Python sidecar follows same pattern
- Zod schema validation at generation/load time — timing manifest should have a Zod schema
- Output in `apps/tutorials/output/` (gitignored) — audio in `apps/tutorials/audio/` (also gitignored)

### Integration Points
- Tutorial script JSON (`script.json`): source of narration text and step IDs for TTS
- `apps/tutorials/audio/{tutorial}/timing.json`: consumed by Phase 65 Remotion compositions for frame calculation
- `apps/tutorials/package.json`: needs `tts`, `tts:draft`, `tts:prod` scripts added
- `turbo.json`: needs `tts` task definition (parallel with `capture`, both feed into `render`)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 64-tts-pipeline*
*Context gathered: 2026-03-19*
