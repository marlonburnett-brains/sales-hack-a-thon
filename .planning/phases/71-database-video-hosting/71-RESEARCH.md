# Phase 71: Database & Video Hosting - Research

**Researched:** 2026-03-20
**Domain:** Prisma migrations, GCS upload automation, database seeding
**Confidence:** HIGH

## Summary

Phase 71 is a data-layer-only phase: three new Prisma models (Tutorial, TutorialView, AppFeedback) via a single forward-only migration, a GCS upload script for 17 MP4 files, and a seed script that populates Tutorial rows from fixture data merged with an upload manifest. No UI work is involved.

The project already has a mature GCS integration pattern using the `googleapis` library (not `@google-cloud/storage`) with `VERTEX_SERVICE_ACCOUNT_KEY` credentials. The existing `gcs-thumbnails.ts` provides a proven upload helper that can be directly referenced. All 17 MP4 files exist locally in `apps/tutorials/output/videos/` (5.3MB to 19.7MB). ffprobe v8.1 is available locally for duration extraction. The existing `prisma/seed.ts` uses upsert patterns for idempotency.

**Primary recommendation:** Follow existing `googleapis` GCS patterns from `gcs-thumbnails.ts`, create all three models in a single migration, and use ffprobe for accurate duration extraction in the upload script.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- 17 tutorials mapped to 6 categories using a string enum (not a separate table): Getting Started, Deal Workflows, Touch Points, Content Management, Review, Settings & Admin
- Category display order follows user workflow: Getting Started -> Deal Workflows -> Touch Points -> Content Management -> Review -> Settings & Admin
- New dedicated GCS bucket (e.g., `atlusdeck-tutorials`) with uniform bucket-level public access
- Slug-based filenames matching fixture directory names: `getting-started.mp4`, `touch-1-pager.mp4`, etc.
- Upload script lives in `apps/tutorials/scripts/` alongside existing render/TTS scripts
- Use `VERTEX_SERVICE_ACCOUNT_KEY` for all GCS operations
- GCS bucket must have CORS configured to allow `Range` header for HTML5 video byte-range requests
- Global integer sortOrder field (1-17) on Tutorial model, not per-category
- Upload script probes MP4 files for accurate duration (ffprobe or similar)
- Upload script produces `tutorials-manifest.json` with slug, gcsUrl, and duration per video
- Prisma seed mechanism (`prisma db seed`) populates Tutorial rows -- upserts for idempotency
- Seed script reads: fixture `script.json` (title, description, step count) + manifest (gcsUrl, duration)
- Category and sortOrder mapping hardcoded inline in seed script (17 static entries)
- All 3 Prisma models (Tutorial, TutorialView, AppFeedback) in one forward-only migration -- no `db push`
- Zero new npm packages required

### Claude's Discretion
- Exact Tutorial/TutorialView/AppFeedback Prisma model field types and constraints
- Upload script implementation details (GCS client library usage)
- ffprobe vs alternative approach for duration extraction
- Manifest file location within apps/tutorials/
- Error handling in upload and seed scripts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HOST-01 | Upload script automates MP4 upload to GCS with public URL generation for all 17 tutorials | GCS upload pattern from `gcs-thumbnails.ts` using `googleapis` library; all 17 MP4 files confirmed present in `apps/tutorials/output/videos/` |
| HOST-02 | Tutorial Prisma model stores metadata (title, description, category, duration, GCS URL, sort order) | Prisma schema patterns from existing 24 models; string category enum matching project conventions |
| HOST-03 | Upload script seeds Tutorial records from existing script.json fixtures (title, description, step count) | 17 fixture directories confirmed with `script.json` files containing id, title, description, steps[] |
| FEED-03 | AppFeedback Prisma model stores feedback with sourceType, sourceId, feedbackType, and comment | Generic feedback model design; no FK to Tutorial (sourceType+sourceId pattern for extensibility) |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | ^144.0.0 | GCS upload via `google.storage({ version: "v1" })` | Already used in project for GCS thumbnails -- proven pattern |
| `@prisma/client` | ^6.3.1 | ORM for Tutorial, TutorialView, AppFeedback models | Existing project ORM with 24 models |
| `tsx` | ^4.19.0 | TypeScript script execution for upload/seed | Already used in tutorials package for all scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ffprobe` (system) | 8.1 | MP4 duration extraction | In upload script before GCS upload |
| `child_process` (node built-in) | -- | Spawn ffprobe for duration probing | `execFile('ffprobe', ...)` in upload script |
| `google-auth-library` | ^9.15.1 | Auth for GCS (already in agent deps) | Referenced by googleapis internally |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `googleapis` | `@google-cloud/storage` | googleapis already in project; adding @google-cloud/storage is unnecessary dependency |
| `ffprobe` (CLI) | Read MP4 moov atom directly | ffprobe is already installed and reliable; parsing moov atoms is fragile |

**Installation:**
```bash
# No new packages needed -- all dependencies already present
```

## Architecture Patterns

### Recommended Project Structure
```
apps/tutorials/scripts/
  upload-to-gcs.ts       # Upload 17 MP4s, probe durations, write manifest
