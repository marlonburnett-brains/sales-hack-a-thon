/**
 * GCS Thumbnail Cache
 *
 * Caches Google Slides page thumbnails in Google Cloud Storage to avoid
 * hitting the Slides API on every thumbnail request. Thumbnails are
 * uploaded as publicly-readable PNGs and their URLs stored in the
 * SlideEmbedding table for instant retrieval.
 */

import { Readable } from "node:stream";
import { google } from "googleapis";
import { prisma } from "./db";
import { getDriveClient, getSlidesClient, type GoogleAuthOptions } from "./google-auth";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

/** How long a cached thumbnail is considered fresh (7 days). */
export const THUMBNAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 3000; // stay under Slides API "expensive read" quota (60/min)

// ────────────────────────────────────────────────────────────
// GCS Client (googleapis, NOT @google-cloud/storage)
// ────────────────────────────────────────────────────────────

function getStorageClient() {
  const credentials = JSON.parse(env.VERTEX_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/devstorage.full_control"],
  });
  return google.storage({ version: "v1", auth });
}

// ────────────────────────────────────────────────────────────
// Upload helper
// ────────────────────────────────────────────────────────────

/**
 * Upload a PNG buffer to GCS and return its public URL.
 */
export async function uploadThumbnailToGCS(
  bucket: string,
  key: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<string> {
  const storage = getStorageClient();
  await storage.objects.insert({
    bucket,
    name: key,
    requestBody: {
      contentType,
      cacheControl: "public, max-age=604800", // 7 days
    },
    media: {
      mimeType: contentType,
      body: Readable.from(imageBuffer),
    },
  });
  return `https://storage.googleapis.com/${bucket}/${key}`;
}

// ────────────────────────────────────────────────────────────
// Main caching function
// ────────────────────────────────────────────────────────────

/**
 * Fetch and cache thumbnails for all slides in a template.
 *
 * - Skips slides that already have a fresh (< TTL) cached URL.
 * - Uploads PNGs to GCS at `slide-thumbnails/{templateId}/{slideObjectId}.png`.
 * - Returns the number of thumbnails successfully cached.
 * - Returns 0 (with a warning) if GCS_THUMBNAIL_BUCKET is not configured.
 */
export async function cacheThumbnailsForTemplate(
  templateId: string,
  presentationId: string,
  authOptions?: GoogleAuthOptions
): Promise<number> {
  const bucket = env.GCS_THUMBNAIL_BUCKET;
  if (!bucket) {
    console.warn(
      "[gcs-thumbnails] GCS_THUMBNAIL_BUCKET not configured, skipping thumbnail caching"
    );
    return 0;
  }

  const ttlCutoff = new Date(Date.now() - THUMBNAIL_TTL_MS);

  // Find slides needing a thumbnail refresh
  const slides = await prisma.slideEmbedding.findMany({
    where: {
      templateId,
      archived: false,
      slideObjectId: { not: null },
      OR: [
        { thumbnailUrl: null },
        { thumbnailFetchedAt: null },
        { thumbnailFetchedAt: { lt: ttlCutoff } },
      ],
    },
    select: {
      id: true,
      slideObjectId: true,
      slideIndex: true,
    },
    orderBy: { slideIndex: "asc" },
  });

  if (slides.length === 0) {
    console.log("[gcs-thumbnails] All thumbnails are fresh, nothing to cache");
    return 0;
  }

  console.log(
    `[gcs-thumbnails] Caching ${slides.length} thumbnails for template ${templateId}`
  );

  const slidesApi = getSlidesClient(authOptions);
  let cached = 0;

  // Process in batches to respect Slides API rate limits
  for (let i = 0; i < slides.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));

    const batch = slides.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (slide) => {
        const slideObjectId = slide.slideObjectId!;

        // 1. Get thumbnail URL from Slides API
        const thumbResult =
          await slidesApi.presentations.pages.getThumbnail({
            presentationId,
            pageObjectId: slideObjectId,
            "thumbnailProperties.thumbnailSize": "LARGE",
          });

        const contentUrl = thumbResult.data.contentUrl;
        if (!contentUrl) {
          throw new Error(
            `No contentUrl returned for slide ${slideObjectId}`
          );
        }

        // 2. Fetch the image bytes
        const response = await fetch(contentUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch thumbnail image: ${response.status} ${response.statusText}`
          );
        }
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        // 3. Upload to GCS
        const gcsKey = `slide-thumbnails/${templateId}/${slideObjectId}.png`;
        const gcsUrl = await uploadThumbnailToGCS(
          bucket,
          gcsKey,
          imageBuffer,
          "image/png"
        );

        // 4. Update DB row
        await prisma.slideEmbedding.update({
          where: { id: slide.id },
          data: {
            thumbnailUrl: gcsUrl,
            thumbnailFetchedAt: new Date(),
          },
        });

        return gcsUrl;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        cached++;
      } else {
        console.error(
          "[gcs-thumbnails] Failed to cache thumbnail:",
          r.reason?.message ?? r.reason
        );
      }
    }
  }

  console.log(
    `[gcs-thumbnails] Cached ${cached}/${slides.length} thumbnails`
  );
  return cached;
}

// ────────────────────────────────────────────────────────────
// Generated presentation thumbnails
// ────────────────────────────────────────────────────────────

export interface PresentationThumbnail {
  slideIndex: number;
  slideObjectId: string;
  thumbnailUrl: string;
}

/**
 * Check GCS for existing cached thumbnails of a generated presentation.
 * Returns array of thumbnail URLs if they exist and are fresh, null otherwise.
 */
export async function checkPresentationThumbnails(
  presentationId: string,
): Promise<PresentationThumbnail[] | null> {
  const bucket = env.GCS_THUMBNAIL_BUCKET;
  if (!bucket) return null;

  const storage = getStorageClient();
  const prefix = `presentation-thumbnails/${presentationId}/`;

  try {
    const res = await storage.objects.list({ bucket, prefix });
    const items = res.data.items;
    if (!items?.length) return null;

    // Check freshness of first item
    const updated = items[0].updated;
    if (updated) {
      const age = Date.now() - new Date(updated).getTime();
      if (age > THUMBNAIL_TTL_MS) return null;
    }

    return items
      .filter((item) => item.name?.endsWith(".png"))
      .map((item) => {
        const filename = item.name!.split("/").pop()!.replace(".png", "");
        const [indexStr, ...rest] = filename.split("_");
        return {
          slideIndex: parseInt(indexStr, 10),
          slideObjectId: rest.join("_"),
          thumbnailUrl: `https://storage.googleapis.com/${bucket}/${item.name}`,
        };
      })
      .sort((a, b) => a.slideIndex - b.slideIndex);
  } catch {
    return null;
  }
}

