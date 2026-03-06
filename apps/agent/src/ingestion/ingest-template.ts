/**
 * Main Ingestion Orchestrator
 *
 * Coordinates the full slide ingestion pipeline:
 * extract -> smart merge -> classify + embed -> store -> cleanup
 *
 * Writes progress to the Template model after each slide so the
 * web app can poll GET /templates/:id/progress for real-time updates.
 */

import { toSql } from "pgvector";
import { prisma } from "../lib/db";
import { extractSlidesFromPresentation } from "../lib/slide-extractor";
import type { GoogleAuthOptions } from "../lib/google-auth";
import { classifySlide } from "./classify-metadata";
import { generateEmbedding } from "./embed-slide";
import {
  computeContentHash,
  computeMerge,
  type ExistingSlideData,
} from "./smart-merge";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface IngestResult {
  processed: number;
  skipped: number;
  archived: number;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateCuid(): string {
  // Simple cuid-like ID generator for raw SQL inserts
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 12);
  return `c${timestamp}${random}`;
}

async function updateProgress(
  templateId: string,
  progress: { phase: string; current: number; total: number; skipped?: number }
): Promise<void> {
  await prisma.template.update({
    where: { id: templateId },
    data: { ingestionProgress: JSON.stringify(progress) },
  });
}

// ────────────────────────────────────────────────────────────
// Main Orchestrator
// ────────────────────────────────────────────────────────────

/**
 * Ingest all slides from a template's Google Slides presentation.
 *
 * Steps:
 * 1. Extract text from all slides via Google Slides API
 * 2. Smart merge: compare with existing embeddings by content hash
 * 3. For new/changed slides: classify via Gemini + embed via Vertex AI
 * 4. Store in SlideEmbedding via raw SQL (pgvector)
 * 5. Archive removed slides
 * 6. Update template metadata
 */
