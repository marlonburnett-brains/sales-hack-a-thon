# Architecture Research

**Domain:** In-app tutorial browsing, MP4 video playback, user progress tracking, and reusable feedback — integrated into an existing Next.js 15 / Mastra Hono monorepo
**Researched:** 2026-03-20
**Confidence:** HIGH (based on direct codebase inspection of the target app)

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         apps/web (Next.js 15, Vercel)                     │
├──────────────────────────────────────────────────────────────────────────┤
│  app/(authenticated)/tutorials/                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐    │
│  │  page.tsx        │  │  [id]/page.tsx   │  │  components/           │    │
│  │  (browse grid)   │  │  (video player)  │  │  TutorialCard          │    │
│  │                  │  │                  │  │  TutorialPlayer        │    │
│  │  Server Component│  │  Server Component│  │  TutorialsClient       │    │
│  │  loads Tutorial[]│  │  loads single    │  │  FeedbackWidget        │    │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────────────────┘    │
│           │                     │                                           │
│           ▼                     ▼                                           │
│  lib/actions/tutorial-actions.ts   lib/actions/feedback-actions.ts         │
│  (Server Actions — auth + agent call)                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                         lib/api-client.ts (fetchAgent wrapper)             │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS / Bearer JWT
┌───────────────────────────────▼──────────────────────────────────────────┐
│                     apps/agent (Mastra Hono, Railway)                      │
├──────────────────────────────────────────────────────────────────────────┤
│  mastra/index.ts — registerApiRoute                                        │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │  GET  /tutorials          — list all with per-user watched state  │      │
│  │  GET  /tutorials/:id      — single tutorial + watched state       │      │
│  │  POST /tutorials/:id/view — mark tutorial as viewed               │      │
│  │  POST /feedback           — submit segmented + free-text feedback │      │
│  └──────────────────────────────────────────────────────────────────┘      │
├──────────────────────────────────────────────────────────────────────────┤
│  lib/tutorial-repo.ts    lib/feedback-repo.ts                              │
│  (Prisma query functions, isolated from index.ts)                          │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ Prisma
┌───────────────────────────────▼──────────────────────────────────────────┐
│                  Supabase PostgreSQL                                        │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────────┐    │
│  │  Tutorial     │   │  TutorialView    │   │  AppFeedback           │    │
│  │  (metadata    │   │  (per-user       │   │  (segmented control +  │    │
│  │   + GCS URL)  │   │   watch state)   │   │   free-text, poly-     │    │
│  └──────────────┘   └──────────────────┘   │   morphic by source)   │    │
│                                             └────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────────┐
│  Google Cloud Storage (VERTEX_SERVICE_ACCOUNT_KEY — never GOOGLE_SA_KEY)  │
│  Bucket: atlusdeck-tutorials                                               │
│  Object path: tutorials/{id}.mp4                                           │
│  ACL: publicRead per object                                                │
│  Public URL: https://storage.googleapis.com/{bucket}/tutorials/{id}.mp4   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Lives In |
|-----------|----------------|----------|
| `Tutorial` Prisma model | Source of truth for title, description, GCS URL, group label, sort order, `isNew` flag | `apps/agent/prisma/schema.prisma` |
| `TutorialView` Prisma model | Per-user watched/unwatched state; one row per (userId, tutorialId) | `apps/agent/prisma/schema.prisma` |
| `AppFeedback` Prisma model | Polymorphic feedback rows: segment label, free-text, source context (tutorial ID or feature slug) | `apps/agent/prisma/schema.prisma` |
| Agent tutorial routes | GET /tutorials, GET /tutorials/:id, POST /tutorials/:id/view | `apps/agent/src/mastra/index.ts` |
| Agent feedback route | POST /feedback | `apps/agent/src/mastra/index.ts` |
| `tutorial-repo.ts` | Prisma query functions for Tutorial + TutorialView | `apps/agent/src/lib/` |
| `feedback-repo.ts` | Prisma query functions for AppFeedback | `apps/agent/src/lib/` |
| `tutorial-actions.ts` | Server Actions wrapping agent calls; used by Server Components | `apps/web/src/lib/actions/` |
| `feedback-actions.ts` | Server Actions for feedback submission | `apps/web/src/lib/actions/` |
| `app/(authenticated)/tutorials/page.tsx` | Server Component — fetches tutorial list + user view states, renders grid | `apps/web/src/app/(authenticated)/tutorials/` |
| `app/(authenticated)/tutorials/[id]/page.tsx` | Server Component — fetches single tutorial, renders player + feedback | `apps/web/src/app/(authenticated)/tutorials/[id]/` |
| `TutorialsClient` | Client Component — grid with optimistic watched state toggle | `apps/web/src/components/tutorials/` |
| `TutorialCard` | Shows title, group label, duration, watched badge | `apps/web/src/components/tutorials/` |
| `TutorialPlayer` | `<video>` element with `src={gcsUrl}`, controls; fires view action once on play | `apps/web/src/components/tutorials/` |
| `FeedbackWidget` | Segmented control + free-text textarea + submit; reusable by source | `apps/web/src/components/tutorials/` |
| `/api/tutorials/new-badge` Next.js route | Returns `{ hasNew: boolean }` for sidebar badge | `apps/web/src/app/api/tutorials/new-badge/route.ts` |
| `sidebar.tsx` | MODIFIED: adds Tutorials nav item + "New" badge via existing useEffect pattern | `apps/web/src/components/sidebar.tsx` |
| `upload-to-gcs.ts` script | Reads `apps/tutorials/output/videos/*.mp4`, uploads to GCS, upserts Tutorial rows in DB | `apps/tutorials/scripts/` |

