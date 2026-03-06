import { describe, it, expect } from "vitest";
import {
  computeContentHash,
  computeMerge,
  type ExistingSlideData,
} from "../smart-merge";
import type { ExtractedSlide } from "../../lib/slide-extractor";

// ---------------------------------------------------------------------------
// Helper: create a minimal ExtractedSlide for testing
// ---------------------------------------------------------------------------

function makeSlide(overrides: Partial<ExtractedSlide> = {}): ExtractedSlide {
  return {
    slideIndex: 0,
    slideObjectId: "obj_1",
    presentationId: "pres_1",
    presentationName: "Test Deck",
    folderPath: "",
    textContent: "Hello world",
    speakerNotes: "Some notes",
    isLowContent: false,
    documentId: "doc_1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SLIDE-08: Content hash identity — computeContentHash
// ---------------------------------------------------------------------------

describe("SLIDE-08: Content hash identity via computeContentHash", () => {
  it("returns a 40-character hex string", () => {
    const hash = computeContentHash("text", "notes", "objId");
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("produces identical hash for identical inputs (deterministic)", () => {
    const a = computeContentHash("same text", "same notes", "same_id");
    const b = computeContentHash("same text", "same notes", "same_id");
    expect(a).toBe(b);
  });

  it("produces different hash when text content changes", () => {
    const a = computeContentHash("text v1", "notes", "obj_1");
    const b = computeContentHash("text v2", "notes", "obj_1");
    expect(a).not.toBe(b);
  });

  it("produces different hash when speaker notes change", () => {
    const a = computeContentHash("text", "notes v1", "obj_1");
    const b = computeContentHash("text", "notes v2", "obj_1");
    expect(a).not.toBe(b);
  });

  it("produces different hash for different slideObjectIds even with same content (prevents empty-slide collisions)", () => {
    const a = computeContentHash("", "", "obj_A");
    const b = computeContentHash("", "", "obj_B");
    expect(a).not.toBe(b);
  });

  it("handles empty strings without throwing", () => {
    const hash = computeContentHash("", "", "");
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });
});

// ---------------------------------------------------------------------------
// SLIDE-06: Smart merge idempotency — computeMerge
// ---------------------------------------------------------------------------

describe("SLIDE-06: Smart merge idempotency via computeMerge", () => {
  it("marks all slides as added when no existing embeddings exist (first ingestion)", () => {
    const slides = [makeSlide({ slideIndex: 0 }), makeSlide({ slideIndex: 1, slideObjectId: "obj_2" })];
    const result = computeMerge(slides, []);

    expect(result.added).toHaveLength(2);
    expect(result.unchanged).toHaveLength(0);
    expect(result.changed).toHaveLength(0);
    expect(result.toArchive).toHaveLength(0);
  });

  it("marks unchanged slides when content hashes match (idempotent re-ingestion)", () => {
    const slide = makeSlide({ slideIndex: 0 });
    const hash = computeContentHash(slide.textContent, slide.speakerNotes, slide.slideObjectId);

    const existing: ExistingSlideData[] = [
      { id: "emb_1", contentHash: hash, slideIndex: 0, confidence: 80, classificationJson: "{}" },
    ];

    const result = computeMerge([slide], existing);

    expect(result.unchanged).toHaveLength(1);
    expect(result.unchanged[0].existing.id).toBe("emb_1");
    expect(result.unchanged[0].newIndex).toBe(0);
    expect(result.added).toHaveLength(0);
    expect(result.toArchive).toHaveLength(0);
  });

  it("detects reordered slides as unchanged with updated index", () => {
    const slideA = makeSlide({ slideIndex: 1, slideObjectId: "obj_A", textContent: "Slide A" });
    const slideB = makeSlide({ slideIndex: 0, slideObjectId: "obj_B", textContent: "Slide B" });

    const hashA = computeContentHash("Slide A", slideA.speakerNotes, "obj_A");
    const hashB = computeContentHash("Slide B", slideB.speakerNotes, "obj_B");

    const existing: ExistingSlideData[] = [
      { id: "emb_A", contentHash: hashA, slideIndex: 0, confidence: 90, classificationJson: "{}" },
      { id: "emb_B", contentHash: hashB, slideIndex: 1, confidence: 85, classificationJson: "{}" },
    ];

    const result = computeMerge([slideA, slideB], existing);

    expect(result.unchanged).toHaveLength(2);
    // Slide A moved from index 0 to 1
    const unchangedA = result.unchanged.find((u) => u.existing.id === "emb_A");
    expect(unchangedA?.newIndex).toBe(1);
    // Slide B moved from index 1 to 0
    const unchangedB = result.unchanged.find((u) => u.existing.id === "emb_B");
    expect(unchangedB?.newIndex).toBe(0);

    expect(result.added).toHaveLength(0);
    expect(result.toArchive).toHaveLength(0);
  });

  it("marks removed slides for archival when they no longer exist in new set", () => {
    const slide = makeSlide({ slideIndex: 0 });
    const hash = computeContentHash(slide.textContent, slide.speakerNotes, slide.slideObjectId);

    const existing: ExistingSlideData[] = [
      { id: "emb_1", contentHash: hash, slideIndex: 0, confidence: 80, classificationJson: "{}" },
      { id: "emb_2", contentHash: "orphaned_hash", slideIndex: 1, confidence: 70, classificationJson: "{}" },
    ];

    const result = computeMerge([slide], existing);

    expect(result.unchanged).toHaveLength(1);
    expect(result.toArchive).toHaveLength(1);
    expect(result.toArchive[0].id).toBe("emb_2");
  });

  it("identifies new slides as added when their hash does not match any existing", () => {
    const existingSlide = makeSlide({ slideIndex: 0 });
    const existingHash = computeContentHash(existingSlide.textContent, existingSlide.speakerNotes, existingSlide.slideObjectId);

    const newSlide = makeSlide({ slideIndex: 1, slideObjectId: "obj_new", textContent: "Brand new content" });

    const existing: ExistingSlideData[] = [
      { id: "emb_1", contentHash: existingHash, slideIndex: 0, confidence: 80, classificationJson: "{}" },
    ];

    const result = computeMerge([existingSlide, newSlide], existing);

    expect(result.unchanged).toHaveLength(1);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].textContent).toBe("Brand new content");
    expect(result.toArchive).toHaveLength(0);
  });

  it("handles empty input arrays gracefully", () => {
    const result = computeMerge([], []);
    expect(result.unchanged).toHaveLength(0);
    expect(result.changed).toHaveLength(0);
    expect(result.added).toHaveLength(0);
    expect(result.toArchive).toHaveLength(0);
  });

  it("archives all existing when new slides list is empty (all slides removed)", () => {
    const existing: ExistingSlideData[] = [
      { id: "emb_1", contentHash: "hash1", slideIndex: 0, confidence: 80, classificationJson: "{}" },
      { id: "emb_2", contentHash: "hash2", slideIndex: 1, confidence: 70, classificationJson: "{}" },
    ];

    const result = computeMerge([], existing);

    expect(result.toArchive).toHaveLength(2);
    expect(result.unchanged).toHaveLength(0);
    expect(result.added).toHaveLength(0);
  });

  it("treats existing slides with null contentHash as unmatched (archives them)", () => {
    const slide = makeSlide({ slideIndex: 0 });

    const existing: ExistingSlideData[] = [
      { id: "emb_legacy", contentHash: null, slideIndex: 0, confidence: 50, classificationJson: null },
    ];

    const result = computeMerge([slide], existing);

    // The new slide has no matching hash in existing, so it is added
    expect(result.added).toHaveLength(1);
    // The existing slide with null hash cannot be matched, so it is archived
    expect(result.toArchive).toHaveLength(1);
    expect(result.toArchive[0].id).toBe("emb_legacy");
  });
});
