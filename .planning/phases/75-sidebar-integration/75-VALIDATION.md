---
phase: 75
slug: sidebar-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 75 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx` |
| **Full suite command** | `pnpm --filter web test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx`
- **After every plan wave:** Run `pnpm --filter web test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 75-01-01 | 01 | 1 | BROWSE-01 | unit | `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx` | ✅ extend existing | ⬜ pending |
| 75-01-02 | 01 | 1 | BROWSE-01 | unit | `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx` | ✅ extend existing | ⬜ pending |
| 75-01-03 | 01 | 1 | BROWSE-01 | unit | `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx` | ✅ extend existing | ⬜ pending |
| 75-01-04 | 01 | 1 | BROWSE-01 | unit | `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx` | ✅ extend existing | ⬜ pending |
| 75-01-05 | 01 | 1 | BROWSE-01 | unit | `pnpm --filter web test --run src/components/__tests__/sidebar.test.tsx` | ✅ extend existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/mastra/__tests__/tutorial-unwatched-count-route.test.ts` — stubs for BROWSE-01 agent count endpoint (optional but consistent with Phase 72/73 agent test pattern)

*Existing `sidebar.test.tsx` infrastructure covers sidebar tests — must be updated (not replaced) to handle dual fetch calls (actions/count + tutorials/unwatched-count).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge disappears after watching all tutorials | BROWSE-01 | Requires real DB state change | Watch all tutorials in dev, verify badge disappears on next page load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
