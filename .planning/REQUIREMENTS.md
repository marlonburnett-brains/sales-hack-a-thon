# Requirements: AtlusDeck v1.10

**Defined:** 2026-03-20
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours — not 24 to 120 hours.

## v1.10 Requirements

Requirements for in-app tutorials & feedback. Each maps to roadmap phases.

### Video Hosting

- [x] **HOST-01**: Upload script automates MP4 upload to GCS with public URL generation for all 17 tutorials
- [x] **HOST-02**: Tutorial Prisma model stores metadata (title, description, category, duration, GCS URL, sort order)
- [x] **HOST-03**: Upload script seeds Tutorial records from existing script.json fixtures (title, description, step count)

### Tutorial Browsing

- [ ] **BROWSE-01**: Tutorials nav item in sidebar with "New" dot badge indicating unwatched content
- [ ] **BROWSE-02**: Tutorials page displays cards grouped by category (Getting Started, Deal Workflows, Touch Points, Content Management, Settings & Admin, Review)
- [ ] **BROWSE-03**: Each category group shows completion percentage based on user's watched tutorials
- [ ] **BROWSE-04**: Tutorial cards show title, description, duration, and watched/unwatched visual indicator

### Video Playback

- [ ] **PLAY-01**: User can play tutorial MP4 videos via native HTML5 video player (direct GCS URL, no proxy)
- [ ] **PLAY-02**: Video player renders as client component with SSR disabled to avoid hydration issues
- [ ] **PLAY-03**: User's playback position is saved and restored when returning to a partially-watched video

### Progress Tracking

- [ ] **TRACK-01**: User's watched/unwatched state persists per tutorial in database (marked on video ended event)
- [ ] **TRACK-02**: Watched tutorials display visual checkmark indicator on browse cards
- [ ] **TRACK-03**: Overall progress bar shows "X of 17 tutorials completed" on page header
- [ ] **TRACK-04**: Playback position saved periodically for resume-from-timestamp functionality

### Feedback

- [ ] **FEED-01**: Reusable FeedbackWidget component with segmented control (Tutorial feedback / Feature feedback) and free-text textarea
- [ ] **FEED-02**: FeedbackWidget attached to tutorial player page, keyed per tutorial
- [x] **FEED-03**: AppFeedback Prisma model stores feedback with sourceType, sourceId, feedbackType, and comment
- [ ] **FEED-04**: Feedback system documented for future extension to other pages

## Future Requirements

### Tutorial Browsing (deferred)

- **BROWSE-05**: Text search and category filter for finding specific tutorials
- **BROWSE-06**: Tutorial recommendations based on user role or recent activity

### Feedback (deferred)

- **FEED-05**: Admin page for viewing and managing submitted feedback
- **FEED-06**: Star rating option in addition to segmented control
- **FEED-07**: Screenshot attachment for bug-report style feedback

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video streaming (HLS/DASH) | MP4 files are 5-19MB; direct download is sufficient for this scale |
| Custom video player (Video.js, react-player) | Native HTML5 `<video>` covers all needs; no subtitles or adaptive streaming required |
| Video transcoding/compression | Tutorial videos already rendered at appropriate quality and size |
| Tutorial authoring UI | Tutorials are produced via the apps/tutorials pipeline, not in-app |
| Feedback analytics dashboard | Store only for v1.10; analytics UI deferred to future milestone |
| Video proxy through Vercel | Exceeds serverless function limits (5-19MB files); direct GCS URL required |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOST-01 | Phase 71 | Complete |
| HOST-02 | Phase 71 | Complete |
| HOST-03 | Phase 71 | Complete |
| BROWSE-01 | Phase 75 | Pending |
| BROWSE-02 | Phase 72 | Pending |
| BROWSE-03 | Phase 72 | Pending |
| BROWSE-04 | Phase 72 | Pending |
| PLAY-01 | Phase 73 | Pending |
| PLAY-02 | Phase 73 | Pending |
| PLAY-03 | Phase 73 | Pending |
| TRACK-01 | Phase 73 | Pending |
| TRACK-02 | Phase 73 | Pending |
| TRACK-03 | Phase 73 | Pending |
| TRACK-04 | Phase 73 | Pending |
| FEED-01 | Phase 74 | Pending |
| FEED-02 | Phase 74 | Pending |
| FEED-03 | Phase 71 | Complete |
| FEED-04 | Phase 74 | Pending |

**Coverage:**
- v1.10 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
