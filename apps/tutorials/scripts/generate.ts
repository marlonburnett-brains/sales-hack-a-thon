import * as fs from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

type CliArgs =
  | { mode: "all" }
  | { mode: "single"; tutorialName: string };

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TUTORIALS_ROOT = path.resolve(SCRIPT_DIR, "..");
const FIXTURES_DIR = path.join(TUTORIALS_ROOT, "fixtures");
const MONOREPO_ROOT = path.resolve(TUTORIALS_ROOT, "../..");

function usage(): string {
  return [
    "Usage:",
    "  pnpm --filter tutorials generate",
    "  pnpm --filter tutorials generate --all",
    "  pnpm --filter tutorials generate --single <tutorial-name>",
  ].join("\n");
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { mode: "all" };
  }

  if (args.length === 1 && args[0] === "--all") {
    return { mode: "all" };
  }

  if (args.length === 2 && args[0] === "--single") {
    return { mode: "single", tutorialName: args[1]! };
  }

  console.error(usage());
  process.exit(1);
}

function discoverTutorials(): string[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    return [];
  }

  return fs
    .readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(FIXTURES_DIR, name, "script.json")))
    .sort();
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: MONOREPO_ROOT,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

async function generateTutorial(tutorialName: string): Promise<void> {
  console.log(`\nGenerating tutorial: ${tutorialName}`);
  console.log("- Capturing screenshots");
  await runCommand("pnpm", ["--filter", "tutorials", "capture", tutorialName]);

  console.log("- Generating narration audio");
  await runCommand("pnpm", ["--filter", "tutorials", "tts", tutorialName]);

  console.log("- Rendering video");
  await runCommand("pnpm", ["--filter", "tutorials", "render", tutorialName]);
}

async function main(): Promise<void> {
  const cliArgs = parseArgs();
  const availableTutorials = discoverTutorials();

  if (availableTutorials.length === 0) {
    console.error(`No tutorials found in ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const tutorialsToGenerate =
    cliArgs.mode === "single"
      ? [cliArgs.tutorialName]
      : availableTutorials;

  if (cliArgs.mode === "single" && !availableTutorials.includes(cliArgs.tutorialName)) {
    console.error(
      `Unknown tutorial "${cliArgs.tutorialName}". Available tutorials: ${availableTutorials.join(", ")}`
    );
    process.exit(1);
  }

  console.log(`Tutorials: ${tutorialsToGenerate.join(", ")}`);

  const successes: string[] = [];
  const failures: Array<{ name: string; error: string }> = [];

  for (const tutorialName of tutorialsToGenerate) {
    try {
      await generateTutorial(tutorialName);
      successes.push(tutorialName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (cliArgs.mode === "single") {
        throw error;
      }

      failures.push({ name: tutorialName, error: message });
      console.error(`Failed to generate ${tutorialName}: ${message}`);
    }
  }

  console.log("\n--- Tutorial Generation Summary ---");
  console.log(`Requested: ${tutorialsToGenerate.length}`);
  console.log(`Succeeded: ${successes.length}`);

  if (failures.length > 0) {
    console.log(`Failed: ${failures.length}`);
    for (const failure of failures) {
      console.log(`  - ${failure.name}: ${failure.error}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "Tutorial generation failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
