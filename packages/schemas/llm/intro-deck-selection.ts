/**
 * IntroDeckSelectionLlmSchema — Touch 2 Intro Deck Slide Selection
 *
 * Selects and orders slides from the AtlusAI content library for
 * a personalized introductory deck. References AtlusAI content
 * block IDs for slide retrieval.
 *
 * LLM-safe: flat object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const IntroDeckSelectionLlmSchema = z.object({
  selectedSlideIds: z.array(z.string()).meta({
    description:
      "AtlusAI content block IDs of slides selected for the intro deck.",
  }),
  slideOrder: z.array(z.string()).meta({
    description:
      "Ordered list of AtlusAI content block IDs defining the deck sequence.",
  }),
  personalizationNotes: z.string().meta({
    description:
      "Notes on how to customize the selected slides for this specific company and audience.",
  }),
});

export type IntroDeckSelection = z.infer<typeof IntroDeckSelectionLlmSchema>;
