import * as fs from "node:fs";
import * as path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  TutorialScriptSchema,
  type TutorialAction,
  type TutorialScript,
  type TutorialStep,
} from "../src/types/tutorial-script.js";
import { TimingManifestSchema } from "../src/types/timing-manifest.js";

/**
 * Single-tutorial Render CLI
 *
 * Usage: pnpm --filter tutorials render <tutorial-name> [--concurrency N]
 *
 * Bundles the Remotion composition and renders a single tutorial to MP4
 * using the programmatic @remotion/renderer API (H.264, CRF 18).
 */

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const FALLBACK_DURATION_MS = 3000;

type ValidatedAssets = {
  manifest: ReturnType<typeof TimingManifestSchema.parse>;
  script: TutorialScript;
};

type CursorPoint = {
  x: number;
  y: number;
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function findScriptPath(tutorialName: string): string {
  const cwd = process.cwd();
  const candidatePaths = [
    path.join(cwd, "fixtures", tutorialName, "script.json"),
    path.join(cwd, "fixtures", `${tutorialName}.json`),
  ];

  const scriptPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!scriptPath) {
    console.error(
      `Error: script.json not found for tutorial "${tutorialName}".\n` +
        `Expected one of:\n${candidatePaths
          .map((candidate) => `- ${candidate}`)
          .join("\n")}`
    );
    process.exit(1);
  }

  return scriptPath;
}

function getCursorAction(step: TutorialStep): TutorialAction | undefined {
  return step.actions?.find(
    (action) => action.type === "click" || action.type === "hover"
  );
}

// ------------------------------------------------------------
// CLI Argument Parsing
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Pre-validation
// ------------------------------------------------------------

