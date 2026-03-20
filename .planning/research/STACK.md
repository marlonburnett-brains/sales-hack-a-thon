# Stack Research

**Domain:** In-app tutorial video browsing, GCS-hosted MP4 playback, user progress tracking, and reusable feedback widget
**Researched:** 2026-03-20
**Confidence:** HIGH (GCS upload, HTML5 video, Radix ToggleGroup) / HIGH (user tracking pattern reuses existing Prisma conventions)

## Scope

This covers only NEW additions/changes for v1.10 (In-App Tutorials & Feedback). The existing stack (Next.js 15, Mastra, Prisma, shadcn/ui, googleapis, Supabase Auth, etc.) is validated and unchanged. Prior STACK.md (2026-03-18) covers v1.9 tutorial video production tooling.

**Focus areas:**
1. GCS upload automation for MP4 videos — scripted upload to existing GCS bucket using existing `googleapis` REST client pattern
2. HTML5 video player for MP4 playback in Next.js 15 — native `<video>` vs third-party
3. User view/progress tracking — Prisma model + Server Action, reusing existing `userId` (Supabase Auth) pattern
4. Reusable feedback widget — segmented control + free-text using existing shadcn/ui primitives

---

## Executive Summary

v1.10 requires **zero new npm packages** in `apps/web`. All four capabilities are achievable with the existing stack:

- **GCS upload**: Extend the existing `googleapis` REST upload pattern from `gcs-thumbnails.ts`. A standalone Node.js/tsx script in `apps/agent/src/scripts/upload-tutorials.ts` uploads MP4s using the same `google.storage({ version: "v1" })` client and `VERTEX_SERVICE_ACCOUNT_KEY`. No `@google-cloud/storage` needed — the REST API pattern is already proven in production.
- **Video player**: Native HTML5 `<video>` tag in a `"use client"` React component. No `react-player` or Video.js needed — GCS-hosted MP4s are direct URLs with no authentication, CORS, or adaptive streaming requirements. Next.js official docs recommend native `<video>` for self-hosted/directly-served files.
- **User view tracking**: Two new Prisma models (`Tutorial` and `TutorialView`) with a Server Action to mark watched. Follows the exact same `userId` (Supabase Auth string) + `createdAt` pattern as `UserGoogleToken`, `UserSetting`, and `UserAtlusToken`.
- **Feedback widget**: `shadcn/ui` `ToggleGroup` (`type="single"`) for the segmented control + a `<Textarea>` for free-text. Already available: `@radix-ui/react-toggle-group` (or the unified `radix-ui` package post Feb-2026). Add `toggle-group` component via `pnpm dlx shadcn@latest add toggle-group`. One new Prisma model (`UserFeedback`).

The upload script is the only genuinely "new" piece — a local `tsx` script run once per release, not a server-side dependency.

---

## Recommended Stack

### Core Technologies (New or Extended)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `googleapis` (existing) | `^144.0.0` (already in agent) | GCS upload of MP4 tutorial videos | Already used in production for GCS thumbnail operations in `gcs-thumbnails.ts`. Pattern: `google.storage({ version: "v1" })` + `storage.objects.insert()` with `predefinedAcl: "publicRead"`. No new package needed. |
| Native HTML5 `<video>` | N/A (browser API) | MP4 playback in Next.js 15 | Next.js official docs recommend native `<video>` for self-hosted/directly served files. GCS public URLs have no auth, CORS, or adaptive streaming requirements. Full control over styling. No SSR hydration mismatch issues. |
| Prisma (existing) | `^6.3.1` (stay on 6.x) | `Tutorial`, `TutorialView`, `UserFeedback` models | Already in production. Forward-only migration per CLAUDE.md discipline. Three new models, no schema changes to existing models. |
| shadcn/ui `toggle-group` (new component) | Radix `@radix-ui/react-toggle-group` (already in node_modules via unified `radix-ui` package) | Segmented control for feedback category selection | Radix `ToggleGroup` with `type="single"` is exactly a segmented control. Primitive already installed. `pnpm dlx shadcn@latest add toggle-group` generates the component file — no new npm package required since Feb 2026 unified radix-ui package update. |

