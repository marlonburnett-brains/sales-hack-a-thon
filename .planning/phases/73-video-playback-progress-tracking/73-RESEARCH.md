# Phase 73: Video Playback & Progress Tracking - Research

**Researched:** 2026-03-20
**Domain:** HTML5 Video Player / Next.js Server Actions / Prisma Upsert
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Player layout:**
- Full content width — expand the current max-w-2xl placeholder to max-w-4xl or max-w-5xl
- Video fills the content width; no sidebar alongside
- Below the video: title, description paragraph, and formatted duration (same info as browse card)
- Prev / Next tutorial navigation buttons below the metadata — allow users to move through tutorials without returning to browse
- Small green "✓ Watched" badge near the title, visible once the video is marked complete (immediate feedback that progress was saved)

**Resume behavior:**
- Silent auto-seek: player loads, immediately seeks to lastPosition (if > 0), pauses there — no prompt
- User presses play manually to start (no autoplay — browser audio autoplay is blocked anyway)
- "Watched" is triggered at **90% completion** (not the `ended` event) — handles users who skip the last few seconds

**Progress save frequency:**
- Save lastPosition via a **10-second setInterval** during playback (≤6 writes/minute)
- Also save immediately **on pause** event — covers tab-close after pause
- Mechanism: **Next.js server action** (not a new agent API route) — consistent with existing mutation patterns in this app
- On watched threshold (90%): write `watched=true` + `watchedAt=now()` + final `lastPosition` in a single upsert

**Post-completion CTA:**
- **End-screen overlay** on the video at completion: shows "✓ Complete!" + next tutorial title + "Watch next →" button
- User can click "Watch next" to navigate to /tutorials/[next-slug], or let the overlay sit
- If no next tutorial (last in sort order), overlay shows "✓ All done!" with a "Back to Tutorials" link instead

### Claude's Discretion
- Exact max-width value (max-w-4xl vs max-w-5xl)
- Responsive breakpoint behavior for the player
- Exact end-screen overlay design and animation
- Loading/buffering state on the video element
- Error state if GCS URL is unreachable
- Client component boundary (dynamic import with ssr:false for the video player)
- Whether lastPosition resets to 0 after watched=true (or preserves position for rewatch)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAY-01 | User can play tutorial MP4 videos via native HTML5 video player (direct GCS URL, no proxy) | Native `<video src={gcsUrl}>` in a client component; GCS bucket already has CORS configured (Range header allowed per STATE.md) |
| PLAY-02 | Video player renders as client component with SSR disabled to avoid hydration issues | `next/dynamic` with `{ ssr: false }` — first usage in this codebase, confirmed pattern from Next.js docs |
| PLAY-03 | User's playback position is saved and restored when returning to a partially-watched video | Agent upsert endpoint POST /tutorials/:id/progress + server action; auto-seek on mount via `videoRef.current.currentTime = lastPosition` |
| TRACK-01 | User's watched/unwatched state persists per tutorial in database (marked on video ended event — actually 90% threshold per decisions) | Agent upsert endpoint POST /tutorials/:id/watched + server action; `revalidatePath("/tutorials")` on write |
| TRACK-02 | Watched tutorials display visual checkmark indicator on browse cards | Already implemented in TutorialCard via `watched` boolean — revalidatePath triggers re-fetch |
| TRACK-03 | Overall progress bar shows "X of 17 tutorials completed" on page header | Already implemented in TutorialsPageHeader — revalidatePath("/tutorials") triggers re-render |
| TRACK-04 | Playback position saved periodically for resume-from-timestamp functionality | 10-second setInterval during playback + save on pause event; calls server action |
</phase_requirements>

---

## Summary

Phase 73 replaces the placeholder on `/tutorials/[slug]` with a functional HTML5 video player backed by a progress-tracking layer. The architecture involves three layers: (1) a client-side video player component (dynamic import, ssr:false) that reads the `gcsUrl` from the tutorial data; (2) two new agent API routes that perform Prisma upserts on `TutorialView`; (3) two Next.js server actions that call those routes and trigger cache revalidation.

