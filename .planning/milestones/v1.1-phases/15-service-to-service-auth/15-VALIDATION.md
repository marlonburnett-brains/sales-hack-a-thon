---
phase: 15
slug: service-to-service-auth
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-05
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual curl testing (no test framework configured) |
| **Config file** | none |
| **Quick run command** | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4111/companies` |
| **Full suite command** | Run all 5 curl scenarios below |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick curl command (expect 401 without key)
- **After every plan wave:** Run full 5-scenario curl suite
- **Before `/gsd:verify-work`:** Full suite must pass
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | AUTH-06 | manual | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4111/companies` (expect 401) | N/A | ⬜ pending |
| 15-01-02 | 01 | 1 | AUTH-06 | manual | `curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: wrong-key" http://localhost:4111/companies` (expect 401) | N/A | ⬜ pending |
| 15-01-03 | 01 | 1 | AUTH-06 | manual | `curl -s http://localhost:4111/health` (expect `{"status":"ok"}`) | N/A | ⬜ pending |
| 15-01-04 | 01 | 1 | AUTH-07 | manual | Start both apps, trigger workflow from UI, verify success | N/A | ⬜ pending |
| 15-01-05 | 01 | 1 | AUTH-07 | manual | Upload Touch 1 override file, verify success | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Manual curl testing is the established pattern — no test framework to set up.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reject requests without API key | AUTH-06 | No test framework; curl is explicit in success criteria | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4111/companies` → 401 |
| Reject requests with wrong API key | AUTH-06 | No test framework; curl is explicit in success criteria | `curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: wrong" http://localhost:4111/companies` → 401 |
| Health check is public | AUTH-06 | No test framework | `curl -s http://localhost:4111/health` → `{"status":"ok"}` |
| Web app sends API key via fetchJSON | AUTH-07 | Requires running web + agent apps together | Start both apps, trigger any workflow from UI, verify success |
| Web app sends API key via uploadTouch1Override | AUTH-07 | Requires running web + agent apps together | Upload a Touch 1 override file, verify success |

---

## Validation Sign-Off

- [x] All tasks have manual verify commands or Wave 0 dependencies
- [x] Sampling continuity: curl testing after every task commit
- [x] Wave 0 covers all MISSING references (none — manual testing)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
