import * as fs from "node:fs";
import * as path from "node:path";
import { StageFixtureSchema, SequenceFileSchema } from "./types.js";
import type { FixtureSet, StageFixture, SequenceFile } from "./types.js";

/**
 * Fixture Loader
 *
 * Loads shared fixtures from fixtures/shared/*.json, then applies
 * tutorial-specific overrides from fixtures/{tutorialName}/overrides.json
 * if that file exists. Returns a typed FixtureSet object.
 */

// Use process.cwd() + "fixtures" to work in both ESM and CJS contexts
// (Playwright runs specs via tsx which may use CJS interop)
const FIXTURES_DIR = path.join(process.cwd(), "fixtures");

/**
 * Deep merge source into target. Arrays are replaced (not concatenated).
 * Objects are recursively merged.
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = sourceVal as T[keyof T];
    }
  }

  return result;
}

function loadJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Load fixtures for a given tutorial.
 *
 * 1. Loads shared fixtures from fixtures/shared/*.json
 * 2. If fixtures/{tutorialName}/overrides.json exists, deep-merges overrides
 * 3. Returns a typed FixtureSet
 */
export function loadFixtures(tutorialName: string): FixtureSet {
  const sharedDir = path.join(FIXTURES_DIR, "shared");

  // Load shared fixture files
  const companies = loadJsonFile<FixtureSet["companies"]>(
    path.join(sharedDir, "companies.json")
  ) ?? [];
  const deals = loadJsonFile<FixtureSet["deals"]>(
    path.join(sharedDir, "deals.json")
  ) ?? [];
  const users = loadJsonFile<FixtureSet["users"]>(
    path.join(sharedDir, "users.json")
  ) ?? [];

  // Load optional shared fixtures (templates, slides)
  const templates = loadJsonFile<FixtureSet["templates"]>(
    path.join(sharedDir, "templates.json")
  ) ?? undefined;
  const slides = loadJsonFile<FixtureSet["slides"]>(
    path.join(sharedDir, "slides.json")
  ) ?? undefined;

  let fixtures: FixtureSet = { companies, deals, users };
  if (templates) fixtures.templates = templates;
  if (slides) fixtures.slides = slides;

  // Apply tutorial-specific overrides if they exist
  const overridesPath = path.join(FIXTURES_DIR, tutorialName, "overrides.json");
  const overrides = loadJsonFile<Partial<FixtureSet>>(overridesPath);

  if (overrides) {
    fixtures = deepMerge(fixtures, overrides);
  }

  return fixtures;
}

/**
 * Load stage-specific fixture overrides for a given tutorial and stage.
 *
 * Loads from fixtures/{tutorialName}/stages/{stage}.json if it exists.
 * Returns null if the file doesn't exist (stage has no overrides).
 * Validates against StageFixtureSchema at load time.
 *
 * @param tutorialName - Tutorial identifier (e.g., "touch-4-hitl")
 * @param stage - HITL stage name (e.g., "skeleton", "hifi")
 */
export function loadStageFixtures(
  tutorialName: string,
  stage: string
): Partial<FixtureSet> | null {
  const stagePath = path.join(
    FIXTURES_DIR,
    tutorialName,
    "stages",
    `${stage}.json`
  );
  const raw = loadJsonFile<unknown>(stagePath);
  if (raw === null) return null;

  const parsed = StageFixtureSchema.parse(raw);
  return parsed as Partial<FixtureSet>;
}

/**
 * Load all sequence files for a given tutorial.
 *
 * Reads all JSON files from fixtures/{tutorialName}/sequences/ directory.
 * Each file is an ordered array of responses validated against SequenceFileSchema.
 * Returns a record keyed by filename (without .json extension).
 *
 * Example: sequences/workflow-status.json -> { "workflow-status": [...] }
 *
 * Returns empty record if the sequences directory doesn't exist.
 *
 * @param tutorialName - Tutorial identifier (e.g., "touch-4-hitl")
 */
export function loadSequences(
  tutorialName: string
): Record<string, unknown[]> {
  const seqDir = path.join(FIXTURES_DIR, tutorialName, "sequences");

  if (!fs.existsSync(seqDir) || !fs.statSync(seqDir).isDirectory()) {
    return {};
  }

  const files = fs
    .readdirSync(seqDir)
    .filter((f) => f.endsWith(".json"));

  const sequences: Record<string, unknown[]> = {};

  for (const file of files) {
    const key = path.basename(file, ".json");
    const raw = loadJsonFile<unknown[]>(path.join(seqDir, file));
    if (raw !== null) {
      const validated = SequenceFileSchema.parse(raw);
      sequences[key] = validated;
    }
  }

  return sequences;
}
