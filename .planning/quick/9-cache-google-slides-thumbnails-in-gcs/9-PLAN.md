---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/prisma/schema.prisma
  - apps/agent/prisma/migrations/*_add_thumbnail_cache/migration.sql
  - apps/agent/src/lib/gcs-thumbnails.ts
  - apps/agent/src/env.ts
  - apps/agent/src/mastra/index.ts
  - apps/agent/src/ingestion/ingest-template.ts
autonomous: true
requirements: [QUICK-9]

must_haves:
  truths:
    - "GET /templates/:id/thumbnails returns cached GCS URLs without hitting Google Slides API"
    - "Thumbnails are uploaded to GCS during ingestion and stored in SlideEmbedding rows"
    - "Stale or missing thumbnails are re-fetched on demand with TTL check"
  artifacts:
    - path: "apps/agent/src/lib/gcs-thumbnails.ts"
      provides: "GCS upload helper + thumbnail caching logic"
      exports: ["uploadThumbnailToGCS", "cacheThumbnailsForTemplate"]
    - path: "apps/agent/prisma/schema.prisma"
      provides: "thumbnailUrl and thumbnailFetchedAt on SlideEmbedding"
      contains: "thumbnailUrl"
  key_links:
    - from: "apps/agent/src/lib/gcs-thumbnails.ts"
      to: "Google Cloud Storage"
      via: "googleapis google.storage v1 using GOOGLE_APPLICATION_CREDENTIALS"
      pattern: "google\\.storage"
    - from: "apps/agent/src/mastra/index.ts"
      to: "apps/agent/src/lib/gcs-thumbnails.ts"
      via: "import cacheThumbnailsForTemplate"
      pattern: "cacheThumbnailsForTemplate"
---

<objective>
Cache Google Slides thumbnails in GCS to eliminate live Slides API calls from the thumbnail endpoint hot path.

Purpose: The current GET /templates/:id/thumbnails makes rate-limited batch calls to the Slides API on every request (5 slides per 1.5s). Caching in GCS makes thumbnails load instantly and removes Google API quota pressure.

Output: GCS-backed thumbnail cache with DB-stored URLs, automatic population during ingestion, and TTL-based refresh on the read endpoint.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/prisma/schema.prisma (SlideEmbedding model, lines 190-220)
@apps/agent/src/env.ts (env config with GOOGLE_APPLICATION_CREDENTIALS)
@apps/agent/src/lib/google-auth.ts (service account + pooled auth patterns)
@apps/agent/src/mastra/index.ts (GET /templates/:id/thumbnails endpoint, lines 1191-1231)
@apps/agent/src/ingestion/ingest-template.ts (ingestion orchestrator)

<interfaces>
From apps/agent/src/lib/google-auth.ts:
```typescript
export interface GoogleAuthOptions {
  accessToken?: string;
  userId?: string;
}
export function getSlidesClient(options?: GoogleAuthOptions): slides_v1.Slides;
export async function getPooledGoogleAuth(): Promise<PooledAuthResult>;
```

From apps/agent/src/env.ts:
```typescript
export const env = createEnv({
  server: {
    GOOGLE_CLOUD_PROJECT: z.string().min(1),
    GOOGLE_SERVICE_ACCOUNT_KEY: z.string().min(1),
    // GOOGLE_APPLICATION_CREDENTIALS resolved at top of file
  }
})
```

From apps/web/src/lib/api-client.ts:
```typescript
export interface SlideThumbnail {
  slideObjectId: string;
  slideIndex: number;
  thumbnailUrl: string;
}
export async function getSlideThumbnails(templateId: string): Promise<{ thumbnails: SlideThumbnail[] }>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schema migration + GCS thumbnail helper</name>
  <files>
    apps/agent/prisma/schema.prisma,
    apps/agent/prisma/migrations/*_add_thumbnail_cache/migration.sql,
    apps/agent/src/lib/gcs-thumbnails.ts,
    apps/agent/src/env.ts
  </files>
  <action>
1. Add two nullable fields to the SlideEmbedding model in schema.prisma:
   - `thumbnailUrl String?` — the public GCS URL for the cached thumbnail PNG
   - `thumbnailFetchedAt DateTime?` — when the thumbnail was last fetched and cached

2. Run `prisma migrate dev --name add-thumbnail-cache` to create the migration. Per project rules, NEVER use `prisma db push`.

3. Add `GCS_THUMBNAIL_BUCKET` to env.ts as an optional string (z.string().optional()) so the server still starts without it configured. This bucket stores cached slide thumbnails.

4. Create `apps/agent/src/lib/gcs-thumbnails.ts` with:

   a) A `getStorageClient()` function that uses `googleapis` (already installed) to get a `google.storage({ version: 'v1' })` client authenticated via the service account key from `GOOGLE_SERVICE_ACCOUNT_KEY` (same JSON key used elsewhere). Do NOT use `@google-cloud/storage` — use the existing `googleapis` package to avoid new dependencies.

   b) `uploadThumbnailToGCS(bucket: string, key: string, imageBuffer: Buffer, contentType: string): Promise<string>` — uploads a PNG buffer to GCS using the storage API `objects.insert` with `media: { body: Readable.from(imageBuffer) }`. Makes the object publicly readable by setting `predefinedAcl: 'publicRead'` on upload. Returns the public URL: `https://storage.googleapis.com/${bucket}/${key}`.

   c) `cacheThumbnailsForTemplate(templateId: string, presentationId: string, authOptions?: GoogleAuthOptions): Promise<number>` — the main caching function:
      - Query SlideEmbedding rows for the template where `thumbnailUrl IS NULL` OR `thumbnailFetchedAt` is older than a TTL constant (default 7 days)
      - Skip if GCS_THUMBNAIL_BUCKET is not configured (return 0, log warning)
      - For each slide needing a thumbnail: call Slides API `presentations.pages.getThumbnail` to get the `contentUrl`, fetch the image bytes with `fetch()`, upload to GCS at key `slide-thumbnails/${templateId}/${slideObjectId}.png`
      - Batch in groups of 5 with 1500ms delay between batches (matching existing rate-limit pattern)
      - Update the SlideEmbedding row with `thumbnailUrl` and `thumbnailFetchedAt = new Date()`
      - Use Promise.allSettled per batch; log failures but continue
      - Return count of successfully cached thumbnails

   d) Export a `THUMBNAIL_TTL_MS` constant (7 * 24 * 60 * 60 * 1000 = 7 days).
  </action>
  <verify>
    <automated>cd apps/agent && npx prisma migrate status && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - SlideEmbedding has thumbnailUrl and thumbnailFetchedAt columns via forward-only migration
    - GCS helper compiles with no type errors
    - GCS_THUMBNAIL_BUCKET env var registered as optional
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire GCS cache into ingestion and thumbnail endpoint</name>
  <files>
    apps/agent/src/ingestion/ingest-template.ts,
    apps/agent/src/mastra/index.ts
  </files>
  <action>
1. In `apps/agent/src/ingestion/ingest-template.ts`:
   - Import `cacheThumbnailsForTemplate` from `../lib/gcs-thumbnails`
   - After the main ingestion loop completes (after all slides are processed and before returning the IngestResult), add a thumbnail caching step:
     ```
     // Cache thumbnails in GCS (best-effort, non-blocking for ingestion result)
     updateProgress(templateId, { phase: 'thumbnails', current: 0, total: 1 })
     try {
       const cached = await cacheThumbnailsForTemplate(templateId, presentationId, authOptions)
       console.log(`[ingest] Cached ${cached} thumbnails in GCS`)
     } catch (err) {
       console.error('[ingest] Thumbnail caching failed (non-fatal):', err)
     }
     ```
   - This must be best-effort: if GCS is not configured or fails, ingestion still succeeds.
   - Pass the `presentationId` and `authOptions` that are already available in the function scope.

2. In `apps/agent/src/mastra/index.ts`, rewrite the GET `/templates/:id/thumbnails` handler:
   - Import `cacheThumbnailsForTemplate` and `THUMBNAIL_TTL_MS` from the gcs-thumbnails helper
   - First, query SlideEmbedding rows for the template (archived: false, ordered by slideIndex asc)
   - Select: `slideObjectId, slideIndex, thumbnailUrl, thumbnailFetchedAt`
   - Check if ALL rows have a non-null `thumbnailUrl` and `thumbnailFetchedAt` within TTL
   - If yes (cache HIT): return the cached URLs immediately with no Slides API calls. Map to the existing `{ thumbnails: Array<{ slideObjectId, slideIndex, thumbnailUrl }> }` response shape.
   - If no (cache MISS or stale): call `cacheThumbnailsForTemplate(templateId, template.presentationId, googleAuth)` to refresh, then re-query and return the updated URLs
   - For any slides that STILL have no thumbnailUrl after refresh attempt (e.g., GCS not configured), fall back to the original live Slides API fetch for just those slides (preserves backward compat)
   - This ensures the response shape is identical to the current endpoint — no frontend changes needed.
  </action>
  <verify>
    <automated>cd apps/agent && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Ingestion pipeline caches thumbnails to GCS after slide processing
    - Thumbnail endpoint returns cached GCS URLs on cache hit (no Slides API calls)
    - Endpoint falls back to live fetch for uncached slides (backward compat)
    - Response shape unchanged: { thumbnails: SlideThumbnail[] }
    - No frontend changes required
  </done>
</task>

</tasks>

<verification>
1. `cd apps/agent && npx tsc --noEmit` — full type check passes
2. `cd apps/agent && npx prisma migrate status` — migration applied, no drift
3. Manual: Set GCS_THUMBNAIL_BUCKET in .env, re-ingest a template, verify thumbnailUrl populated in DB
4. Manual: Call GET /templates/:id/thumbnails — should return GCS URLs instantly (no 1.5s batch delays)
</verification>

<success_criteria>
- SlideEmbedding model has thumbnailUrl and thumbnailFetchedAt via proper migration
- GCS helper authenticates using the existing service account (GOOGLE_SERVICE_ACCOUNT_KEY via googleapis)
- Thumbnails are cached during ingestion (best-effort, non-fatal)
- GET /templates/:id/thumbnails returns cached URLs instantly on cache hit
- Stale thumbnails (>7 days) are automatically refreshed
- Falls back to live Slides API for slides without cached thumbnails
- No new npm dependencies (uses existing googleapis package)
- Frontend response contract unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/9-cache-google-slides-thumbnails-in-gcs/9-SUMMARY.md`
</output>
