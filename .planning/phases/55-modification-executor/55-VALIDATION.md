---
phase: 55
slug: modification-executor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | apps/agent/vitest.config.ts (verify exists, or add inline) |
| **Quick run command** | `npx vitest run apps/agent/src/generation/modification-executor.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run apps/agent/src/generation/modification-executor.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 0 | FR-6.1, FR-6.2, FR-6.3, FR-6.4, NFR-7, NFR-8 | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts` | No — W0 | ⬜ pending |
| 55-01-02 | 01 | 1 | FR-6.1 | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "builds request pairs"` | No — W0 | ⬜ pending |
| 55-01-03 | 01 | 1 | FR-6.2, NFR-7 | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "scoped to element"` | No — W0 | ⬜ pending |
| 55-01-04 | 01 | 1 | FR-6.3, NFR-8 | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "re-reads presentation"` | No — W0 | ⬜ pending |
| 55-01-05 | 01 | 1 | FR-6.4 | unit | `npx vitest run apps/agent/src/generation/modification-executor.test.ts -t "skips failed slides"` | No — W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/generation/modification-executor.test.ts` — stubs for FR-6.1 through FR-6.4, NFR-7, NFR-8
- [ ] Verify `vitest.config.ts` exists at agent root, or add inline config
- [ ] Mock for `getSlidesClient()` — mock `presentations.get` and `presentations.batchUpdate` responses

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual formatting after modification | NFR-7 | Formatting preservation requires visual inspection of Google Slides | Open modified presentation, verify text displays correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
