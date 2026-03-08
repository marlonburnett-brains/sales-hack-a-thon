/**
 * AI Slide Description Generator
 *
 * Generates rich descriptions for each slide using Gemini 2.0 Flash
 * with structured output. Separate from classification for accuracy --
 * different prompt strategies for categorical vs narrative tasks.
 *
 * Description covers: purpose, visualComposition, keyContent, useCases.
 * Stored as JSON string in SlideEmbedding.description column.
 */

import { env } from "../env";
import type { ExtractedSlide } from "../lib/slide-extractor";
import {
  SlideDescriptionLlmSchema,
  zodToLlmJsonSchema,
} from "@lumenalta/schemas";
import {
  createJsonResponseOptions,
  executeRuntimeNamedAgent,
} from "../lib/agent-executor";

// ────────────────────────────────────────────────────────────
// Prompt builder
// ────────────────────────────────────────────────────────────

function buildDescriptionPrompt(
  slide: ExtractedSlide,
  titleSlideText: string
): string {
  return `You are analyzing a single slide from a sales presentation to generate a rich description.

DECK CONTEXT:
- Deck name: ${slide.presentationName}
- Slide index: ${slide.slideIndex}
- Title slide content: ${titleSlideText || "(no title slide text)"}

SLIDE CONTENT:
${slide.textContent || "(empty)"}

SPEAKER NOTES:
${slide.speakerNotes || "(none)"}

Generate a comprehensive description covering:
1. PURPOSE: What is this slide designed to communicate? What role does it play in the presentation?
2. VISUAL COMPOSITION: Describe the layout, key visual elements, and how information is organized.
3. KEY CONTENT: Summarize the main points, data, or messaging on this slide.
4. USE CASES: When and how would a sales team use this specific slide? Which meetings or audiences is it best suited for?

Be specific and actionable. A seller should read this description and immediately understand when to use this slide.`;
}

// ────────────────────────────────────────────────────────────
// Description generation
// ────────────────────────────────────────────────────────────

/**
 * Generate an AI description for a single slide using Gemini 2.0 Flash.
 *
 * Returns the JSON string response with purpose, visualComposition,
 * keyContent, and useCases fields. Stored as-is in the description column.
 *
 * @param slide - The extracted slide to describe
 * @param titleSlideText - Text from slide index 0 for deck context
 * @returns JSON string with description fields
 */
export async function generateSlideDescription(
  slide: ExtractedSlide,
  titleSlideText: string
): Promise<string> {
  const prompt = buildDescriptionPrompt(slide, titleSlideText);

  const response = await executeRuntimeNamedAgent({
    agentId: "slide-description-writer",
    messages: [{ role: "user", content: prompt }],
    options: createJsonResponseOptions(
      zodToLlmJsonSchema(SlideDescriptionLlmSchema) as Record<string, unknown>,
    ),
  });

  return response.text ?? "{}";
}
