---
phase: 27-auth-foundation
verified: 2026-03-06T22:00:00Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "User can submit AtlusAI credentials via a web form and re-submitting updates the existing record (not duplicates)"
    status: failed
    reason: "No web UI form exists for AtlusAI credential submission. upsertAtlusToken() is only called from detectAtlusAccess() which auto-detects via Google token -- there is no user-facing form to input AtlusAI API keys or tokens. ATLS-04 requirement is unsatisfied."
    artifacts:
      - path: "apps/web/src"
        issue: "No AtlusAI credential input form component exists anywhere in the web app"
      - path: "apps/agent/src/mastra/index.ts"
        issue: "No POST route for accepting user-submitted AtlusAI credentials (separate from POST /atlus/detect which takes Google token)"
    missing:
      - "Web form component for AtlusAI token/API key input (e.g., apps/web/src/app/(authenticated)/settings/atlus-credentials.tsx)"
      - "Agent POST route to accept user-submitted AtlusAI credentials and call upsertAtlusToken"
      - "Server action to bridge web form to agent endpoint"
human_verification:
  - test: "Navigate to /actions and verify Silence UX replaces Dismiss"
    expected: "BellOff icon button on non-silenced items, no Dismiss text anywhere, silenced items dimmed at opacity-50"
    why_human: "Visual rendering and interactive behavior cannot be verified programmatically"
  - test: "Click Silence on an action item and check sidebar badge"
    expected: "Item becomes dimmed, sidebar badge count decreases by 1"
    why_human: "Requires running app and observing real-time state changes"
  - test: "Verify AtlusAI action type icons render correctly"
    expected: "Purple KeyRound for atlus_account_required, indigo ShieldCheck for atlus_project_required"
    why_human: "Icon rendering and color verification needs visual inspection"
---

# Phase 27: Auth Foundation Verification Report

**Phase Goal:** Users can store AtlusAI credentials and the system detects their access level, surfacing clear guidance when action is needed
**Verified:** 2026-03-06T22:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can submit AtlusAI credentials via a web form and re-submitting updates the existing record (not duplicates) | FAILED | No web form exists. `upsertAtlusToken()` is only called internally from `detectAtlusAccess()`. No user-facing credential input UI. |
| 2 | Stored tokens are encrypted at rest (AES-256-GCM) and the system tracks validity, last usage, and revocation per token | VERIFIED | `atlus-auth.ts` calls `encryptToken()` from `token-encryption.ts`. Schema has `encryptedToken`, `iv`, `authTag`, `isValid`, `lastUsedAt`, `revokedAt` fields. |
| 3 | Background processes obtain a valid AtlusAI token from the pool (ordered by last used), with automatic invalidation on failure and env var fallback when the pool is empty | VERIFIED | `getPooledAtlusAuth()` queries `findMany({ where: { isValid: true }, orderBy: { lastUsedAt: 'desc' } })`. Failed tokens marked `isValid: false`. Env fallback via `process.env.ATLUS_API_TOKEN`. 7 unit tests passing. |
| 4 | When a user lacks an AtlusAI account or project access, a specific ActionRequired item appears in the sidebar with resolution guidance -- and resolving one tier immediately re-checks the next | VERIFIED | `detectAtlusAccess()` implements 3-tier cascade. Tier 1 failure creates `atlus_account_required`, Tier 2 creates `atlus_project_required`. Auto-resolves prior tier before checking next. Wired to POST /tokens (fire-and-forget) and POST /atlus/detect. |
| 5 | The system logs a warning when fewer than 3 valid AtlusAI tokens remain in the pool | VERIFIED | `getPooledAtlusAuth()` calls `prisma.userAtlusToken.count({ where: { isValid: true } })` and logs `console.warn('[atlus-pool] WARNING: Only N valid token(s) remaining')` when count < 3. |

