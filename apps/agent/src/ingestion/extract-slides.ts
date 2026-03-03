/**
 * Batch Slide Extraction Orchestrator
 *
 * Processes an array of DrivePresentation[] and extracts all slides
 * from each presentation sequentially with rate limiting.
 */

import type { DrivePresentation } from "./discover-content";
import {
  extractSlidesFromPresentation,
  type ExtractedSlide,
} from "../lib/slide-extractor";

const RATE_LIMIT_DELAY = 200; // ms between API calls

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract slides from all given presentations.
 *
 * Processes presentations sequentially (one at a time) with a delay
 * between API calls to respect Google Slides API rate limits.
 *
 * @param presentations - Array of DrivePresentation to extract from
 * @returns Flat array of all ExtractedSlide across all presentations
 */
export async function extractAllSlides(
  presentations: DrivePresentation[]
): Promise<ExtractedSlide[]> {
  const allSlides: ExtractedSlide[] = [];

  for (let i = 0; i < presentations.length; i++) {
    const pres = presentations[i];
    console.log(
      `Extracting "${pres.name}" (${i + 1}/${presentations.length})...`
    );

    try {
      const slides = await extractSlidesFromPresentation(
        pres.id,
        pres.name,
        pres.folderPath
      );

      allSlides.push(...slides);

      const lowContent = slides.filter((s) => s.isLowContent).length;
      console.log(
        `  -> ${slides.length} slides extracted (${lowContent} low-content)`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(`  -> ERROR extracting "${pres.name}": ${message}`);
      // Continue with remaining presentations
    }

    // Rate limit between presentations
    if (i < presentations.length - 1) {
      await delay(RATE_LIMIT_DELAY);
    }
  }

  console.log(
    `\nExtraction complete: ${allSlides.length} total slides from ${presentations.length} presentations`
  );
  return allSlides;
}
