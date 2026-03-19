# Requirements: AtlusDeck Tutorial Videos

**Defined:** 2026-03-18
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours — not 24 to 120 hours.

## v1.9 Requirements

Requirements for the tutorial video production pipeline. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: Developer can scaffold `apps/tutorials` as a Turborepo workspace with Remotion 4.0.x, Playwright, and kokoro-js dependencies isolated from web/agent apps
- [x] **INFRA-02**: Developer can define tutorial scripts in a structured JSON format specifying steps, narration text, actions, mock route references, and zoom targets
- [x] **INFRA-03**: Developer can run a mock agent server that intercepts all server-side API calls (Server Actions, agent routes) with fixture responses during Playwright capture
- [x] **INFRA-04**: Developer can use shared `page.route()` helpers to mock all browser-side API calls with fixture JSON
- [x] **INFRA-05**: Developer can bypass Google OAuth/Supabase auth by setting mocked session cookies before navigation
- [x] **INFRA-06**: Developer can create and validate fixture data using factory functions with Zod schema validation against real API response shapes
- [x] **INFRA-07**: Developer can run `pnpm --filter tutorials capture <tutorial-name>` to execute a single tutorial's Playwright capture

### Capture

- [x] **CAPT-01**: Playwright captures a per-step screenshot at each workflow point defined in the tutorial script
- [x] **CAPT-02**: Playwright disables CSS animations and waits for network idle before each screenshot for deterministic output
- [x] **CAPT-03**: Playwright can mock HITL workflow stages (Skeleton → Low-fi → High-fi) with pre-authored stage responses for each touch type
- [x] **CAPT-04**: Playwright can mock polling/async workflows (generation progress, ingestion status) with pre-sequenced status updates

### TTS Audio

- [x] **TTS-01**: Developer can generate draft narration .wav files per tutorial step using kokoro-js on CPU with no Python dependency
- [x] **TTS-02**: Developer can generate production narration .wav files per tutorial step using Chatterbox-Turbo on M1 MPS/GPU via Python sidecar
- [x] **TTS-03**: Pipeline generates a timing manifest from audio file durations that feeds Remotion composition frame counts
- [x] **TTS-04**: Developer can switch between draft (Kokoro) and production (Chatterbox) TTS with a single `--engine` flag

### Video Composition

- [x] **COMP-01**: Each tutorial step renders as a Remotion `<Sequence>` with its screenshot and narration audio synchronized
- [x] **COMP-02**: Shared `TutorialStep` component encapsulates screenshot display, audio playback, and timing logic
- [ ] **COMP-03**: Developer can render a final MP4 per tutorial via Remotion CLI with `--concurrency=2` for M1 Pro memory safety
- [ ] **COMP-04**: Zoom/pan effects highlight specific UI regions defined in the tutorial script via CSS transforms and `interpolate()`
- [ ] **COMP-05**: Text overlays and callout annotations label UI elements, show step numbers, and display keyboard shortcuts
- [ ] **COMP-06**: Animated cursor moves to click targets at each step, showing where the user would interact
- [ ] **COMP-07**: `<TransitionSeries>` provides smooth cross-fades between tutorial steps instead of hard cuts
- [ ] **COMP-08**: Intro and outro slates with tutorial title, AtlusDeck branding, and navigation context bookend each video

### Tutorial Content — Low Complexity

- [ ] **TUT-01**: "Getting Started" tutorial — sign in, initial setup, navigating the UI
- [ ] **TUT-02**: "Google Drive Settings" tutorial — select root folder, verify access
- [ ] **TUT-03**: "Action Center" tutorial — resolve integration issues (OAuth, sharing, access)

### Tutorial Content — Medium Complexity

- [ ] **TUT-04**: "Creating & Managing Deals" tutorial — create deal, assign team, status lifecycle, grid/table views, filtering
- [ ] **TUT-05**: "Deal Overview" tutorial — metrics cards, activity timeline, collaborator management
- [ ] **TUT-06**: "Deal Chat" tutorial — context-aware questions, transcript upload, saving notes, binding notes to touches
- [ ] **TUT-07**: "Pre-Call Briefing" tutorial — generate company research, value hypotheses, discovery questions, view history
- [ ] **TUT-08**: "Template Library" tutorial — register templates from Drive, classify by touch type, trigger ingestion, monitor progress
- [ ] **TUT-09**: "Slide Library" tutorial — browse slides, view details/metadata, search by content, update classifications
- [ ] **TUT-10**: "Deck Structures" tutorial — view inferred structures, confidence scores, section flow, chat-based refinement
- [ ] **TUT-11**: "Agent Prompts" tutorial — view/edit prompts, publish drafts, rollback versions, baseline prompt management
- [ ] **TUT-12**: "AtlusAI Integration" tutorial — connect account, browse/search discovery content, ingest assets

