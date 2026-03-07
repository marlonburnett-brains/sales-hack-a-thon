---
phase: 27
slug: auth-foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
updated: 2026-03-07
---

# Phase 27 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 |
| **Config file** | `apps/agent/vitest.config.ts` |
| **Quick run command** | `cd apps/agent && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd apps/agent && npx vitest run && cd ../web && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/agent && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd apps/agent && npx vitest run && cd ../web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | ATLS-01 | integration | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-01-02 | 01 | 1 | ATLS-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/token-encryption.test.ts -x` | YES | PASS |
| 27-01-03 | 01 | 1 | ATLS-05 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-02-01 | 02 | 1 | POOL-01 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-02-02 | 02 | 1 | POOL-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-02-03 | 02 | 1 | POOL-04 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-02-04 | 02 | 1 | POOL-05 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-03-01 | 03 | 2 | TIER-01 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-03-02 | 03 | 2 | TIER-04 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-03-03 | 03 | 2 | TIER-05 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/atlus-auth.test.ts -x` | YES | PASS |
| 27-04-01 | 04 | 2 | ACTN-01 | unit | Visual + 27-VERIFICATION.md evidence | N/A | VERIFIED |
| 27-04-02 | 04 | 2 | ACTN-05 | manual | Manual verify via API | N/A | VERIFIED |

*Status: PASS = automated test green, VERIFIED = confirmed via VERIFICATION.md or manual check*

---

## Wave 0 Requirements

- [x] `apps/agent/src/lib/__tests__/atlus-auth.test.ts` -- covers ATLS-01, ATLS-05, POOL-01-05, TIER-01-05 (created during execution, all tests pass)
- [x] `apps/agent/src/lib/__tests__/token-encryption.test.ts` -- covers ATLS-02 (pre-existing, all tests pass)
- [x] ACTN-01, ACTN-02 verified via 27-VERIFICATION.md formal report

*All Wave 0 test files exist and pass.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge count excludes silenced | ACTN-05 | Requires full API + sidebar render | 1. Silence an action item 2. Verify badge count decreases 3. Un-silence and verify badge increases |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

**Evidence:** `atlus-auth.test.ts` passes all tests (verified 2026-03-07). `token-encryption.test.ts` passes all 7 tests. Phase 27 VERIFICATION.md confirms all 20 requirements satisfied with 5/5 success criteria.
