import * as fs from "node:fs";
import * as path from "node:path";
import type { FixtureSet } from "./types.js";

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
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
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

  let fixtures: FixtureSet = { companies, deals, users };

  // Apply tutorial-specific overrides if they exist
  const overridesPath = path.join(FIXTURES_DIR, tutorialName, "overrides.json");
  const overrides = loadJsonFile<Partial<FixtureSet>>(overridesPath);

  if (overrides) {
    fixtures = deepMerge(fixtures, overrides);
  }

  return fixtures;
}
