---
phase: 72-tutorial-browsing
verified: 2026-03-20T23:40:00Z
status: human_needed
score: 10/10 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to /tutorials in a running dev environment. Observe the six category section headers."
    expected: "Each category has a distinct icon. Getting Started = Rocket. Deal Workflows = Briefcase. Touch Points = Hand. Content Management = Layers3 or similar. Review = ClipboardCheck. Settings & Admin = Settings2. Currently five of six categories will show the generic Layers3 fallback icon because the ICON_MAP in tutorial-category-section.tsx only registers getting_started."
    why_human: "ICON_MAP key mismatch cannot be auto-resolved by grep alone — the route emits the correct keys and the component has a fallback, so no crash occurs, but the wrong icon renders for five of six categories."
  - test: "Navigate to /tutorials in a running dev environment and verify the page loads correctly for an authenticated user."
    expected: "Six category sections display, each with tutorial cards, progress indicators, and duration pills. Cards are clickable. Slug pages load a placeholder without 404."
    why_human: "End-to-end authenticated page behavior requires a live dev environment with seeded tutorial data and a valid session."
---

# Phase 72: Tutorial Browsing Verification Report

**Phase Goal:** Users can discover and browse all tutorials organized by category with visual progress indicators
**Verified:** 2026-03-20T23:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User navigates to /tutorials and sees tutorial cards grouped by six categories in fixed order | VERIFIED | `apps/web/src/app/(authenticated)/tutorials/page.tsx` calls `listTutorialsAction()` and renders `TutorialsBrowseView`. Route returns `CATEGORY_META` in locked order: getting_started, deal_workflows, touch_points, content_management, review, settings_admin |
| 2 | Each category section displays a completion percentage reflecting how many tutorials the user has watched | VERIFIED | `GET /tutorials` (index.ts:4177) computes per-user `watchedCount` and `completionPercent` from `prisma.tutorialView.findMany({ where: { userId } })`. Category section renders Progress component with `completionPercent` value |
| 3 | Each tutorial card shows title, description, duration, and a visual indicator of whether the user has watched it | VERIFIED | `tutorial-card.tsx` renders title, description, `formatDuration(durationSec)`, watched checkmark (`data-testid="watched-checkmark"`) when `watched === true`, and thumbnail or fallback shell. 11 Vitest tests confirm all states |
| 4 | Thumbnail URL stored on Tutorial model and served on browse cards | VERIFIED | `Tutorial.thumbnailUrl String?` in schema.prisma:269. Migration `20260320221000_add_tutorial_thumbnail_url` exists. Route maps `thumbnailUrl: t.thumbnailUrl ?? null` on each card payload |
| 5 | Card navigation lands on a valid placeholder route instead of 404 | VERIFIED | `apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx` calls `listTutorialsAction()`, finds tutorial by slug, calls `notFound()` for unknowns, renders placeholder for knowns |
| 6 | Thumbnail backfill workflow exists and writes manifest for seed consumption | VERIFIED | `apps/tutorials/scripts/upload-thumbnails.ts` (214 lines) extracts ffmpeg frames, uploads with gcloud CLI, writes `tutorial-thumbnails-manifest.json`. `seed.ts` reads manifest and merges `thumbnailUrl` into upserts |
| 7 | Browse data flows through the established agent -> api-client -> server action architecture | VERIFIED | `tutorial-actions.ts` calls `listTutorials()` from `api-client.ts` which calls `fetchJSON<TutorialBrowseResponse>("/tutorials")`. No direct Prisma access from the web app |
| 8 | GET /tutorials requires authentication (401 gate) | VERIFIED | Route handler calls `getVerifiedUserId(c, env.SUPABASE_URL)` and returns 401 if undefined. Test 5 in `tutorial-browse-route.test.ts` confirms 401 behavior |
| 9 | Seed backfill can populate thumbnailUrl from manifest without crashing when manifest is absent | VERIFIED | `seed.ts` checks `fs.existsSync(thumbnailManifestPath)` before reading; logs warning and continues with `thumbnailUrl: null` when absent |
| 10 | Route-level loading skeleton preserves aspect-video card layout during data fetch | VERIFIED | `loading.tsx` uses `<Skeleton className="aspect-video w-full rounded-none" />` in a matching grid layout |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/agent/prisma/schema.prisma` | Tutorial.thumbnailUrl nullable field | VERIFIED | Line 269: `thumbnailUrl String?` present |
| `apps/agent/prisma/migrations/20260320221000_add_tutorial_thumbnail_url/migration.sql` | Forward-only thumbnail migration | VERIFIED | Migration directory exists |
| `apps/tutorials/scripts/upload-thumbnails.ts` | Thumbnail extraction + gcloud upload helper (min 60 lines) | VERIFIED | 214 lines; ffmpeg extract at 1s, gcloud CLI upload, manifest write |
| `apps/agent/prisma/seed.ts` | Reads tutorial-thumbnails-manifest.json for backfill | VERIFIED | Lines 166-192 read manifest path, merge thumbnailUrl, handle missing manifest safely |
| `apps/agent/src/mastra/index.ts` | GET /tutorials browse endpoint | VERIFIED | `registerApiRoute("/tutorials", { method: "GET", ... })` at line 4177; contains `getVerifiedUserId` and `prisma.tutorial` |
| `apps/web/src/lib/api-client.ts` | TutorialBrowseResponse interface + listTutorials() helper | VERIFIED | Lines 1553-1580: `TutorialBrowseCard`, `TutorialBrowseCategory`, `TutorialBrowseResponse` interfaces; `listTutorials()` function |
| `apps/web/src/lib/actions/tutorial-actions.ts` | listTutorialsAction server action | VERIFIED | `"use server"` directive; `listTutorialsAction()` wraps `listTutorials()` |
| `apps/web/src/app/(authenticated)/tutorials/page.tsx` | Authenticated tutorials browse page | VERIFIED | `force-dynamic`, calls `listTutorialsAction()`, renders `TutorialsBrowseView` |
| `apps/web/src/components/tutorials/tutorial-card.tsx` | Clickable compact tutorial card | VERIFIED | `next/link` wrap, `next/image` for thumbnail, fallback shell, duration pill, watched checkmark |
| `apps/web/src/components/tutorials/tutorials-page-header.tsx` | Overall progress header with all-complete variant | VERIFIED | Renders "All {totalCount} tutorials completed!" when `isAllComplete`; Progress component wired |
| `apps/web/src/components/tutorials/tutorial-category-section.tsx` | Category section with icon map, progress bar | PARTIAL | Component exists and renders correctly. ICON_MAP only maps `getting_started: Rocket`; five other locked category keys (`deal_workflows`, `touch_points`, `content_management`, `review`, `settings_admin`) fall through to `Layers3` fallback |
| `apps/web/src/app/(authenticated)/tutorials/loading.tsx` | Route-level skeleton with aspect-video cards | VERIFIED | Aspect-video skeletons in matching grid; section header skeletons present |
| `apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx` | Placeholder slug route with notFound() | VERIFIED | Validates slug via `listTutorialsAction()`; `notFound()` for unknowns; placeholder UI for knowns |
| `apps/agent/src/mastra/__tests__/tutorial-browse-route.test.ts` | Route regression tests (5 tests) | VERIFIED | 5 tests covering: locked category order, per-user scoping, card payload shape, empty state, 401 gate |
| `apps/web/src/components/tutorials/__tests__/tutorials-browse-view.test.tsx` | UI component tests (11 tests) | VERIFIED | 11 tests covering: category render, complete accent, card fields, watched checkmark, thumbnail/fallback, link href, header progress, all-complete state, empty state |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/agent/src/mastra/index.ts` | `apps/agent/src/lib/request-auth.ts` | `getVerifiedUserId(c, env.SUPABASE_URL)` | WIRED | Line 4180: direct call, 401 returned if undefined |
| `apps/agent/src/mastra/index.ts` | `apps/agent/prisma/schema.prisma` | `prisma.tutorial.findMany + prisma.tutorialView.findMany` | WIRED | Lines 4197-4198: both queries present with userId-scoped views |
| `apps/web/src/lib/actions/tutorial-actions.ts` | `apps/web/src/lib/api-client.ts` | `listTutorials()` wrapper | WIRED | `tutorial-actions.ts` imports and calls `listTutorials()` |
| `apps/web/src/app/(authenticated)/tutorials/page.tsx` | `apps/web/src/lib/actions/tutorial-actions.ts` | `listTutorialsAction()` server component data fetch | WIRED | Page imports and awaits `listTutorialsAction()` in try/catch |
| `apps/web/src/components/tutorials/tutorial-card.tsx` | `apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx` | `next/link href=/tutorials/${slug}` | WIRED | Card wraps in `<Link href={\`/tutorials/${slug}\`}>` |
| `apps/web/src/app/(authenticated)/tutorials/loading.tsx` | `apps/web/src/components/tutorials/tutorial-card.tsx` | skeleton reserves aspect-video card layout | WIRED | `loading.tsx` uses `aspect-video` class matching card's thumbnail container |
| `apps/tutorials/scripts/upload-thumbnails.ts` | `apps/tutorials/output/tutorial-thumbnails-manifest.json` | writes slug-to-thumbnailUrl manifest | WIRED | `fs.writeFileSync(MANIFEST_PATH, ...)` at line 193; manifest committed with 17 entries |
| `apps/agent/prisma/seed.ts` | `apps/agent/prisma/schema.prisma` | `prisma.tutorial.upsert` with `thumbnailUrl` assignment | WIRED | seed.ts merges `thumbnailUrl` from manifest into each upsert call |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BROWSE-02 | 72-02, 72-03 | Tutorials page displays cards grouped by category (six named categories) | SATISFIED | Route returns six locked categories; page renders `TutorialCategorySection` per category; category keys match spec: getting_started, deal_workflows, touch_points, content_management, review, settings_admin |
| BROWSE-03 | 72-02, 72-03 | Each category group shows completion percentage based on user's watched tutorials | SATISFIED | Per-user `watchedCount / tutorialCount` math in route; `TutorialCategorySection` renders `Progress` with `completionPercent`; scoped to authenticated userId via `prisma.tutorialView.findMany({ where: { userId } })` |
| BROWSE-04 | 72-01, 72-02, 72-03 | Tutorial cards show title, description, duration, and watched/unwatched visual indicator | SATISFIED | `TutorialCard` renders all four fields; `watched` checkmark via `data-testid="watched-checkmark"`; `thumbnailUrl` field added to Tutorial model and surfaced in card payload |

