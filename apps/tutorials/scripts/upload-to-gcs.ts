/**
 * Upload Tutorial MP4 files to GCS
 *
 * Reads MP4 files from apps/tutorials/output/videos/, probes duration with
 * ffprobe, uploads to a public GCS bucket, and writes a manifest JSON file
 * that the Prisma seed script uses to populate Tutorial rows.
 *
 * Usage:
 *   npx tsx apps/tutorials/scripts/upload-to-gcs.ts
 *   npx tsx apps/tutorials/scripts/upload-to-gcs.ts --dry-run
 *
 * Environment:
 *   VERTEX_SERVICE_ACCOUNT_KEY - GCS auth (loaded from apps/agent/.env)
 *   GCS_TUTORIAL_BUCKET - bucket name (default: "atlusdeck-tutorials")
 */

import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";

import dotenv from "dotenv";
import { google } from "googleapis";

const execFile = promisify(execFileCb);

// ────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const AGENT_ENV_PATH = path.join(PROJECT_ROOT, "apps/agent/.env");
const VIDEOS_DIR = path.join(PROJECT_ROOT, "apps/tutorials/output/videos");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "apps/tutorials/output/tutorials-manifest.json",
);

// Load env from agent (where VERTEX_SERVICE_ACCOUNT_KEY lives)
dotenv.config({ path: AGENT_ENV_PATH });

const BUCKET = process.env.GCS_TUTORIAL_BUCKET ?? "atlusdeck-tutorials";
const DRY_RUN = process.argv.includes("--dry-run");

// ────────────────────────────────────────────────────────────
// GCS Client (same pattern as gcs-thumbnails.ts)
// ────────────────────────────────────────────────────────────

function getStorageClient() {
  const raw = process.env.VERTEX_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error(
      "ERROR: VERTEX_SERVICE_ACCOUNT_KEY is not set. Load it from apps/agent/.env or set it in your environment.",
    );
    process.exit(1);
  }
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/devstorage.full_control"],
  });
  return google.storage({ version: "v1", auth });
}

// ────────────────────────────────────────────────────────────
// Duration probing
// ────────────────────────────────────────────────────────────

async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "quiet",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  const seconds = parseFloat(stdout.trim());
  if (isNaN(seconds)) {
    throw new Error(`ffprobe returned non-numeric duration for ${filePath}`);
  }
  return Math.round(seconds);
}

// ────────────────────────────────────────────────────────────
// Upload
// ────────────────────────────────────────────────────────────

interface ManifestEntry {
  slug: string;
  gcsUrl: string;
  durationSec: number;
}

async function uploadFile(
  storage: ReturnType<typeof getStorageClient>,
  filePath: string,
  slug: string,
): Promise<string> {
  const key = `${slug}.mp4`;
  const stream = fs.createReadStream(filePath);

  await storage.objects.insert({
    bucket: BUCKET,
    name: key,
    requestBody: {
      contentType: "video/mp4",
      cacheControl: "public, max-age=604800",
    },
    media: {
      mimeType: "video/mp4",
      body: stream as unknown as Readable,
    },
  });

  return `https://storage.googleapis.com/${BUCKET}/${key}`;
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main() {
  // Discover MP4 files
  if (!fs.existsSync(VIDEOS_DIR)) {
    console.error(`ERROR: Videos directory not found: ${VIDEOS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(VIDEOS_DIR)
    .filter((f) => f.endsWith(".mp4"))
    .sort();

  if (files.length === 0) {
    console.error("ERROR: No MP4 files found in", VIDEOS_DIR);
    process.exit(1);
  }

  console.log(`Found ${files.length} MP4 files in ${VIDEOS_DIR}`);
  console.log(`Bucket: ${BUCKET}`);
  if (DRY_RUN) {
    console.log("DRY RUN -- will probe durations but skip uploads\n");
  }

  const storage = DRY_RUN ? null : getStorageClient();
  const manifest: ManifestEntry[] = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const slug = file.replace(/\.mp4$/, "");
    const filePath = path.join(VIDEOS_DIR, file);

    try {
      const durationSec = await probeDuration(filePath);

      if (DRY_RUN) {
        const gcsUrl = `https://storage.googleapis.com/${BUCKET}/${slug}.mp4`;
        manifest.push({ slug, gcsUrl, durationSec });
        console.log(
          `[${i + 1}/${files.length}] (dry-run) ${slug}.mp4 (${durationSec}s)`,
        );
      } else {
        const gcsUrl = await uploadFile(storage!, filePath, slug);
        manifest.push({ slug, gcsUrl, durationSec });
        console.log(
          `[${i + 1}/${files.length}] Uploaded ${slug}.mp4 (${durationSec}s)`,
        );
      }
      succeeded++;
    } catch (err) {
      failed++;
      console.error(
        `[${i + 1}/${files.length}] FAILED ${slug}.mp4:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Sort manifest by slug and write
  manifest.sort((a, b) => a.slug.localeCompare(b.slug));

  // Ensure output directory exists
  const manifestDir = path.dirname(MANIFEST_PATH);
  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nManifest written: ${MANIFEST_PATH} (${manifest.length} entries)`);

  console.log(`\nResults: ${succeeded} succeeded, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
