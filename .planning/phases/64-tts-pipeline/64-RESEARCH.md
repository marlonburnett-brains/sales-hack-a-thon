# Phase 64: TTS Pipeline - Research

**Researched:** 2026-03-19
**Domain:** Text-to-Speech audio generation (Kokoro-js + Chatterbox-Turbo)
**Confidence:** HIGH

## Summary

This phase implements a dual-engine TTS pipeline within `apps/tutorials` that generates narration WAV files from tutorial script JSON. The draft engine (kokoro-js) runs entirely in Node.js with zero Python dependency using ONNX runtime. The production engine (Chatterbox-Turbo) requires a Python 3.11 sidecar with MPS acceleration on Apple Silicon. Both engines output 24kHz mono WAV natively, which simplifies the pipeline since no resampling is needed.

The pipeline reads `narration` text from each step in `script.json`, generates per-step WAV files (`step-001.wav`), applies loudness normalization and trailing silence via ffmpeg, and produces a `timing.json` manifest that Phase 65 Remotion compositions consume for frame calculations. The `--engine` flag switches between draft (kokoro) and production (chatterbox) modes.

**Primary recommendation:** Build the pipeline as a single `scripts/tts.ts` orchestrator that delegates to kokoro-js directly (in-process) or spawns a Python subprocess for Chatterbox, with ffmpeg post-processing for normalization and silence padding.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single consistent female narrator voice across all tutorials (warm, professional tone)
- Kokoro voice preset: warm female (e.g., af_heart or similar -- Claude picks best)
- Chatterbox reference audio: Claude sources a short (~10s) female narrator reference clip
- Fixed global speaking pace -- same rate for all tutorials
- Light emotion hints via Chatterbox paralinguistic tags ([cheerful] for intros, [encouraging] for completions)
- Emotion tags are explicit per step: optional `emotion` field added to StepSchema
- 0.5 seconds trailing silence appended to each step audio
- Sample rate: 24kHz (native output of both engines)
- Channels: Mono
- Format: WAV
- Loudness normalization: -16 LUFS via ffmpeg or Node audio lib
- Per-tutorial `timing.json` at `apps/tutorials/audio/{tutorial}/timing.json`
- Timing manifest generated automatically as side effect of TTS generation
- Per-step fields: step ID, audio file path (relative), duration ms, narration text, word count
- Per-tutorial fields: total duration, engine used, generation timestamp
- Python sidecar: local venv at `apps/tutorials/.venv/` managed by `scripts/setup-chatterbox.sh`
- Error with clear instructions when `--engine chatterbox` but venv/model missing
- `.venv/` gitignored
- Default: process all steps; `--step step-003` for single step; `--tutorial` flag
- Single-step regeneration updates timing.json entry without rewriting whole manifest

### Claude's Discretion
- Exact Kokoro voice preset selection (test a few warm female presets, pick best)
- Chatterbox reference clip sourcing approach
- Loudness normalization implementation (ffmpeg subprocess vs Node audio library)
- kokoro-js ONNX quantization level (q8 vs fp32)
- Internal pipeline orchestration (sequential vs parallel step generation)
- Exact emotion tag vocabulary and placement heuristics

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TTS-01 | Developer can generate draft narration .wav files per tutorial step using kokoro-js on CPU with no Python dependency | kokoro-js npm package with `KokoroTTS.from_pretrained()`, `generate()`, `audio.save()` -- runs on Node.js CPU via ONNX runtime |
| TTS-02 | Developer can generate production narration .wav files per tutorial step using Chatterbox-Turbo on M1 MPS/GPU via Python sidecar | Python 3.11 venv with chatterbox-tts pip package, MPS device mapping via CPU-first loading pattern, subprocess spawned from Node.js |
| TTS-03 | Pipeline generates a timing manifest from audio file durations that feeds Remotion composition frame counts | Timing manifest Zod schema, duration calculated from WAV file sample count / 24000, written as timing.json |
| TTS-04 | Developer can switch between draft (Kokoro) and production (Chatterbox) TTS with a single `--engine` flag | CLI arg parsing in tts.ts with `--engine kokoro|chatterbox` defaulting to kokoro |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| kokoro-js | ^1.2.x | Draft TTS engine (Node.js, ONNX) | Only viable pure-JS local TTS; 82M param model, 24kHz output, no Python needed |
| chatterbox-tts | latest (pip) | Production TTS engine (Python, MPS) | SoTA open-source TTS with voice cloning and paralinguistic tags; 24kHz output |
| ffmpeg | system install | Audio post-processing (normalization, silence) | Industry standard; already needed for Remotion video rendering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.19.0 (already installed) | Run TypeScript scripts | Execute tts.ts pipeline script |
| zod | ^3.24.0 (already installed) | Schema validation | TimingManifest schema validation |
| torch + torchaudio | >=2.0.0 (pip) | PyTorch MPS backend | Required by Chatterbox for Apple Silicon GPU inference |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ffmpeg for normalization | Node.js audio libs (wav-decoder, audiobuffer-to-wav) | ffmpeg is simpler, already a project dependency for Remotion, handles LUFS natively |
| Chatterbox-Turbo | Chatterbox (original, 600M) | Original is larger/slower but has cfg_weight/exaggeration tuning; Turbo is faster and has paralinguistic tags |

