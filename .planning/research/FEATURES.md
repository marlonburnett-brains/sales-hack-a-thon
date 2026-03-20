# Feature Research

**Domain:** In-app tutorial video browsing, MP4 playback, user progress tracking, and contextual feedback collection — added to existing enterprise SaaS (AtlusDeck v1.10).
**Researched:** 2026-03-20
**Confidence:** HIGH (patterns are well-established; this is a subsequent milestone onto a known, running codebase with 17 produced MP4s already available)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tutorials nav item in sidebar | Every SaaS with a video help center exposes it in global nav | LOW | Follows existing `navItems` array pattern in `sidebar.tsx`; add href `/tutorials` with a BookOpen or PlayCircle icon from Lucide |
| "New" dot badge on Tutorials nav item | Users expect to know when content has been added since last visit | LOW | Sidebar already renders count badge for Action Required; same `fetch("/api/tutorials/new-count")` pattern; use dot (not count) since badge fatigue hits quickly at small user numbers |
| Tutorial list page with category grouping | 17 videos across distinct feature areas require hierarchy; a flat list is hard to scan | MEDIUM | Categories map to existing feature areas (Getting Started, Deals & Pipeline, Touch Workflows, Content Management, Settings & Config); driven by `category` field on Tutorial DB model |
| Sequential ordering within categories | Users expect an implied learning order (1 before 5); alphabetical or creation-date sort feels arbitrary | LOW | `order` integer on Tutorial DB model; sort within category at query time |
| In-browser MP4 video playback | Standard web behavior for hosted video; users do not expect to download or leave the page | LOW | Native HTML `<video>` element with `controls` attribute is sufficient; no custom player needed for v1.10 |
| Play/pause, progress bar, volume controls | Three fundamental player controls users assume exist on any video player | LOW | Native `<video controls>` provides all three at zero implementation cost |
| Watched / unwatched visual state | Returning users need to know what they have and haven't seen without memorizing | MEDIUM | Requires `TutorialView` DB model (`userId + tutorialId + watchedAt`) and a Server Action to record; UI renders checkmark badge or muted-opacity styling on watched cards |
| Completion recorded on video end event | Marking watched on play-start is premature; users expect completion = they watched it | LOW | Listen to `ended` event on `<video>` element; POST to Server Action; optimistic UI state update |
| Feedback input after watching | Users expect a lightweight way to rate or flag a tutorial; absence signals the team doesn't care | MEDIUM | Segmented control (thumbs up / thumbs down) + optional free-text field; appears after video starts or on video end; submit stores to DB |
| Feedback stored durably | If feedback vanishes on submit, trust is broken | LOW | New `AppFeedback` Prisma model with forward-only migration; confirmed the existing `FeedbackSignal` model is interaction-scoped (deal workflow) and must NOT be reused |

### Differentiators (Competitive Advantage)

