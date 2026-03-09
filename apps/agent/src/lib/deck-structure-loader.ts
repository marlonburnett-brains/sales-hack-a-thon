/**
 * Deck Structure Loader -- Shared helper to load DeckStructure sections
 * for a given touch type and format them for LLM prompts.
 */

import type { ArtifactType } from "@lumenalta/schemas";
import type { DeckSection, DeckStructureOutput } from "../deck-intelligence/deck-structure-schema";
import { resolveDeckStructureKey } from "../deck-intelligence/deck-structure-key";
import { prisma } from "./db";

/**
 * Load DeckStructure sections for a given touch type from the database.
 * Returns the sections array or null if no DeckStructure exists or is empty.
 */
export async function loadDeckSections(
  touchType: string,
  artifactType?: ArtifactType | null,
): Promise<DeckSection[] | null> {
  try {
    const key = resolveDeckStructureKey(touchType, artifactType ?? null);

    const record = await prisma.deckStructure.findFirst({
      where: {
        touchType: key.touchType,
        artifactType: key.artifactType,
      },
      orderBy: { inferredAt: "desc" },
    });

    if (!record?.structureJson) {
      return null;
    }

    const parsed = JSON.parse(record.structureJson) as DeckStructureOutput;
    if (!parsed.sections || parsed.sections.length === 0) {
      return null;
    }

    return parsed.sections;
  } catch (err) {
    console.warn("[deck-structure-loader] Failed to load deck sections:", err);
    return null;
  }
}

/**
 * Format DeckStructure sections into a human-readable string for LLM prompts.
 * Each section is formatted with its order, name, purpose, and metadata.
 */
export function formatSectionsForPrompt(sections: DeckSection[]): string {
  return sections
    .map(
      (section) =>
        `## Section ${section.order}: ${section.name}\nPurpose: ${section.purpose}\nRequired: ${section.isOptional ? "no" : "yes"}\nVariations available: ${section.variationCount}`,
    )
    .join("\n\n");
}
