---
phase: 69
slug: medium-complexity-tutorials-library-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 69 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (capture specs as functional tests) |
| **Config file** | `apps/tutorials/playwright.config.ts` |
| **Quick run command** | `pnpm --filter tutorials capture <tutorial-name>` |
| **Full suite command** | `pnpm --filter tutorials capture template-library && pnpm --filter tutorials capture slide-library && pnpm --filter tutorials capture deck-structures && pnpm --filter tutorials capture agent-prompts && pnpm --filter tutorials capture atlus-integration` |
| **Estimated runtime** | ~120 seconds (5 tutorials × ~24s each) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter tutorials capture <tutorial-name>` for the tutorial being authored
- **After every plan wave:** Run full suite command for all 5 tutorials
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 69-01-01 | 01 | 1 | TUT-08 | smoke | `pnpm --filter tutorials capture template-library` | ❌ W0 | ⬜ pending |
| 69-01-02 | 01 | 1 | TUT-09 | smoke | `pnpm --filter tutorials capture slide-library` | ❌ W0 | ⬜ pending |
| 69-01-03 | 01 | 1 | TUT-10 | smoke | `pnpm --filter tutorials capture deck-structures` | ❌ W0 | ⬜ pending |
| 69-01-04 | 01 | 1 | TUT-11 | smoke | `pnpm --filter tutorials capture agent-prompts` | ❌ W0 | ⬜ pending |
| 69-01-05 | 01 | 1 | TUT-12 | smoke | `pnpm --filter tutorials capture atlus-integration` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `fixtures/shared/templates.json` — shared content library base (3-5 templates)
- [ ] `fixtures/shared/slides.json` — shared slide data for ingested templates
- [ ] `capture/template-library.spec.ts` — covers TUT-08
- [ ] `capture/slide-library.spec.ts` — covers TUT-09
- [ ] `capture/deck-structures.spec.ts` — covers TUT-10
- [ ] `capture/agent-prompts.spec.ts` — covers TUT-11
- [ ] `capture/atlus-integration.spec.ts` — covers TUT-12
- [ ] `fixtures/template-library/script.json` — tutorial script
- [ ] `fixtures/slide-library/script.json` — tutorial script
- [ ] `fixtures/deck-structures/script.json` — tutorial script
- [ ] `fixtures/agent-prompts/script.json` — tutorial script
- [ ] `fixtures/atlus-integration/script.json` — tutorial script
- [ ] All stage fixture directories and files per tutorial
- [ ] Mock server: 9 routes made stage-aware

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Narration tone consistency | TUT-08–12 | Subjective quality | Listen to generated audio; verify conversational tone matches Phase 67/68 |
| Visual effect placement | TUT-08–12 | Design judgment | Review rendered MP4; verify zoom/callout/cursor placement is appropriate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
