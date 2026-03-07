/**
 * Smart Merge Logic for Slide Re-Ingestion
 *
 * Tracks slide identity by content hash (SHA-256 of text + notes + slideObjectId)
 * rather than position index, enabling correct handling of reordered, changed,
 * added, and removed slides.
 */

import { createHash } from "node:crypto";
import type { ExtractedSlide } from "../lib/slide-extractor";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ExistingSlideData {
  id: string;
  contentHash: string | null;
  slideIndex: number;
  confidence: number | null;
  classificationJson: string | null;
  description: string | null;
  _count?: { elements: number };
}

export interface MergeResult {
  /** Slides with same content hash -- just update slideIndex if changed */
  unchanged: { existing: ExistingSlideData; newIndex: number }[];
  /** Slides in existing but content changed (new slide at same position or different hash) */
  changed: { existing: ExistingSlideData; slide: ExtractedSlide }[];
  /** Entirely new slides not in existing */
  added: ExtractedSlide[];
  /** Existing slides no longer present in new set -- should be archived */
  toArchive: ExistingSlideData[];
  /** Unchanged slides that need description backfill (description is null or no elements) */
  needsDescription: { existing: ExistingSlideData; slide: ExtractedSlide }[];
}

// ────────────────────────────────────────────────────────────
// Content Hash
// ────────────────────────────────────────────────────────────

/**
 * Compute a content hash for a slide.
 * Includes slideObjectId to prevent collisions on empty/low-content slides.
 * Returns first 40 hex characters of SHA-256.
 */
export function computeContentHash(
  textContent: string,
  speakerNotes: string,
  slideObjectId: string
): string {
  return createHash("sha256")
    .update(`${textContent}\n---\n${speakerNotes}\n---\n${slideObjectId}`)
    .digest("hex")
    .substring(0, 40);
}

// ────────────────────────────────────────────────────────────
// Merge Logic
// ────────────────────────────────────────────────────────────

/**
 * Compare new slides from extraction with existing slide embeddings
 * and determine which slides are unchanged, changed, added, or removed.
 */
export function computeMerge(
  newSlides: ExtractedSlide[],
  existingEmbeddings: ExistingSlideData[]
): MergeResult {
  const unchanged: MergeResult["unchanged"] = [];
  const changed: MergeResult["changed"] = [];
  const added: MergeResult["added"] = [];
  const needsDescription: MergeResult["needsDescription"] = [];

  // Build lookup of existing embeddings by content hash
  const existingByHash = new Map<string, ExistingSlideData>();
  for (const existing of existingEmbeddings) {
    if (existing.contentHash) {
      existingByHash.set(existing.contentHash, existing);
    }
  }

  // Build lookup of new slides by content hash for backfill identification
  const newSlideByHash = new Map<string, ExtractedSlide>();
  for (const slide of newSlides) {
    const hash = computeContentHash(
      slide.textContent,
      slide.speakerNotes,
      slide.slideObjectId
    );
    newSlideByHash.set(hash, slide);
  }

  // Track which existing embeddings are matched
  const matchedExistingIds = new Set<string>();

  for (const slide of newSlides) {
    const hash = computeContentHash(
      slide.textContent,
      slide.speakerNotes,
      slide.slideObjectId
    );

    const existing = existingByHash.get(hash);

    if (existing) {
      // Same content hash found -- slide is unchanged (may need index update)
      matchedExistingIds.add(existing.id);
      unchanged.push({ existing, newIndex: slide.slideIndex });

      // Check if this unchanged slide needs description or element backfill
      const missingDescription = !existing.description;
      const missingElements = existing._count?.elements === 0;
      if (missingDescription || missingElements) {
        needsDescription.push({ existing, slide });
      }
    } else {
      // No matching hash -- this is a new slide
      added.push(slide);
    }
  }

  // Any existing embeddings not matched are removed slides
  const toArchive = existingEmbeddings.filter(
    (e) => !matchedExistingIds.has(e.id)
  );

  return { unchanged, changed, added, toArchive, needsDescription };
}