Features that go beyond minimum and reinforce the "self-service learnable" goal of v1.10.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Category progress indicator | "3 of 6 watched in Getting Started" — gives users a sense of momentum without requiring a formal LMS-style course | LOW | Count watched vs total per category; render a small `X/Y` or progress pill on each category section header; all data available from TutorialView query |
| Tutorial card shows step count and duration | Users decide whether to watch now vs later based on length; explicit duration sets expectations | LOW | `stepCount` available from TutorialScript schema (length of `steps` array); `durationSeconds` derivable from Remotion timing manifest or embedded in DB during seeding |
| "Next unwatched" nudge per category | If a user watched 1-3 in a category but not 4-6, highlight the next unwatched video to reduce decision friction | MEDIUM | Compute first-in-sequence unwatched per category; style that card distinctly (e.g., blue border, "Continue" label); one additional query join |
| Reusable feedback component supporting two modes | Feedback widget collects tutorial video ratings AND product feature feedback from any page; single shared component with a `context` prop | MEDIUM | `feedbackType` enum field on `AppFeedback` model (`tutorial_video` or `product_feature`); `contextId` is tutorialId for tutorial mode or route path for feature mode; same React component, different prop values |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems at this stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Custom video player (speed, chapters, captions) | "Professional" feel, accessibility compliance | Significant engineering; Remotion MP4s have no subtitle track embedded; custom player needs full accessibility work; native `<video>` is already browser-accessible and responsive | Ship native `<video controls>` for v1.10; add `playbackRate` control only if users request it |
| Resume playback from timestamp | Netflix-like; users may not finish a long tutorial in one sitting | AtlusDeck tutorials are 1-5 min; resume requires tracking `currentTime` per user per video, doubling DB write frequency; cost-benefit is poor at this length | Binary watched/unwatched is sufficient; skip resume entirely |
| Search across tutorials | Discoverability for large libraries | Only 17 videos; category grouping + sequential numbering provides adequate navigation at this scale; search UI adds filter state complexity with negligible benefit | Category tabs or section headers are sufficient navigation |
| Required viewing / forced watch order | LMS-style curriculum with gating | Sellers are experienced professionals; paternalistic UX blocks fast learners; enforcement logic adds complexity and user frustration | Use visual sequencing cues (numbered cards, "Start here" badge) without enforcement |
| In-app admin video upload UI | Allow admins to add tutorials without running CLI | Separate product surface; ~20-seller team runs CLI tooling; v1.10 introduces GCS upload automation from the tutorial pipeline | GCS upload script + DB seeder covers the authoring case; admin upload UI is v2 |
| Push/email notifications for new tutorials | Alert users when content is published | Scope creep into notification infrastructure; 20-user team; "New" dot badge in sidebar is sufficient discovery mechanism | "New" dot badge auto-clears on Tutorials page visit; zero notification infrastructure required |
| Inline feedback widget on every nav item | Collect product feedback throughout the app on any click | Context is too broad — feedback from a random nav click is low-signal noise; creates badge/modal fatigue | Launch feedback on Tutorials page only; extend to specific feature pages in v1.x after proving the feedback model works |

---

## Feature Dependencies

```
[GCS Upload Automation]
    └──required by──> [Tutorial DB records with gcsUrl]
                          └──required by──> [Tutorials Browse Page]
                                                ├──required by──> [MP4 Video Player]
                                                ├──required by──> [Watched/Unwatched State rendering]
                                                └──required by──> [Feedback Collection - tutorial mode]

[Supabase Auth Session (existing)]
    ├──required by──> [Watched/Unwatched State]   (userId association)
    └──required by──> [Feedback Collection]        (userId association)

[Existing Sidebar component]
    └──extended by──> [Tutorials Nav Item + New badge]

[TutorialView DB model (new)]
    ├──required by──> [Watched state rendering on cards]
    ├──required by──> [Category progress indicator]
    └──required by──> ["Next unwatched" nudge]

[AppFeedback DB model (new)]
    └──required by──> [Feedback widget submit]

[Existing FeedbackSignal model]
    └──NOT reused──> (FeedbackSignal is InteractionRecord-scoped; AppFeedback is user-scoped with no deal association)
```

### Dependency Notes

- **GCS upload is the first dependency.** Tutorial DB records need `gcsUrl` before any in-app feature renders playable video. Upload automation must run (or be mocked with seeded data) before browse page development.
- **Tutorial DB model gates everything.** Browse, playback, watched state, and feedback all depend on Tutorial rows with valid metadata (title, description, category, order, stepCount, durationSeconds, gcsUrl). Seed this table early.
- **TutorialView model is a new Prisma migration.** Watched/unwatched rendering requires `TutorialView` rows per user. Forward-only migration per CLAUDE.md discipline.
- **AppFeedback is independent of watched state.** A user can submit feedback without having their view tracked. Decouple the two DB writes entirely.
- **Existing FeedbackSignal must NOT be reused.** That model requires an `interactionId` FK to `InteractionRecord` (deal workflow). Tutorial/product feedback has no deal context. A standalone `AppFeedback` model is correct.
- **Sidebar "New" badge** depends on a cheap API route: count of Tutorial rows with `createdAt` newer than user's `lastTutorialVisitAt`. Requires either a `lastTutorialVisitAt` field on User or a simpler heuristic (tutorials created in last 14 days that user has no TutorialView for).
- **Category progress indicator and "Next unwatched" nudge** both depend on TutorialView existing and are additive — they can be deferred to a second iteration within the milestone.

