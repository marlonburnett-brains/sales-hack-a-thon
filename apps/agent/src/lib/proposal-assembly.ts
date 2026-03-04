/**
 * Proposal Assembly Business Logic
 *
 * Post-retrieval processing for proposal deck generation:
 *   - filterByMetadata(): Narrows candidates by industry and pillar match
 *   - buildSlideJSON(): Assembles the SlideJSON intermediate representation
 *   - generateSlideCopy(): Per-slide copy generation via Gemini
 *
 * These are pure business logic functions -- NOT Mastra Agents.
 * Called from workflow steps in the Touch 4 proposal workflow.
 */

import { GoogleGenAI } from "@google/genai";
import {
  SlideMetadataSchema,
  zodToGeminiSchema,
  ProposalCopyLlmSchema,
} from "@lumenalta/schemas";
import type {
  SalesBrief,
  ROIFraming,
  SlideAssembly,
  ProposalCopy,
} from "@lumenalta/schemas";
import type { SlideSearchResult } from "./atlusai-search";
import { env } from "../env";

// ────────────────────────────────────────────────────────────
// filterByMetadata
// ────────────────────────────────────────────────────────────

/**
 * Post-retrieval metadata filtering.
 *
 * Parses each candidate's metadata with SlideMetadataSchema and keeps slides
 * that match the brief's industry and pillar. Slides with unparseable metadata
 * are included (don't discard content due to metadata issues).
 *
 * @param candidates - Raw candidate slides from searchForProposal
 * @param industry - Brief's target industry
 * @param pillar - Brief's primary solution pillar
 * @returns Filtered slides matching industry and pillar criteria
 */
export function filterByMetadata(
  candidates: SlideSearchResult[],
  industry: string,
  pillar: string
): SlideSearchResult[] {
  return candidates.filter((slide) => {
    const parsed = SlideMetadataSchema.safeParse(slide.metadata);

    // If metadata doesn't parse, include the slide (don't discard)
    if (!parsed.success) return true;

    const meta = parsed.data;

    // Industry match: includes the brief's industry OR empty (cross-industry)
    const industryMatch =
      meta.industries.length === 0 ||
      meta.industries.some(
        (ind) => ind.toLowerCase() === industry.toLowerCase()
      );

    // Pillar match: solutionPillars includes the pillar (case-insensitive)
    const pillarMatch = meta.solutionPillars.some(
      (p) => p.toLowerCase() === pillar.toLowerCase()
    );

    return industryMatch && pillarMatch;
  });
}

// ────────────────────────────────────────────────────────────
// buildSlideJSON
// ────────────────────────────────────────────────────────────

/**
 * Assemble the SlideJSON intermediate representation.
 *
 * Fixed section template order:
 *   1. title_context (1-2 synthesized)
 *   2. problem_restatement (1 synthesized)
 *   3. primary_capability (retrieved slides matching primary pillar)
 *   4. secondary_capability (retrieved slides matching secondary pillars)
 *   5. case_study (retrieved slides with case_study content type)
 *   6. roi_outcomes (1 synthesized from ROI framing)
 *   7. next_steps (1 synthesized)
 *
 * Dynamic deck length: 2 + 1 + min(3, useCases.length) * 2 + min(2, caseStudies) + 1 + 1
 * Floor 8, ceiling 18.
 *
 * @param params.brief - Approved sales brief
 * @param params.roiFraming - ROI framing data for outcomes slide
 * @param params.selectedSlides - Post-filter candidate slides
 */