---

## Recommended Project Structure

New files and modifications only:

```
apps/agent/
├── prisma/
│   └── schema.prisma                       # MODIFIED: +Tutorial +TutorialView +AppFeedback
├── prisma/migrations/
│   └── YYYYMMDD_add_tutorial_models/
│       └── migration.sql                   # NEW: forward-only migration
└── src/
    ├── lib/
    │   ├── tutorial-repo.ts                # NEW: Prisma queries for Tutorial + TutorialView
    │   └── feedback-repo.ts                # NEW: Prisma queries for AppFeedback
    └── mastra/
        └── index.ts                        # MODIFIED: +4 new registerApiRoute calls

apps/web/
└── src/
    ├── app/
    │   ├── (authenticated)/
    │   │   └── tutorials/
    │   │       ├── page.tsx                # NEW: Server Component browse page
    │   │       ├── tutorials-client.tsx    # NEW: Client Component grid
    │   │       └── [id]/
    │   │           └── page.tsx            # NEW: Server Component player page
    │   └── api/
    │       └── tutorials/
    │           └── new-badge/
    │               └── route.ts            # NEW: badge poll endpoint for sidebar
    ├── components/
    │   ├── tutorials/
    │   │   ├── tutorial-card.tsx           # NEW
    │   │   ├── tutorial-player.tsx         # NEW
    │   │   └── feedback-widget.tsx         # NEW (reusable)
    │   └── sidebar.tsx                     # MODIFIED: +nav item +badge
    └── lib/
        └── actions/
            ├── tutorial-actions.ts         # NEW: Server Actions
            └── feedback-actions.ts         # NEW: Server Actions

apps/tutorials/
└── scripts/
    └── upload-to-gcs.ts                    # NEW: GCS upload automation
```

---

## New Prisma Models

### Tutorial

```prisma
// ─────────────────────────────────────────────────────────
// v1.10: In-App Tutorial Videos
// ─────────────────────────────────────────────────────────

model Tutorial {
  id          String         @id              // matches fixture id: "getting-started"
  title       String
  description String
  group       String                          // "Core" | "Deals" | "Touches" | "Advanced"
  sortOrder   Int                             // within group
  gcsUrl      String                          // https://storage.googleapis.com/...
  durationSec Int?                            // populated at upload time
  isNew       Boolean        @default(true)   // cleared after 14 days or manual toggle
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  views       TutorialView[]

  @@index([group, sortOrder])
}
```

### TutorialView

```prisma
model TutorialView {
  id         String   @id @default(cuid())
  userId     String                          // Supabase user ID
  tutorialId String
  tutorial   Tutorial @relation(fields: [tutorialId], references: [id])
  watchedAt  DateTime @default(now())

  @@unique([userId, tutorialId])             // upsert-safe: re-watching doesn't dupe
  @@index([userId])
  @@index([tutorialId])
}
```

