---
phase: 56
slug: hitl-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing in apps/agent) |
| **Config file** | apps/agent/vitest.config.ts |
| **Quick run command** | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts` |
| **Full suite command** | `cd apps/agent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts`
- **After every plan wave:** Run `cd apps/agent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 56-01-01 | 01 | 0 | FR-7.1-FR-7.7 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts` | ❌ W0 | ⬜ pending |
| 56-01-02 | 01 | 1 | FR-7.1 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "skeleton suspend"` | ❌ W0 | ⬜ pending |
| 56-01-03 | 01 | 1 | FR-7.2 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "skeleton resume"` | ❌ W0 | ⬜ pending |
| 56-01-04 | 01 | 1 | FR-7.3 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "lowfi suspend"` | ❌ W0 | ⬜ pending |
| 56-01-05 | 01 | 1 | FR-7.4 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "lowfi changes"` | ❌ W0 | ⬜ pending |
| 56-01-06 | 01 | 1 | FR-7.5 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "highfi suspend"` | ❌ W0 | ⬜ pending |
| 56-01-07 | 01 | 1 | FR-7.6 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "highfi execute"` | ❌ W0 | ⬜ pending |
| 56-01-08 | 01 | 1 | FR-7.7 | unit | `cd apps/agent && npx vitest run src/generation/__tests__/structure-driven-workflow.test.ts -t "mastra pattern"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/generation/__tests__/structure-driven-workflow.test.ts` — stubs for FR-7.1 through FR-7.7
- [ ] Test mocks for `resolveBlueprint`, `selectSlidesForBlueprint`, `assembleMultiSourceDeck`, `planSlideModifications`, `executeModifications`

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual blueprint rendering in frontend | FR-7.1 | UI layout/thumbnail display | Start workflow via API, verify skeleton stage renders sections with thumbnails in browser |
| Deck URL opens in Google Slides | FR-7.3 | External service | Open driveUrl from lowfi suspend payload, verify slides are present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
