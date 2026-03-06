# Phase 26: Tech Debt Cleanup -- httpOnly Fix & Documentation - Research

**Researched:** 2026-03-06
**Domain:** Cookie security, documentation hygiene, Nyquist validation
**Confidence:** HIGH

## Summary

Phase 26 closes three categories of tech debt identified by the v1.3 milestone audit: (1) a functional bug where the `google-token-status` cookie is set with `httpOnly: true`, preventing `GoogleTokenBadge` from reading it via `document.cookie`; (2) missing `requirements_completed` frontmatter in 9 SUMMARY.md files across phases 22-25; and (3) VALIDATION.md files for phases 23 and 24 (these already exist and need auditing/updating rather than creation from scratch).

This is a pure cleanup phase -- no new features, no schema changes, no new dependencies. All work items are well-defined with clear fix paths documented in the existing VERIFICATION.md for phase 22.

**Primary recommendation:** Fix the httpOnly cookie bug by adding `httpOnly: false` to all three cookie-setting locations (simplest fix, no architectural changes needed), then populate SUMMARY frontmatter using the REQUIREMENTS.md traceability table, and audit existing VALIDATION.md files for phases 23-24.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fix the `google-token-status` cookie so `GoogleTokenBadge` can read it client-side
- The cookie contains only "valid"/"missing" strings -- no sensitive data
- Two valid approaches: remove `httpOnly` flag from cookie, or pass status as server component prop
- Claude decides the approach -- both are correct
- Populate `requirements_completed` in 9 SUMMARY.md files across phases 22-25:
  - 22-01, 22-02, 22-03 (Phase 22)
  - 23-01, 23-02 (Phase 23)
  - 24-01, 24-02 (Phase 24)
  - 25-01, 25-02 (Phase 25)
- Map REQ-IDs from REQUIREMENTS.md traceability table to the plan that implemented each
- Create VALIDATION.md for Phase 23 (User-Delegated API Clients & Token Passthrough)
- Create VALIDATION.md for Phase 24 (Token Pool & Refresh Lifecycle)
- Follow the validation strategy format used in existing VALIDATION.md files (phases 22 and 25)

### Claude's Discretion
- All three areas: Claude has full flexibility on implementation approach
- httpOnly fix method (remove flag vs server prop)
- VALIDATION.md structure and test strategy details
- Order of operations within the plan

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Architecture Patterns

### Pattern 1: httpOnly Cookie Fix (Recommended Approach)

**What:** Add `httpOnly: false` to all `google-token-status` cookie-setting locations.

**Why this over server component prop:** The cookie approach is already implemented and working everywhere except for the missing `httpOnly: false` flag. Changing to a server component prop would require refactoring the `GoogleTokenBadge` from a client component to receiving props, threading the status through layout/page components, and modifying the component hierarchy. The cookie value contains zero sensitive data ("valid" or "missing" strings only), so there is no security concern.

**Three locations to modify:**

1. `apps/web/src/middleware.ts` line ~104 (token exists branch)
2. `apps/web/src/middleware.ts` line ~111 (token missing branch)
3. `apps/web/src/app/auth/callback/route.ts` line ~42 (post-login)

**Fix pattern:**
```typescript
// BEFORE (httpOnly defaults to true via NextResponse.cookies.set)
supabaseResponse.cookies.set("google-token-status", "valid", {
  maxAge: 3600,
  sameSite: "lax",
  path: "/",
});

// AFTER (explicitly allow client-side reading)
supabaseResponse.cookies.set("google-token-status", "valid", {
  maxAge: 3600,
  sameSite: "lax",
  path: "/",
  httpOnly: false,
});
```

**No changes needed to `GoogleTokenBadge`** -- the component already correctly reads `document.cookie` and handles the "valid"/"missing"/null states.

### Pattern 2: SUMMARY Frontmatter Population

**What:** Add `requirements_completed` array to YAML frontmatter of 9 SUMMARY.md files.

**Mapping from REQUIREMENTS.md traceability table:**

| Plan | REQ-IDs |
|------|---------|
| 22-01 | TOKS-01, TOKS-02, TOKS-03, TOKS-04, TOKS-05 |
| 22-02 | OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04 |
| 22-03 | (UI-only, no direct REQ-IDs -- badge and Connect Google menu) |
| 23-01 | GAPI-01, GAPI-02, GAPI-03, GAPI-04, PASS-02 |
| 23-02 | PASS-01, PASS-03, PASS-04 |
| 24-01 | POOL-01, POOL-02, POOL-03, POOL-04, POOL-05, LIFE-01, LIFE-02, LIFE-03 |
| 24-02 | (UI-only -- Actions page, sidebar badge) |
| 25-01 | INTG-01, INTG-02, INTG-03 |
| 25-02 | (Cutover/documentation -- no direct REQ-IDs) |

