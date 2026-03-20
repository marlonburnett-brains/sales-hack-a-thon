---
phase: 64-tts-pipeline
plan: 02
subsystem: tts
tags: [chatterbox, python, mps, apple-silicon, tts, subprocess]

# Dependency graph
requires:
  - phase: 64-tts-pipeline plan 01
    provides: TTSEngine interface and wav-utils
provides:
  - Chatterbox-Turbo Python sidecar setup script
  - Python generation script with CPU-first MPS loading
  - ChatterboxEngine TypeScript wrapper implementing TTSEngine
affects: [64-tts-pipeline plan 03]

# Tech tracking
tech-stack:
  added: [chatterbox-tts (pip), torch, torchaudio]
  patterns: [python-subprocess-sidecar, cpu-first-mps-loading, paralinguistic-emotion-tags]

key-files:
  created:
    - apps/tutorials/scripts/setup-chatterbox.sh
    - apps/tutorials/scripts/chatterbox-generate.py
    - apps/tutorials/src/tts/chatterbox-engine.ts
  modified:
    - apps/tutorials/.gitignore

key-decisions:
  - "ChatterboxEngine imports TTSEngine from Plan 01 paths rather than duplicating interface"
  - "Model loaded to CPU first then components moved individually to MPS to avoid tensor allocation errors"

patterns-established:
  - "Python sidecar pattern: TypeScript spawns venv Python with CLI args, captures stderr for error reporting"
  - "Explicit failure over silent fallback: throw with setup instructions when dependencies missing"

requirements-completed: [TTS-02]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 64 Plan 02: Chatterbox Engine Summary

**Chatterbox-Turbo production TTS engine with Python sidecar, CPU-first MPS loading, and emotion tag support**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T12:15:02Z
- **Completed:** 2026-03-19T12:19:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Setup script creates Python 3.11 venv with PyTorch and chatterbox-tts in one command
- Python generation script loads Chatterbox-Turbo model to CPU first then moves t3/s3gen/ve components to MPS
- ChatterboxEngine TypeScript wrapper spawns Python subprocess with proper error handling
- Clear error messages when venv or reference audio missing -- no silent Kokoro fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Chatterbox setup script and Python generation script** - `65380de` (feat)
2. **Task 2: Create ChatterboxEngine TypeScript wrapper** - `73bff3d` (feat)

## Files Created/Modified
- `apps/tutorials/scripts/setup-chatterbox.sh` - One-time venv creation with PyTorch + chatterbox-tts
- `apps/tutorials/scripts/chatterbox-generate.py` - Single-WAV generation via Chatterbox-Turbo with MPS support
- `apps/tutorials/src/tts/chatterbox-engine.ts` - ChatterboxEngine implementing TTSEngine interface
- `apps/tutorials/.gitignore` - Added .venv/ and audio/ entries

## Decisions Made
- Imported TTSEngine and getWavDurationMs from Plan 01 expected paths rather than duplicating -- files will exist once Plan 01 completes
- Used stderr for Python script diagnostic output (device info, completion message) to keep stdout clean for potential future structured output

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Developer runs `bash scripts/setup-chatterbox.sh` when ready to use the Chatterbox engine.

## Next Phase Readiness
- ChatterboxEngine ready for integration into TTS orchestrator (Plan 03)
- Depends on Plan 01 completing first to provide TTSEngine interface and wav-utils
- Python venv setup is a one-time manual step before first Chatterbox use

---
*Phase: 64-tts-pipeline*
*Completed: 2026-03-19*
