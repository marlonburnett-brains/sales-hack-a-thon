---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Tutorial Videos
status: completed
stopped_at: Completed 64-03-PLAN.md
last_updated: "2026-03-19T12:24:15.291Z"
last_activity: "2026-03-19 -- Phase 64 Plan 03 complete: TTS orchestrator CLI with engine switching and timing manifests"
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 8
  completed_plans: 8
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.
**Current focus:** v1.9 Tutorial Videos -- Phase 64: TTS Pipeline (Plan 01 complete)

## Current Position

Phase: 64 (3 of 9 in v1.9) (TTS Pipeline)
Plan: 3 of 3 in current phase (PHASE COMPLETE)
Status: Phase 64 complete -- TTS pipeline with Kokoro/Chatterbox engines and orchestrator CLI
Last activity: 2026-03-19 -- Phase 64 Plan 03 complete: TTS orchestrator CLI with engine switching and timing manifests

Progress: [██████████] 100% (v1.9)

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

### Pending Todos

None.

### Blockers/Concerns

- Chatterbox-Turbo MPS stability on M1 Pro 16GB -- community-documented, not officially supported (validate Phase 64)
- Content library access: 14/17 Drive shortcut targets need Viewer access (not code-blocking)
- Prisma version constraint: Stay on 6.19.x -- Prisma 7.x has vector migration regression (#28867)
- 4 deferred gap-closure phases (58-61) carry forward as Active requirements

## Session Continuity

Last session: 2026-03-19T12:24:15.288Z
Stopped at: Completed 64-03-PLAN.md
Next action: Begin Phase 65 (Remotion composition)
