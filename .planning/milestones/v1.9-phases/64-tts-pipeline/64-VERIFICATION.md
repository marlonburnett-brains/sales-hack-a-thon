---
phase: 64-tts-pipeline
verified: 2026-03-19T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 64: TTS Pipeline Verification Report

**Phase Goal:** Developer can generate narration audio files from script text using either draft or production TTS engine
**Verified:** 2026-03-19
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                               | Status     | Evidence                                                                                          |
|----|-------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| 1  | Kokoro generates a WAV file from narration text with no Python dependency           | VERIFIED   | `kokoro-engine.ts` lazy-loads `kokoro-js` via dynamic import, no Python reference anywhere       |
| 2  | Generated WAV is loudness-normalized to -16 LUFS with 0.5s trailing silence        | VERIFIED   | `post-process.ts` two-pass ffmpeg loudnorm at I=-16:TP=-1.5, `apad=pad_dur=0.5`                  |
| 3  | Timing manifest is generated with per-step duration, narration, and word count      | VERIFIED   | `TimingEntrySchema` has `durationMs`, `narration`, `wordCount`; `manifest.ts` writes/updates     |
| 4  | Single-step regeneration updates timing.json entry without rewriting whole manifest | VERIFIED   | `updateManifestEntry()` in `manifest.ts` finds entry by stepId, replaces, recalcs total          |
| 5  | Setup script creates a Python venv with chatterbox-tts and PyTorch installed        | VERIFIED   | `setup-chatterbox.sh` uses `python3.11 -m venv`, installs `torch torchaudio` then `chatterbox-tts`|
| 6  | Python generation script loads Chatterbox model to CPU first then moves to MPS     | VERIFIED   | `chatterbox-generate.py` calls `from_pretrained("cpu")`, then conditionally moves t3/s3gen/ve    |
| 7  | ChatterboxEngine spawns Python subprocess and returns WAV duration                  | VERIFIED   | `chatterbox-engine.ts` spawns venv Python with `chatterbox-generate.py` args, returns `getWavDurationMs` |
| 8  | Clear error message shown when venv/model missing instead of silent fallback        | VERIFIED   | Throws `"Chatterbox venv not found. Run: bash scripts/setup-chatterbox.sh"` on missing venv      |
| 9  | Emotion tags are prepended to text for Chatterbox (it supports paralinguistic tags) | VERIFIED   | `chatterbox-generate.py`: `text = f"[{args.emotion}] {text}"` when emotion provided             |
| 10 | Developer can run `pnpm --filter tutorials tts <name>` and get WAVs + timing.json  | VERIFIED   | `tts.ts` full pipeline: parse args, check ffmpeg, load script, engine loop, write manifest       |
| 11 | Developer can switch between Kokoro and Chatterbox with --engine flag               | VERIFIED   | `parseArgs()` in `tts.ts` branches `new KokoroEngine()` vs `new ChatterboxEngine(...)` on flag   |
| 12 | Pipeline checks for ffmpeg at startup and prints install instructions if missing    | VERIFIED   | `checkFfmpeg()` called before script loading in `main()`, error: `"ffmpeg not found. Install with: brew install ffmpeg"` |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact                                                    | Provides                            | Exists | Lines | Status        |
|-------------------------------------------------------------|-------------------------------------|--------|-------|---------------|
| `apps/tutorials/src/types/timing-manifest.ts`               | Zod schema for timing.json          | YES    | 35    | VERIFIED      |
| `apps/tutorials/src/tts/engine.ts`                          | TTSEngine interface contract        | YES    | 16    | VERIFIED      |
| `apps/tutorials/src/tts/kokoro-engine.ts`                   | Kokoro-js TTS implementation        | YES    | 51    | VERIFIED      |
| `apps/tutorials/src/tts/post-process.ts`                    | ffmpeg normalization + silence      | YES    | 163   | VERIFIED      |
| `apps/tutorials/src/tts/manifest.ts`                        | Timing manifest read/write/update   | YES    | 87    | VERIFIED      |
| `apps/tutorials/src/tts/wav-utils.ts`                       | WAV duration from header            | YES    | 34    | VERIFIED      |
| `apps/tutorials/scripts/setup-chatterbox.sh`                | One-time venv + model setup         | YES    | 24    | VERIFIED      |
| `apps/tutorials/scripts/chatterbox-generate.py`             | Chatterbox-Turbo single-WAV gen     | YES    | 50    | VERIFIED      |
| `apps/tutorials/src/tts/chatterbox-engine.ts`               | ChatterboxEngine implementing TTSEngine | YES | 76  | VERIFIED      |
| `apps/tutorials/scripts/tts.ts`                             | Main TTS CLI orchestrator           | YES    | 244   | VERIFIED      |
| `apps/tutorials/package.json`                               | tts, tts:draft, tts:prod scripts    | YES    | 23    | VERIFIED      |
| `turbo.json`                                                | tts task definition                 | YES    | —     | VERIFIED      |
| `apps/tutorials/assets/reference-voice.txt`                 | Chatterbox reference voice placeholder | YES | 1    | VERIFIED      |
| `apps/tutorials/.gitignore`                                 | .venv/ and audio/ excluded          | YES    | 7     | VERIFIED      |
| `apps/tutorials/src/types/tutorial-script.ts`               | emotion field added to StepSchema   | YES    | 108   | VERIFIED      |

### Key Link Verification

