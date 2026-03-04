/**
 * AI-Driven Slide Selection Engine
 *
 * Uses Gemini 2.5 Flash to select and order slides from AtlusAI content
 * for Touch 2 (intro deck) and Touch 3 (capability alignment deck) flows.
 *
 * This module is Touch-agnostic: it accepts a touchType parameter and
 * uses the appropriate LLM schema for each touch type. Touch-specific
 * logic stays in the workflow layer (Plan 04-03).
 *
 * Flow:
 *   1. Search AtlusAI content via atlusai-search.ts (Drive API fallback)
 *   2. Feed search results + deal context to Gemini 2.5 Flash
 *   3. Gemini selects and orders slides using the appropriate schema
 *   4. Return selected slide IDs, ordering, and personalization notes
 */

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  zodToGeminiSchema,
  IntroDeckSelectionLlmSchema,
  CapabilityDeckSelectionLlmSchema,
} from "@lumenalta/schemas";
import type {
  IntroDeckSelection,
  CapabilityDeckSelection,
} from "@lumenalta/schemas";
import { searchSlides, searchByCapability } from "./atlusai-search";
import type { SlideSearchResult } from "./atlusai-search";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface SlideSelectionParams {
  /** Which touch type to select slides for */
  touchType: "touch_2" | "touch_3";
  /** Company name for context */
  companyName: string;
  /** Industry for relevance filtering */
  industry: string;
  /** Capability areas for Touch 3 filtering */
  capabilityAreas?: string[];
  /** Additional context about the deal */
  context?: string;
  /** Prior touch outputs for cross-touch continuity */
  priorTouchOutputs?: string[];
  /** Maximum number of candidate slides to search for (default 30) */
  limit?: number;
}

export interface SlideSelectionResult {
  /** Selected slide IDs from the candidate list */
  selectedSlideIds: string[];
  /** Ordered slide IDs defining the deck sequence */
  slideOrder: string[];
  /** Notes on how to customize slides for this company */
  personalizationNotes: string;
  /** Capability areas (Touch 3 only) */
  capabilityAreas?: string[];
  /** Raw candidate slides that were searched */
  candidateSlides: SlideSearchResult[];
}

// ────────────────────────────────────────────────────────────
// Internal: Prompt construction
// ────────────────────────────────────────────────────────────

function buildTouch2Prompt(
  params: SlideSelectionParams,
  candidates: SlideSearchResult[]
): string {
  const parts: string[] = [
    "You are selecting slides for a Meet Lumenalta introductory deck.",
    "",
    `Company: ${params.companyName}`,
    `Industry: ${params.industry}`,
  ];

  if (params.context) {
    parts.push(`Additional context: ${params.context}`);
  }

  if (params.priorTouchOutputs?.length) {
    parts.push("");
    parts.push("Prior touch outputs (use for consistency):");
    for (const output of params.priorTouchOutputs) {
      parts.push(`  - ${output}`);
    }
  }

  parts.push("");
  parts.push("Available slides to choose from:");
  parts.push("");

  for (const slide of candidates) {
    parts.push(`Slide ID: ${slide.slideId}`);
    parts.push(`Title: ${slide.documentTitle}`);
    if (slide.textContent) {
      parts.push(`Content: ${slide.textContent.substring(0, 500)}`);
    }
    if (slide.speakerNotes) {
      parts.push(`Notes: ${slide.speakerNotes.substring(0, 300)}`);
    }
    parts.push("---");
  }

  parts.push("");
  parts.push("Instructions:");
  parts.push("1. Select the slides most relevant to this company's industry and context.");
  parts.push("2. Order slides for a logical narrative flow that introduces Lumenalta effectively.");
  parts.push("3. Reference any prior touch outputs to maintain consistency across touch points.");
  parts.push("4. ONLY return slide IDs from the provided candidate list — do NOT invent IDs.");
  parts.push("5. Include personalization notes on how to customize the selected slides.");

  return parts.join("\n");
}

