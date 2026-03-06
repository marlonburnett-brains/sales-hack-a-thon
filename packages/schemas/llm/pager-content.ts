/**
 * PagerContentLlmSchema — Touch 1 One-Pager Content
 *
 * Generates content for the first-touch one-pager: a concise,
 * personalized overview of Lumenalta's value proposition for the
 * target company.
 *
 * LLM-safe: flat object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const PagerContentLlmSchema = z.object({
  companyName: z.string().meta({
    description: "Name of the target company.",
  }),
  industry: z.string().meta({
    description: "Primary industry of the target company.",
  }),
  headline: z.string().meta({
    description:
      "Attention-grabbing headline tailored to the company's situation.",
  }),
  valueProposition: z.string().meta({
    description:
      "1-2 sentence value proposition connecting Lumenalta's capabilities to the company's needs.",
  }),
  keyCapabilities: z.array(z.string()).meta({
    description:
      "3-5 key Lumenalta capabilities most relevant to the target company.",
  }),
  callToAction: z.string().meta({
    description:
      "Specific call to action for the next step (e.g., schedule intro call).",
  }),
});

export type PagerContent = z.infer<typeof PagerContentLlmSchema>;
