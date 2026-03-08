import { z } from "zod";

export const SolutionPillarTaxonomyLlmSchema = z.array(
  z.string().meta({
    description:
      "A canonical Lumenalta solution pillar name extracted from taxonomy decks.",
  }),
);

export type SolutionPillarTaxonomy = z.infer<
  typeof SolutionPillarTaxonomyLlmSchema
>;
