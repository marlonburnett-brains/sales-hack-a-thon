# Pitfalls Research

**Domain:** In-app tutorial video browsing (GCS-hosted MP4), user progress tracking, and reusable feedback collection added to existing Next.js 15 + Prisma + Supabase + Vercel app
**Researched:** 2026-03-20
**Confidence:** HIGH (verified against official GCS docs, Next.js official docs, Prisma docs, GitHub discussions, and direct codebase analysis)

## Critical Pitfalls

### Pitfall 1: Wrong Service Account Key Used for GCS Video Upload

**What goes wrong:**
GCS video upload code accidentally uses `GOOGLE_SERVICE_ACCOUNT_KEY` (the document-access service account) instead of `VERTEX_SERVICE_ACCOUNT_KEY` (the paid GCP services account). The upload silently succeeds in dev (where both keys may share a project) but fails in production with a 403 Forbidden because the document service account has no `storage.objects.create` permission on the video bucket.

**Why it happens:**
The existing GCS code in `gcs-thumbnails.ts` already correctly calls `JSON.parse(env.VERTEX_SERVICE_ACCOUNT_KEY)` for all storage operations. When copy-pasting that pattern or writing new upload utilities, developers may reference the wrong env var name, especially since `GOOGLE_SERVICE_ACCOUNT_KEY` is more prominent in the codebase (Slides/Docs paths). The CLAUDE.md rule is explicit, but easy to violate under time pressure.

**How to avoid:**
- All new GCS utility functions (video upload, public URL generation, bucket management) MUST call `env.VERTEX_SERVICE_ACCOUNT_KEY`, matching the existing pattern in `apps/agent/src/lib/gcs-thumbnails.ts`.
- Never use `GOOGLE_SERVICE_ACCOUNT_KEY` for ANY storage operation.
- Add a comment header to every new GCS utility file: `// Auth: VERTEX_SERVICE_ACCOUNT_KEY only — never GOOGLE_SERVICE_ACCOUNT_KEY`.
- Grep the PR for `GOOGLE_SERVICE_ACCOUNT_KEY` in any file under `apps/agent/src/lib/gcs-*` as a pre-merge check.

**Warning signs:**
- 403 Forbidden errors on GCS upload in production but not local
- `Error: 7 PERMISSION_DENIED` from the googleapis storage client
- Upload works when tested with Application Default Credentials (ADC) locally but fails in CI/Railway

**Phase to address:**
GCS Upload Phase — this must be verified before building the UI that depends on URLs being present.

---

### Pitfall 2: GCS Bucket CORS Not Configured for Browser Video Requests

**What goes wrong:**
The browser fetches `https://storage.googleapis.com/BUCKET/tutorials/FILENAME.mp4` directly in a `<video>` element. If the bucket has no CORS configuration, the first byte-range request from the HTML5 video element returns a CORS error (`Access to fetch blocked by CORS policy`). The video renders a black box with no error message to the user. This only appears in the browser — server-side access and curl work fine.

**Why it happens:**
GCS buckets do not have permissive CORS by default. The existing thumbnail bucket at `GCS_THUMBNAIL_BUCKET` was configured for image loads (PNG GET), but its CORS config may not include the `video/mp4` media type or the `Range` header required for HTTP range requests (byte-serving). HTML5 video elements issue byte-range requests (`Range: bytes=0-`) that require the GCS bucket to explicitly allow the `Range` request header in its CORS configuration. You CANNOT configure bucket CORS via the Google Cloud Console — it requires `gcloud CLI` or the JSON API.

