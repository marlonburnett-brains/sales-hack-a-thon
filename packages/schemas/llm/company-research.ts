/**
 * CompanyResearchLlmSchema — Pre-Call Company Research
 *
 * Structures company research gathered before a sales call.
 * Provides context on the target company's initiatives, news,
 * and financial position to inform the sales conversation.
 *
 * Gemini-safe: flat object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const CompanyResearchLlmSchema = z.object({
  companyName: z.string().meta({
    description: "Name of the target company being researched.",
  }),
  keyInitiatives: z.array(z.string()).meta({
    description:
      "Key strategic initiatives, digital transformation projects, or technology investments the company is pursuing.",
  }),
  recentNews: z.array(z.string()).meta({
    description:
      "Recent news items, press releases, or announcements relevant to a technology services conversation.",
  }),
  financialHighlights: z.array(z.string()).meta({
    description:
      "Relevant financial highlights (revenue, growth, investment areas) that inform deal sizing and urgency.",
  }),
  industryPosition: z.string().meta({
    description:
      "Summary of the company's position in their industry (market share, competitive landscape, key differentiators).",
  }),
  relevantLumenaltaSolutions: z.array(z.string()).meta({
    description:
      "Lumenalta solution pillars and capabilities most relevant to this company based on the research.",
  }),
});

export type CompanyResearch = z.infer<typeof CompanyResearchLlmSchema>;