apps/tutorials/output/
  tutorials-manifest.json # Generated by upload script (slug, gcsUrl, durationSec)
apps/agent/prisma/
  schema.prisma           # Add Tutorial, TutorialView, AppFeedback models
  seed.ts                 # Extend with tutorial seed logic
  migrations/
    YYYYMMDD_add_tutorials/ # Single migration for all 3 models
```

### Pattern 1: GCS Upload via googleapis (Existing Project Pattern)
**What:** Use `google.storage({ version: "v1" })` with `VERTEX_SERVICE_ACCOUNT_KEY` credentials
**When to use:** All GCS operations in this project
**Example:**
```typescript
// Source: apps/agent/src/lib/gcs-thumbnails.ts (lines 30-37)
function getStorageClient() {
  const credentials = JSON.parse(process.env.VERTEX_SERVICE_ACCOUNT_KEY!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/devstorage.full_control"],
  });
  return google.storage({ version: "v1", auth });
}
```

**Upload pattern:**
```typescript
// Source: apps/agent/src/lib/gcs-thumbnails.ts (lines 46-66)
async function uploadToGCS(bucket: string, key: string, body: Readable, contentType: string): Promise<string> {
  const storage = getStorageClient();
  await storage.objects.insert({
    bucket,
    name: key,
    requestBody: { contentType, cacheControl: "public, max-age=604800" },
    media: { mimeType: contentType, body },
  });
  return `https://storage.googleapis.com/${bucket}/${key}`;
}
```

### Pattern 2: ffprobe Duration Extraction
**What:** Use ffprobe CLI to get accurate video duration in seconds
**When to use:** Before uploading, to capture duration for manifest
**Example:**
```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function getVideoDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ]);
  return Math.round(parseFloat(stdout.trim()));
}
```

### Pattern 3: Prisma Upsert for Idempotent Seeding
**What:** Upsert on unique slug to make seed re-runnable
**When to use:** `prisma db seed` for Tutorial records
**Example:**
```typescript
// Source: apps/agent/prisma/seed.ts (lines 117-130) -- existing ContentSource pattern
await prisma.tutorial.upsert({
  where: { slug: "getting-started" },
  update: { gcsUrl, durationSec, title, description },
  create: { slug, title, description, category, gcsUrl, durationSec, sortOrder, stepCount },
});
```

### Pattern 4: Manifest JSON as Data Bridge
**What:** Upload script produces JSON that seed script consumes
**When to use:** Decoupling GCS upload from database seeding
**Example:**
```typescript
// tutorials-manifest.json
[
  { "slug": "getting-started", "gcsUrl": "https://storage.googleapis.com/atlusdeck-tutorials/getting-started.mp4", "durationSec": 48 },
  // ... 16 more entries
]
```

### Anti-Patterns to Avoid
- **Using `prisma db push`:** NEVER. Always `prisma migrate dev --name <name>` per CLAUDE.md
- **Using `GOOGLE_SERVICE_ACCOUNT_KEY` for GCS:** NEVER. Always `VERTEX_SERVICE_ACCOUNT_KEY` per CLAUDE.md
- **Using `prisma migrate reset`:** NEVER. Forward-only migrations only
- **Hardcoding GCS URLs in seed script:** Bad -- read from manifest produced by upload script
- **Creating separate migrations per model:** Unnecessary -- all 3 models in one migration is cleaner

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video duration | Parse MP4 moov atom | `ffprobe -show_entries format=duration` | MP4 container format is complex; ffprobe handles all edge cases |
| GCS authentication | Manual JWT signing | `google.auth.GoogleAuth` with service account JSON | Project pattern; handles token refresh automatically |
| GCS upload | Raw HTTP multipart | `googleapis` `storage.objects.insert` | Already proven in `gcs-thumbnails.ts` with streaming support |
| URL construction | Manual bucket/path concatenation | Pattern: `https://storage.googleapis.com/${bucket}/${key}` | Standard GCS public URL format, used throughout project |