**How to avoid:**
1. Configure CORS on the video bucket using `gcloud storage buckets update gs://BUCKET_NAME --cors-file=cors.json` with the following config:
   ```json
   [
     {
       "origin": ["https://atlusdeck.lumenalta.com", "http://localhost:3000"],
       "method": ["GET", "HEAD"],
       "responseHeader": ["Content-Type", "Content-Range", "Range", "Accept-Ranges"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
2. Explicitly include `Range` and `Accept-Ranges` in `responseHeader` — these are required for video byte-serving.
3. If reusing the existing thumbnail bucket, update its CORS config to add `Range` headers.
4. Test CORS by loading the video URL in a browser (not curl) from the production origin.

**Warning signs:**
- Chrome DevTools Network tab shows the video request returning a CORS error
- Video element shows no controls or a broken state immediately on load
- `XMLHttpRequest cannot load` errors in browser console with GCS storage URL
- Works in dev with `localhost:3000` if CORS includes localhost, but breaks in production deployment

**Phase to address:**
GCS Upload Phase — configure and verify bucket CORS before any video player UI is built.

---

### Pitfall 3: HTML5 Video Element Causing SSR Hydration Mismatch in Next.js 15

**What goes wrong:**
A `<video>` element with dynamic attributes (especially `src` derived from DB, `autoPlay`, `muted`, or `playsInline`) causes a Next.js 15 hydration error: `Error: Hydration failed because the initial UI does not match what was rendered on the server`. This crashes the tutorial page client-side and shows a blank page to the user.

**Why it happens:**
Next.js 15 App Router Server Components pre-render HTML on the server. A `<video>` element with `src` pointing to an external URL (GCS), or with boolean attributes that differ between server/client states, creates a mismatch when React hydrates the DOM. Additionally, `autoPlay` is silently blocked by browsers (requires `muted`) and produces different rendered state server-vs-client. The `useRef`, `useEffect`, and video event handlers (`onTimeUpdate`, `onEnded`) are browser-only APIs and cannot run in Server Components at all.

**How to avoid:**
1. Mark any component containing a `<video>` element as `"use client"` — never include video elements in Server Components.
2. Use `dynamic(() => import('./VideoPlayer'), { ssr: false })` for the video player component to prevent any server-side rendering of the video DOM.
3. If using `autoPlay`, always pair with `muted` and `playsInline` as required by browser autoplay policy.
4. Set `preload="metadata"` (not `preload="auto"`) to avoid downloading the full video on page load — critical for 5-19MB tutorials.
5. Per the official Next.js 15 video guide: `<video controls preload="none" aria-label="Video player">` is the recommended starting point.

**Warning signs:**
- `Error: Hydration failed` in browser console on the tutorials page
- Blank/white page with no content after navigating to a tutorial
- Video element missing from DOM when inspecting in DevTools despite being in code
- Video auto-plays without sound in some browsers (autoPlay without muted)

**Phase to address:**
Tutorial Player UI Phase — establish the `"use client"` video component with `dynamic({ ssr: false })` before any progress-tracking logic is added on top.

---

### Pitfall 4: Prisma Schema Changed Without a Migration File (`db push` or Manual Edits)

**What goes wrong:**
A developer adds `Tutorial`, `TutorialView`, or `Feedback` models to `schema.prisma` and runs `prisma db push` to apply the changes quickly, or edits the Supabase DB directly. The schema and the migration history diverge. Subsequent `prisma migrate dev` commands prompt to reset the database, which would destroy all production data. CircleCI deploy pipeline (`prisma migrate deploy`) fails because the migration history doesn't match the DB state.

**Why it happens:**
`prisma db push` is faster than `prisma migrate dev --name ...` and feels safe in development. But it leaves zero migration history. When CircleCI runs `prisma migrate deploy` on Supabase prod, the deploy fails or silently skips the new tables. This project has already encountered migration drift (CLAUDE.md documents the `0_init` baseline fix and the `migrate resolve --applied` pattern). Adding new models without forward-only migrations repeats that failure mode.

**How to avoid:**
- ALWAYS run `prisma migrate dev --name <descriptive-name>` for every schema change, per CLAUDE.md rules. No exceptions.
- NEVER run `prisma db push`, `prisma migrate reset`, or edit the Supabase DB schema directly.
- Use `--create-only` to inspect generated SQL before applying for non-trivial models: `prisma migrate dev --name add-tutorials --create-only`.
- After running `migrate dev`, commit the generated migration file in the same PR as the schema change.
- If drift occurs despite this, fix with `prisma migrate resolve --applied <migration-name>` — do NOT reset.
- Verify CircleCI pipeline passes with `prisma migrate deploy` in CI before merging.

**Warning signs:**
- `prisma migrate status` shows "Database schema is not in sync with migration history"
- CircleCI deploy pipeline fails at the migrate step with drift errors
- `prisma migrate dev` prompts: "We need to reset the PostgreSQL database" — STOP, do not proceed
- Tables exist in Supabase that are not reflected in any migration file

**Phase to address:**
Database Schema Phase — all three new Prisma models (`Tutorial`, `TutorialView`, `Feedback`) must be created via migrations before any other code references them.

---

### Pitfall 5: Vercel Serverless Functions Streaming or Proxying Video Files

**What goes wrong:**
A Next.js API route or Server Action is written to proxy the GCS video file through Vercel (e.g., to add auth checks or hide the GCS URL). The function times out on Vercel Hobby (10s max, 60s on Pro) when serving large video files. Even on Pro, the 4.5MB response body limit for non-streaming functions means a 19MB tutorial video is truncated. Users see a broken video or a network error mid-playback.

**Why it happens:**
Vercel Functions are designed as lightweight API handlers, not media servers. The official Vercel guidance states: "If you have a large file like a video that you need to send to a client, store those assets in a dedicated media host and make them retrievable with a pre-signed URL." Tutorials are 5-19MB each, 193MB total — well above safe function response thresholds.

**How to avoid:**
- NEVER proxy video files through a Vercel serverless function or Server Action.
- Serve videos directly from GCS public URLs (`https://storage.googleapis.com/BUCKET/tutorials/FILENAME.mp4`).
- Store the GCS public URL in the `Tutorial` DB record at upload time and serve that URL directly to the `<video src>` attribute.
- If access control is needed in the future, use GCS signed URLs (time-limited) generated by a lightweight API route — these redirect the browser directly to GCS, the function itself returns only a URL string.
- Keep the video serving path: Browser → GCS (direct). No Vercel function in the middle.

