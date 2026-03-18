# Project Research Summary

**Project:** Lumenalta Agentic Sales Orchestration -- v1.9 Tutorial Video Production
**Domain:** Automated tutorial video production pipeline (Playwright capture + Remotion composition + local TTS)
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

v1.9 adds a fully offline, deterministic tutorial video production pipeline to the existing AtlusDeck monorepo. The pipeline captures pixel-perfect screenshots of the real Next.js app using Playwright with mocked APIs, generates narration audio from human-authored scripts using local TTS models, and composes final MP4 videos using Remotion (React-based programmatic video). The approach is well-supported by mature, actively maintained tools and avoids any cloud TTS costs or live infrastructure dependencies. All 16+ tutorials covering the platform's deal management, touch workflows, template/slide library, and integrations can be produced from a single developer's M1 Pro laptop.

The recommended approach creates a new `apps/tutorials` Turborepo workspace that isolates Remotion's Webpack bundler, heavy TTS model weights, and video rendering dependencies from the deployed web and agent apps. A two-tier TTS strategy uses kokoro-js (pure JavaScript, CPU) for fast draft iteration and Chatterbox-Turbo (Python sidecar, MPS/GPU) for production-quality narration. The pipeline follows a strict four-stage flow: author scripts, capture screenshots (Playwright) and generate audio (TTS) in parallel, then compose and render with Remotion.

The two critical risks are: (1) Playwright's `page.route()` cannot intercept Next.js Server Actions or server-side fetches -- a lightweight mock agent server is required alongside browser-level route interception, and (2) Chatterbox-Turbo's CUDA-trained weights require careful MPS adaptation on Apple Silicon with CPU-first loading and component-by-component GPU migration. Both risks have documented mitigations and should be addressed in the first two phases. Mock fixture data management across 16 tutorials is the largest sustained effort and must be architected with factories and schema validation from the start.

## Key Findings

### Recommended Stack

The pipeline adds four new npm package groups (Remotion core/renderer/bundler/CLI, kokoro-js, wav-encoder) and one Python package (chatterbox-tts) to the monorepo. Playwright is already installed at v1.58.2. All Remotion packages must be pinned to the exact same version (4.0.436) -- version mismatch causes runtime errors. See [STACK.md](./STACK.md) for full details.

**Core technologies:**
- **Remotion 4.0.436**: React-based programmatic video composition -- natural fit for the existing React 19 codebase, deterministic frame-by-frame control, bundled FFmpeg
- **Playwright 1.58.x**: UI capture with `page.route()` API mocking -- already installed, pixel-perfect screenshots, no new dependencies
- **kokoro-js 1.2.1**: Draft TTS in pure JavaScript via ONNX Runtime -- fast iteration loop (~3s generation), no Python needed
- **Chatterbox-Turbo 0.1.6**: Production TTS via Python sidecar -- near-human narration quality, paralinguistic tags, MIT licensed, beats ElevenLabs in blind tests

**Critical version constraints:** React 19 compatibility requires Remotion >= 4.0.236. Chatterbox requires Python 3.11 and torch==2.5.1 installed before chatterbox-tts (with `--no-deps`) to avoid MPS conflicts on Apple Silicon.

### Expected Features

See [FEATURES.md](./FEATURES.md) for full analysis.

**Must have (table stakes):**
- Structured tutorial script format (JSON) as single source of truth for the entire pipeline
- Playwright mock harness with `page.route()` interception + mock agent server for server-side calls
- Auth/session mocking (Google OAuth bypass via cookies)
- Mock fixture corpus for all 16 tutorials (biggest single effort)
- Per-step screenshot capture with animation disabling and network idle waits
- kokoro-js TTS draft narration with per-step .wav output
- Remotion `<Sequence>` composition with `<Audio>` narration sync
- Final MP4 render via Remotion CLI

**Should have (differentiators):**
- Chatterbox-Turbo production narration (significant quality upgrade)
- Zoom/pan effects on UI regions via CSS transforms and `interpolate()`
- Text overlays and callout annotations
- Cursor animation showing click targets
- `<TransitionSeries>` cross-fades between steps

**Defer (v2+):**
- Automated UI drift detection / CI re-recording
- Multi-language narration
- Tutorial versioning per app version
- Interactive in-app walkthroughs

### Architecture Approach

The pipeline lives in a new `apps/tutorials` Turborepo workspace with a step-indexed data model: narration scripts, screenshots, audio files, and Remotion sequences all share the same step numbering. Playwright launches the real `apps/web` dev server via its `webServer` config, intercepts all API calls with fixtures, and captures screenshots. TTS runs independently. Remotion compositions consume both outputs. No modifications to `apps/web` or `apps/agent` are required. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

