import * as fs from "node:fs";
import * as path from "node:path";
import { renderTutorial } from "./render.js";

/**
 * Batch Render CLI
 *
 * Usage: pnpm --filter tutorials render:all [--concurrency N]
 *
 * Discovers all renderable tutorials (those with both timing.json and screenshots)
 * and renders them sequentially. Remotion docs recommend sequential rendering.
 */

// ────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ────────────────────────────────────────────────────────────

function parseArgs(): { concurrency: number } {
  const args = process.argv.slice(2);
  let concurrency = 2;

  for (let i = 0; i < args.length; i++) {
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

  return { concurrency };
}

// ────────────────────────────────────────────────────────────
// Tutorial Discovery
// ────────────────────────────────────────────────────────────

function discoverTutorials(): string[] {
  const cwd = process.cwd();
  const audioDir = path.join(cwd, "audio");

  if (!fs.existsSync(audioDir)) {
    return [];
  }

  const entries = fs.readdirSync(audioDir, { withFileTypes: true });
  const tutorials: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const name = entry.name;
    const timingPath = path.join(audioDir, name, "timing.json");
    const screenshotDir = path.join(cwd, "output", name);
    const scriptPath = path.join(cwd, "fixtures", name, "script.json");

    // Must have timing, screenshots, and a corresponding script.
    if (
      fs.existsSync(timingPath) &&
      fs.existsSync(screenshotDir) &&
      fs.existsSync(scriptPath)
    ) {
      tutorials.push(name);
    }
  }

  return tutorials.sort();
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { concurrency } = parseArgs();
  const tutorials = discoverTutorials();

  if (tutorials.length === 0) {
    console.log(
      "No renderable tutorials found. Run capture and tts first."
    );
    process.exit(0);
  }

  console.log(
    `Found ${tutorials.length} tutorial(s) to render: ${tutorials.join(", ")}\n`
  );

  const successes: string[] = [];
  const failures: { name: string; error: string }[] = [];

  for (let i = 0; i < tutorials.length; i++) {
    const name = tutorials[i]!;

    if (i > 0) {
      console.log("\n" + "=".repeat(60) + "\n");
    }

    console.log(`[${i + 1}/${tutorials.length}] Rendering: ${name}`);

    try {
      await renderTutorial(name, concurrency);
      successes.push(name);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error rendering "${name}": ${errMsg}`);
      failures.push({ name, error: errMsg });
    }
  }

  // Batch summary
  console.log("\n" + "=".repeat(60));
  console.log(`\n--- Batch Render Summary ---`);
  console.log(`Total: ${tutorials.length}`);
  console.log(`Succeeded: ${successes.length}`);

  if (failures.length > 0) {
    console.log(`Failed: ${failures.length}`);
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }
}

main().catch((err) => {
  console.error(
    "Batch render failed:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