function preValidate(tutorialName: string): ValidatedAssets {
  const cwd = process.cwd();
  const timingPath = path.join(cwd, "audio", tutorialName, "timing.json");
  const scriptPath = findScriptPath(tutorialName);
  const screenshotDir = path.join(cwd, "output", tutorialName);

  if (!fs.existsSync(timingPath)) {
    console.error(
      `Error: timing.json not found at ${timingPath}\n` +
        `Run capture and tts first: pnpm --filter tutorials capture ${tutorialName} && pnpm --filter tutorials tts ${tutorialName}`
    );
    process.exit(1);
  }

  if (!fs.existsSync(screenshotDir)) {
    console.error(
      `Error: Screenshot directory not found at ${screenshotDir}\n` +
        `Run capture first: pnpm --filter tutorials capture ${tutorialName}`
    );
    process.exit(1);
  }

  let manifest;
  try {
    const raw = JSON.parse(fs.readFileSync(timingPath, "utf-8"));
    manifest = TimingManifestSchema.parse(raw);
  } catch (err) {
    console.error(`Error: Invalid timing manifest at ${timingPath}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  let script;
  try {
    const raw = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
    script = TutorialScriptSchema.parse(raw);
  } catch (err) {
    console.error(`Error: Invalid tutorial script at ${scriptPath}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const scriptStepIds = new Set(script.steps.map((step) => step.id));
  for (const manifestStep of manifest.steps) {
    if (!scriptStepIds.has(manifestStep.stepId)) {
      console.error(
        `Error: timing manifest step "${manifestStep.stepId}" has no matching script step in ${scriptPath}`
      );
      process.exit(1);
    }
  }

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

  const audioDir = path.join(cwd, "audio", tutorialName);
  for (const step of manifest.steps) {
    const audioPath = path.join(audioDir, step.audioFile);
    if (!fs.existsSync(audioPath)) {
      console.warn(
        `Warning: Audio file missing: ${audioPath} -- step "${step.stepId}" will use ${FALLBACK_DURATION_MS}ms fallback`
      );
    }
  }

  return { manifest, script };
}

// ------------------------------------------------------------
// Build Input Props
// ------------------------------------------------------------

function buildInputProps(tutorialName: string, assets: ValidatedAssets) {
  const { manifest, script } = assets;
  const audioDir = path.join(process.cwd(), "audio", tutorialName);
  const scriptStepsById = new Map(script.steps.map((step) => [step.id, step]));
  let previousCursorPoint: CursorPoint | undefined;

  const steps = manifest.steps.map((step, index) => {
    const scriptStep = scriptStepsById.get(step.stepId);

    if (!scriptStep) {
      throw new Error(
        `Timing manifest step "${step.stepId}" has no matching script step for tutorial "${tutorialName}"`
      );
    }

    const audioPath = path.join(audioDir, step.audioFile);
    const hasAudio = fs.existsSync(audioPath);
    const cursorAction = getCursorAction(scriptStep);
    const hasCursorAction = Boolean(cursorAction);
    const cursorTarget =
      hasCursorAction && scriptStep.cursorTarget
        ? {
            x: scriptStep.cursorTarget.x,
            y: scriptStep.cursorTarget.y,
          }
        : undefined;
    const cursorFrom = hasCursorAction ? previousCursorPoint : undefined;

    if (cursorTarget) {
      previousCursorPoint = cursorTarget;
    }

    return {
      stepId: step.stepId,
      audioFile: step.audioFile,
      durationMs: hasAudio ? step.durationMs : 0,
      zoomTarget:
        scriptStep.zoomTarget &&
        typeof scriptStep.zoomTarget.x === "number" &&
        typeof scriptStep.zoomTarget.y === "number"
          ? {
              scale: scriptStep.zoomTarget.scale,
              x: scriptStep.zoomTarget.x,
              y: scriptStep.zoomTarget.y,
            }
          : undefined,
      callout: scriptStep.callout,
      shortcutKey: scriptStep.shortcutKey,
      cursorTarget,
      cursorFrom,
      hasCursorAction,
      stepIndex: index + 1,
      totalSteps: script.steps.length,
    };
  });

  const totalDurationMs = steps.reduce((sum, currentStep) => {
    const ms =
      currentStep.durationMs > 0 ? currentStep.durationMs : FALLBACK_DURATION_MS;
    return sum + ms;
  }, 0);

  return {
    tutorialName,
    title: script.title,
    description: script.description,
    nextTutorialName: undefined,
    steps,
    totalDurationMs,
  };
}

// ------------------------------------------------------------
// Render (exported for use by render-all.ts)
// ------------------------------------------------------------

export async function renderTutorial(
  tutorialName: string,
  concurrency: number
): Promise<void> {
  const assets = preValidate(tutorialName);
  const inputProps = buildInputProps(tutorialName, assets);

  console.log(
    `Rendering "${tutorialName}" (${assets.manifest.steps.length} steps, ~${(
      inputProps.totalDurationMs / 1000
    ).toFixed(1)}s)...`
  );

  const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");
  console.log("Bundling composition...");
  const bundleLocation = await bundle({
    entryPoint,
    publicDir: process.cwd(),
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "tutorial",
    inputProps,
  });

  const outputDir = path.join(process.cwd(), "videos");
  fs.mkdirSync(outputDir, { recursive: true });

  const outputLocation = path.join(outputDir, `${tutorialName}.mp4`);

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
      if (percent >= lastProgressPercent + 10) {
        lastProgressPercent = percent;
        process.stdout.write(`\rRendering: ${percent}%`);
      }
    },
  });

  process.stdout.write("\r" + " ".repeat(30) + "\r");

  const durationSeconds = (inputProps.totalDurationMs / 1000).toFixed(1);
  console.log(`\n--- Render Summary ---`);
  console.log(`Tutorial: ${tutorialName}`);
  console.log(`Steps: ${assets.manifest.steps.length}`);
  console.log(`Duration: ${durationSeconds}s`);
  console.log(`Output: videos/${tutorialName}.mp4`);
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

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