**Warning signs:**
- `504 Gateway Timeout` on Vercel for video API routes
- Video plays for a few seconds then stops (truncated at 4.5MB function response limit)
- Vercel function logs showing `duration: 10000ms` (timeout) for video requests
- Users on slow connections report videos that start buffering and never continue

**Phase to address:**
GCS Upload Phase — the data model for `Tutorial` must store `publicUrl` (not a proxy route) from day one. The video player phase must point `<video src>` directly at that URL.

---

### Pitfall 6: Progress Tracking Fires Server Calls on Every `timeupdate` Event

**What goes wrong:**
A `useEffect` attaches an `onTimeUpdate` listener to the video element to track watch progress. The HTML5 `timeupdate` event fires 4 times per second (approximately every 250ms). If the listener calls a Server Action or fetch to save progress on every event, the result is 240+ database writes per minute while a video plays. This hammers the Supabase connection pool, creates unnecessary Railway agent load, and causes perceptible UI lag as React re-renders on each state update.

**Why it happens:**
`timeupdate` frequency is standardized at "as often as the user agent thinks is appropriate" — in practice 4Hz. Developers writing `video.addEventListener('timeupdate', saveProgress)` without throttling assume it fires rarely. The problem only manifests after the first real video playback session.

**How to avoid:**
1. Never save progress on `timeupdate`. Save on the `ended` event to mark a video as watched.
2. If intermediate progress matters, use a debounced/throttled function that fires at most every 10-30 seconds.
3. The simplest correct model for this use case: save `watchedAt: Date` when the `ended` event fires (video completed). No continuous progress tracking needed.
4. Keep the `TutorialView` schema simple: `userId`, `tutorialId`, `watchedAt` — a single upsert on video end.
5. All DB writes for progress go through a Server Action (already the established pattern in this codebase) — not a polling loop.

**Warning signs:**
- Supabase connection pool errors (`too many connections`) during video playback
- Railway agent logs showing bursts of POST requests at 4Hz intervals
- React dev tools showing rapid re-renders of the tutorial page during playback
- Browser network panel showing hundreds of identical requests to the progress endpoint

**Phase to address:**
User Progress Tracking Phase — define the event model (fire-on-end) in the schema design before writing any client-side video event handlers.

---

### Pitfall 7: GCS Object Visibility Blocked by Uniform Bucket-Level Access Without IAM Policy

**What goes wrong:**
Video files are uploaded to GCS successfully but return 403 when accessed via public URL in the browser. The bucket uses uniform bucket-level access (UBA), but the `allUsers` IAM binding (`roles/storage.objectViewer`) was not set. Alternatively, the bucket was created without UBA but with legacy ACLs, and the upload code sets object-level ACLs that conflict with the uniform setting.