The web app has no direct Prisma access — all data mutations route through the agent service at `env.AGENT_SERVICE_URL`. The CONTEXT.md phrase "Next.js server action (not a new agent API route)" means the web-tier mechanism is a `"use server"` action (versus a raw client-side fetch), but new agent routes ARE still required to write `lastPosition` and `watched` to the database. This matches every existing mutation pattern in the codebase (settings-actions, deal-actions, etc.).

The `TutorialView` model already has all required fields (`watched`, `lastPosition`, `watchedAt`, `@@unique([tutorialId, userId])`). No schema migration is needed. The `listTutorials` GET handler already returns `watched: boolean` per card, which means once a `TutorialView` upsert fires and `revalidatePath("/tutorials")` is called, the browse page will immediately reflect the updated state.

**Primary recommendation:** Two agent routes (PATCH /tutorials/:id/progress, PATCH /tutorials/:id/watched) + two server actions + one client VideoPlayer component with dynamic(ssr:false). Keep all three concerns in separate files.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native HTML5 `<video>` | N/A | Video playback | Locked decision — no react-player or Video.js; requirements explicitly out-of-scope |
| `next/dynamic` | Next.js 15.x (in use) | SSR-disabled client component boundary | Prevents hydration mismatch from video event listeners |
| Next.js Server Actions (`"use server"`) | Next.js 15.x | Mutation layer for lastPosition + watched | Consistent with all existing mutation patterns in the codebase |
| Prisma `tutorialView.upsert` | 6.19.x (locked) | Persist progress + watched state | Existing model, no migration needed |
| `revalidatePath` from `next/cache` | Next.js 15.x | Bust browse page cache after watched write | Used in deal-actions, template-actions, action-required-actions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide `CheckCircle`, `ChevronLeft`, `ChevronRight`, `PlayCircle` | In use | Player UI icons | Already available per code context |
| shadcn/ui `Badge` | In use | "✓ Watched" indicator near title | Already available |
| `useRef` (React) | React 19.x | Video element ref for imperative seek + event binding | Standard React pattern for DOM video control |
| `useEffect` (React) | React 19.x | Attach interval + event listeners after mount | Required for side-effect-based progress saving |
| `useCallback` (React) | React 19.x | Stable handler references for event listeners | Prevents unnecessary re-registrations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<video>` | react-player, Video.js | Explicitly out of scope in REQUIREMENTS.md; 5-19MB MP4s need no adaptive streaming |
| `setInterval` for position saves | `timeupdate` event | `timeupdate` fires at 4Hz = up to 240 writes/minute; interval caps at ≤6/minute |
| Server action calling agent route | Direct Prisma in web | Web app has no Prisma dependency — would require major infra change |

**Installation:** No new packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
apps/web/src/
├── components/tutorials/
│   └── tutorial-video-player.tsx      # Client component, dynamic(ssr:false) wrapper target
├── lib/actions/
│   └── tutorial-actions.ts            # EXTEND: add updateTutorialProgressAction, markTutorialWatchedAction
apps/agent/src/mastra/
└── index.ts                           # EXTEND: add PATCH /tutorials/:id/progress and PATCH /tutorials/:id/watched
```

The slug page `/tutorials/[slug]/page.tsx` is extended (not replaced) — the server component fetches the full tutorial list, passes tutorial data (including `gcsUrl`, `watched`, `lastPosition`) to the new client player component.

### Pattern 1: SSR-Disabled Client Component via next/dynamic

**What:** The video player is a client component that uses DOM event listeners. The slug page (server component) imports it with `dynamic(() => import(...), { ssr: false })` to prevent hydration mismatches.

**When to use:** Any component that reads browser APIs (`HTMLVideoElement`, `window`, `document`) on mount, or uses `useRef` for DOM access.

**Example:**
```tsx
// apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx
import dynamic from "next/dynamic";

const TutorialVideoPlayer = dynamic(
  () => import("@/components/tutorials/tutorial-video-player").then((m) => m.TutorialVideoPlayer),
  { ssr: false, loading: () => <div className="aspect-video w-full animate-pulse bg-slate-200 rounded-lg" /> }
);
```

### Pattern 2: Video Progress Tracking with setInterval + Pause Event

**What:** On play, start a 10-second interval that calls the server action to save `currentTime`. On pause (and on the 90% threshold), also call save. On unmount, clear the interval.

