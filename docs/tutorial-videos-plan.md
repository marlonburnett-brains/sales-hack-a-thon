# AtlusDeck Tutorial Videos — Plan Summary

## Business Goal

AtlusDeck needs tutorial videos that walk users through every feature and workflow available in the platform. These videos must use faithful UI reproductions and realistic (mocked) data so that users can follow along and reproduce the same workflows with their own access. The tutorials will be narrated in English.

## Fully Mocked Environment

**All tutorial videos run entirely on mocked data. No database, no external integrations, no live API calls.**

- **API responses**: All backend/agent API calls intercepted via Playwright's `page.route()` returning fixture JSON
- **AI/Agent interactions**: All AI-generated content (briefings, deck generation, chat responses, transcript extraction) is pre-scripted mock data — no LLM calls
- **Google Drive/Slides**: All Drive operations mocked — file creation, folder browsing, slide assembly return pre-built fixture responses
- **AtlusAI/Discovery**: All AtlusAI search/browse results are fixtures
- **Authentication**: OAuth flow mocked to simulate logged-in state
- **HITL stages**: Each stage (skeleton → low-fi → high-fi) returns pre-authored mock content that looks like real AI output
- **Polling/async workflows**: Generation log polling returns pre-sequenced status updates and completion responses

This ensures tutorials are reproducible, deterministic, and require zero infrastructure to record.

## Selected Approach

**Hybrid: Playwright + Remotion + Local TTS**

1. **Playwright** drives the real Next.js app with mocked API responses (`page.route()` interception), capturing screenshots and short video clips at each workflow step. This guarantees the UI shown is 100% faithful — it's the actual app running in a real browser.

2. **Remotion** composes the final videos — stitching Playwright captures with narration audio, adding text overlays, zoom effects, transitions, and callouts. Each tutorial step becomes a `<Sequence>` with its corresponding audio and visuals.

3. **Local TTS models** generate the narration audio from written scripts, keeping the pipeline fully offline and cost-free.

### Pipeline

```
Narration scripts (.txt)  →  Kokoro / Chatterbox-Turbo  →  .wav files
Playwright workflows       →  screenshots / clips
                                                          →  Remotion  →  final .mp4
.wav narration ─────────────────────────────────────────┘
```

## Local TTS Model Selection

| Model | Role | Params | License | Why |
|-------|------|--------|---------|-----|
| **Kokoro-82M** | Rapid prototyping & script iteration | 82M | Apache 2.0 | Runs on CPU, generates ~5s audio in ~3s. Lets us iterate on script timing and pacing before committing to final production audio. 54 English voices included. |
| **Chatterbox-Turbo** | Final production narration | 350M | MIT | Sub-200ms inference on GPU, emotion/paralinguistic tags (`[laugh]`, `(excited)`), single-step diffusion. Preferred over ElevenLabs in 63.8% of blind tests. Produces polished, natural narration for the published tutorials. |

**Workflow:** Draft scripts with Kokoro for fast feedback loops, then generate final narration with Chatterbox-Turbo once scripts are locked.

## Hardware

**MacBook M1 Pro, 16GB RAM**

- Kokoro (82M params, ~128MB ONNX) runs comfortably on CPU — no GPU needed for drafting.
- Chatterbox-Turbo (350M params) will leverage Metal/MPS acceleration on the M1 Pro GPU. 16GB unified memory is sufficient for inference.
- Remotion rendering is CPU/memory intensive but within M1 Pro capability for tutorial-length videos.

## Installation Requirements

The following need to be added to the project:

- **Remotion** — React-based programmatic video framework (`remotion`, `@remotion/cli`, `@remotion/bundler`)
- **remotion-skills** — if using pre-built transitions/effects (evaluate if needed)
- **Kokoro TTS** — Python package + ONNX model (~128MB). Install via `pip install kokoro-onnx` or clone `hexgrad/Kokoro-82M`
- **Chatterbox-Turbo** — Python package from Resemble AI. Install via `pip install chatterbox-tts` or clone `resemble-ai/chatterbox`
- **Playwright** — already likely available; ensure `@playwright/test` is installed with browser binaries

## Tutorials Needed

Tutorials must be planned for all features currently available in AtlusDeck. Each tutorial uses fully mocked data and interactions as described above.

### Core Workflows
- [ ] **Getting Started** — Sign in (Google OAuth), initial setup, navigating the UI
- [ ] **Creating & Managing Deals** — Create a deal, assign team, change status, use grid/table views, filter by status/assignee

### Deal Workspace
- [ ] **Deal Overview** — Metrics cards, activity timeline, collaborator management
- [ ] **Deal Chat** — Asking context-aware questions, uploading transcripts, saving notes, binding notes to touches

### Pre-Call & Briefing
- [ ] **Pre-Call Briefing** — Generate company research, value hypotheses, discovery questions; view briefing history

### Touch Workflows (HITL Multi-Stage)
- [ ] **Touch 1: First-Contact Pager** — Skeleton → Low-Fi → High-Fi stages, review/approve/refine at each gate, manual upload override
- [ ] **Touch 2: Intro Deck** — Strategy resolution, slide selection, ordering, final Google Slides assembly
- [ ] **Touch 3: Capability Deck** — Capability area selection, structure-driven assembly, approval flow
- [ ] **Touch 4: Transcript-to-Proposal** — Full 6-phase pipeline: transcript extraction → field review → brief generation → brief approval → retrieval & assembly → asset review. Three output artifacts (proposal deck, talk track, buyer FAQ)

### Template & Slide Management
- [ ] **Template Library** — Register templates from Google Drive, classify by touch type, trigger ingestion, monitor progress
- [ ] **Slide Library** — Browse slides, view details/metadata, search by content, update classifications

### Deck Intelligence
- [ ] **Deck Structures** — View inferred structures, confidence scores, section flow; chat-based refinement

### Agent Configuration
- [ ] **Agent Prompts** — View/edit agent prompts, publish drafts, rollback versions, baseline prompt management

### Integrations & Settings
- [ ] **AtlusAI Integration** — Connect account, browse/search discovery content, ingest assets
- [ ] **Google Drive Settings** — Select root folder, verify access
- [ ] **Action Center** — Resolve integration issues (OAuth, sharing, access)

### Asset Review
- [ ] **Asset Review & Approval** — Review generated artifacts, brand compliance checks, approve/reject workflows
