/**
 * Test the actual SQL INSERT that happens during ingestion
 * Run: npx tsx --env-file=.env src/scripts/test-slide-insert.ts
 */

import { toSql } from "pgvector";
import { prisma } from "../lib/db";
import { classifySlide } from "../ingestion/classify-metadata";
import { generateEmbedding } from "../ingestion/embed-slide";
import { computeContentHash } from "../ingestion/smart-merge";
import type { ExtractedSlide } from "../lib/slide-extractor";

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 12);
  return `c${timestamp}${random}`;
}

const fakeSlide: ExtractedSlide = {
  documentId: "test-doc-id",
  presentationId: "test-pres-id",
  presentationName: "Test Presentation",
  folderPath: "",
  slideObjectId: "slide_0",
  slideIndex: 0,
  textContent: "Lumenalta helps enterprises transform through AI and cloud solutions.",
  speakerNotes: "Core capabilities overview",
  isLowContent: false,
};

async function main() {
  console.log("=== Test Per-Slide SQL INSERT ===\n");

  // Use a fake templateId - we need a real one from the DB
  const templates = await prisma.template.findMany({ take: 1 });
  if (templates.length === 0) {
    console.error("No templates in database. Cannot test insert.");
    process.exit(1);
  }
  const templateId = templates[0].id;
  console.log("Using template:", templates[0].name, templateId);

  // Classify
  console.log("\n1. Classifying...");
  const classified = await classifySlide(fakeSlide, "Test", []);
  console.log("  classified.metadata:", JSON.stringify(classified.metadata));
  console.log("  classified.confidence:", classified.confidence);

  // Embed
  console.log("\n2. Embedding...");
  const embeddingText = fakeSlide.textContent + " " + fakeSlide.speakerNotes;
  const embedding = await generateEmbedding(embeddingText);
  console.log("  embedding length:", embedding.length);

  // Content hash
  const contentHash = computeContentHash(
    fakeSlide.textContent,
    fakeSlide.speakerNotes,
    fakeSlide.slideObjectId
  );
  console.log("  contentHash:", contentHash);

  // Classification JSON
  const classJson = JSON.stringify(classified.metadata);
  const confidence = classified.confidence ?? 50;

  // Build values
  const id = generateCuid();
  const vec = toSql(embedding);

  console.log("\n3. Executing raw SQL INSERT...");
  console.log("  id:", id);
  console.log("  templateId:", templateId);
  console.log("  slideIndex:", fakeSlide.slideIndex);
  console.log("  slideObjectId:", fakeSlide.slideObjectId);
  console.log("  industries[0]:", classified.metadata.industries[0] ?? null);
  console.log("  solutionPillars[0]:", classified.metadata.solutionPillars[0] ?? null);
  console.log("  buyerPersonas[0]:", (classified.metadata.buyerPersonas[0] as string) ?? null);
  console.log("  funnelStages[0]:", classified.metadata.funnelStages[0] ?? null);
  console.log("  contentType:", classified.metadata.contentType);
  console.log("  confidence:", confidence);
  console.log("  vec preview:", String(vec).substring(0, 60));

  try {
    await prisma.$executeRaw`
      INSERT INTO "SlideEmbedding" (
        id, "templateId", "slideIndex", "slideObjectId", "contentText",
        "speakerNotes", embedding, industry, "solutionPillar", persona,
        "funnelStage", "contentType", "classificationJson", confidence,
        "contentHash", archived, "needsReReview", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${templateId}, ${fakeSlide.slideIndex}, ${fakeSlide.slideObjectId},
        ${fakeSlide.textContent}, ${fakeSlide.speakerNotes},
        ${vec}::vector,
        ${classified.metadata.industries[0] ?? null},
        ${classified.metadata.solutionPillars[0] ?? null},
        ${(classified.metadata.buyerPersonas[0] as string) ?? null},
        ${classified.metadata.funnelStages[0] ?? null},
        ${classified.metadata.contentType},
        ${classJson}, ${confidence}, ${contentHash},
        false, false, NOW(), NOW()
      )
      ON CONFLICT ("templateId", "contentHash")
      DO UPDATE SET
        "slideIndex" = EXCLUDED."slideIndex",
        "slideObjectId" = EXCLUDED."slideObjectId",
        "contentText" = EXCLUDED."contentText",
        "speakerNotes" = EXCLUDED."speakerNotes",
        embedding = EXCLUDED.embedding,
        industry = EXCLUDED.industry,
        "solutionPillar" = EXCLUDED."solutionPillar",
        persona = EXCLUDED.persona,
        "funnelStage" = EXCLUDED."funnelStage",
        "contentType" = EXCLUDED."contentType",
        "classificationJson" = EXCLUDED."classificationJson",
        confidence = EXCLUDED.confidence,
        archived = false,
        "needsReReview" = false,
        "updatedAt" = NOW()
    `;
    console.log("  SUCCESS: INSERT completed");
  } catch (err) {
    console.error("  FAILED: SQL INSERT threw:");
    console.error("  Error type:", (err as Error)?.constructor?.name);
    console.error("  Error message:", (err as Error)?.message);
    console.error("  Full error:", err);
  }

  // Cleanup: remove test row
  try {
    await prisma.$executeRaw`DELETE FROM "SlideEmbedding" WHERE id = ${id}`;
    console.log("  Cleaned up test row");
  } catch {
    console.log("  (cleanup failed, may need manual cleanup)");
  }

  await prisma.$disconnect();
  console.log("\n=== Test Complete ===");
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await prisma.$disconnect();
  process.exit(1);
});