/**
 * Invalidate (delete) all cached thumbnails for a generated presentation.
 * Call this after Visual QA applies corrections so the next fetch gets fresh images.
 */
export async function invalidatePresentationThumbnails(
  presentationId: string,
): Promise<void> {
  const bucket = env.GCS_THUMBNAIL_BUCKET;
  if (!bucket) return;

  const storage = getStorageClient();
  const prefix = `presentation-thumbnails/${presentationId}/`;

  try {
    const res = await storage.objects.list({ bucket, prefix });
    const items = res.data.items;
    if (!items?.length) return;

    // Delete all cached thumbnail objects for this presentation
    await Promise.allSettled(
      items.map((item) =>
        storage.objects.delete({ bucket, object: item.name! }),
      ),
    );

    console.log(
      `[gcs-thumbnails] Invalidated ${items.length} cached thumbnails for presentation ${presentationId}`,
    );
  } catch (err) {
    console.warn(
      "[gcs-thumbnails] Failed to invalidate thumbnails:",
      err instanceof Error ? err.message : err,
    );
  }
}

// In-flight caching promises to avoid duplicate concurrent runs
const cachingInFlight = new Map<string, Promise<PresentationThumbnail[]>>();

/**
 * Fetch and cache all slide thumbnails for a generated presentation to GCS.
 * Returns array of GCS thumbnail URLs ordered by slide index.
 * Deduplicates concurrent calls for the same presentation.
 */
export function cachePresentationThumbnails(
  presentationId: string,
  authOptions?: GoogleAuthOptions,
): Promise<PresentationThumbnail[]> {
  const existing = cachingInFlight.get(presentationId);
  if (existing) return existing;

  const promise = _cachePresentationThumbnails(presentationId, authOptions).finally(() => {
    cachingInFlight.delete(presentationId);
  });
  cachingInFlight.set(presentationId, promise);
  return promise;
}

async function _cachePresentationThumbnails(
  presentationId: string,
  authOptions?: GoogleAuthOptions,
): Promise<PresentationThumbnail[]> {
  const bucket = env.GCS_THUMBNAIL_BUCKET;
  if (!bucket) {
    console.warn("[gcs-thumbnails] GCS_THUMBNAIL_BUCKET not configured");
    return [];
  }

  const slidesApi = getSlidesClient(authOptions);
  const pres = await slidesApi.presentations.get({
    presentationId,
    fields: "slides.objectId",
  });

  const allSlides = pres.data.slides ?? [];
  if (!allSlides.length) return [];

  // Check what's already cached — skip those slides
  const existing = await checkPresentationThumbnails(presentationId);
  const cachedObjectIds = new Set(existing?.map((t) => t.slideObjectId) ?? []);

  if (existing?.length && existing.length >= allSlides.length) {
    return existing; // All slides already cached
  }

  const slides = allSlides.filter((s) => !cachedObjectIds.has(s.objectId!));
  const results: PresentationThumbnail[] = [...(existing ?? [])];

  console.log(
    `[gcs-thumbnails] Caching ${slides.length} remaining thumbnails (${cachedObjectIds.size} already cached) for ${presentationId}`,
  );

  for (let i = 0; i < slides.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));

    const batch = slides.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (slide) => {
        const slideObjectId = slide.objectId!;
        const slideIndex = allSlides.findIndex((s) => s.objectId === slideObjectId);

        const thumbResult = await slidesApi.presentations.pages.getThumbnail({
          presentationId,
          pageObjectId: slideObjectId,
          "thumbnailProperties.thumbnailSize": "LARGE",
        });

        const contentUrl = thumbResult.data.contentUrl;
        if (!contentUrl) throw new Error(`No contentUrl for slide ${slideObjectId}`);

        const response = await fetch(contentUrl);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        const gcsKey = `presentation-thumbnails/${presentationId}/${String(slideIndex).padStart(3, "0")}_${slideObjectId}.png`;
        const gcsUrl = await uploadThumbnailToGCS(bucket, gcsKey, imageBuffer, "image/png");

        return { slideIndex, slideObjectId, thumbnailUrl: gcsUrl };
      }),
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        console.error("[gcs-thumbnails] Failed to cache slide:", r.reason?.message ?? r.reason);
      }
    }
  }

  console.log(`[gcs-thumbnails] Cached ${results.length}/${allSlides.length} presentation thumbnails`);
  return results.sort((a, b) => a.slideIndex - b.slideIndex);
}

