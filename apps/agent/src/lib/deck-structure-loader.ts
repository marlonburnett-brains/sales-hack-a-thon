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

// ────────────────────────────────────────────────────────────
// Element-enriched variants
// ────────────────────────────────────────────────────────────

/** Data shape for element samples attached to a slide. */
export interface SectionElementData {
  contentText: string;
  elementType: string;
  isBold: boolean;
}

/** Return type for loadDeckSectionsWithElements. */
export interface EnrichedDeckSections {
  sections: DeckSection[];
  elementsBySlideId: Map<string, SectionElementData[]>;
}

/**
 * Load DeckStructure sections AND representative slide element samples.
 *
 * Same as loadDeckSections but additionally queries SlideElement rows for
 * every slideId referenced in the structure, returning a Map keyed by
 * slideId. The elements query is batched (single findMany) to avoid N+1.
 */
export async function loadDeckSectionsWithElements(
  touchType: string,
  artifactType?: ArtifactType | null,
): Promise<EnrichedDeckSections | null> {
  try {
    const sections = await loadDeckSections(touchType, artifactType);
    if (!sections || sections.length === 0) {
      return null;
    }

    // Collect all slideIds across all sections
    const allSlideIds = sections.flatMap((s) => s.slideIds);

    if (allSlideIds.length === 0) {
      return { sections, elementsBySlideId: new Map() };
    }

    // Batched query: fetch top elements per slide, ordered by fontSize desc
    const slides = await prisma.slideEmbedding.findMany({
      where: { id: { in: allSlideIds } },
      select: {
        id: true,
        elements: {
          where: { contentText: { not: "" } },
          orderBy: { fontSize: "desc" },
          take: 5,
          select: {
            contentText: true,
            elementType: true,
            isBold: true,
          },
        },
      },
    });

    const elementsBySlideId = new Map<string, SectionElementData[]>();
    for (const slide of slides) {
      if (slide.elements.length > 0) {
        elementsBySlideId.set(slide.id, slide.elements);
      }
    }

    return { sections, elementsBySlideId };
  } catch (err) {
    console.warn("[deck-structure-loader] Failed to load deck sections with elements:", err);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Slot analysis variants (all elements, richer data for slot counting)
// ────────────────────────────────────────────────────────────

/** Data shape for slot-analysis elements (includes fontSize + positionY). */
export interface SlotAnalysisElement {
  contentText: string;
  elementType: string;
  isBold: boolean;
  fontSize: number | null;
  positionY: number;
}

/** Return type for loadDeckSectionsForSlotAnalysis. */
export interface SlotAnalysisData {
  sections: DeckSection[];
  elementsBySlideId: Map<string, SlotAnalysisElement[]>;
}

/**
 * Load DeckStructure sections AND ALL text elements per slide
 * (no take limit) with fontSize and positionY for slot counting.
 */
export async function loadDeckSectionsForSlotAnalysis(
  touchType: string,
  artifactType?: ArtifactType | null,
): Promise<SlotAnalysisData | null> {
  try {
    const sections = await loadDeckSections(touchType, artifactType);
    if (!sections || sections.length === 0) {
      return null;
    }

    const allSlideIds = sections.flatMap((s) => s.slideIds);
    if (allSlideIds.length === 0) {
      return { sections, elementsBySlideId: new Map() };
    }

    const slides = await prisma.slideEmbedding.findMany({
      where: { id: { in: allSlideIds } },
      select: {
        id: true,
        elements: {
          where: { contentText: { not: "" } },
          orderBy: { positionY: "asc" },
          select: {
            contentText: true,
            elementType: true,
            isBold: true,
            fontSize: true,
            positionY: true,
          },
        },
      },
    });

    const elementsBySlideId = new Map<string, SlotAnalysisElement[]>();
    for (const slide of slides) {
      if (slide.elements.length > 0) {
        elementsBySlideId.set(slide.id, slide.elements);
      }
    }

    return { sections, elementsBySlideId };
  } catch (err) {
    console.warn("[deck-structure-loader] Failed to load deck sections for slot analysis:", err);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Slot derivation
// ────────────────────────────────────────────────────────────

/** Per-section slot counts derived from template element analysis. */
export interface SectionSlotCounts {
  sectionName: string;
  sectionPurpose: string;
  headlineCount: number;
  bodyParagraphCount: number;
  metricCount: number;
  bulletPointCount: number;
}

const METRIC_VALUE_RE = /^[\d.,]+[%xXkKmMbB$+\-~]*$/;
const DOLLAR_AMOUNT_RE = /^\$[\d.,]+[kKmMbB]*$/;

/**
 * Classify template elements into content slot types and return
 * per-section counts. Used to instruct the LLM on how many of each
 * content type to generate per section.
 */
export function deriveSectionSlotCounts(
  sections: DeckSection[],
  elementsBySlideId: Map<string, SlotAnalysisElement[]>,
): SectionSlotCounts[] {
  return sections.map((section) => {
    // Collect elements from ALL slides in this section
    const slideCount = section.slideIds.length || 1;
    let totalHeadlines = 0;
    let totalBody = 0;
    let totalMetrics = 0;
    let totalBullets = 0;

    for (const slideId of section.slideIds) {
      const elements = elementsBySlideId.get(slideId);
      if (!elements) continue;

      // Deduplicate by contentText within this slide
      const seen = new Set<string>();
      for (const el of elements) {
        const text = el.contentText.trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);

        // Classification priority: metric > headline > body > bullet
        if (METRIC_VALUE_RE.test(text) || DOLLAR_AMOUNT_RE.test(text)) {
          totalMetrics++;
        } else if (
          (el.fontSize != null && el.fontSize >= 18) ||
          (el.isBold && text.length < 80)
        ) {
          totalHeadlines++;
        } else if (text.length > 100) {
          totalBody++;
        } else {
          totalBullets++;
        }
      }
    }

    return {
      sectionName: section.name,
      sectionPurpose: section.purpose,
      headlineCount: Math.ceil(totalHeadlines / slideCount),
      bodyParagraphCount: Math.ceil(totalBody / slideCount),
      metricCount: Math.ceil(totalMetrics / slideCount),
      bulletPointCount: Math.ceil(totalBullets / slideCount),
    };
  });
}

// ────────────────────────────────────────────────────────────
// Slot-aware prompt formatter
// ────────────────────────────────────────────────────────────

/**
 * Format DeckStructure sections with slot counts and example content
 * into a human-readable string for LLM prompts.
 */
export function formatSectionsWithSlotsForPrompt(
  slotCounts: SectionSlotCounts[],
  sections: DeckSection[],
  elementsBySlideId: Map<string, SlotAnalysisElement[]>,
): string {
  return sections
    .map((section) => {
      const slots = slotCounts.find((sc) => sc.sectionName === section.name);

      let block = `## Section ${section.order}: ${section.name}\nPurpose: ${section.purpose}\nRequired: ${section.isOptional ? "no" : "yes"}`;

      if (slots) {
        block += `\nContent slots needed:`;
        block += `\n- Headlines: ${slots.headlineCount} (large/bold text items)`;
        block += `\n- Body paragraphs: ${slots.bodyParagraphCount} (narrative text blocks)`;
        block += `\n- Metrics: ${slots.metricCount} (value + label pairs, e.g., "80%" / "Reduction in QA effort")`;
        block += `\n- Bullet points: ${slots.bulletPointCount} (capability/feature items)`;
      }

      // Add example content (same pattern as formatSectionsWithElementsForPrompt)
      const allElements: SlotAnalysisElement[] = [];
      for (const slideId of section.slideIds) {
        const elements = elementsBySlideId.get(slideId);
        if (elements) {
          allElements.push(...elements);
        }
      }

      if (allElements.length > 0) {
        const seen = new Set<string>();
        const unique: SlotAnalysisElement[] = [];
        for (const el of allElements) {
          if (!seen.has(el.contentText)) {
            seen.add(el.contentText);
            unique.push(el);
          }
        }

        const samples = unique.slice(0, 5).map((el) => {
          const text =
            el.contentText.slice(0, 150) +
            (el.contentText.length > 150 ? "..." : "");
          return `- ${text}`;
        });

        block += `\nExample content from this section:\n${samples.join("\n")}`;
      }

      return block;
    })
    .join("\n\n");
}

/**
 * Format DeckStructure sections with representative element text samples
 * into a human-readable string for LLM prompts.
 *
 * Extends formatSectionsForPrompt by appending an "Example content" block
 * per section with deduplicated, truncated element text bullets.
 */
export function formatSectionsWithElementsForPrompt(
  sections: DeckSection[],
  elementsBySlideId: Map<string, SectionElementData[]>,
): string {
  return sections
    .map((section) => {
      // Base section info (same as formatSectionsForPrompt)
      let block = `## Section ${section.order}: ${section.name}\nPurpose: ${section.purpose}\nRequired: ${section.isOptional ? "no" : "yes"}\nVariations available: ${section.variationCount}`;

      // Collect elements from all slides in this section
      const allElements: SectionElementData[] = [];
      for (const slideId of section.slideIds) {
        const elements = elementsBySlideId.get(slideId);
        if (elements) {
          allElements.push(...elements);
        }
      }

      if (allElements.length > 0) {
        // Deduplicate by exact contentText match
        const seen = new Set<string>();
        const unique: SectionElementData[] = [];
        for (const el of allElements) {
          if (!seen.has(el.contentText)) {
            seen.add(el.contentText);
            unique.push(el);
          }
        }

        // Take top 5 and truncate
        const samples = unique.slice(0, 5).map((el) => {
          const text = el.contentText.slice(0, 150) + (el.contentText.length > 150 ? "..." : "");
          return `- ${text}`;
        });

        block += `\nExample content from this section:\n${samples.join("\n")}`;
      }

      return block;
    })
    .join("\n\n");
}
