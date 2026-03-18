# Architecture Research

**Domain:** Tutorial Video Production Pipeline (Playwright capture + Remotion composition + Local TTS)
**Researched:** 2026-03-18
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Tutorial Pipeline (apps/tutorials)               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │  Scripts &    │   │  Playwright   │   │  TTS (Python        │    │
│  │  Fixtures     │   │  Capture      │   │  subprocess)        │    │
│  │              │   │              │   │                      │    │
│  │ narration/   │   │ captures/    │   │ audio/               │    │
│  │ fixtures/    │   │  *.png       │   │  *.wav               │    │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘    │
│         │                  │                       │               │
│         └──────────────────┼───────────────────────┘               │
│                            ↓                                       │
│              ┌──────────────────────────┐                          │
│              │   Remotion Composition    │                          │
│              │                          │                          │
│              │  src/                    │                          │
│              │    compositions/         │                          │
│              │    components/           │                          │
│              │  public/ (staticFile)    │                          │
│              └──────────┬───────────────┘                          │
│                         ↓                                          │
│              ┌──────────────────────────┐                          │
│              │   Output: .mp4 videos    │                          │
│              │   out/                   │                          │
│              └──────────────────────────┘                          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  apps/web (Next.js 15) — launched by Playwright against localhost   │
│  No modifications needed — fully mocked via page.route()            │
└─────────────────────────────────────────────────────────────────────┘
```

### Decision: `apps/tutorials` (New Turborepo App)

**Recommendation:** Create `apps/tutorials` as a new Turborepo workspace app. Not a package, not root scripts.

**Why not `packages/tutorials`?**
- Packages are shared libraries consumed by other packages/apps. The tutorial pipeline is a standalone build artifact producer (MP4 videos), not a library imported by `apps/web` or `apps/agent`.
- Packages in this monorepo (`schemas`, `eslint-config`, `tsconfig`) are dependency-only.

**Why not root scripts?**
- Root-level scripts are ad-hoc utilities (the existing `scripts/secrets.sh`). The tutorial pipeline has its own dependencies (Remotion, Playwright config, TTS models), its own build/render commands, and its own output artifacts.
- Putting Remotion deps at root would pollute the web/agent dependency trees.

**Why `apps/tutorials`?**
- Consistent with monorepo convention: `apps/*` are independently buildable/runnable workspaces.
- Gets its own `package.json` with Remotion, Playwright, and kokoro-js dependencies isolated from web/agent.
- Turborepo can orchestrate it: `turbo run render --filter=tutorials`.
- The `pnpm-workspace.yaml` already includes `apps/*` -- no config change needed.
- Playwright needs to launch `apps/web` via `next dev` or a built server -- this is a cross-app dependency, natural for `apps/` siblings.

### Component Responsibilities

| Component | Responsibility | Location |
|-----------|----------------|----------|
| **Narration Scripts** | Written text for each tutorial step, with timing markers | `apps/tutorials/scripts/{tutorial-name}/` |
| **Mock Fixtures** | JSON responses for every intercepted API route | `apps/tutorials/fixtures/` |
| **Playwright Captures** | Drive real browser, intercept APIs, take screenshots per step | `apps/tutorials/captures/` |
| **TTS Generator** | Convert narration text to .wav audio files via Kokoro/Chatterbox | `apps/tutorials/audio/` |
| **Remotion Compositions** | Stitch screenshots + audio + overlays into final video | `apps/tutorials/src/` |
| **Render Pipeline** | Orchestration scripts that run capture -> TTS -> render | `apps/tutorials/pipeline/` |
| **Output** | Final .mp4 files | `apps/tutorials/out/` |

## Recommended Project Structure

```
apps/tutorials/
├── package.json              # Remotion, Playwright, kokoro-js deps
├── remotion.config.ts        # Remotion CLI config
├── playwright.config.ts      # Playwright config (baseURL: localhost:3000)
├── tsconfig.json
│
├── scripts/                  # Narration scripts per tutorial
│   ├── getting-started/
│   │   ├── narration.json    # [{step: 1, text: "...", durationMs: 4000}, ...]
│   │   └── metadata.json    # {title, description, fps, resolution}
│   ├── creating-deals/
│   │   ├── narration.json
│   │   └── metadata.json
│   └── ...                   # ~16 tutorial directories
│
├── fixtures/                 # Mock API responses (shared across tutorials)
│   ├── api/                  # Mirrors apps/web API route structure
│   │   ├── deals/
│   │   │   ├── list.json
│   │   │   └── [dealId]/
│   │   │       ├── detail.json
│   │   │       └── chat/
│   │   │           └── response.json
│   │   ├── agents/
│   │   │   └── chat/
│   │   │       └── stream.json
│   │   ├── deck-structures/
│   │   ├── presentations/
│   │   ├── generation-logs/
│   │   └── workflows/
│   ├── agent/                # Mocks for apps/agent Hono routes
│   │   ├── touch1/
│   │   ├── touch2/
│   │   ├── touch3/
│   │   └── touch4/
│   ├── auth/                 # Mock OAuth/session responses
│   │   └── session.json
│   └── google/               # Mock Google Drive/Slides responses
│       ├── drive-files.json
│       └── slides-get.json
│
├── captures/                 # Playwright test files + screenshot output
│   ├── tests/                # Playwright test specs
│   │   ├── getting-started.spec.ts
│   │   ├── creating-deals.spec.ts
│   │   ├── touch1-pager.spec.ts
│   │   ├── touch4-proposal.spec.ts
│   │   └── ...
│   ├── helpers/
│   │   ├── mock-routes.ts    # Shared page.route() interception setup
│   │   ├── auth-mock.ts      # Mock authenticated session
│   │   └── wait-helpers.ts   # Stability waits before screenshots
│   └── screenshots/          # Output: step-numbered PNGs per tutorial
│       ├── getting-started/
│       │   ├── 001-login-page.png
│       │   ├── 002-dashboard.png
│       │   └── ...
│       └── ...
│
├── audio/                    # TTS output
│   ├── getting-started/
│   │   ├── step-001.wav
│   │   ├── step-002.wav
│   │   └── ...
│   └── ...
│
├── src/                      # Remotion video compositions
│   ├── index.ts              # Remotion entry point (registerRoot)
│   ├── Root.tsx              # All compositions registered here
│   ├── compositions/         # One composition per tutorial
│   │   ├── GettingStarted.tsx
│   │   ├── CreatingDeals.tsx
│   │   ├── Touch1Pager.tsx
│   │   ├── Touch4Proposal.tsx
│   │   └── ...
│   ├── components/           # Shared Remotion components
│   │   ├── TutorialStep.tsx  # Screenshot + audio + overlay for one step
│   │   ├── ZoomEffect.tsx    # Animated zoom into UI regions
│   │   ├── TextOverlay.tsx   # Callout text overlays
│   │   ├── Transition.tsx    # Cross-fade or wipe between steps
│   │   ├── IntroSlate.tsx    # Title card at video start
│   │   └── OutroSlate.tsx    # End card with CTA
│   └── lib/
│       ├── load-tutorial.ts  # Load narration + screenshots for a tutorial
│       └── timing.ts         # Calculate frame counts from durations
│
├── pipeline/                 # Orchestration scripts
│   ├── capture.ts            # Run Playwright for one/all tutorials
│   ├── tts.ts                # Run TTS for one/all tutorials
│   ├── render.ts             # Run Remotion render for one/all tutorials
│   └── build-all.ts          # Full pipeline: capture -> tts -> render
│
├── public/                   # Remotion staticFile() assets
│   ├── brand/                # Lumenalta logos, colors
│   └── music/                # Background music tracks (optional)
│
└── out/                      # Final rendered videos (gitignored)
    ├── getting-started.mp4
    ├── creating-deals.mp4
    └── ...
```

### Structure Rationale

- **`scripts/`:** Narration scripts are the authoring surface. Each tutorial is a directory with structured JSON (not plain text) so Remotion compositions can programmatically read step text, timing, and zoom targets.
- **`fixtures/`:** Mirrors the real API route structure from `apps/web/src/app/api/` and `apps/agent`. This makes it obvious which endpoint a fixture mocks and simplifies maintenance when routes change.
- **`captures/tests/`:** Playwright specs are the "recording scripts" -- they navigate the real app, interact with mocked UI, and take screenshots. Separating `tests/` from `screenshots/` output keeps specs clean.
- **`src/`:** Standard Remotion project layout. Each composition file is one tutorial video. Shared components handle the repeating pattern: screenshot + audio + overlay per step.
- **`pipeline/`:** Orchestration layer. Each script is independently runnable (`pnpm --filter tutorials run capture -- --tutorial getting-started`) but `build-all.ts` chains them.
- **`public/`:** Remotion's `staticFile()` requires assets in `public/` adjacent to the Remotion `package.json`. Brand assets live here.

## Architectural Patterns

### Pattern 1: Fixture-First Mock Architecture

**What:** All API responses are pre-authored JSON fixtures loaded by a shared `mock-routes.ts` helper that calls `page.route()` for every known endpoint pattern before each Playwright test begins.

**When to use:** Every Playwright capture test.

**Trade-offs:**
- PRO: Fully deterministic -- same fixtures = same screenshots every time.
- PRO: Zero infrastructure needed (no DB, no agent, no Google APIs).
- CON: Fixtures must be manually updated when API response shapes change.
- CON: Fixtures can drift from real API contracts.

**Mitigation for drift:** Import Zod schemas from `@lumenalta/schemas` in a fixture validation script that checks all fixture JSON files conform to the real response types. Run this as a CI check.

**Example:**
```typescript
// captures/helpers/mock-routes.ts
import { Page } from '@playwright/test';
import dealsList from '../../fixtures/api/deals/list.json';
import sessionData from '../../fixtures/auth/session.json';

export async function setupMockRoutes(page: Page) {
  // Auth - simulate logged-in session
  await page.route('**/auth/v1/token*', route =>
    route.fulfill({ json: sessionData })
  );

  // Deals list
  await page.route('**/api/deals*', route =>
    route.fulfill({ json: dealsList })
  );

  // Agent service calls
  await page.route('**/agent/**', route =>
    route.fulfill({ json: { status: 'ok' } })
  );
}
```

### Pattern 2: Step-Indexed Pipeline

**What:** Each tutorial is a sequence of numbered steps. Narration scripts, screenshots, audio files, and Remotion sequences all share the same step index (001, 002, 003...). This creates a natural 1:1:1:1 mapping across pipeline stages.

**When to use:** Always -- this is the core data model.

**Trade-offs:**
- PRO: Adding/removing a step is straightforward -- renumber and re-run.
- PRO: Each pipeline stage can run independently given the previous stage's output exists.
- CON: Inserting a step mid-sequence requires renumbering (mitigated by using sparse numbering like 010, 020, 030).

**Example:**
```typescript
// scripts/getting-started/narration.json
[
  {
    "step": 1,
    "action": "screenshot",
    "text": "Welcome to AtlusDeck. Start by signing in with your Lumenalta Google account.",
    "durationMs": 4000,
    "zoom": { "selector": ".login-button", "scale": 1.5 }
  },
  {
    "step": 2,
    "action": "screenshot",
    "text": "After signing in, you will see the deal pipeline, your home base for managing all active opportunities.",
    "durationMs": 5000,
    "zoom": null
  }
]
```

### Pattern 3: Cross-App Playwright Launch

**What:** Playwright in `apps/tutorials` starts the `apps/web` Next.js dev server as a dependency, then runs capture tests against it. This is configured via Playwright's `webServer` config option.

**When to use:** Every capture run.

**Trade-offs:**
- PRO: Real app, real components, real routing -- screenshots are 100% faithful.
- PRO: No modifications needed to `apps/web` code.
- CON: `apps/web` dev server startup adds ~10-15 seconds.
- CON: Must ensure `apps/web` env vars don't try to connect to real services (but all calls are intercepted by `page.route()` anyway).

**Example:**
```typescript
// apps/tutorials/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './captures/tests',
  outputDir: './captures/screenshots',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'off', // We take manual screenshots, not automatic
    video: 'off',      // We compose video via Remotion, not Playwright
  },
  webServer: {
    command: 'pnpm --filter web run dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
```

### Pattern 4: TTS as Dual-Engine (JS Draft / Python Production)

**What:** TTS generation supports two engines. **Kokoro via kokoro-js** (npm package, pure JavaScript, runs on CPU) for fast draft iteration. **Chatterbox via Python subprocess** for production-quality narration. The pipeline script accepts an `--engine` flag to switch between them.

**When to use:** Draft with Kokoro during script development; render with Chatterbox once scripts are locked.

**Trade-offs:**
- PRO: `kokoro-js` requires zero Python setup -- fast onboarding for script iteration.
- PRO: Chatterbox produces near-human narration with emotion tags.
- CON: Chatterbox requires Python 3.11+ and GPU (M1 Metal/MPS) for speed.
- CON: Two different audio quality levels means draft timing may shift slightly with production voices.

**Example:**
```typescript
// pipeline/tts.ts
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

async function generateAudio(
  text: string,
  outputPath: string,
  engine: 'kokoro' | 'chatterbox'
) {
  if (engine === 'kokoro') {
    // Pure JS -- no Python required
    const { KokoroTTS } = await import('kokoro-js');
    const tts = await KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      { dtype: 'q8' }
    );
    const audio = await tts.generate(text, { voice: 'af_heart' });
    audio.save(outputPath);
  } else {
    // Python subprocess for production quality
    await exec('python', [
      'pipeline/chatterbox_generate.py',
      '--text', text,
      '--output', outputPath,
    ]);
  }
}
```

## Data Flow

### Full Pipeline Flow

```
Step 1: AUTHOR
  narration.json (human-written per tutorial)
      |
