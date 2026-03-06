---
phase: 26
slug: tech-debt-cleanup
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
validated: 2026-03-06
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `grep -c "httpOnly.*false" apps/web/src/middleware.ts apps/web/src/app/auth/callback/route.ts` |
| **Full suite command** | `cd apps/agent && npx vitest run && cd ../web && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `grep -c "httpOnly.*false" apps/web/src/middleware.ts apps/web/src/app/auth/callback/route.ts`
- **After every plan wave:** Run `cd apps/agent && npx vitest run && cd ../web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | httpOnly fix | grep/static | `grep -c "httpOnly.*false" apps/web/src/middleware.ts apps/web/src/app/auth/callback/route.ts` | N/A | ✅ green |
| 26-01-02 | 01 | 1 | SUMMARY frontmatter | grep/static | `grep -c "requirements_completed" .planning/phases/2[2-5]-*/*SUMMARY.md` | N/A | ✅ green |
| 26-01-03 | 01 | 1 | VALIDATION.md audit | manual | Verify files exist for phases 23, 24 | N/A | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The httpOnly fix is a 1-line change per location verifiable by static grep. Documentation changes (SUMMARY frontmatter, VALIDATION.md audit) are non-code.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VALIDATION.md files exist for phases 23, 24 | Nyquist compliance | File existence check | `ls .planning/phases/23-*/*-VALIDATION.md .planning/phases/24-*/*-VALIDATION.md` |
| SUMMARY frontmatter correct REQ-IDs | Documentation accuracy | Semantic correctness | Compare REQ-IDs in SUMMARY vs REQUIREMENTS.md traceability table |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated

---

## Validation Audit 2026-03-06

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
