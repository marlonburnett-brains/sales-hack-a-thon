import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
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
 * 3. Start Next.js dev server on port 3099 with ALL services pointed at mock
 * 4. Run Playwright spec: capture/{name}.spec.ts
 * 5. Shut down both servers
 * 6. Print summary
 *
 * Zero external dependencies — everything runs on mocks.
 */

const MOCK_SERVER_PORT = 4112;
const WEB_SERVER_PORT = 3099;
const MONOREPO_ROOT = path.resolve(process.cwd(), "../..");

/**
 * Kill any existing processes listening on the given ports.
 * Prevents EADDRINUSE from leftover processes of previous failed runs.
 */
async function killExistingPortProcesses(ports: number[]): Promise<void> {
  const { execSync } = await import("node:child_process");
  for (const port of ports) {
    try {
      const pids = execSync(`lsof -ti :${port}`, { encoding: "utf-8" }).trim();
      if (pids) {
        execSync(`kill -9 ${pids.split("\n").join(" ")}`, { stdio: "ignore" });
        // Brief wait for OS to release the port
        await new Promise((r) => setTimeout(r, 500));
        console.log(`Killed existing process(es) on port ${port}`);
      }
    } catch {
      // No process on this port — good
    }
  }
}

async function waitForServer(
  url: string,
  timeoutMs: number = 60_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return; // Any non-5xx means server is up
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

function startNextServer(): ChildProcess {
  const child = spawn("pnpm", ["--filter", "web", "dev", "--port", String(WEB_SERVER_PORT)], {
    cwd: MONOREPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      // Point ALL external services at the mock server — zero real connections
      // MOCK_AUTH bypasses Supabase auth in the Edge Runtime middleware
      // (Edge Runtime cannot make HTTP requests to localhost)
      MOCK_AUTH: "true",
      AGENT_SERVICE_URL: `http://localhost:${MOCK_SERVER_PORT}`,
      NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_SERVER_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key-for-tutorials",
    },
  });

  // Pipe server output with prefix for debugging
  child.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      console.log(`[web] ${line}`);
    }
  });
  child.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      // Filter noisy webpack warnings
      if (line.includes("PackFileCacheStrategy")) continue;
      console.error(`[web] ${line}`);
    }
  });

  return child;
}

async function main(): Promise<void> {
  const tutorialName = process.argv[2];

  if (!tutorialName) {
    console.error("Usage: pnpm --filter tutorials capture <tutorial-name>");
    console.error("Example: pnpm --filter tutorials capture getting-started");
    process.exit(1);
  }

  // ────────────────────────────────────────────────────────────
  // 0. Kill leftover processes on required ports (idempotent)
  // ────────────────────────────────────────────────────────────

  await killExistingPortProcesses([MOCK_SERVER_PORT, WEB_SERVER_PORT]);

  // ────────────────────────────────────────────────────────────
  // 1. Load and validate the tutorial script
  // ────────────────────────────────────────────────────────────

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

  console.log(`\nTutorial: ${script.title}`);
  console.log(`Steps: ${script.steps.length}`);
  console.log(`Output: output/${tutorialName}/\n`);

  // ────────────────────────────────────────────────────────────
  // 2. Start mock agent server (handles Supabase auth + agent API)
  // ────────────────────────────────────────────────────────────

  let mockServer: Server | null = null;
  let nextProcess: ChildProcess | null = null;

  try {
    console.log(`Starting mock server on port ${MOCK_SERVER_PORT}...`);
    const result = await startMockServer(tutorialName, MOCK_SERVER_PORT);
    mockServer = result.server;
    console.log(`Mock server ready on port ${result.port}`);

    // ────────────────────────────────────────────────────────────
    // 3. Start Next.js dev server with ALL services mocked
    // ────────────────────────────────────────────────────────────

    console.log(`Starting Next.js dev server on port ${WEB_SERVER_PORT}...`);
    nextProcess = startNextServer();

    await waitForServer(`http://localhost:${WEB_SERVER_PORT}`, 90_000);
    console.log(`Next.js dev server ready on port ${WEB_SERVER_PORT}`);

    // ────────────────────────────────────────────────────────────
    // 4. Run Playwright
    // ────────────────────────────────────────────────────────────

    const specPath = path.join("capture", `${tutorialName}.spec.ts`);
    if (!fs.existsSync(path.join(process.cwd(), specPath))) {
      console.error(`Error: Playwright spec not found: ${specPath}`);
      process.exit(1);
    }

    console.log(`\nRunning Playwright: ${specPath}\n`);

    // IMPORTANT: Use spawn (not execSync) so the Node.js event loop stays
    // unblocked. The mock server runs in this same process — execSync would
    // freeze it, preventing SSR data fetches from completing.
    const playwrightExitCode = await new Promise<number>((resolve) => {
      const pw = spawn(
        "npx",
        ["playwright", "test", specPath, "--project=capture"],
        {
          cwd: process.cwd(),
          stdio: "inherit",
          env: {
            ...process.env,
            TUTORIAL_NAME: tutorialName,
            TUTORIAL_WEB_PORT: String(WEB_SERVER_PORT),
            MOCK_AUTH: "true",
            AGENT_SERVICE_URL: `http://localhost:${MOCK_SERVER_PORT}`,
            NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_SERVER_PORT}`,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key-for-tutorials",
          },
        }
      );
      pw.on("close", (code) => resolve(code ?? 1));
    });

    if (playwrightExitCode !== 0) {
      console.error("\nPlaywright test failed. Check output above for details.");
      process.exit(1);
    }

    // ────────────────────────────────────────────────────────────
    // 5. Print summary
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
    if (err instanceof Error && err.message.includes("EADDRINUSE")) {
      console.error(`Error: A required port is already in use.`);
      console.error("Kill existing processes or choose different ports.");
    } else {
      console.error("Capture failed:", err);
    }
    process.exit(1);
  } finally {
    // ────────────────────────────────────────────────────────────
    // 6. Always shut down both servers
    // ────────────────────────────────────────────────────────────
    if (nextProcess) {
      nextProcess.kill("SIGTERM");
      console.log("Next.js dev server stopped.");
    }
    if (mockServer) {
      mockServer.close();
      console.log("Mock server stopped.");
    }
  }
}

main();
