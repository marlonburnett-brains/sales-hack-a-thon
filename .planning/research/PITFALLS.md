# Pitfalls Research

**Domain:** Automated tutorial video production pipeline (Playwright + Remotion + Local TTS) added to existing Next.js/Mastra monorepo
**Researched:** 2026-03-18
**Confidence:** HIGH (verified against official docs, GitHub issues, and community reports)

## Critical Pitfalls

### Pitfall 1: page.route() Cannot Intercept Server Actions or Server-Side Fetches

**What goes wrong:**
AtlusDeck's web app uses 13 Server Action files (`"use server"` in `apps/web/src/lib/actions/`) and multiple Next.js API routes that make server-to-server fetch calls to the Mastra agent (`AGENT_SERVICE_URL`). Playwright's `page.route()` only intercepts requests originating from the **browser process**. Server Actions execute on the Next.js server process -- a completely separate Node.js process that Playwright cannot reach. The tutorial recordings will show real errors, spinners that never resolve, or empty data instead of mocked content.

**Why it happens:**
Playwright instruments the browser's network layer via CDP (Chrome DevTools Protocol). Server Components, Server Actions, and API route handlers (`apps/web/src/app/api/`) make fetch calls from Node.js, not from the browser. These requests never touch the browser's network stack. This is a fundamental architectural limitation, not a bug.

**How to avoid:**
1. **Do NOT rely solely on `page.route()`** for mocking. It works only for client-side fetches (e.g., `fetch()` in `useEffect` or event handlers).
2. **Mock at the HTTP boundary of the Next.js server.** Two viable approaches:
   - **Mock agent server (recommended):** Run a lightweight mock server (Express/Hono) that mimics the Mastra agent API. Point `AGENT_SERVICE_URL=http://localhost:MOCK_PORT` when running tutorial capture. This intercepts all server-to-server calls without modifying the real app.
   - **MSW with Next.js 15 experimental server support:** MSW can now mock server-side requests in Next.js 15 App Router, but this is experimental and adds a dependency.
3. **For client-side-only requests** (Google Picker, external scripts), `page.route()` works fine and should be used.
4. **Hybrid strategy:** Mock agent server for agent calls + `page.route()` for browser-only calls (Google OAuth, external scripts, Supabase auth).

**Warning signs:**
- Tutorial captures show loading spinners that never complete
- Server Action calls return `undefined` in mocked environment
- Intermittent failures where some API calls work (client-side) and others don't (server-side)

**Phase to address:**
Phase 1 (Mock Infrastructure) -- this must be the very first thing built. Every subsequent phase depends on working mocks.

---

### Pitfall 2: Remotion Chromium Memory Exhaustion on 16GB M1 Pro

**What goes wrong:**
Remotion renders each frame by opening Chromium tab(s) in parallel. By default, it uses half the available CPU threads for concurrency and caches `OffthreadVideo` frames using half of system memory (~8GB on a 16GB machine). With the Next.js dev server, Playwright browser, and Remotion's Chromium instances all running simultaneously, the M1 Pro's 16GB unified memory gets exhausted. This causes "Target closed" errors (Chromium OOM crashes), partial renders, or system-wide slowdown.

**Why it happens:**
Remotion's default concurrency assumes it owns the machine. On a 16GB system already running a Next.js dev server (~500MB-1GB), Playwright's Chromium (~500MB-1GB), and potentially a TTS model, there is only ~12GB left for Remotion. Each Remotion Chromium worker uses 200-500MB. Default concurrency of 4-5 workers can consume 2GB+ just for rendering tabs. Additionally, Remotion versions between v2.4.3 and v2.6.6 had an `angle` renderer memory leak that crashes long renders -- this was fixed in v3.0.8+, but the underlying memory pressure on 16GB remains.

**How to avoid:**
1. **Separate capture and render phases.** Never run Playwright capture and Remotion rendering simultaneously. Capture all screenshots/clips first, kill the Next.js server and Playwright, then start Remotion.
2. **Cap Remotion concurrency to 2** on 16GB M1 Pro: `--concurrency=2` or in config `Config.setConcurrency(2)`.
3. **Disable simultaneous encoding:** Set `--enforce-audio-track` and consider rendering frames first, encoding separately.
4. **Use `npx remotion benchmark`** to find the optimal concurrency for the target machine before committing to a pipeline config.
5. **Close all other apps** during final renders. Memory budget: ~2GB OS, ~1GB Remotion workers (x2), ~2GB FFmpeg encoding, rest for frame cache.

