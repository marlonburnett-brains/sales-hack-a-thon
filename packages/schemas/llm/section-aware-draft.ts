/**
 * ContentSlotDraftSchema -- Content-type-aware Draft Schema
 *
 * Template-aware draft schema that maps LLM output to DeckStructure
 * sections with structured content slots (headlines, bodyParagraphs,
 * metrics, bulletPoints, speakerNotes) per section.
 *
 * Replaces the old SectionDraftLlmSchema which used a single contentText
 * blob per section. Structured slots bridge the gap between draft content
 * and element-level modification.
 *
 * LLM-safe: flat object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const SectionContentSlotSchema = z.object({
  sectionName: z.string().meta({
    description:
      "Name of the template section (maps to DeckSection.name).",
  }),
  sectionPurpose: z.string().meta({
    description: "Why this section exists in the deck.",
  }),
  headlines: z.array(z.string()).meta({
    description:
      "Large/bold text items: titles, section headers, callout phrases.",
  }),
  bodyParagraphs: z.array(z.string()).meta({
    description:
      "Narrative text blocks: case study descriptions, value propositions, company overviews.",
  }),
  metrics: z
    .array(
      z.object({
        value: z.string().meta({
          description:
            "The metric number, e.g. '80%', '$1.5B', '3-5x'.",
        }),
        label: z.string().meta({
          description:
            "What the metric measures, e.g. 'Reduction in QA effort'.",
        }),
      }),
    )
    .meta({
      description: "Quantitative proof points as value+label pairs.",
    }),
  bulletPoints: z.array(z.string()).meta({
    description: "Capability items, feature bullets, list entries.",
  }),
  speakerNotes: z.string().meta({
    description: "Brief talking points for the presenter.",
  }),
});

export const ContentSlotDraftSchema = z.object({
  companyName: z.string().meta({
    description: "Name of the target company.",
  }),
  industry: z.string().meta({
    description: "Primary industry of the target company.",
  }),
  headline: z.string().meta({
    description: "Overall deck headline tailored to the company.",
  }),
  sections: z.array(SectionContentSlotSchema).meta({
    description:
      "One entry per template section with structured content slots.",
  }),
  callToAction: z.string().meta({
    description: "Specific call to action for the next step.",
  }),
  contactName: z.string().meta({
    description:
      "Contact person name if available. Leave empty string if not available.",
  }),
  contactRole: z.string().meta({
    description:
      "Contact person role if available. Leave empty string if not available.",
  }),
});

export type SectionContentSlot = z.infer<typeof SectionContentSlotSchema>;
export type ContentSlotDraft = z.infer<typeof ContentSlotDraftSchema>;
