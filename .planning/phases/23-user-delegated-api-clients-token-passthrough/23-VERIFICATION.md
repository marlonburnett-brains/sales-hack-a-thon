---
phase: 23-user-delegated-api-clients-token-passthrough
verified: 2026-03-06T17:11:45Z
status: passed
score: 12/12 must-haves verified
---

# Phase 23: User-Delegated API Clients & Token Passthrough Verification Report

**Phase Goal:** Modify Google API client factories to accept user tokens and wire up the web->agent token passthrough.
**Verified:** 2026-03-06T17:11:45Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | getSlidesClient(), getDriveClient(), getDocsClient() accept optional auth options and return a Google API client | VERIFIED | `google-auth.ts` lines 39, 44, 50 all accept `options?: GoogleAuthOptions` |
| 2 | When accessToken is provided, the client uses OAuth2Client with the user's credential | VERIFIED | `getUserAuth()` at line 30-37 creates OAuth2Client with access_token credential |
| 3 | When no auth options are provided, the client falls back to service account (backward compatible) | VERIFIED | Ternary `options ? getUserAuth(options) ?? getGoogleAuth() : getGoogleAuth()` ensures fallback |
| 4 | All 14+ existing callers of Google API factories require zero changes | VERIFIED | grep confirms 14+ callers across doc-builder.ts, atlusai-client.ts, slide-extractor.ts, deck-assembly.ts, atlusai-search.ts, drive-folders.ts, deck-customizer.ts, slide-assembly.ts, build-image-registry.ts, ingest-brand-guidelines.ts, discover-content.ts, spike/slides-spike.ts all call with zero arguments |
| 5 | Agent routes extract X-Google-Access-Token and X-User-Id headers and pass to factories | VERIFIED | 4 route handlers in mastra/index.ts call extractGoogleAuth(c) and pass result to getDriveClient/getSlidesClient (lines 303-304, 870-872, 1037-1044, 1153-1154) |
| 6 | Agent caches refreshed access tokens in memory with ~50min TTL | VERIFIED | token-cache.ts: TOKEN_TTL_MS = 50 * 60 * 1000, in-memory Map cache, promise dedup for concurrent refreshes |
| 7 | fetchWithGoogleAuth sends X-Google-Access-Token and X-User-Id headers on Google-triggering requests | VERIFIED | api-client.ts lines 40-57: builds googleHeaders from getGoogleAccessToken(), passes to fetchJSON |
| 8 | Server Actions for template operations use fetchWithGoogleAuth instead of direct fetchJSON | VERIFIED | createTemplate (line 578), checkTemplateStaleness (line 591), triggerIngestion (line 611) all use fetchWithGoogleAuth |
| 9 | Server Actions for slide thumbnails use fetchWithGoogleAuth | VERIFIED | getSlideThumbnails (line 680) uses fetchWithGoogleAuth |
| 10 | Server Actions for workflow starts use fetchWithGoogleAuth | VERIFIED | 5 workflow starts (Touch 1-4 + PreCall) at lines 211, 270, 306, 342, 519 use fetchWithGoogleAuth |
| 11 | Non-Google CRUD operations still use fetchJSON without Google headers | VERIFIED | createCompany, createDeal, getDeal, listDeals, getInteractions, getBrief, approveBrief, rejectBrief, editBrief, getAssetReview, approveAssets, rejectAssets, listTemplates, deleteTemplate, storeGoogleToken, checkGoogleToken, listSlides, updateSlideClassification, findSimilarSlides, all workflow status/resume functions all use fetchJSON |
| 12 | getGoogleAccessToken retrieves provider_token and userId from Supabase session | VERIFIED | google-token.ts: calls supabase.auth.getSession() for provider_token and supabase.auth.getUser() for user id |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/agent/src/lib/google-auth.ts` | Dual-mode Google API factory functions | VERIFIED | Exports getSlidesClient, getDriveClient, getDocsClient with optional GoogleAuthOptions, getUserAuth helper, GoogleAuthOptions interface |
| `apps/agent/src/lib/token-cache.ts` | In-memory token cache with TTL and refresh-to-access-token exchange | VERIFIED | 151 lines, exports getAccessTokenForUser, uses decryptToken, OAuth2Client refresh, 50min TTL, promise dedup, cache sweep |
| `apps/agent/src/lib/request-auth.ts` | Hono request header extraction for Google auth | VERIFIED | 50 lines, exports extractGoogleAuth and GoogleAuthResult, implements priority chain (accessToken > userId refresh > empty) |
| `apps/agent/src/env.ts` | GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env validation | VERIFIED | Lines 57-58: z.string().min(1) for both |
| `apps/web/src/lib/supabase/google-token.ts` | Supabase session token extraction for Google auth | VERIFIED | 31 lines, exports getGoogleAccessToken returning { accessToken, userId } |
| `apps/web/src/lib/api-client.ts` | fetchWithGoogleAuth wrapper alongside existing fetchJSON | VERIFIED | Lines 40-57: exported fetchWithGoogleAuth calls getGoogleAccessToken and passes headers to fetchJSON |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| request-auth.ts | token-cache.ts | extractGoogleAuth calls getAccessTokenForUser | WIRED | Line 1: import, Line 40: call when userId present |
| token-cache.ts | token-encryption.ts | decryptToken to get refresh token from DB | WIRED | Line 3: import, Lines 87-91: decryptToken call with record fields |
| mastra/index.ts | request-auth.ts | route handlers call extractGoogleAuth(c) | WIRED | Line 13: import, 4 call sites at lines 303, 870, 1037, 1153 |
| mastra/index.ts | google-auth.ts | route handlers pass auth options to factories | WIRED | Line 12: import, 4 call sites pass `googleAuth.accessToken ? googleAuth : undefined` |
| api-client.ts | google-token.ts | fetchWithGoogleAuth calls getGoogleAccessToken | WIRED | Line 11: import, Line 44: call in fetchWithGoogleAuth |
| template-actions.ts | api-client.ts | Google-triggering actions call fetchWithGoogleAuth (via api-client internals) | WIRED | Actions call createTemplate, checkTemplateStaleness, triggerIngestion which internally use fetchWithGoogleAuth |
| touch-actions.ts | api-client.ts | Workflow start actions call fetchWithGoogleAuth (via api-client internals) | WIRED | Actions call startTouch*Workflow functions which internally use fetchWithGoogleAuth |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GAPI-01 | 23-01 | google-auth.ts exports factories that accept optional accessToken | SATISFIED | All 3 factories accept optional GoogleAuthOptions |
| GAPI-02 | 23-01 | With accessToken, clients use OAuth2Client with user's token | SATISFIED | getUserAuth creates OAuth2Client with access_token |
| GAPI-03 | 23-01 | Without accessToken, clients fall back to service account | SATISFIED | Ternary fallback to getGoogleAuth() |
| GAPI-04 | 23-01 | All 14+ existing callers require zero changes | SATISFIED | All callers confirmed calling with zero arguments |
| PASS-01 | 23-02 | api-client.ts sends X-Google-Access-Token header when token available | SATISFIED | fetchWithGoogleAuth builds and sends header |
| PASS-02 | 23-01 | Agent routes extract X-Google-Access-Token and pass to factories | SATISFIED | 4 route handlers wired with extractGoogleAuth |
| PASS-03 | 23-02 | Server Actions retrieve Google token from Supabase session | SATISFIED | getGoogleAccessToken extracts from session |
| PASS-04 | 23-02 | Template/slide/ingestion operations use user token when available | SATISFIED | 9 Google-triggering functions use fetchWithGoogleAuth |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

No TODO, FIXME, PLACEHOLDER, or stub patterns found in any phase 23 artifacts.

### Human Verification Required

### 1. Token Refresh Flow

**Test:** Log in with Google OAuth, wait for provider_token to expire, then trigger a template operation
**Expected:** Agent-side token cache should refresh via stored refresh token, operation succeeds
**Why human:** Requires live Google OAuth session and token expiration timing

### 2. CORS Preflight for Custom Headers

**Test:** From browser, trigger a template create or staleness check and inspect network tab
**Expected:** OPTIONS preflight succeeds, X-Google-Access-Token and X-User-Id headers accepted
**Why human:** Requires browser CORS preflight behavior

### 3. Service Account Fallback When Not Logged In

**Test:** Access template operations without Google OAuth login
**Expected:** Operations fall back to service account auth and still succeed
**Why human:** Requires testing unauthenticated Google OAuth state

### Gaps Summary

No gaps found. All 12 observable truths verified, all 6 artifacts exist and are substantive, all 7 key links are wired, and all 8 requirements are satisfied. The phase goal of creating dual-mode Google API client factories and wiring the end-to-end token passthrough pipeline has been achieved.

The background staleness polling function at mastra/index.ts line 46 correctly uses service account (no request context available) -- this is an intentional design decision documented in the summary.

---

_Verified: 2026-03-06T17:11:45Z_
_Verifier: Claude (gsd-verifier)_
