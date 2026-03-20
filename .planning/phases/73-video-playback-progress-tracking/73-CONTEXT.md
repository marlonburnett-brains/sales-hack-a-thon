# Phase 73: Video Playback & Progress Tracking - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the placeholder on /tutorials/[slug] with a functional HTML5 video player that loads MP4 directly from GCS, persists lastPosition every 10s (and on pause), marks tutorials watched at 90% completion, silently auto-seeks to lastPosition on return visits, and shows a next-tutorial end-screen overlay. This phase delivers the playback and tracking layer; sidebar badge and feedback widget are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Player layout
- Full content width — expand the current max-w-2xl placeholder to max-w-4xl or max-w-5xl
- Video fills the content width; no sidebar alongside
- Below the video: title, description paragraph, and formatted duration (same info as browse card)
- Prev / Next tutorial navigation buttons below the metadata — allow users to move through tutorials without returning to browse
- Small green "✓ Watched" badge near the title, visible once the video is marked complete (immediate feedback that progress was saved)

### Resume behavior
- Silent auto-seek: player loads, immediately seeks to lastPosition (if > 0), pauses there — no prompt
- User presses play manually to start (no autoplay — browser audio autoplay is blocked anyway)
- "Watched" is triggered at **90% completion** (not the `ended` event) — handles users who skip the last few seconds

### Progress save frequency
- Save lastPosition via a **10-second setInterval** during playback (≤6 writes/minute)
- Also save immediately **on pause** event — covers tab-close after pause
- Mechanism: **Next.js server action** (not a new agent API route) — consistent with existing mutation patterns in this app
- On watched threshold (90%): write `watched=true` + `watchedAt=now()` + final `lastPosition` in a single upsert

### Post-completion CTA
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

</decisions>

<specifics>
## Specific Ideas

- End-screen overlay styled like YouTube's end card — sits on top of the video element, not below it
- "✓ Watched" badge near the title gives immediate feedback without navigating away
- Prev/Next buttons complement the back link — user can stay in the player and move through the sequence

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/tutorials/[slug]/page.tsx`: existing placeholder page — replace placeholder div with client video component; keep back link, title, description, duration label patterns
- `listTutorialsAction()`: already fetches full tutorial list with slug, gcsUrl, durationSec, watched — use to find current tutorial + determine prev/next by sortOrder
- `TutorialBrowseCard` type: has `gcsUrl` (the GCS public URL for the `<video src>`)
- shadcn/ui `Badge`: use for "✓ Watched" indicator
- Lucide icons: `CheckCircle`, `ChevronLeft`, `ChevronRight`, `PlayCircle` already available

### Established Patterns
- Server actions in `apps/web/src/lib/actions/` for mutations — create `updateTutorialProgressAction` and `markTutorialWatchedAction` here
- `force-dynamic` already set on the slug page (no caching issues)
- Client components use `"use client"` directive; video player must be a client component (event listeners)
- Dynamic import with `{ ssr: false }` recommended for the video player to avoid hydration errors (success criterion 5)
- Prisma upsert pattern: `prisma.tutorialView.upsert({ where: { tutorialId_userId }, update: {...}, create: {...} })`

### Integration Points
- `TutorialView` model fields: `watched`, `lastPosition` (Float, seconds), `watchedAt` — all ready to write
- `listTutorialsAction()` returns `watched: boolean` per card — player page uses this to show initial "✓ Watched" badge state
- Browse page (`/tutorials/page.tsx`) revalidates after watch: server action should call `revalidatePath("/tutorials")` so browse card checkmarks update
- Phase 72's browse cards already link to `/tutorials/[slug]` — no changes needed there

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 73-video-playback-progress-tracking*
*Context gathered: 2026-03-20*
