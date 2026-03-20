# Project Research Summary

**Project:** AtlusDeck v1.10 — In-App Tutorials & Feedback
**Domain:** In-app tutorial video browsing, GCS-hosted MP4 playback, user progress tracking, and reusable feedback widget integrated into an existing Next.js 15 + Mastra + Prisma SaaS
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

AtlusDeck v1.10 adds a self-service learning layer to an established enterprise SaaS platform — 17 pre-rendered MP4 tutorial videos hosted on Google Cloud Storage, an in-app browse/playback experience, per-user watched state, and a reusable feedback widget. The expert approach for this class of feature is well-established: direct-serve video from a CDN (GCS public URLs) with native HTML5 `<video>` playback, binary watched/unwatched tracking per user via a lightweight DB model, and a segmented-control feedback widget backed by a polymorphic feedback table. None of these require new npm packages — the entire feature set builds on the existing dependency graph (Next.js 15, Prisma, shadcn/ui, googleapis, Supabase Auth).

The recommended implementation follows a strict dependency chain: Prisma migration first, then the GCS upload automation (which seeds the Tutorial table with public URLs) in parallel with the agent API routes, then the web Server Actions, then the UI components, and finally the sidebar integration. The architecture is deliberately minimal — Server Components fetch from the agent via `fetchAgent()`, Client Components handle optimistic state and video events, and the `FeedbackWidget` is made truly reusable via a `context`/`contextId` prop pattern with a polymorphic `AppFeedback` DB model.

The highest-risk areas are all infrastructure-level and front-loaded: GCS bucket CORS must be configured before the video player is built (byte-range requests require explicit `Range` header allowance), the correct service account (`VERTEX_SERVICE_ACCOUNT_KEY`, never `GOOGLE_SERVICE_ACCOUNT_KEY`) must be used for all GCS operations, and all three new Prisma models must be created via forward-only migration per CLAUDE.md discipline. If these three infrastructure gates are cleared in Phase 1 and Phase 2a, all subsequent UI phases are low-risk and follow well-established patterns already in the codebase.

---

## Key Findings

### Recommended Stack

v1.10 requires zero new npm packages in `apps/web`. All capabilities are achievable with the existing stack. The one new component is a `shadcn/ui` `toggle-group` (generated via `pnpm dlx shadcn@latest add toggle-group`) — this uses the already-installed unified `radix-ui` package (Feb 2026 update) and adds no new dependency. The GCS upload automation runs as a standalone `tsx` script in `apps/tutorials/scripts/` and reuses the `googleapis` REST client already in `apps/agent`.

**Core technologies:**
- `googleapis` (existing, `^144.0.0`): GCS upload via `google.storage({ version: "v1", auth })` — same pattern as production `gcs-thumbnails.ts`; no new SDK
- Native HTML5 `<video>` (browser API): MP4 playback — Next.js recommends native `<video>` for directly-served files; no `react-player` or `video.js` needed for public GCS URLs
- Prisma (existing, `^6.3.1`): Three new models (`Tutorial`, `TutorialView`, `AppFeedback`) via forward-only migration; stay on 6.x (Prisma 7.x has vector migration regression)
- `shadcn/ui` ToggleGroup (new component file, no new npm package): Segmented control for feedback — wraps `@radix-ui/react-toggle-group`, fully Tailwind-compatible
- Sonner, Supabase Auth, Next.js Server Actions (all existing): reused for feedback toasts, userId auth, and data mutations

### Expected Features

**Must have (table stakes — v1.10 launch):**
- GCS upload automation uploading all 17 MP4s and storing public URLs in the `Tutorial` table
- Tutorials browse page (`/tutorials`) with category-grouped, sequentially-ordered tutorial cards
- Tutorials nav item in sidebar with "New" dot badge (dot, not count — avoids badge fatigue)
- In-browser MP4 player using native `<video controls>` on a dedicated `/tutorials/[id]` page
- `TutorialView` model: record `userId + tutorialId + watchedAt` on video `ended` event via Server Action
- Watched visual state on tutorial cards (checkmark overlay or "Watched" label)
- `AppFeedback` model with segmented control (helpful/not-helpful/bug/suggestion) + optional free-text textarea

**Should have (add after validation — v1.x):**
- Category progress indicator ("3 of 6 watched") — drives momentum without a full LMS
- "Next unwatched" nudge per category — reduces decision friction after partial progress
- Feedback widget extended to other feature pages (Settings, Templates, Deals) after tutorial feedback proves the model