**Design rationale:** One row per (userId, tutorialId). The `@@unique` constraint means `prisma.tutorialView.upsert()` is idempotent — re-watching a tutorial updates `watchedAt` without creating a duplicate. The `userId` is the Supabase user ID extracted from the verified JWT, consistent with how all other user-scoped data (UserGoogleToken, UserAtlusToken, UserSetting) stores identity.

### AppFeedback

```prisma
model AppFeedback {
  id         String   @id @default(cuid())
  userId     String                          // Supabase user ID
  segment    String                          // "tutorial_feedback" | "feature_feedback"
  sourceType String                          // "tutorial" | "feature"
  sourceId   String?                         // tutorial id or feature slug (no FK — not all sources are DB entities)
  freeText   String                          // required, min 1 char
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([segment])
  @@index([sourceType, sourceId])
}
```

**Design rationale:** Polymorphic by `sourceType`/`sourceId` rather than separate models. This makes `FeedbackWidget` genuinely reusable across the tutorials page and any future feature feedback surface — the widget just passes `{ sourceType: "tutorial", sourceId: tutorialId }` or `{ sourceType: "feature", sourceId: "deck-structures" }`. No FK constraint on `sourceId` since feature slugs are not DB-backed entities.

---

## Architectural Patterns

### Pattern 1: Server Component → Server Action → fetchAgent

**What:** All data-loading pages in this app are Server Components. They call Server Actions (in `lib/actions/`), which call `fetchAgent()` from `api-client.ts`, which hits the Mastra Hono server. This exact pattern is used by every existing page (deals, templates, slides, discovery, actions) and must be followed without exception.

**When to use:** All tutorial list and detail pages. Never use `useEffect` + `fetch` for initial data loading.

**Example (mirroring existing actions page pattern):**

```typescript
// apps/web/src/app/(authenticated)/tutorials/page.tsx
export const dynamic = "force-dynamic";

export default async function TutorialsPage() {
  const tutorials = await listTutorialsAction();
  return <TutorialsClient initialTutorials={tutorials} />;
}
```

```typescript
// apps/web/src/lib/actions/tutorial-actions.ts
"use server";
import { fetchTutorials } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/server";

export async function listTutorialsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return fetchTutorials(user?.id);
}

export async function markTutorialViewedAction(tutorialId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await markTutorialViewed(tutorialId, user.id);
  revalidatePath("/tutorials");
}
```

### Pattern 2: Client Component with Optimistic View Tracking

**What:** The "watched" badge flips immediately on play (optimistic update via `useState`), then a `startTransition` + Server Action records it in the DB asynchronously. No loading spinner for a non-critical tracking event.

**When to use:** `TutorialPlayer` fires this once per session (guarded by `useRef<boolean>`).

**Trade-offs:** If the Server Action fails, the badge shows watched=true but no DB row exists. Acceptable trade-off for view tracking — it is not a financial transaction. The badge reverts on next page load if the action failed.

```tsx
// apps/web/src/components/tutorials/tutorial-player.tsx
"use client";
import { useRef, startTransition } from "react";

export function TutorialPlayer({
  src,
  onViewed,
}: {
  src: string;
  onViewed: () => void;
}) {
  const hasTracked = useRef(false);

  function handlePlay() {
    if (hasTracked.current) return;
    hasTracked.current = true;
    startTransition(() => { onViewed(); });
  }

  return (
    <video
      src={src}
      controls
      className="w-full rounded-lg"
      onPlay={handlePlay}
    />
  );
}
```

### Pattern 3: Native `<video>` Element — No Third-Party Player

**What:** Standard HTML5 `<video controls>` with `src` pointing directly to the public GCS URL. No react-player, video.js, or iframe embed.

**When to use:** This is the correct and only approach for this use case. Files are public GCS MP4s ranging from 5–20MB. The native video element handles buffering, keyboard shortcuts (space to pause, arrow keys), fullscreen, and responsive sizing across all modern browsers.

**Why not a library:** Adding a 50–200KB JS video player library to wrap a `<video>` tag is pure overhead. There is no adaptive bitrate requirement, no chapter navigation, no analytics SDK — nothing that would justify a third-party dependency.

### Pattern 4: GCS Upload via googleapis — Not @google-cloud/storage

**What:** The existing GCS integration (`apps/agent/src/lib/gcs-thumbnails.ts`) uses `google.storage({ version: "v1", auth })` from the `googleapis` package — not the `@google-cloud/storage` npm package. The upload script must reuse this exact pattern.

