/**
 * ProposalCopyLlmSchema — Per-Slide Copy Generation
 *
 * Defines the structure for per-slide copy generation output from Gemini.
 * Used when rewriting retrieved slide content to connect capabilities
 * to a specific customer's needs and context.
 *
 * Gemini-safe: no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const ProposalCopyLlmSchema = z.object({
  slideTitle: z.string().meta({
    description:
      "Preserved or lightly edited slide title from the source content.",
  }),
  bullets: z.array(z.string()).meta({
    description:
      "Rewritten bullet content connecting capabilities to the customer's specific needs.",
  }),
  speakerNotes: z.string().meta({
    description:
      "Fresh talking points for the presenter tailored to this customer context.",
  }),
});

export type ProposalCopy = z.infer<typeof ProposalCopyLlmSchema>;
