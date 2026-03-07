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
import { getSlidesClient, type GoogleAuthOptions } from "./google-auth";
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