**Defer (v2+):**
- Custom video player with speed control or chapter navigation
- Resume-from-timestamp (unnecessary for 1-5 min tutorials)
- In-app admin video upload UI (CLI script covers the ~20-seller authoring case)
- Email/push notifications for new tutorials

### Architecture Approach

The architecture follows strict layering already established in the codebase: Server Components load data via Server Actions that call `fetchAgent()` to the Mastra Hono agent, which queries Prisma. Client Components (`TutorialsClient`, `TutorialPlayer`, `FeedbackWidget`) handle only interactivity — optimistic watched-state toggles, video event handling, and form state. Video playback is direct-from-GCS (Browser to GCS; no Vercel function in the path). The `FeedbackWidget` is made genuinely reusable via `sourceType`/`sourceId` props backed by the polymorphic `AppFeedback` model. The sidebar "New" badge follows the existing `pendingCount` pattern: a Next.js API route polled via `useEffect` in the Client Component sidebar.

**Major components:**
1. `Tutorial` / `TutorialView` / `AppFeedback` Prisma models — source of truth for all feature data; forward-only migration required before any other code can reference them
2. `upload-to-gcs.ts` script — reads `apps/tutorials/output/videos/*.mp4`, uploads to GCS, upserts `Tutorial` rows; the first-dependency gate for playable video
3. Agent routes (5 GET/POST endpoints) + `tutorial-repo.ts` / `feedback-repo.ts` — data layer; isolated repo files keep `mastra/index.ts` manageable
4. `tutorial-actions.ts` / `feedback-actions.ts` — Server Actions wrapping `fetchAgent()` calls; identical pattern to all existing pages
5. `TutorialsClient` / `TutorialCard` / `TutorialPlayer` / `FeedbackWidget` — client-side components; `TutorialPlayer` must be `"use client"` with `dynamic({ ssr: false })`
6. `sidebar.tsx` (modified) + `/api/tutorials/new-badge` route — badge integration following existing `pendingCount` useEffect pattern

### Critical Pitfalls

1. **Wrong GCS service account** — use `VERTEX_SERVICE_ACCOUNT_KEY` for all storage operations; `GOOGLE_SERVICE_ACCOUNT_KEY` has no `devstorage` permissions and will 403 in production; add a grep check on PRs to catch this in any new GCS utility file
2. **GCS bucket CORS not configured for `Range` header** — HTML5 `<video>` issues byte-range requests; configure bucket CORS via `gcloud storage buckets update --cors-file cors.json` with `Range` and `Accept-Ranges` in `responseHeader`; cannot use Google Cloud Console for this
3. **HTML5 `<video>` in Server Component causing hydration mismatch** — always wrap video elements in `"use client"` and use `dynamic(() => import('./TutorialPlayer'), { ssr: false })`; failure causes a blank tutorial page
4. **`prisma db push` bypassing migration history** — always use `prisma migrate dev --name <name>` per CLAUDE.md; `db push` causes schema drift that breaks CircleCI `migrate deploy` on Supabase
5. **Progress tracking on `timeupdate` flooding the DB** — `timeupdate` fires ~4Hz; attach the Server Action call to the `ended` event only; the `TutorialView` model is binary watched/unwatched, not continuous progress

---

## Implications for Roadmap

The build order has a strict sequential core with one parallel opportunity after Phase 1. Research identifies 6 natural phases.

### Phase 1: Database Foundation
**Rationale:** Every downstream feature depends on the Prisma schema being in place. No code can reference `Tutorial`, `TutorialView`, or `AppFeedback` before the migration runs. This is also where the highest-severity pitfall (`db push`) must be guarded against.
**Delivers:** Three new Prisma models (`Tutorial`, `TutorialView`, `AppFeedback`) with correct indexes, forward-only migration file committed to git alongside the schema change
**Addresses:** Scaffolds the DB for all P1 features; establishes group/sortOrder design for tutorial catalog
**Avoids:** Prisma migration drift (PITFALLS Pitfall 4)

### Phase 2a: GCS Upload Automation
**Rationale:** Can run in parallel with Phase 2b. Seeds the `Tutorial` table with real GCS URLs that all UI phases depend on for playable video. Bucket CORS and IAM must be verified before marking complete — these block the video player, not just the script.
**Delivers:** `apps/tutorials/scripts/upload-to-gcs.ts` uploading all 17 MP4s with idempotent upsert; bucket CORS configured with `Range` header; IAM `allUsers objectViewer` binding verified; 17 Tutorial rows in DB with valid `gcsUrl`
**Addresses:** FEATURES GCS upload automation + DB seeding (P1)
**Avoids:** Wrong service account (Pitfall 1), CORS not configured (Pitfall 2), bucket not publicly readable (Pitfall 7), Vercel video proxying (Pitfall 5)