**No orphaned requirements:** REQUIREMENTS.md maps BROWSE-02, BROWSE-03, BROWSE-04 exclusively to Phase 72. All three are satisfied. BROWSE-01 is correctly mapped to Phase 75 (sidebar nav item) and is out of scope for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/components/tutorials/tutorial-category-section.tsx` | 17-24 | ICON_MAP registers only `getting_started: Rocket`; five locked category keys (`deal_workflows`, `touch_points`, `content_management`, `review`, `settings_admin`) are absent — they silently fall through to `Layers3` fallback | WARNING | Visual: five of six categories render a generic icon. Plan 72-03 explicitly required distinct icons per locked category key. No runtime crash; `getIcon()` has a `?? Layers3` fallback. Does not break navigation, data display, or progress tracking. |
| `apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx` | 66-74 | "Video playback coming soon" placeholder notice | INFO | Intentional placeholder per plan spec. Phase 73 is designed to replace this. Not a defect. |

### Human Verification Required

#### 1. Category Icon Rendering

**Test:** Start the dev environment (`pnpm dev`), log in, navigate to `/tutorials`. Observe the icon displayed next to each of the six category section headers.

**Expected (per plan spec):** Getting Started = Rocket, Deal Workflows = Briefcase, Touch Points = Hand, Content Management = Layers3, Review = ClipboardCheck, Settings & Admin = Settings2.

**Actual (likely):** Getting Started shows Rocket. The other five categories (Deal Workflows, Touch Points, Content Management, Review, Settings & Admin) all show the generic Layers3 icon because their keys are absent from the ICON_MAP.

**Why human:** This is a visual rendering defect. Automated grep confirms the ICON_MAP omission but only a human can confirm what the user actually sees and whether the visual presentation is acceptable as-is or must be corrected before the phase is considered complete.

#### 2. End-to-end authenticated browse experience

**Test:** With tutorial data seeded in the dev database, navigate to `/tutorials` as an authenticated user. Verify: (a) six category sections are visible with tutorial cards, (b) clicking a card navigates to `/tutorials/[slug]` without 404, (c) the page header shows "0 of 17 completed" for a fresh user, (d) the loading skeleton appears briefly on first load.

**Expected:** All four behaviors work correctly with real data.

**Why human:** Requires a running dev environment with seeded tutorial rows, an active Supabase session, and the agent service running at the expected URL.

### Gaps Summary

All automated checks pass. All three phase requirements (BROWSE-02, BROWSE-03, BROWSE-04) are satisfied by substantive, wired implementations. All route, API-client, server action, and UI component artifacts exist and are connected.

One visual defect was found: the `ICON_MAP` in `tutorial-category-section.tsx` omits five of the six locked category keys. The Lucide icons `Briefcase`, `Hand`, `ClipboardCheck`, and `Settings2` are imported but never added to the map. This means five category sections fall through to the generic `Layers3` fallback. The plan spec (72-03 Task 1) explicitly required distinct icons per category: Rocket, Briefcase, Hand, Layers3, ClipboardCheck, Settings2. The fix is a four-line addition to the ICON_MAP.

This defect is visual-only and does not block any of the three BROWSE requirements or the three Success Criteria. Status is therefore `human_needed` — automated checks pass, but a human must decide whether to accept the generic icon fallback or require the ICON_MAP to be completed before the phase is marked shipped.

---

_Verified: 2026-03-20T23:40:00Z_
_Verifier: Claude (gsd-verifier)_