**Installation:**
```bash
# Node.js dependencies (in apps/tutorials)
pnpm --filter tutorials add kokoro-js

# Python sidecar (via setup script)
# scripts/setup-chatterbox.sh handles venv creation + pip install
```

## Architecture Patterns

### Recommended Project Structure
```
apps/tutorials/
  scripts/
    tts.ts                    # Main TTS orchestrator (CLI entry point)
    setup-chatterbox.sh       # One-time Python venv + model setup
    chatterbox-generate.py    # Python script called as subprocess
  src/
    types/
      tutorial-script.ts      # Existing (add emotion field to StepSchema)
      timing-manifest.ts      # NEW: Zod schema for timing.json
    tts/
      kokoro-engine.ts        # Kokoro-js wrapper (generate + save)
      chatterbox-engine.ts    # Subprocess spawner for Python script
      post-process.ts         # ffmpeg normalization + silence padding
      manifest.ts             # Timing manifest read/write/update
  audio/                      # Output directory (gitignored)
    {tutorial}/
      step-001.wav
      step-002.wav
      timing.json
```

### Pattern 1: Engine Abstraction
**What:** Common interface for both TTS engines so the orchestrator is engine-agnostic.
**When to use:** Always -- the `--engine` flag switches implementation, not orchestration logic.
**Example:**
```typescript
// Source: project pattern (matches capture.ts subprocess pattern)
interface TTSEngine {
  generate(text: string, outputPath: string, options?: {
    emotion?: string;
  }): Promise<{ durationMs: number }>;
}

// Kokoro engine: in-process
class KokoroEngine implements TTSEngine {
  private tts: KokoroTTS | null = null;

  async generate(text: string, outputPath: string, options?: { emotion?: string }) {
    if (!this.tts) {
      const { KokoroTTS } = await import("kokoro-js");
      this.tts = await KokoroTTS.from_pretrained(
        "onnx-community/Kokoro-82M-v1.0-ONNX",
        { dtype: "q8", device: "cpu" }
      );
    }
    const audio = await this.tts.generate(text, { voice: "af_heart" });
    audio.save(outputPath);
    // Duration from file stats or WAV header parse
    return { durationMs: calculateDurationFromWav(outputPath) };
  }
}
```

### Pattern 2: Python Subprocess for Chatterbox
**What:** Spawn Python from Node.js using the project venv, passing args via CLI.
**When to use:** When `--engine chatterbox` is selected.
**Example:**
```typescript
// Source: matches capture.ts spawn pattern
class ChatterboxEngine implements TTSEngine {
  async generate(text: string, outputPath: string, options?: { emotion?: string }) {
    const venvPython = path.join(process.cwd(), ".venv", "bin", "python");
    if (!fs.existsSync(venvPython)) {
      throw new Error(
        "Chatterbox venv not found. Run: bash scripts/setup-chatterbox.sh"
      );
    }
    const args = [
      "scripts/chatterbox-generate.py",
      "--text", text,
      "--output", outputPath,
      "--reference", "assets/reference-voice.wav",
    ];
    if (options?.emotion) args.push("--emotion", options.emotion);

    await spawnAsync(venvPython, args);
    return { durationMs: calculateDurationFromWav(outputPath) };
  }
}
```