**Why it happens:**
GCS has two access control models: legacy ACLs (per-object) and uniform bucket-level access (IAM). They cannot coexist on the same bucket. The existing thumbnail bucket was configured at a specific point in time — the video bucket may be created fresh or reuse the thumbnail bucket with different settings. If UBA is enabled (recommended), per-object ACLs are disabled and IAM must grant `allUsers` the `objectViewer` role at the bucket level. If the IAM binding is missing, uploads succeed but reads fail publicly.

**How to avoid:**
1. Decide upfront: reuse the existing thumbnail bucket (already configured) or create a dedicated video bucket.
2. If creating a new bucket, enable uniform bucket-level access and apply the IAM binding: `gcloud storage buckets add-iam-policy-binding gs://BUCKET_NAME --member=allUsers --role=roles/storage.objectViewer`.
3. If reusing the thumbnail bucket, verify the `allUsers` binding already covers video objects (it covers all objects in the bucket).
4. After upload, verify the public URL in a browser incognito window before marking the upload workflow as complete.
5. Document the bucket name and IAM configuration in `DEPLOY.md` so future environment setup doesn't miss this step.

**Warning signs:**
- 403 Forbidden when accessing the GCS URL in an incognito browser window
- GCS object shows in the console but "Public access" column shows "Not public"
- Upload code returns a URL but the video player shows an error icon immediately
- Error only affects new videos; existing thumbnail URLs still work (different bucket or ACL state)

**Phase to address:**
GCS Upload Phase — bucket IAM must be verified before any video metadata is stored in the DB. A broken URL in the DB is harder to fix than catching it upfront.

---

### Pitfall 8: Feedback Component State Leaks Across Tutorial Navigation

**What goes wrong:**
The reusable feedback widget (segmented control + free-text) retains the previous tutorial's selection or text when navigating to a new tutorial. A user submits feedback for Tutorial 2 that was actually composed while on Tutorial 1. Alternatively, the feedback form shows as pre-filled when visiting any tutorial after the first submission.

**Why it happens:**
In Next.js 15 App Router, client components maintain state across soft navigations unless their `key` prop changes or the component is unmounted. A feedback component mounted at the page level persists its `useState` across route changes within the same layout. React does not reset `useState` on re-render — only on unmount.

**How to avoid:**
1. Pass `tutorialId` as the `key` prop to the feedback component: `<FeedbackWidget key={tutorialId} tutorialId={tutorialId} />`. This forces React to unmount and remount the component on tutorial change, resetting all state.
2. Alternatively, derive initial state from a `useEffect([tutorialId])` that resets form fields when the tutorialId changes.
3. The `key` approach is simpler and guaranteed to work — prefer it.
4. After feedback submission, reset the component state (or navigate) to prevent double-submit.
5. Store `submittedAt` in the DB — a unique constraint on `(userId, tutorialId, feedbackType)` is not needed but a server-side check prevents exact duplicates.

**Warning signs:**
- Feedback submission associates the wrong `tutorialId` in the DB
- Users report seeing pre-filled feedback text when opening a different tutorial
- Playwright E2E test shows feedback form non-empty when navigating between tutorials
- Segment control shows previous selection on new tutorial page load

