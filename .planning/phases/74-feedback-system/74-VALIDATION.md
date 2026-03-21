---
phase: 74
slug: feedback-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 74 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npx vitest run src/components/feedback` |
| **Full suite command** | `cd apps/web && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run src/components/feedback`
- **After every plan wave:** Run `cd apps/web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 74-01-01 | 01 | 0 | FEED-01 | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 74-02-01 | 02 | 1 | FEED-01 | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 74-02-02 | 02 | 1 | FEED-01 | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | ❌ W0 | ⬜ pending |
| 74-02-03 | 02 | 1 | FEED-02 | manual | N/A — server component integration | N/A | ⬜ pending |
| 74-03-01 | 03 | 2 | FEED-04 | manual | Code review — verify JSDoc on sourceType/sourceId props | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/components/feedback/FeedbackWidget.test.tsx` — stubs for FEED-01 (7 unit cases)
- [ ] Optional: `apps/web/src/lib/actions/__tests__/feedback-actions.test.ts` — action smoke test

*Existing test infrastructure (vitest.config.ts, RTL) is already installed — only the new test file is missing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FeedbackWidget renders on tutorial slug page | FEED-02 | Server component integration; no unit-testable boundary | Load `/tutorials/[slug]` in browser, verify widget appears below video |
| Navigating between tutorials resets widget | FEED-02 | Requires real navigation between routes | Play tutorial A → submit feedback → navigate to tutorial B → verify form is reset |
| JSDoc on FeedbackWidgetProps | FEED-04 | Code review only | Open `FeedbackWidget.tsx`, verify `sourceType` and `sourceId` props have JSDoc comments |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
