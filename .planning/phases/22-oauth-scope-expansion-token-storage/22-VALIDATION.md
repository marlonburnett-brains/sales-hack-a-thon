---
phase: 22
slug: oauth-scope-expansion-token-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed in both apps) |
| **Config file** | `apps/agent/vitest.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/agent && npx vitest run src/lib/__tests__/token-encryption.test.ts` |
| **Full suite command** | `cd apps/agent && npx vitest run && cd ../web && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/agent && npx vitest run src/lib/__tests__/token-encryption.test.ts`
- **After every plan wave:** Run `cd apps/agent && npx vitest run && cd ../web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | TOKS-02 | unit | `cd apps/agent && npx vitest run src/lib/__tests__/token-encryption.test.ts -x` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | TOKS-03 | unit (static) | `grep -r "from.*sodium\|from.*noble" apps/agent/src/lib/token-encryption.ts` | N/A | ⬜ pending |
| 22-01-03 | 01 | 1 | TOKS-05 | unit (schema) | `grep -c "lastUsedAt\|isValid\|revokedAt" apps/agent/prisma/schema.prisma` | N/A | ⬜ pending |
| 22-02-01 | 02 | 2 | OAUTH-01 | manual | Requires browser interaction with Google OAuth | N/A | ⬜ pending |
| 22-02-02 | 02 | 2 | OAUTH-02 | manual | Requires browser interaction | N/A | ⬜ pending |
| 22-02-03 | 02 | 2 | OAUTH-04 | manual | Requires real Google OAuth flow | N/A | ⬜ pending |
| 22-02-04 | 02 | 2 | TOKS-01 | integration | manual — requires DB | N/A | ⬜ pending |
| 22-02-05 | 02 | 2 | TOKS-04 | integration | manual — requires both services running | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/agent/src/lib/__tests__/token-encryption.test.ts` — stubs for TOKS-02, TOKS-03 (encrypt/decrypt roundtrip, key validation)

*No integration test framework for multi-service flows — manual verification required for OAUTH-01 through OAUTH-04, TOKS-04.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| signInWithOAuth includes Drive/Slides/Docs scopes | OAUTH-01 | Requires browser interaction with Google OAuth consent screen | 1. Navigate to login page 2. Click sign in 3. Verify Google consent screen shows Drive, Slides, Docs scopes |
| Login includes access_type: offline | OAUTH-02 | Requires browser interaction with Google OAuth | 1. Sign in 2. Verify consent screen mentions offline access |
| Callback captures provider_refresh_token | OAUTH-04 | Requires real Google OAuth flow | 1. Complete OAuth flow 2. Check callback logs for provider_refresh_token presence |
| Callback stores token via agent API | TOKS-04 | Requires both web and agent services running | 1. Complete OAuth flow 2. Check agent DB for UserGoogleToken record |
| UserGoogleToken model upserts correctly | TOKS-01 | Requires database | 1. Store token for user 2. Re-auth same user 3. Verify single record updated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