function buildTouch3Prompt(
  params: SlideSelectionParams,
  candidates: SlideSearchResult[]
): string {
  const parts: string[] = [
    "You are selecting slides for a capability alignment deck.",
    "",
    `Company: ${params.companyName}`,
    `Industry: ${params.industry}`,
  ];

  if (params.capabilityAreas?.length) {
    parts.push(
      `Target capability areas: ${params.capabilityAreas.join(", ")}`
    );
  }

  if (params.context) {
    parts.push(`Additional context: ${params.context}`);
  }

  if (params.priorTouchOutputs?.length) {
    parts.push("");
    parts.push("Prior touch outputs (use for consistency):");
    for (const output of params.priorTouchOutputs) {
      parts.push(`  - ${output}`);
    }
  }

  parts.push("");
  parts.push("Available slides to choose from:");
  parts.push("");

  for (const slide of candidates) {
    parts.push(`Slide ID: ${slide.slideId}`);
    parts.push(`Title: ${slide.documentTitle}`);
    if (slide.textContent) {
      parts.push(`Content: ${slide.textContent.substring(0, 500)}`);
    }
    if (slide.speakerNotes) {
      parts.push(`Notes: ${slide.speakerNotes.substring(0, 300)}`);
    }
    parts.push("---");
  }

  parts.push("");
  parts.push("Instructions:");
  parts.push("1. Prioritize slides that match the specified capability areas.");
  parts.push("2. Select slides most relevant to this company's industry and context.");
  parts.push("3. Order slides for a logical capability demonstration flow.");
  parts.push("4. Reference any prior touch outputs to maintain consistency across touch points.");
  parts.push("5. ONLY return slide IDs from the provided candidate list — do NOT invent IDs.");
  parts.push("6. Include the capability areas you focused on and personalization notes.");

  return parts.join("\n");
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Select and order slides for a deck using AI-driven content selection.
 *
 * 1. Searches AtlusAI content via Drive API fallback
 * 2. Passes candidates to Gemini 2.5 Flash with the appropriate schema
 * 3. Returns selected + ordered slide IDs with personalization notes
 *
 * @param params - Selection parameters including touch type, company, industry
 * @returns Selected slide IDs, ordering, personalization notes, and candidates
 */
export async function selectSlidesForDeck(
  params: SlideSelectionParams
): Promise<SlideSelectionResult> {
  // Step 1: Search for candidate slides
  const searchLimit = params.limit ?? 30;
  let candidates: SlideSearchResult[];

  if (
    params.touchType === "touch_3" &&
    params.capabilityAreas?.length
  ) {
    candidates = await searchByCapability({
      capabilityAreas: params.capabilityAreas,
      industry: params.industry,
      limit: searchLimit,
    });
  } else {
    candidates = await searchSlides({
      query: `Meet Lumenalta intro slides for ${params.industry} industry`,
      industry: params.industry,
      touchType: params.touchType,
      limit: searchLimit,
    });
  }

  // If no candidates found, return empty result
  if (candidates.length === 0) {
    return {
      selectedSlideIds: [],
      slideOrder: [],
      personalizationNotes:
        "No candidate slides found in the knowledge base. Ensure slides have been ingested into AtlusAI.",
      candidateSlides: [],
    };
  }

  // Step 2: Build prompt and call LLM via Vertex AI
  if (!env.GOOGLE_CLOUD_PROJECT) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT is not set. Required for AI-driven slide selection."
    );
  }

  const ai = new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION });

  if (params.touchType === "touch_2") {
    return selectForTouch2(ai, params, candidates);
  } else {
    return selectForTouch3(ai, params, candidates);
  }
}

/**
 * Touch 2: Intro deck slide selection via Gemini + IntroDeckSelectionLlmSchema
 */
async function selectForTouch2(
  ai: GoogleGenAI,
  params: SlideSelectionParams,
  candidates: SlideSearchResult[]
): Promise<SlideSelectionResult> {
  const prompt = buildTouch2Prompt(params, candidates);
  const responseSchema = zodToGeminiSchema(IntroDeckSelectionLlmSchema);

  const response = await ai.models.generateContent({
    model: "gpt-oss-120b",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: responseSchema,
    },
  });

  const text = response.text ?? "{}";
  const parsed: IntroDeckSelection = IntroDeckSelectionLlmSchema.parse(
    JSON.parse(text)
  );

  return {
    selectedSlideIds: parsed.selectedSlideIds,
    slideOrder: parsed.slideOrder,
    personalizationNotes: parsed.personalizationNotes,
    candidateSlides: candidates,
  };
}

/**
 * Touch 3: Capability deck slide selection via Gemini + CapabilityDeckSelectionLlmSchema
 */
async function selectForTouch3(
  ai: GoogleGenAI,
  params: SlideSelectionParams,
  candidates: SlideSearchResult[]
): Promise<SlideSelectionResult> {
  const prompt = buildTouch3Prompt(params, candidates);
  const responseSchema = zodToGeminiSchema(CapabilityDeckSelectionLlmSchema);

  const response = await ai.models.generateContent({
    model: "gpt-oss-120b",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: responseSchema,
    },
  });

  const text = response.text ?? "{}";
  const parsed: CapabilityDeckSelection =
    CapabilityDeckSelectionLlmSchema.parse(JSON.parse(text));

  return {
    selectedSlideIds: parsed.selectedSlideIds,
    slideOrder: parsed.slideOrder,
    personalizationNotes: parsed.personalizationNotes,
    capabilityAreas: parsed.capabilityAreas,
    candidateSlides: candidates,
  };
}
