/**
 * ModificationPlan LLM Schema — Slide Content Modifications
 *
 * Defines what content changes the LLM should make to a selected slide
 * to tailor it for the current deal context. Used by the Modification
 * Executor (Phase 55) to apply text replacements via Google Slides API.
 *
 * Dual schema pattern:
 *   - Zod schema (ModificationPlanLlmSchema) for Mastra structured output
 *   - GenAI schema (MODIFICATION_PLAN_SCHEMA) for Google Gemini responseSchema
 *
 * LLM-safe: flat objects, all fields required, no optionals, no unions (NFR-5).
 */

import { z } from "zod";
import { Type } from "@google/genai";

// ────────────────────────────────────────────────────────────
// Zod Schema (FR-1.5, NFR-5)
// ────────────────────────────────────────────────────────────

export const ModificationPlanLlmSchema = z.object({
  slideId: z.string().meta({
    description: "SlideEmbedding ID of the slide to modify.",
  }),
  slideObjectId: z.string().meta({
    description:
      "Google Slides object ID of the slide (used for API calls).",
  }),
  modifications: z
    .array(
      z.object({
        elementId: z.string().meta({
          description:
            "Google Slides shape/text element object ID to modify.",
        }),
        currentContent: z.string().meta({
          description:
            "Current text content of the element (for verification before replacement).",
        }),
        newContent: z.string().meta({
          description:
            "Replacement text content tailored to the deal context.",
        }),
        reason: z.string().meta({
          description:
            "Why this modification improves the slide for the target deal.",
        }),
      })
    )
    .meta({
      description:
        "Ordered list of element-level text modifications to apply.",
    }),
  unmodifiedElements: z.array(z.string()).meta({
    description:
      "Element object IDs that should remain unchanged. Ensures LLM explicitly acknowledges elements it chose not to modify.",
  }),
});

export type ModificationPlan = z.infer<typeof ModificationPlanLlmSchema>;

// ────────────────────────────────────────────────────────────
// Google GenAI Response Schema (NFR-5)
// ────────────────────────────────────────────────────────────

export const MODIFICATION_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    slideId: {
      type: Type.STRING,
      description: "SlideEmbedding ID of the slide to modify.",
    },
    slideObjectId: {
      type: Type.STRING,
      description:
        "Google Slides object ID of the slide (used for API calls).",
    },
    modifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          elementId: {
            type: Type.STRING,
            description:
              "Google Slides shape/text element object ID to modify.",
          },
          currentContent: {
            type: Type.STRING,
            description:
              "Current text content of the element (for verification before replacement).",
          },
          newContent: {
            type: Type.STRING,
            description:
              "Replacement text content tailored to the deal context.",
          },
          reason: {
            type: Type.STRING,
            description:
              "Why this modification improves the slide for the target deal.",
          },
        },
        required: ["elementId", "currentContent", "newContent", "reason"],
      },
      description:
        "Ordered list of element-level text modifications to apply.",
    },
    unmodifiedElements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Element object IDs that should remain unchanged. Ensures LLM explicitly acknowledges elements it chose not to modify.",
    },
  },
  required: ["slideId", "slideObjectId", "modifications", "unmodifiedElements"],
};