### Supporting Libraries (No New Installs Required)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` (existing in `apps/tutorials`) | `^4.19.0` | Run GCS upload script locally | Script entrypoint: `tsx scripts/upload.ts`. Already installed in `apps/tutorials`. Prefer running as an agent script instead (see Installation section). |
| shadcn/ui `Textarea` (existing) | Radix-based (already in project) | Free-text feedback input | Already exists as a copy-pasted shadcn component in the project. No new install. |
| Sonner (existing) | `^2.0.7` | Toast confirmation after feedback submission | Already installed in `apps/web`. |
| `react-hook-form` (existing) | `^7.71.2` | Optional: form state for feedback widget | Already installed. Prefer `useState` + Server Action for simplicity on a 2-field form; use RHF only if the feedback form grows to 3+ fields. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx` script (one-time per release) | Upload rendered MP4s from `apps/tutorials/output/` to GCS | Run locally: `pnpm --filter agent exec tsx src/scripts/upload-tutorials.ts`. Outputs GCS public URLs for seeding the DB. |
| Prisma migrate dev | Add `Tutorial`, `TutorialView`, `UserFeedback` models | Follow CLAUDE.md: `prisma migrate dev --name add-tutorial-and-feedback-models`. Never `db push`. |

---

## GCS Upload Pattern (Existing `googleapis` Approach)

The project already has a production-proven GCS upload function in `apps/agent/src/lib/gcs-thumbnails.ts`. Use the same pattern for MP4 uploads.

For MP4 videos (50-200MB), use streaming upload rather than buffering the entire file into memory:

```typescript
// apps/agent/src/scripts/upload-tutorials.ts (new script)
import { createReadStream, readdirSync } from "node:fs";
import { google } from "googleapis";
import { env } from "../env";

const BUCKET = env.GCS_TUTORIAL_BUCKET ?? env.GCS_THUMBNAIL_BUCKET!;

function getStorageClient() {
  const credentials = JSON.parse(env.VERTEX_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/devstorage.full_control"],
  });
  return google.storage({ version: "v1", auth });
}

async function uploadMp4(filePath: string, slug: string): Promise<string> {
  const storage = getStorageClient();
  const key = `tutorials/${slug}.mp4`;
  await storage.objects.insert({
    bucket: BUCKET,
    name: key,
    predefinedAcl: "publicRead",
    requestBody: { contentType: "video/mp4", cacheControl: "public, max-age=31536000" },
    media: { mimeType: "video/mp4", body: createReadStream(filePath) },
  });
  return `https://storage.googleapis.com/${BUCKET}/${key}`;
}
```

### ACL Strategy

Use `predefinedAcl: "publicRead"` on upload. The existing bucket already serves thumbnails publicly using public URLs constructed as `https://storage.googleapis.com/${bucket}/${key}` — consistent with the existing pattern. Verify the bucket does not have uniform bucket-level access (which disables object-level ACLs) — if so, the bucket IAM policy already grants allUsers READ, so the `predefinedAcl` parameter is simply ignored.

---

## HTML5 Video Player Decision

**Use native `<video>` tag in a `"use client"` component. No third-party library.**

Rationale:
- GCS public MP4 URLs are direct-serve. No DRM, no adaptive bitrate (HLS/DASH), no YouTube/Vimeo embedding — all the reasons to reach for `react-player` or Video.js don't apply.
- Next.js official documentation explicitly recommends native `<video>` for self-hosted/directly served files and reserves third-party players for advanced needs.
- `react-player` v3.4.0 works with React 19 but requires `"use client"` and adds ~80KB to the bundle for features not needed here.
- Native controls (`controls` attribute) are accessible (keyboard navigation, screen reader compatible) without configuration.
- `preload="metadata"` loads duration without loading the full video — important for a page with multiple tutorials listed.