### Phase 2b: Agent API Routes
**Rationale:** Parallel with Phase 2a. No dependency on real GCS URLs — routes can be tested with seeded fixture data. Establishes the data layer before the web layer is built.
**Delivers:** 5 new agent routes (`GET /tutorials`, `GET /tutorials/:id`, `GET /tutorials/new-badge`, `POST /tutorials/:id/view`, `POST /feedback`) plus `tutorial-repo.ts` and `feedback-repo.ts`
**Addresses:** Data API for all P1 features
**Avoids:** Inline group/segment strings scattered across files (ARCHITECTURE Anti-Pattern 5)

### Phase 3: Web Server Actions and API Client
**Rationale:** Depends on Phase 2b (agent routes must be registered before Server Actions call them). This is the web-side data layer — mirrors the existing `action-required-actions.ts` pattern exactly.
**Delivers:** `tutorial-actions.ts`, `feedback-actions.ts`, and additions to `api-client.ts` (`fetchTutorials`, `markTutorialViewed`, `submitFeedback`, `fetchTutorialNewBadge`)
**Uses:** Server Actions pattern, `fetchAgent()` wrapper, Supabase session auth for userId
**Avoids:** Client-side data fetching for initial load (ARCHITECTURE Anti-Pattern 3)

### Phase 4: Tutorial Browse and Player UI
**Rationale:** Depends on Phase 3 (Server Actions) and Phase 2a (real GCS URLs for playable video). This is the core user-facing deliverable — the tutorials browse page and video player with watched state.
**Delivers:** `app/(authenticated)/tutorials/page.tsx`, `app/(authenticated)/tutorials/[id]/page.tsx`, `TutorialsClient`, `TutorialCard`, `TutorialPlayer`; optimistic watched/unwatched state toggling on video `ended` event
**Addresses:** FEATURES tutorial list page, MP4 player, watched/unwatched state (all P1)
**Avoids:** SSR hydration mismatch (Pitfall 3), `timeupdate` DB flood (Pitfall 6), Vercel video proxying (Pitfall 5)

### Phase 5: Feedback Widget
**Rationale:** Depends on Phase 3 (feedback Server Action) and Phase 4 (player page to host the widget). Deliberately isolated because the reusable `FeedbackWidget` has a state management nuance — the `key={tutorialId}` prop reset pattern — that is easier to verify in isolation before integrating into the player page.
**Delivers:** `FeedbackWidget` component (shadcn/ui ToggleGroup segmented control + Textarea + submit), wired to `submitFeedbackAction`; `toggle-group` component added via `pnpm dlx shadcn@latest add toggle-group`; Sonner toast confirmation
**Addresses:** FEATURES feedback widget (P1)
**Avoids:** Feedback state leaking across tutorials (Pitfall 8), feedback userId spoofing (PITFALLS security section)

### Phase 6: Sidebar Integration
**Rationale:** Must come last — the Tutorials nav item links to `/tutorials` which must exist (Phase 4). The "New" badge polls `/api/tutorials/new-badge` which depends on Phase 3. Modifying the sidebar last minimizes risk to global navigation during development.
**Delivers:** Tutorials nav item in `sidebar.tsx`, "New" dot badge via `useEffect` + `/api/tutorials/new-badge/route.ts`; badge-clear logic on tutorials page visit
**Addresses:** FEATURES sidebar nav item, "New" badge (P1)
**Avoids:** Calling Server Actions from the Client Component sidebar (ARCHITECTURE Anti-Pattern 6)

### Phase Ordering Rationale

- Phases 2a and 2b are the only true parallel opportunity — both depend only on the Prisma migration (Phase 1) being applied and are independent of each other
- Phases 3 through 6 are strictly sequential: Server Actions depend on agent routes, UI depends on Server Actions, sidebar depends on the destination page existing
- GCS infrastructure concerns (CORS, IAM, service account) are front-loaded into Phase 2a so they cannot block later UI phases mid-sprint
- The `FeedbackWidget` is a separate phase (5) from the browse/player UI (4) to isolate the React state management concern (`key` prop reset) from the data loading complexity

### Research Flags

Phases that need pre-implementation verification:
- **Phase 2a (GCS Upload):** Verify whether the target bucket uses uniform bucket-level access or legacy ACLs before deciding on `predefinedAcl` vs IAM binding strategy; also verify if the existing `GCS_THUMBNAIL_BUCKET` CORS already includes `Range` headers before creating a separate video bucket
- **Phase 6 (Sidebar Badge):** Confirm the "New" badge clear strategy — localStorage heuristic vs. a `lastTutorialVisitAt` timestamp on User — and whether the latter requires an additional Prisma migration

