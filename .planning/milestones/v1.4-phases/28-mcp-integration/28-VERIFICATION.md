---
phase: 28-mcp-integration
verified: 2026-03-07T01:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 28: MCP Integration Verification Report

**Phase Goal:** AtlusAI semantic search replaces Drive API keyword search in all existing workflows, with Drive retained as a degraded fallback
**Verified:** 2026-03-07T01:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MCPClient connects to AtlusAI SSE endpoint using pooled OAuth Bearer tokens | VERIFIED | `mcp-client.ts:54` creates URL `https://knowledge-base-api.lumenalta.com/sse`, fetch callback injects Bearer token from `currentAuth.token` (line 59-60), auth sourced via `getPooledAtlusAuth()` |
| 2 | MCPClient self-heals: health check via listTools(), disconnect+recreate on failure | VERIFIED | `initMcp()` lines 244-258: `listTools()` with 5s timeout race, fallbackMode set on failure, client disconnected and nulled |
| 3 | Each MCP request gets a fresh token injected via fetch callback | VERIFIED | `createClient()` lines 57-63: thin fetch callback reads `currentAuth.token` at call time (not closure-captured stale value) |
| 4 | MCPClient is forcibly recycled after configurable max lifetime (default 1 hour) | VERIFIED | `getMcpClient()` line 276: checks `Date.now() - createdAt > env.ATLUS_MCP_MAX_LIFETIME_MS`, disconnects and nulls client, clears `cachedExtractionPrompt` |
| 5 | MCPClient disconnects gracefully on SIGTERM | VERIFIED | `mastra/index.ts:1516-1520`: SIGTERM handler calls `shutdownMcp()` then `process.exit(0)` |
| 6 | No @mastra/mcp imports exist in apps/web | VERIFIED | `grep -r "@mastra/mcp" apps/web/` returns exit code 1 (no matches) |
| 7 | On 401, refresh token is tried first, then pool rotation | VERIFIED | `handleAuthFailure()` lines 96-193: tries `refreshAtlusToken()` first, on failure marks token invalid and calls `getPooledAtlusAuth()` for next token; mutex via `refreshPromise` |
| 8 | searchSlides() uses MCP knowledge_base_search_semantic tool for queries | VERIFIED | `atlusai-search.ts:93`: `callMcpTool("knowledge_base_search_semantic", args)` in `searchSlidesMcp()`, routed from `searchSlides()` lines 424-437 |
| 9 | MCP results are mapped to SlideSearchResult via LLM extraction | VERIFIED | `extractSlideResults()` lines 127-221: GoogleGenAI call with adaptive prompt, parses response as `SlideSearchResult[]` |
| 10 | searchForProposal() multi-pass logic preserved -- only inner searchSlides() changes | VERIFIED | Lines 474-559: 3-pass structure (primary, secondary, case study) with dedup map and 3-tier fallback unchanged, calls `searchSlides()` which now routes MCP-first |
| 11 | Setting ATLUS_USE_MCP=false falls back to Drive API search | VERIFIED | `searchSlides()` line 424: `env.ATLUS_USE_MCP !== "false"` gate; Drive path at lines 435-436 with `source: "drive"` tagging |
| 12 | Results include source field ('mcp' or 'drive') for UI fallback indicator | VERIFIED | `SlideSearchResult` interface line 51: `source?: "mcp" \| "drive"`, MCP results tagged at line 99, Drive results tagged at line 436 |
| 13 | MCP search is scoped to ATLUS_PROJECT_ID when configured | VERIFIED | `searchSlidesMcp()` lines 89-91: `if (env.ATLUS_PROJECT_ID) args.project_id = env.ATLUS_PROJECT_ID` |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/agent/src/lib/mcp-client.ts` | MCPClient singleton wrapper with lifecycle management | VERIFIED | 392 lines, 7 exports: initMcp, getMcpClient, callMcpTool, isMcpAvailable, shutdownMcp, getCachedExtractionPrompt, setCachedExtractionPrompt |
| `apps/agent/src/lib/atlus-auth.ts` | refreshAtlusToken, updateAtlusTokenInDb, registerAtlusClient | VERIFIED | Three new functions added (lines 267-353) with proper OAuth token refresh, DB persistence, and dynamic client registration |
| `apps/agent/src/lib/atlusai-search.ts` | MCP-backed searchSlides with Drive fallback and LLM extraction | VERIFIED | 580 lines, MCP-first routing, LLM extraction via GoogleGenAI, Drive fallback preserved |
| `apps/agent/src/lib/__tests__/mcp-client.test.ts` | Unit tests for MCP client lifecycle | VERIFIED | 441 lines of tests |
| `apps/agent/src/lib/__tests__/atlusai-search.test.ts` | Unit tests for search routing, LLM extraction, fallback | VERIFIED | 598 lines of tests |
| `apps/agent/src/env.ts` | ATLUS_USE_MCP, ATLUS_PROJECT_ID, ATLUS_MCP_MAX_LIFETIME_MS | VERIFIED | Lines 83-87: all three env vars with correct types and defaults |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| mcp-client.ts | atlus-auth.ts | getPooledAtlusAuth, refreshAtlusToken | WIRED | Import at line 19-24, used in initMcp, getMcpClient, handleAuthFailure |
| mastra/index.ts | mcp-client.ts | initMcp() on boot, shutdownMcp() on SIGTERM | WIRED | Import line 23, initMcp at line 1513, shutdownMcp at line 1518 |
| atlusai-search.ts | mcp-client.ts | callMcpTool, isMcpAvailable | WIRED | Import lines 23-27, used in searchSlidesMcp (line 93) and searchSlides (line 426) |
| atlusai-search.ts | @google/genai | GoogleGenAI for LLM extraction | WIRED | Import line 28, used in extractSlideResults (lines 175-185) |
| 5 consumer files | atlusai-search.ts | searchSlides, searchForProposal, searchByCapability, SlideSearchResult | WIRED | All 5 consumer imports verified unchanged via grep |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| MCP-01 | 28-01 | MCPClient connects to AtlusAI SSE endpoint with pooled auth | SATISFIED | mcp-client.ts:54 URL, fetch callback with Bearer token |
| MCP-02 | 28-01 | MCPClient lives only on agent service | SATISFIED | No `@mastra/mcp` imports in apps/web/ |
| MCP-03 | 28-01 | Singleton with health check: listTools() probe, disconnect+recreate on failure | SATISFIED | initMcp() health check with 5s timeout race |
| MCP-04 | 28-01 | Auth injection via fetch callback for fresh tokens per request | SATISFIED | createClient() thin fetch callback reads currentAuth.token |
| MCP-05 | 28-01 | Max lifetime recycle (configurable, default 1 hour) | SATISFIED | getMcpClient() checks ATLUS_MCP_MAX_LIFETIME_MS |
| MCP-06 | 28-01 | Graceful SIGTERM shutdown | SATISFIED | mastra/index.ts SIGTERM handler calls shutdownMcp() |
| SRCH-01 | 28-02 | searchSlides() uses MCP knowledge_base_search_semantic | SATISFIED | searchSlidesMcp() calls callMcpTool("knowledge_base_search_semantic") |
| SRCH-02 | 28-02 | Results mapped to SlideSearchResult via LLM extraction | SATISFIED | extractSlideResults() with GoogleGenAI, adaptive prompt |
| SRCH-03 | 28-02 | searchForProposal() multi-pass logic preserved | SATISFIED | 3-pass structure unchanged, calls searchSlides() internally |
| SRCH-04 | 28-02 | searchByCapability() uses MCP via delegation to searchSlides() | SATISFIED | searchByCapability() delegates to searchSlides() (line 574) |
| SRCH-05 | 28-02 | Drive API retained as fallback behind ATLUS_USE_MCP env flag | SATISFIED | searchSlides() checks env.ATLUS_USE_MCP, falls through to searchSlidesDrive() |
| SRCH-06 | 28-02 | MCP search scoped to ATLUS_PROJECT_ID | SATISFIED | searchSlidesMcp() adds project_id arg when env var set |

No orphaned requirements found -- all 12 requirement IDs from ROADMAP.md are claimed and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

No TODOs, FIXMEs, placeholders, or stub implementations found in any phase artifacts. The `return null` / `return []` patterns in mcp-client.ts and atlusai-search.ts are intentional graceful degradation (fallback mode, LLM extraction failure), not stubs.

### Human Verification Required

### 1. MCP SSE Connection to Live AtlusAI Endpoint

**Test:** Deploy agent with valid AtlusAI tokens in the pool and check logs for `[mcp] Connected -- N tool(s) available`
**Expected:** initMcp() succeeds, health check passes, tool count logged
**Why human:** Requires live AtlusAI SSE endpoint and valid credentials

### 2. MCP Semantic Search Quality

**Test:** Trigger a search via workflow (e.g., Touch 4 proposal assembly) and compare MCP semantic results vs old Drive keyword results
**Expected:** Results are semantically relevant with `source: "mcp"` and `relevanceScore` populated
**Why human:** Requires live MCP endpoint and subjective quality assessment of search relevance

### 3. LLM Extraction Accuracy

**Test:** Inspect raw MCP results and verify LLM-extracted SlideSearchResult objects have correct field mappings
**Expected:** slideId, documentTitle, textContent populated from raw MCP result shape
**Why human:** Depends on actual MCP response shape which may vary

### 4. Token Refresh and Rotation Under Real Auth Failures

**Test:** Use an expired AtlusAI token and verify the refresh-then-rotate recovery path
**Expected:** Token refreshed via /auth/token, or rotated to next pool token if refresh fails
**Why human:** Requires expired token scenario against live OAuth endpoint

### Gaps Summary

No gaps found. All 13 observable truths verified, all 6 artifacts exist and are substantive, all 5 key links are wired, and all 12 requirements are satisfied. The implementation matches the phase goal: MCP semantic search replaces Drive API keyword search in all existing workflows with Drive retained as a degraded fallback.

---

_Verified: 2026-03-07T01:00:00Z_
_Verifier: Claude (gsd-verifier)_