```tsx
// apps/web/src/components/tutorial-player.tsx
"use client";

interface TutorialPlayerProps {
  src: string;        // GCS public URL: https://storage.googleapis.com/...
  title: string;
  onEnded?: () => void; // trigger mark-watched Server Action
}

export function TutorialPlayer({ src, title, onEnded }: TutorialPlayerProps) {
  return (
    <video
      key={src}            // force remount when switching between tutorials
      controls
      preload="metadata"   // load duration/dimensions, not full video
      playsInline
      className="w-full rounded-lg aspect-video bg-black"
      aria-label={title}
      onEnded={onEnded}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
```

---

## User View Tracking Pattern

Three new Prisma models following existing `userId` (Supabase Auth string) conventions:

```prisma
// New model: Tutorial metadata + GCS URL registry
model Tutorial {
  id           String   @id @default(cuid())
  slug         String   @unique  // e.g., "getting-started", "touch-4-hitl"
  title        String
  description  String?
  groupLabel   String   // e.g., "Getting Started", "Deal Pipeline"
  groupOrder   Int      // sort order of the group
  sequence     Int      // sort order within the group
  gcsUrl       String   // Public GCS URL: https://storage.googleapis.com/...
  durationSecs Int?     // Optional: video duration in seconds
  isNew        Boolean  @default(true)  // drives "New" nav badge; cleared by admin
  publishedAt  DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  views TutorialView[]

  @@index([groupLabel, sequence])
}

// New model: Per-user watched/unwatched state
model TutorialView {
  id         String   @id @default(cuid())
  tutorialId String
  tutorial   Tutorial @relation(fields: [tutorialId], references: [id])
  userId     String   // Supabase Auth user ID (same pattern as UserSetting.userId)
  viewedAt   DateTime @default(now())

  @@unique([tutorialId, userId])  // one record per user per tutorial
  @@index([userId])
  @@index([tutorialId])
}

// New model: Reusable feedback (context field identifies source)
model UserFeedback {
  id          String   @id @default(cuid())
  userId      String   // Supabase Auth user ID
  context     String   // "tutorial" | "feature" | future contexts
  contextId   String?  // Optional: tutorial slug, feature name, etc.
  category    String   // Segmented control value: "helpful" | "not-helpful" | "bug" | "suggestion"
  freeText    String?  // Free-text input (nullable)
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([context, contextId])
}
```

**Server Action pattern** (consistent with existing Next.js 15 Server Actions in the project):

```typescript
// apps/web/src/app/actions/tutorials.ts
"use server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function markTutorialWatched(tutorialId: string) {
  const user = await getUser();
  if (!user) return;
  await prisma.tutorialView.upsert({
    where: { tutorialId_userId: { tutorialId, userId: user.id } },
    create: { tutorialId, userId: user.id },
    update: { viewedAt: new Date() },
  });
}

export async function submitFeedback(data: {
  context: string;
  contextId?: string;
  category: string;
  freeText?: string;
}) {
  const user = await getUser();
  if (!user) return;
  await prisma.userFeedback.create({
    data: { userId: user.id, ...data },
  });
}
```

---

## Feedback Widget Pattern

Use `shadcn/ui` ToggleGroup (segmented control) + Textarea. No new npm packages.

```bash
# Add the component once (generates the file, no new npm install)
pnpm dlx shadcn@latest add toggle-group
```

```tsx
// apps/web/src/components/feedback-widget.tsx
"use client";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { submitFeedback } from "@/app/actions/tutorials";

const CATEGORIES = [
  { value: "helpful", label: "Helpful" },
  { value: "not-helpful", label: "Not Helpful" },
  { value: "bug", label: "Bug" },
  { value: "suggestion", label: "Suggestion" },
] as const;

interface FeedbackWidgetProps {
  context: string;    // "tutorial" | "feature"
  contextId?: string; // tutorial slug or feature name
}

export function FeedbackWidget({ context, contextId }: FeedbackWidgetProps) {
  const [category, setCategory] = useState<string>("");
  const [freeText, setFreeText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!category) return;
    await submitFeedback({ context, contextId, category, freeText: freeText || undefined });
    setSubmitted(true);
    toast.success("Feedback submitted. Thank you!");
  }

  if (submitted) return <p className="text-sm text-muted-foreground">Thank you for your feedback!</p>;

  return (
    <div className="space-y-3">
      <ToggleGroup type="single" value={category} onValueChange={setCategory} variant="outline">
        {CATEGORIES.map((c) => (
          <ToggleGroupItem key={c.value} value={c.value}>{c.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Textarea
        placeholder="Additional details (optional)"
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        rows={3}
      />
      <Button size="sm" onClick={handleSubmit} disabled={!category}>
        Submit Feedback
      </Button>
    </div>
  );
}
```