**Warning signs:**
- "Target closed" errors during `npx remotion render`
- Render completes but output has black frames or frozen sections
- System becomes unresponsive during rendering
- Render time grows non-linearly with video length

**Phase to address:**
Phase 3 (Remotion Composition) -- establish memory-safe render config before building all 16 tutorials.

---

### Pitfall 3: Audio-Visual Desynchronization in Narrated Tutorials

**What goes wrong:**
Narration audio drifts out of sync with the visual content. A narrator says "click the Create Deal button" but the button click happens 2 seconds earlier or later on screen. This happens because TTS audio duration is unpredictable -- the same sentence can produce audio files of varying length depending on the model, voice, and text content. Hardcoding frame durations for `<Sequence>` components based on estimated timing leads to drift that compounds across a 3-5 minute tutorial.

**Why it happens:**
Remotion's `<Sequence>` component requires `durationInFrames` as a fixed number at composition time. If you estimate "this narration is about 4 seconds" and set `durationInFrames={120}` (at 30fps), but the actual audio is 4.7 seconds, the visual transitions fire 0.7 seconds too early. Over 20-30 sequences in a tutorial, errors compound. Remotion will seek audio if drift exceeds 0.45 seconds (the default tolerance), causing audible jumps or skips.

**How to avoid:**
1. **Generate all audio files FIRST**, before building Remotion compositions.
2. **Use `getAudioDurationInSeconds()` from `@remotion/media-utils`** to calculate exact frame counts from actual audio files. Never hardcode durations.
3. **Build a timing manifest:** After TTS generation, create a JSON file mapping each step to its exact audio duration in seconds. The Remotion composition reads this manifest to set `durationInFrames` dynamically: `Math.ceil(audioDuration * fps)`.
4. **Use `<Series>` instead of manual `<Sequence>` offsets.** `<Series>` automatically chains sequences without manual `from` calculation, eliminating cumulative offset errors.
5. **Add 0.3-0.5 second padding** between narration segments for breathing room. Silence is better than overlap.
6. **Pipeline order must be:** Script -> TTS audio -> Measure durations -> Build Remotion composition -> Render.

**Warning signs:**
- Narration mentions UI elements before they appear on screen
- Audible "jumps" or "skips" in narration playback
- Final video duration does not match sum of audio durations + transitions
- Hardcoded `durationInFrames` values anywhere in composition code

**Phase to address:**
Phase 2 (TTS Pipeline) must produce a timing manifest. Phase 3 (Remotion Composition) must consume it. This is a cross-phase dependency that must be designed upfront.

---

### Pitfall 4: Chatterbox-Turbo CUDA-to-MPS Loading Failure on Apple Silicon

**What goes wrong:**
Chatterbox-Turbo's pretrained model weights contain CUDA device references. Loading them on an M1 Pro (which has MPS, not CUDA) throws `RuntimeError: Attempting to deserialize object on a CUDA device but torch.cuda.is_available() is False`. Even after fixing the load, directly moving tensors to MPS causes allocation failures. The official library does not natively support MPS and defaults to CPU on Apple Silicon for "stability and compatibility."

**Why it happens:**
The official Chatterbox-Turbo model was trained and saved on CUDA hardware. PyTorch's `torch.load()` defaults to loading tensors on the device they were saved from. Apple Silicon Macs use MPS (Metal Performance Shaders), not CUDA. The model's internal components (t3, s3gen, ve) must be moved to MPS individually after first loading to CPU.

**How to avoid:**
1. **Use the Apple Silicon adaptation** from `Jimmi42/chatterbox-tts-apple-silicon-code` on Hugging Face, which patches `torch.load` with `map_location='cpu'` and implements proper MPS device detection with component-by-component GPU migration.
2. **Load to CPU first, then move to MPS component-by-component:**
   ```python
   model = ChatterboxTTS.from_pretrained("cpu")
   model.t3 = model.t3.to("mps")
   model.s3gen = model.s3gen.to("mps")
   model.ve = model.ve.to("mps")
   ```
3. **Require PyTorch 2.0+** for proper MPS support.
4. **Chunk long narration text** at sentence boundaries (max ~250 chars per chunk) to avoid MPS memory pressure on the 16GB unified memory.
5. **Fall back to CPU** if MPS produces audio artifacts or crashes -- CPU inference is slower (~5-10x) but functional and deterministic.

