import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import type { Server } from "node:http";
import { TutorialScriptSchema } from "../src/types/tutorial-script.js";
import { startMockServer } from "./mock-server.js";

/**
 * Capture Orchestration Script
 *
 * Usage: pnpm --filter tutorials capture <tutorial-name>
 *
 * Flow:
 * 1. Load and validate tutorial script from fixtures/{name}/script.json
 * 2. Start mock agent server on port 4112
 * 3. Run Playwright spec: capture/{name}.spec.ts
 * 4. Shut down mock server
 * 5. Print summary
 */

const MOCK_SERVER_PORT = 4112;

async function main(): Promise<void> {
  const tutorialName = process.argv[2];

  if (!tutorialName) {
    console.error("Usage: pnpm --filter tutorials capture <tutorial-name>");
    console.error("Example: pnpm --filter tutorials capture getting-started");
    process.exit(1);
  }

  // ────────────────────────────────────────────────────────────
  // 1. Load and validate the tutorial script
  // ────────────────────────────────────────────────────────────

  const scriptPath = path.join(
    process.cwd(),
    "fixtures",
    tutorialName,
    "script.json"
  );

  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: Tutorial script not found: ${scriptPath}`);
    console.error(
      `\nTo generate it, run: pnpm --filter tutorials generate ${tutorialName}`
    );
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

  console.log(`\nTutorial: ${script.title}`);
  console.log(`Steps: ${script.steps.length}`);
  console.log(`Output: output/${tutorialName}/\n`);

  // ────────────────────────────────────────────────────────────
  // 2. Start mock agent server
  // ────────────────────────────────────────────────────────────

  let server: Server | null = null;

  try {
    console.log(`Starting mock agent server on port ${MOCK_SERVER_PORT}...`);
    const result = await startMockServer(tutorialName, MOCK_SERVER_PORT);
    server = result.server;
    console.log(`Mock server ready on port ${result.port}`);

    // ────────────────────────────────────────────────────────────
    // 3. Run Playwright
    // ────────────────────────────────────────────────────────────

    const specPath = path.join("capture", `${tutorialName}.spec.ts`);
    if (!fs.existsSync(path.join(process.cwd(), specPath))) {
      console.error(`Error: Playwright spec not found: ${specPath}`);
      console.error(
        "Create it at apps/tutorials/capture/" + tutorialName + ".spec.ts"
      );
      process.exit(1);
    }

    console.log(`\nRunning Playwright: ${specPath}\n`);

    try {
      execSync(`npx playwright test ${specPath} --project=capture`, {
        cwd: process.cwd(),
        stdio: "inherit",
        env: {
          ...process.env,
          TUTORIAL_NAME: tutorialName,
          AGENT_SERVICE_URL: `http://localhost:${MOCK_SERVER_PORT}`,
        },
      });
    } catch {
      // Playwright exited with non-zero -- screenshots may be partial
      console.error("\nPlaywright test failed. Check output above for details.");
      process.exit(1);
    }

    // ────────────────────────────────────────────────────────────
    // 4. Print summary
    // ────────────────────────────────────────────────────────────

    const outputDir = path.join(process.cwd(), "output", tutorialName);
    const screenshots = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter((f) => f.endsWith(".png"))
      : [];

    console.log(`\n--- Capture Summary ---`);
    console.log(`Tutorial: ${script.title}`);
    console.log(`Screenshots: ${screenshots.length}/${script.steps.length}`);
    console.log(`Output: ${outputDir}`);

    if (screenshots.length !== script.steps.length) {
      console.warn(
        `\nWarning: Expected ${script.steps.length} screenshots but found ${screenshots.length}`
      );
    }
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("EADDRINUSE")
    ) {
      console.error(
        `Error: Port ${MOCK_SERVER_PORT} is already in use.`
      );
      console.error(
        "Kill the existing process or choose a different port."
      );
    } else {
      console.error("Capture failed:", err);
    }
    process.exit(1);
  } finally {
    // ────────────────────────────────────────────────────────────
    // 5. Always shut down mock server
    // ────────────────────────────────────────────────────────────
    if (server) {
      server.close();
      console.log("Mock server stopped.");
    }
  }
}

main();
