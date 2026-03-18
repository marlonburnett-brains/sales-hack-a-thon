# Stack Research

**Domain:** Automated tutorial video production pipeline for existing Next.js/React monorepo
**Researched:** 2026-03-18
**Confidence:** HIGH (Remotion, Playwright) / MEDIUM (kokoro-js Node.js) / MEDIUM (Chatterbox MPS)

## Scope

This covers only NEW additions/changes for v1.9 (Tutorial Video Production). The existing stack (Next.js 15, Mastra, Prisma, shadcn/ui, etc.) is validated and unchanged. See prior STACK.md entries for existing stack research.

**Focus areas:**
1. Remotion -- React-based programmatic video composition and MP4 rendering
2. Playwright -- UI capture with fully mocked API responses (already installed)
3. kokoro-js -- JavaScript TTS for fast draft narration iteration
4. Chatterbox-Turbo -- Python TTS for production-quality narration
5. Glue libraries for audio encoding and monorepo integration

---

## Executive Summary

v1.9 requires **four new npm packages** (Remotion core + renderer + bundler + CLI), **one npm TTS package** (kokoro-js), **one audio encoding utility** (wav-encoder), and **one Python package** (chatterbox-tts) installed in a separate venv. Playwright is already installed at the root level (`^1.58.2`).

The key architectural decision: create a new `apps/video` workspace in the Turborepo monorepo. Remotion has its own Webpack bundler that conflicts with Next.js, video dependencies are heavy and should never deploy to Vercel/Railway, and video rendering runs exclusively on local dev machines.

The TTS strategy uses a two-tier approach: kokoro-js (JavaScript, CPU, fast) for draft iteration, and Chatterbox-Turbo (Python, MPS/GPU, high quality) for final production narration. Chatterbox runs as a Python sidecar process invoked via `child_process.execSync` from Node.js scripts.

---

## Recommended Stack

