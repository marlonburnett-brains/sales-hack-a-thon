/**
 * Deck Structure Schema — Google GenAI structured output definition
 *
 * Defines the TypeScript interfaces and GenAI responseSchema for
 * AI-inferred deck structures per touch type.
 */

import { Type } from "@google/genai";

// ────────────────────────────────────────────────────────────
// TypeScript Interfaces
// ────────────────────────────────────────────────────────────

export interface DeckSection {
  /** Position in deck flow (1-based) */
  order: number;
  /** Section name (e.g., "Company Overview", "Solution Architecture") */
  name: string;
  /** Why this section exists in the deck */
  purpose: string;
  /** Whether this section is always present across examples */
  isOptional: boolean;
  /** Number of slide variations available for this section */
  variationCount: number;
  /** SlideEmbedding IDs that map to this section */
  slideIds: string[];
  /**
   * How many slides this section typically uses in example decks.
   * Default 1. Sections like "Case Studies" or "Capabilities" often span 2-5 slides.
   * The section matcher will select this many distinct slides for this section.
   */
  typicalSlideCount?: number;
}

export interface DeckStructureOutput {
  /** Ordered list of deck sections */
  sections: DeckSection[];
  /** Explanation of why sections are in this order */
  sequenceRationale: string;
}

// ────────────────────────────────────────────────────────────
// Google GenAI Response Schema
// ────────────────────────────────────────────────────────────

export const DECK_STRUCTURE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          order: {
            type: Type.NUMBER,
            description:
              "Position in the deck flow (1-based). Represents the natural ordering of this section within a complete presentation.",
          },
          name: {
            type: Type.STRING,
            description:
              'Concise section name (e.g., "Title Slide", "Company Overview", "Case Studies", "Pricing & Timeline"). Should be recognizable across different decks.',
          },
          purpose: {
            type: Type.STRING,
            description:
              "Why this section exists in the deck. Describe its role in the narrative flow and what it communicates to the audience.",
          },
          isOptional: {
            type: Type.BOOLEAN,
            description:
              "Whether this section is optional. Set to false if this section appears in all or nearly all example decks. Set to true if it only appears in some examples.",
          },
          variationCount: {
            type: Type.NUMBER,
            description:
              "Number of distinct slide variations found across all examples and templates that could fill this section. Count unique approaches, not duplicates.",
          },
          slideIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Array of SlideEmbedding IDs (from the provided slide data) that map to this section. ONLY include Slide IDs from PRIMARY EXAMPLES, not from secondary templates.",
          },
          typicalSlideCount: {
            type: Type.NUMBER,
            description:
              "How many slides this section typically spans in the example decks. Count the average number of slides used for this section across examples. " +
              "Title slides = 1, Agenda = 1, but sections like Case Studies may use 2-4 slides, Capabilities may use 3-6 slides, " +
              "Methodology may use 2-3 slides. Be accurate based on what you observe in the examples.",
          },
        },
        required: ["order", "name", "purpose", "isOptional", "variationCount", "slideIds", "typicalSlideCount"],
      },
      description:
        "Ordered list of deck sections representing the common structure pattern found across all provided example decks.",
    },
    sequenceRationale: {
      type: Type.STRING,
      description:
        "Detailed explanation of why sections are ordered this way. Reference the narrative flow, sales methodology, and patterns observed in the example decks.",
    },
  },
  required: ["sections", "sequenceRationale"],
};

// ────────────────────────────────────────────────────────────
// Confidence Calculation
// ────────────────────────────────────────────────────────────

export interface ConfidenceResult {
  score: number;
  color: "green" | "yellow" | "red";
  label: string;
}

/**
 * Calculate confidence score based on the number of classified examples
 * available for a given touch type.
 *
 * Thresholds:
 *   0 examples     = 0  / red    / "No examples"
 *   1-2 examples   = 20+10*n / red    / "Low confidence"
 *   3-5 examples   = 50+5*n  / yellow / "Medium confidence"
 *   6+  examples   = min(95, 50+7*n) / green / "High confidence"
 */
export function calculateConfidence(exampleCount: number): ConfidenceResult {
  if (exampleCount <= 0) {
    return { score: 0, color: "red", label: "No examples" };
  }
  if (exampleCount <= 2) {
    return {
      score: 20 + 10 * exampleCount,
      color: "red",
      label: "Low confidence",
    };
  }
  if (exampleCount <= 5) {
    return {
      score: 50 + 5 * exampleCount,
      color: "yellow",
      label: "Medium confidence",
    };
  }
  return {
    score: Math.min(95, 50 + 7 * exampleCount),
    color: "green",
    label: "High confidence",
  };
}