**Frontmatter format:**
```yaml
requirements_completed:
  - TOKS-01
  - TOKS-02
  - TOKS-03
```

**Note:** Plans 22-03, 24-02, and 25-02 are UI or documentation plans that do not directly map to v1.3 REQ-IDs. Their `requirements_completed` should be an empty array `[]` or omitted.

### Pattern 3: VALIDATION.md Status

**Discovery:** VALIDATION.md files for phases 23 and 24 already exist:
- `.planning/phases/23-user-delegated-api-clients-token-passthrough/23-VALIDATION.md` -- status: validated, nyquist_compliant: true
- `.planning/phases/24-token-pool-refresh-lifecycle/24-VALIDATION.md` -- status: validated, nyquist_compliant: true

Both files are complete with per-task verification maps, wave 0 requirements, manual-only verifications, validation sign-off, and audit results. The CONTEXT.md mentioned creating these, but they already exist. The plan should verify their completeness and update if needed rather than creating from scratch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie client-side access | Custom API endpoint for status | `httpOnly: false` on existing cookie | Cookie pattern already implemented; just needs flag fix |
| REQ-ID mapping | Manual cross-referencing | REQUIREMENTS.md traceability table | Complete mapping already exists with phase assignments |
| VALIDATION.md format | Custom structure | Existing phase 22/25 templates | Consistent format across all phases |

## Common Pitfalls

### Pitfall 1: Missing One Cookie-Setting Location

**What goes wrong:** Fix `httpOnly` in middleware but forget auth callback (or vice versa), resulting in inconsistent cookie behavior depending on how the user authenticates.
**Why it happens:** The cookie is set in 3 separate code locations.
**How to avoid:** Fix all three locations in a single commit. Grep for `google-token-status` to verify no locations are missed.
**Warning signs:** Badge works after middleware check but not after fresh login (or vice versa).

### Pitfall 2: Incorrect REQ-ID to Plan Mapping

**What goes wrong:** Assigning a REQ-ID to the wrong plan number.
**Why it happens:** Multiple plans per phase, easy to confuse which plan implemented which requirement.
**How to avoid:** Use the REQUIREMENTS.md traceability table as the authoritative source (maps REQ-IDs to phases), then cross-reference with each plan's SUMMARY.md `provides` field to determine which plan within a phase.
**Warning signs:** A REQ-ID appears in multiple plans' `requirements_completed`.

### Pitfall 3: Overwriting Existing VALIDATION.md Content

**What goes wrong:** Creating new VALIDATION.md files when they already exist, losing audit data.
**Why it happens:** CONTEXT.md says "create" but files already exist from a prior session.
**How to avoid:** Check file existence before writing. The existing files for phases 23 and 24 are complete and validated.

## Code Examples

### Cookie Fix (All Three Locations)

**middleware.ts -- "valid" branch (line ~104):**
```typescript
// Source: apps/web/src/middleware.ts
supabaseResponse.cookies.set("google-token-status", "valid", {
  maxAge: 3600,
  sameSite: "lax",
  path: "/",
  httpOnly: false, // Allow GoogleTokenBadge to read via document.cookie
});
```

**middleware.ts -- "missing" branch (line ~111):**
```typescript
// Source: apps/web/src/middleware.ts
supabaseResponse.cookies.set("google-token-status", "missing", {
  maxAge: 3600,
  sameSite: "lax",
  path: "/",
  httpOnly: false, // Allow GoogleTokenBadge to read via document.cookie
});
```

**auth/callback/route.ts (line ~42):**
```typescript
// Source: apps/web/src/app/auth/callback/route.ts
response.cookies.set("google-token-status", "valid", {
  maxAge: 3600,
  sameSite: "lax",
  path: "/",
  httpOnly: false, // Allow GoogleTokenBadge to read via document.cookie
});
```

### SUMMARY Frontmatter Example

```yaml
---
phase: 22-oauth-scope-expansion-token-storage
plan: 01
subsystem: auth
tags: [aes-256-gcm, crypto, prisma, encryption, google-oauth, token-storage]
requirements_completed: [TOKS-01, TOKS-02, TOKS-03, TOKS-04, TOKS-05]

# Dependency graph
requires: []
provides:
  - "UserGoogleToken Prisma model..."
# ... rest unchanged
---
```

## Validation Architecture