**Warning signs:**
- `RuntimeError` mentioning CUDA on a machine without CUDA
- MPS tensor allocation errors during inference
- Audio output contains static, clicks, or garbled segments (partial MPS failure)
- Python process killed by OS (OOM on unified memory)

**Phase to address:**
Phase 2 (TTS Pipeline) -- validate Chatterbox-Turbo on M1 Pro hardware before writing any tutorial scripts that depend on it.

---

### Pitfall 5: Fixture/Mock Data Explosion Across 16 Tutorials

**What goes wrong:**
Each tutorial requires unique mock API responses for every server action, agent call, Google API call, and async workflow step. With 16 tutorials, each having 10-30 steps, and each step potentially requiring 3-5 mocked API responses, you are looking at 500-2,400 fixture files. These become unmaintainable -- a single schema change in the real app requires updating hundreds of fixtures. Fixtures diverge from real API shapes, and tutorials show behavior that does not match the real app.

**Why it happens:**
Developers start by copy-pasting real API responses into fixture files. As the app evolves (v1.8 already deferred 4 phases), fixtures become stale. Without a system for generating fixtures from real responses or validating fixture shapes against Zod schemas, drift is invisible until a tutorial is re-rendered and looks wrong.

**How to avoid:**
1. **Centralize shared fixtures.** Many tutorials share the same deal, user, template, and slide data. Create a `fixtures/shared/` directory with base entities that tutorials import and extend.
2. **Validate fixtures against Zod schemas.** The project already uses Zod v4 extensively. Write a validation script that loads all fixtures and validates them against the corresponding API response schemas from `packages/schemas`.
3. **Use fixture factories, not raw JSON.** Build TypeScript factory functions (e.g., `createDealFixture({ status: 'active', touch: 'touch-1' })`) that produce valid API response shapes. Updates propagate automatically.
4. **Organize by tutorial, not by API endpoint.** Each tutorial gets a directory with its specific overrides, importing from shared fixtures. Structure: `fixtures/shared/`, `fixtures/tutorials/01-getting-started/`, etc.
5. **Add a CI check** that validates all fixtures against current schemas on every PR.

**Warning signs:**
- Duplicated JSON across tutorial fixture directories
- Tutorials rendering with missing fields or wrong data shapes
- Schema changes in the real app do not trigger fixture updates
- Fixture files exceed 5,000 lines in a single directory

**Phase to address:**
Phase 1 (Mock Infrastructure) -- design the fixture architecture before building any tutorials. Retrofitting is extremely painful.

---

### Pitfall 6: Playwright Screenshot Timing Instability

**What goes wrong:**
Screenshots capture intermediate UI states -- loading spinners, half-rendered animations, stale data from previous steps. Tutorials show inconsistent UI states that confuse viewers. CSS transitions cause screenshots to capture mid-animation frames. React Server Components add another layer -- the RSC payload might still be streaming when the screenshot fires.

**Why it happens:**
`page.screenshot()` captures the current frame, but "current" depends on when React finishes rendering, when CSS animations complete, and when mocked API responses resolve. Unlike `page.click()` which has built-in actionability checks, `page.screenshot()` does not wait for visual stability.

**How to avoid:**
1. **Disable all CSS animations** during capture: `page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }' })`.
2. **Wait for network idle** before every screenshot: `await page.waitForLoadState('networkidle')`.
3. **Wait for specific UI elements** rather than arbitrary timeouts: `await page.waitForSelector('[data-testid="deal-card"]', { state: 'visible' })`.
4. **Add `data-testid` attributes** to key UI elements across the app for capture stability. This also benefits future E2E testing.
5. **Use `page.screenshot({ animations: 'disabled' })` ** -- Playwright's built-in animation disabling.
6. **Never use `page.waitForTimeout()`** -- it is flaky. Use deterministic waiters.

**Warning signs:**
- Screenshots show loading spinners or skeleton screens
- Same tutorial capture produces visually different screenshots on re-run
- Screenshots show toast notifications (Sonner) or transient UI elements
- Dark/light mode inconsistencies between captures

