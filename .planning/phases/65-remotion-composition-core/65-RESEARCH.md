# Phase 65: Remotion Composition Core - Research

**Researched:** 2026-03-19
**Domain:** Remotion 4.x video composition and rendering (React-based programmatic video)
**Confidence:** HIGH

## Summary

Remotion 4.x provides a mature React-based video composition framework where compositions are registered via `<Composition>`, time-shifted with `<Sequence>`, and rendered to MP4 via the `@remotion/renderer` Node.js API. The key architectural insight is that Remotion runs compositions in a browser (headless Chrome during render), so all assets must be served via HTTP -- the `public/` directory (configurable via `publicDir` in `bundle()`) is the standard mechanism. For this project, pointing `publicDir` at the tutorials app root (or symlinking `output/` and `audio/` into a `public/` folder) solves the asset access problem without copying files.

The render pipeline should use the programmatic Node.js API (`bundle()` + `selectComposition()` + `renderMedia()`) rather than spawning the Remotion CLI as a subprocess. This gives full control over `inputProps`, progress reporting, error handling, and `publicDir` configuration -- matching the project's established pattern of TypeScript-first tooling with no external CLI dependencies beyond what is already installed.

**Primary recommendation:** Use `@remotion/renderer` programmatic API with `calculateMetadata` for dynamic duration, `publicDir` pointed at tutorials app root, and `<Audio>` from `@remotion/media` for audio playback in compositions.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Output resolution: 1920x1080 (4K captures downscaled for crisp text)
- Framerate: 30 FPS
- Codec: H.264, CRF 18, MP4 container
- Audio drives timing -- each step's Sequence duration = audio duration from timing manifest
- No visual gaps between steps (Phase 64 appends 0.5s trailing silence)
- Missing audio fallback: show screenshot for 3 seconds with silence
- Scale to fill: downscale 4K to 1080p, no letterboxing, pure screenshot edge-to-edge
- Hard cuts between steps (no transitions -- Phase 66 adds TransitionSeries)
- CLI: `pnpm --filter tutorials render <tutorial-name>` and `pnpm --filter tutorials render:all`
- Output: `apps/tutorials/videos/{tutorial-name}.mp4`
- Pre-validation: check screenshots and timing.json exist before render
- Default `--concurrency=2` for M1 Pro memory safety, overridable with `--concurrency N`
- Timing manifest (timing.json) is the single source of truth for frame calculations

### Claude's Discretion
- Remotion project structure (root component, composition registration, webpack config)
- TutorialStep component internal architecture
- How render:all discovers available tutorials (filesystem scan vs manifest)
- Turbo.json task configuration for render pipeline
- Whether to use Remotion's `<Audio>` or `<OffthreadVideo>` for audio playback
- Internal error handling and progress reporting during renders