**Score:** 4/5 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/agent/prisma/schema.prisma` | UserAtlusToken model, ActionRequired extensions | VERIFIED | Model at line 275 with all required fields and indexes. ActionRequired has `silenced` and `seenAt` at lines 307-308. |
| `apps/agent/prisma/migrations/20260306210000_add_atlus_token_and_action_silence/` | Forward-only migration | VERIFIED | SQL creates UserAtlusToken table, adds silenced/seenAt to ActionRequired. No destructive commands. |
| `packages/schemas/constants.ts` | ACTION_TYPES with 5 types | VERIFIED | Lines 195-201: all 5 types defined. Exported from `index.ts` at line 18. |
| `apps/agent/src/lib/atlus-auth.ts` | Token CRUD, pool rotation, access detection, ActionRequired helpers | VERIFIED | Exports: `upsertAtlusToken`, `decryptAtlusToken`, `getPooledAtlusAuth`, `PooledAtlusAuthResult`, `detectAtlusAccess`, `upsertActionRequired`, `resolveActionsByType`. All substantive implementations. |
| `apps/agent/src/lib/__tests__/atlus-auth.test.ts` | 7 unit tests for pool rotation | VERIFIED | 7 tests covering pool iteration, failure marking, lastUsedAt update, health warning, env fallback, null return, source labels. |
| `apps/web/src/lib/api-client.ts` | ActionRequiredItem with silenced/seenAt, silenceAction, recheckAtlusAccess | VERIFIED | `silenced: boolean` at line 753, `seenAt: string \| null` at 754. `silenceAction` at 774, `recheckAtlusAccess` at 780. |
| `apps/web/src/lib/actions/action-required-actions.ts` | silenceActionAction, recheckAtlusAccessAction server actions | VERIFIED | Lines 24-33: both server actions with revalidatePath. |
| `apps/web/src/app/(authenticated)/actions/actions-client.tsx` | Silence UX, dimming, AtlusAI icons, Re-check button | VERIFIED | BellOff icon (line 180), KeyRound/ShieldCheck icons (lines 31/33), opacity-50 dimming (line 132), Re-check Access button (line 165), no "Dismiss" text found. |
| `apps/agent/src/mastra/index.ts` | Updated routes: silence, detect, badge count, sort order | VERIFIED | PATCH /actions/:id/silence (line 1410), POST /atlus/detect (line 1427), count excludes silenced (line 1389), orderBy updatedAt desc (line 1378), detectAtlusAccess wired to POST /tokens (line 1334). |
| Web form for AtlusAI credentials | ATLS-04: User-facing credential input | MISSING | No form component exists anywhere in apps/web/src for AtlusAI credential submission. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| atlus-auth.ts | token-encryption.ts | import encryptToken/decryptToken | WIRED | Line 11: `import { encryptToken, decryptToken } from "./token-encryption"` |
| atlus-auth.ts | prisma.userAtlusToken | CRUD operations | WIRED | upsert (line 39), findMany (line 248), update (lines 258, 278), count (line 266) |
| atlus-auth.ts | prisma.actionRequired | findFirst/update/create | WIRED | Lines 90-104: dedup via findFirst, re-surface via update, create new |
| atlus-auth.ts | @lumenalta/schemas | ACTION_TYPES import | WIRED | Line 12: `import { ACTION_TYPES } from "@lumenalta/schemas"` |
| mastra/index.ts | atlus-auth.ts | detectAtlusAccess import + call | WIRED | Line 16: import. Line 1334: fire-and-forget call in POST /tokens. Line 1438: sync call in POST /atlus/detect. |
| mastra/index.ts | prisma.actionRequired | count with silenced:false | WIRED | Line 1389: `{ resolved: false, silenced: false }` |
| actions-client.tsx | action-required-actions.ts | silenceActionAction | WIRED | Line 18: import. Line 83: call in handleSilence. |
| action-required-actions.ts | api-client.ts | silenceAction/recheckAtlusAccess | WIRED | Lines 7-8: imports. Lines 25, 31: calls. |
| api-client.ts | PATCH /actions/:id/silence | fetch call | WIRED | Line 774: `silenceAction` calls fetchJSON with PATCH. |
| sidebar.tsx | /api/actions/count | fetch for badge | WIRED | Line 39: `fetch("/api/actions/count")` -- agent-side already excludes silenced. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ATLS-01 | 27-01 | UserAtlusToken Prisma model | SATISFIED | Schema line 275, migration exists |
| ATLS-02 | 27-01 | AES-256-GCM encryption via token-encryption.ts | SATISFIED | atlus-auth.ts imports and uses encryptToken/decryptToken |
| ATLS-03 | 27-01 | Tracks lastUsedAt, isValid, revokedAt | SATISFIED | Schema fields present, pool rotation updates them |
| ATLS-04 | 27-04 | Web UI form for credential submission | NOT SATISFIED | No form exists. Re-check Access button is not a credential form. |
| ATLS-05 | 27-01 | Token upsert on userId (no duplicates) | SATISFIED | `prisma.userAtlusToken.upsert({ where: { userId } })` in atlus-auth.ts line 39 |
| POOL-01 | 27-02 | getPooledAtlusAuth iterates by lastUsedAt desc | SATISFIED | atlus-auth.ts line 250: `orderBy: { lastUsedAt: "desc" }` |
| POOL-02 | 27-02 | Failed tokens marked isValid:false with revokedAt | SATISFIED | atlus-auth.ts lines 278-283 |
| POOL-03 | 27-02 | Successful usage updates lastUsedAt | SATISFIED | atlus-auth.ts lines 258-263 |
| POOL-04 | 27-02 | Warning when < 3 valid tokens | SATISFIED | atlus-auth.ts lines 269-273, 288-296 |
| POOL-05 | 27-02 | ATLUS_API_TOKEN env var fallback | SATISFIED | atlus-auth.ts lines 299-303 |
| TIER-01 | 27-03 | Detects no-account state, creates atlus_account_required | SATISFIED | atlus-auth.ts lines 154-181 |
| TIER-02 | 27-03 | Detects no-project state, creates atlus_project_required | SATISFIED | atlus-auth.ts lines 186-220 |
| TIER-03 | 27-03 | Full access pools token without ActionRequired | SATISFIED | atlus-auth.ts lines 225-227 |
| TIER-04 | 27-03 | Resolving tier re-checks next tiers (cascade) | SATISFIED | detectAtlusAccess resolves Tier 1 then checks Tier 2, resolves Tier 2 then stores Tier 3 |
| TIER-05 | 27-03 | ActionRequired dedup per user+actionType | SATISFIED | upsertActionRequired findFirst before create (lines 90-104) |
| ACTN-01 | 27-04 | atlus_account_required with dedicated icon | SATISFIED | actions-client.tsx line 31: KeyRound purple icon |
| ACTN-02 | 27-04 | atlus_project_required with dedicated icon | SATISFIED | actions-client.tsx line 33: ShieldCheck indigo icon |
| ACTN-03 | 27-01 | ACTION_TYPES in packages/schemas | SATISFIED | constants.ts lines 195-202, exported from index.ts |
| ACTN-04 | 27-03 | Resolution guidance in descriptions | SATISFIED | detectAtlusAccess provides specific guidance strings (lines 176-178, 217-218) |
| ACTN-05 | 27-04 | Sidebar badge includes AtlusAI types | SATISFIED | sidebar.tsx fetches /api/actions/count which counts all non-silenced types |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| apps/agent/src/lib/atlus-auth.ts | 130, 155, 187 | TODO(phase-28) -- stub probes | Info | Expected per plan -- auth mechanism unknown, probes are functional stubs that make real HTTP calls |
| apps/web/src/app/(authenticated)/actions/actions-client.tsx | 97 | TODO(phase-28) -- OAuth token wiring | Info | Expected per plan -- Re-check Access button disabled with toast explanation |

No blocker anti-patterns. All TODOs are explicitly scoped to phase-28 and documented as design decisions.

### Human Verification Required

### 1. Silence UX Visual Check

**Test:** Navigate to /actions, verify BellOff icon replaces Dismiss text, click Silence on an item
**Expected:** Item becomes dimmed (opacity-50), silence button disappears on that item, sidebar badge decreases
**Why human:** Interactive UI behavior and visual rendering need live app

### 2. AtlusAI Icon Rendering

**Test:** Create test ActionRequired records with atlus_account_required and atlus_project_required types, view /actions
**Expected:** Purple KeyRound icon for account-required, indigo ShieldCheck for project-required
**Why human:** Icon color and rendering need visual inspection

### 3. Re-check Access Button

**Test:** View an AtlusAI action card, click Re-check Access
**Expected:** Button shows disabled state with toast "Re-check Access requires OAuth token wiring (coming in Phase 28)"
**Why human:** Interactive behavior and toast rendering need live app

### Gaps Summary

**1 gap found blocking full goal achievement:**

**ATLS-04 / Success Criterion #1: No web form for AtlusAI credential submission.** The roadmap success criterion explicitly states "User can submit AtlusAI credentials via a web form and re-submitting updates the existing record." No such form exists. The `upsertAtlusToken()` backend function is ready but has no web-facing entry point for user-submitted credentials. The current implementation only stores tokens automatically via `detectAtlusAccess()` when Google OAuth tokens happen to work with AtlusAI -- this is not the same as a user submitting credentials via a form.

To close this gap:
1. Create a web form component (e.g., settings page) with a token/API key input field
2. Create an agent POST route to accept user-submitted AtlusAI credentials
3. Create a server action to bridge the form to the agent endpoint
4. Wire the form submission to call `upsertAtlusToken()` on the agent side

---

_Verified: 2026-03-06T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
