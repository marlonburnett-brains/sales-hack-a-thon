# Feature Research

**Domain:** Automated tutorial video production pipeline for SaaS platform (v1.9)
**Researched:** 2026-03-18
**Confidence:** HIGH (Playwright, Remotion well-documented; MEDIUM for TTS models on M1 hardware)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that make the pipeline functional. Without these, you cannot produce a single tutorial video.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Playwright mock harness with `page.route()` interception** | Every tutorial needs deterministic UI behavior without live backends | HIGH | ~16 tutorials x multiple API endpoints each = large fixture corpus. Must mock auth, agent API, Google APIs, AtlusAI, polling/async workflows. Register routes before `page.goto()`. |
| **Per-step screenshot capture** | Screenshots are the visual atoms of every tutorial video | LOW | `page.screenshot({ path })` at each workflow step. Playwright 1.58.2 already installed in project. |
| **Remotion `<Sequence>` composition per tutorial step** | Each tutorial step needs its screenshot + narration + timing aligned in the timeline | MEDIUM | One `<Sequence>` per step. Duration derived from narration audio length. `<Audio>` component syncs narration to visual. |
| **Remotion `<Audio>` narration sync** | Narration must play in time with the visual it describes | MEDIUM | Place `<Audio src={narrationClip}>` inside each `<Sequence>`. Generate narration per-step (not one giant file) for precise alignment. |
| **TTS script-to-audio generation (Kokoro for drafts)** | Need audio narration from written scripts without manual recording | MEDIUM | Python dependency: `kokoro-onnx`. 82M params, ~128MB ONNX model. Runs on CPU on M1. ~3s to generate 5s of audio. 54 English voices. |
| **Final MP4 render via Remotion CLI** | Must produce distributable video files | LOW | `npx remotion render` outputs MP4. FFmpeg auto-downloaded to node_modules on first run. |
| **Tutorial script authoring format** | Scripts drive TTS, timing, and visual sequencing -- need a structured format | MEDIUM | JSON or YAML per tutorial: array of steps, each with `narration` text, `action` description, `mockRoute` references, and `screenshotId`. This is the single source of truth for the entire pipeline. |
| **Mock fixture data for all 16+ workflows** | Tutorials show realistic data (deals, templates, slides, briefings, chat) | HIGH | Must create fixture JSON for: deal CRUD, pipeline views, Touch 1-4 HITL stages, template ingestion, slide library, deck structures, agent prompts, AtlusAI discovery, Drive integration, pre-call briefing. Biggest single effort in the milestone. |
| **Auth state mocking (Google OAuth bypass)** | Every tutorial starts from a logged-in state | LOW | Mock Supabase auth cookies/session. Playwright can set cookies before navigation. |
| **HITL workflow stage mocking** | Touch workflows have 3 HITL stages with suspend/resume -- must mock progression | MEDIUM | Mock the agent API endpoints that return stage status. Pre-author skeleton, low-fi, and high-fi stage responses for each touch type. |

### Differentiators (Competitive Advantage)

