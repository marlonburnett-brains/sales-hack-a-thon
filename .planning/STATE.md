---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Tutorial Videos
status: completed
stopped_at: Completed 69-02-PLAN.md (gap-closure TTS + render for Phase 69)
last_updated: "2026-03-20T01:05:59.428Z"
last_activity: "2026-03-20 -- Phase 70 Plan 02 complete: Touch 4 expanded to 16 steps + Asset Review 17-step capstone tutorial"
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 23
  completed_plans: 22
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.
**Current focus:** v1.9 Tutorial Videos -- Phase 70: High-Complexity Tutorials

## Current Position

Phase: 70 (9 of 9 in v1.9) (High-Complexity Tutorials)
Plan: 2 of 3 in current phase (COMPLETE)
Status: Phase 70 Plan 02 complete -- Touch 4 expanded 16-step + Asset Review 17-step capstone
Last activity: 2026-03-20 -- Phase 70 Plan 02 complete: Touch 4 expanded to 16 steps + Asset Review 17-step capstone tutorial

Progress: [██████████] 95% (22/23 plans completed so far)

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
- [Phase 66]: Render input props merge timing manifests with fixture script metadata by step id before composition selection
- [Phase 66]: Cursor continuity comes only from click or hover steps; informational scenes never show a cursor from coordinates alone
- [Phase 66]: Composition timing uses 90-frame intro, 120-frame outro, and 15-frame fades between every scene boundary
- [Phase 66]: Render input props now merge timing manifests with fixture script metadata by step id before composition selection — Prepared composition inputs keep Remotion rendering deterministic and avoid runtime joins inside the timeline.
- [Phase 66]: Cursor continuity comes only from click or hover steps; informational steps never show a cursor just because coordinates exist — This preserves clean non-interactive scenes while still giving viewers motion guidance where interaction actually happens.
- [Phase 66]: The composition uses 90-frame intro, 120-frame outro, and 15-frame fades between every scene boundary — Shared timing values keep metadata duration math and the visible TransitionSeries rhythm aligned.
- [Phase 66]: enrichDeal helper centralizes company+interactions join logic in mock server
- [Phase 67]: mockStage changed from fixed enum to z.string() for arbitrary stage names beyond HITL
- [Phase 67]: User-settings routes are stage-aware: stage fixtures checked before in-memory store
- [Phase 67]: Google Drive Settings uses stage switching instead of clicking the Drive picker (Google iframe incompatible with mock)
- [Phase 67]: Non-HITL tutorials use custom stage names (unconfigured/configured) with matching stage fixture files
- [Phase 67]: Action Center errors stage set on dashboard (step 1) not /actions page -- SSR requires stage before navigation
- [Phase 67]: Gap-closure plans producing only gitignored artifacts (audio/video) have no source commits per task
- [Phase 68]: Chat GET route made stage-aware via chatBootstrap field in stage fixtures
- [Phase 68]: Browser-side chat GET proxies to mock server (same pattern as actions/count)
- [Phase 68]: All deal fixtures use mock user ID as ownerId so SSR userId filter matches
- [Phase 68]: URL-based view/filter switching (?view=table, ?status=won) instead of clicking UI buttons
- [Phase 68]: All 4 medium-complexity tutorials use deal-001 (Meridian Dynamics) for narrative continuity
- [Phase 68]: Gap-closure plans producing only gitignored artifacts (audio/video) have no source commits per task
- [Phase 70]: Touch 1 refine at lowfi gate, Touch 2 refine at skeleton gate, Touch 3 refine at lowfi gate
- [Phase 70]: Asset-review route extended with stage-aware pattern for Plan 02
- [Phase 69]: Shared content library with 5 templates and 17 slides auto-loaded by fixture loader for all tutorials
- [Phase 69]: 9 mock server routes stage-aware for templates, deck-structures, agent-configs, and discovery domains
- [Phase 69]: Agent prompts 7-stage lifecycle: both agentConfigDetail and agentConfigVersions in each stage fixture for parallel SSR
- [Phase 69]: Deck structure URLs use touch-1 hyphen (Next.js slug) while API uses touch_1 underscore (VALID_SLUGS mapping)
- [Phase 70]: Touch 4 refine demo at lowfi gate -- affects all 3 artifacts simultaneously
- [Phase 70]: Asset Review uses int-touch4-001 for compliance flow, int-touch1-001 for reject/regen flow
- [Phase 70]: Compliance issues structured with brand_color (medium), missing_disclaimer (high), font_inconsistency (low)
- [Phase 70]: Asset Review overrides include all 4 touches' interactions for capstone narrative
- [Phase 69]: No source commits for gap-closure TTS/render plans -- all outputs gitignored

### Pending Todos

None.

### Blockers/Concerns

- Chatterbox-Turbo MPS stability on M1 Pro 16GB -- community-documented, not officially supported (validate Phase 64)
- Content library access: 14/17 Drive shortcut targets need Viewer access (not code-blocking)
- Prisma version constraint: Stay on 6.19.x -- Prisma 7.x has vector migration regression (#28867)
- 4 deferred gap-closure phases (58-61) carry forward as Active requirements

## Session Continuity

Last session: 2026-03-20T01:05:59.425Z
Stopped at: Completed 69-02-PLAN.md (gap-closure TTS + render for Phase 69)
Next action: Execute 70-03-PLAN.md (TTS narration and video rendering for all 5 high-complexity tutorials).