**Phase to address:**
Feedback UI Phase — establish the `key={tutorialId}` pattern when scaffolding the feedback component. Retrofitting is easy but catching it late means data integrity issues.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Uploading all 16 tutorial videos manually via GCS console instead of automation script | Faster first deployment | Breaks reproducibility; new environments require manual re-upload; CI cannot verify | Only for a first smoke-test upload; automate before milestone completion |
| Storing video metadata (title, group, order) in hardcoded config instead of DB | Avoids schema migration | Cannot add/reorder tutorials without a deploy; admin UI impossible later | Never — schema with `Tutorial` table is required from day one |
| Using `prisma db push` "just this once" for Tutorial/TutorialView/Feedback models | Faster iteration | Breaks CircleCI `migrate deploy`; causes drift; matches the exact pattern CLAUDE.md prohibits | Never |
| Proxying video through a Next.js API route to add auth | Centralized access control | Timeouts on Vercel (10s Hobby / 60s Pro), 4.5MB body limit breaks 5-19MB videos | Never — use direct GCS URLs; signed URLs if access control needed |
| Firing Server Actions on every `timeupdate` event | Always up-to-date progress | 240+ DB writes/min per concurrent viewer; connection pool exhaustion at scale | Never — use fire-on-end or throttle to max 1 write per 30 seconds |
| Making the feedback widget a Server Component | Avoids "use client" overhead | Form state and segmented control interaction require browser events; will fail at runtime | Never — feedback widget is inherently a client component |
| Embedding `<video>` in a Server Component (no "use client") | Slightly leaner bundle | Hydration mismatch crash on first render | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GCS video upload | Using `GOOGLE_SERVICE_ACCOUNT_KEY` for storage operations | Always use `VERTEX_SERVICE_ACCOUNT_KEY` — matches existing pattern in `gcs-thumbnails.ts` |
| GCS public video serving | No CORS config on the bucket | Configure CORS with `gcloud` CLI, including `Range` and `Accept-Ranges` response headers; cannot use Google Cloud Console for CORS |
| GCS bucket public access | Missing `allUsers` IAM binding when uniform bucket-level access is enabled | Use `gcloud storage buckets add-iam-policy-binding --member=allUsers --role=roles/storage.objectViewer`; verify in incognito browser |
| HTML5 `<video>` in Next.js 15 | Rendering video element in Server Component | Wrap in `"use client"` and use `dynamic(() => import('./VideoPlayer'), { ssr: false })` |
| Video autoplay | `autoPlay` attribute without `muted` | Browsers block autoplay with sound; always pair `autoPlay` + `muted` + `playsInline` |
| Video progress tracking | Attaching Server Action to `timeupdate` event | Fire DB write only on `ended` event or throttle to max 1 write per 30s |
| Prisma new models | Running `prisma db push` to apply schema changes | Use `prisma migrate dev --name <name>`; commit generated migration file in same PR |
| Feedback form reset on navigation | Not setting `key` prop on feedback component | Pass `key={tutorialId}` to force unmount/remount on tutorial change |
| Vercel video serving | Proxying GCS video through an API route | Serve directly from GCS public URL; API route returns URL string only if access control needed |
| Railway agent + GCS upload | Agent calling GCS upload with missing `GCS_TUTORIAL_BUCKET` env var | Guard with early check and clear error; don't silently skip upload and store empty URL |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `timeupdate` without throttle | 240+ DB writes/min per viewer, Supabase connection pool errors | Fire progress save on `ended` only, or throttle to 1 write/30s | First time a user watches a tutorial all the way through |
| `preload="auto"` on all tutorial thumbnails/videos | 193MB downloaded on tutorials page load | Use `preload="none"` or `preload="metadata"` on `<video>` elements | Tutorials page loaded by any user |
| Loading all tutorial metadata in a single Server Component without pagination | Slow initial page load as tutorial count grows | Group tutorials in the DB; fetch only the visible group first | Beyond 20-30 tutorials |
| Video player component not wrapped in `dynamic({ ssr: false })` | Hydration errors blocking the entire page from rendering | Use `dynamic()` with `ssr: false` for the video player | On every page load in production |
| Uploading video to GCS from a Vercel serverless function | 60-second timeout exceeded for files over ~20MB | Run GCS upload from the Railway agent (long-lived process) or a standalone script; never from a Vercel function | For any tutorial video (5-19MB each) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using `GOOGLE_SERVICE_ACCOUNT_KEY` for GCS upload | Wrong service account, 403 errors, or inadvertent use of document-access credentials for paid storage operations | Enforce `VERTEX_SERVICE_ACCOUNT_KEY` for all GCS operations per CLAUDE.md |
| Making the tutorial video bucket publicly listable (not just readable) | Exposes all video filenames to unauthenticated users via bucket listing | Grant `roles/storage.objectViewer` (read objects), NOT `roles/storage.legacyBucketReader` (list + read); or disable listing via IAM |
| Storing feedback submissions without userId validation | Malicious users can submit feedback as other users | Validate `userId` from Supabase session on the server action, never trust client-provided userId |
| GCS CORS allowing `*` origin in production | Any site can embed your tutorials and trigger bandwidth charges | Restrict `origin` to production domain (`https://atlusdeck.lumenalta.com`) and `http://localhost:3000` only |
| Committed `VERTEX_SERVICE_ACCOUNT_KEY` JSON in any config or fixture file | Credentials leaked, GCS/Vertex AI bills incurred by unauthorized users | Never commit service account JSON; use env vars only; add fixture validation to CI to reject real key patterns |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No "watched" visual state until page refresh | Users re-watch tutorials they already completed because badge doesn't appear until reload | Update watched state optimistically on the client immediately after the `ended` event fires, before the Server Action resolves |
| Video player takes full page width on desktop | Tutorial list and player compete for space; users lose context of which tutorial they're on | Use a layout with tutorial list sidebar and player panel (or keep list visible above player) |
| Feedback widget visible before user has watched the video | Feedback submitted before watching is meaningless noise | Show feedback widget only after `ended` fires (or after N% viewed); hide or disable it before |
| No visual grouping of tutorials | 16 tutorials shown as a flat list is overwhelming | Group by workflow phase (Getting Started, Deals, Touch 1-4, etc.) matching the logical sequence from v1.9 |
| "New" badge on nav item never clears | Badge stays after user visits tutorials page | Mark tutorials page as visited in localStorage or DB; clear badge on first visit to the tutorials route |
| Video loads at full resolution immediately | 5-19MB video starts downloading on page load even if user doesn't click play | Set `preload="none"` so video data is only fetched when the user explicitly clicks play |

