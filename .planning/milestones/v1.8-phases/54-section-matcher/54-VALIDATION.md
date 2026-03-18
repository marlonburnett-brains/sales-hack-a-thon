---
phase: 54
slug: section-matcher
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `apps/agent/vitest.config.ts` |
| **Quick run command** | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts` |
| **Full suite command** | `cd apps/agent && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts`
- **After every plan wave:** Run `cd apps/agent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 0 | FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5, FR-3.6 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/generation/__tests__/section-matcher.test.ts` — test stubs for FR-3.1 through FR-3.6
- Framework install: Not needed — Vitest already configured

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