**Example:**
```tsx
// Inside TutorialVideoPlayer ("use client")
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const hasMarkedWatched = useRef(false);

const handleTimeUpdate = useCallback(() => {
  const video = videoRef.current;
  if (!video || !video.duration) return;
  if (!hasMarkedWatched.current && video.currentTime / video.duration >= 0.9) {
    hasMarkedWatched.current = true;
    void markTutorialWatchedAction(tutorialId);
    setIsWatched(true);         // Optimistic local state for badge
    setShowEndScreen(true);
  }
}, [tutorialId]);

const handlePlay = useCallback(() => {
  if (intervalRef.current) clearInterval(intervalRef.current);
  intervalRef.current = setInterval(() => {
    const pos = videoRef.current?.currentTime ?? 0;
    void updateTutorialProgressAction(tutorialId, pos);
  }, 10_000);
}, [tutorialId]);

const handlePause = useCallback(() => {
  clearInterval(intervalRef.current!);
  const pos = videoRef.current?.currentTime ?? 0;
  void updateTutorialProgressAction(tutorialId, pos);
}, [tutorialId]);

useEffect(() => {
  const video = videoRef.current;
  if (!video) return;
  if (lastPosition > 0) video.currentTime = lastPosition;
  video.addEventListener("play", handlePlay);
  video.addEventListener("pause", handlePause);
  video.addEventListener("timeupdate", handleTimeUpdate);
  return () => {
    clearInterval(intervalRef.current!);
    video.removeEventListener("play", handlePlay);
    video.removeEventListener("pause", handlePause);
    video.removeEventListener("timeupdate", handleTimeUpdate);
  };
}, [handlePlay, handlePause, handleTimeUpdate, lastPosition]);
```

### Pattern 3: Agent Route for Progress Upsert

**What:** New PATCH route in agent that upserts `TutorialView` for the authenticated user. Follows the established pattern in `index.ts`.

**Example:**
```typescript
// In apps/agent/src/mastra/index.ts
registerApiRoute("/tutorials/:id/progress", {
  method: "PATCH",
  handler: async (c) => {
    const userId = await getVerifiedUserId(c, env.SUPABASE_URL);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const tutorialId = c.req.param("id");
    const { lastPosition } = z.object({ lastPosition: z.number() }).parse(await c.req.json());
    await prisma.tutorialView.upsert({
      where: { tutorialId_userId: { tutorialId, userId } },
      update: { lastPosition },
      create: { tutorialId, userId, lastPosition },
    });
    return c.json({ ok: true });
  },
}),

registerApiRoute("/tutorials/:id/watched", {
  method: "PATCH",
  handler: async (c) => {
    const userId = await getVerifiedUserId(c, env.SUPABASE_URL);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const tutorialId = c.req.param("id");
    const { lastPosition } = z.object({ lastPosition: z.number() }).parse(await c.req.json());
    await prisma.tutorialView.upsert({
      where: { tutorialId_userId: { tutorialId, userId } },
      update: { watched: true, watchedAt: new Date(), lastPosition },
      create: { tutorialId, userId, watched: true, watchedAt: new Date(), lastPosition },
    });
    return c.json({ ok: true });
  },
}),
```

### Pattern 4: Server Actions Calling Agent Routes

**What:** `"use server"` actions in `apps/web/src/lib/actions/tutorial-actions.ts` call the agent via `fetchAgent` (or `fetchJSON` from api-client). They call `revalidatePath("/tutorials")` on the watched action to bust the browse page cache.

**Example:**
```typescript
// In apps/web/src/lib/actions/tutorial-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { getSupabaseAccessToken } from "@/lib/supabase/get-access-token";
import { env } from "@/env";

async function agentFetch(path: string, body: unknown): Promise<void> {
  const token = await getSupabaseAccessToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${env.AGENT_SERVICE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Agent error ${res.status}`);
}

export async function updateTutorialProgressAction(tutorialId: string, lastPosition: number): Promise<void> {
  await agentFetch(`/tutorials/${tutorialId}/progress`, { lastPosition });
}