## "Looks Done But Isn't" Checklist

- [ ] **GCS CORS:** Verified by loading a video URL in Chrome DevTools Network tab from the production domain — no CORS error, `Accept-Ranges: bytes` header present in response.
- [ ] **Service account:** All GCS operations in new upload scripts use `env.VERTEX_SERVICE_ACCOUNT_KEY`, verified by grep: `grep -r "GOOGLE_SERVICE_ACCOUNT_KEY" apps/agent/src/lib/gcs-*.ts` returns nothing.
- [ ] **Public access:** Tutorial videos are accessible via their GCS URL in an incognito browser window (no cookies, no auth).
- [ ] **Migrations committed:** `prisma migrate status` shows no pending drift; all three new models (`Tutorial`, `TutorialView`, `Feedback`) have migration files committed to git.
- [ ] **No SSR hydration error:** Tutorials page loads without `Error: Hydration failed` in browser console; video player wrapped in `"use client"` + `dynamic({ ssr: false })`.
- [ ] **Autoplay policy:** If using `autoPlay`, both `muted` and `playsInline` are present on the `<video>` element.
- [ ] **preload="none":** All `<video>` elements use `preload="none"` or `preload="metadata"` — NOT `preload="auto"`.
- [ ] **Progress save on ended only:** No Server Action or fetch call is wired to the `timeupdate` event; watched state saves on `ended`.
- [ ] **Feedback key prop:** Feedback component receives `key={tutorialId}` — verify by navigating between two tutorials and confirming the form resets.
- [ ] **No video proxying:** `<video src>` points directly to `https://storage.googleapis.com/...` URL, not a Vercel API route.
- [ ] **Feedback userId:** Server Action that saves feedback reads `userId` from the Supabase server session, never from a client-supplied body field.
- [ ] **"New" badge clears:** Navigating to the tutorials page causes the nav badge to disappear on subsequent visits.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong service account for GCS upload | LOW | Update env var reference in upload utility; re-upload affected videos |
| CORS not configured on bucket | LOW | Run `gcloud storage buckets update --cors-file` (< 5 min); browser retries after cache expires |
| Hydration mismatch crashes tutorials page | LOW | Add `"use client"` + `dynamic({ ssr: false })` to video component; redeploy |
| `db push` used instead of `migrate dev` | MEDIUM | Create baseline migration, mark applied with `migrate resolve --applied`; commit migration file; per CLAUDE.md recovery pattern |
| Progress saving on `timeupdate` causing DB overload | MEDIUM | Swap event listener to `ended`; purge duplicate `TutorialView` rows; connection pool recovers immediately |
| Videos proxied through Vercel functions timing out | MEDIUM | Move `<video src>` to GCS public URL directly; remove proxy API route; no data migration needed |
| Feedback state leaking across tutorials | LOW | Add `key={tutorialId}` to feedback component; any leaked records in DB can be left (no data integrity risk, just noise) |
| GCS bucket not publicly accessible | LOW | Add `allUsers` IAM binding via `gcloud`; verify in incognito; existing uploads become accessible instantly |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Wrong service account for GCS | GCS Upload Phase | Grep confirms `VERTEX_SERVICE_ACCOUNT_KEY` in all new GCS utilities; upload test succeeds |
| GCS CORS not configured | GCS Upload Phase | Video URL loads without CORS error in Chrome DevTools from production domain |
| Prisma `db push` / no migration | Database Schema Phase | `prisma migrate status` clean; migration files committed; CircleCI `migrate deploy` passes |
| Bucket not publicly readable | GCS Upload Phase | Incognito browser can load video URL; `Public access` column shows "Public" in GCS console |
| HTML5 video SSR hydration mismatch | Tutorial Player UI Phase | No hydration errors in browser console; `dynamic({ ssr: false })` confirmed in component |
| Autoplay policy violation | Tutorial Player UI Phase | Video with `autoPlay` tested in Chrome/Safari; plays muted without console warnings |
| Vercel function video proxying | GCS Upload Phase (data model) | `<video src>` attributes confirmed to point at GCS URLs, not `/api/` routes |
| `timeupdate` DB flood | User Progress Tracking Phase | Network tab shows `ended`-only DB writes during full video playback; no writes during playback |
| Feedback state leaks | Feedback UI Phase | Navigate between 3 tutorials; confirm feedback form is empty each time |
| Feedback userId spoofing | Feedback UI Phase | Server action validated; userId comes from session, not request body |