**Why:** The `googleapis` package is already a dependency in `apps/agent`. Using `@google-cloud/storage` would add a second GCS SDK with a different API surface and additional bundle weight. The existing `getStorageClient()` factory in `gcs-thumbnails.ts` should be extracted to a shared lib function and reused.

**Credential requirement:** `VERTEX_SERVICE_ACCOUNT_KEY` — never `GOOGLE_SERVICE_ACCOUNT_KEY`. GCS is a paid GCP service. This constraint is in CLAUDE.md.

```typescript
// apps/tutorials/scripts/upload-to-gcs.ts (outline)
// 1. For each apps/tutorials/output/videos/{id}.mp4:
//    a. Derive tutorialId from filename (strip .mp4)
//    b. Read apps/tutorials/fixtures/{id}/script.json -> { title, description }
//    c. Derive group from tutorialId prefix (getting-started -> "Core", deals -> "Deals", etc.)
//    d. Upload to GCS: bucket=atlusdeck-tutorials, key=tutorials/{id}.mp4
//       - contentType: video/mp4
//       - predefinedAcl: publicRead
//    e. Upsert Tutorial row in DB via Prisma:
//       { id, title, description, group, sortOrder, gcsUrl, isNew: true }
// 2. Print summary table of uploaded tutorials + public URLs
```

### Pattern 5: Sidebar "New" Badge via API Route + useEffect

**What:** The existing `Action Required` badge in `sidebar.tsx` uses `useEffect(() => fetch("/api/actions/count"), [pathname])`. The Tutorials "New" badge follows the exact same pattern: a Next.js API route (`/api/tutorials/new-badge`) calls the agent or queries the DB to return `{ hasNew: boolean }`.

**Why an API route instead of a Server Action:** The sidebar is a Client Component (`"use client"`). Client Components cannot call Server Actions directly for side-effect-free reads — they must use a fetch to a Route Handler. The existing `pendingCount` implementation proves this pattern works.

```typescript
// apps/web/src/app/api/tutorials/new-badge/route.ts
import { NextResponse } from "next/server";
import { fetchTutorialNewBadge } from "@/lib/api-client";

export async function GET() {
  const { hasNew } = await fetchTutorialNewBadge();
  return NextResponse.json({ hasNew });
}
```

Then in `sidebar.tsx`, add alongside the existing `pendingCount` useEffect:
```typescript
const [hasNewTutorials, setHasNewTutorials] = useState(false);
useEffect(() => {
  fetch("/api/tutorials/new-badge")
    .then(r => r.json())
    .then((d: { hasNew?: boolean }) => setHasNewTutorials(d.hasNew ?? false))
    .catch(() => {});
}, [pathname]);
```

---

## Data Flow

### Tutorial Browse Flow

```
User navigates to /tutorials
    ↓
TutorialsPage (Server Component)
    ↓ calls
listTutorialsAction() (Server Action)
    ↓ calls
fetchAgent("GET /tutorials?userId=...")
    ↓ agent queries
prisma.tutorial.findMany({ include: { views: { where: { userId } } } })
    ↓ returns
Tutorial[] each with { ...tutorial, watched: boolean }
    ↓
TutorialsClient renders grouped grid
    groupBy(tutorial.group), sortBy(tutorial.sortOrder)
    ↓
TutorialCard per tutorial
    watched badge if TutorialView exists for current user
    "NEW" badge if tutorial.isNew
```

### Video Play + View Tracking Flow

```
User clicks play on <video> element
    ↓
TutorialPlayer.handlePlay() fires (once per session, guarded by useRef)
    ↓ startTransition (non-blocking)
markTutorialViewedAction(tutorialId) (Server Action)
    ↓ calls
fetchAgent("POST /tutorials/:id/view", { userId })
    ↓ agent executes
prisma.tutorialView.upsert({
  where: { userId_tutorialId: { userId, tutorialId } },
  create: { userId, tutorialId, watchedAt: new Date() },
  update: { watchedAt: new Date() }
})
    ↓ background
revalidatePath("/tutorials")   // badge updates on next navigation
```

### Feedback Submission Flow

