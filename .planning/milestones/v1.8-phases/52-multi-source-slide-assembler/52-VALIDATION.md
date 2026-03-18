---
phase: 52
slug: multi-source-slide-assembler
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `apps/agent/vitest.config.ts` |
| **Quick run command** | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -x` |
| **Full suite command** | `cd apps/agent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -x`
- **After every plan wave:** Run `cd apps/agent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 52-01-01 | 01 | 0 | FR-4.1–FR-4.9, NFR-6 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -x` | ❌ W0 | ⬜ pending |
| 52-01-02 | 01 | 1 | FR-4.1 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "groups slides" -x` | ❌ W0 | ⬜ pending |
| 52-01-03 | 01 | 1 | FR-4.2 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "primary source" -x` | ❌ W0 | ⬜ pending |
| 52-01-04 | 01 | 1 | FR-4.3 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "prune" -x` | ❌ W0 | ⬜ pending |
| 52-01-05 | 01 | 1 | FR-4.4 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "secondary" -x` | ❌ W0 | ⬜ pending |
| 52-01-06 | 01 | 1 | FR-4.5 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "reorder" -x` | ❌ W0 | ⬜ pending |
| 52-01-07 | 01 | 1 | FR-4.6, NFR-6 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "cleanup" -x` | ❌ W0 | ⬜ pending |
| 52-01-08 | 01 | 1 | FR-4.7 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "share" -x` | ❌ W0 | ⬜ pending |
| 52-01-09 | 01 | 1 | FR-4.8 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "single-source" -x` | ❌ W0 | ⬜ pending |
| 52-01-10 | 01 | 1 | FR-4.9 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/multi-source-assembler.test.ts -t "deal folder" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/generation/__tests__/multi-source-assembler.test.ts` — stubs for FR-4.1 through FR-4.9, NFR-6
- [ ] Mock factories for Google Slides/Drive API clients (vi.mock pattern for `google-auth.ts`)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rate limit compliance | NFR-3 | Cannot reliably simulate real API rate limits in unit tests | Count API calls in test output; verify < 60 writes/min for typical deck sizes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