### Pattern 3: ffmpeg Post-Processing Pipeline
**What:** After each WAV is generated, normalize loudness and append trailing silence.
**When to use:** Every generated WAV file, regardless of engine.
**Example:**
```bash
# Two-pass loudness normalization to -16 LUFS + 0.5s trailing silence
# Pass 1: measure
ffmpeg -i input.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -

# Pass 2: normalize + append silence
ffmpeg -i input.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={measured_I}:measured_LRA={measured_LRA}:measured_TP={measured_TP}:measured_thresh={measured_thresh},apad=pad_dur=0.5" -ar 24000 -ac 1 output.wav
```

### Pattern 4: Timing Manifest with Single-Step Update
**What:** Read existing timing.json, update one entry, write back.
**When to use:** When `--step` flag targets a single step.
**Example:**
```typescript
function updateTimingEntry(
  manifestPath: string,
  stepId: string,
  entry: TimingEntry
): void {
  const existing = fs.existsSync(manifestPath)
    ? TimingManifestSchema.parse(JSON.parse(fs.readFileSync(manifestPath, "utf-8")))
    : { steps: [], engine: "kokoro", generatedAt: new Date().toISOString(), totalDurationMs: 0 };

  const idx = existing.steps.findIndex(s => s.stepId === stepId);
  if (idx >= 0) existing.steps[idx] = entry;
  else existing.steps.push(entry);

  existing.totalDurationMs = existing.steps.reduce((sum, s) => sum + s.durationMs, 0);
  existing.generatedAt = new Date().toISOString();

  fs.writeFileSync(manifestPath, JSON.stringify(existing, null, 2));
}
```

### Anti-Patterns to Avoid
- **Loading kokoro-js model per step:** Model loading takes several seconds. Load once, reuse for all steps.
- **Using MPS directly with Chatterbox model loading:** Always load to CPU first, then move to MPS. Direct MPS loading causes tensor allocation errors.
- **Resampling audio:** Both engines output 24kHz natively. Do not resample -- it degrades quality.
- **Silent Kokoro fallback when Chatterbox fails:** User decision requires explicit error with setup instructions, not silent fallback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loudness normalization | Custom PCM amplitude scaling | ffmpeg `loudnorm` filter | LUFS is perceptual, not simple peak normalization; ffmpeg implements EBU R128 correctly |
| WAV file writing | Manual WAV header construction | kokoro-js `audio.save()` / torchaudio.save() | WAV header format has edge cases (RIFF chunks, sample format) |
| WAV duration reading | Custom binary parser | ffmpeg `ffprobe` or parse WAV header bytes | Only need duration; 44-byte header has sample count at known offset |
| Text chunking for long narrations | Custom sentence splitter | Chatterbox built-in or simple regex split on [.!?] | Chatterbox recommends max 250 chars per chunk for quality |

**Key insight:** The heavy lifting is done by kokoro-js and chatterbox-tts. The pipeline is orchestration code (read script, call engine, post-process, write manifest) -- keep it thin.

## Common Pitfalls

### Pitfall 1: Kokoro-js Model Download on First Run
**What goes wrong:** First `KokoroTTS.from_pretrained()` downloads ~160MB ONNX model, causing timeout or confusing long pause.
**Why it happens:** HuggingFace model cache is cold on first invocation.
**How to avoid:** Log a clear message before model loading: "Downloading Kokoro model (~160MB, first run only)...". Model is cached in HuggingFace cache dir after first download.
**Warning signs:** Script appears hung for 30-60 seconds on first run.

### Pitfall 2: Chatterbox MPS Tensor Allocation Errors
**What goes wrong:** `RuntimeError: MPS backend out of memory` or tensor device mismatch errors.
**Why it happens:** Chatterbox models were trained on CUDA; direct loading to MPS causes device mapping issues.
**How to avoid:** In `chatterbox-generate.py`, always load model to CPU first, then manually move components (`t3`, `s3gen`, `ve`) to MPS device. Use the `map_location='cpu'` monkey-patch pattern.
**Warning signs:** Crashes immediately on `from_pretrained(device="mps")`.