```
User selects segment + types text + clicks Submit
    ↓
FeedbackWidget (Client Component) — optimistic "Submitting..." state
    ↓ startTransition
submitFeedbackAction({ segment, sourceType, sourceId, freeText }) (Server Action)
    ↓ calls
fetchAgent("POST /feedback", { userId, segment, sourceType, sourceId, freeText })
    ↓ agent executes
prisma.appFeedback.create({ data: { userId, segment, sourceType, sourceId, freeText } })
    ↓ returns
{ success: true }
    ↓
Widget resets to empty state + fires toast("Thanks for your feedback!", { id: "feedback" })
```

### GCS Upload Automation Flow

```
Developer runs: pnpm --filter tutorials tsx scripts/upload-to-gcs.ts
    ↓
Read: apps/tutorials/output/videos/*.mp4 (17 files)
    ↓ for each file
  Derive tutorialId from filename (strip .mp4)
  Read fixtures/{id}/script.json → { title, description }
  Derive group + sortOrder from tutorialId
    ↓
  Upload to GCS:
    bucket: process.env.GCS_TUTORIALS_BUCKET
    key: tutorials/{id}.mp4
    contentType: video/mp4
    predefinedAcl: publicRead
    → publicUrl: https://storage.googleapis.com/{bucket}/tutorials/{id}.mp4
    ↓
  Prisma upsert Tutorial row:
    { id, title, description, group, sortOrder, gcsUrl, durationSec, isNew: true }
    (upsert: update gcsUrl if id exists — idempotent re-runs)
    ↓
Print: ✓ 17 tutorials uploaded
       Table of { id, group, url }
```

### Sidebar "New" Badge Refresh Flow

```
User navigates to any page (pathname changes)
    ↓
sidebar.tsx useEffect([pathname]) fires
    ↓
fetch("/api/tutorials/new-badge")
    ↓
Next.js route: GET /api/tutorials/new-badge
    ↓
fetchAgent("GET /tutorials/new-badge")
    ↓
agent: prisma.tutorial.count({ where: { isNew: true } }) > 0
    ↓
{ hasNew: true/false }
    ↓
sidebar renders green dot on Tutorials nav item if hasNew
```

---

## Integration Points

### New vs Modified

| Item | New or Modified | Details |
|------|-----------------|---------|
| `Tutorial` Prisma model | NEW | Requires `prisma migrate dev --name add-tutorial-models` |
| `TutorialView` Prisma model | NEW | Same migration |
| `AppFeedback` Prisma model | NEW | Same migration |
| `GCS_TUTORIALS_BUCKET` env var | NEW | Added to `apps/agent/src/env.ts` — separate from GCS_THUMBNAIL_BUCKET |
| `GET /tutorials` agent route | NEW | Returns Tutorial[] with per-user watched flag |
| `GET /tutorials/:id` agent route | NEW | Single tutorial + watched flag |
| `GET /tutorials/new-badge` agent route | NEW | Returns `{ hasNew: boolean }` |
| `POST /tutorials/:id/view` agent route | NEW | Upserts TutorialView |
| `POST /feedback` agent route | NEW | Creates AppFeedback row |
| `tutorial-repo.ts` | NEW | Prisma query functions |
| `feedback-repo.ts` | NEW | Prisma query functions |
| `tutorial-actions.ts` | NEW | Server Actions |
| `feedback-actions.ts` | NEW | Server Actions |
| `app/(authenticated)/tutorials/page.tsx` | NEW | Browse page |
| `app/(authenticated)/tutorials/[id]/page.tsx` | NEW | Player page |
| `TutorialsClient` component | NEW | Optimistic client component |
| `TutorialCard` component | NEW | |
| `TutorialPlayer` component | NEW | |
| `FeedbackWidget` component | NEW | |
| `/api/tutorials/new-badge` route | NEW | Next.js Route Handler for sidebar |
| `sidebar.tsx` | MODIFIED | Add Tutorials nav item + "New" badge |
| `api-client.ts` | MODIFIED | Add fetchTutorials, markTutorialViewed, submitFeedback, fetchTutorialNewBadge |
| `apps/tutorials/scripts/upload-to-gcs.ts` | NEW | GCS upload automation script |

### External Services

