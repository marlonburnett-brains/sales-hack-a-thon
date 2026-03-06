---
phase: 23
slug: user-delegated-api-clients-token-passthrough
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
---

# Phase 23 -- Validation Strategy

> Per-phase validation contract for user-delegated API clients and token passthrough.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config files** | `apps/agent/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Agent tests** | `cd apps/agent && npx vitest run src/lib/__tests__/{google-auth,token-cache,request-auth}.test.ts` |
| **Web tests** | `cd apps/web && npx vitest run src/lib/__tests__/{api-client-google-auth,google-token}.test.ts` |
| **Full suite** | `cd apps/agent && npx vitest run && cd ../web && npx vitest run` |
| **Estimated runtime** | ~3 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | GAPI-01 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | yes | green |
| 23-01-02 | 01 | 1 | GAPI-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | yes | green |
| 23-01-03 | 01 | 1 | GAPI-03 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts` | yes | green |
| 23-01-04 | 01 | 1 | GAPI-04 | compile | `npx tsc --noEmit -p apps/agent/tsconfig.json` | n/a | green |
| 23-01-05 | 01 | 1 | PASS-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/request-auth.test.ts` | yes | green |
| 23-01-06 | 01 | 1 | token-cache | unit | `cd apps/agent && npx vitest run src/lib/__tests__/token-cache.test.ts` | yes | green |
| 23-02-01 | 02 | 2 | PASS-01 | unit | `cd apps/web && npx vitest run src/lib/__tests__/api-client-google-auth.test.ts` | yes | green |
| 23-02-02 | 02 | 2 | PASS-03 | unit | `cd apps/web && npx vitest run src/lib/__tests__/google-token.test.ts` | yes | green |
| 23-02-03 | 02 | 2 | PASS-04 | unit | `cd apps/web && npx vitest run src/lib/__tests__/api-client-google-auth.test.ts` | yes | green |

*Status: pending / green / red / flaky*

---

## Test Coverage Summary

### Agent-side (26 tests, 3 files)

| File | Tests | Coverage |
|------|-------|----------|
| `google-auth.test.ts` | 15 | Dual-mode factories (service account + OAuth2Client), pooled auth, token rotation |
| `token-cache.test.ts` | 6 | Cache hit/miss, refresh from DB, null handling, revocation, concurrent dedup |
| `request-auth.test.ts` | 5 | Priority chain: accessToken > userId refresh > service account fallback |

### Web-side (18 tests, 2 files)

| File | Tests | Coverage |
|------|-------|----------|
| `api-client-google-auth.test.ts` | 14 | fetchWithGoogleAuth header injection, Google-triggering functions use correct wrapper, CRUD functions don't send Google headers |
| `google-token.test.ts` | 4 | Supabase session extraction: provider_token + userId, null handling |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Token refresh flow with live Google OAuth | GAPI-02/PASS-02 | Requires live OAuth session and token expiration | Log in with Google, wait for provider_token to expire, trigger template operation |
| CORS preflight for custom headers | PASS-02 | Requires browser CORS preflight behavior | From browser, trigger template create, inspect network tab for OPTIONS preflight |
| Service account fallback when not logged in | GAPI-03 | Requires testing unauthenticated Google OAuth state | Access template operations without Google OAuth login |

---

## Validation Audit 2026-03-06

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 3s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-06