### Pitfall 3: ffmpeg Not Installed
**What goes wrong:** Post-processing fails with "ffmpeg: command not found".
**Why it happens:** ffmpeg is a system dependency, not installed via npm/pip.
**How to avoid:** Check for ffmpeg at pipeline startup with `which ffmpeg`. Print install instructions: `brew install ffmpeg`.
**Warning signs:** All TTS generation succeeds but no normalized output.

### Pitfall 4: Emotion Tags in Kokoro (Draft Engine)
**What goes wrong:** Kokoro reads `[cheerful]` literally as text and tries to speak it.
**Why it happens:** Kokoro has no paralinguistic tag support -- only Chatterbox-Turbo understands tags.
**How to avoid:** Strip emotion tags from narration text before passing to Kokoro engine. Only inject tags for Chatterbox.
**Warning signs:** Draft audio says "open bracket cheerful close bracket" literally.

### Pitfall 5: Single-Step Regeneration Leaves Stale Manifest
**What goes wrong:** Regenerating step-005 updates the WAV but timing.json still has old duration.
**Why it happens:** Manifest update logic doesn't match by step ID correctly.
**How to avoid:** Always read-modify-write timing.json when using `--step` flag. Recalculate totalDurationMs from all entries.
**Warning signs:** Remotion video timing drifts from actual audio length.

## Code Examples

### Timing Manifest Schema
```typescript
// Source: project pattern (matches fixture loader Zod validation)
import { z } from "zod";

export const TimingEntrySchema = z.object({
  stepId: z.string(),           // "step-001"
  audioFile: z.string(),        // "step-001.wav" (relative path)
  durationMs: z.number(),       // duration in milliseconds
  narration: z.string(),        // original narration text
  wordCount: z.number(),        // word count for pacing analysis
});

export const TimingManifestSchema = z.object({
  steps: z.array(TimingEntrySchema),
  totalDurationMs: z.number(),  // sum of all step durations
  engine: z.enum(["kokoro", "chatterbox"]),
  generatedAt: z.string(),      // ISO timestamp
});

export type TimingEntry = z.infer<typeof TimingEntrySchema>;
export type TimingManifest = z.infer<typeof TimingManifestSchema>;
```

### StepSchema Emotion Field Addition
```typescript
// Add to existing StepSchema in tutorial-script.ts
/** Optional emotion hint for Chatterbox TTS (ignored by Kokoro) */
emotion: z.enum([
  "cheerful", "encouraging", "calm", "professional", "excited"
]).optional(),
```

### Chatterbox Python Generation Script
```python
#!/usr/bin/env python3
"""chatterbox-generate.py -- Generate a single WAV from text using Chatterbox-Turbo."""
import argparse
import torch
import torchaudio

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--reference", required=True)
    parser.add_argument("--emotion", default=None)
    args = parser.parse_args()

    # Device detection with MPS support
    device = "mps" if torch.backends.mps.is_available() else "cpu"

    # Load to CPU first, then move to target device
    from chatterbox.tts_turbo import ChatterboxTurboTTS
    model = ChatterboxTurboTTS.from_pretrained("cpu")
    if device != "cpu":
        if hasattr(model, "t3"): model.t3 = model.t3.to(device)
        if hasattr(model, "s3gen"): model.s3gen = model.s3gen.to(device)
        if hasattr(model, "ve"): model.ve = model.ve.to(device)

    text = args.text
    if args.emotion:
        text = f"[{args.emotion}] {text}"

    wav = model.generate(text, audio_prompt_path=args.reference)
    torchaudio.save(args.output, wav, model.sr)

if __name__ == "__main__":
    main()
```

### WAV Duration Calculation
```typescript
// Read WAV header to get duration without loading full file
import * as fs from "node:fs";

function getWavDurationMs(filePath: string): number {
  const buffer = Buffer.alloc(44);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, buffer, 0, 44, 0);
  fs.closeSync(fd);

  // WAV header: bytes 24-27 = sample rate, bytes 40-43 = data chunk size
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const numChannels = buffer.readUInt16LE(22);
  const dataSize = buffer.readUInt32LE(40);
  const totalSamples = dataSize / (numChannels * (bitsPerSample / 8));
  return Math.round((totalSamples / sampleRate) * 1000);
}
```