Features that elevate tutorial quality beyond basic screen recordings.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Chatterbox-Turbo production narration** | Natural, expressive voice with paralinguistic tags (`[laugh]`, `(excited)`) -- sounds human, not robotic | MEDIUM | 350M params, MIT license. ONNX version on HuggingFace. Sub-200ms inference on GPU. Needs MPS/Metal on M1 Pro. Beats ElevenLabs in 63.8% of blind tests. Significant quality jump over Kokoro. |
| **Remotion `<TransitionSeries>` between steps** | Professional cross-fades, slides, and wipes between tutorial steps instead of hard cuts | LOW | Built-in Remotion component. Transition duration overlaps sequences. Small duration budget impact. |
| **Zoom/pan effects on UI regions** | Draw attention to specific buttons, fields, or panels being discussed | MEDIUM | Remotion supports CSS transforms and `interpolate()` for smooth zoom animations. Define zoom target as `{x, y, width, height}` per step in the script format. |
| **Text overlays and callout annotations** | Label UI elements, show keyboard shortcuts, display step numbers | LOW | Standard React components rendered in Remotion composition. Position absolutely over screenshot. |
| **Cursor animation showing click targets** | Visual indicator of where the user would click, making tutorials easier to follow | MEDIUM | Render animated cursor SVG moving to click coordinates. Playwright can capture element bounding boxes for coordinates during capture. |
| **Two-pass TTS workflow (Kokoro draft, Chatterbox final)** | Iterate on script timing cheaply with Kokoro CPU, then produce polished audio with Chatterbox GPU only for locked scripts | LOW | Architectural pattern, not a feature to build separately. Kokoro generates draft audio in seconds for timing validation. Chatterbox runs only once per final script. |
| **Deterministic fixture seeding from real app data** | Fixtures mirror actual app state shapes exactly, reducing maintenance drift | MEDIUM | Export Zod schemas from `packages/schemas` to generate fixture type stubs. Validate fixtures against schemas at build time. |
| **Chapter markers / table of contents** | Allow viewers to jump to specific steps within longer tutorials | LOW | Remotion metadata or simple overlay at video start listing timestamps. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Live backend recording (real API calls)** | "More authentic" | Non-deterministic. Requires full infra running. AI responses vary per run. Google API rate limits. Flaky recordings. | Mock everything via `page.route()`. Fixtures produce identical results every time. |
| **Full-motion video capture (Playwright video mode)** | "Just record the whole browser" | Produces huge files, variable frame rates, no control over timing/pacing. Cannot add narration sync, overlays, or transitions. Hard to edit after capture. | Screenshot-per-step + Remotion composition. Full control over every frame. |
| **Cloud TTS (ElevenLabs, Google Cloud TTS)** | "Better voice quality" | Per-character costs add up across 16+ tutorials with iteration cycles. Requires API keys and internet. Chatterbox-Turbo beats ElevenLabs in blind tests (63.8%). | Local Chatterbox-Turbo. Free, offline, MIT licensed, comparable or better quality. |
| **Real-time voice cloning for narration** | "Use a specific person's voice" | Ethical concerns. Voice consent requirements. Quality inconsistent with short reference clips. Adds complexity without clear user value for tutorials. | Use one of Kokoro's 54 built-in voices or Chatterbox's default voice. Consistent, professional. |
| **AI-generated tutorial scripts** | "Let AI write the narration" | Scripts need domain expertise about AtlusDeck workflows. AI hallucinations in step descriptions would produce wrong tutorials. QA burden increases significantly. | Human-authored scripts. Each script is ~1 page of step descriptions. 16 scripts is manageable work. |
| **Automated screenshot diffing for regression** | "Detect when UI changes break tutorials" | Pixel-perfect comparison is brittle (font rendering, timing). False positives waste time. | Run Playwright capture suite manually when UI changes. Review visually. Update fixtures as needed. |
| **Background music / sound effects** | "More engaging" | Competes with narration audio. Accessibility concern. Professional tutorial videos rarely use background music. | Clean narration only. Add subtle transition sounds at most. |
| **Webcam overlay / talking head** | "More personal" | Adds recording complexity, requires consistent lighting/setup, face occludes UI content. Not standard for SaaS product tutorials. | Professional narration voice is sufficient. Keep focus on the UI. |

## Feature Dependencies

```
[Tutorial Script Format]
    |-- drives --> [TTS Audio Generation (Kokoro/Chatterbox)]
    |-- drives --> [Playwright Step Definitions]
    |                   |
    |                   |-- requires --> [Mock Fixture Data]
    |                   |-- requires --> [Auth State Mocking]
    |                   |-- requires --> [HITL Stage Mocking]
    |                   |
    |                   |-- produces --> [Per-Step Screenshots]
    |
    |-- drives --> [Remotion Composition]
                        |-- requires --> [Per-Step Screenshots]
                        |-- requires --> [TTS Audio Files (.wav)]
                        |-- optional --> [Zoom/Pan Definitions]
                        |-- optional --> [Text Overlay Definitions]
                        |-- optional --> [Cursor Animation Data]
                        |
                        |-- produces --> [Final MP4]

[Mock Fixture Data]
    |-- requires --> [Understanding of all API response shapes]
    |-- benefits from --> [Zod schemas from packages/schemas]

[Chatterbox-Turbo] -- enhances --> [TTS Audio Generation]
    (replaces Kokoro draft audio with production-quality narration)
```

