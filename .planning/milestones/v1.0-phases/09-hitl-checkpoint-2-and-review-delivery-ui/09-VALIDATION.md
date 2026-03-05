---
phase: 9
slug: hitl-checkpoint-2-and-review-delivery-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + TypeScript type checking |
| **Config file** | `tsconfig.json` (monorepo root) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | Manual smoke test per success criteria |
| **Estimated runtime** | ~15 seconds (type check) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Manual smoke test: trigger full Touch 4 workflow, verify HITL-2 suspend, approve assets, verify delivered state
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | REVW-01 | type check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | REVW-02 | type check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | REVW-03 | unit-testable | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | REVW-01 | type check + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-02-02 | 02 | 2 | REVW-02 | type check + manual | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/lib/brand-compliance.ts` — pure function, unit-testable (brand checks on SlideJSON)
- [ ] No formal test framework installed (hackathon project — type checking is the automated gate)

*Existing infrastructure (TypeScript compiler) covers all phase requirements for type safety.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Review panel shows all 3 artifacts with iframe previews | REVW-01 | UI rendering requires browser | Trigger Touch 4, wait for assets, open standalone review page, verify 3 artifact cards with working iframe previews |
| Direct Drive links open correct documents | REVW-02 | Requires live Google Drive artifacts | Click each Drive link in review panel, verify correct document opens |
| HITL-2 suspends workflow until approval | REVW-01 | Requires running Mastra workflow | Trigger Touch 4, verify workflow pauses at HITL-2, approve, verify delivery completes |
| Brand compliance warnings display correctly | REVW-03 | Requires generated SlideJSON with intentional issues | Generate deck, verify compliance section shows pass/warn with descriptions |
| Workflow stepper shows correct stage | REVW-01 | UI state rendering | Navigate through each workflow stage, verify stepper highlights correct step |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