// ────────────────────────────────────────────────────────────
// Document cover caching (for Discovery browse)
// ────────────────────────────────────────────────────────────

/**
 * Check if a document cover already exists in GCS and return its URL if fresh.
 * Returns null if not found or expired.
 */
export async function checkGcsCoverExists(
  presentationId: string,
): Promise<string | null> {
  const bucket = env.GCS_THUMBNAIL_BUCKET;
  if (!bucket) return null;

  const key = `document-covers/${presentationId}.png`;
  const storage = getStorageClient();

  try {
    const res = await storage.objects.get({ bucket, object: key });
    const updated = res.data.updated;
    if (updated) {
      const age = Date.now() - new Date(updated).getTime();
      if (age > THUMBNAIL_TTL_MS) return null; // expired
    }
    return `https://storage.googleapis.com/${bucket}/${key}`;
  } catch {
    // 404 or any error — cover does not exist
    return null;
  }
}

/**
 * Cache a document cover image to GCS.
 *
 * For Google Slides: uses Slides API to get thumbnail of the first page.
 * For other types (Docs, Sheets, PDF): uses Drive API thumbnailLink.
 *
 * Non-blocking — logs warnings on failure and returns null.
 */
export async function cacheDocumentCover(
  presentationId: string,
  mimeType: string,
  authOptions?: GoogleAuthOptions,
): Promise<string | null> {
  const bucket = env.GCS_THUMBNAIL_BUCKET;
  if (!bucket) {
    console.warn("[gcs-thumbnails] GCS_THUMBNAIL_BUCKET not configured, skipping cover cache");
    return null;
  }

  const key = `document-covers/${presentationId}.png`;

  // Check if cover already exists and is fresh
  const existing = await checkGcsCoverExists(presentationId);
  if (existing) return existing;

  try {
    let imageBuffer: Buffer | null = null;

    if (mimeType === "application/vnd.google-apps.presentation") {
      // Google Slides: get thumbnail of first page via Slides API
      const slidesApi = getSlidesClient(authOptions);
      const pres = await slidesApi.presentations.get({
        presentationId,
        fields: "slides.objectId",
      });
      const firstPageId = pres.data.slides?.[0]?.objectId;
      if (!firstPageId) {
        console.warn(`[gcs-thumbnails] No slides found for ${presentationId}`);
        return null;
      }

      const thumbResult = await slidesApi.presentations.pages.getThumbnail({
        presentationId,
        pageObjectId: firstPageId,
        "thumbnailProperties.thumbnailSize": "LARGE",
      });

      const contentUrl = thumbResult.data.contentUrl;
      if (!contentUrl) {
        console.warn(`[gcs-thumbnails] No contentUrl for ${presentationId}`);
        return null;
      }

      const response = await fetch(contentUrl);
      if (!response.ok) {
        console.warn(`[gcs-thumbnails] Failed to fetch slide thumbnail: ${response.status}`);
        return null;
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      // Other types: use Drive API thumbnailLink
      const drive = getDriveClient(authOptions);
      const fileRes = await drive.files.get({
        fileId: presentationId,
        fields: "thumbnailLink",
        supportsAllDrives: true,
      });

      const thumbnailLink = fileRes.data.thumbnailLink;
      if (!thumbnailLink) {
        console.warn(`[gcs-thumbnails] No thumbnailLink for ${presentationId}`);
        return null;
      }

      // Append =s800 for higher quality
      const highResUrl = thumbnailLink.replace(/=s\d+$/, "=s800");
      const response = await fetch(highResUrl);
      if (!response.ok) {
        console.warn(`[gcs-thumbnails] Failed to fetch drive thumbnail: ${response.status}`);
        return null;
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      console.warn(`[gcs-thumbnails] Empty image buffer for ${presentationId}`);
      return null;
    }

    const gcsUrl = await uploadThumbnailToGCS(bucket, key, imageBuffer, "image/png");
    console.log(`[gcs-thumbnails] Cached cover for ${presentationId}`);
    return gcsUrl;
  } catch (err) {
    console.warn(`[gcs-thumbnails] Failed to cache cover for ${presentationId}:`, err);
    return null;
  }
}
