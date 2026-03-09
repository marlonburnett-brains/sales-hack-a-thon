/**
 * SectionDraftLlmSchema -- Section-aware Draft Content
 *
 * Template-aware draft schema that maps LLM output to DeckStructure
 * sections. Each section entry corresponds to a DeckSection from the
 * inferred deck structure, allowing content to be generated per-slot
 * instead of as flat global fields.
 *
 * LLM-safe: flat object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const SectionDraftEntrySchema = z.object({
  sectionName: z.string().meta({
    description:
      "Name of the template section this content is for (maps to DeckSection.name).",
  }),
  sectionPurpose: z.string().meta({
    description:
      "Why this section exists in the deck (maps to DeckSection.purpose).",
  }),
  contentText: z.string().meta({
    description:
      "The LLM-generated content tailored for this section, personalized for the target company.",
  }),
  speakerNotes: z.string().meta({
    description:
      "Brief talking points for the presenter when presenting this section.",
  }),
});

export type SectionDraftEntry = z.infer<typeof SectionDraftEntrySchema>;

export const SectionDraftLlmSchema = z.object({
  companyName: z.string().meta({
    description: "Name of the target company.",
  }),
  industry: z.string().meta({
    description: "Primary industry of the target company.",
  }),
  headline: z.string().meta({
    description:
      "Overall deck headline tailored to the company's situation.",
  }),
  sections: z.array(SectionDraftEntrySchema).meta({
    description:
      "One entry per template section with content tailored to that section's purpose.",
  }),
  callToAction: z.string().meta({
    description:
      "Specific call to action for the next step (e.g., schedule intro call).",
  }),
});

export type SectionDraft = z.infer<typeof SectionDraftLlmSchema>;
