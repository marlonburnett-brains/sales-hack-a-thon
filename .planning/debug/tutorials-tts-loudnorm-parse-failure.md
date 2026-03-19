---
status: awaiting_human_verify
trigger: "Investigate issue: tutorials-tts-loudnorm-parse-failure"
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:30:00Z
---

## Current Focus

hypothesis: both confirmed root causes are fixed; the remaining step is human verification in the user's real workflow/environment
test: ask the user to run the original command and confirm the generated output matches expectations end-to-end
expecting: user confirms all tutorial audio files are generated and the summary is no longer zero or failing
next_action: wait for user verification response

## Symptoms

expected: Running `pnpm --filter tutorials tts getting-started` should generate audio files for all tutorial steps and produce a non-zero step count/duration summary in `audio/getting-started/`.
actual: All 8 tutorial steps fail. TTS generation starts, Kokoro model downloads, ffmpeg runs, but each step logs `Failed to parse loudnorm stats from ffmpeg output`, then the final summary reports `Steps: 0`, `Total duration: 0ms`, and warns that all 8 steps failed.
errors: `Failed to parse loudnorm stats from ffmpeg output`. Raw stderr includes loudnorm JSON-like output such as `{ "input_i": "-22.67", ... }` plus surrounding ffmpeg lines like `[Parsed_loudnorm_0 @ ...]` / `Parsed_loudnorm_0 @ ...]` and `[out#0/null @ ...] ...`.
reproduction: From repo root, run `pnpm --filter tutorials tts getting-started`.
started: Reproduced in the current workspace now. Prior working state is unknown from the provided context.

## Eliminated

## Evidence

- timestamp: 2026-03-19T00:04:00Z
  checked: reproduction command `pnpm --filter tutorials tts getting-started`
  found: every step fails at the same point after ffmpeg pass 1 with `Failed to parse loudnorm stats from ffmpeg output`, and stderr clearly includes a JSON object plus surrounding ffmpeg log lines
  implication: TTS generation itself works; failure is isolated to loudnorm stderr parsing rather than synthesis or ffmpeg execution

- timestamp: 2026-03-19T00:04:30Z
  checked: codebase search for loudnorm parser
  found: parser and error message originate in `apps/tutorials/src/tts/post-process.ts`
  implication: investigation should focus on the post-processing parser implementation

- timestamp: 2026-03-19T00:07:30Z
  checked: `apps/tutorials/src/tts/post-process.ts`
  found: `parseLoudnormStats()` searches stderr with `/\{[^}]*"input_i"[^}]*"input_lra"[^}]*"input_tp"[^}]*"input_thresh"[^}]*\}/s` before calling `JSON.parse`
  implication: parsing depends on a fixed key order even though JSON object key order in ffmpeg output may differ

- timestamp: 2026-03-19T00:09:30Z
  checked: standalone regex test against reproduced stderr sample
  found: the current regex returns `false` and `null` because the sample orders keys as `input_i`, `input_tp`, `input_lra`, `input_thresh`
  implication: root cause is confirmed; stderr contains valid JSON but the parser rejects it due to key-order assumptions

- timestamp: 2026-03-19T00:14:30Z
  checked: verification run after code change
  found: the rerun progressed through step-006 without any `Failed to parse loudnorm stats from ffmpeg output` errors before the shell timeout killed the process at 120 seconds
  implication: the loudnorm parsing failure appears resolved; remaining work is to finish verification with enough runtime to complete all steps

- timestamp: 2026-03-19T00:17:30Z
  checked: output directory and full verification run with a longer timeout
  found: `audio/getting-started/` contains generated step WAVs and the full `pnpm --filter tutorials tts getting-started` run completes for all 8 steps with no loudnorm parse errors; summary now reports `Steps: 8` and `Total duration: 8ms`
  implication: the original blocking failure is resolved; remaining verification is to confirm whether the duration summary is intentionally based on per-step metadata rather than actual audio length

- timestamp: 2026-03-19T00:19:30Z
  checked: `apps/tutorials/audio/getting-started/timing.json` and `apps/tutorials/scripts/tts.ts`
  found: the summary reads `durationMs` directly from `getWavDurationMs(finalPath)`, and the manifest stores `1ms` for every generated step
  implication: the non-zero-but-invalid duration is not a display-only issue; a separate duration calculation bug likely remains in the WAV utility

- timestamp: 2026-03-19T00:24:30Z
  checked: actual WAV metadata and header bytes for `step-001.wav`
  found: Python's WAV reader reports 264000 frames at 24000 Hz (`11000ms`), while the file header contains a `LIST/INFO` chunk before the `data` chunk, pushing `data` from offset 40 to offset 72
  implication: `getWavDurationMs()` is reading the wrong 4 bytes as `dataSize`; the fixed 44-byte header assumption is invalid for ffmpeg-generated WAV output

- timestamp: 2026-03-19T00:29:30Z
  checked: full reproduction run after both fixes plus `timing.json`
  found: `pnpm --filter tutorials tts getting-started` now completes successfully with `Steps: 8` and `Total duration: 88975ms (89.0s)`, and `timing.json` contains realistic per-step durations such as `11000ms` for `step-001`
  implication: both the loudnorm parse failure and the broken duration summary are fixed in the local workspace

## Resolution

root_cause: 1) `parseLoudnormStats()` used an order-sensitive regex to locate the loudnorm JSON block in ffmpeg stderr, but ffmpeg emits the required keys in a different order (`input_tp` before `input_lra`) in this environment, so valid stats were never extracted. 2) `getWavDurationMs()` assumed the `data` chunk was always at byte offset 40 in a 44-byte WAV header, but ffmpeg-generated WAV files include an extra `LIST/INFO` chunk before `data`, so durations were misread as `1ms`.
fix: updated loudnorm stats extraction to parse JSON blocks without assuming key order, and updated WAV duration parsing to scan RIFF chunks for `fmt ` and `data` instead of using fixed offsets.
verification: loudnorm parse failure is fixed and the reproduction command now completes for all 8 steps; final verification is pending after the WAV duration parser fix.
verification: reproduced successfully after both fixes; `pnpm --filter tutorials tts getting-started` completes for all 8 steps, generates output WAV files, and writes `timing.json` with realistic durations totaling `88975ms`.
files_changed: ["apps/tutorials/src/tts/post-process.ts", "apps/tutorials/src/tts/wav-utils.ts"]