### Tutorial Content — High Complexity

- [ ] **TUT-13**: "Touch 1: First-Contact Pager" tutorial — 3-stage HITL, review/approve/refine at each gate, manual upload override
- [ ] **TUT-14**: "Touch 2: Intro Deck" tutorial — strategy resolution, slide selection, ordering, final Google Slides assembly
- [ ] **TUT-15**: "Touch 3: Capability Deck" tutorial — capability area selection, structure-driven assembly, approval flow
- [ ] **TUT-16**: "Touch 4: Transcript-to-Proposal" tutorial — full 6-phase pipeline with 3 output artifacts (proposal, talk track, FAQ)
- [ ] **TUT-17**: "Asset Review & Approval" tutorial — review generated artifacts, brand compliance checks, approve/reject workflows

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Automation & CI

- **AUTO-01**: CI integration detects UI drift and flags stale tutorials for re-recording
- **AUTO-02**: Tutorial versioning maintains tutorial versions per app version

### Localization

- **LOC-01**: Multi-language narration using Kokoro's French, Japanese, Korean, Mandarin support

### Interactive

- **INTER-01**: Web-based interactive walkthroughs using the same script definitions (in-app, not video)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live backend recording | Non-deterministic, requires full infra, AI responses vary per run |
| Full-motion video capture (Playwright video mode) | Huge files, no control over timing/pacing, can't add overlays |
| Cloud TTS (ElevenLabs, Google Cloud TTS) | Per-character costs, requires API keys; Chatterbox beats ElevenLabs in blind tests |
| Real-time voice cloning | Ethical concerns, quality issues with short reference clips |
| AI-generated tutorial scripts | Domain expertise needed, hallucination risk in step descriptions |
| Automated screenshot diffing | Brittle pixel-perfect comparison, high false positive rate |
| Background music / sound effects | Competes with narration, accessibility concern |
| Webcam overlay / talking head | Recording complexity, face occludes UI content |
| Chapter markers | Low value relative to effort; defer to v2+ |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 62 | Complete |
| INFRA-02 | Phase 62 | Complete |
| INFRA-03 | Phase 62 | Complete |
| INFRA-04 | Phase 62 | Complete |
| INFRA-05 | Phase 62 | Complete |
| INFRA-06 | Phase 62 | Complete |
| INFRA-07 | Phase 62 | Complete |
| CAPT-01 | Phase 62 | Complete |
| CAPT-02 | Phase 62 | Complete |
| CAPT-03 | Phase 63 | Complete |
| CAPT-04 | Phase 63 | Complete |
| TTS-01 | Phase 64 | Complete |
| TTS-02 | Phase 64 | Complete |
| TTS-03 | Phase 64 | Complete |
| TTS-04 | Phase 64 | Complete |
| COMP-01 | Phase 65 | Complete |
| COMP-02 | Phase 65 | Complete |
| COMP-03 | Phase 65 | Pending |
| COMP-04 | Phase 66 | Pending |
| COMP-05 | Phase 66 | Pending |
| COMP-06 | Phase 66 | Pending |
| COMP-07 | Phase 66 | Pending |
| COMP-08 | Phase 66 | Pending |
| TUT-01 | Phase 67 | Pending |
| TUT-02 | Phase 67 | Pending |
| TUT-03 | Phase 67 | Pending |
| TUT-04 | Phase 68 | Pending |
| TUT-05 | Phase 68 | Pending |
| TUT-06 | Phase 68 | Pending |
| TUT-07 | Phase 68 | Pending |
| TUT-08 | Phase 69 | Pending |
| TUT-09 | Phase 69 | Pending |
| TUT-10 | Phase 69 | Pending |
| TUT-11 | Phase 69 | Pending |
| TUT-12 | Phase 69 | Pending |
| TUT-13 | Phase 70 | Pending |
| TUT-14 | Phase 70 | Pending |
| TUT-15 | Phase 70 | Pending |
| TUT-16 | Phase 70 | Pending |
| TUT-17 | Phase 70 | Pending |

**Coverage:**
- v1.9 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after roadmap creation*
