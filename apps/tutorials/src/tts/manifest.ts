import fs from "node:fs";
import path from "node:path";
import {
  TimingManifestSchema,
  type TimingEntry,
  type TimingManifest,
} from "../types/timing-manifest.js";

/**
 * Timing Manifest Module
 *
 * Read, write, and update per-tutorial timing.json files.
 * Supports full-manifest writes and single-step updates for iteration speed.
 */

/**
 * Read and validate a timing manifest from disk.
 *
 * @returns Validated TimingManifest or null if the file does not exist.
 */
export function readManifest(manifestPath: string): TimingManifest | null {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const raw = fs.readFileSync(manifestPath, "utf-8");
  const data = JSON.parse(raw);
  return TimingManifestSchema.parse(data);
}

/**
 * Write a timing manifest to disk with Zod validation.
 *
 * Creates the output directory if it does not exist.
 */
export function writeManifest(
  manifestPath: string,
  manifest: TimingManifest
): void {
  const validated = TimingManifestSchema.parse(manifest);
  const dir = path.dirname(manifestPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(validated, null, 2) + "\n");
}

/**
 * Update a single step's timing entry in an existing manifest.
 *
 * If the manifest does not exist, creates a new one.
 * If the stepId already exists, replaces it. Otherwise, appends.
 * Recalculates totalDurationMs and updates the generatedAt timestamp.
 */
export function updateManifestEntry(
  manifestPath: string,
  stepId: string,
  entry: TimingEntry,
  engine: "kokoro" | "chatterbox"
): void {
  let manifest = readManifest(manifestPath);

  if (!manifest) {
    manifest = {
      steps: [],
      totalDurationMs: 0,
      engine,
      generatedAt: new Date().toISOString(),
    };
  }

  // Find existing entry by stepId and replace, or append
  const existingIndex = manifest.steps.findIndex((s) => s.stepId === stepId);
  if (existingIndex >= 0) {
    manifest.steps[existingIndex] = entry;
  } else {
    manifest.steps.push(entry);
  }

  // Recalculate total duration
  manifest.totalDurationMs = manifest.steps.reduce(
    (sum, s) => sum + s.durationMs,
    0
  );
  manifest.engine = engine;
  manifest.generatedAt = new Date().toISOString();

  writeManifest(manifestPath, manifest);
}