---

## MVP Definition

### Launch With (v1.10)

Minimum to make the platform "self-service learnable" as stated in PROJECT.md v1.10 goal.

- [ ] GCS upload automation uploads all 17 MP4s and stores public URLs — without this, nothing else is playable
- [ ] Tutorial DB model seeded with all 17 tutorials: `id`, `slug`, `title`, `description`, `category`, `order`, `stepCount`, `durationSeconds`, `gcsUrl`, `createdAt`
- [ ] Tutorials page (`/tutorials`) with category-grouped layout, card-per-video, sequential order within category
- [ ] Tutorials nav item in sidebar with "New" dot badge (dot, not count — avoids notification fatigue)
- [ ] In-browser MP4 player using native `<video controls>` — opened in a modal or dedicated `/tutorials/[slug]` route
- [ ] TutorialView DB model: record `userId + tutorialId + watchedAt` on video `ended` event via Server Action
- [ ] Watched visual state on tutorial cards (checkmark icon overlay or "Watched" label)
- [ ] AppFeedback DB model: `id`, `userId`, `feedbackType` (tutorial_video | product_feature), `contextId`, `rating` (thumbs_up | thumbs_down), `freeText?`, `createdAt`
- [ ] Feedback widget on tutorial player page: segmented thumbs-up/down control + optional free-text textarea + submit button; visible after video starts or on video end

### Add After Validation (v1.x)

- [ ] Category progress indicator ("3 of 6 watched") — add when users express desire to track overall progress
- [ ] "Next unwatched" nudge per category — add when analytics show users stall after first video
- [ ] Feature feedback widget extended to other pages (Settings, Templates, Deals) — add after tutorial feedback proves the model works
- [ ] Feedback summary view in Settings — add when feedback volume justifies a UI for review

### Future Consideration (v2+)

- [ ] Custom video player with playback speed control — only if users explicitly request it
- [ ] Resume-from-timestamp — only if tutorial durations grow beyond 10 minutes
- [ ] In-app admin video upload UI — only if the GCS CLI script becomes a team bottleneck
- [ ] Email/push notification for new tutorials — only if user count scales beyond ~50 and discovery becomes a problem

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| GCS upload automation + DB seeding | HIGH | LOW | P1 |
| Tutorial browse page with categories | HIGH | LOW | P1 |
| Tutorials sidebar nav item | HIGH | LOW | P1 |
| "New" dot badge on nav item | MEDIUM | LOW | P1 |
| Native MP4 video player | HIGH | LOW | P1 |
| Watched/unwatched state (TutorialView) | HIGH | MEDIUM | P1 |
| Feedback widget (tutorial page) | MEDIUM | MEDIUM | P1 |
| AppFeedback DB model | MEDIUM | LOW | P1 |
| Category progress indicator | MEDIUM | LOW | P2 |
| "Next unwatched" nudge | MEDIUM | MEDIUM | P2 |
| Feature feedback on other pages | LOW | LOW | P2 |
| Feedback admin summary view | LOW | HIGH | P3 |
| Custom video player | LOW | HIGH | P3 |

**Priority key:** P1 = v1.10 launch requirement, P2 = add after core validation, P3 = future consideration

---

## Competitor Feature Analysis

Reference products: Loom (video library + viewed state), Intercom Product Tours (in-app learning), Sentry (in-app feedback widget), Appcues (onboarding + NPS), Notion Help (embedded video).