### Setup Script
```bash
#!/usr/bin/env bash
# scripts/setup-chatterbox.sh -- One-time Chatterbox-Turbo setup
set -euo pipefail

VENV_DIR="$(cd "$(dirname "$0")/.." && pwd)/.venv"

echo "Setting up Chatterbox-Turbo venv at $VENV_DIR..."

python3.11 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

pip install --upgrade pip
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install chatterbox-tts

echo "Chatterbox-Turbo setup complete."
echo "Model will download (~2GB) on first use."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cloud TTS (ElevenLabs, Google) | Local TTS (Kokoro/Chatterbox) | 2025 | Zero cost, no API keys, full control |
| Kokoro Python only | kokoro-js (ONNX in Node.js) | Jan 2025 | No Python needed for draft quality |
| Chatterbox original (600M) | Chatterbox-Turbo (350M) | Late 2025 | Faster inference, paralinguistic tags, same quality |
| Peak normalization | LUFS normalization (EBU R128) | Standard | Perceptually consistent loudness |

**Deprecated/outdated:**
- `onnx-community/Kokoro-82M-ONNX` (v0): Use `Kokoro-82M-v1.0-ONNX` (v1.0) instead
- Direct MPS loading for Chatterbox: Must load CPU-first then move to MPS

## Open Questions

1. **Exact Kokoro voice preset**
   - What we know: `af_heart` is the default, 11 American female voices available (af_heart, af_alloy, af_bella, af_jessica, af_nicole, af_nova, af_river, af_sarah, af_sky, af_aoede, af_kore)
   - What's unclear: Which sounds most "warm & professional" for product demo narration
   - Recommendation: Try af_heart (default), af_bella, and af_nova -- pick during implementation by listening

2. **Chatterbox reference audio clip**
   - What we know: Needs ~10s female narrator clip for voice consistency
   - What's unclear: Best source for royalty-free reference audio
   - Recommendation: Generate a reference clip using Kokoro (af_heart) reading a neutral paragraph, then use that as Chatterbox reference -- ensures voice consistency between engines

3. **Chatterbox paralinguistic tag vocabulary**
   - What we know: [laugh], [cough], [chuckle] confirmed; docs say "and more"
   - What's unclear: Full tag list; whether arbitrary emotion words like [cheerful] work
   - Recommendation: Use confirmed tags sparingly; test [cheerful] and [encouraging] during implementation -- if unsupported, they may be spoken literally

## Sources

### Primary (HIGH confidence)
- [onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) -- voice list, dtypes, sample rate, API examples
- [kokoro-js npm](https://www.npmjs.com/package/kokoro-js) -- Node.js API, installation
- [Kokoro.js DeepWiki](https://deepwiki.com/hexgrad/kokoro/3.3-javascript-integration) -- complete Node.js API reference
- [resemble-ai/chatterbox GitHub](https://github.com/resemble-ai/chatterbox) -- Python API, paralinguistic tags, installation

### Secondary (MEDIUM confidence)
- [Chatterbox Apple Silicon Adaptation](https://huggingface.co/Jimmi42/chatterbox-tts-apple-silicon-code/blob/main/APPLE_SILICON_ADAPTATION_SUMMARY.md) -- MPS workarounds, CPU-first loading pattern, memory requirements
- [ffmpeg loudnorm filter](https://peterforgacs.github.io/2018/05/20/Audio-normalization-with-ffmpeg/) -- LUFS normalization commands

### Tertiary (LOW confidence)
- Chatterbox-Turbo emotion tags beyond [laugh]/[cough]/[chuckle] -- docs say "and more" but don't enumerate; needs runtime validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- kokoro-js and chatterbox-tts are well-documented, versions confirmed
- Architecture: HIGH -- follows established project patterns (subprocess management, Zod schemas, step-indexed output)
- Pitfalls: HIGH -- MPS issues documented by community, emotion tag limitation confirmed in docs
- Chatterbox MPS stability: MEDIUM -- community workarounds exist but not officially supported by Resemble AI

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (30 days -- both libraries are stable releases)
