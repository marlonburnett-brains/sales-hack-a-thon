---
phase: 67
slug: low-complexity-tutorials
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 67 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (capture specs as functional tests) |
| **Config file** | `apps/tutorials/playwright.config.ts` |
| **Quick run command** | `pnpm --filter tutorials capture <tutorial-name>` |
| **Full suite command** | `pnpm --filter tutorials capture getting-started && pnpm --filter tutorials capture google-drive-settings && pnpm --filter tutorials capture action-center` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter tutorials capture <tutorial-name>` for the tutorial being authored
- **After every plan wave:** Run full suite command for all three tutorials
- **Before `/gsd:verify-work`:** Full suite must be green, all three MP4s rendered
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 67-01-01 | 01 | 1 | TUT-01 | smoke | `pnpm --filter tutorials capture getting-started` | ✅ | ⬜ pending |
| 67-01-02 | 01 | 1 | TUT-02 | smoke | `pnpm --filter tutorials capture google-drive-settings` | ❌ W0 | ⬜ pending |
| 67-01-03 | 01 | 1 | TUT-03 | smoke | `pnpm --filter tutorials capture action-center` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `capture/google-drive-settings.spec.ts` — capture spec for TUT-02
- [ ] `capture/action-center.spec.ts` — capture spec for TUT-03
- [ ] `fixtures/google-drive-settings/script.json` — tutorial script
- [ ] `fixtures/google-drive-settings/overrides.json` — unconfigured Drive state
- [ ] `fixtures/action-center/script.json` — tutorial script
- [ ] `fixtures/action-center/overrides.json` — error state action items
- [ ] `fixtures/action-center/stages/errors.json` — before-resolution state
- [ ] `fixtures/action-center/stages/resolved.json` — after-resolution state
- [ ] Mock server routes: `user-settings`, stage-aware `actions` + `actions/count`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MP4 visual quality check | TUT-01, TUT-02, TUT-03 | Subjective quality assessment | Watch rendered MP4, verify narration matches screenshots, transitions smooth |
| DriveFolderPicker state transition | TUT-02 | Google iframe cannot be mocked | Verify narration explains click-to-configured transition naturally |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