export async function ingestTemplate(
  templateId: string,
  authOptions?: GoogleAuthOptions
): Promise<IngestResult> {
  try {
    // 1. Fetch template
    const template = await prisma.template.findUniqueOrThrow({
      where: { id: templateId },
    });

    // 2. Set ingestion status
    await prisma.template.update({
      where: { id: templateId },
      data: {
        ingestionStatus: "ingesting",
        ingestionProgress: JSON.stringify({
          phase: "extracting",
          current: 0,
          total: 0,
        }),
      },
    });

    // 3. Extract slides from presentation
    console.log(
      `[ingest] Extracting slides from "${template.name}" (${template.presentationId})...`
    );
    const slides = await extractSlidesFromPresentation(
      template.presentationId,
      template.name,
      "",
      authOptions
    );
    console.log(`[ingest] Extracted ${slides.length} slides`);

    // 4. Update progress: extraction complete
    await updateProgress(templateId, {
      phase: "classifying",
      current: 0,
      total: slides.length,
    });

    // 5. Fetch existing embeddings for smart merge
    const existingEmbeddings: ExistingSlideData[] =
      await prisma.slideEmbedding.findMany({
        where: { templateId, archived: false },
        select: {
          id: true,
          contentHash: true,
          slideIndex: true,
          confidence: true,
          classificationJson: true,
        },
      });

    // 6. Compute merge
    const mergeResult = computeMerge(slides, existingEmbeddings);
    console.log(
      `[ingest] Merge result: ${mergeResult.unchanged.length} unchanged, ${mergeResult.added.length} added, ${mergeResult.toArchive.length} to archive`
    );

    let processed = 0;
    let skipped = 0;

    // 7. Update slideIndex for unchanged slides
    for (const { existing, newIndex } of mergeResult.unchanged) {
      if (existing.slideIndex !== newIndex) {
        await prisma.$executeRaw`
          UPDATE "SlideEmbedding"
          SET "slideIndex" = ${newIndex}, "updatedAt" = NOW()
          WHERE id = ${existing.id}
        `;
      }
    }

    // 8. Process added slides (classify + embed + store)
    const titleSlideText = slides[0]?.textContent ?? "";
    const allToProcess = mergeResult.added;

    for (let i = 0; i < allToProcess.length; i++) {
      const slide = allToProcess[i];

      try {
        // Classify
        const classified = await classifySlide(slide, titleSlideText, []);
        const confidence = classified.confidence ?? 50;

        // Embed
        const embeddingText =
          slide.textContent + " " + slide.speakerNotes;
        const embedding = await generateEmbedding(embeddingText);

        // Compute content hash
        const contentHash = computeContentHash(
          slide.textContent,
          slide.speakerNotes,
          slide.slideObjectId
        );

        // Store classification as JSON
        const classJson = JSON.stringify(classified.metadata);

        // Upsert via raw SQL (Prisma cannot handle vector type)
        const id = generateCuid();
        const vec = toSql(embedding);

        await prisma.$executeRaw`
          INSERT INTO "SlideEmbedding" (
            id, "templateId", "slideIndex", "slideObjectId", "contentText",
            "speakerNotes", embedding, industry, "solutionPillar", persona,
            "funnelStage", "contentType", "classificationJson", confidence,
            "contentHash", archived, "needsReReview", "createdAt", "updatedAt"
          ) VALUES (
            ${id}, ${templateId}, ${slide.slideIndex}, ${slide.slideObjectId},
            ${slide.textContent}, ${slide.speakerNotes},
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

        processed++;
      } catch (err) {
        console.error(
          `[ingest] Error processing slide ${slide.slideIndex} of "${template.name}":`,
          err
        );
        skipped++;
      }

      // Update progress after each slide
      await updateProgress(templateId, {
        phase: "classifying",
        current: processed + skipped,
        total: allToProcess.length,
        skipped,
      });

      // Rate limit between API calls
      await delay(300);
    }

    // 9. Handle changed slides (from merge result)
    for (const { existing, slide } of mergeResult.changed) {
      try {
        const classified = await classifySlide(slide, titleSlideText, []);
        const newConfidence = Math.round(
          ((classified.confidence ?? 50) * 0.5)
        );

        const embeddingText =
          slide.textContent + " " + slide.speakerNotes;
        const embedding = await generateEmbedding(embeddingText);

        const contentHash = computeContentHash(
          slide.textContent,
          slide.speakerNotes,
          slide.slideObjectId
        );
        const classJson = JSON.stringify(classified.metadata);
        const vec = toSql(embedding);

        // Update existing row: set needsReReview, store previous classification
        await prisma.$executeRaw`
          UPDATE "SlideEmbedding"
          SET
            "slideIndex" = ${slide.slideIndex},
            "slideObjectId" = ${slide.slideObjectId},
            "contentText" = ${slide.textContent},
            "speakerNotes" = ${slide.speakerNotes},
            embedding = ${vec}::vector,
            industry = ${classified.metadata.industries[0] ?? null},
            "solutionPillar" = ${classified.metadata.solutionPillars[0] ?? null},
            persona = ${(classified.metadata.buyerPersonas[0] as string) ?? null},
            "funnelStage" = ${classified.metadata.funnelStages[0] ?? null},
            "contentType" = ${classified.metadata.contentType},
            "previousClassificationJson" = ${existing.classificationJson},
            "classificationJson" = ${classJson},
            confidence = ${newConfidence},
            "contentHash" = ${contentHash},
            "needsReReview" = true,
            "updatedAt" = NOW()
          WHERE id = ${existing.id}
        `;

        processed++;
      } catch (err) {
        console.error(
          `[ingest] Error re-processing changed slide ${slide.slideIndex}:`,
          err
        );
        skipped++;
      }

      await delay(300);
    }

    // 10. Archive removed slides
    if (mergeResult.toArchive.length > 0) {
      const archiveIds = mergeResult.toArchive.map((e) => e.id);
      await prisma.slideEmbedding.updateMany({
        where: { id: { in: archiveIds } },
        data: { archived: true },
      });
      console.log(
        `[ingest] Archived ${mergeResult.toArchive.length} removed slides`
      );
    }

    // 11. Finalize: clear progress, update template metadata
    const totalActive = mergeResult.unchanged.length + processed;
    await prisma.template.update({
      where: { id: templateId },
      data: {
        ingestionStatus: "idle",
        ingestionProgress: null,
        lastIngestedAt: new Date(),
        slideCount: totalActive,
      },
    });

    console.log(
      `[ingest] Complete: ${processed} processed, ${skipped} skipped, ${mergeResult.toArchive.length} archived`
    );

    return {
      processed,
      skipped,
      archived: mergeResult.toArchive.length,
    };
  } catch (err) {
    // On error: set status to failed, clear progress
    console.error(`[ingest] Fatal error for template ${templateId}:`, err);
    try {
      await prisma.template.update({
        where: { id: templateId },
        data: {
          ingestionStatus: "failed",
          ingestionProgress: null,
        },
      });
    } catch (updateErr) {
      console.error("[ingest] Failed to update template status:", updateErr);
    }
    throw err;
  }
}
