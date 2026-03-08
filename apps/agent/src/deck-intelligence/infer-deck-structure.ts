/**
 * Deck Structure Inference Engine
 *
 * Gathers classified examples and templates per touch type, feeds slide
 * descriptions, element maps, classification metadata, and positional data
 * to Google GenAI structured output, and produces a per-touch-type deck
 * structure showing section flow, variations, and mapped reference slides.
 */

import { GoogleGenAI } from "@google/genai";
import { type ArtifactType } from "@lumenalta/schemas";
import crypto from "node:crypto";
import { env } from "../env";
import { prisma } from "../lib/db";
import {
  resolveDeckStructureKey,
  type DeckStructureKey,
} from "./deck-structure-key";
import {
  DECK_STRUCTURE_SCHEMA,
  calculateConfidence,
  type DeckStructureOutput,
} from "./deck-structure-schema";

export const GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE =
  'Generic Touch 4 deck structures are unavailable until artifact-aware inference ships.';

type DeckStructureKeyInput = string | DeckStructureKey;

export function isUnsupportedGenericTouch4(
  touchType: string,
  artifactType: ArtifactType | null = null,
): boolean {
  return touchType === "touch_4" && artifactType === null;
}

function getDeckStructureKey(
  input: DeckStructureKeyInput,
  artifactType: ArtifactType | null = null,
): DeckStructureKey {
  if (typeof input === "string") {
    return resolveDeckStructureKey(input, artifactType);
  }

  return resolveDeckStructureKey(input.touchType, input.artifactType);
}

export function buildEmptyDeckStructureOutput(
  touchType: string,
  reason?: string,
): DeckStructureOutput {
  return {
    sections: [],
    sequenceRationale:
      reason ??
      `No classified examples or templates found for touch type "${touchType}". Classify presentations as examples and assign touch types to enable AI inference.`,
  };
}