### Core Technologies (New)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| [Remotion](https://www.remotion.dev/) | 4.0.436 (pin exact) | React-based programmatic video composition and MP4 rendering | React 19 compatible (project uses React 19). Compositions are JSX `<Sequence>` components -- natural fit for a React codebase. Deterministic video from code with no GUI dependency. Actively maintained (daily npm publishes). Uses FFmpeg under the hood for encoding. |
| [kokoro-js](https://www.npmjs.com/package/kokoro-js) | 1.2.1 | Draft narration TTS -- fast iteration on script timing and pacing | Pure JavaScript via ONNX runtime (Transformers.js). Runs in Node.js with `device: "cpu"`. Stays in the TypeScript/Node ecosystem -- no Python needed for the fast-iteration loop. 82M params, ~128MB ONNX weights, generates ~5s audio in ~3s on CPU. |
| [Chatterbox-Turbo](https://github.com/resemble-ai/chatterbox) | 0.1.6 (pip) | Production-quality TTS narration with emotion/paralinguistic tags | Sub-200ms inference on GPU. Paralinguistic tags `[laugh]`, `(excited)` add realism. Preferred over ElevenLabs in 63.8% of blind tests. 350M params, single-step diffusion. MIT license. |
| [Playwright](https://playwright.dev/) | 1.58.x | Browser automation for UI screenshot capture with mocked APIs | **Already installed** in root `package.json` at `^1.58.2`. `page.route()` intercepts all API calls with fixture JSON. `page.screenshot()` captures pixel-perfect UI states. No new install needed. |

### Supporting Libraries (New npm)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@remotion/cli` | 4.0.436 (match core) | CLI for `npx remotion render` and `npx remotion studio` | Rendering final MP4s and previewing compositions during development |
| `@remotion/renderer` | 4.0.436 (match core) | Programmatic Node.js API for `bundle()` + `renderMedia()` | Automating render pipeline in scripts (alternative to CLI for batch rendering) |
| `@remotion/bundler` | 4.0.436 (match core) | Webpack bundler for Remotion compositions | Required by `@remotion/renderer` -- called before `renderMedia()` |
| `@remotion/captions` | 4.0.436 (match core) | Caption/subtitle generation and timing | Adding synchronized text overlays that match narration word timing |
| `wav-encoder` | latest | Encode Float32Array PCM data to WAV files | kokoro-js outputs raw audio data; needs WAV encoding before Remotion can consume it |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Remotion Studio (`npx remotion studio`) | Visual preview of video compositions in browser | Hot-reloads JSX changes. Use during development to iterate on layout, timing, and transitions without full renders. |
| `npx playwright install chromium` | Download Chromium browser binary for UI capture | Run once after install. Only Chromium needed -- skip Firefox and WebKit. |
| Python 3.11 + venv | Isolated environment for Chatterbox-Turbo PyTorch deps | Completely separate from Node.js. Use `python3.11 -m venv .venv/chatterbox` in project root. |

---

## Monorepo Integration

### New Workspace: `apps/video`

Create a new Turborepo workspace for all video production code:

```
apps/video/
  package.json              # Remotion + kokoro-js deps
  remotion.config.ts        # Remotion configuration (entry point, codec, etc.)
  tsconfig.json
  src/
    compositions/           # Remotion <Composition> components (one per tutorial)
      index.ts              # registerRoot with all compositions
      GettingStarted.tsx    # Example composition
    scripts/                # Tutorial narration scripts (.txt per step)
    fixtures/               # Mock API response JSON files (shared with Playwright)
    capture/                # Playwright screenshot capture scripts
    tts/                    # TTS generation scripts (kokoro-js + chatterbox wrapper)
    audio/                  # Generated .wav files (gitignored)
    screenshots/            # Playwright captures (gitignored)
    output/                 # Final .mp4 files (gitignored)
  playwright.config.ts      # Playwright config for capture (NOT testing)
```

### Why a Separate Workspace

1. **Remotion uses its own Webpack bundler** -- mixing with Next.js causes config conflicts and build failures.
2. **Video deps are heavy** -- ONNX models (~128MB), Remotion renderer, PyTorch venv (~2GB) must not bloat the web/agent deploys.
3. **Different execution target** -- video rendering runs locally on dev machines, never deploys to Vercel or Railway.
4. **Clean dependency boundary** -- `apps/video` can import types from `@lumenalta/schemas` but has no runtime dependency on web or agent.

---

## Installation

```bash
# 1. Create video workspace
mkdir -p apps/video/src/{compositions,scripts,fixtures,capture,tts,audio,screenshots,output}

# 2. Initialize package.json
cd apps/video && pnpm init

# 3. Remotion packages (ALL must be pinned to exact same version -- no ^ prefix)
pnpm add remotion@4.0.436 @remotion/cli@4.0.436 @remotion/renderer@4.0.436 \
  @remotion/bundler@4.0.436 @remotion/captions@4.0.436

# 4. React (must match project -- Remotion 4.0.436 supports React 19)
pnpm add react@^19.0.0 react-dom@^19.0.0

# 5. TTS (kokoro-js for draft narration in Node.js)
pnpm add kokoro-js@1.2.1

# 6. Audio encoding
pnpm add wav-encoder

# 7. Dev dependencies
pnpm add -D typescript@^5.7.3 @types/react@^19.0.7 @types/react-dom@^19.0.3 \
  @lumenalta/tsconfig@workspace:*

# 8. Playwright browser binaries (Playwright itself already in root)
npx playwright install chromium

# 9. Chatterbox-Turbo (Python sidecar)
python3.11 -m venv .venv/chatterbox
source .venv/chatterbox/bin/activate
pip install torch==2.5.1 torchaudio==2.5.1          # MPS-compatible PyTorch FIRST
pip install chatterbox-tts==0.1.6 --no-deps          # Then chatterbox without torch override
pip install $(python -c "
import importlib.metadata
deps = importlib.metadata.requires('chatterbox-tts') or []
skip = {'torch', 'torchaudio'}
for d in deps:
    name = d.split()[0].split('>')[0].split('<')[0].split('=')[0].split('!')[0]
    if name.lower() not in skip:
        print(name)
" | tr '\n' ' ')
deactivate
```

### Gitignore Additions

```gitignore
# Tutorial video production
apps/video/src/audio/
apps/video/src/screenshots/
apps/video/src/output/
.venv/
```

---

## Python Sidecar Pattern for Chatterbox

Chatterbox-Turbo is Python-only with heavy PyTorch dependencies. Do NOT try to bridge via Node.js native modules or WASM. Invoke as a subprocess:

```typescript
// apps/video/src/tts/chatterbox.ts
import { execSync } from 'child_process';
import path from 'path';

const VENV_PYTHON = path.resolve(process.cwd(), '../../.venv/chatterbox/bin/python');
const GENERATE_SCRIPT = path.resolve(__dirname, 'chatterbox_generate.py');

export function generateProductionAudio(
  scriptPath: string,
  outputPath: string,
  voiceRefPath?: string
): void {
  const voiceArg = voiceRefPath ? ` --voice "${voiceRefPath}"` : '';
  execSync(
    `${VENV_PYTHON} ${GENERATE_SCRIPT} --input "${scriptPath}" --output "${outputPath}"${voiceArg}`,
    { stdio: 'inherit', timeout: 120_000 }
  );
}
```

```python
# apps/video/src/tts/chatterbox_generate.py
import argparse, torch, torchaudio
from chatterbox.tts import ChatterboxTTS

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Path to .txt script file')
    parser.add_argument('--output', required=True, help='Path for output .wav file')
    parser.add_argument('--voice', default=None, help='Optional voice reference .wav')
    args = parser.parse_args()

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)

    with open(args.input) as f:
        text = f.read()

    wav = model.generate(text, audio_prompt_path=args.voice)
    torchaudio.save(args.output, wav, model.sr)

if __name__ == "__main__":
    main()
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Remotion (React video) | FFmpeg raw CLI | Only if you need frame-level control beyond React composition. Remotion uses FFmpeg internally -- adding raw FFmpeg is redundant. |
| Remotion (React video) | Motion Canvas | If you want a timeline-based animation editor UI. But Motion Canvas lacks Remotion's rendering pipeline maturity, React ecosystem integration, and active daily maintenance. |
| kokoro-js (JS TTS drafts) | kokoro-onnx (Python) | If you want an all-Python TTS toolchain. But kokoro-js keeps the fast-iteration draft loop in Node.js, avoiding Python startup overhead for every regeneration. |
| kokoro-js (JS TTS drafts) | Piper TTS | If Kokoro voice quality is insufficient. Piper has more voice variety but requires separate ONNX models per voice and has no JavaScript SDK. |
| Chatterbox-Turbo (prod TTS) | ElevenLabs API | If you want zero local setup. But ElevenLabs costs money per character, requires internet, and violates the "fully offline, deterministic" pipeline goal. |
| Chatterbox-Turbo (prod TTS) | Coqui XTTS | If Chatterbox MPS support proves unreliable on M1. Coqui XTTS also supports MPS but has weaker emotion/paralinguistic tag control. |
| Separate `apps/video` workspace | Code inside `apps/web` | Never -- Remotion's Webpack bundler conflicts with Next.js, and video deps should never ship to Vercel. |
| Screenshots (Playwright) | Video recording (Playwright) | Never for final output -- Playwright video recording has variable frame timing. Screenshots give pixel-perfect control over duration in Remotion. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| ElevenLabs / any cloud TTS | Costs money per character, requires internet, non-deterministic across runs | kokoro-js (draft) + Chatterbox-Turbo (production) -- both fully local |
| Puppeteer | Playwright already installed at v1.58.2; Puppeteer's API mocking (`page.setRequestInterception`) is weaker than Playwright's `page.route()` | Playwright |
| `@remotion/player` | Player embeds video preview in web UIs -- not needed for offline batch rendering | `@remotion/renderer` + `@remotion/cli` |
| Python ONNX runtime for Kokoro drafts | Adds Python dependency to the fast-iteration loop. kokoro-js runs natively in Node.js | kokoro-js npm package |
| `remotion-skills` (transitions) | Unmaintained community package | Build custom `<Transition>` React components -- they're just JSX |
| Mixing Remotion config in apps/web | Webpack conflicts with Next.js bundler, bloats production deploy | Separate `apps/video` workspace |
| Playwright video recording for capture | Variable frame timing, no per-step control | `page.screenshot()` per step, compose in Remotion |
| System FFmpeg installation | Remotion bundles its own FFmpeg. System FFmpeg may version-conflict | Let Remotion manage FFmpeg |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `remotion@4.0.436` | `react@19.x`, `react-dom@19.x` | React 19 supported since Remotion 4.0.0. Must use >= 4.0.236 for correct React 19 ref types. Project is on React 19.2.4. |
| `remotion@4.0.x` | All `@remotion/*` packages | **All @remotion packages MUST be pinned to the exact same version.** Remove all `^` prefixes. Version mismatch causes runtime errors. |
| `kokoro-js@1.2.1` | Node.js 18+ | Uses `@huggingface/transformers` internally. Set `device: "cpu"` for Node.js server-side use (no WebGPU in Node). First model load downloads ~128MB ONNX weights to cache. |
| `chatterbox-tts@0.1.6` | Python 3.10-3.11, `torch==2.5.1` | Officially tested on Python 3.11 Debian. Pinned torch version -- do NOT upgrade torch independently. |
| `chatterbox-tts@0.1.6` | Apple Silicon MPS (M1/M2/M3) | MPS works but requires installing PyTorch with MPS support FIRST, then chatterbox-tts with `--no-deps` to avoid torch version override. See installation section. |
| `@playwright/test@1.58.2` | Chromium (bundled binary) | Run `npx playwright install chromium`. Only Chromium needed for capture. |
| Remotion renderer | FFmpeg (bundled by Remotion) | Remotion bundles its own FFmpeg binary. Do NOT install system FFmpeg -- version conflicts cause encoding failures. |
| `wav-encoder` | kokoro-js raw output | kokoro-js generates() returns raw Float32Array PCM. wav-encoder converts to .wav files that Remotion's `<Audio>` component can consume. |

---

## Apple Silicon (M1 Pro, 16GB) Specific Notes

### Chatterbox-Turbo MPS

The pinned `torch==2.5.1` in chatterbox-tts can conflict with MPS-compatible PyTorch builds if installed in the wrong order. The installation section above handles this correctly.

**Verification command:**
```bash
source .venv/chatterbox/bin/activate
python -c "import torch; print('MPS available:', torch.backends.mps.is_available())"
```

If MPS is unavailable (rare with correct install order), Chatterbox falls back to CPU. CPU inference is slower (~10-30s per utterance vs sub-200ms on MPS) but functional for batch production of ~16 tutorials.

### kokoro-js on M1

ONNX Runtime has native ARM64 (Apple Silicon) support. The `device: "cpu"` codepath works efficiently on M1 without special configuration. Expect ~3s generation time for ~5s of audio output.

### Remotion Rendering on M1

Remotion rendering is CPU-bound (headless Chromium screenshot + FFmpeg encoding). M1 Pro handles tutorial-length videos (2-5 min each) comfortably. Expect ~1-2 min render time per minute of output video. 16GB RAM is sufficient -- Remotion's peak usage is ~2-4GB during rendering.

---

## Stack Patterns

### Draft Iteration (Script Timing)
- Use kokoro-js directly in Node.js scripts
- Generate .wav, preview in Remotion Studio with `npx remotion studio`
- Fast feedback: change script text, regenerate audio, hot-reload video preview
- **Why:** kokoro-js has no Python dependency, ~3s generation, instant iteration loop

### Production Rendering (Final Videos)
- Generate final narration with Chatterbox-Turbo Python sidecar
- Render MP4 with `npx remotion render` or `renderMedia()` API
- **Why:** Chatterbox produces higher quality, more natural speech with emotion tags

### UI Capture (Playwright Screenshots)
- Start Next.js dev server: `pnpm --filter web dev`
- Run Playwright scripts that navigate the real app with all API calls intercepted via `page.route()` returning fixture JSON
- Capture `page.screenshot()` at each workflow step (NOT video recording)
- **Why:** Screenshots give pixel-perfect timing control in Remotion. Playwright video recording has variable frame timing that makes synchronizing narration difficult.

### Fixture Sharing
- Mock API response JSON files live in `apps/video/src/fixtures/`
- Playwright capture scripts and Remotion compositions both reference fixtures
- **Why:** Same mocked data ensures captures match what the video composition expects

---

## Sources

### HIGH Confidence
- [Remotion official site](https://www.remotion.dev/) -- framework capabilities, rendering pipeline
- [Remotion React 19 docs](https://www.remotion.dev/docs/react-19) -- confirmed React 19 compatibility from v4.0.0
- [Remotion npm](https://www.npmjs.com/package/remotion) -- version 4.0.436 current as of 2026-03-18
- [@remotion/renderer docs](https://www.remotion.dev/docs/renderer) -- Node.js rendering API
- [Playwright Mock APIs docs](https://playwright.dev/docs/mock) -- `page.route()` API documentation
- [Chatterbox GitHub](https://github.com/resemble-ai/chatterbox) -- official repo, architecture details
- [Chatterbox PyPI](https://pypi.org/project/chatterbox-tts/) -- version 0.1.6, Python 3.10+ requirement

### MEDIUM Confidence
- [kokoro-js npm](https://www.npmjs.com/package/kokoro-js) -- version 1.2.1; Node.js server-side use is secondary to browser use but documented with `device: "cpu"` option
- [Kokoro-82M ONNX on HuggingFace](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) -- model weights and capabilities
- [Chatterbox Apple Silicon adaptation](https://huggingface.co/Jimmi42/chatterbox-tts-apple-silicon-code) -- MPS compatibility (community fork, not official Resemble AI)
- [avr-tts-kokoro Express.js server](https://github.com/agentvoiceresponse/avr-tts-kokoro) -- confirms kokoro TTS works in Node.js server context

### LOW Confidence (Validate During Implementation)
- kokoro-js `device: "cpu"` performance on M1 -- based on general ONNX ARM64 support claims, not specific benchmarks
- Chatterbox MPS install order -- based on community adaptation, not official Resemble AI docs
- Remotion render time estimates (~1-2 min per minute of output) -- based on general community reports, varies with composition complexity

---
*Stack research for: AtlusDeck v1.9 Tutorial Video Production Pipeline*
*Researched: 2026-03-18*
