/**
 * DiscoveryQuestionsLlmSchema — Pre-Call Discovery Questions
 *
 * Generates prioritized discovery questions for a sales call,
 * each mapped to a Lumenalta solution area. Priority is a string
 * value ("high", "medium", "low") — not an enum — for Gemini safety.
 *
 * Gemini-safe: flat/shallow object, no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const DiscoveryQuestionsLlmSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().meta({
          description:
            "A discovery question to ask during the sales call.",
        }),
        priority: z.string().meta({
          description:
            'Priority level of this question: "high", "medium", or "low".',
        }),
        rationale: z.string().meta({
          description:
            "Why this question is important and what insight it aims to uncover.",
        }),
        mappedSolution: z.string().meta({
          description:
            "The Lumenalta solution area this question maps to.",
        }),
      })
    )
    .meta({
      description:
        "Prioritized discovery questions mapped to Lumenalta solutions.",
    }),
});

export type DiscoveryQuestions = z.infer<typeof DiscoveryQuestionsLlmSchema>;