export async function markTutorialWatchedAction(tutorialId: string, lastPosition: number): Promise<void> {
  await agentFetch(`/tutorials/${tutorialId}/watched`, { lastPosition });
  revalidatePath("/tutorials");
}
```

### Pattern 5: Fetching lastPosition on the Server

**What:** The slug page (server component) already calls `listTutorialsAction()` to find the tutorial. But `TutorialBrowseCard` does not currently include `lastPosition`. Two options:
1. Add `lastPosition` to the existing `/tutorials` GET response (modifies existing route)
2. Add a new GET route `/tutorials/:id/view` to fetch a single TutorialView (clean but adds a route)

**Recommendation:** Option 1 — add `lastPosition: number` to `TutorialBrowseCard` in the existing `/tutorials` GET handler. The query already joins TutorialView records; just include `lastPosition` in the per-card payload. This is a non-breaking additive change.

The slug page extracts `lastPosition` from the matched tutorial card and passes it as a prop to `TutorialVideoPlayer`.

### Anti-Patterns to Avoid

- **Using `ended` event instead of 90% threshold:** The `ended` event only fires if the user watches to the absolute last frame. Users who skip the last few seconds never trigger it. Use `timeupdate` with a `currentTime / duration >= 0.9` check.
- **Calling server action from `timeupdate` directly:** `timeupdate` fires at ~4Hz. Always use `setInterval` to throttle to ≤6 writes/minute.
- **Autoplay on mount:** Browsers block autoplay with audio. Do not call `video.play()` in `useEffect`. Silent auto-seek + manual play is the correct pattern.
- **Missing interval cleanup on unmount:** If the user navigates away mid-video, the interval must be cleared in the `useEffect` cleanup function to prevent stale calls after unmount.
- **Setting `video.currentTime` before metadata is loaded:** Seeking before `loadedmetadata` fires may be ignored. Set `currentTime` inside the `loadedmetadata` event handler, not directly in `useEffect`.
- **Forgetting `revalidatePath` scope:** `revalidatePath("/tutorials")` must be called by `markTutorialWatchedAction` — NOT by `updateTutorialProgressAction` (no need to revalidate on every position save, only on watched state change).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Throttled writes | Custom debounce/throttle | `setInterval` (native) | setInterval is the simplest correct solution; no extra library |
| Video seek-to-position | Custom media session API | `videoRef.current.currentTime = pos` | Direct DOM property assignment; handles all edge cases |
| Cache invalidation | Manual state sync / websockets | `revalidatePath("/tutorials")` | Next.js built-in; works with force-dynamic pages |
| Upsert logic | Custom INSERT + UPDATE | `prisma.tutorialView.upsert` | Handles race conditions, duplicate prevention via @@unique |
| Auth in server action | Roll own cookie parsing | `getSupabaseAccessToken()` from existing lib | Already used in settings-actions.ts |

**Key insight:** The entire progress stack is 4 moving parts (2 agent routes, 2 server actions, 1 video component). Nothing here needs a new npm package or custom infrastructure.

---

## Common Pitfalls

### Pitfall 1: Hydration Mismatch with Video Element
**What goes wrong:** `<video>` rendered on the server doesn't match client state (controls, currentTime, etc.), causing React hydration errors — listed as success criterion 5.
**Why it happens:** Next.js server-renders the component; the DOM video element only exists client-side.
**How to avoid:** Use `dynamic(() => import(...), { ssr: false })` to skip server rendering entirely for the video player component.
**Warning signs:** Console error "Hydration failed because the server-rendered HTML didn't match the client."

### Pitfall 2: Seeking Before Metadata Loads
**What goes wrong:** `video.currentTime = lastPosition` silently fails if called before the browser knows the video duration.
**Why it happens:** The browser hasn't loaded enough of the video to know its structure.
**How to avoid:** Listen to `loadedmetadata` event and seek inside the handler: `video.addEventListener("loadedmetadata", () => { video.currentTime = lastPosition; })`.
**Warning signs:** Player starts from 0 despite lastPosition > 0.

### Pitfall 3: Stale Interval After Navigation
**What goes wrong:** User navigates away mid-interval; the setInterval callback fires and calls a server action for a component that no longer exists, potentially with stale `tutorialId`.
**Why it happens:** Missing cleanup in `useEffect` return function.
**How to avoid:** Always `clearInterval(intervalRef.current)` in the useEffect cleanup.
**Warning signs:** Server action called with wrong tutorialId after navigation.

### Pitfall 4: GCS CORS for Byte-Range Requests
**What goes wrong:** Browser requests a Range header for MP4 byte-range reads; GCS bucket blocks it if CORS is not configured.
**Why it happens:** HTML5 video streaming uses HTTP Range requests.
**How to avoid:** Already resolved in Phase 71 (STATE.md: "GCS bucket CORS must allow Range header for HTML5 video byte-range requests"). No action needed, but verify if the video player shows buffering errors.
**Warning signs:** Network tab shows 403/CORS errors on the GCS URL.

### Pitfall 5: Double-Firing Watched Action
**What goes wrong:** `markTutorialWatchedAction` fires multiple times if the user scrubs back before 90% and re-crosses the threshold.
**Why it happens:** `timeupdate` fires continually; the threshold check runs every time.
**How to avoid:** Use a `hasMarkedWatched = useRef(false)` flag. Set it `true` on first fire; gate all subsequent calls.
**Warning signs:** Multiple PATCH /tutorials/:id/watched requests in the network tab.

### Pitfall 6: lastPosition Not in Existing API Response
**What goes wrong:** The slug page passes `lastPosition={0}` to the player because `TutorialBrowseCard` doesn't include that field.
**Why it happens:** The existing `/tutorials` GET handler builds cards without `lastPosition` from TutorialView records.
**How to avoid:** Extend the GET handler to include `lastPosition` from the joined views map (already fetches all views for the user; just add `lastPosition` to the card payload).
**Warning signs:** Resume position always 0 despite previous saves.

---

## Code Examples

### Auto-seek on loadedmetadata
```tsx
// Source: MDN HTMLMediaElement.currentTime
useEffect(() => {
  const video = videoRef.current;
  if (!video || lastPosition <= 0) return;
  const onLoaded = () => { video.currentTime = lastPosition; };
  video.addEventListener("loadedmetadata", onLoaded);
  return () => video.removeEventListener("loadedmetadata", onLoaded);
}, [lastPosition]);
```

### End-screen overlay (absolute positioned over video)
```tsx
// Overlay sits inside the relative-positioned video container
{showEndScreen && (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 rounded-lg">
    <CheckCircle className="h-12 w-12 text-emerald-400" />
    <p className="text-lg font-semibold text-white">Complete!</p>
    {nextTutorial ? (
      <Link href={`/tutorials/${nextTutorial.slug}`}
        className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600">
        Watch next: {nextTutorial.title} →
      </Link>
    ) : (
      <Link href="/tutorials"
        className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
        Back to Tutorials
      </Link>
    )}
  </div>
)}
```

### Prev/Next navigation derivation (server component)
```typescript
// In slug page.tsx — derive prev/next from the flat sorted list
const allTutorials = data.categories.flatMap((c) => c.tutorials)
  .sort((a, b) => /* already sorted by sortOrder from API */ 0);
