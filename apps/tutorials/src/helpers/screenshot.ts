import type { Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { prepareForScreenshot } from "./determinism.js";

/**
 * Screenshot Helper
 *
 * Manages screenshot capture with consistent naming conventions,
 * output directory structure, and determinism preparation.
 *
 * Output structure:
 *   output/screenshots/{tutorialId}/step-001.png
 *   output/screenshots/{tutorialId}/step-002.png
 *   ...
 */

const OUTPUT_BASE = path.join(process.cwd(), "output", "screenshots");

/**
 * Get the output path for a screenshot at a given step index.
 *
 * @param tutorialId - Tutorial identifier (e.g., "getting-started")
 * @param stepIndex - Zero-based step index
 * @returns Absolute path like output/getting-started/step-001.png
 */
export function getScreenshotPath(
  tutorialId: string,
  stepIndex: number
): string {
  const stepNum = String(stepIndex + 1).padStart(3, "0");
  return path.join(OUTPUT_BASE, tutorialId, `step-${stepNum}.png`);
}

/**
 * Ensure the output directory for a tutorial exists.
 *
 * @param tutorialId - Tutorial identifier
 * @returns Absolute path to the output directory
 */
export function ensureOutputDir(tutorialId: string): string {
  const dir = path.join(OUTPUT_BASE, tutorialId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Capture a screenshot for a tutorial step.
 *
 * 1. Prepares the page for deterministic capture (disable animations, wait for stable)
 * 2. Ensures the output directory exists
 * 3. Takes the screenshot as PNG
 * 4. Logs the capture path
 *
 * @param page - Playwright page instance
 * @param tutorialId - Tutorial identifier (e.g., "getting-started")
 * @param stepIndex - Zero-based step index
 * @param options - Optional screenshot options
 * @returns Absolute path to the captured screenshot
 */
export async function captureStep(
  page: Page,
  tutorialId: string,
  stepIndex: number,
  options?: { fullPage?: boolean }
): Promise<string> {
  await prepareForScreenshot(page);

  const screenshotPath = getScreenshotPath(tutorialId, stepIndex);
  ensureOutputDir(tutorialId);

  await page.screenshot({
    path: screenshotPath,
    fullPage: options?.fullPage ?? false,
    type: "png",
  });

  const stepNum = String(stepIndex + 1).padStart(3, "0");
  console.log(`  [step-${stepNum}] Captured: ${screenshotPath}`);

  return screenshotPath;
}