| Feature | Loom | Intercom | Sentry | Our Approach |
|---------|------|----------|--------|--------------|
| Video grouping | Collections (folders) | Checklist groups | N/A | `category` field on DB model; section headers on page |
| Viewed state | Green dot / "Viewed" label on cards | Checklist checkmark per item | N/A | Checkmark overlay on card; binary watched/unwatched via TutorialView |
| Video player | Custom player with chapters | Embedded iframe | N/A | Native `<video controls>`; zero dependency, fully accessible |
| Feedback | Reactions + comments | NPS modal post-tour | Screenshot + free text | Segmented thumbs-up/down + optional free text; no screenshot needed for tutorial feedback |
| Nav badge | None | Red dot on chat widget | N/A | "New" dot badge; same implementation as existing Action Required badge in sidebar.tsx |
| Resume playback | Auto on re-open | N/A | N/A | Not in v1.10; tutorials are short-form (1-5 min) |
| Progress tracking | "Viewed X of Y" per collection | Checklist % completion | N/A | Category progress indicator (P2, not P1) |

---

## Dependency on Existing Codebase

| New Feature | Depends On (Existing) | Integration Point |
|-------------|----------------------|-------------------|
| Tutorials nav item + badge | `sidebar.tsx` navItems array, `fetch("/api/actions/count")` pattern | Add to navItems; add `/api/tutorials/new-count` route |
| Tutorials page | Next.js route group `(authenticated)`, Server Actions pattern | New `/tutorials` route under `app/(authenticated)/` |
| Video playback | GCS public URLs (new), Next.js page/modal | Native `<video src={gcsUrl} controls>` |
| Watched state | Supabase Auth session (existing), Prisma (existing) | New `TutorialView` model; Server Action records view |
| Feedback widget | Supabase Auth session (existing), Prisma (existing), shadcn/ui components (existing) | New `AppFeedback` model; Sonner toast on submit (existing) |
| GCS upload | GCS bucket config (existing for thumbnails in v1.5), `VERTEX_SERVICE_ACCOUNT_KEY` (existing) | New upload script using same GCS client pattern |

---

## Sources

- Existing codebase: `/apps/web/src/components/sidebar.tsx` — badge pattern, navItems structure, fetch-on-pathname pattern
- Existing codebase: `/apps/agent/prisma/schema.prisma` — confirmed `FeedbackSignal` is interaction-scoped; `AppFeedback` must be a separate model
- Existing codebase: `/apps/tutorials/src/types/tutorial-script.ts` — TutorialScript schema providing title, description, steps (for stepCount)
- Existing codebase: `/apps/tutorials/fixtures/` — 17 fixture directories confirming all tutorial slugs
- Existing codebase: `/apps/tutorials/output/videos/` — 17 MP4 files confirmed ready for GCS upload
- [SitePoint: Video Player UX Design](https://www.sitepoint.com/how-to-design-your-video-player-with-ux-in-mind/)
- [DEV Community: Tracking Video Watch Progress with JavaScript](https://dev.to/coaste/tracking-video-watch-progress-with-javascript-2j5j)
- [Gleap: In-App Feedback Widgets Guide 2026](https://www.gleap.io/blog/in-app-feedback-widgets-guide)
- [Salesforce Lightning Design System: In-App Feedback Patterns](https://www.lightningdesignsystem.com/guidelines/in-app-feedback/patterns/)
- [Material Design 3: Badges](https://m3.material.io/components/badges)
- [PatternFly: Notification Badge Design Guidelines](https://www.patternfly.org/components/notification-badge/design-guidelines/)
- [UserGuiding: Video Onboarding Guide](https://userguiding.com/blog/video-onboarding)
- [Qualaroo: In-App Feedback Strategies](https://qualaroo.com/blog/in-app-feedback-strategies/)

---
*Feature research for: In-app tutorial video browsing, playback, progress tracking, and feedback collection (AtlusDeck v1.10)*
*Researched: 2026-03-20*