**Phase to address:**
Phase 1 (Mock Infrastructure) -- establish screenshot helpers and CSS overrides as part of the capture harness.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded frame durations in Remotion | Faster initial composition | Every TTS re-generation or voice change requires manual updates to all 16 tutorials | Never -- always compute from audio duration |
| Raw JSON fixture files | Quick to create by copying API responses | Schema drift, no validation, copy-paste duplication across tutorials | Only for initial prototyping of first tutorial; migrate to factories before tutorial 3 |
| Running capture + render in one process | Simpler pipeline script | OOM on 16GB M1, unreliable renders, non-deterministic failures | Never on 16GB hardware -- always separate phases |
| Storing rendered videos in git | Simple, everything in one place | Repo bloats to multi-GB, clone times explode, git operations slow down | Never -- use `.gitignore` for all `*.mp4`, `*.wav`, `*.png` outputs |
| Single monolithic Playwright script per tutorial | Easy to understand initially | Impossible to re-capture a single step; full re-run on any change | Never -- each step should be independently capturable |
| Using Kokoro for final production audio | Avoids Chatterbox-Turbo MPS setup | Noticeably less natural narration quality | Only if Chatterbox-Turbo proves too unstable on M1 after debugging |
| Installing Remotion inside apps/web | Avoids new workspace package | Remotion bundler (Webpack) conflicts with Next.js; bloats web app dependencies | Never -- create a separate `apps/video` or `packages/video` workspace |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Playwright + Next.js Server Actions | Using `page.route()` to mock server actions -- it silently fails because requests originate from the server process, not the browser | Mock at the server boundary: point `AGENT_SERVICE_URL` to a local mock server that returns fixture data |
| Playwright + Supabase Auth | Trying to mock the OAuth flow through the browser UI | Set auth cookies directly via `page.context().addCookies()` to simulate logged-in state; skip the OAuth redirect entirely |
| Remotion + local audio files | Using relative paths for audio `src` in `<Audio>` components | Use `staticFile()` from Remotion to reference files in the `public/` directory, or use absolute `file://` URLs |
| Remotion + Playwright screenshots | Importing PNG screenshots with inconsistent dimensions causing layout shifts | Standardize viewport size (`1920x1080`) in Playwright config; all screenshots will be identical dimensions |
| Kokoro ONNX + Node.js | Importing `kokoro-onnx` Python package from Node.js pipeline | Kokoro has a JavaScript port (`kokoro-js` by Xenova) that runs natively in Node.js with ONNX Runtime. Use that instead of Python. |
| Chatterbox-Turbo + Node.js pipeline | Trying to call Python TTS from Node.js synchronously | Use `child_process.execFile` with a Python wrapper script, or run TTS as a separate pipeline step that writes `.wav` files to disk |
| Remotion + Next.js monorepo | Installing Remotion inside `apps/web` (the Next.js app) | Create a separate `apps/video` or `packages/video` workspace. Remotion has its own bundler that conflicts with Next.js Webpack config |
| Playwright video recording | Using Playwright's built-in video recording for tutorial captures | Playwright video recording is low-quality VP8 WebM at fixed resolution, designed for test debugging. Use screenshots for stills and short clip recording for animations, then compose in Remotion |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all 16 tutorials in one sequence | 4+ hour total render time on M1 Pro | Render tutorials independently; parallelize only if memory allows (max 2 concurrent renders) | Immediately at 16 tutorials, each 3-5 min at 30fps |
| Full-resolution PNG screenshots for every frame | 50-100MB of PNGs per tutorial (1920x1080 uncompressed) | Use JPEG at 85% quality for non-text-heavy frames; PNG only for UI detail shots needing crisp text | At 300+ screenshots per tutorial |
| Remotion default concurrency on 16GB | OOM crash mid-render, lost progress, "Target closed" errors | Set `--concurrency=2`, disable simultaneous encoding | Immediately on 16GB M1 Pro with any other processes running |
| Re-running full TTS pipeline for script tweaks | 10-20 min per tutorial for audio regeneration | Cache audio by content hash of script text; only regenerate changed segments | At 16 tutorials with iterative script editing |
| Loading Chatterbox-Turbo model per audio segment | 30-60 second model load per invocation | Load model once, generate all segments for a tutorial in a single Python session | At 200+ audio segments across 16 tutorials |
| Playwright browser not headless during capture | Visible browser window consumes GPU resources for compositing | Use `headless: true` (default in Playwright) for all captures; screen recording not needed since we take programmatic screenshots | At scale with multiple capture runs |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Fixture files containing real API keys or tokens | Secrets leaked in git history forever | Use obviously fake values (`"sk-FAKE-000"`, `"mock-jwt-token"`) in all fixtures; add a grep-based CI check for real key patterns |
| Screenshots capturing real user emails/data | PII in tutorial videos shown to external users | Mock all user data with fictional names/emails; verify no `@lumenalta.com` emails appear in any fixture or screenshot |
| Committing `.env` files with mock server config | Environment config leaks to repo | Add mock server `.env` to `.gitignore`; use `.env.example` patterns |
| Tutorial showing real AtlusAI content or client data | Confidential client information in published videos | All AtlusAI/Discovery fixtures must use fictional company data; review every screenshot before publishing |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tutorials show UI that does not match current app version | Users cannot find buttons/features shown in video | Re-capture on every significant UI change; never hand-edit screenshots |
| Narration moves too fast for viewers to follow | Users pause/rewind constantly | Add 0.5-1.0 second silence after each action; let UI settle before narrating next step |
| Tutorial shows advanced workflows without basic context | New users lost in Touch 4 tutorial without understanding deals | Order tutorials with dependencies: Getting Started -> Deals -> Touch 1 -> Touch 2 -> etc. |
| Zoom effects make text unreadable | Users cannot read form labels or button text during zoomed portions | Zoom to no more than 200% on 1920x1080; test readability at 720p playback resolution |
| No visual indicator of what the narrator is describing | Users do not know where to look on a complex UI screen | Add highlight/spotlight overlays in Remotion compositions pointing to the relevant UI area |
| All 16 tutorials have identical pacing | Some features need more explanation time than others | Adjust pacing per tutorial complexity: simple features get faster pacing, HITL workflows get more breathing room |

