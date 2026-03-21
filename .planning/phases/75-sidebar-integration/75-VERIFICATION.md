---
phase: 75-sidebar-integration
verified: 2026-03-20T22:35:30Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 75: Sidebar Integration Verification Report

**Phase Goal:** Add Tutorials entry to the global sidebar navigation with an indicator for unwatched content so users can easily discover and navigate to tutorials from anywhere in the app
**Verified:** 2026-03-20T22:35:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tutorials nav item appears in the sidebar between Action Required and Settings | VERIFIED | `navItems` array in `sidebar.tsx` line 35: `{ href: "/tutorials", label: "Tutorials", icon: GraduationCap }` — positioned after Action Required, before the Settings link in the bottom section |
| 2 | A blue "New" text pill appears next to Tutorials in the expanded sidebar when unwatchedCount > 0 | VERIFIED | Lines 121-125 of `sidebar.tsx`: `{!collapsed && label === "Tutorials" && unwatchedCount > 0 && (<span className="...bg-blue-500...">New</span>)}` — test "shows blue 'New' pill in expanded sidebar when unwatchedCount > 0" passes |
| 3 | A blue dot badge appears in the collapsed sidebar top-right of the Tutorials icon when unwatchedCount > 0 | VERIFIED | Lines 127-129 of `sidebar.tsx`: `{collapsed && label === "Tutorials" && unwatchedCount > 0 && (<span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-500" />)}` — test "shows blue dot in collapsed sidebar when unwatchedCount > 0" passes |
| 4 | Both badges disappear when unwatchedCount is 0 (all tutorials watched) | VERIFIED | Badges conditioned on `unwatchedCount > 0`; test "does not show blue pill when unwatchedCount is 0" confirms no `bg-blue-500` elements present when count is 0 |
| 5 | Sidebar fetches /api/tutorials/unwatched-count on every pathname change | VERIFIED | Lines 52-57 of `sidebar.tsx`: `useEffect(() => { fetch("/api/tutorials/unwatched-count")... }, [pathname])` — test "fetches /api/tutorials/unwatched-count on mount" passes |
| 6 | Unwatched count is computed as totalTutorials minus watchedCount (never under-counts) | VERIFIED | Agent endpoint lines 4317-4328 of `index.ts`: `const totalTutorials = await prisma.tutorial.count(); const watchedCount = userId ? await prisma.tutorialView.count({ where: { userId, watched: true } }) : 0; const count = totalTutorials - watchedCount;` |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/agent/src/mastra/index.ts` | GET /tutorials/unwatched-count agent endpoint | VERIFIED | Route registered at lines 4317-4328; contains `registerApiRoute("/tutorials/unwatched-count"` with correct total-minus-watched logic |
| `apps/web/src/lib/api-client.ts` | fetchTutorialUnwatchedCount helper | VERIFIED | Exported at lines 1204-1208; calls `fetchJSON<{ count: number }>(\`/tutorials/unwatched-count${qs}\`)` and returns `result.count` |
| `apps/web/src/app/(authenticated)/api/tutorials/unwatched-count/route.ts` | Authenticated Next.js API route returning { count: number } | VERIFIED | Exports `GET`; uses `createClient()` + `supabase.auth.getUser()` + `fetchTutorialUnwatchedCount(user?.id)`; returns `NextResponse.json({ count })` |
| `apps/web/src/components/sidebar.tsx` | Tutorials nav item with dual-mode badge | VERIFIED | `GraduationCap` imported; Tutorials in `navItems`; `unwatchedCount` state/effect; both expanded and collapsed badge JSX present |
| `apps/web/src/components/__tests__/sidebar.test.tsx` | Tests for Tutorials badge behavior | VERIFIED | BROWSE-01 describe block at lines 347-410 with 5 tests; all 29 sidebar tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sidebar.tsx` | `/api/tutorials/unwatched-count` | `useEffect([pathname]) fetch` | VERIFIED | Line 53: `fetch("/api/tutorials/unwatched-count")` inside `useEffect(..., [pathname])` |
| `(authenticated)/api/tutorials/unwatched-count/route.ts` | `apps/web/src/lib/api-client.ts` | `fetchTutorialUnwatchedCount(user?.id)` | VERIFIED | Line 1 imports `fetchTutorialUnwatchedCount`; line 11 calls `fetchTutorialUnwatchedCount(user?.id)` |
| `apps/web/src/lib/api-client.ts` | `apps/agent/src/mastra/index.ts` | `fetchJSON to /tutorials/unwatched-count` | VERIFIED | Line 1206: `fetchJSON<{ count: number }>(\`/tutorials/unwatched-count${qs}\`)` connecting to agent route at `/tutorials/unwatched-count` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BROWSE-01 | 75-01-PLAN.md | Tutorials nav item in sidebar with "New" dot badge indicating unwatched content | SATISFIED | Nav item renders at `/tutorials` with GraduationCap icon; blue "New" pill in expanded mode; blue dot in collapsed mode; both disappear when count is 0; BROWSE-01 describe block (5 tests) all passing; marked complete in REQUIREMENTS.md |

No orphaned requirements — REQUIREMENTS.md shows BROWSE-01 mapped to Phase 75 and claimed in 75-01-PLAN.md.

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments, no stub implementations, no empty handlers in any of the five modified/created files.

### Human Verification Required

None required for automated checks. The following items are observable in the running app but not required to block passage:

1. **Visual badge appearance in browser**
   - Test: Navigate to the sidebar in a browser with an account that has unwatched tutorials; verify the "New" pill and blue dot render at the correct position and color
   - Expected: Blue "New" pill right-aligned in expanded sidebar; small blue dot at top-right of Tutorials icon in collapsed sidebar
   - Why human: Visual layout and color rendering cannot be verified programmatically

2. **Badge clears after watching all tutorials**
   - Test: Watch all tutorials, then navigate to another page; verify badge disappears
   - Expected: Badge absent when all tutorials have `watched: true` in `TutorialView`
   - Why human: Requires real data state change and navigation; the logic is correct per code but end-to-end flow needs live verification

### Gaps Summary

No gaps. All six observable truths are verified, all five required artifacts exist and are substantive, all three key links are wired, and the single requirement BROWSE-01 is satisfied. The full sidebar test suite (29 tests) passes including all five new BROWSE-01 tests.

---

_Verified: 2026-03-20T22:35:30Z_
_Verifier: Claude (gsd-verifier)_
