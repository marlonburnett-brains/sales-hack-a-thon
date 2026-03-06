/**
 * SlideAssemblyLlmSchema — Deck Slide Content Assembly
 *
 * Defines the structure for assembled slide content that will be
 * rendered into Google Slides. Each slide references an AtlusAI
 * content block ID for traceability.
 *
 * Max 2 levels of nesting: object with array of objects.
 * LLM-safe: no transforms, no optionals, no unions.
 */

import { z } from "zod";

export const SlideAssemblyLlmSchema = z.object({
  slides: z
    .array(
      z.object({
        slideTitle: z.string().meta({
          description: "Title text for this slide.",
        }),
        bullets: z.array(z.string()).meta({
          description: "Bullet point content for the slide body.",
        }),
        speakerNotes: z.string().meta({
          description:
            "Speaker notes providing context and talking points for the presenter.",
        }),
        sourceBlockRef: z.string().meta({
          description:
            "AtlusAI content block ID that sourced this slide's content.",
        }),
        sectionType: z.string().meta({
          description:
            "Deck section: title_context, problem_restatement, primary_capability, secondary_capability, case_study, roi_outcomes, next_steps.",
        }),
        sourceType: z.string().meta({
          description:
            "Source origin: retrieved (from AtlusAI) or synthesized (generated from brief data).",
        }),
      })
    )
    .meta({
      description: "Ordered list of slides to assemble into the deck.",
    }),
});

export type SlideAssembly = z.infer<typeof SlideAssemblyLlmSchema>;
