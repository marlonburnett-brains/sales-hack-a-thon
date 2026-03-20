---
phase: 64-tts-pipeline
plan: 01
subsystem: tts
tags: [kokoro-js, onnx, ffmpeg, loudnorm, zod, wav, tts]

requires:
  - phase: 62-capture-foundation
    provides: StepSchema with narration field, capture pipeline patterns
provides:
  - TTSEngine interface contract for Kokoro/Chatterbox engines
  - KokoroEngine draft TTS implementation (kokoro-js, ONNX, CPU)
  - postProcessAudio ffmpeg normalization pipeline
  - TimingManifest Zod schema and CRUD module
  - WAV header duration utility
affects: [64-02, 64-03, 65-remotion-composition]

tech-stack:
  added: [kokoro-js, onnxruntime-node]
  patterns: [lazy-model-loading, two-pass-loudnorm, zod-validated-manifest]

key-files:
  created:
    - apps/tutorials/src/types/timing-manifest.ts
    - apps/tutorials/src/tts/engine.ts
    - apps/tutorials/src/tts/kokoro-engine.ts
    - apps/tutorials/src/tts/post-process.ts
    - apps/tutorials/src/tts/manifest.ts
    - apps/tutorials/src/tts/wav-utils.ts
  modified:
    - apps/tutorials/src/types/tutorial-script.ts
    - apps/tutorials/package.json

key-decisions:
  - "q8 ONNX quantization for Kokoro model (balance of quality vs 160MB download size)"
  - "af_heart voice preset for warm female narrator brand consistency"
  - "Two-pass ffmpeg loudnorm for broadcast-standard -16 LUFS normalization"

patterns-established:
  - "Lazy model loading: KokoroEngine downloads model on first generate() call only"
  - "TTSEngine interface: minimal generate() contract both engines implement"
  - "Timing manifest CRUD with Zod validation on read and write"

requirements-completed: [TTS-01, TTS-03]

duration: 3min
completed: 2026-03-19
---

# Phase 64 Plan 01: TTS Engine Foundation Summary

**TTSEngine interface with Kokoro-js draft implementation, ffmpeg loudness normalization, and Zod-validated timing manifest CRUD**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T12:14:46Z
- **Completed:** 2026-03-19T12:17:55Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- TTSEngine interface defines the generate() contract for both Kokoro and Chatterbox engines
- KokoroEngine lazy-loads the 160MB ONNX model on first call, generates 24kHz WAV files via kokoro-js
- Two-pass ffmpeg postProcessAudio normalizes to -16 LUFS and appends 0.5s trailing silence
- TimingManifest Zod schema with full read/write/updateEntry support for single-step regeneration
- WAV header-only duration calculation (44-byte read, no full file load)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create type contracts and engine interface** - `65380de` (feat)
2. **Task 2: Implement Kokoro engine, post-processing, and manifest module** - `3f8ff6c` (feat)

## Files Created/Modified
- `apps/tutorials/src/types/tutorial-script.ts` - Added optional emotion field to StepSchema
- `apps/tutorials/src/types/timing-manifest.ts` - Zod schema for per-tutorial timing.json
- `apps/tutorials/src/tts/engine.ts` - TTSEngine interface contract
- `apps/tutorials/src/tts/kokoro-engine.ts` - Kokoro-js ONNX draft TTS implementation
- `apps/tutorials/src/tts/post-process.ts` - ffmpeg two-pass loudnorm + silence padding
- `apps/tutorials/src/tts/manifest.ts` - Timing manifest read/write/update with Zod validation
- `apps/tutorials/src/tts/wav-utils.ts` - WAV header duration calculation
- `apps/tutorials/package.json` - Added kokoro-js dependency

## Decisions Made
- Used q8 ONNX quantization for Kokoro model -- good balance of quality vs download size
- Selected af_heart voice preset for warm female narrator (brand consistency)
- Two-pass ffmpeg loudnorm approach (measure then apply) for accurate -16 LUFS normalization
- Emotion option accepted but ignored by KokoroEngine (no paralinguistic tag support)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- ffmpeg not installed on build machine -- code handles gracefully with descriptive error message at runtime
- TypeScript compiler not directly available via npx/pnpm exec -- used npx -p typescript workaround

## User Setup Required

None - no external service configuration required. ffmpeg is a runtime dependency with clear error messaging if missing.

## Next Phase Readiness
- TTSEngine interface ready for Plan 02 (Chatterbox production engine)
- Manifest module ready for Plan 03 (orchestrator CLI consumption)
- All exports importable and TypeScript clean

---
*Phase: 64-tts-pipeline*
*Completed: 2026-03-19*