Step 2: CAPTURE (Playwright)                   Step 3: TTS (Kokoro or Chatterbox)
  Start apps/web dev server                       Read narration.json step text
  -> page.route() intercepts ALL API calls        -> Generate .wav per step
  -> Navigate through tutorial steps              -> Output: audio/{tutorial}/step-{N}.wav
  -> page.screenshot() at each step
  -> Output: captures/screenshots/{tutorial}/
      |                                               |
      +---------------------+-------------------------+
                            |
                            v
                  Step 4: COMPOSE (Remotion)
                    Load screenshots + audio + narration metadata
                    -> Build <Sequence> per step
                    -> Add overlays, zoom effects, transitions
                    -> npx remotion render
                    -> Output: out/{tutorial}.mp4
```

Steps 2 and 3 are independent and can run in parallel. Step 4 requires both to complete.

### Fixture-to-Route Mapping

The mock fixtures mirror the real API surface. Key routes to mock:

```
Real route (apps/web)                    Fixture file (apps/tutorials)
------------------------------------     ------------------------------------
GET  /api/deals                       -> fixtures/api/deals/list.json
GET  /api/deals/[id]                  -> fixtures/api/deals/[dealId]/detail.json
POST /api/deals/[id]/chat             -> fixtures/api/deals/[dealId]/chat/response.json
POST /api/agents/chat                 -> fixtures/api/agents/chat/stream.json
GET  /api/deck-structures             -> fixtures/api/deck-structures/list.json
GET  /api/presentations               -> fixtures/api/presentations/list.json
POST /api/generation-logs             -> fixtures/api/generation-logs/create.json
POST /api/workflows/[touchType]/start -> fixtures/api/workflows/start.json
GET  [AGENT_URL]/api/touch1/*         -> fixtures/agent/touch1/*.json
GET  [AGENT_URL]/api/touch4/*         -> fixtures/agent/touch4/*.json
POST [SUPABASE_URL]/auth/v1/token     -> fixtures/auth/session.json
```

### Build Order (Dependency Graph)

```
                 ┌─────────────────────┐
                 │  1. Author Scripts   │  (human, no deps)
                 │  narration.json      │
                 │  metadata.json       │
                 └────────┬────────────┘
                          │
              ┌───────────┼───────────┐
              |                       |
              v                       v
  ┌───────────────────┐   ┌───────────────────┐
  │ 2a. Capture (PW)  │   │ 2b. TTS Audio     │  (parallel)
  │  screenshots/     │   │  audio/            │
  └─────────┬─────────┘   └─────────┬─────────┘
            │                       │
            └───────────┬───────────┘
                        v
            ┌───────────────────────┐
            │ 3. Remotion Render    │  (depends on 2a + 2b)
            │  out/*.mp4            │
            └───────────────────────┘
```

### Turborepo Integration

Add to `turbo.json`:
```json
{
  "tasks": {
    "capture": {
      "dependsOn": ["web#build"],
      "outputs": ["captures/screenshots/**"],
      "cache": false
    },
    "tts": {
      "outputs": ["audio/**"],
      "cache": false
    },
    "render": {
      "dependsOn": ["capture", "tts"],
      "outputs": ["out/**"],
      "cache": false
    }
  }
}
```

Add to `apps/tutorials/package.json`:
```json
{
  "name": "tutorials",
  "private": true,
  "scripts": {
    "capture": "playwright test",
    "capture:one": "playwright test --grep",
    "tts": "tsx pipeline/tts.ts",
    "tts:draft": "tsx pipeline/tts.ts --engine kokoro",
    "tts:prod": "tsx pipeline/tts.ts --engine chatterbox",
    "render": "tsx pipeline/render.ts",
    "render:one": "tsx pipeline/render.ts --tutorial",
    "studio": "npx remotion studio",
    "build-all": "tsx pipeline/build-all.ts",
    "validate-fixtures": "tsx pipeline/validate-fixtures.ts"
  }
}
```

## Integration Points

### With Existing Monorepo

| Integration | Type | Notes |
|-------------|------|-------|
| `apps/web` dev server | Playwright `webServer` config launches it | No code changes to web needed |
| `@lumenalta/schemas` | Import Zod types for fixture validation | Optional but recommended to prevent drift |
| `apps/web` API routes | Fixture JSON mirrors route response shapes | Fixtures must be updated when APIs change |
| `apps/agent` Hono routes | Fixtures mock agent responses via URL pattern | Agent server is NOT started; all intercepted |
| Supabase Auth | Mock session cookies via `page.route()` | No real Supabase connection needed |
| Google APIs | Mock Drive/Slides responses in fixtures | No real Google credentials needed |
| Turborepo | New tasks: `capture`, `tts`, `render` | Cache disabled (deterministic but large output) |

### New vs Modified Components

| Component | Status | Details |
|-----------|--------|---------|
| `apps/tutorials/` | **NEW** | Entire new app workspace |
| `apps/web/` | **UNMODIFIED** | Playwright launches it as-is via dev server |
| `apps/agent/` | **UNMODIFIED** | Not started; all agent calls mocked in fixtures |
| `packages/schemas/` | **UNMODIFIED** | Optionally imported for fixture validation |
| `turbo.json` | **MODIFIED** | Add `capture`, `tts`, `render` task definitions |
| `package.json` (root) | **UNMODIFIED** | `@playwright/test` already installed at root |
| `.gitignore` | **MODIFIED** | Add `apps/tutorials/out/`, `apps/tutorials/audio/`, `apps/tutorials/captures/screenshots/` |

### External Dependencies (New)

| Dependency | Scope | Install Location |
|------------|-------|------------------|
| `remotion` + `@remotion/cli` + `@remotion/bundler` | npm | `apps/tutorials` |
| `kokoro-js` | npm | `apps/tutorials` (draft TTS, pure JS) |
| `@remotion/media-utils` | npm | `apps/tutorials` (audio duration detection) |
| `tsx` | npm devDep | `apps/tutorials` (run pipeline scripts) |
| `chatterbox-tts` | pip (Python) | System-level virtualenv (production TTS) |
| Python 3.11+ | System | Required only for Chatterbox production audio |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 tutorials | Single developer runs full pipeline locally. Kokoro-js draft TTS is sufficient. |
| 5-16 tutorials | Parallelize captures (Playwright sharding). Consider CI runner for renders. |
| 16+ tutorials | CI/CD pipeline with caching. Separate "capture" and "render" stages. Store screenshots as artifacts. |

### Scaling Priorities

1. **First bottleneck: Render time.** Remotion renders are CPU-intensive. A 5-minute tutorial at 30fps = 9,000 frames to render. On M1 Pro, expect ~10-20 minutes per tutorial. Mitigation: render only changed tutorials (hash narration.json + screenshots to detect changes).
2. **Second bottleneck: Fixture maintenance.** As `apps/web` API routes evolve, fixtures drift. Mitigation: automated fixture validation against Zod schemas from `@lumenalta/schemas`.

## Anti-Patterns

### Anti-Pattern 1: Capturing Video with Playwright Instead of Screenshots

**What people do:** Use Playwright's built-in video recording (`video: 'on'`) to capture tutorial footage directly.
**Why it's wrong:** Playwright video is screen-capture quality (low FPS, no control over zoom/transitions/overlays). You get a single unedited recording with no ability to add narration sync, callouts, or branded intro/outro.
**Do this instead:** Capture high-resolution screenshots per step, then compose with Remotion where you have full programmatic control over every frame.

### Anti-Pattern 2: Starting apps/agent for Tutorial Capture

**What people do:** Run both `apps/web` and `apps/agent` during captures so "real" agent responses come back.
**Why it's wrong:** Introduces non-determinism (LLM responses vary), requires credentials, requires database, makes captures slow and fragile.
**Do this instead:** Mock ALL agent routes via `page.route()` with fixture JSON. The agent service is never started during tutorial capture.

### Anti-Pattern 3: Monolithic Fixture File

**What people do:** Put all mock data in a single `mocks.json` file.
**Why it's wrong:** Becomes unmaintainable at ~16 tutorials with dozens of endpoints each. Hard to find which fixture corresponds to which route.
**Do this instead:** Mirror the real API route structure in the fixtures directory. One file per endpoint per response variant.

### Anti-Pattern 4: Putting Remotion in apps/web

**What people do:** Add Remotion to the web app's dependencies and create compositions alongside Next.js pages.
**Why it's wrong:** Remotion has its own webpack bundler that conflicts with Next.js. It adds ~50MB of dependencies to the production web app that will never be used in production. Build times increase for every web deploy.
**Do this instead:** Isolate Remotion in its own app workspace where its bundler config does not interfere with Next.js.

### Anti-Pattern 5: Hardcoded Screenshot Timing

**What people do:** Use fixed `await page.waitForTimeout(2000)` before every screenshot.
**Why it's wrong:** Either too slow (wastes time) or too fast (captures loading states). UI components render at different speeds.
**Do this instead:** Wait for specific selectors, network idle, or animation completion before capturing. Use `page.waitForSelector()` and `page.waitForLoadState('networkidle')`.

### Anti-Pattern 6: Committing Generated Artifacts to Git

**What people do:** Commit screenshots, audio files, or rendered videos to the repository.
**Why it's wrong:** Binary files bloat the repo. Screenshots and audio are regenerable from scripts + fixtures. Videos are ~50-200MB each.
**Do this instead:** Gitignore all generated output (`captures/screenshots/`, `audio/`, `out/`). Only commit source files: narration scripts, fixtures, Playwright specs, Remotion compositions, and pipeline orchestration.

## Sources

- [Remotion: Installing in existing project](https://www.remotion.dev/docs/brownfield) - Official docs on brownfield installation
- [Remotion: Composition docs](https://www.remotion.dev/docs/composition) - Composition and Sequence patterns
- [Remotion: Rendering](https://www.remotion.dev/docs/render) - CLI render workflow
- [Remotion: staticFile()](https://www.remotion.dev/docs/staticfile) - Asset loading from public/
- [Remotion monorepo template](https://github.com/Takamasa045/remotion-studio-monorepo) - Community monorepo pattern with pnpm
- [Playwright: Mock APIs](https://playwright.dev/docs/mock) - page.route() interception patterns
- [Playwright: Fixtures](https://playwright.dev/docs/test-fixtures) - Test fixture architecture
- [Playwright: Configuration](https://playwright.dev/docs/test-use-options) - webServer and screenshot config
- [kokoro-js npm package](https://www.npmjs.com/package/kokoro-js) - Pure JS TTS for Node.js (v1.2.1)
- [Kokoro-82M ONNX model](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) - ONNX model for kokoro-js
- [Chatterbox TTS (Resemble AI)](https://github.com/resemble-ai/chatterbox) - Production TTS model (0.5B params)
- [chatterbox-tts PyPI](https://pypi.org/project/chatterbox-tts/) - Python package for Chatterbox

---
*Architecture research for: Tutorial Video Production Pipeline (v1.9)*
*Researched: 2026-03-18*