## Sources

- [Next.js App Router Video Guide](https://nextjs.org/docs/app/guides/videos) — official `<video>` best practices, `preload="none"`, autoplay+muted requirement, `dynamic({ ssr: false })` for player components
- [Next.js Hydration Mismatch Discussion #53020](https://github.com/vercel/next.js/discussions/53020) — video tag as hydration mismatch cause in App Router
- [GCS CORS Configuration](https://docs.cloud.google.com/storage/docs/using-cors) — `gcloud storage buckets update --cors-file`, `Range` header requirement, JSON API vs XML API behavior
- [GCS CORS Configuration Examples](https://docs.cloud.google.com/storage/docs/cors-configurations) — verified configuration patterns for browser media access
- [GCS Uniform Bucket-Level Access](https://docs.cloud.google.com/storage/docs/uniform-bucket-level-access) — IAM vs ACL, `allUsers objectViewer` binding
- [GCS Make Data Public](https://docs.cloud.google.com/storage/docs/access-control/making-data-public) — `gcloud storage buckets add-iam-policy-binding` pattern
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) — 10s Hobby / 60s Pro timeout, 4.5MB response body limit for non-streaming functions
- [Vercel KB: Large Files and Video](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) — confirmed pattern: store in media host, return pre-signed URL, never stream through function
- [Prisma Migrate Deploy Documentation](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate) — `migrate deploy` for production, `migrate dev` for development only
- [Prisma db push → migrate dev reset issue #16141](https://github.com/prisma/prisma/discussions/16141) — `db push` causes `migrate dev` to prompt for reset; confirmed data loss risk
- [MDN: HTMLMediaElement timeupdate event](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event) — fires ~4Hz; throttle required for any server-side handler
- [Video.js timeupdate slow issue #4322](https://github.com/videojs/video.js/issues/4322) — confirmed 250-500ms event fire rate; throttle at 3000ms+ for server calls
- Direct codebase analysis: `apps/agent/src/lib/gcs-thumbnails.ts` uses `env.VERTEX_SERVICE_ACCOUNT_KEY` for all GCS operations — new video utilities must follow this pattern
- Direct codebase analysis: `apps/web/src/lib/supabase/server.ts`, `apps/web/src/middleware.ts` — Supabase session is server-authoritative; Server Actions must read userId from session, not client body
- CLAUDE.md project rules — `VERTEX_SERVICE_ACCOUNT_KEY` for all paid GCP services; `prisma migrate dev` forward-only discipline; never `db push` or `reset`

---
*Pitfalls research for: v1.10 In-App Tutorials & Feedback — GCS video hosting, Next.js video player, progress tracking, feedback collection*
*Researched: 2026-03-20*