| Service | Integration Pattern | Credential |
|---------|---------------------|------------|
| GCS (upload from script) | `googleapis` v1 storage `objects.insert` with `predefinedAcl: publicRead` | `VERTEX_SERVICE_ACCOUNT_KEY` |
| GCS (video playback) | Direct public HTTPS URL in `<video src>` — no auth | None (public object) |
| Supabase PostgreSQL | Prisma ORM via `apps/agent/src/lib/db.ts`, forward-only migrations | `DATABASE_URL` / `DIRECT_URL` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web → Agent (tutorial data) | `fetchAgent()` in `api-client.ts` with Bearer JWT — same as all other data | Must add `fetchTutorials`, `fetchTutorialById`, `markTutorialViewed`, `submitFeedback`, `fetchTutorialNewBadge` |
| Agent → DB (tutorial queries) | Prisma via `tutorial-repo.ts` and `feedback-repo.ts` | Isolated in repo files to keep `index.ts` manageable |
| Sidebar → New-badge API | `fetch("/api/tutorials/new-badge")` in `useEffect` | Sidebar is Client Component — cannot call Server Actions for reads |
| Upload script → DB | Direct Prisma import in `apps/tutorials/scripts/` | Script runs locally with `.env` from `apps/agent`; needs `DATABASE_URL` |
| Upload script → GCS | `googleapis` storage client with `VERTEX_SERVICE_ACCOUNT_KEY` | Can import or inline the `getStorageClient()` pattern from `gcs-thumbnails.ts` |

---

## Build Order (Dependency Map)

The v1.10 features have a strict dependency chain. Phases that share no deps can run in parallel.

```
Phase A: Prisma models + migration
  (Tutorial, TutorialView, AppFeedback models in schema.prisma)
  (prisma migrate dev --name add-tutorial-models)
    │
    ├─── Phase B: GCS upload script + DB seed
    │    (apps/tutorials/scripts/upload-to-gcs.ts)
    │    (upserts Tutorial rows with gcsUrls)
    │    Depends on: Phase A (Tutorial model must exist)
    │
    └─── Phase C: Agent routes + repo functions
         (tutorial-repo.ts, feedback-repo.ts)
         (4 new registerApiRoute calls in index.ts)
         Depends on: Phase A (cannot query models that don't exist)
              │
              └─── Phase D: Web API client + Server Actions
                   (fetchTutorials, markTutorialViewed, submitFeedback in api-client.ts)
                   (tutorial-actions.ts, feedback-actions.ts)
                   Depends on: Phase C (agent routes must be registered)
                        │
                        └─── Phase E: Web pages + components
                             (tutorials/page.tsx, [id]/page.tsx)
                             (TutorialsClient, TutorialCard, TutorialPlayer, FeedbackWidget)
                             Depends on: Phase D (Server Actions must exist)
                                  │
                                  └─── Phase F: Sidebar integration + new-badge API
                                       (sidebar.tsx nav item + badge)
                                       (/api/tutorials/new-badge/route.ts)
                                       Depends on: Phase E (destination page must exist)
```

**Minimum viable order:** A → (B and C in parallel) → D → E → F

**Phase B (upload script) is a prerequisite for real data** but does not block code writing for phases C–F. The agent routes and web components can be built against fixture data while the upload script is being developed.

---

## Anti-Patterns

### Anti-Pattern 1: Using GOOGLE_SERVICE_ACCOUNT_KEY for GCS

**What people do:** Use `GOOGLE_SERVICE_ACCOUNT_KEY` when writing to GCS because it's the "Google" credential already set.

**Why it's wrong:** `GOOGLE_SERVICE_ACCOUNT_KEY` has only Google Workspace scopes (Drive, Slides, Docs). It does not have `devstorage` permissions. Uploads will return 403. This constraint is in CLAUDE.md and project memory.

**Do this instead:** Use `VERTEX_SERVICE_ACCOUNT_KEY` with `scopes: ["https://www.googleapis.com/auth/devstorage.full_control"]` — identical to the existing `getStorageClient()` function in `gcs-thumbnails.ts`.

### Anti-Pattern 2: prisma db push for New Models

**What people do:** Run `prisma db push` because it's a single command that "just works" for adding new models.

**Why it's wrong:** Violates CLAUDE.md explicitly. The dev database is treated as production. `db push` bypasses migration history, causing schema drift that requires manual recovery (`prisma migrate resolve --applied`).

**Do this instead:** `prisma migrate dev --name add-tutorial-models`. Commit the generated migration file alongside the schema change. Use `--create-only` to inspect the SQL first if the migration is non-trivial.

### Anti-Pattern 3: Client-Side Data Fetching for Tutorial List

**What people do:** Build the tutorials page as a Client Component with `useEffect(() => fetch('/api/tutorials'))` for initial data loading.