---

## Installation

```bash
# Step 1: Add shadcn toggle-group component (generates component file, no new npm install)
cd apps/web
pnpm dlx shadcn@latest add toggle-group

# Step 2: Add Prisma migration for new models
cd apps/agent
pnpm prisma migrate dev --name add-tutorial-feedback-models

# Step 3: Add GCS_TUTORIAL_BUCKET env var to apps/agent/.env (optional if reusing GCS_THUMBNAIL_BUCKET)
# GCS_TUTORIAL_BUCKET=your-bucket-name

# Step 4: Run upload script after rendering tutorial MP4s (one-time per release)
pnpm --filter agent exec tsx src/scripts/upload-tutorials.ts
```

No `npm install` of any new package is required. The entire v1.10 feature set is built on the existing dependency graph.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Native `<video>` tag | `react-player` v3.4.0 | If you need YouTube/Vimeo embedding, HLS/DASH adaptive streaming, or cross-browser quirk normalization. None of these apply to direct GCS MP4s. |
| Native `<video>` tag | `video.js` | If you need DRM, live streaming, or a plugin ecosystem. Overkill for static tutorial MP4s. |
| `googleapis` REST (existing) | `@google-cloud/storage` npm package | `@google-cloud/storage` has a cleaner API (`bucket.upload(filePath)` vs manual `objects.insert`) but adds a new package and a new auth initialization pattern. The `googleapis` approach is already proven and doesn't require new credentials setup. Use `@google-cloud/storage` only if switching the entire GCS layer across the project. |
| `shadcn/ui` ToggleGroup | Custom button group with `useState` | If you need pixel-precise visual treatment that ToggleGroup variants don't support. The Radix primitive handles `aria-pressed` accessibility automatically; a custom implementation requires replicating that. |
| Server Action for view tracking | API route + `fetch` | Server Actions are the established Next.js 15 App Router pattern already used in this project. API routes add unnecessary network overhead for fire-and-forget tracking. |
| Single `UserFeedback` model with `context` field | Separate `TutorialFeedback` / `FeatureFeedback` models | Single-model approach keeps the schema lean and makes the feedback widget genuinely reusable across contexts without future schema changes. |
| Agent script for GCS upload | Script in `apps/tutorials` | The agent already has `googleapis`, `VERTEX_SERVICE_ACCOUNT_KEY`, and `env.ts` configured. Adding `googleapis` to `apps/tutorials` would duplicate a heavy dependency. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@google-cloud/storage` npm package | Adds ~2MB new dependency when `googleapis` already handles GCS via REST API in production. Duplicates auth initialization work already done in `gcs-thumbnails.ts`. | `google.storage({ version: "v1", auth })` pattern from existing `gcs-thumbnails.ts` |
| `react-player` / `video.js` | ~80-300KB bundle cost for features (adaptive streaming, platform embeds, plugin ecosystem) that GCS public MP4s don't need. SSR hydration mismatches require `dynamic(() => import(...), { ssr: false })` workaround. | Native `<video>` with `controls` attribute and `"use client"` |
| `@radix-ui/react-themes` Segmented Control | This is a separate opinionated design system package that conflicts with shadcn/ui's Tailwind-based approach. The `SegmentedControl` from `@radix-ui/react-themes` requires wrapping the app in `<Theme>`. | `shadcn/ui` `ToggleGroup` (wraps `@radix-ui/react-toggle-group`, fully compatible with existing Tailwind design system) |
| `prisma db push` | CLAUDE.md discipline: dev DB treated as production. All schema changes via `prisma migrate dev`. | `prisma migrate dev --name add-tutorial-feedback-models` |
| Storing MP4 binary data in PostgreSQL | PostgreSQL is not a video host. Binary blobs in DB cause massive storage costs, slow queries, and connection pool exhaustion on a 50-200MB video. | GCS public URL stored as a `String` in the `Tutorial.gcsUrl` field |
| Time-based "new" logic (e.g., `publishedAt > now() - 7 days`) | Fragile for users who joined recently or rarely log in. Hard to test. | `isNew: Boolean` on `Tutorial` — explicit flag cleared by script or admin action. Simple, deterministic, easy to reason about. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `shadcn/ui` `toggle-group` | `radix-ui` unified package (Feb 2026 update) | As of Feb 2026, shadcn/ui uses the unified `radix-ui` package. `pnpm dlx shadcn@latest add toggle-group` generates a component that imports from `radix-ui`. Both old (`@radix-ui/react-toggle-group`) and new (`radix-ui`) import paths work if both are installed. |
| Prisma `^6.3.1` | Three new models (`Tutorial`, `TutorialView`, `UserFeedback`) | No vector columns; standard Prisma CRUD. Stay on 6.x per CLAUDE.md — Prisma 7.x has vector migration regression (#28867). Migration is forward-only. |
| Native `<video>` | GCS public MP4 URLs | GCS serves MP4 with `Content-Type: video/mp4`. No CORS configuration needed — browser fetches the GCS URL as a cross-origin resource load (standard for `<video src="...">`, not subject to CORS fetch restrictions). No Vercel server-side proxying required. |
| `googleapis ^144.0.0` | `VERTEX_SERVICE_ACCOUNT_KEY` | Use `VERTEX_SERVICE_ACCOUNT_KEY` (NOT `GOOGLE_SERVICE_ACCOUNT_KEY`) for GCS operations per CLAUDE.md credential separation rules. Required OAuth scope: `https://www.googleapis.com/auth/devstorage.full_control`. |