const currentIndex = allTutorials.findIndex((t) => t.slug === slug);
const prevTutorial = currentIndex > 0 ? allTutorials[currentIndex - 1] : null;
const nextTutorial = currentIndex < allTutorials.length - 1 ? allTutorials[currentIndex + 1] : null;
```

### TutorialBrowseCard extension (additive, non-breaking)
```typescript
// In apps/web/src/lib/api-client.ts
export interface TutorialBrowseCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  durationSec: number;
  thumbnailUrl: string | null;
  watched: boolean;
  lastPosition: number;   // ADD: seconds, default 0
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ended` event for watched | 90% threshold via `timeupdate` | Phase 73 decision | More forgiving; catches users who skip last seconds |
| Video proxy through Vercel | Direct GCS public URL | Phase 71 decision | Avoids 5-19MB serverless function payload limits |
| react-player / Video.js | Native `<video>` element | Requirements.md Out of Scope | No custom player needed for MP4 without subtitles/adaptive streaming |

**Deprecated/outdated:**
- `video.play()` on mount: Browser autoplay policy blocks this without user gesture. Use silent seek + manual play.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` (key absent) — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react |
| Config file | `apps/web/vitest.config.ts` (jsdom environment) |
| Quick run command | `pnpm --filter web test -- --run src/components/tutorials` |
| Full suite command | `pnpm --filter web test -- --run` |