export function buildSlideJSON(params: {
  brief: SalesBrief;
  roiFraming: ROIFraming;
  selectedSlides: SlideSearchResult[];
}): SlideAssembly {
  const { brief, roiFraming, selectedSlides } = params;
  const slides: SlideAssembly["slides"] = [];

  // ── Section 1: title_context (synthesized) ──
  slides.push({
    slideTitle: `${brief.companyName} - Solution Proposal`,
    bullets: [
      brief.industry,
      brief.primaryPillar,
      brief.customerContext.substring(0, 200),
    ],
    speakerNotes:
      "Opening context slide. Restate the customer's situation before presenting solutions.",
    sourceBlockRef: "",
    sectionType: "title_context",
    sourceType: "synthesized",
  });

  // ── Section 2: problem_restatement (synthesized) ──
  slides.push({
    slideTitle: "Understanding Your Challenges",
    bullets: [brief.businessOutcomes, brief.constraints],
    speakerNotes: brief.customerContext,
    sourceBlockRef: "",
    sectionType: "problem_restatement",
    sourceType: "synthesized",
  });

  // ── Categorize retrieved slides ──
  const primarySlides: SlideSearchResult[] = [];
  const secondarySlides: SlideSearchResult[] = [];
  const caseStudySlides: SlideSearchResult[] = [];

  for (const slide of selectedSlides) {
    const parsed = SlideMetadataSchema.safeParse(slide.metadata);
    const contentType = parsed.success ? parsed.data.contentType : undefined;
    const pillars = parsed.success
      ? parsed.data.solutionPillars.map((p) => p.toLowerCase())
      : [];

    if (contentType === "case_study") {
      caseStudySlides.push(slide);
    } else if (pillars.includes(brief.primaryPillar.toLowerCase())) {
      primarySlides.push(slide);
    } else {
      secondarySlides.push(slide);
    }
  }

  // ── Compute dynamic deck budget ──
  const capabilityBudget = Math.min(3, brief.useCases.length) * 2;
  const caseStudyBudget = Math.min(2, caseStudySlides.length);
  const rawTotal = 2 + 1 + capabilityBudget + caseStudyBudget + 1 + 1;
  const targetDeckSize = Math.max(8, Math.min(18, rawTotal));

  // Distribute retrieved slides to fit budget
  const primaryBudget = Math.min(primarySlides.length, capabilityBudget);
  const secondaryBudget = Math.min(
    secondarySlides.length,
    targetDeckSize - 2 - 1 - primaryBudget - caseStudyBudget - 1 - 1
  );

  // ── Section 3: primary_capability (retrieved) ──
  for (const slide of primarySlides.slice(0, primaryBudget)) {
    slides.push(toAssemblySlide(slide, "primary_capability"));
  }

  // ── Section 4: secondary_capability (retrieved) ──
  for (const slide of secondarySlides.slice(
    0,
    Math.max(0, secondaryBudget)
  )) {
    slides.push(toAssemblySlide(slide, "secondary_capability"));
  }

  // ── Section 5: case_study (retrieved) ──
  for (const slide of caseStudySlides.slice(0, caseStudyBudget)) {
    slides.push(toAssemblySlide(slide, "case_study"));
  }

  // ── Section 6: roi_outcomes (synthesized) ──
  const roiBullets = roiFraming.useCases.flatMap((uc) => uc.roiOutcomes);
  const valueHypotheses = roiFraming.useCases
    .map((uc) => uc.valueHypothesis)
    .join(" ");

  slides.push({
    slideTitle: "Expected Business Impact",
    bullets: roiBullets.length > 0 ? roiBullets : ["ROI analysis pending"],
    speakerNotes: `Value summary: ${valueHypotheses}`,
    sourceBlockRef: "",
    sectionType: "roi_outcomes",
    sourceType: "synthesized",
  });

  // ── Section 7: next_steps (synthesized) ──
  slides.push({
    slideTitle: "Recommended Next Steps",
    bullets: [
      "Discovery deep-dive on priority use cases",
      "Technical architecture workshop",
      "Preliminary timeline and resource planning",
    ],
    speakerNotes: "Close with clear next actions.",
    sourceBlockRef: "",
    sectionType: "next_steps",
    sourceType: "synthesized",
  });

  return { slides };
}

