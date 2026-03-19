---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Tutorial Videos
status: executing
stopped_at: Completed 66-01-PLAN.md
last_updated: "2026-03-19T15:35:22Z"
last_activity: "2026-03-19 -- Phase 66 Plan 01 complete: Deterministic effect schema and reusable Remotion polish primitives"
progress:
  total_phases: 9
  completed_phases: 4
  total_plans: 12
  completed_plans: 11
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.
**Current focus:** v1.9 Tutorial Videos -- Phase 66: Visual Effects & Polish (in progress)

## Current Position

Phase: 66 (5 of 9 in v1.9) (Visual Effects & Polish)
Plan: 1 of 2 in current phase
Status: Phase 66 in progress -- reusable effect primitives complete, composition wiring pending in 66-02
Last activity: 2026-03-19 -- Phase 66 Plan 01 complete: Deterministic effect schema and reusable Remotion polish primitives

Progress: [█████████░] 92% (11/12 planned tutorial-video plans on disk)

## Performance Metrics

**Velocity:**
- Total plans completed: 135 (v1.0: 27, v1.1: 6, v1.2: 10, v1.3: 10, v1.4: 12, v1.5: 8, v1.6: 20, v1.7: 30, v1.8: 12)
- Quick tasks: 31 total (13 pre-v1.8, 19 during v1.8)
- Total project time: ~11 days (2026-03-03 -> 2026-03-13)
- Total LOC: ~74,111 TypeScript/TSX/Prisma

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.
Recent decisions for v1.9:
- Playwright + Remotion + local TTS over live recording or cloud TTS
- Mock agent server required (page.route() cannot intercept Server Actions)
- Dual TTS: Kokoro (draft/CPU) + Chatterbox-Turbo (production/MPS)
- apps/tutorials workspace isolated from web/agent
- [Phase 62]: Fixture validation schemas mirror api-client.ts response shapes (independent of Prisma)
- [Phase 62]: Mock server covers all 40+ api-client.ts routes upfront for any future tutorial
- [Phase 62]: Auth bypass injects both localStorage + SSR cookies to satisfy both middleware auth paths
- [Phase 62]: Generic capture loop iterates script.steps JSON -- not hardcoded to any specific tutorial
- [Phase 62]: 3-digit zero-padded screenshot naming (step-001.png) for alphabetical sort up to 999 steps
- [Phase 62]: MOCK_AUTH=true bypasses all Supabase auth in Edge Runtime middleware -- Edge Runtime cannot HTTP to localhost
- [Phase 62]: capture.ts manages both mock server AND Next.js dev server lifecycle with spawn (not execSync)
- [Phase 62]: Dedicated port 3099 for tutorial captures avoids conflicts with dev server on 3000
- [Phase 63]: Stage ref pattern: mutable variable in capture loop shared via closure with browser mocks
- [Phase 63]: Sequences managed server-side only; browser mocks derive status from stageGetter closure
- [Phase 63]: Playwright outputDir separated from screenshot output to prevent cross-tutorial cleanup
- [Phase 63]: Catch-all API route registered first in mockBrowserAPIs for correct Playwright reverse-order priority
- [Phase 63]: Idle stage returns empty interactions array to avoid false fallback UI triggers
- [Phase 64]: Python sidecar pattern -- TypeScript spawns venv Python with CLI args, captures stderr for errors
- [Phase 64]: Chatterbox CPU-first loading -- model loaded to CPU then components moved to MPS individually
- [Phase 64]: q8 ONNX quantization for Kokoro model (quality vs download size balance)
- [Phase 64]: af_heart voice preset for warm female narrator brand consistency
- [Phase 64]: Two-pass ffmpeg loudnorm for accurate -16 LUFS normalization
- [Phase 64]: No external CLI parsing library -- process.argv manual parsing for zero new dependencies
- [Phase 65]: skipLibCheck required for Remotion 4.0.436 type defs (Timer type)
- [Phase 65]: Audio from @remotion/media, layout=none on Sequences, 3s fallback for missing audio
- [Phase 65]: Exported renderTutorial function from render.ts for reuse by render-all.ts
- [Phase 65]: Sequential batch rendering per Remotion documentation recommendation
- [Phase 66]: Effect coordinates use normalized 0-1 values for zoom, callout, and cursor targeting
- [Phase 66]: Intro and outro slates use text-based AtlusDeck wordmarks until a brand asset is introduced

### Pending Todos

None.

### Blockers/Concerns

- Chatterbox-Turbo MPS stability on M1 Pro 16GB -- community-documented, not officially supported (validate Phase 64)
- Content library access: 14/17 Drive shortcut targets need Viewer access (not code-blocking)
- Prisma version constraint: Stay on 6.19.x -- Prisma 7.x has vector migration regression (#28867)
- 4 deferred gap-closure phases (58-61) carry forward as Active requirements

## Session Continuity

Last session: 2026-03-19T15:35:22Z
Stopped at: Completed 66-01-PLAN.md
Next action: Execute 66-02 to wire TransitionSeries, integrate effect layers, and render the getting-started pilot.
