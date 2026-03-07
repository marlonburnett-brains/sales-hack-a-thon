/**
 * Minimal reproduction: test per-slide processing flow
 * Run: npx tsx --env-file=.env src/scripts/test-slide-processing.ts
 */

import { classifySlide } from "../ingestion/classify-metadata";
import { generateEmbedding } from "../ingestion/embed-slide";
import { toSql } from "pgvector";
import type { ExtractedSlide } from "../lib/slide-extractor";

const fakeSlide: ExtractedSlide = {
  documentId: "test-doc-id",
  presentationId: "test-pres-id",
  presentationName: "Test Presentation",
  folderPath: "",
  slideObjectId: "slide_0",
  slideIndex: 0,
  textContent: "Lumenalta helps enterprises transform through AI and cloud solutions. Our team of experts delivers measurable results.",
  speakerNotes: "Talk about our core capabilities",
  isLowContent: false,
};

async function main() {
  console.log("=== Test Per-Slide Processing ===\n");

  // Step 1: Classify
  console.log("Step 1: classifySlide...");
  try {
    const classified = await classifySlide(fakeSlide, "Test Title Slide", []);
    console.log("  SUCCESS: classifySlide returned");
    console.log("  metadata:", JSON.stringify(classified.metadata, null, 2));
    console.log("  confidence:", classified.confidence);
  } catch (err) {
    console.error("  FAILED: classifySlide threw:", err);
    console.error("  Error type:", (err as Error)?.constructor?.name);
    console.error("  Error message:", (err as Error)?.message);
  }

  // Step 2: Embed
  console.log("\nStep 2: generateEmbedding...");
  try {
    const embedding = await generateEmbedding(fakeSlide.textContent + " " + fakeSlide.speakerNotes);
    console.log("  SUCCESS: generateEmbedding returned");
    console.log("  embedding length:", embedding.length);
    console.log("  first 5 values:", embedding.slice(0, 5));

    // Step 3: toSql
    console.log("\nStep 3: toSql...");
    const vec = toSql(embedding);
    console.log("  SUCCESS: toSql returned");
    console.log("  vec type:", typeof vec);
    console.log("  vec preview:", String(vec).substring(0, 80));
  } catch (err) {
    console.error("  FAILED:", err);
    console.error("  Error type:", (err as Error)?.constructor?.name);
    console.error("  Error message:", (err as Error)?.message);
  }

  console.log("\n=== Test Complete ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