**Key insight:** The entire GCS integration is already solved in `apps/agent/src/lib/gcs-thumbnails.ts`. The upload script needs to replicate this pattern, not invent a new one. The only new code is the ffprobe-based duration probing and manifest generation.

## Common Pitfalls

### Pitfall 1: Forgetting CORS Configuration on GCS Bucket
**What goes wrong:** HTML5 `<video>` tag with `Range` header requests gets blocked by CORS
**Why it happens:** GCS buckets have no CORS policy by default; byte-range requests use `Range` header
**How to avoid:** Configure CORS on the bucket immediately after creation
**Warning signs:** Videos load in direct browser navigation but fail in `<video>` tag

```bash
# cors.json
[{"origin": ["*"], "method": ["GET", "HEAD"], "responseHeader": ["Content-Type", "Content-Range", "Accept-Ranges", "Content-Length"], "maxAgeSeconds": 3600}]

gsutil cors set cors.json gs://atlusdeck-tutorials
```

### Pitfall 2: Using `db push` Instead of Migration
**What goes wrong:** Migration history gets out of sync with actual database state
**Why it happens:** `db push` is faster for prototyping but violates project discipline
**How to avoid:** Always use `prisma migrate dev --name add-tutorial-models`
**Warning signs:** `prisma migrate dev` fails with "drift detected"

### Pitfall 3: Large File Upload Timeouts
**What goes wrong:** 15-20MB MP4 uploads timeout on slow connections
**Why it happens:** Default HTTP timeout may be insufficient for large media uploads
**How to avoid:** Use streaming upload (Readable.from fs stream) and increase timeout; process files sequentially not all in parallel
**Warning signs:** ECONNRESET or timeout errors on larger files

### Pitfall 4: Seed Script Running Before Upload
**What goes wrong:** Seed script fails because manifest file doesn't exist yet
**Why it happens:** Upload and seed are separate steps; developer runs seed first
**How to avoid:** Seed script should check for manifest existence and give clear error message
**Warning signs:** `ENOENT tutorials-manifest.json`

### Pitfall 5: Missing Uniform Bucket-Level Public Access
**What goes wrong:** Uploaded objects aren't publicly accessible despite being in a "public" bucket
**Why it happens:** GCS has both uniform and fine-grained IAM; uniform must be explicitly enabled
**How to avoid:** Enable uniform bucket-level access and set `allUsers` as `objectViewer`
**Warning signs:** 403 Forbidden when accessing `https://storage.googleapis.com/bucket/file.mp4`

## Code Examples

### Recommended Prisma Models

```prisma
// Tutorial: stores metadata for each tutorial video
model Tutorial {
  id          String   @id @default(cuid())
  slug        String   @unique  // e.g., "getting-started", "deal-chat"
  title       String             // From script.json
  description String             // From script.json
  category    String             // "getting_started" | "deal_workflows" | "touch_points" | "content_management" | "review" | "settings_admin"
  gcsUrl      String             // https://storage.googleapis.com/atlusdeck-tutorials/getting-started.mp4
  durationSec Int                // Seconds, from ffprobe
  sortOrder   Int                // Global 1-17
  stepCount   Int      @default(0)  // Number of steps from script.json
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  views       TutorialView[]

  @@index([category])
  @@index([sortOrder])
}

// TutorialView: tracks per-user watch progress
model TutorialView {
  id           String   @id @default(cuid())
  tutorialId   String
  tutorial     Tutorial @relation(fields: [tutorialId], references: [id])
  userId       String   // Supabase auth user ID
  watched      Boolean  @default(false)  // true when video "ended" event fires
  lastPosition Float    @default(0)      // Seconds into video for resume
  watchedAt    DateTime?                 // When marked as watched
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([tutorialId, userId])
  @@index([userId])
}

// AppFeedback: generic feedback store (extensible beyond tutorials)
model AppFeedback {
  id           String   @id @default(cuid())
  sourceType   String   // "tutorial" | (future: "feature", "page", etc.)
  sourceId     String   // Tutorial ID or other entity ID
  feedbackType String   // "tutorial_feedback" | "feature_feedback"
  comment      String   // Free-text feedback
  userId       String?  // Supabase auth user ID (nullable for anonymous)
  createdAt    DateTime @default(now())

  @@index([sourceType, sourceId])
  @@index([userId])
}
```

### Category Mapping (for seed script)

