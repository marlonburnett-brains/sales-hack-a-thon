---
phase: 25
slug: integration-verification-cutover
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | apps/agent/vitest.config.ts |
| **Quick run command** | `cd apps/agent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd apps/agent && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/agent && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd apps/agent && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | INTG-01 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts -x` | Wave 0 | pending |
| 25-01-02 | 01 | 1 | INTG-01 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/request-auth.test.ts -x` | Wave 0 | pending |
| 25-01-03 | 01 | 1 | INTG-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts -x` | Wave 0 | pending |
| 25-01-04 | 01 | 1 | INTG-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/request-auth.test.ts -x` | Wave 0 | pending |
| 25-01-05 | 01 | 1 | INTG-03 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts -x` | Wave 0 | pending |
| 25-01-06 | 01 | 1 | INTG-03 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/token-cache.test.ts -x` | Wave 0 | pending |
| 25-01-07 | 01 | 1 | INTG-03 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts -x` | Wave 0 | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/lib/__tests__/google-auth.test.ts` — covers INTG-01, INTG-02, INTG-03
- [ ] `apps/agent/src/lib/__tests__/request-auth.test.ts` — covers INTG-01, INTG-02
- [ ] `apps/agent/src/lib/__tests__/token-cache.test.ts` — covers INTG-03

*All test files created as part of Wave 0 task execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| User with Google token accesses org-shared files SA cannot | INTG-02 | Requires real Google Workspace org with shared files | 1. Log in with Google OAuth, 2. Navigate to template that uses org-shared file, 3. Verify file loads successfully |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