Agent-side tests use Vitest (node environment):
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (node) |
| Config file | `apps/agent/vitest.config.ts` |
| Quick run command | `pnpm --filter agent test -- --run src/mastra/__tests__/tutorial` |
| Full suite command | `pnpm --filter agent test -- --run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-01 | Video element renders with correct `src` from gcsUrl | unit (RTL) | `pnpm --filter web test -- --run src/components/tutorials/__tests__/tutorial-video-player.test.tsx` | ❌ Wave 0 |
| PLAY-02 | Component does not SSR (dynamic import ssr:false) | manual-only | N/A — SSR behavior not testable in jsdom | — |
| PLAY-03 | Auto-seeks to lastPosition on loadedmetadata | unit (RTL) | included in PLAY-01 test file | ❌ Wave 0 |
| TRACK-01 | Agent PATCH /tutorials/:id/watched upserts watched=true | unit (agent) | `pnpm --filter agent test -- --run src/mastra/__tests__/tutorial-progress-routes.test.ts` | ❌ Wave 0 |
| TRACK-02 | Browse card shows checkmark when watched=true | existing | `pnpm --filter web test -- --run src/components/tutorials/__tests__/tutorials-browse-view.test.tsx` | ✅ |
| TRACK-03 | TutorialsPageHeader shows "X of 17 completed" | existing | included in existing browse view test | ✅ |
| TRACK-04 | Agent PATCH /tutorials/:id/progress upserts lastPosition | unit (agent) | included in TRACK-01 test file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter web test -- --run src/components/tutorials && pnpm --filter agent test -- --run src/mastra/__tests__/tutorial`
- **Per wave merge:** `pnpm --filter web test -- --run && pnpm --filter agent test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/components/tutorials/__tests__/tutorial-video-player.test.tsx` — covers PLAY-01, PLAY-03 (render + auto-seek + watched badge + end-screen + prev/next buttons)
- [ ] `apps/agent/src/mastra/__tests__/tutorial-progress-routes.test.ts` — covers TRACK-01, TRACK-04 (PATCH /progress + PATCH /watched upsert behavior, auth guard, 401 on missing user)

---

## Open Questions

1. **Does `listTutorials` currently sort tutorials before returning them?**
   - What we know: The `/tutorials` GET handler calls `prisma.tutorial.findMany({ orderBy: { sortOrder: "asc" } })` — yes, sorted.
   - What's unclear: The `flatMap` in the slug page to derive prev/next needs to flatten in the same order — the categories array order may differ from global sortOrder.
   - Recommendation: Flatten all tutorials from `data.categories.flatMap((c) => c.tutorials)` and then sort by a `sortOrder` field — BUT `TutorialBrowseCard` currently does not include `sortOrder`. Either add `sortOrder` to the card type, or find the current index by doing a linear search across categories (acceptable for 17 items).

2. **Should lastPosition reset to 0 after watched=true?**
   - What we know: This is explicitly Claude's Discretion.
   - What's unclear: Do we want "rewatch from beginning" or "rewatch from last position"?
   - Recommendation: Preserve lastPosition after watched=true. User can scrub manually. Avoids the need for conditional logic.

---

## Sources

### Primary (HIGH confidence)
- Codebase inspection (direct read) — `apps/agent/src/mastra/index.ts`, `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/actions/`, `apps/agent/prisma/schema.prisma`
- Existing test patterns — `tutorial-browse-route.test.ts` (mock structure for new agent route tests)
- `apps/web/package.json` — confirmed no Prisma dependency in web app

### Secondary (MEDIUM confidence)
- Next.js 15 docs pattern: `dynamic(() => import(...), { ssr: false })` — standard pattern, stable across Next.js 13+
- MDN HTMLMediaElement.currentTime / loadedmetadata — stable web API

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in the codebase; zero new dependencies
- Architecture: HIGH — pattern is consistent with every existing mutation in the app; agent route structure is directly readable
- Pitfalls: HIGH — all derived from direct code inspection and known browser API behavior

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable stack; Next.js 15 + Prisma 6.19.x locked)