/**
 * Convert a retrieved SlideSearchResult to a SlideAssembly slide entry.
 *
 * Returns an extended type that includes presentationId and slideObjectId
 * for source presentation lookup in deck-assembly. These extra fields are
 * NOT part of the SlideAssembly Zod type but survive JSON serialization
 * through the workflow pipeline (JSON.stringify/JSON.parse with `as` casts).
 */
function toAssemblySlide(
  slide: SlideSearchResult,
  sectionType: string
): SlideAssembly["slides"][number] & {
  presentationId?: string;
  slideObjectId?: string;
} {
  // Split textContent by newline for bullets; filter empty lines
  const bullets = slide.textContent
    ? slide.textContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : ["Content from AtlusAI library"];

  return {
    slideTitle: slide.documentTitle,
    bullets,
    speakerNotes: slide.speakerNotes || "Retrieved slide content.",
    sourceBlockRef: slide.slideId,
    sectionType,
    sourceType: "retrieved",
    presentationId: slide.presentationId,
    slideObjectId: slide.slideObjectId,
  };
}

// ────────────────────────────────────────────────────────────
// generateSlideCopy
// ────────────────────────────────────────────────────────────

/**
 * Per-slide copy generation via Gemini 2.5 Flash.
 *
 * Rewrites retrieved slide content to connect capabilities to the customer's
 * specific needs. Uses brand voice guidelines and explicit grounding constraints.
 *
 * Skips copy rewriting for slides with fewer than 20 words of source text
 * (returns original text as-is for minimal content slides).
 *
 * @param params.slide - Source slide content to rewrite
 * @param params.brief - Approved sales brief for customer context
 * @param params.brandGuidelines - Brand voice guidelines (or default)
 */
export async function generateSlideCopy(params: {
  slide: {
    slideTitle: string;
    textContent: string;
    speakerNotes: string;
    sourceBlockRef: string;
  };
  brief: SalesBrief;
  brandGuidelines: string;
}): Promise<ProposalCopy> {
  const { slide, brief, brandGuidelines } = params;

  // Skip rewriting for minimal content slides (< 20 words)
  const wordCount = slide.textContent.split(/\s+/).filter(Boolean).length;
  if (wordCount < 20) {
    return {
      slideTitle: slide.slideTitle,
      bullets: slide.textContent
        ? slide.textContent
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : [],
      speakerNotes: slide.speakerNotes || "",
    };
  }

  const ai = new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION });

  const brandVoice =
    brandGuidelines ||
    "Lumenalta brand voice: Professional, outcome-focused, concise. Avoid jargon. Lead with business outcomes. Use active voice. Be specific with metrics and results.";

  const truncatedContent = slide.textContent.substring(0, 500);

  const prompt = [
    "You are a copywriter at Lumenalta generating slide content for a custom solution proposal.",
    "",
    `Brand voice: ${brandVoice}`,
    "",
    "Source slide content:",
    truncatedContent,
    "",
    "Customer context:",
    `Company: ${brief.companyName}`,
    `Industry: ${brief.industry}`,
    `Situation: ${brief.customerContext}`,
    `Desired outcomes: ${brief.businessOutcomes}`,
    "",
    "CONSTRAINT: ONLY use information from the provided source content and brief. Do NOT introduce new capabilities, statistics, or claims not present in either source.",
    "",
    "Instructions:",
    "1. Preserve the slide title (lightly edit only if needed for customer context).",
    "2. Rewrite bullet text to connect the source capabilities to this customer's specific needs.",
    "3. Generate fresh speaker notes with talking points.",
  ].join("\n");

  const responseSchema = zodToGeminiSchema(ProposalCopyLlmSchema);

  const response = await ai.models.generateContent({
    model: "openai/gpt-oss-120b-maas",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: responseSchema,
    },
  });

  const text = response.text ?? "{}";
  return ProposalCopyLlmSchema.parse(JSON.parse(text));
}