```typescript
const TUTORIAL_CATALOG: Array<{
  slug: string;
  category: string;
  sortOrder: number;
}> = [
  // Getting Started (1)
  { slug: "getting-started",        category: "getting_started",      sortOrder: 1 },
  // Deal Workflows (4)
  { slug: "deals",                  category: "deal_workflows",       sortOrder: 2 },
  { slug: "deal-overview",          category: "deal_workflows",       sortOrder: 3 },
  { slug: "deal-chat",              category: "deal_workflows",       sortOrder: 4 },
  { slug: "briefing",               category: "deal_workflows",       sortOrder: 5 },
  // Touch Points (4)
  { slug: "touch-1-pager",          category: "touch_points",         sortOrder: 6 },
  { slug: "touch-2-intro-deck",     category: "touch_points",         sortOrder: 7 },
  { slug: "touch-3-capability-deck",category: "touch_points",         sortOrder: 8 },
  { slug: "touch-4-hitl",           category: "touch_points",         sortOrder: 9 },
  // Content Management (4)
  { slug: "template-library",       category: "content_management",   sortOrder: 10 },
  { slug: "slide-library",          category: "content_management",   sortOrder: 11 },
  { slug: "deck-structures",        category: "content_management",   sortOrder: 12 },
  { slug: "atlus-integration",      category: "content_management",   sortOrder: 13 },
  // Review (2)
  { slug: "asset-review",           category: "review",               sortOrder: 14 },
  { slug: "action-center",          category: "review",               sortOrder: 15 },
  // Settings & Admin (2)
  { slug: "agent-prompts",          category: "settings_admin",       sortOrder: 16 },
  { slug: "google-drive-settings",  category: "settings_admin",       sortOrder: 17 },
];
```

### Upload Script Structure

```typescript
// apps/tutorials/scripts/upload-to-gcs.ts
// 1. Read VERTEX_SERVICE_ACCOUNT_KEY from env
// 2. Create googleapis storage client
// 3. For each of 17 MP4 files:
//    a. Run ffprobe to get duration
//    b. Upload to GCS bucket with slug-based key
//    c. Collect { slug, gcsUrl, durationSec }
// 4. Write tutorials-manifest.json
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@google-cloud/storage` npm package | `googleapis` storage v1 API | Project convention | One fewer dependency; consistent with existing `gcs-thumbnails.ts` |
| Signed URLs for media | Uniform bucket-level public access | Decision for tutorials | No URL expiration; simpler architecture |
| `db push` for dev | `prisma migrate dev --name` always | Project rule (CLAUDE.md) | Forward-only migration history preserved |

**Deprecated/outdated:**
- `prisma db push`: Banned in this project per CLAUDE.md
- `prisma migrate reset`: Banned in this project per CLAUDE.md

## Open Questions

1. **GCS bucket name**
   - What we know: Context says "e.g., `atlusdeck-tutorials`"
   - What's unclear: Exact bucket name to use (must be globally unique)
   - Recommendation: Use `atlusdeck-tutorials` if available; script should read from env var `GCS_TUTORIAL_BUCKET`

2. **Env var location for upload script**
   - What we know: Upload script is in `apps/tutorials/scripts/`, but `VERTEX_SERVICE_ACCOUNT_KEY` is in `apps/agent/.env`
   - What's unclear: How upload script accesses the env var
   - Recommendation: Upload script reads from `dotenv` loading `apps/agent/.env` or accepts env var directly; document in script comments

## Sources

### Primary (HIGH confidence)
- `apps/agent/src/lib/gcs-thumbnails.ts` -- Existing GCS upload pattern using googleapis
- `apps/agent/prisma/schema.prisma` -- 24 existing models showing Prisma conventions
- `apps/agent/prisma/seed.ts` -- Existing upsert-based seeding pattern
- `apps/tutorials/fixtures/*/script.json` -- 17 fixture files with title, description, steps
- `apps/tutorials/output/videos/*.mp4` -- 17 MP4 files confirmed present (5.3-19.7MB)
- `apps/agent/src/env.ts` -- VERTEX_SERVICE_ACCOUNT_KEY validation pattern
- `CLAUDE.md` -- Project rules for migrations and GCS credentials

### Secondary (MEDIUM confidence)
- GCS CORS configuration for Range headers (standard GCS documentation)
- ffprobe CLI flags for duration extraction (standard ffmpeg documentation)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, patterns verified in source code
- Architecture: HIGH -- follows existing project patterns exactly (gcs-thumbnails.ts, seed.ts)
- Pitfalls: HIGH -- CORS and migration pitfalls verified from project rules and GCS documentation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain, no fast-moving dependencies)
