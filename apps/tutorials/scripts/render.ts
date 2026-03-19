import * as fs from "node:fs";
import * as path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { TimingManifestSchema } from "../src/types/timing-manifest.js";

/**
 * Single-tutorial Render CLI
 *
 * Usage: pnpm --filter tutorials render <tutorial-name> [--concurrency N]
 *
 * Bundles the Remotion composition and renders a single tutorial to MP4
 * using the programmatic @remotion/renderer API (H.264, CRF 18).
 */

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const FALLBACK_DURATION_MS = 3000;

// ────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ────────────────────────────────────────────────────────────

function parseArgs(): { tutorialName: string; concurrency: number } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0]?.startsWith("--")) {
    console.error(
      "Usage: pnpm --filter tutorials render <tutorial-name> [--concurrency N]"
    );
    process.exit(1);
  }

  const tutorialName = args[0]!;
  let concurrency = 2;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--concurrency" && args[i + 1]) {
      const val = parseInt(args[i + 1]!, 10);
      if (isNaN(val) || val < 1) {
        console.error(
          `Error: Invalid concurrency "${args[i + 1]}". Must be a positive integer.`
        );
        process.exit(1);
      }
      concurrency = val;
      i++;
    }
  }

  return { tutorialName, concurrency };
}

// ────────────────────────────────────────────────────────────
// Pre-validation
// ────────────────────────────────────────────────────────────

function preValidate(tutorialName: string) {
  const cwd = process.cwd();
  const timingPath = path.join(cwd, "audio", tutorialName, "timing.json");
  const screenshotDir = path.join(cwd, "output", tutorialName);

  // Check timing.json exists
  if (!fs.existsSync(timingPath)) {
    console.error(
      `Error: timing.json not found at ${timingPath}\n` +
        `Run capture and tts first: pnpm --filter tutorials capture ${tutorialName} && pnpm --filter tutorials tts ${tutorialName}`
    );
    process.exit(1);
  }

  // Check screenshot directory exists
  if (!fs.existsSync(screenshotDir)) {
    console.error(
      `Error: Screenshot directory not found at ${screenshotDir}\n` +
        `Run capture first: pnpm --filter tutorials capture ${tutorialName}`
    );
    process.exit(1);
  }

  // Load and validate timing manifest
  let manifest;
  try {
    const raw = JSON.parse(fs.readFileSync(timingPath, "utf-8"));
    manifest = TimingManifestSchema.parse(raw);
  } catch (err) {
    console.error(`Error: Invalid timing manifest at ${timingPath}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Validate screenshots exist for each step
  for (const step of manifest.steps) {
    const screenshotPath = path.join(screenshotDir, `${step.stepId}.png`);
    if (!fs.existsSync(screenshotPath)) {
      console.error(
        `Error: Screenshot not found: ${screenshotPath}\n` +
          `Run capture first: pnpm --filter tutorials capture ${tutorialName}`
      );
      process.exit(1);
    }
  }

  // Check audio files exist (warn if missing, continue with fallback)
  const audioDir = path.join(cwd, "audio", tutorialName);
  for (const step of manifest.steps) {
    const audioPath = path.join(audioDir, step.audioFile);
    if (!fs.existsSync(audioPath)) {
      console.warn(
        `Warning: Audio file missing: ${audioPath} -- step "${step.stepId}" will use ${FALLBACK_DURATION_MS}ms fallback`
      );
    }
  }

  return manifest;
}

// ────────────────────────────────────────────────────────────
// Build Input Props
// ────────────────────────────────────────────────────────────

function buildInputProps(
  tutorialName: string,
  manifest: ReturnType<typeof preValidate>
) {
  const audioDir = path.join(process.cwd(), "audio", tutorialName);

  const steps = manifest.steps.map((step) => {
    const audioPath = path.join(audioDir, step.audioFile);
    const hasAudio = fs.existsSync(audioPath);
    return {
      stepId: step.stepId,
      audioFile: step.audioFile,
      durationMs: hasAudio ? step.durationMs : 0,
    };
  });

  const totalDurationMs = steps.reduce((sum, s) => {
    const ms = s.durationMs > 0 ? s.durationMs : FALLBACK_DURATION_MS;
    return sum + ms;
  }, 0);

  return { tutorialName, steps, totalDurationMs };
}

// ────────────────────────────────────────────────────────────
// Render (exported for use by render-all.ts)
// ────────────────────────────────────────────────────────────

export async function renderTutorial(
  tutorialName: string,
  concurrency: number
): Promise<void> {
  // Pre-validation
  const manifest = preValidate(tutorialName);
  const inputProps = buildInputProps(tutorialName, manifest);

  console.log(
    `Rendering "${tutorialName}" (${manifest.steps.length} steps, ~${(inputProps.totalDurationMs / 1000).toFixed(1)}s)...`
  );

  // Bundle
  const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
  console.log("Bundling composition...");
  const bundleLocation = await bundle({
    entryPoint,
    publicDir: process.cwd(),
  });

  // Select composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "tutorial",
    inputProps,
  });

  // Ensure videos/ directory exists
  const outputDir = path.join(process.cwd(), "videos");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputLocation = path.join(outputDir, `${tutorialName}.mp4`);

  // Render
  let lastProgressPercent = -1;
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    crf: 18,
    concurrency,
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 100);
      // Print every 10%
      if (percent >= lastProgressPercent + 10) {
        lastProgressPercent = percent;
        process.stdout.write(`\rRendering: ${percent}%`);
      }
    },
  });

  // Clear progress line
  process.stdout.write("\r" + " ".repeat(30) + "\r");

  // Summary
  const durationSeconds = (inputProps.totalDurationMs / 1000).toFixed(1);
  console.log(`\n--- Render Summary ---`);
  console.log(`Tutorial: ${tutorialName}`);
  console.log(`Steps: ${manifest.steps.length}`);
  console.log(`Duration: ${durationSeconds}s`);
  console.log(`Output: videos/${tutorialName}.mp4`);
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { tutorialName, concurrency } = parseArgs();
  await renderTutorial(tutorialName, concurrency);
}

main().catch((err) => {
  console.error(
    "Render failed:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