async function upsertDeckStructure(
  key: DeckStructureKey,
  data: {
    structureJson: string;
    exampleCount: number;
    confidence: number;
    chatContextJson?: string | null;
    dataHash: string;
    inferredAt: Date;
  },
): Promise<void> {
  const existing = await prisma.deckStructure.findFirst({
    where: {
      touchType: key.touchType,
      artifactType: key.artifactType,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.deckStructure.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.deckStructure.create({
    data: {
      touchType: key.touchType,
      artifactType: key.artifactType,
      ...data,
    },
  });
}

// ────────────────────────────────────────────────────────────
// Data Hash for Change Detection
// ────────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of sorted example template IDs and their
 * classification data for a given touch type. Used by the cron job
 * to detect when underlying data has changed.
 */
export async function computeDataHash(
  input: DeckStructureKeyInput,
  artifactType: ArtifactType | null = null,
): Promise<string> {
  const key = getDeckStructureKey(input, artifactType);
  const examples = await prisma.template.findMany({
    where: {
      contentClassification: "example",
    },
    select: {
      id: true,
      touchTypes: true,
      contentClassification: true,
      artifactType: true,
    },
    orderBy: { id: "asc" },
  });

  // Filter to templates that have this touchType in their JSON array
  const relevant = examples.filter((t) => {
    try {
      const types = JSON.parse(t.touchTypes) as string[];
      if (!Array.isArray(types) || !types.includes(key.touchType)) {
        return false;
      }

      if (key.touchType !== "touch_4") {
        return true;
      }

      return t.artifactType === key.artifactType;
    } catch {
      return false;
    }
  });

  const hashInput = relevant
    .map(
      (t) =>
        `${t.id}:${t.contentClassification}:${t.touchTypes}:${t.artifactType ?? "null"}`,
    )
    .join("|");

  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

// ────────────────────────────────────────────────────────────
// Prompt Building
// ────────────────────────────────────────────────────────────

interface SlideData {
  slideId: string;
  slideIndex: number;
  contentText: string;
  description: string | null;
  classificationJson: string | null;
  templateName: string;
  templateId: string;
  isPrimary: boolean; // true = example (primary), false = template (secondary)
  elements: Array<{
    elementType: string;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    contentText: string;
  }>;
}

function buildInferencePrompt(
  touchType: string,
  slides: SlideData[],
  chatConstraints?: string,
): string {
  const primarySlides = slides.filter((s) => s.isPrimary);
  const secondarySlides = slides.filter((s) => !s.isPrimary);

  // Group slides by template for context
  const primaryByTemplate = new Map<string, SlideData[]>();
  for (const s of primarySlides) {
    const existing = primaryByTemplate.get(s.templateName) ?? [];
    existing.push(s);
    primaryByTemplate.set(s.templateName, existing);
  }

  const secondaryByTemplate = new Map<string, SlideData[]>();
  for (const s of secondarySlides) {
    const existing = secondaryByTemplate.get(s.templateName) ?? [];
    existing.push(s);
    secondaryByTemplate.set(s.templateName, existing);
  }

  function formatSlide(s: SlideData): string {
    const parts: string[] = [];
    parts.push(`  Slide ID: ${s.slideId}`);
    parts.push(`  Position: Slide ${s.slideIndex + 1} in deck`);
    parts.push(`  Content: ${s.contentText.substring(0, 500)}`);

    if (s.description) {
      try {
        const desc = JSON.parse(s.description);
        if (desc.purpose) parts.push(`  Purpose: ${desc.purpose}`);
        if (desc.keyContent) parts.push(`  Key Content: ${desc.keyContent}`);
        if (desc.useCases) parts.push(`  Use Cases: ${desc.useCases}`);
        if (desc.visualComposition) parts.push(`  Visual Composition: ${desc.visualComposition}`);
      } catch {
        parts.push(`  Description: ${s.description.substring(0, 300)}`);
      }
    }

    if (s.classificationJson) {
      try {
        const cls = JSON.parse(s.classificationJson);
        if (cls.slideCategory) parts.push(`  Category: ${cls.slideCategory}`);
        if (cls.contentType) parts.push(`  Content Type: ${cls.contentType}`);
        if (cls.funnelStages?.length) parts.push(`  Funnel Stages: ${cls.funnelStages.join(", ")}`);
      } catch {
        // skip malformed classification
      }
    }

    if (s.elements.length > 0) {
      const elementSummary = s.elements
        .slice(0, 10) // limit to avoid prompt explosion
        .map(
          (e) =>
            `    ${e.elementType} at (${Math.round(e.positionX)},${Math.round(e.positionY)}) ${Math.round(e.width)}x${Math.round(e.height)}${e.contentText ? `: "${e.contentText.substring(0, 80)}"` : ""}`,
        )
        .join("\n");
      parts.push(`  Element Map (${s.elements.length} elements):\n${elementSummary}`);
    }

    return parts.join("\n");
  }

  let prompt = `You are analyzing sales presentation decks to infer the standard deck structure for "${touchType}" presentations.

Your goal is to identify the common section flow pattern across all provided example decks, determine which sections are always present vs optional, map specific slides to each section, and explain the sequencing rationale.

`;

  // Primary examples (drive the section flow)
  if (primaryByTemplate.size > 0) {
    prompt += `## PRIMARY EXAMPLES (${primaryByTemplate.size} decks — these drive the section flow pattern)\n\n`;
    prompt += `Analyze these complete decks to identify the common section structure. Look for recurring patterns in how slides are organized.\n\n`;

    for (const [templateName, templateSlides] of primaryByTemplate) {
      const sorted = [...templateSlides].sort((a, b) => a.slideIndex - b.slideIndex);
      prompt += `### Example Deck: "${templateName}" (${sorted.length} slides)\n`;
      for (const s of sorted) {
        prompt += formatSlide(s) + "\n\n";
      }
    }
  }

  // Secondary templates (expand variation pool)
  if (secondaryByTemplate.size > 0) {
    prompt += `## SECONDARY TEMPLATES (${secondaryByTemplate.size} decks — expand the slide variation pool)\n\n`;
    prompt += `These are reusable templates. Include their slides as additional variations for relevant sections, but do NOT let them override the section flow established by the examples above.\n\n`;

    for (const [templateName, templateSlides] of secondaryByTemplate) {
      const sorted = [...templateSlides].sort((a, b) => a.slideIndex - b.slideIndex);
      prompt += `### Template: "${templateName}" (${sorted.length} slides)\n`;
      for (const s of sorted) {
        prompt += formatSlide(s) + "\n\n";
      }
    }
  }

  // Chat constraints (user refinements)
  if (chatConstraints) {
    prompt += `## USER REFINEMENT CONSTRAINTS\n\n`;
    prompt += `The following constraints come from previous user feedback. Apply them when generating the structure:\n\n`;
    prompt += chatConstraints + "\n\n";
  }

  prompt += `## INSTRUCTIONS

1. Analyze the example decks as COMPLETE presentations. Identify the common section flow pattern.
2. Name each section clearly (e.g., "Title Slide", "Company Overview", "Case Studies", "Solution Architecture", "Team & Approach", "Pricing & Timeline").
3. Mark sections as optional if they only appear in some examples, required if they appear in all or nearly all.
4. For each section, count distinct slide variations across all examples AND templates.
5. Map specific Slide IDs to each section. Include slides from both examples and templates.
6. Explain the sequencing rationale: WHY are the sections in this order? What narrative flow does it create?
7. Order sections by their natural position in the deck flow (1-based).

Return the deck structure as a JSON object matching the required schema.`;

  return prompt;
}

// ────────────────────────────────────────────────────────────
// Inference Engine
// ────────────────────────────────────────────────────────────

/**
 * Infer the deck structure for a given touch type by analyzing
 * classified examples and templates.
 */
export async function inferDeckStructure(
  input: DeckStructureKeyInput,
  chatConstraints?: string,
): Promise<DeckStructureOutput> {
  const key = getDeckStructureKey(input);

  if (isUnsupportedGenericTouch4(key.touchType, key.artifactType)) {
    return buildEmptyDeckStructureOutput(
      key.touchType,
      GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
    );
  }

  // 1. Query example templates (primary data)
  const allExamples = await prisma.template.findMany({
    where: { contentClassification: "example" },
    select: { id: true, name: true, touchTypes: true, artifactType: true },
  });
  const exampleTemplates = allExamples.filter((t) => {
    try {
      const types = JSON.parse(t.touchTypes) as string[];
      if (!Array.isArray(types) || !types.includes(key.touchType)) {
        return false;
      }

      if (key.touchType !== "touch_4") {
        return true;
      }

      return t.artifactType === key.artifactType;
    } catch {
      return false;
    }
  });

  // 2. Query template templates (secondary data)
  const allTemplates = await prisma.template.findMany({
    where: { contentClassification: "template" },
    select: { id: true, name: true, touchTypes: true, artifactType: true },
  });
  const templateTemplates = allTemplates.filter((t) => {
    try {
      const types = JSON.parse(t.touchTypes) as string[];
      return Array.isArray(types) && types.includes(key.touchType);
    } catch {
      return false;
    }
  });

  const exampleCount = exampleTemplates.length;

  if (key.touchType === "touch_4" && exampleCount === 0) {
    const emptyOutput = buildEmptyDeckStructureOutput(key.touchType);
    const confidence = calculateConfidence(0);
    const dataHash = await computeDataHash(key);

    await upsertDeckStructure(key, {
      structureJson: JSON.stringify(emptyOutput),
      exampleCount: 0,
      confidence: confidence.score,
      chatContextJson: chatConstraints ?? null,
      dataHash,
      inferredAt: new Date(),
    });

    return emptyOutput;
  }

  // 3. Load slides with descriptions and elements for all relevant templates
  const slideData: SlideData[] = [];

  for (const template of exampleTemplates) {
    const slides = await prisma.slideEmbedding.findMany({
      where: { templateId: template.id, archived: false },
      include: { elements: true },
      orderBy: { slideIndex: "asc" },
    });
    for (const slide of slides) {
      slideData.push({
        slideId: slide.id,
        slideIndex: slide.slideIndex,
        contentText: slide.contentText,
        description: slide.description,
        classificationJson: slide.classificationJson,
        templateName: template.name,
        templateId: template.id,
        isPrimary: true,
        elements: slide.elements.map((e) => ({
          elementType: e.elementType,
          positionX: e.positionX,
          positionY: e.positionY,
          width: e.width,
          height: e.height,
          contentText: e.contentText,
        })),
      });
    }
  }

  for (const template of templateTemplates) {
    const slides = await prisma.slideEmbedding.findMany({
      where: { templateId: template.id, archived: false },
      include: { elements: true },
      orderBy: { slideIndex: "asc" },
    });
    for (const slide of slides) {
      slideData.push({
        slideId: slide.id,
        slideIndex: slide.slideIndex,
        contentText: slide.contentText,
        description: slide.description,
        classificationJson: slide.classificationJson,
        templateName: template.name,
        templateId: template.id,
        isPrimary: false,
        elements: slide.elements.map((e) => ({
          elementType: e.elementType,
          positionX: e.positionX,
          positionY: e.positionY,
          width: e.width,
          height: e.height,
          contentText: e.contentText,
        })),
      });
    }
  }

  // 4. If no slides at all, return empty structure
  if (slideData.length === 0) {
    const emptyOutput = buildEmptyDeckStructureOutput(key.touchType);

    const confidence = calculateConfidence(0);
    const dataHash = await computeDataHash(key);

    await upsertDeckStructure(key, {
      structureJson: JSON.stringify(emptyOutput),
      exampleCount: 0,
      confidence: confidence.score,
      dataHash,
      inferredAt: new Date(),
    });

    return emptyOutput;
  }

  // 5. Build prompt and call GenAI
  const prompt = buildInferencePrompt(
    key.touchType,
    slideData,
    chatConstraints ?? undefined,
  );

  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: DECK_STRUCTURE_SCHEMA,
    },
  });

  const text = response.text ?? "{}";
  let output: DeckStructureOutput;

  try {
    output = JSON.parse(text) as DeckStructureOutput;
    // Ensure sections is always an array
    if (!Array.isArray(output.sections)) {
      output.sections = [];
    }
    if (typeof output.sequenceRationale !== "string") {
      output.sequenceRationale = "";
    }
  } catch {
    console.error(
      `[deck-inference] Failed to parse GenAI response for ${key.touchType}${key.artifactType ? `/${key.artifactType}` : ""}:`,
      text.substring(0, 200),
    );
    output = {
      sections: [],
      sequenceRationale: "Failed to parse AI response. Please retry inference.",
    };
  }

  // 6. Calculate confidence and persist
  const confidence = calculateConfidence(exampleCount);
  const dataHash = await computeDataHash(key);

  await upsertDeckStructure(key, {
    structureJson: JSON.stringify(output),
    exampleCount,
    confidence: confidence.score,
    chatContextJson: chatConstraints ?? null,
    dataHash,
    inferredAt: new Date(),
  });

  console.log(
    `[deck-inference] Inferred structure for ${key.touchType}${key.artifactType ? `/${key.artifactType}` : ""}: ${output.sections.length} sections, ${exampleCount} examples, confidence ${confidence.score}% (${confidence.label})`,
  );

  return output;
}
