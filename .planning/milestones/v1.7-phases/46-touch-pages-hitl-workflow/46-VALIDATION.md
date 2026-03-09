---
phase: 46
slug: touch-pages-hitl-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing project setup) |
| **Config file** | `apps/web/vitest.config.ts` / `apps/agent/vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 46-01-01 | 01 | 1 | TOUCH-01 | smoke | `npx vitest run apps/web/src/app/**/touch/**/*.test.tsx -x` | ❌ W0 | ⬜ pending |
| 46-01-02 | 01 | 1 | TOUCH-06 | unit | `npx vitest run apps/web/src/components/touch/__tests__/hitl-stage-stepper.test.tsx -x` | ❌ W0 | ⬜ pending |
| 46-01-03 | 01 | 1 | TOUCH-07 | unit | `npx vitest run apps/web/src/components/touch/__tests__/touch-context-provider.test.tsx -x` | ❌ W0 | ⬜ pending |
| 46-02-01 | 02 | 2 | TOUCH-02 | integration | `npx vitest run apps/agent/src/mastra/__tests__/touch-1-stages.test.ts -x` | ❌ W0 | ⬜ pending |
| 46-02-02 | 02 | 2 | TOUCH-03 | integration | `npx vitest run apps/agent/src/mastra/__tests__/touch-2-stages.test.ts -x` | ❌ W0 | ⬜ pending |
| 46-02-03 | 02 | 2 | TOUCH-04 | integration | `npx vitest run apps/agent/src/mastra/__tests__/touch-3-stages.test.ts -x` | ❌ W0 | ⬜ pending |
| 46-03-01 | 03 | 2 | TOUCH-05 | unit | `npx vitest run apps/web/src/components/touch/__tests__/touch-4-artifact-tabs.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/touch/__tests__/hitl-stage-stepper.test.tsx` — stubs for TOUCH-06
- [ ] `apps/web/src/components/touch/__tests__/touch-context-provider.test.tsx` — stubs for TOUCH-07
- [ ] `apps/agent/src/mastra/__tests__/touch-1-stages.test.ts` — stubs for TOUCH-02
- [ ] `apps/agent/src/mastra/__tests__/touch-2-stages.test.ts` — stubs for TOUCH-03
- [ ] `apps/agent/src/mastra/__tests__/touch-3-stages.test.ts` — stubs for TOUCH-04
- [ ] `apps/web/src/app/**/touch/**/*.test.tsx` — stubs for TOUCH-01
- [ ] `apps/web/src/components/touch/__tests__/touch-4-artifact-tabs.test.tsx` — stubs for TOUCH-05

*Existing infrastructure covers framework installation — Vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual stage stepper appearance | TOUCH-06 | CSS/visual layout | Verify 3 stages render with correct labels, active state highlights |
| Chat bar receives touch context | TOUCH-07 | Cross-phase integration with Phase 45 | Open touch page, verify chat bar shows touch-specific context |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