**Major components:**
1. **Narration Scripts** (`scripts/`) -- human-authored JSON defining steps, narration text, timing, zoom targets
2. **Mock Fixtures** (`fixtures/`) -- JSON responses mirroring real API route structure, with shared base entities and tutorial-specific overrides
3. **Playwright Captures** (`captures/`) -- test specs that navigate the mocked app and take per-step screenshots
4. **TTS Generator** (`audio/`) -- dual-engine (kokoro-js draft / Chatterbox production) producing .wav per step
5. **Remotion Compositions** (`src/`) -- one composition per tutorial, shared components for TutorialStep, ZoomEffect, TextOverlay
6. **Pipeline Orchestration** (`pipeline/`) -- scripts chaining capture, TTS, and render with per-tutorial or batch execution

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all 6 critical pitfalls with full recovery strategies.

1. **Server Actions not interceptable by `page.route()`** -- AtlusDeck uses 13 server action files and multiple API routes making server-to-server fetches. Must build a lightweight mock agent server and point `AGENT_SERVICE_URL` to it during capture. This is the single most important thing to get right in Phase 1.

2. **Remotion memory exhaustion on 16GB M1 Pro** -- Default concurrency assumes it owns the machine. Cap at `--concurrency=2`, never run capture and render simultaneously, close other apps during final renders.

3. **Audio-visual desynchronization** -- TTS audio duration is unpredictable. Never hardcode `durationInFrames`. Generate all audio first, measure with `getAudioDurationInSeconds()`, build a timing manifest, and use `<Series>` for automatic chaining.

4. **Chatterbox CUDA-to-MPS loading failure** -- Model weights contain CUDA references. Must load to CPU first, then move components (t3, s3gen, ve) to MPS individually. Fall back to CPU if MPS proves unstable.

5. **Fixture data explosion** -- 16 tutorials x 10-30 steps x 3-5 endpoints = potentially 2,400 fixture files. Use fixture factories, shared base entities, and Zod schema validation from day one.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Mock Infrastructure and Workspace Setup
**Rationale:** Everything depends on working mocks. The mock agent server (for server-side fetches) and Playwright capture harness (for browser-side intercepts) are prerequisites for every subsequent phase. The `apps/tutorials` workspace must exist before any Remotion or TTS work begins.
**Delivers:** New `apps/tutorials` workspace, mock agent server, shared `page.route()` helpers, auth mocking, animation-disabling CSS, screenshot determinism, fixture factory pattern with Zod validation, fixture data for 2-3 pilot tutorials.
**Addresses:** Tutorial script format, Playwright mock harness, auth bypass, mock fixtures (pilot set), per-step screenshot capture, `.gitignore` for generated artifacts.
**Avoids:** Server Action interception failure (Pitfall 1), fixture data explosion (Pitfall 5), screenshot timing instability (Pitfall 6).

### Phase 2: TTS Pipeline (Draft and Production Audio)
**Rationale:** Audio must exist before Remotion compositions can be built, because `durationInFrames` depends on actual audio file lengths. Validating Chatterbox on M1 hardware early de-risks the production narration path.
**Delivers:** kokoro-js integration for draft .wav generation, Chatterbox-Turbo Python sidecar with MPS validation, timing manifest generation, dual-engine TTS pipeline with `--engine` flag.
**Uses:** kokoro-js 1.2.1 (npm), chatterbox-tts 0.1.6 (pip), wav-encoder, Python 3.11 venv.
**Implements:** TTS Generator component, timing manifest that feeds Remotion compositions.
**Avoids:** Audio-visual desync (Pitfall 3), Chatterbox CUDA/MPS failure (Pitfall 4).

### Phase 3: Remotion Composition and Render Pipeline
**Rationale:** With screenshots and audio available from Phases 1-2, compositions can now be built. Memory-safe render configuration must be established before scaling to all 16 tutorials.
**Delivers:** Remotion workspace config, shared TutorialStep component, first complete tutorial video ("Getting Started"), `--concurrency=2` render config, Turborepo task integration (capture/tts/render).
**Implements:** Remotion Compositions and Pipeline Orchestration components.
**Avoids:** Remotion memory exhaustion (Pitfall 2), Remotion/Next.js bundler conflict (Anti-Pattern 4).

### Phase 4: Full Tutorial Corpus (All 16 Tutorials)
**Rationale:** With the pipeline proven end-to-end on 1-3 tutorials, scale to all 16 by expanding fixture data, scripts, and capture specs. This is primarily an authoring effort, not an engineering effort.
**Delivers:** Complete fixture sets for all 16 tutorials (prioritized by mock complexity: low first, then medium, then high HITL workflows), narration scripts, capture specs, and rendered MP4s.
**Addresses:** All remaining mock fixture data, HITL stage mocking for Touch 1-4, remaining tutorial scripts.