> Nyquist validation is enabled per config.json (key absent = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npx vitest run src/components/__tests__/google-token-badge.test.tsx` |
| Full suite command | `cd apps/agent && npx vitest run && cd ../web && npx vitest run` |

### Phase Requirements to Test Map

This is a tech debt cleanup phase with no formal REQ-IDs. Verification focuses on the httpOnly fix:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Cookie sets httpOnly: false | grep/static | `grep -c "httpOnly.*false" apps/web/src/middleware.ts apps/web/src/app/auth/callback/route.ts` | N/A |
| GoogleTokenBadge reads cookie correctly | unit (existing) | `cd apps/web && npx vitest run src/components/__tests__/google-token-badge.test.tsx` | Check |
| SUMMARY frontmatter has requirements_completed | grep/static | `grep -c "requirements_completed" .planning/phases/2[2-5]-*/*SUMMARY.md` | N/A |

### Sampling Rate
- **Per task commit:** `grep -c "httpOnly.*false" apps/web/src/middleware.ts apps/web/src/app/auth/callback/route.ts`
- **Per wave merge:** `cd apps/agent && npx vitest run && cd ../web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers phase requirements. The httpOnly fix is a 1-line change per location verifiable by static grep. Documentation changes (SUMMARY frontmatter, VALIDATION.md audit) are non-code.

## File Inventory

### Files to Modify (Code)
| File | Change | Lines |
|------|--------|-------|
| `apps/web/src/middleware.ts` | Add `httpOnly: false` to 2 cookie.set calls | ~104, ~111 |
| `apps/web/src/app/auth/callback/route.ts` | Add `httpOnly: false` to 1 cookie.set call | ~42 |

### Files to Modify (Documentation)
| File | Change |
|------|--------|
| `.planning/phases/22-*/22-01-SUMMARY.md` | Add `requirements_completed: [TOKS-01, TOKS-02, TOKS-03, TOKS-04, TOKS-05]` |
| `.planning/phases/22-*/22-02-SUMMARY.md` | Add `requirements_completed: [OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04]` |
| `.planning/phases/22-*/22-03-SUMMARY.md` | Add `requirements_completed: []` |
| `.planning/phases/23-*/23-01-SUMMARY.md` | Add `requirements_completed: [GAPI-01, GAPI-02, GAPI-03, GAPI-04, PASS-02]` |
| `.planning/phases/23-*/23-02-SUMMARY.md` | Add `requirements_completed: [PASS-01, PASS-03, PASS-04]` |
| `.planning/phases/24-*/24-01-SUMMARY.md` | Add `requirements_completed: [POOL-01, POOL-02, POOL-03, POOL-04, POOL-05, LIFE-01, LIFE-02, LIFE-03]` |
| `.planning/phases/24-*/24-02-SUMMARY.md` | Add `requirements_completed: []` |
| `.planning/phases/25-*/25-01-SUMMARY.md` | Add `requirements_completed: [INTG-01, INTG-02, INTG-03]` |
| `.planning/phases/25-*/25-02-SUMMARY.md` | Add `requirements_completed: []` |

### Files to Verify (Already Exist)
| File | Action |
|------|--------|
| `.planning/phases/23-*/23-VALIDATION.md` | Verify completeness -- already exists with full audit |
| `.planning/phases/24-*/24-VALIDATION.md` | Verify completeness -- already exists with full audit |

## Open Questions

1. **GoogleTokenBadge test file existence**
   - What we know: The component exists at `apps/web/src/components/google-token-badge.tsx`
   - What's unclear: Whether a test file exists for this component (could not verify without reading test directories)
   - Recommendation: Check during implementation; if no test exists, the httpOnly fix is verifiable via static grep

2. **NextResponse.cookies.set httpOnly default behavior**
   - What we know: The VERIFICATION.md explicitly documents the cookie as being httpOnly. Official Next.js docs say only `path` has a default value.
   - What's unclear: Whether `NextResponse.cookies.set()` (from `next/server`) has different defaults than `cookies().set()` (from `next/headers`), or whether the underlying `Set-Cookie` header behavior in the HTTP spec treats missing httpOnly as false
   - Recommendation: Adding `httpOnly: false` explicitly resolves the issue regardless of default behavior -- it is the correct fix either way

## Sources

### Primary (HIGH confidence)
- Project VERIFICATION.md: `.planning/phases/22-oauth-scope-expansion-token-storage/22-VERIFICATION.md` -- documents the httpOnly bug with exact line numbers and fix recommendation
- Project REQUIREMENTS.md: `.planning/REQUIREMENTS.md` -- complete traceability table mapping all 28 REQ-IDs to phases
- Project CONTEXT.md: `.planning/phases/26-tech-debt-cleanup/26-CONTEXT.md` -- locked decisions and scope

### Secondary (MEDIUM confidence)
- Next.js official docs (https://nextjs.org/docs/app/api-reference/functions/cookies) -- cookie options reference, version 16.1.6

## Metadata

**Confidence breakdown:**
- httpOnly fix: HIGH -- bug documented with exact locations and fix in VERIFICATION.md
- SUMMARY frontmatter: HIGH -- traceability table provides complete REQ-ID to phase mapping
- VALIDATION.md: HIGH -- files already exist; scope reduced to verification only
- Architecture: HIGH -- no new patterns; minimal changes to existing code

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- no dependency on external library changes)
