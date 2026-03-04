/**
 * AtlusAI Re-Ingestion Pipeline
 *
 * Enables knowledge base growth by ingesting generated/approved/overridden
 * decks back into AtlusAI. This creates a feedback loop where:
 *   - Approved decks become positive examples for future generation
 *   - Overridden decks become learning material for improvement
 *   - Edited decks capture both the original and modified content
 *
 * Flow:
 *   1. Read the generated presentation via Slides API
 *   2. Extract text content from each slide via slide-extractor.ts
 *   3. Create SlideDocument entries with deal context metadata
 *   4. Ingest each slide via atlusai-client.ts (creates Google Docs in Drive)
 *   5. AtlusAI automatically re-indexes the new documents
 *
 * Per locked decision: "Approved (unmodified) AI pagers are ALSO ingested
 * into AtlusAI as positive examples" -- all outcomes feed back.
 */

import { createHash } from "node:crypto";
import { extractSlidesFromPresentation } from "./slide-extractor";
import { ingestDocument } from "./atlusai-client";
import type { SlideDocument } from "./atlusai-client";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface DealContext {
  /** Company name */
  companyName: string;
  /** Industry */
  industry: string;
  /** Touch type that generated this deck */
  touchType: string;
  /** Seller's decision on the generated content */
  decision: "approved" | "overridden" | "edited";
}

export interface IngestionResult {
  /** Number of slides successfully ingested */
  slidesIngested: number;
  /** Errors encountered during ingestion (non-fatal) */
  errors: string[];
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Determine whether a deck with the given decision should be ingested.
 *
 * All outcomes feed back into the knowledge base:
 *   - "approved" -> positive example (AI got it right)
 *   - "edited" -> learning material (AI was close but needed adjustments)
 *   - "overridden" -> learning material (seller replaced AI output entirely)
 *
 * Per locked decision: "Approved (unmodified) AI pagers are ALSO ingested
 * into AtlusAI as positive examples"
 *
 * @param decision - The seller's decision on the generated content
 * @returns true if the deck should be ingested
 */
export function shouldIngest(decision: string): boolean {
  return ["approved", "edited", "overridden"].includes(decision);
}

/**
 * Ingest a generated/uploaded deck back into AtlusAI for knowledge base growth.
 *
 * Extracts text content from each slide in the presentation, enriches it with
 * deal context metadata, and ingests each slide as a separate document into
 * AtlusAI via the Drive-based ingestion strategy.
 *
 * Metadata includes:
 *   - Deal context (companyName, industry, touchType)
 *   - Decision signal ("approved" | "overridden" | "edited")
 *   - generatedBy: "system" for approved/edited, "seller" for overridden
 *   - source: "generated-deck" to distinguish from original library content
 *
 * @param params.presentationId - Google Slides presentation ID to ingest
 * @param params.deckName - Human-readable name for the deck
 * @param params.dealContext - Deal-level metadata for search enrichment
 * @param params.driveFolderId - Drive folder ID where ingestion docs are placed
 * @returns Number of slides ingested and any errors encountered
 */
export async function ingestGeneratedDeck(params: {
  presentationId: string;
  deckName: string;
  dealContext: DealContext;
  driveFolderId: string;
}): Promise<IngestionResult> {
  const { presentationId, deckName, dealContext, driveFolderId } = params;

  // Step 1 & 2: Extract text content from each slide
  // extractSlidesFromPresentation handles the Slides API call and
  // recursively extracts text from shapes, tables, and groups
  const extractedSlides = await extractSlidesFromPresentation(
    presentationId,
    deckName,
    `generated/${dealContext.companyName}` // folderPath for context
  );

  let slidesIngested = 0;
  const errors: string[] = [];

  // Step 3 & 4: Create SlideDocument entries and ingest each
  for (const slide of extractedSlides) {
    // Skip low-content slides (title/divider slides with < 20 chars)
    if (slide.isLowContent) {
      continue;
    }

    // Build deterministic document ID for the generated slide
    // Uses a different namespace prefix to avoid collisions with
    // original library content (which uses presentationId:slideObjectId)
    const generatedDocId = createHash("sha256")
      .update(`generated:${presentationId}:${slide.slideObjectId}`)
      .digest("hex")
      .substring(0, 32);

    const slideDoc: SlideDocument = {
      documentId: generatedDocId,
      presentationId,
      presentationName: deckName,
      slideObjectId: slide.slideObjectId,
      slideIndex: slide.slideIndex,
      folderPath: `generated/${dealContext.companyName}`,
      textContent: slide.textContent,
      speakerNotes: slide.speakerNotes,
      isLowContent: slide.isLowContent,
      metadata: {
        // Deal context for search relevance
        companyName: dealContext.companyName,
        industry: dealContext.industry,
        touchType: dealContext.touchType,
        // Decision signal for AtlusAI to weight examples
        decision: dealContext.decision,
        // Source attribution
        generatedBy:
          dealContext.decision === "overridden" ? "seller" : "system",
        source: "generated-deck",
        // Original slide reference
        originalPresentationId: presentationId,
        originalSlideIndex: slide.slideIndex,
      },
    };

    try {
      const result = await ingestDocument(slideDoc, driveFolderId);
      if (result.created) {
        slidesIngested++;
      }
      // Skipped (already exists) is not an error -- idempotent
    } catch (error) {
      const errorMsg = `Failed to ingest slide ${slide.slideIndex + 1} of ${deckName}: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  return {
    slidesIngested,
    errors,
  };
}
