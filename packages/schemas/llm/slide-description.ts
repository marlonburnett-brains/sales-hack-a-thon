import { z } from "zod";

export const SlideDescriptionLlmSchema = z.object({
  purpose: z.string().meta({
    description:
      "What this slide is designed to communicate and the role it plays in the presentation.",
  }),
  visualComposition: z.string().meta({
    description:
      "How the slide is laid out, including key visual elements and information hierarchy.",
  }),
  keyContent: z.string().meta({
    description:
      "The main points, data, or messaging conveyed by the slide.",
  }),
  useCases: z.string().meta({
    description:
      "When and how a sales team should use this slide, including audience or meeting fit.",
  }),
});

export type SlideDescription = z.infer<typeof SlideDescriptionLlmSchema>;
