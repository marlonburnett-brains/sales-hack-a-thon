# Phase 71: Database & Video Hosting - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Prisma migration for Tutorial, TutorialView, and AppFeedback models. GCS upload automation for 17 tutorial MP4 files with public URL generation. Database seeding of Tutorial rows from fixture data + upload manifest. This phase delivers the data layer and hosted video assets consumed by all subsequent UI phases.

</domain>

<decisions>
## Implementation Decisions

### Category Assignment
- 17 tutorials mapped to 6 categories using a string enum (not a separate table):
  - **Getting Started** (1): getting-started
  - **Deal Workflows** (4): deals, deal-overview, deal-chat, briefing
  - **Touch Points** (4): touch-1-pager, touch-2-intro-deck, touch-3-capability-deck, touch-4-hitl
  - **Content Management** (4): template-library, slide-library, deck-structures, atlus-integration
  - **Review** (2): asset-review, action-center
  - **Settings & Admin** (2): agent-prompts, google-drive-settings
- Getting Started stays as standalone category (1 tutorial) — it's the entry point
- Category display order follows user workflow: Getting Started → Deal Workflows → Touch Points → Content Management → Review → Settings & Admin

### GCS Bucket & Path Structure
- New dedicated GCS bucket (e.g., `atlusdeck-tutorials`)
- Uniform bucket-level public access — no signed URLs (tutorials aren't sensitive)
- Slug-based filenames matching fixture directory names: `getting-started.mp4`, `touch-1-pager.mp4`, etc.
- Upload script lives in `apps/tutorials/scripts/` alongside existing render/TTS scripts
- Use `VERTEX_SERVICE_ACCOUNT_KEY` for all GCS operations (per project rules)
- GCS bucket must have CORS configured to allow `Range` header for HTML5 video byte-range requests

### Sort Order
- Global integer sortOrder field (1-17) on Tutorial model, not per-category
- Categories already have their own display order; global sort handles position within
- Claude determines logical ordering (simple-to-complex within categories)

### Seed Data Pipeline
- Upload script probes MP4 files for accurate duration (ffprobe or similar)
- Upload script produces `tutorials-manifest.json` with slug, gcsUrl, and duration per video
- Prisma seed mechanism (`prisma db seed`) populates Tutorial rows — upserts for idempotency
- Seed script reads: fixture `script.json` (title, description, step count) + manifest (gcsUrl, duration)
- Category and sortOrder mapping hardcoded inline in seed script (17 static entries)

### Claude's Discretion
- Exact Tutorial/TutorialView/AppFeedback Prisma model field types and constraints
- Upload script implementation details (GCS client library usage)
- ffprobe vs alternative approach for duration extraction
- Manifest file location within apps/tutorials/
- Error handling in upload and seed scripts

</decisions>

<specifics>
## Specific Ideas

- All 3 Prisma models (Tutorial, TutorialView, AppFeedback) in one forward-only migration — no `db push`
- Zero new npm packages required per research findings
- 17 MP4 files range from 5.3MB to 19MB — direct download is sufficient, no streaming needed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/tutorials/scripts/` — existing render.ts, tts.ts, generate.ts scripts provide patterns for new upload script
- `apps/tutorials/fixtures/*/script.json` — 17 fixture files with id, title, description, steps[] ready for seed consumption
- `apps/tutorials/output/videos/*.mp4` — 17 rendered MP4 files ready for GCS upload
- `apps/agent/prisma/schema.prisma` — 24 existing models to extend with Tutorial, TutorialView, AppFeedback

### Established Patterns
- Prisma schema uses string enums for fixed categories (e.g., TouchType pattern)
- Forward-only migrations with `prisma migrate dev --name` (never db push)
- `VERTEX_SERVICE_ACCOUNT_KEY` for all paid GCP services including GCS

### Integration Points
- Tutorial model consumed by Phase 72 (browse page), Phase 73 (playback), Phase 75 (sidebar badge)
- TutorialView model consumed by Phase 73 (progress tracking)
- AppFeedback model consumed by Phase 74 (feedback widget)
- Manifest JSON bridges upload script → seed script data flow

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 71-database-video-hosting*
*Context gathered: 2026-03-20*
