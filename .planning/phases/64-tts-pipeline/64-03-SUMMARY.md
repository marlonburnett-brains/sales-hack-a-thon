---
phase: 64-tts-pipeline
plan: 03
subsystem: tts
tags: [tts, cli, orchestrator, kokoro, chatterbox, ffmpeg, timing-manifest]

# Dependency graph
requires:
  - phase: 64-tts-pipeline plan 01
    provides: TTSEngine interface, KokoroEngine, postProcessAudio, manifest CRUD, wav-utils
  - phase: 64-tts-pipeline plan 02
    provides: ChatterboxEngine with Python sidecar
provides:
  - TTS orchestrator CLI (pnpm --filter tutorials tts <tutorial>)
  - package.json tts/tts:draft/tts:prod scripts
  - turbo.json tts task definition
  - Reference voice placeholder for Chatterbox
affects: [65-remotion-composition]

# Tech tracking
tech-stack:
  added: []
  patterns: [cli-arg-parsing-no-deps, graceful-step-failure, single-step-regeneration]

key-files:
  created:
    - apps/tutorials/scripts/tts.ts
    - apps/tutorials/assets/reference-voice.txt
  modified:
    - apps/tutorials/package.json
    - turbo.json

key-decisions:
  - "No external CLI parsing library -- process.argv manual parsing keeps zero new dependencies"
  - "Graceful step failure in full-tutorial mode -- continues to next steps, logs warnings"
  - "ffmpeg check at startup before loading tutorial script -- fail fast with install instructions"

patterns-established:
  - "CLI orchestrator pattern: parse args, startup checks, load script, instantiate engine, loop steps, write manifest"
  - "Single-step regeneration via updateManifestEntry preserves other step entries"

requirements-completed: [TTS-01, TTS-02, TTS-03, TTS-04]

# Metrics
duration: 2min
completed: 2026-03-19
---

# Phase 64 Plan 03: TTS Orchestrator CLI Summary

**TTS orchestrator CLI wiring Kokoro/Chatterbox engines with per-step WAV generation, ffmpeg post-processing, and timing manifest output**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T12:21:11Z
- **Completed:** 2026-03-19T12:23:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- TTS orchestrator CLI parses tutorial name, --engine, and --step flags with zero external dependencies
- Full pipeline: load script, instantiate engine, generate per-step WAVs, post-process, write timing manifest
- Single-step regeneration (--step flag) updates manifest entry without rewriting entire manifest
- package.json has tts/tts:draft/tts:prod scripts; turbo.json has tts task definition
- Graceful error handling: ffmpeg check at startup, step failures logged as warnings in full-tutorial mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TTS orchestrator CLI script** - `2606e57` (feat)
2. **Task 2: Add package.json scripts and turbo.json task** - `f024fef` (feat)

## Files Created/Modified
- `apps/tutorials/scripts/tts.ts` - Main TTS orchestrator CLI (190 lines)
- `apps/tutorials/assets/reference-voice.txt` - Placeholder for Chatterbox reference voice
- `apps/tutorials/package.json` - Added tts, tts:draft, tts:prod scripts
- `turbo.json` - Added tts task with cache disabled

## Decisions Made
- No external CLI parsing library -- process.argv manual parsing keeps zero new dependencies
- ffmpeg checked at startup before loading tutorial script for fast failure
- Graceful step failure in full-tutorial mode continues to next steps (single-step mode exits immediately)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- ffmpeg not installed in build environment -- CLI correctly detects and prints install instructions (expected behavior per plan)

## User Setup Required

None - no external service configuration required. ffmpeg is a runtime dependency with clear error messaging if missing.

## Next Phase Readiness
- Complete TTS pipeline ready for end-to-end use with Kokoro (draft) engine
- Chatterbox (production) engine available after running setup-chatterbox.sh
- Timing manifest output feeds directly into Phase 65 Remotion compositions
- All four TTS requirements (TTS-01 through TTS-04) satisfied

---
*Phase: 64-tts-pipeline*
*Completed: 2026-03-19*
