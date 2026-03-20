/**
 * Extract 1-second tutorial thumbnails and upload them with gcloud CLI.
 *
 * Usage:
 *   pnpm --filter tutorials exec tsx scripts/upload-thumbnails.ts
 *   pnpm --filter tutorials exec tsx scripts/upload-thumbnails.ts --dry-run
 *   pnpm --filter tutorials exec tsx scripts/upload-thumbnails.ts --bucket my-bucket
 */

import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import dotenv from "dotenv";

const execFile = promisify(execFileCb);

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const AGENT_ENV_PATH = path.join(PROJECT_ROOT, "apps/agent/.env");
const VIDEOS_DIR = path.join(PROJECT_ROOT, "apps/tutorials/output/videos");
const THUMBNAILS_DIR = path.join(PROJECT_ROOT, "apps/tutorials/output/thumbnails");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "apps/tutorials/output/tutorial-thumbnails-manifest.json",
);

dotenv.config({ path: AGENT_ENV_PATH });

type ManifestEntry = {
  slug: string;
  thumbnailUrl: string;
};

type CliOptions = {
  dryRun: boolean;
  bucket: string;
};

type GcloudAuthContext = {
  env: NodeJS.ProcessEnv;
  credentialsPath: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  let bucket = process.env.GCS_TUTORIAL_BUCKET ?? "atlusdeck-tutorials";
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--bucket") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --bucket");
      }
      bucket = next;
      i++;
      continue;
    }
  }

  return { dryRun, bucket };
}

async function extractThumbnail(videoPath: string, outputPath: string) {
  await execFile("ffmpeg", [
    "-y",
    "-ss",
    "1",
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ]);
}

async function uploadThumbnail(
  localPath: string,
  bucket: string,
  slug: string,
  gcloudEnv: NodeJS.ProcessEnv,
) {
  await execFile("gcloud", [
    "storage",
    "cp",
    localPath,
    `gs://${bucket}/thumbnails/${slug}.jpg`,
  ], { env: gcloudEnv });
}

function createGcloudAuthContext(dryRun: boolean): GcloudAuthContext {
  if (dryRun) {
    return { env: process.env, credentialsPath: null };
  }

  const raw = process.env.VERTEX_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "VERTEX_SERVICE_ACCOUNT_KEY is required for non-dry-run thumbnail uploads.",
    );
  }

  const credentialsPath = path.join(
    os.tmpdir(),
    `vertex-gcloud-${process.pid}-${Date.now()}.json`,
  );
  fs.writeFileSync(credentialsPath, raw);

  return {
    credentialsPath,
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: credentialsPath,
      CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: credentialsPath,
    },
  };
}

async function main() {
  const { dryRun, bucket } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(VIDEOS_DIR)) {
    throw new Error(`Videos directory not found: ${VIDEOS_DIR}`);
  }

  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tutorial-thumbnails-"));
  const files = fs
    .readdirSync(VIDEOS_DIR)
    .filter((file) => file.endsWith(".mp4"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No MP4 files found in ${VIDEOS_DIR}`);
  }

  console.log(`Found ${files.length} tutorial videos`);
  console.log(`Bucket: ${bucket}`);
  if (dryRun) {
    console.log("DRY RUN -- frames will be extracted and manifest written, uploads skipped");
  }

  const manifest: ManifestEntry[] = [];
  const failures: string[] = [];
  const gcloudAuth = createGcloudAuthContext(dryRun);

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const slug = file.replace(/\.mp4$/, "");
      const videoPath = path.join(VIDEOS_DIR, file);
      const tempThumbnailPath = path.join(tempDir, `${slug}.jpg`);
      const outputThumbnailPath = path.join(THUMBNAILS_DIR, `${slug}.jpg`);
      const thumbnailUrl = `https://storage.googleapis.com/${bucket}/thumbnails/${slug}.jpg`;

      try {
        await extractThumbnail(videoPath, tempThumbnailPath);
        fs.copyFileSync(tempThumbnailPath, outputThumbnailPath);

        if (!dryRun) {
          await uploadThumbnail(tempThumbnailPath, bucket, slug, gcloudAuth.env);
        }

        manifest.push({ slug, thumbnailUrl });
        console.log(
          `[${i + 1}/${files.length}] ${dryRun ? "Prepared" : "Uploaded"} ${slug}.jpg`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${slug}: ${message}`);
        console.error(`[${i + 1}/${files.length}] FAILED ${slug}: ${message}`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (gcloudAuth.credentialsPath) {
      fs.rmSync(gcloudAuth.credentialsPath, { force: true });
    }
  }

  manifest.sort((a, b) => a.slug.localeCompare(b.slug));
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nManifest written: ${MANIFEST_PATH} (${manifest.length} entries)`);
  console.log(`Results: ${manifest.length} succeeded, ${failures.length} failed`);

  if (failures.length > 0) {
    console.log("Failures:");
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
  }

  if (!dryRun && failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
