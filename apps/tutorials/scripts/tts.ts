import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { TutorialScriptSchema } from "../src/types/tutorial-script.js";
import type { TutorialStep } from "../src/types/tutorial-script.js";
import type { TTSEngine } from "../src/tts/engine.js";
import { KokoroEngine } from "../src/tts/kokoro-engine.js";
import { ChatterboxEngine } from "../src/tts/chatterbox-engine.js";
import { postProcessAudio } from "../src/tts/post-process.js";
import { writeManifest, updateManifestEntry } from "../src/tts/manifest.js";
import { getWavDurationMs } from "../src/tts/wav-utils.js";
import type { TimingEntry, TimingManifest } from "../src/types/timing-manifest.js";

/**
 * TTS Orchestrator CLI
 *
 * Usage: pnpm --filter tutorials tts <tutorial-name> [--engine kokoro|chatterbox] [--step step-003]
 *
 * Reads a tutorial script, generates per-step narration audio using the selected TTS engine,
 * post-processes with loudness normalization, and writes a timing manifest for Remotion.
 */

// ────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ────────────────────────────────────────────────────────────

function parseArgs(): {
  tutorialName: string;
  engine: "kokoro" | "chatterbox";
  step: string | null;
} {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0]?.startsWith("--")) {
    console.error(
      "Usage: pnpm --filter tutorials tts <tutorial-name> [--engine kokoro|chatterbox] [--step step-003]"
    );
    process.exit(1);
  }

  const tutorialName = args[0]!;
  let engine: "kokoro" | "chatterbox" = "kokoro";
  let step: string | null = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--engine" && args[i + 1]) {
      const val = args[i + 1]!;
      if (val !== "kokoro" && val !== "chatterbox") {
        console.error(`Error: Invalid engine "${val}". Must be "kokoro" or "chatterbox".`);
        process.exit(1);
      }
      engine = val;
      i++;
    } else if (args[i] === "--step" && args[i + 1]) {
      step = args[i + 1]!;
      i++;
    }
  }

  return { tutorialName, engine, step };
}

// ────────────────────────────────────────────────────────────
// Startup Checks
// ────────────────────────────────────────────────────────────

async function checkFfmpeg(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("ffmpeg not found. Install with: brew install ffmpeg"));
    });
    proc.on("error", () => {
      reject(new Error("ffmpeg not found. Install with: brew install ffmpeg"));
    });
  });
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { tutorialName, engine: engineName, step: stepFilter } = parseArgs();

  // Check ffmpeg availability
  await checkFfmpeg();

  // Load and validate tutorial script
  const scriptPath = path.join(process.cwd(), "fixtures", tutorialName, "script.json");

  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: Tutorial script not found: ${scriptPath}`);
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

  // ────────────────────────────────────────────────────────────
  // Engine Instantiation
  // ────────────────────────────────────────────────────────────

  let engine: TTSEngine;
  if (engineName === "kokoro") {
    engine = new KokoroEngine();
  } else {
    engine = new ChatterboxEngine(
      path.join(process.cwd(), "assets", "reference-voice.wav")
    );
  }

  // ────────────────────────────────────────────────────────────
  // Step Filtering
  // ────────────────────────────────────────────────────────────

  let stepsToProcess: TutorialStep[];
  if (stepFilter) {
    const found = script.steps.filter((s) => s.id === stepFilter);
    if (found.length === 0) {
      console.error(
        `Error: Step "${stepFilter}" not found in tutorial "${tutorialName}". ` +
          `Available steps: ${script.steps.map((s) => s.id).join(", ")}`
      );
      process.exit(1);
    }
    stepsToProcess = found;
  } else {
    stepsToProcess = script.steps;
  }

  // ────────────────────────────────────────────────────────────
  // Per-Step Generation Loop
  // ────────────────────────────────────────────────────────────

  const audioDir = path.join(process.cwd(), "output", "audio", tutorialName);
  fs.mkdirSync(audioDir, { recursive: true });

  const manifestPath = path.join(audioDir, "timing.json");
  const entries: TimingEntry[] = [];
  const failedSteps: string[] = [];

  for (const step of stepsToProcess) {
    const finalPath = path.join(audioDir, `${step.id}.wav`);
    const rawPath = path.join(audioDir, `.raw-${step.id}.wav`);

    try {
      const narrationPreview =
        step.narration.length > 50
          ? step.narration.substring(0, 50) + "..."
          : step.narration;
      console.log(`Generating audio for ${step.id}: "${narrationPreview}"`);

      // Generate raw WAV
      await engine.generate(step.narration, rawPath, {
        emotion: step.emotion,
      });

      // Post-process (normalize + trailing silence)
      await postProcessAudio(rawPath, finalPath);

      // Clean up raw temp file
      try {
        fs.unlinkSync(rawPath);
      } catch {
        // Temp file may already be gone
      }

      // Get final duration from the post-processed file
      const durationMs = getWavDurationMs(finalPath);

      const entry: TimingEntry = {
        stepId: step.id,
        audioFile: `${step.id}.wav`,
        durationMs,
        narration: step.narration,
        wordCount: step.narration.split(/\s+/).length,
      };

      entries.push(entry);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      if (stepFilter) {
        // Single-step mode: fail immediately
        console.error(`Error generating ${step.id}: ${errMsg}`);
        process.exit(1);
      }

      // Full-tutorial mode: log warning and continue
      console.warn(`Warning: Failed to generate ${step.id}: ${errMsg}`);
      failedSteps.push(step.id);
    }
  }

  // ────────────────────────────────────────────────────────────
  // Manifest Writing
  // ────────────────────────────────────────────────────────────

  if (stepFilter && entries.length === 1) {
    // Single-step mode: update only this entry
    updateManifestEntry(manifestPath, entries[0]!.stepId, entries[0]!, engineName);
  } else if (entries.length > 0) {
    // Full-tutorial mode: write complete manifest
    const manifest: TimingManifest = {
      steps: entries,
      totalDurationMs: entries.reduce((sum, e) => sum + e.durationMs, 0),
      engine: engineName,
      generatedAt: new Date().toISOString(),
    };
    writeManifest(manifestPath, manifest);
  }

  // ────────────────────────────────────────────────────────────
  // Summary Output
  // ────────────────────────────────────────────────────────────

  const totalMs = entries.reduce((sum, e) => sum + e.durationMs, 0);
  const totalSeconds = (totalMs / 1000).toFixed(1);

  console.log(`\n--- TTS Summary ---`);
  console.log(`Tutorial: ${script.title}`);
  console.log(`Engine: ${engineName}`);
  console.log(`Steps: ${entries.length}${stepFilter ? " (single-step mode)" : ""}`);
  console.log(`Total duration: ${totalMs}ms (${totalSeconds}s)`);
  console.log(`Output: output/audio/${tutorialName}/`);

  if (failedSteps.length > 0) {
    console.warn(`\nWarning: ${failedSteps.length} step(s) failed: ${failedSteps.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("TTS pipeline failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