Phases with standard patterns (skip research-phase during planning):
- **Phase 1 (Database Foundation):** Prisma forward-only migration is fully documented and already practiced in this codebase; models follow established conventions
- **Phase 2b (Agent Routes):** `registerApiRoute` pattern is well-established in `mastra/index.ts`; repo isolation is a straightforward refactor
- **Phase 3 (Server Actions):** Identical to existing `action-required-actions.ts` pattern; no new patterns required
- **Phase 4 (Tutorial UI):** Server Component + Client Component split is established; native `<video>` with `dynamic({ ssr: false })` is the documented Next.js pattern
- **Phase 5 (Feedback Widget):** shadcn/ui `ToggleGroup` is documented; `key` prop reset is standard React

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings based on direct codebase inspection + official Next.js, shadcn/ui, and Radix docs; zero new packages required eliminates version conflict risk |
| Features | HIGH | 17 MP4s already produced from v1.9; feature scope is bounded and well-understood; competitor analysis (Loom, Intercom) confirms expected UX patterns |
| Architecture | HIGH | Based on direct inspection of 8 existing source files in the running codebase; no inference from generic patterns |
| Pitfalls | HIGH | All 8 critical pitfalls verified via official GCS docs, Next.js GitHub discussions, Prisma docs, and codebase analysis; each has a documented recovery strategy |

**Overall confidence:** HIGH

### Gaps to Address

- **GCS bucket configuration:** Research confirms the CORS and IAM patterns but cannot determine without inspecting the GCP console whether to reuse `GCS_THUMBNAIL_BUCKET` or create a dedicated `GCS_TUTORIAL_BUCKET`. Resolve at the start of Phase 2a.
- **Tutorial group/sortOrder mapping:** The upload script must derive `group` and `sortOrder` from the 17 fixture slugs (e.g., `getting-started-01` → group "Core", order 1). Verify the exact slug naming convention in `apps/tutorials/fixtures/` before Phase 2a implementation.
- **"New" badge clear strategy:** Two approaches are viable — clear on first visit to `/tutorials` (requires tracking visit timestamp) or use a 14-day window heuristic (no schema change). Decide in Phase 6 planning; the heuristic approach avoids an additional migration.

---

## Sources

### Primary (HIGH confidence — official docs + codebase)
- `apps/agent/src/lib/gcs-thumbnails.ts` — GCS upload pattern with `VERTEX_SERVICE_ACCOUNT_KEY`
- `apps/agent/src/mastra/index.ts` — `registerApiRoute` conventions and route family patterns
- `apps/web/src/components/sidebar.tsx` — badge pattern via `useEffect` + `fetch`
- `apps/agent/prisma/schema.prisma` — model naming, index patterns, migration history
- `apps/web/src/lib/actions/action-required-actions.ts` — Server Action pattern for agent calls
- `apps/web/src/lib/api-client.ts` — `fetchAgent()` wrapper with Bearer JWT
- `apps/tutorials/fixtures/*/script.json` — 17 tutorial metadata structures confirmed
- [Next.js Video Guide](https://nextjs.org/docs/app/guides/videos) — native `<video>` recommendation, `preload`, `dynamic({ ssr: false })`
- [shadcn/ui Toggle Group docs](https://ui.shadcn.com/docs/components/radix/toggle-group) — install command, `type="single"` segmented control behavior
- [GCS CORS Configuration](https://docs.cloud.google.com/storage/docs/using-cors) — `Range` header requirement, `gcloud` CLI pattern; Console cannot configure CORS
- [GCS Uniform Bucket-Level Access](https://docs.cloud.google.com/storage/docs/uniform-bucket-level-access) — IAM vs ACL model, `allUsers objectViewer` binding
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) — 10s/60s timeout, 4.5MB body limit confirms no video proxying via functions
- CLAUDE.md — `VERTEX_SERVICE_ACCOUNT_KEY` for all paid GCP services; `prisma migrate dev` forward-only discipline

### Secondary (MEDIUM confidence — community + multi-source)
- [Prisma db push reset issue #16141](https://github.com/prisma/prisma/discussions/16141) — confirmed drift risk from `db push`
- [Next.js Hydration Mismatch Discussion #53020](https://github.com/vercel/next.js/discussions/53020) — `<video>` element as hydration mismatch cause in App Router
- [MDN: HTMLMediaElement timeupdate event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event) — ~4Hz fire rate confirmed; throttle required for server calls

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