### Deferred Ideas (OUT OF SCOPE)
None

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | Each tutorial step renders as a Remotion `<Sequence>` with its screenshot and narration audio synchronized | Sequence API with `from` + `durationInFrames` calculated from timing manifest; Audio component from `@remotion/media` placed inside each Sequence |
| COMP-02 | Shared TutorialStep component encapsulates screenshot display, audio playback, and timing logic | Single React component receives stepId, screenshot path, audio path, durationInFrames as props; uses `<Img>` + `<Audio>` + `<AbsoluteFill>` |
| COMP-03 | Developer can render a final MP4 per tutorial via Remotion CLI with `--concurrency=2` for M1 Pro memory safety | Programmatic `renderMedia()` API with `codec: 'h264'`, `crf: 18`, `concurrency: 2`; render.ts CLI script following tts.ts patterns |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `remotion` | 4.0.x (pin exact) | Core composition framework (`<Composition>`, `<Sequence>`, `<AbsoluteFill>`, `<Img>`, `staticFile`, `useCurrentFrame`, `registerRoot`) | Only option for React-based programmatic video |
| `@remotion/renderer` | 4.0.x (match remotion) | Node.js rendering API (`bundle`, `selectComposition`, `renderMedia`) | Official server-side rendering package |
| `@remotion/bundler` | 4.0.x (match remotion) | Webpack bundling for compositions | Required by `bundle()` function |
| `@remotion/media` | 4.0.x (match remotion) | Modern `<Audio>` component using Mediabunny | Newer, faster audio extraction vs legacy `<Html5Audio>` |
| `@remotion/cli` | 4.0.x (match remotion) | CLI tools and `remotion.config.ts` support | Needed for Config type and potential Studio debugging |
| `react` | ^18.0.0 | React runtime for compositions | Remotion 4.x peer dependency |
| `react-dom` | ^18.0.0 | React DOM for compositions | Remotion 4.x peer dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.24.0 | Already installed -- validate timing manifest at load time | Always -- schema validation before render |
| `tsx` | ^4.19.0 | Already installed -- run render.ts script | CLI entry point |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@remotion/media` `<Audio>` | `<Html5Audio>` from `remotion` | Html5Audio uses FFmpeg extraction (slower); `@remotion/media` uses Mediabunny (faster). Use `@remotion/media`. |
| Programmatic `renderMedia()` | `npx remotion render` CLI subprocess | CLI requires spawning child process, parsing stdout for progress, limited error handling. Programmatic API gives typed callbacks. |
| `calculateMetadata` for dynamic duration | Static `durationInFrames` with pre-calculated total | `calculateMetadata` lets the composition self-configure from timing manifest data passed via `inputProps` -- cleaner separation |

**Installation:**
```bash
pnpm --filter tutorials add remotion@4.0.436 @remotion/renderer@4.0.436 @remotion/bundler@4.0.436 @remotion/media@4.0.436 @remotion/cli@4.0.436 react@18 react-dom@18 --save-exact
```

Note: All `@remotion/*` packages MUST be pinned to the exact same version. Remove `^` from version numbers.

## Architecture Patterns

### Recommended Project Structure
```
apps/tutorials/
  src/
    remotion/
      index.ts            # registerRoot(RemotionRoot) -- entry point for bundler
      Root.tsx             # <Composition> registration with calculateMetadata
      TutorialComposition.tsx  # Maps timing manifest steps to <Sequence> children
      TutorialStep.tsx     # Shared component: <Img> screenshot + <Audio> narration
    types/
      timing-manifest.ts   # (existing) TimingManifestSchema
      tutorial-script.ts   # (existing) TutorialScriptSchema
  scripts/
    render.ts              # CLI: render single tutorial (bundle + selectComposition + renderMedia)
    render-all.ts          # CLI: discover and render all tutorials sequentially
  remotion.config.ts       # Remotion CLI config (publicDir, concurrency defaults)
  videos/                  # Render output (gitignored)
```

### Pattern 1: Programmatic Render Pipeline
**What:** The render.ts script uses `@remotion/renderer` Node.js API directly instead of spawning `npx remotion render`
**When to use:** Always -- this is the primary render path
**Example:**
```typescript
// Source: https://www.remotion.dev/docs/ssr-node
import path from "path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const bundleLocation = await bundle({
  entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
  publicDir: process.cwd(), // Serve tutorials app root so staticFile("output/...") works
});

const inputProps = {
  tutorialName: "getting-started",
  // Timing manifest data loaded and validated here, passed as props
  steps: validatedManifest.steps,
  totalDurationMs: validatedManifest.totalDurationMs,
};

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "tutorial",
  inputProps,
});

await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  crf: 18,
  concurrency: 2,
  outputLocation: path.join(process.cwd(), "videos", `${tutorialName}.mp4`),
  inputProps,
  onProgress: ({ progress }) => {
    console.log(`Rendering: ${(progress * 100).toFixed(1)}%`);
  },
});
```

### Pattern 2: Dynamic Duration via calculateMetadata
**What:** Composition duration is calculated from timing manifest data passed as inputProps
**When to use:** Always -- each tutorial has different total duration
**Example:**
```typescript
// Source: https://www.remotion.dev/docs/dynamic-metadata
import { Composition } from "remotion";

type TutorialProps = {
  tutorialName: string;
  steps: Array<{ stepId: string; durationMs: number; audioFile: string }>;
  totalDurationMs: number;
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="tutorial"
      component={TutorialComposition}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={1} // Placeholder -- calculateMetadata overrides
      defaultProps={{
        tutorialName: "",
        steps: [],
        totalDurationMs: 0,
      }}
      calculateMetadata={async ({ props }) => {
        const fps = 30;
        const totalFrames = Math.ceil((props.totalDurationMs / 1000) * fps);
        return {
          durationInFrames: Math.max(totalFrames, 1),
        };
      }}
    />
  );
};
```

### Pattern 3: Sequence-per-Step Composition
**What:** Each tutorial step becomes a `<Sequence>` with calculated `from` offset and `durationInFrames`
**When to use:** COMP-01 -- core composition structure
**Example:**
```typescript
import { AbsoluteFill, Sequence } from "remotion";
import { TutorialStep } from "./TutorialStep";

const FPS = 30;
const FALLBACK_DURATION_MS = 3000; // 3 seconds for missing audio

export const TutorialComposition: React.FC<TutorialProps> = ({
  tutorialName,
  steps,
}) => {
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {steps.map((step) => {
        const durationMs = step.durationMs || FALLBACK_DURATION_MS;
        const durationInFrames = Math.ceil((durationMs / 1000) * FPS);
        const from = currentFrame;
        currentFrame += durationInFrames;

        return (
          <Sequence
            key={step.stepId}
            from={from}
            durationInFrames={durationInFrames}
            name={step.stepId}
            layout="none"
          >
            <TutorialStep
              tutorialName={tutorialName}
              stepId={step.stepId}
              audioFile={step.audioFile}
              durationMs={durationMs}
              hasAudio={step.durationMs > 0}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

### Pattern 4: TutorialStep Component (COMP-02)
**What:** Shared component encapsulating screenshot display and audio playback
**When to use:** Every step in every tutorial
**Example:**
```typescript
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Audio } from "@remotion/media";

type TutorialStepProps = {
  tutorialName: string;
  stepId: string;
  audioFile: string;
  durationMs: number;
  hasAudio: boolean;
};

export const TutorialStep: React.FC<TutorialStepProps> = ({
  tutorialName,
  stepId,
  audioFile,
  hasAudio,
}) => {
  const screenshotSrc = staticFile(`output/${tutorialName}/${stepId}.png`);
  const audioSrc = staticFile(`audio/${tutorialName}/${audioFile}`);

  return (
    <AbsoluteFill>
      <Img
        src={screenshotSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      {hasAudio && <Audio src={audioSrc} />}
    </AbsoluteFill>
  );
};
```

### Pattern 5: publicDir Strategy for Asset Access
**What:** Set `publicDir` to the tutorials app root so `staticFile("output/...")` and `staticFile("audio/...")` resolve correctly
**When to use:** In `bundle()` call and `remotion.config.ts`
**Why:** Remotion serves files from `publicDir` via HTTP during rendering. By pointing it at the tutorials app root, all existing `output/` and `audio/` directories become accessible via `staticFile()` without copying or symlinking.

```typescript
// In render.ts
const bundleLocation = await bundle({
  entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
  publicDir: process.cwd(), // tutorials app root = public dir
});

// In remotion.config.ts (for Studio debugging)
import { Config } from "@remotion/cli/config";
Config.setPublicDir(".");
```

### Anti-Patterns to Avoid
- **Copying screenshots into public/:** Wastes disk space, adds complexity. Use `publicDir` pointing at app root instead.
- **Using `<Html5Audio>` instead of `<Audio>` from `@remotion/media`:** Legacy component, slower audio extraction during render.
- **Spawning `npx remotion render` as subprocess:** Loses typed error handling, progress callbacks, and inputProps control. Use programmatic API.
- **Hardcoding composition duration:** Each tutorial has different length. Use `calculateMetadata` with timing manifest.
- **Using `layout="absolute-fill"` on Sequences:** This is the default and causes all steps to stack visually. Use `layout="none"` since only one Sequence is active at a time (Remotion unmounts children outside their frame range).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frame calculation from milliseconds | Manual ms-to-frame math scattered everywhere | Single `msToFrames(ms, fps)` utility | Rounding errors, off-by-one bugs; centralize the `Math.ceil((ms / 1000) * fps)` calculation |
| Audio synchronization | Custom audio timing logic | Remotion `<Sequence>` + `<Audio>` from `@remotion/media` | Remotion handles audio/video sync automatically within Sequences |
| Image loading/display | Native `<img>` tags | Remotion `<Img>` component | `<Img>` delays rendering until image is loaded, preventing blank frames |
| Webpack bundling | Custom webpack setup | `bundle()` from `@remotion/bundler` | Handles all Remotion-specific webpack configuration |
| Video encoding | Direct ffmpeg calls | `renderMedia()` from `@remotion/renderer` | Handles frame rendering, audio mixing, encoding, muxing |
| Progress reporting | Parsing ffmpeg stdout | `renderMedia({ onProgress })` callback | Typed callback with `{ progress: number }` between 0 and 1 |

**Key insight:** Remotion's value is abstracting the browser rendering + ffmpeg encoding pipeline. The composition code is just React components. Let Remotion handle all media concerns.

## Common Pitfalls

### Pitfall 1: Version Mismatch Between Remotion Packages
**What goes wrong:** Cryptic runtime errors, missing APIs, webpack failures
**Why it happens:** Installing different versions of `remotion`, `@remotion/renderer`, `@remotion/bundler`
**How to avoid:** Pin ALL Remotion packages to the exact same version. Use `--save-exact` flag. Never use `^` in version ranges.
**Warning signs:** "Cannot find module" errors, type mismatches at runtime

### Pitfall 2: Assets Not Found During Render
**What goes wrong:** `<Img>` and `<Audio>` fail with 404 errors during rendering
**Why it happens:** `publicDir` not configured correctly, or assets added after `bundle()` was called
**How to avoid:** Set `publicDir` to tutorials app root in `bundle()` call. Ensure screenshots and audio exist BEFORE calling `bundle()`.
**Warning signs:** "Could not load image" errors, silent audio

### Pitfall 3: Missing Audio Crashes Render
**What goes wrong:** Render fails entirely because one step lacks audio
**Why it happens:** No fallback handling for missing audio files
**How to avoid:** Pre-validate all files before render. For missing audio, render the step with screenshot only for 3 seconds (per locked decision). Check file existence in render.ts, set `hasAudio: false` for missing files.
**Warning signs:** Unhandled promise rejection from `<Audio>` component

### Pitfall 4: Off-by-One Frame Gaps or Overlaps
**What goes wrong:** Brief black frames between steps, or audio from adjacent steps bleeding
**Why it happens:** Floating point rounding in ms-to-frames conversion causes gaps/overlaps
**How to avoid:** Use `Math.ceil()` for step durations, then recalculate total composition duration as the sum of all ceil'd step frames (not ceil of total ms). This ensures no gaps.
**Warning signs:** Flicker between steps, audio glitches at transitions

### Pitfall 5: Memory Exhaustion on M1 Pro
**What goes wrong:** Render process killed by OOM, especially with many high-res screenshots
**Why it happens:** Default concurrency too high for 16GB M1 Pro with 1920x1080 compositions
**How to avoid:** Default `--concurrency=2` (locked decision). Allow override for machines with more RAM.
**Warning signs:** Process exit code 137 (SIGKILL), "JavaScript heap out of memory"

### Pitfall 6: React/React-DOM Peer Dependency Conflicts
**What goes wrong:** Multiple React instances, hooks errors, "Invalid hook call"
**Why it happens:** Tutorials workspace gets its own React, conflicting with web app's React
**How to avoid:** The tutorials workspace is isolated -- it needs its own React 18 install. This is fine since Remotion compositions are bundled separately by Remotion's webpack, not by Next.js.
**Warning signs:** "Invalid hook call" at render time

## Code Examples

### Complete render.ts CLI Script Pattern
```typescript
// Source: Adapted from existing tts.ts pattern + Remotion SSR docs
import * as fs from "node:fs";
import * as path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { TimingManifestSchema } from "../src/types/timing-manifest.js";

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0]?.startsWith("--")) {
    console.error("Usage: pnpm --filter tutorials render <tutorial-name> [--concurrency N]");
    process.exit(1);
  }
  const tutorialName = args[0]!;
  let concurrency = 2; // Default for M1 Pro
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--concurrency" && args[i + 1]) {
      concurrency = parseInt(args[i + 1]!, 10);
      if (isNaN(concurrency) || concurrency < 1) {
        console.error("Error: --concurrency must be a positive integer");
        process.exit(1);
      }
      i++;
    }
  }
  return { tutorialName, concurrency };
}

async function main() {
  const { tutorialName, concurrency } = parseArgs();

  // Pre-validation
  const timingPath = path.join(process.cwd(), "audio", tutorialName, "timing.json");
  const screenshotDir = path.join(process.cwd(), "output", tutorialName);

  if (!fs.existsSync(timingPath)) {
    console.error(`Error: timing.json not found at ${timingPath}`);
    console.error("Run capture and tts first: pnpm --filter tutorials capture <name> && pnpm --filter tutorials tts <name>");
    process.exit(1);
  }
  if (!fs.existsSync(screenshotDir)) {
    console.error(`Error: Screenshot directory not found at ${screenshotDir}`);
    console.error("Run capture first: pnpm --filter tutorials capture <name>");
    process.exit(1);
  }

  // Load and validate timing manifest
  const manifest = TimingManifestSchema.parse(
    JSON.parse(fs.readFileSync(timingPath, "utf-8"))
  );

  // Verify screenshots exist for each step
  for (const step of manifest.steps) {
    const screenshotPath = path.join(screenshotDir, `${step.stepId}.png`);
    if (!fs.existsSync(screenshotPath)) {
      console.error(`Error: Screenshot not found: ${screenshotPath}`);
      process.exit(1);
    }
  }

  // Bundle Remotion project
  console.log("Bundling Remotion project...");
  const bundleLocation = await bundle({
    entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    publicDir: process.cwd(),
  });

  // Build inputProps from manifest
  const inputProps = {
    tutorialName,
    steps: manifest.steps.map((s) => ({
      stepId: s.stepId,
      audioFile: s.audioFile,
      durationMs: s.durationMs,
    })),
    totalDurationMs: manifest.totalDurationMs,
  };

  // Select composition (triggers calculateMetadata)
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "tutorial",
    inputProps,
  });

  // Render
  const outputDir = path.join(process.cwd(), "videos");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${tutorialName}.mp4`);

  console.log(`Rendering ${tutorialName} (${manifest.steps.length} steps, ${(manifest.totalDurationMs / 1000).toFixed(1)}s)...`);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    crf: 18,
    concurrency,
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      if (Math.floor(progress * 100) % 10 === 0) {
        process.stdout.write(`\rRendering: ${(progress * 100).toFixed(0)}%`);
      }
    },
  });

  console.log(`\n\n--- Render Summary ---`);
  console.log(`Tutorial: ${tutorialName}`);
  console.log(`Duration: ${(manifest.totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`Output: ${outputPath}`);
}

main().catch((err) => {
  console.error("Render failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

### render-all.ts Discovery Pattern
```typescript
// Discover tutorials by scanning audio/ directory for timing.json files
const audioDir = path.join(process.cwd(), "audio");
const tutorials = fs.readdirSync(audioDir)
  .filter((name) => {
    const timingPath = path.join(audioDir, name, "timing.json");
    const screenshotDir = path.join(process.cwd(), "output", name);
    return fs.existsSync(timingPath) && fs.existsSync(screenshotDir);
  });

// Render sequentially (not recommended to parallelize per Remotion docs)
for (const tutorial of tutorials) {
  console.log(`\n=== Rendering: ${tutorial} ===`);
  // ... same render logic as single tutorial
}
```

### remotion.config.ts
```typescript
import { Config } from "@remotion/cli/config";

// Public dir = tutorials app root for asset access
Config.setPublicDir(".");

// Default concurrency for M1 Pro
Config.setConcurrency(2);

// Video settings
Config.setCodec("h264");
Config.setCrf(18);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Audio>` from `remotion` | `<Audio>` from `@remotion/media` | v4.0.x | Uses Mediabunny instead of FFmpeg for faster audio extraction |
| `<Video>` from `remotion` | `<OffthreadVideo>` from `remotion` | v3.x+ | Frame-exact extraction via FFmpeg outside browser |
| Manual `ffmpeg` stitching | `renderMedia()` all-in-one | v2.0+ | Single API call handles frames + audio + encoding |
| Static composition duration | `calculateMetadata` callback | v4.0+ | Dynamic duration from props without workarounds |

**Deprecated/outdated:**
- `<Audio>` and `<Video>` from `remotion` package directly: Use `@remotion/media` equivalents for better performance
- `getCompositions()`: Replaced by `selectComposition()` for single-composition renders
- `renderFrames()` + `stitchFramesToVideo()`: Use `renderMedia()` instead (combines both steps)

## Open Questions

1. **Remotion + tsx compatibility**
   - What we know: The project uses `tsx` to run TypeScript scripts. Remotion's `bundle()` uses webpack internally.
   - What's unclear: Whether `tsx` correctly handles Remotion's React JSX in the render script (the render script itself is Node.js, not browser code -- JSX is only in composition files bundled by webpack)
   - Recommendation: The render script (scripts/render.ts) should NOT contain JSX -- it only calls `bundle()`, `selectComposition()`, `renderMedia()`. JSX lives in `src/remotion/` which webpack bundles. This separation means `tsx` works fine for the script runner.

2. **WAV audio codec support in Remotion**
   - What we know: The TTS pipeline outputs WAV files. Remotion's `<Audio>` supports formats Chrome supports. Chrome supports WAV.
   - What's unclear: Whether WAV files cause any performance issues during rendering vs MP3/AAC
   - Recommendation: Use WAV directly -- they are already generated. Conversion adds complexity for no benefit in local rendering.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (no automated test framework for video rendering) |
| Config file | none |
| Quick run command | `pnpm --filter tutorials render getting-started` |
| Full suite command | `pnpm --filter tutorials render:all` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Each step renders as Sequence with screenshot + audio | manual | Render tutorial, inspect output MP4 for step transitions and audio sync | Wave 0 |
| COMP-02 | TutorialStep component works for all steps | manual | Render tutorial with multiple steps, verify all screenshots display | Wave 0 |
| COMP-03 | CLI renders MP4 with --concurrency flag | smoke | `pnpm --filter tutorials render getting-started --concurrency 2` | Wave 0 |

### Sampling Rate
- **Per task commit:** Verify TypeScript compiles (`pnpm --filter tutorials tsc --noEmit`)
- **Per wave merge:** Render a test tutorial and verify MP4 output
- **Phase gate:** Full render of at least one tutorial produces valid MP4

### Wave 0 Gaps
- [ ] `apps/tutorials/src/remotion/index.ts` -- Remotion entry point with registerRoot
- [ ] `apps/tutorials/src/remotion/Root.tsx` -- Composition registration
- [ ] `apps/tutorials/src/remotion/TutorialComposition.tsx` -- Step-to-Sequence mapping
- [ ] `apps/tutorials/src/remotion/TutorialStep.tsx` -- Shared step component
- [ ] `apps/tutorials/scripts/render.ts` -- Render CLI
- [ ] `apps/tutorials/scripts/render-all.ts` -- Batch render CLI
- [ ] `apps/tutorials/remotion.config.ts` -- Remotion configuration
- [ ] `apps/tutorials/videos/` directory added to `.gitignore`
- [ ] Remotion dependencies installed in tutorials package.json
- [ ] `render` and `render:all` scripts in package.json
- [ ] `render` task in turbo.json

## Sources

### Primary (HIGH confidence)
- [Remotion Composition docs](https://www.remotion.dev/docs/composition) -- Component API, registration, calculateMetadata
- [Remotion Sequence docs](https://www.remotion.dev/docs/sequence) -- Time-shifting, from/durationInFrames props
- [Remotion SSR Node.js guide](https://www.remotion.dev/docs/ssr-node) -- bundle() + selectComposition() + renderMedia() workflow
- [Remotion renderMedia API](https://www.remotion.dev/docs/renderer/render-media) -- Full parameter reference
- [Remotion bundle() API](https://www.remotion.dev/docs/bundle) -- Bundler configuration including publicDir
- [Remotion Audio from @remotion/media](https://www.remotion.dev/docs/media/audio) -- Modern Audio component API
- [Remotion config file](https://www.remotion.dev/docs/config) -- remotion.config.ts options
- [Remotion brownfield installation](https://www.remotion.dev/docs/brownfield) -- Installing in existing project
- [Remotion dynamic metadata](https://www.remotion.dev/docs/dynamic-metadata) -- calculateMetadata for variable duration
- [Remotion dataset rendering](https://www.remotion.dev/docs/dataset-render) -- Batch rendering pattern

### Secondary (MEDIUM confidence)
- [Remotion npm latest version](https://www.npmjs.com/package/remotion) -- v4.0.436 as of 2026-03-19
- [Remotion public directory](https://www.remotion.dev/docs/terminology/public-dir) -- publicDir behavior
- [Remotion absolute paths](https://www.remotion.dev/docs/miscellaneous/absolute-paths) -- Why absolute paths don't work, alternatives

### Tertiary (LOW confidence)
- None -- all findings verified with official Remotion documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Remotion's own documentation is comprehensive and consistent
- Architecture: HIGH -- Patterns directly from official SSR guide and dataset rendering tutorial
- Pitfalls: HIGH -- Version pinning and publicDir issues are well-documented; memory concerns validated by locked decision

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (Remotion releases frequently but API is stable within 4.0.x)