### Dependency Notes

- **Tutorial Script Format is the root dependency.** Everything flows from scripts. Scripts define what steps to capture, what to narrate, and how to compose. Must be designed first.
- **Mock Fixture Data is the biggest bottleneck.** 16+ tutorials touching deals, templates, slides, touches, briefings, chat, settings, integrations. Each endpoint needs realistic fixture JSON. This is where most implementation time goes.
- **Playwright capture requires mock fixtures.** Cannot capture steps without mocked API responses returning appropriate data for each screen.
- **Remotion composition requires both screenshots and audio.** These can be produced in parallel (Playwright captures + TTS generation) but both must exist before composition begins.
- **Zoom/pan/overlays are additive, not blocking.** Can produce basic tutorials first, then enhance with visual effects in a second pass without re-recording.
- **Chatterbox-Turbo is a drop-in replacement for Kokoro.** Same input (text), same output (.wav). Can swap at any time without changing the composition pipeline.

## MVP Definition

### Launch With (v1)

Minimum to produce one complete tutorial video end-to-end, then scale to all 16.

- [ ] **Structured tutorial script format** (JSON/YAML) -- defines steps, narration text, actions, mock route references
- [ ] **Playwright mock harness** -- shared `page.route()` interception layer with fixture loading helpers
- [ ] **Auth bypass** -- mocked Google OAuth/Supabase session for all tutorials
- [ ] **Mock fixtures for 2-3 pilot tutorials** -- start with "Getting Started" and "Creating & Managing Deals"
- [ ] **Per-step screenshot capture** -- Playwright automation that walks through mocked workflows, captures each step
- [ ] **Kokoro TTS integration** -- Python script that reads narration text from tutorial scripts, outputs .wav per step
- [ ] **Remotion composition scaffold** -- `<Sequence>` per step with screenshot + audio, basic cut transitions
- [ ] **MP4 render pipeline** -- `npx remotion render` producing final output files
- [ ] **One complete tutorial** ("Getting Started") as proof-of-concept of the full pipeline

### Add After Validation (v1.x)

Features to add once the first tutorial proves the pipeline works end-to-end.

- [ ] **Remaining 15+ tutorial fixture sets** -- expand mock data for all workflows (especially Touch 1-4 HITL)
- [ ] **Chatterbox-Turbo production narration** -- replace Kokoro draft audio with polished Chatterbox output for final videos
- [ ] **Zoom/pan effects** -- highlight specific UI regions during narration
- [ ] **Text overlays and callouts** -- label buttons, fields, show step numbers
- [ ] **Cursor animation** -- visual click indicators showing where user would interact
- [ ] **`<TransitionSeries>` polish** -- smooth cross-fades and slides between tutorial steps
- [ ] **Chapter markers** -- navigable sections for longer tutorial videos

### Future Consideration (v2+)

- [ ] **Automated re-recording on UI changes** -- CI integration that detects UI drift and flags stale tutorials
- [ ] **Multi-language narration** -- Kokoro supports French, Japanese, Korean, Mandarin (Chatterbox is English-only currently)
- [ ] **Tutorial versioning** -- maintain tutorial versions per app version for changelog-style updates
- [ ] **Interactive tutorials** -- web-based walkthrough using the same script definitions (not video, in-app)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Tutorial script format | HIGH | MEDIUM | P1 |
| Playwright mock harness | HIGH | HIGH | P1 |
| Auth/session mocking | HIGH | LOW | P1 |
| Mock fixture corpus (all 16 tutorials) | HIGH | HIGH | P1 |
| HITL stage mocking | HIGH | MEDIUM | P1 |
| Per-step screenshot capture | HIGH | LOW | P1 |
| Kokoro TTS draft narration | HIGH | MEDIUM | P1 |
| Remotion sequence composition | HIGH | MEDIUM | P1 |
| MP4 render pipeline | HIGH | LOW | P1 |
| Chatterbox-Turbo final narration | MEDIUM | MEDIUM | P2 |
| Zoom/pan effects | MEDIUM | MEDIUM | P2 |
| Text overlays/callouts | MEDIUM | LOW | P2 |
| Cursor animation | MEDIUM | MEDIUM | P2 |
| TransitionSeries polish | LOW | LOW | P2 |
| Chapter markers | LOW | LOW | P3 |
| Automated UI drift detection | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have -- required to produce any tutorial video
- P2: Should have -- elevates quality from "functional" to "professional"
- P3: Nice to have -- future enhancement