## "Looks Done But Isn't" Checklist

- [ ] **Mock server:** Covers all 13 server action files AND all API route handlers (`/api/agents/chat`, `/api/visual-qa`, `/api/deck-structures/chat`) -- not just `page.route()` browser intercepts
- [ ] **Audio sync:** Every `<Sequence>` `durationInFrames` is computed from `getAudioDurationInSeconds()`, never hardcoded
- [ ] **Chatterbox-Turbo on M1:** Successfully generates 60+ seconds of continuous audio without MPS errors -- not just a 3-second test clip
- [ ] **Fixture validation:** A script validates all fixture JSON files against Zod schemas from `packages/schemas`
- [ ] **Screenshot determinism:** Same Playwright capture script produces visually identical screenshots on 3 consecutive runs
- [ ] **Memory safety:** Full 5-minute tutorial render completes without "Target closed" errors at `--concurrency=2`
- [ ] **Git hygiene:** `.gitignore` excludes all `*.mp4`, `*.wav`, `*.png` in output directories; repo size stays under 100MB
- [ ] **Cross-tutorial consistency:** All 16 tutorials use the same viewport size (1920x1080), theme, mock user, and visual style
- [ ] **Narration pacing:** Every tutorial has been watched end-to-end at 1x speed by a human; auto-generated pacing often feels rushed
- [ ] **Supabase auth mock:** Auth cookies set correctly; no real OAuth redirects during capture; session persists across page navigations
- [ ] **Sonner toasts suppressed:** Toast notifications disabled or deterministically timed during capture to avoid screenshot pollution

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Server Actions not mocked (broken captures) | MEDIUM | Build mock agent server, re-capture all affected tutorials |
| OOM during Remotion render (partial output) | LOW | Reduce concurrency, re-render from scratch (compositions are declarative, no state lost) |
| Audio-visual desync across tutorials | HIGH | Rebuild timing manifests from audio files, update all Remotion compositions, re-render everything |
| Chatterbox-Turbo fails on M1 | LOW | Fall back to Kokoro-82M for all production audio; quality is lower but functional |
| Fixture schema drift after app update | MEDIUM | Run fixture validation script, update factories to match new schemas, re-capture affected tutorials |
| Repo bloated with binary artifacts | HIGH | Requires `git filter-branch` or BFG Repo Cleaner to purge history; add `.gitignore` rules retroactively |
| Remotion installed in apps/web causing build conflicts | MEDIUM | Move all Remotion code to `apps/video` workspace; update imports and build scripts; may require adjusting Turborepo pipeline |
| Screenshots non-deterministic across runs | MEDIUM | Add animation disabling, network idle waits, and explicit element waiters to every capture step; re-capture affected tutorials |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Server Actions not interceptable by page.route() | Phase 1: Mock Infrastructure | All 13 server action endpoints return mock data; full app navigable with mock agent server running |
| Remotion OOM on 16GB M1 Pro | Phase 3: Remotion Composition | 5-minute test video renders without "Target closed" at concurrency=2 |
| Audio-visual desync | Phase 2: TTS Pipeline + Phase 3: Remotion | Timing manifest generated; first tutorial audio aligns within 0.2s at every step boundary |
| Chatterbox-Turbo CUDA/MPS failure | Phase 2: TTS Pipeline | 60-second continuous narration generated on M1 Pro MPS without errors |
| Fixture data explosion | Phase 1: Mock Infrastructure | Fixture factory pattern established with shared base fixtures; shared fixtures imported by 3+ tutorials |
| Screenshot timing instability | Phase 1: Mock Infrastructure | Same capture produces identical screenshots on 3 consecutive runs with animation disabling and network idle waits |
| Binary artifacts bloating git | Phase 1: Mock Infrastructure | `.gitignore` rules in place for output directories; documented artifact storage strategy (local `output/` or external) |
| Remotion/Next.js bundler conflict | Phase 3: Remotion Composition | Remotion workspace (`apps/video`) builds independently; `turbo run build` succeeds for all workspaces |
| Cross-language Node.js/Python pipeline | Phase 2: TTS Pipeline | Python TTS wrapper script callable from Node.js pipeline; `.wav` output written to shared directory; error handling covers Python process failures |

