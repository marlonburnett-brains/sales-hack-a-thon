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

import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../env";
import type { ExtractedSlide } from "../lib/slide-extractor";

// ────────────────────────────────────────────────────────────
// LLM JSON Schema (Gemini — uses @google/genai Type.* format)
// ────────────────────────────────────────────────────────────

const DESCRIPTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    purpose: {
      type: Type.STRING,
      description:
        "What this slide is designed to communicate and its role in the presentation.",
    },
    visualComposition: {
      type: Type.STRING,
      description:
        "The layout, key visual elements, and how information is organized on the slide.",
    },
    keyContent: {
      type: Type.STRING,
      description:
        "The main points, data, or messaging conveyed by this slide.",
    },
    useCases: {
      type: Type.STRING,
      description:
        "When and how a sales team would use this slide -- which meetings, audiences, or scenarios it fits best.",
    },
  },
  required: ["purpose", "visualComposition", "keyContent", "useCases"],
};

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
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  const prompt = buildDescriptionPrompt(slide, titleSlideText);

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: DESCRIPTION_SCHEMA,
    },
  });

  return response.text ?? "{}";
}
