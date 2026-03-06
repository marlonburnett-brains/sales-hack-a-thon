/**
 * CapabilityDeckSelectionLlmSchema — Touch 3 Capability Deck Slide Selection
 *
 * Selects and orders slides for a detailed capability alignment deck.
 * Includes capability area filtering to narrow the content library
 * search scope before slide selection.
 *
 * LLM-safe: flat object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const CapabilityDeckSelectionLlmSchema = z.object({
  capabilityAreas: z.array(z.string()).meta({
    description:
      "Lumenalta capability areas to focus on for this deck (used to filter content library).",
  }),
  selectedSlideIds: z.array(z.string()).meta({
    description:
      "AtlusAI content block IDs of slides selected for the capability deck.",
  }),
  slideOrder: z.array(z.string()).meta({
    description:
      "Ordered list of AtlusAI content block IDs defining the deck sequence.",
  }),
  personalizationNotes: z.string().meta({
    description:
      "Notes on how to customize the selected slides for this company's specific capability needs.",
  }),
});

export type CapabilityDeckSelection = z.infer<
  typeof CapabilityDeckSelectionLlmSchema
>;
