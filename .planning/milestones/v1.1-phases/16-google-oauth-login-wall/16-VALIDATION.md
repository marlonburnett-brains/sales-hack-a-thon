---
phase: 16
slug: google-oauth-login-wall
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-05
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework installed in project |
| **Config file** | None |
| **Quick run command** | Manual smoke test: visit app unauthenticated, verify redirect |
| **Full suite command** | Manual walkthrough of all 5 success criteria |
| **Estimated runtime** | ~3 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual smoke test — visit app unauthenticated, verify redirect to login
- **After every plan wave:** Full manual walkthrough of all 5 success criteria
- **Before `/gsd:verify-work`:** All 5 success criteria verified manually
- **Max feedback latency:** ~60 seconds (manual verification)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | AUTH-03 | manual | Visit unauthenticated, verify redirect | N/A | ⬜ pending |
| 16-01-02 | 01 | 1 | AUTH-01 | manual | Sign in with @lumenalta.com account | N/A | ⬜ pending |
| 16-01-03 | 01 | 1 | AUTH-02 | manual | Sign in with non-@lumenalta.com, verify error | N/A | ⬜ pending |
| 16-01-04 | 01 | 1 | AUTH-04 | manual | Sign in, refresh browser, verify session | N/A | ⬜ pending |
| 16-01-05 | 01 | 1 | AUTH-05 | manual | Click sign out, verify redirect to login | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — all validation is manual for this phase.*

**Justification:** All AUTH requirements involve real OAuth flows with Google, browser cookie state, and Supabase Auth server interaction. Unit testing these flows would require extensive mocking of Supabase Auth, Next.js middleware, and cookie handling. Integration/E2E testing (Playwright/Cypress) would be valuable but is out of scope for this phase and not in the current test infrastructure.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth sign-in for @lumenalta.com | AUTH-01 | Requires real Google OAuth flow and Supabase Auth server | 1. Click "Sign in with Google" 2. Select @lumenalta.com account 3. Verify landing on home page |
| Reject non-@lumenalta.com with error | AUTH-02 | Requires real Google OAuth flow with non-domain account | 1. Click "Sign in with Google" 2. Select personal Gmail 3. Verify error message displayed |
| Redirect unauthenticated to login | AUTH-03 | Requires browser + Next.js middleware running | 1. Clear cookies 2. Visit any app route 3. Verify redirect to login page |
| Session persists across refresh | AUTH-04 | Requires browser session with real cookies | 1. Sign in successfully 2. Refresh page 3. Open new tab to app 4. Verify still authenticated |
| Sign out redirects to login | AUTH-05 | Requires authenticated session with real cookies | 1. Sign in 2. Click "Sign out" 3. Verify redirect to login page 4. Verify app routes no longer accessible |

---

## Validation Sign-Off

- [x] All tasks have manual verification instructions
- [x] Sampling continuity: manual smoke after every commit
- [x] Wave 0 not needed — all manual verification
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
