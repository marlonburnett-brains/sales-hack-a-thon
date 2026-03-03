/**
 * SalesBriefLlmSchema — Consolidated Sales Brief Generation
 *
 * Combines transcript fields, company research, and deal context into
 * a comprehensive sales brief. Solution pillars are open string[] (not
 * enum-constrained) — downstream validation against AtlusAI-known pillar
 * list happens in later phases.
 *
 * Gemini-safe: flat/shallow object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const SalesBriefLlmSchema = z.object({
  companyName: z.string().meta({
    description: "Name of the target company.",
  }),
  industry: z.string().meta({
    description: "Primary industry of the target company.",
  }),
  subsector: z.string().meta({
    description:
      "Specific subsector within the industry (e.g., Digital Banking, Telehealth).",
  }),
  primaryPillar: z.string().meta({
    description:
      "The primary Lumenalta solution pillar most relevant to this deal.",
  }),
  secondaryPillars: z.array(z.string()).meta({
    description:
      "Additional Lumenalta solution pillars relevant to this deal.",
  }),
  evidence: z.string().meta({
    description:
      "Key evidence supporting the pillar selection (from transcript, research, or context).",
  }),
  customerContext: z.string().meta({
    description:
      "Customer's current situation and pain points synthesized from all sources.",
  }),
  businessOutcomes: z.string().meta({
    description:
      "Desired business outcomes and goals synthesized from all sources.",
  }),
  constraints: z.string().meta({
    description:
      "Technical, budgetary, or organizational constraints identified.",
  }),
  stakeholders: z.string().meta({
    description: "Key stakeholders and decision makers identified.",
  }),
  timeline: z.string().meta({
    description: "Timeline expectations and deadlines identified.",
  }),
  budget: z.string().meta({
    description: "Budget information and financial constraints identified.",
  }),
  useCases: z
    .array(
      z.object({
        name: z.string().meta({
          description: "Name of the use case.",
        }),
        description: z.string().meta({
          description: "Brief description of what the use case entails.",
        }),
        roiOutcome: z.string().meta({
          description:
            "Expected ROI outcome or business impact of this use case.",
        }),
        valueHypothesis: z.string().meta({
          description:
            "Hypothesis for how Lumenalta delivers value for this use case.",
        }),
      })
    )
    .meta({
      description:
        "Identified use cases with ROI outcomes and value hypotheses.",
    }),
});

export type SalesBrief = z.infer<typeof SalesBriefLlmSchema>;
