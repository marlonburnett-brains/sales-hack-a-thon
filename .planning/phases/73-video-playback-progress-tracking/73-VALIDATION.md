---
phase: 73
slug: video-playback-progress-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 73 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

### Web (component tests)
| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react |
| **Config file** | `apps/web/vitest.config.ts` (jsdom environment) |
| **Quick run command** | `pnpm --filter web test -- --run src/components/tutorials` |
| **Full suite command** | `pnpm --filter web test -- --run` |
| **Estimated runtime** | ~15 seconds |

### Agent (route tests)
| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (node) |
| **Config file** | `apps/agent/vitest.config.ts` |
| **Quick run command** | `pnpm --filter agent test -- --run src/mastra/__tests__/tutorial` |
| **Full suite command** | `pnpm --filter agent test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test -- --run src/components/tutorials && pnpm --filter agent test -- --run src/mastra/__tests__/tutorial`
- **After every plan wave:** Run `pnpm --filter web test -- --run && pnpm --filter agent test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 73-W0-01 | 01 | 0 | PLAY-01, PLAY-03 | unit (RTL) | `pnpm --filter web test -- --run src/components/tutorials/__tests__/tutorial-video-player.test.tsx` | ❌ W0 | ⬜ pending |
| 73-W0-02 | 01 | 0 | TRACK-01, TRACK-04 | unit (agent) | `pnpm --filter agent test -- --run src/mastra/__tests__/tutorial-progress-routes.test.ts` | ❌ W0 | ⬜ pending |
| 73-01-01 | 01 | 1 | PLAY-01 | unit (RTL) | `pnpm --filter web test -- --run src/components/tutorials/__tests__/tutorial-video-player.test.tsx` | ❌ W0 | ⬜ pending |
| 73-01-02 | 01 | 1 | PLAY-03 | unit (RTL) | included in PLAY-01 test file | ❌ W0 | ⬜ pending |
| 73-01-03 | 01 | 1 | PLAY-02 | manual | N/A — SSR not testable in jsdom | — | ⬜ pending |
| 73-02-01 | 02 | 1 | TRACK-01 | unit (agent) | `pnpm --filter agent test -- --run src/mastra/__tests__/tutorial-progress-routes.test.ts` | ❌ W0 | ⬜ pending |
| 73-02-02 | 02 | 1 | TRACK-04 | unit (agent) | included in TRACK-01 test file | ❌ W0 | ⬜ pending |
| 73-02-03 | 02 | 1 | TRACK-02 | unit (RTL) | `pnpm --filter web test -- --run src/components/tutorials/__tests__/tutorials-browse-view.test.tsx` | ✅ | ⬜ pending |
| 73-02-04 | 02 | 1 | TRACK-03 | unit (RTL) | included in browse view test | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/tutorials/__tests__/tutorial-video-player.test.tsx` — stubs for PLAY-01, PLAY-03 (render + auto-seek + watched badge + end-screen + prev/next buttons)
- [ ] `apps/agent/src/mastra/__tests__/tutorial-progress-routes.test.ts` — stubs for TRACK-01, TRACK-04 (PATCH /progress + PATCH /watched upsert behavior, auth guard, 401 on missing user)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Component does not SSR (next/dynamic ssr:false) | PLAY-02 | SSR behavior not testable in jsdom | Deploy to preview, open page with JS disabled — video player should not appear; enable JS and confirm player renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