| From                                  | To                                       | Via                                          | Pattern Found                                         | Status     |
|---------------------------------------|------------------------------------------|----------------------------------------------|-------------------------------------------------------|------------|
| `kokoro-engine.ts`                    | `kokoro-js`                              | `KokoroTTS.from_pretrained()` dynamic import | `KokoroTTS.from_pretrained` at line 25                | WIRED      |
| `post-process.ts`                     | `ffmpeg`                                 | spawn subprocess, loudnorm filter            | `loudnorm=I=-16...` at lines 117, 127                 | WIRED      |
| `manifest.ts`                         | `types/timing-manifest.ts`              | Zod parse on read/write                      | `TimingManifestSchema.parse` at lines 28, 40          | WIRED      |
| `chatterbox-engine.ts`                | `scripts/chatterbox-generate.py`        | spawn Python subprocess                      | `"scripts/chatterbox-generate.py"` at line 39         | WIRED      |
| `chatterbox-generate.py`              | `chatterbox-tts`                         | `from_pretrained("cpu")` CPU-first loading   | `ChatterboxTurboTTS.from_pretrained("cpu")` at line 28| WIRED      |
| `tts.ts`                              | `kokoro-engine.ts`                       | import + instantiate when engine=kokoro      | `KokoroEngine` imported line 7, used line 114         | WIRED      |
| `tts.ts`                              | `chatterbox-engine.ts`                   | import + instantiate when engine=chatterbox  | `ChatterboxEngine` imported line 8, used line 116     | WIRED      |
| `tts.ts`                              | `post-process.ts`                        | `postProcessAudio` after each WAV gen        | imported line 9, called line 168                      | WIRED      |
| `tts.ts`                              | `manifest.ts`                            | `writeManifest`/`updateManifestEntry`        | imported line 10, called lines 210, 219               | WIRED      |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                           | Status      | Evidence                                                                              |
|-------------|-------------|---------------------------------------------------------------------------------------|-------------|---------------------------------------------------------------------------------------|
| TTS-01      | 64-01, 64-03 | Developer can generate draft narration .wav files using kokoro-js on CPU             | SATISFIED   | `KokoroEngine` lazy-loads kokoro-js ONNX model, generates WAV; wired in `tts.ts`     |
| TTS-02      | 64-02, 64-03 | Developer can generate production .wav files using Chatterbox-Turbo on M1 MPS via Python sidecar | SATISFIED | `ChatterboxEngine` + Python sidecar; `setup-chatterbox.sh` venv; `tts.ts` `--engine chatterbox` path |
| TTS-03      | 64-01, 64-03 | Pipeline generates timing manifest from audio durations for Remotion frame counts    | SATISFIED   | `TimingManifestSchema` with `durationMs` per step; `writeManifest`/`updateManifestEntry` called from `tts.ts` |
| TTS-04      | 64-03        | Developer can switch between draft (Kokoro) and production (Chatterbox) with `--engine` flag | SATISFIED | `--engine kokoro\|chatterbox` flag parsed in `tts.ts`; `tts:draft` and `tts:prod` npm scripts |

No orphaned requirements. All four TTS requirements explicitly covered by plan declarations and verified in implementation.

### Anti-Patterns Found

No anti-patterns detected in phase files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TODO/FIXME/placeholder comments, no empty return stubs, no unimplemented handlers found in any TTS module.

**Notable:** The `temp file cleanup` in `post-process.ts` (lines 153-159) uses `Date.now()` again for the cleanup path rather than the path computed for writing, meaning cleanup will silently fail for same-file processing. This is an ℹ️ Info-level issue — the temp file leaks to `/tmp/` but does not block goal achievement.

### Human Verification Required

#### 1. Kokoro End-to-End Audio Generation

**Test:** Run `cd apps/tutorials && pnpm tts getting-started --engine kokoro` with an actual `fixtures/getting-started/script.json` present.
**Expected:** WAV files appear in `audio/getting-started/`, `timing.json` is valid JSON with correct step entries and `engine: "kokoro"`.
**Why human:** Kokoro model download (~160MB) and actual audio generation cannot be verified without running the process. The code wiring is confirmed but the runtime behavior requires execution.

#### 2. Chatterbox Engine Error Path

**Test:** Run `pnpm tts getting-started --engine chatterbox` without running `setup-chatterbox.sh` first.
**Expected:** Error message: `"Chatterbox venv not found. Run: bash scripts/setup-chatterbox.sh"` — exits cleanly, no crash.
**Why human:** Requires confirming the error path executes as expected without a venv present. Code path is verified but runtime behavior is not.

#### 3. Single-Step Regeneration Manifest Integrity

**Test:** Generate all steps first, then run `pnpm tts getting-started --step step-001`. Inspect `timing.json`.
**Expected:** Only the `step-001` entry is updated; all other step entries remain unchanged; `totalDurationMs` is recalculated correctly.
**Why human:** Requires actual execution with a multi-step tutorial to observe manifest partial-update behavior.

### Gaps Summary

No gaps found. All 12 observable truths are verified. All four TTS requirements (TTS-01 through TTS-04) are satisfied by substantive, fully-wired implementations. TypeScript compiles cleanly for all phase files.

The one minor code issue (temp file cleanup path recomputes `Date.now()` at cleanup time rather than reusing the path from creation) does not affect goal achievement — it only causes an inert temp file leak in `/tmp/`.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
