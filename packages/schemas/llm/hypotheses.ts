/**
 * HypothesesLlmSchema — Pre-Call Value Hypotheses
 *
 * Generates value hypotheses tailored to a specific buyer role,
 * connecting evidence from research to Lumenalta solutions. Used
 * to prepare sellers for discovery conversations.
 *
 * LLM-safe: flat/shallow object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const HypothesesLlmSchema = z.object({
  buyerRole: z.string().meta({
    description:
      "The buyer role these hypotheses are tailored for (e.g., CTO, VP Engineering).",
  }),
  hypotheses: z
    .array(
      z.object({
        hypothesis: z.string().meta({
          description:
            "A specific value hypothesis statement connecting a business need to a Lumenalta solution.",
        }),
        evidence: z.string().meta({
          description:
            "Evidence supporting this hypothesis (from company research, industry trends, or deal context).",
        }),
        lumenaltaSolution: z.string().meta({
          description:
            "The specific Lumenalta solution or capability that addresses this hypothesis.",
        }),
      })
    )
    .meta({
      description:
        "Value hypotheses connecting buyer needs to Lumenalta solutions.",
    }),
});

export type Hypotheses = z.infer<typeof HypothesesLlmSchema>;