## Existing App Features Requiring Tutorial Coverage

Each feature below needs its own mock fixture set and tutorial script. Grouped by mocking complexity.

### Low Mock Complexity (few API endpoints, simple state)

| Tutorial | Key Mocks Needed | Est. Fixture Effort |
|----------|-----------------|---------------------|
| Getting Started | Auth session, basic navigation state | Low |
| Google Drive Settings | Drive folder list, access verification | Low |
| Action Center | Integration status checks | Low |

### Medium Mock Complexity (multiple endpoints, some state transitions)

| Tutorial | Key Mocks Needed | Est. Fixture Effort |
|----------|-----------------|---------------------|
| Creating & Managing Deals | Deal CRUD, pipeline list, status transitions, grid/table data | Medium |
| Deal Overview | Deal detail, metrics, activity timeline, collaborators | Medium |
| Deal Chat | Chat messages, transcript upload, note binding, streaming AI responses | Medium |
| Template Library | Template CRUD, Drive access, ingestion progress polling | Medium |
| Slide Library | Slide list with metadata, search results, classification updates | Medium |
| Deck Structures | Structure inference results, confidence scores, streaming chat refinement | Medium |
| Agent Prompts | Agent list, prompt versions, draft/publish state transitions | Medium |
| AtlusAI Integration | MCP auth state, discovery browse/search results, batch ingestion | Medium |
| Pre-Call Briefing | Briefing generation polling, company data, question list | Medium |

### High Mock Complexity (multi-stage HITL, polling, multiple artifacts)

| Tutorial | Key Mocks Needed | Est. Fixture Effort |
|----------|-----------------|---------------------|
| Touch 1: First-Contact Pager | 3-stage HITL (skeleton/low-fi/high-fi), route strategy, slide selection, approval, Drive save | High |
| Touch 2: Intro Deck | Strategy resolution, slide selection/ordering, assembly polling, Drive save | High |
| Touch 3: Capability Deck | Capability selection, structure-driven assembly, HITL approval, Drive save | High |
| Touch 4: Transcript-to-Proposal | 6-phase pipeline: extraction, field review, brief gen, brief approval, retrieval/assembly, asset review. 3 output artifacts (proposal, talk track, FAQ). Polling at multiple stages. | Very High |
| Asset Review & Approval | Generated artifacts, brand compliance state, approve/reject flow | High |

## Sources

- [Remotion Sequence docs](https://www.remotion.dev/docs/sequence)
- [Remotion TransitionSeries docs](https://www.remotion.dev/docs/transitions/transitionseries)
- [Remotion Audio docs](https://www.remotion.dev/docs/using-audio)
- [Remotion Overlay docs](https://www.remotion.dev/docs/overlay)
- [Remotion CLI render](https://www.remotion.dev/docs/cli/render)
- [Remotion encoding guide](https://www.remotion.dev/docs/encoding)
- [Remotion order of audio operations](https://www.remotion.dev/docs/audio/order-of-operations)
- [Playwright Mock APIs](https://playwright.dev/docs/mock)
- [Playwright Screenshots](https://playwright.dev/docs/screenshots)
- [Kokoro-82M ONNX on HuggingFace](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)
- [Kokoro ONNX GitHub](https://github.com/thewh1teagle/kokoro-onnx)
- [Chatterbox-Turbo (Resemble AI)](https://www.resemble.ai/chatterbox-turbo/)
- [Chatterbox-Turbo ONNX on HuggingFace](https://huggingface.co/ResembleAI/chatterbox-turbo-ONNX)
- [Chatterbox GitHub](https://github.com/resemble-ai/chatterbox)
- [2Slides + Remotion narration best practices](https://2slides.com/blog/slides-narration-video-best-practices)

---
*Feature research for: Automated tutorial video production pipeline (v1.9)*
*Researched: 2026-03-18*
