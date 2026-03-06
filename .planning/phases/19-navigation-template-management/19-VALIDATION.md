---
phase: 19
slug: navigation-template-management
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react + jsdom |
| **Config file** | apps/web/vitest.config.ts |
| **Quick run command** | `cd apps/web && npx vitest run` |
| **Full suite command** | `cd apps/web && npx vitest run` |
| **Estimated runtime** | ~4 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run`
- **After every plan wave:** Run `cd apps/web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 4 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | TMPL-05 | unit | `cd apps/web && npx vitest run src/lib/__tests__/template-utils.test.ts` | yes | green |
| 19-01-02 | 01 | 1 | TMPL-06 | unit | `cd apps/web && npx vitest run src/lib/__tests__/template-actions.test.ts` | yes | green |
| 19-01-03 | 01 | 1 | TMPL-07 | unit | `cd apps/web && npx vitest run src/lib/__tests__/template-utils.test.ts` | yes | green |
| 19-02-01 | 02 | 1 | NAV-01 | component | `cd apps/web && npx vitest run src/components/__tests__/sidebar.test.tsx` | yes | green |
| 19-02-02 | 02 | 1 | NAV-02 | component | `cd apps/web && npx vitest run src/components/__tests__/sidebar.test.tsx` | yes | green |
| 19-03-01 | 03 | 2 | TMPL-01 | component | `cd apps/web && npx vitest run src/components/__tests__/template-form.test.tsx` | yes | green |
| 19-03-02 | 03 | 2 | TMPL-02 | component | `cd apps/web && npx vitest run src/components/__tests__/template-card.test.tsx src/components/__tests__/template-table.test.tsx src/components/__tests__/template-status-badge.test.tsx` | yes | green |
| 19-03-03 | 03 | 2 | TMPL-03 | component | `cd apps/web && npx vitest run src/components/__tests__/template-card.test.tsx src/components/__tests__/template-table.test.tsx` | yes | green |
| 19-03-04 | 03 | 2 | TMPL-04 | component | `cd apps/web && npx vitest run src/components/__tests__/template-form.test.tsx` | yes | green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `apps/web/vitest.config.ts` — Vitest + React plugin + jsdom configuration
- [x] `apps/web/src/__test-utils__/setup.ts` — jest-dom matchers + cleanup
- [x] `apps/web/src/__test-utils__/next-mocks.ts` — Shared Next.js mock helpers
- [x] `apps/web/src/lib/__tests__/template-utils.test.ts` — 22 unit tests for TMPL-05 and TMPL-07
- [x] `apps/web/src/lib/__tests__/template-actions.test.ts` — 5 unit tests for TMPL-06
- [x] `apps/web/src/components/__tests__/sidebar.test.tsx` — 14 component tests for NAV-01, NAV-02
- [x] `apps/web/src/components/__tests__/template-form.test.tsx` — 7 component tests for TMPL-01, TMPL-04
- [x] `apps/web/src/components/__tests__/template-card.test.tsx` — 9 component tests for TMPL-02, TMPL-03
- [x] `apps/web/src/components/__tests__/template-table.test.tsx` — 5 component tests for TMPL-02, TMPL-03
- [x] `apps/web/src/components/__tests__/template-status-badge.test.tsx` — 7 component tests for TMPL-02
- [x] `apps/web/src/components/__tests__/template-filters.test.tsx` — 5 component tests

*RTL + jsdom + @vitejs/plugin-react installed as devDependencies in apps/web.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Audit 2026-03-06

| Metric | Count |
|--------|-------|
| Gaps found | 9 |
| Resolved (round 1) | 2 |
| Escalated (round 1) | 7 |
| Resolved (round 2) | 7 |
| **Total resolved** | **9** |

**Round 1:** TMPL-05, TMPL-07 — 22 unit tests via Nyquist auditor agent.
**Round 2:** NAV-01, NAV-02, TMPL-01–04, TMPL-06 — 52 component/unit tests via RTL + jsdom infrastructure setup.
**Total: 74 tests, all green.**

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 4s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-06
