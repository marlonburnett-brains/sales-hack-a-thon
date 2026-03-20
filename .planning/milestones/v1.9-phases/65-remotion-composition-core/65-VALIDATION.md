---
phase: 65
slug: remotion-composition-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 65 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual validation + TypeScript compilation checks |
| **Config file** | apps/tutorials/tsconfig.json |
| **Quick run command** | `pnpm --filter tutorials tsc --noEmit` |
| **Full suite command** | `pnpm --filter tutorials render getting-started` |
| **Estimated runtime** | ~15 seconds (tsc), ~60 seconds (render) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter tutorials tsc --noEmit`
- **After every plan wave:** Run `pnpm --filter tutorials render getting-started`
- **Before `/gsd:verify-work`:** Full render must produce valid MP4
- **Max feedback latency:** 15 seconds (tsc check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 65-01-01 | 01 | 1 | COMP-01 | smoke | `pnpm --filter tutorials tsc --noEmit` | ❌ W0 | ⬜ pending |
| 65-01-02 | 01 | 1 | COMP-02 | smoke | `pnpm --filter tutorials tsc --noEmit` | ❌ W0 | ⬜ pending |
| 65-01-03 | 01 | 1 | COMP-03 | smoke | `pnpm --filter tutorials render getting-started --concurrency 2` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/tutorials/src/remotion/index.ts` — Remotion entry point with registerRoot
- [ ] `apps/tutorials/src/remotion/Root.tsx` — Composition registration
- [ ] `apps/tutorials/src/remotion/TutorialComposition.tsx` — Step-to-Sequence mapping
- [ ] `apps/tutorials/src/remotion/TutorialStep.tsx` — Shared step component
- [ ] `apps/tutorials/scripts/render.ts` — Render CLI
- [ ] `apps/tutorials/remotion.config.ts` — Remotion configuration
- [ ] Remotion dependencies installed in tutorials package.json

*Existing infrastructure covers TypeScript compilation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Screenshot displays full-frame at 1080p | COMP-01 | Visual quality requires human inspection | Render tutorial, open MP4, verify screenshots fill frame edge-to-edge |
| Audio sync with correct step | COMP-01 | Temporal synchronization requires human ear | Play rendered MP4, verify narration matches displayed screenshot |
| Missing audio fallback (3s silence) | COMP-02 | Edge case requiring manual file manipulation | Remove one audio file, render, verify step shows for 3s with silence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