---

## Environment Variables (New)

| Variable | Location | Purpose | Notes |
|----------|----------|---------|-------|
| `GCS_TUTORIAL_BUCKET` | `apps/agent/.env` | GCS bucket name for tutorial MP4s | Can reuse `GCS_THUMBNAIL_BUCKET` with a `tutorials/` key prefix, OR use a dedicated bucket. Add as `z.string().optional()` in `env.ts`. Recommend separate bucket to isolate video storage costs from thumbnail storage. |

---

## Sources

### HIGH Confidence (Official Documentation + Codebase)
- [Next.js Video Guide](https://nextjs.org/docs/app/guides/videos) — Official recommendation: native `<video>` for self-hosted files, `react-player` only for advanced needs. Verified 2026-03-20.
- [shadcn/ui Toggle Group docs](https://ui.shadcn.com/docs/components/radix/toggle-group) — Install command, API, `type="single"` for segmented control behavior. Verified 2026-03-20.
- [Radix UI Toggle Group primitive](https://www.radix-ui.com/primitives/docs/components/toggle-group) — Accessibility (`aria-pressed`), single/multiple selection modes.
- [shadcn/ui February 2026 changelog](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui) — Confirms unified `radix-ui` package adoption in Feb 2026.
- `apps/agent/src/lib/gcs-thumbnails.ts` (codebase) — Production-proven GCS upload pattern using `googleapis` REST API with `VERTEX_SERVICE_ACCOUNT_KEY`. No `@google-cloud/storage` package in use.
- `apps/agent/src/env.ts` (codebase) — Confirmed `VERTEX_SERVICE_ACCOUNT_KEY` is the correct credential for GCS per CLAUDE.md rule.
- `apps/agent/package.json`, `apps/web/package.json` (codebase) — Confirmed no `@google-cloud/storage` or `react-player` installed; all described packages already present.

### MEDIUM Confidence (Verified via Multiple Sources)
- `react-player` v3.4.0 — Current version confirmed via npm search result, React 19 compatible. Rejected because native `<video>` is sufficient.
- GCS `predefinedAcl: "publicRead"` for MP4 upload — Confirmed by multiple Node.js GCS upload guides; consistent with existing `uploadThumbnailToGCS` upload approach.

---
*Stack research for: AtlusDeck v1.10 In-App Tutorials & Feedback*
*Researched: 2026-03-20*
