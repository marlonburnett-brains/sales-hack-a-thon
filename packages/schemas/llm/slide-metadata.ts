/**
 * SlideMetadataSchema — Consolidated from Phase 2
 *
 * Structured metadata tags for classified slides in the AtlusAI
 * content library. Originally defined in classify-metadata.ts,
 * now the single source of truth in @lumenalta/schemas.
 *
 * Schema shape is IDENTICAL to the Phase 2 original:
 * same field names, same enum arrays, same required fields.
 *
 * Gemini-safe: flat object with enum arrays, no transforms, no optionals.
 */

import { z } from "zod";
import {
  INDUSTRIES,
  FUNNEL_STAGES,
  CONTENT_TYPES,
  SLIDE_CATEGORIES,
  BUYER_PERSONAS,
  TOUCH_TYPES,
} from "../constants";

export const SlideMetadataSchema = z.object({
  industries: z.array(z.enum(INDUSTRIES)),
  subsectors: z.array(z.string()),
  solutionPillars: z.array(z.string()),
  funnelStages: z.array(z.enum(FUNNEL_STAGES)),
  contentType: z.enum(CONTENT_TYPES),
  slideCategory: z.enum(SLIDE_CATEGORIES),
  buyerPersonas: z.array(z.enum(BUYER_PERSONAS)),
  touchType: z.array(z.enum(TOUCH_TYPES)),
});

export type SlideMetadata = z.infer<typeof SlideMetadataSchema>;
