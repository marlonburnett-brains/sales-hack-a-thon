"use server";

import { revalidatePath } from "next/cache";
import {
  listSlides,
  getSlideThumbnails,
  updateSlideClassification,
  findSimilarSlides,
} from "@/lib/api-client";
import type {
  SlideData,
  SlideElementData,
  SlideThumbnail,
  SimilarSlide,
  CorrectedTags,
} from "@/lib/api-client";

export type { SlideData, SlideElementData, SlideThumbnail, SimilarSlide, CorrectedTags };

export async function listSlidesAction(
  templateId: string
): Promise<SlideData[]> {
  return listSlides(templateId);
}

export async function getSlideThumbnailsAction(
  templateId: string
): Promise<{ thumbnails: SlideThumbnail[]; caching?: boolean }> {
  return getSlideThumbnails(templateId);
}

export async function updateSlideClassificationAction(
  slideId: string,
  templateId: string,
  data: {
    reviewStatus: "approved" | "needs_correction";
    correctedTags?: CorrectedTags;
  }
): Promise<{ success: boolean }> {
  const result = await updateSlideClassification(slideId, data);
  revalidatePath(`/templates/${templateId}/slides`);
  return result;
}

export async function findSimilarSlidesAction(
  slideId: string,
  limit?: number
): Promise<{ results: SimilarSlide[] }> {
  return findSimilarSlides(slideId, limit);
}