### Phase 5: Visual Polish and Production Quality
**Rationale:** Only after all tutorials exist in basic form should visual enhancements be added. These are additive and do not require re-recording.
**Delivers:** Chatterbox production narration for all tutorials (replacing Kokoro drafts), zoom/pan effects, text overlays, cursor animations, `<TransitionSeries>` transitions, intro/outro slates.
**Addresses:** All P2 differentiator features from FEATURES.md.

### Phase Ordering Rationale

- **Phases 1-3 are strictly sequential** due to hard dependencies: mocks before screenshots, audio before compositions, both before rendering.
- **Phase 4 is the longest phase** (fixture authoring for 16 tutorials) but is parallelizable across tutorials and requires minimal engineering decisions.
- **Phase 5 is fully decoupled** from Phase 4 content authoring and can even overlap with late Phase 4 work on complex tutorials.
- **The mock agent server (Phase 1) is the single highest-risk item.** If it proves harder than expected (complex server action mocking), it gates everything. Budget extra time here.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Mock agent server design needs careful analysis of all 13 server action files and API route handlers to ensure complete coverage. Recommend `/gsd:research-phase` to catalog every endpoint that makes server-side fetches.
- **Phase 2:** Chatterbox MPS stability on M1 Pro is community-documented, not officially supported. Validate early with a 60-second continuous narration test before committing to Chatterbox for production.
- **Phase 4:** Touch 4 tutorial has "Very High" mock complexity (6-phase pipeline with 3 output artifacts). May need dedicated research to map all fixture requirements.

Phases with standard patterns (skip research-phase):
- **Phase 3:** Remotion composition patterns are thoroughly documented. Standard `<Sequence>` + `<Audio>` + `staticFile()` patterns apply directly.
- **Phase 5:** Visual enhancements (zoom, overlays, transitions) use standard Remotion APIs with extensive examples in official docs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Remotion and Playwright are mature, well-documented. kokoro-js is newer but ONNX-based with clear Node.js API. |
| Features | HIGH | Feature landscape is well-defined by the existing app's 16 tutorial topics. MVP vs. polish boundary is clear. |
| Architecture | HIGH | Turborepo workspace pattern is established in the codebase. Remotion monorepo integration has community templates. |
| Pitfalls | HIGH | Server Action limitation verified against Next.js GitHub discussions. Remotion OOM documented in official docs. Chatterbox MPS issues confirmed by GitHub issues. |

**Overall confidence:** HIGH

### Gaps to Address

- **Chatterbox MPS stability on M1 Pro 16GB:** Community adaptation exists but is not officially supported by Resemble AI. Validate with a real 60-second narration test in Phase 2 before committing. If unstable, Kokoro provides acceptable fallback quality.
- **Mock agent server completeness:** The exact list of server-side endpoints that need mocking (beyond the 13 known server action files) requires a full audit of `apps/web` API routes during Phase 1 planning.
- **Render time estimates:** "1-2 min per minute of output" is based on community reports, not benchmarked on this project's composition complexity. Run `npx remotion benchmark` in Phase 3.
- **kokoro-js CPU performance on M1:** Claimed ~3s for ~5s of audio, but no specific M1 benchmarks. Low risk since it is only used for drafts.

## Sources

### Primary (HIGH confidence)
- [Remotion official docs](https://www.remotion.dev/) -- framework capabilities, rendering, audio sync, performance, memory
- [Playwright Mock APIs](https://playwright.dev/docs/mock) -- `page.route()` capabilities and limitations
- [Chatterbox GitHub](https://github.com/resemble-ai/chatterbox) -- official repo, architecture, version requirements
- [Next.js Server Action mocking discussion #67136](https://github.com/vercel/next.js/discussions/67136) -- confirms `page.route()` limitation

### Secondary (MEDIUM confidence)
- [kokoro-js npm](https://www.npmjs.com/package/kokoro-js) -- v1.2.1, Node.js server-side usage with `device: "cpu"`
- [Chatterbox Apple Silicon adaptation](https://huggingface.co/Jimmi42/chatterbox-tts-apple-silicon-code) -- MPS fixes (community, not official)
- [Remotion monorepo template](https://github.com/Takamasa045/remotion-studio-monorepo) -- pnpm workspace pattern

### Tertiary (LOW confidence, validate during implementation)
- kokoro-js CPU performance on M1 ARM64 -- inferred from general ONNX support, not benchmarked
- Chatterbox MPS install order -- community-documented, not official Resemble AI guidance
- Remotion render time estimates -- community reports, varies by composition complexity

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