**Why it's wrong:** Every other page in this app uses Server Components for initial data. Client-side fetching causes a loading flash on first render, increases time-to-content, and is inconsistent with the codebase pattern.

**Do this instead:** Server Component → Server Action → `fetchAgent()`. The Client Component (`TutorialsClient`) only handles interactivity (optimistic watched toggles, feedback submit state).

### Anti-Pattern 4: Third-Party Video Player

**What people do:** Install `react-player` or `video.js` for "better" video experience.

**Why it's wrong:** Tutorial videos are plain MP4 files under 20MB served from a public CDN URL. A 50–200KB JS library to wrap `<video>` is unnecessary weight. The native HTML5 video element handles buffering, fullscreen, keyboard shortcuts, and responsive sizing without any library.

**Do this instead:** `<video controls src={gcsUrl} className="w-full rounded-lg" />`. If a poster image is needed, extract the first frame as a JPEG during the upload script run and upload it alongside the MP4.

### Anti-Pattern 5: Inline Group/Segment Strings Scattered Across Files

**What people do:** Hardcode `"Core"`, `"Deals"`, `"tutorial_feedback"` as string literals in multiple files.

**Why it's wrong:** With 17 tutorials across 4–5 groups and multiple feedback segments, inconsistent casing or typos break grouping and filtering. These values need to be consistent from DB to API to UI.

**Do this instead:** Define `TUTORIAL_GROUPS` and `FEEDBACK_SEGMENTS` as constants in `packages/schemas/src/constants.ts` alongside the existing `ACTION_TYPES` and `ARTIFACT_TYPES` constants. Use them in both the upload script (populating the DB) and the UI.

### Anti-Pattern 6: Calling Server Actions from the Sidebar for Badge Reads

**What people do:** Import and call a Server Action inside `sidebar.tsx` to check `hasNewTutorials`.

**Why it's wrong:** `sidebar.tsx` is a Client Component (`"use client"`). Client Components cannot invoke Server Actions for data reads — only for mutations invoked by user events. Calling a Server Action in `useEffect` is not supported.

**Do this instead:** Use a Next.js API route (`/api/tutorials/new-badge`) and `fetch()` inside `useEffect`, identical to the existing `pendingCount` pattern for Action Required.

---

## Scaling Considerations

This milestone serves ~20 sellers. Scale is not a concern for v1.10.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| ~20 users (current) | Public GCS objects, no CDN needed, no signed URLs |
| 200 users | Add Cloud CDN in front of GCS bucket if egress costs appear |
| 2000+ users | Move to a proper video CDN (Cloudflare Stream, Mux) with adaptive bitrate streaming |

At 20 users watching a few tutorials per week, GCS egress (17 files × avg 12MB × 20 users × 2 views/month) ≈ 8GB/month ≈ $0.96/month at $0.12/GB — negligible.

---

## Sources

- Direct inspection of `apps/agent/src/lib/gcs-thumbnails.ts` — GCS upload pattern (HIGH confidence)
- Direct inspection of `apps/agent/src/mastra/index.ts` — `registerApiRoute` patterns and route family conventions (HIGH confidence)
- Direct inspection of `apps/web/src/components/sidebar.tsx` — badge pattern via `useEffect` + `fetch` (HIGH confidence)
- Direct inspection of `apps/agent/prisma/schema.prisma` — model naming conventions, index patterns, forward-only migration history (HIGH confidence)
- Direct inspection of `apps/web/src/lib/actions/action-required-actions.ts` — Server Action pattern (HIGH confidence)
- Direct inspection of `apps/web/src/lib/api-client.ts` — `fetchAgent()` wrapper with Bearer JWT (HIGH confidence)
- Direct inspection of `apps/tutorials/fixtures/*/script.json` — tutorial metadata structure: `{ id, title, description, steps }` (HIGH confidence)
- Direct inspection of `apps/agent/src/env.ts` — existing env var patterns, `GCS_THUMBNAIL_BUCKET` as precedent for new `GCS_TUTORIALS_BUCKET` (HIGH confidence)
- CLAUDE.md: NEVER `prisma db push`; `VERTEX_SERVICE_ACCOUNT_KEY` for all paid GCP services including GCS (HIGH confidence)

---

*Architecture research for: v1.10 In-App Tutorials & Feedback*
*Researched: 2026-03-20*