## Sources

- [Remotion Performance Tips](https://www.remotion.dev/docs/performance) -- official guidance on concurrency and memory
- [Remotion "Target closed" Error](https://www.remotion.dev/docs/target-closed) -- OOM crash causes: "A Chrome tab can crash if the process runs out of memory"
- [Remotion Audio Usage](https://www.remotion.dev/docs/using-audio) -- seek tolerance of 0.45 seconds, audio timing and sync behavior
- [Remotion getAudioDurationInSeconds](https://www.remotion.dev/docs/get-audio-duration-in-seconds) -- dynamic duration calculation from audio files
- [Remotion Sequence](https://www.remotion.dev/docs/sequence) -- frame-based timing control for visual/audio alignment
- [Remotion Hardware Acceleration](https://www.remotion.dev/docs/hardware-acceleration) -- encoding options for macOS
- [Remotion Renderer CPU Issue #4300](https://github.com/remotion-dev/remotion/issues/4300) -- concurrency and core utilization on macOS
- [Next.js + Playwright Server Action Mocking Discussion #67136](https://github.com/vercel/next.js/discussions/67136) -- confirms page.route() cannot intercept server actions
- [Fetch Mocking with Playwright in Next.js 15](https://momentic.ai/blog/fetch-mocking-with-playwright-next-js) -- MSW experimental server-side support
- [Next.js SSR Request Mocking via Playwright](https://maxschmitt.me/posts/nextjs-ssr-request-mocking-playwright) -- proxy-based approach for server-side mocking
- [Playwright Screenshots Docs](https://playwright.dev/docs/screenshots) -- `animations: 'disabled'` option
- [Playwright Mock APIs Docs](https://playwright.dev/docs/mock) -- page.route() capabilities and scope
- [Chatterbox-TTS Apple Silicon Adaptation](https://huggingface.co/Jimmi42/chatterbox-tts-apple-silicon-code) -- MPS fixes: CPU-first loading, component-by-component GPU migration, text chunking
- [Chatterbox torch.load() Issue #85 on Mac M1 Pro](https://github.com/resemble-ai/chatterbox/issues/85) -- CUDA device mapping fix for Apple Silicon
- [Kokoro.js by Xenova](https://huggingface.co/posts/Xenova/503648859052804) -- JavaScript/Node.js port of Kokoro TTS using ONNX Runtime
- [Kokoro-82M ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) -- pre-built ONNX model for CPU inference
- [Remotion Audio Sync Fix Guide](https://crepal.ai/blog/aivideo/blog-how-to-fix-remotion-audio-out-of-sync/) -- delay, drift, trimming, and sample rate issues
- [Git LFS Alternatives](https://www.anchorpoint.app/blog/5-alternatives-to-git-lfs-for-game-development) -- strategies for large binary file management
- Direct codebase analysis: 13 Server Action files in `apps/web/src/lib/actions/`, API routes at `apps/web/src/app/api/agents/chat/`, `apps/web/src/app/api/visual-qa/`, `apps/web/src/app/api/deck-structures/chat/` all make server-side fetches to `AGENT_SERVICE_URL`

---
*Pitfalls research for: v1.9 Tutorial Video Production Pipeline on AtlusDeck*
*Researched: 2026-03-18*
