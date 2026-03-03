/**
 * Bulk Ingestion Pipeline
 *
 * Full pipeline: discover -> extract -> classify -> manifest -> ingest
 * for ALL Lumenalta deck templates, example proposals, and case studies.
 *
 * Run with:
 *   npx tsx --env-file=.env src/ingestion/run-ingestion.ts              # Full pipeline
 *   npx tsx --env-file=.env src/ingestion/run-ingestion.ts --manifest-only  # Phases A-C only
 *   npx tsx --env-file=.env src/ingestion/run-ingestion.ts --ingest-only    # Phase D only
 *
 * Phases:
 *   A - Discovery and extraction (Drive folder traversal + Slides API)
 *   B - Classification (Gemini metadata tagging)
 *   C - Manifest generation (content-manifest.json + coverage-report.json)
 *   D - Bulk ingestion (Google Drive Docs creation for AtlusAI indexing)
 *   E - Verification queries (semantic search validation)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../env";
import { discoverPresentations, type DrivePresentation } from "./discover-content";
import { extractAllSlides } from "./extract-slides";
import { classifyAllSlides, type ClassifiedSlide, type SlideMetadata, INDUSTRIES } from "./classify-metadata";
import { ingestDocument, type SlideDocument } from "../lib/atlusai-client";
import type { ExtractedSlide } from "../lib/slide-extractor";

// ────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────

const MANIFEST_DIR = join(import.meta.dirname ?? __dirname, "manifest");
const CONTENT_MANIFEST_PATH = join(MANIFEST_DIR, "content-manifest.json");
const COVERAGE_REPORT_PATH = join(MANIFEST_DIR, "coverage-report.json");
const SOLUTION_PILLARS_PATH = join(MANIFEST_DIR, "solution-pillars.json");

/** Batch size for Drive API ingestion calls */
const INGESTION_BATCH_SIZE = 10;
/** Pause between ingestion batches (ms) */
const INGESTION_BATCH_DELAY = 500;

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface ManifestEntry {
  documentId: string;
  presentationId: string;
  presentationName: string;
  folderPath: string;
  slideObjectId: string;
  slideIndex: number;
  textPreview: string;
  speakerNotesPreview: string;
  isLowContent: boolean;
  metadata: SlideMetadata;
  status: "pending" | "ingested" | "error";
}

interface CoverageReport {
  generatedAt: string;
  totalPresentations: number;
  totalSlides: number;
  lowContentSlides: number;
  byIndustry: Record<string, {
    templates: number;
    examples: number;
    caseStudies: number;
    totalSlides: number;
  }>;
  byFunnelStage: Record<string, number>;
  byContentType: Record<string, number>;
  gaps: string[];
}

// ────────────────────────────────────────────────────────────
// CLI flag parsing
// ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const manifestOnly = args.includes("--manifest-only");
const ingestOnly = args.includes("--ingest-only");

if (manifestOnly && ingestOnly) {
  console.error("ERROR: Cannot use --manifest-only and --ingest-only together.");
  process.exit(1);
}

// ────────────────────────────────────────────────────────────
// Content type overrides based on CONTEXT.md known presentations
// ────────────────────────────────────────────────────────────

interface ContentTypeOverride {
  pattern: string;
  contentType: SlideMetadata["contentType"];
  touchType: SlideMetadata["touchType"];
}

const CONTENT_TYPE_OVERRIDES: ContentTypeOverride[] = [
  // Touch 1: Two Pager Template
  { pattern: "two pager", contentType: "template", touchType: ["touch_1"] },
  // Touch 2: Meet Lumenalta
  { pattern: "meet lumenalta", contentType: "template", touchType: ["touch_2"] },
  // Touch 2 examples: NBCUniversal, Bleecker Street Group
  { pattern: "nbcuniversal", contentType: "example", touchType: ["touch_2"] },
  { pattern: "bleecker street", contentType: "example", touchType: ["touch_2"] },
  // Touch 3: Master Solutions, GTM Solutions, 200A Master Deck
  { pattern: "master solutions", contentType: "template", touchType: ["touch_3"] },
  { pattern: "2026 gtm solutions", contentType: "template", touchType: ["touch_3"] },
  { pattern: "200a master deck", contentType: "template", touchType: ["touch_3"] },
  // Touch 4 examples: Alaska Airlines, MasterControl, Encompass, WSA, Satellite Industries, Gravie
  { pattern: "alaska airlines", contentType: "example", touchType: ["touch_4"] },
  { pattern: "mastercontrol", contentType: "example", touchType: ["touch_4"] },
  { pattern: "encompass", contentType: "example", touchType: ["touch_4"] },
  { pattern: "wsa", contentType: "example", touchType: ["touch_4"] },
  { pattern: "satellite industries", contentType: "example", touchType: ["touch_4"] },
  { pattern: "gravie", contentType: "example", touchType: ["touch_4"] },
];

/**
 * Apply content_type and touchType overrides based on known presentation names.
 * Also applies case study override based on folder name or presentation name.
 */
function applyContentTypeOverrides(slides: ClassifiedSlide[]): ClassifiedSlide[] {
  return slides.map((slide) => {
    const nameLower = slide.presentationName.toLowerCase();
    const folderLower = (slide.folderPath || "").toLowerCase();

    // Check for case study override first (folder or name contains "case stud")
    if (folderLower.includes("case stud") || nameLower.includes("case stud")) {
      return {
        ...slide,
        metadata: {
          ...slide.metadata,
          contentType: "case_study" as const,
        },
      };
    }

    // Check known presentation name patterns
    for (const override of CONTENT_TYPE_OVERRIDES) {
      if (nameLower.includes(override.pattern)) {
        return {
          ...slide,
          metadata: {
            ...slide.metadata,
            contentType: override.contentType,
            touchType: override.touchType,
          },
        };
      }
    }

    // No override -- keep Gemini classification as-is
    return slide;
  });
}

// ────────────────────────────────────────────────────────────
// Phase A: Discovery and extraction
// ────────────────────────────────────────────────────────────

async function phaseA(): Promise<{
  presentations: DrivePresentation[];
  slides: ExtractedSlide[];
}> {
  console.log("\n========================================");
  console.log("Phase A: Discovery and Extraction");
  console.log("========================================\n");

  // Read solution pillars (generated by pilot in 02-01)
  let solutionPillars: string[] = [];
  try {
    const raw = await readFile(SOLUTION_PILLARS_PATH, "utf-8");
    solutionPillars = JSON.parse(raw);
    console.log(`Loaded ${solutionPillars.length} solution pillars from manifest`);
    if (solutionPillars.length > 0) {
      for (const p of solutionPillars) {
        console.log(`  - ${p}`);
      }
    } else {
      console.log("  (empty -- Gemini classification will use free-text pillars)");
    }
  } catch {
    console.warn("  WARNING: Could not read solution-pillars.json. Using empty list.");
  }

  // Discover all presentations
  console.log(`\nDiscovering presentations in Drive folder: ${env.GOOGLE_DRIVE_FOLDER_ID}`);
  const presentations = await discoverPresentations(env.GOOGLE_DRIVE_FOLDER_ID);
  console.log(`\nFound ${presentations.length} presentations total`);

  // Log by folder distribution
  const folderDistribution = new Map<string, number>();
  for (const p of presentations) {
    const folder = p.folderPath || "(root)";
    folderDistribution.set(folder, (folderDistribution.get(folder) ?? 0) + 1);
  }
  console.log("\nFolder distribution:");
  for (const [folder, count] of folderDistribution) {
    console.log(`  ${folder}: ${count} presentation(s)`);
  }

  // List all presentations
  console.log("\nAll presentations:");
  for (const p of presentations) {
    const shortcutTag = p.isShortcut ? " [shortcut]" : "";
    console.log(`  [${p.folderPath || "(root)"}] ${p.name}${shortcutTag}`);
  }

  if (presentations.length === 0) {
    console.error("ERROR: No presentations found. Check folder ID and service account permissions.");
    process.exit(1);
  }

  // Extract slides from all presentations
  console.log("\nExtracting slides from all presentations...");
  const slides = await extractAllSlides(presentations);

  const lowContent = slides.filter((s) => s.isLowContent).length;
  console.log(`\nExtraction complete:`);
  console.log(`  Total slides: ${slides.length}`);
  console.log(`  Low-content slides: ${lowContent}`);
  console.log(`  Content slides: ${slides.length - lowContent}`);

  return { presentations, slides };
}

// ────────────────────────────────────────────────────────────
// Phase B: Classification
// ────────────────────────────────────────────────────────────

async function phaseB(
  slides: ExtractedSlide[]
): Promise<ClassifiedSlide[]> {
  console.log("\n========================================");
  console.log("Phase B: Metadata Classification");
  console.log("========================================\n");

  const geminiApiKey = env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("ERROR: GEMINI_API_KEY is required for classification.");
    console.error("Set it in apps/agent/.env or get one from https://aistudio.google.com/apikey");
    process.exit(1);
  }

  // Load solution pillars
  let solutionPillars: string[] = [];
  try {
    const raw = await readFile(SOLUTION_PILLARS_PATH, "utf-8");
    solutionPillars = JSON.parse(raw);
  } catch {
    // Already warned in Phase A
  }

  // Classify all slides
  console.log(`Classifying ${slides.length} slides with Gemini...`);
  const classified = await classifyAllSlides(slides, solutionPillars, geminiApiKey);

  // Apply content type overrides
  console.log("\nApplying content type overrides based on known presentation names...");
  const overridden = applyContentTypeOverrides(classified);

  let overrideCount = 0;
  for (let i = 0; i < classified.length; i++) {
    if (
      classified[i].metadata.contentType !== overridden[i].metadata.contentType ||
      JSON.stringify(classified[i].metadata.touchType) !== JSON.stringify(overridden[i].metadata.touchType)
    ) {
      overrideCount++;
    }
  }
  console.log(`  Applied ${overrideCount} content type overrides`);

  return overridden;
}

// ────────────────────────────────────────────────────────────
// Phase C: Manifest generation
// ────────────────────────────────────────────────────────────

async function phaseC(
  presentations: DrivePresentation[],
  classifiedSlides: ClassifiedSlide[]
): Promise<ManifestEntry[]> {
  console.log("\n========================================");
  console.log("Phase C: Manifest Generation");
  console.log("========================================\n");

  await mkdir(MANIFEST_DIR, { recursive: true });

  // Build manifest entries
  const manifest: ManifestEntry[] = classifiedSlides.map((slide) => ({
    documentId: slide.documentId,
    presentationId: slide.presentationId,
    presentationName: slide.presentationName,
    folderPath: slide.folderPath,
    slideObjectId: slide.slideObjectId,
    slideIndex: slide.slideIndex,
    textPreview: slide.textContent.substring(0, 150),
    speakerNotesPreview: slide.speakerNotes.substring(0, 150),
    isLowContent: slide.isLowContent,
    metadata: slide.metadata,
    status: "pending" as const,
  }));

  // Write content manifest
  await writeFile(CONTENT_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Written content-manifest.json: ${manifest.length} entries`);

  // Generate coverage report
  const coverageReport = generateCoverageReport(presentations, classifiedSlides);
  await writeFile(COVERAGE_REPORT_PATH, JSON.stringify(coverageReport, null, 2));
  console.log(`Written coverage-report.json`);

  // Log coverage summary
  logCoverageSummary(coverageReport);

  return manifest;
}

function generateCoverageReport(
  presentations: DrivePresentation[],
  slides: ClassifiedSlide[]
): CoverageReport {
  const lowContentCount = slides.filter((s) => s.isLowContent).length;

  // By industry
  const byIndustry: CoverageReport["byIndustry"] = {};
  for (const industry of INDUSTRIES) {
    byIndustry[industry] = { templates: 0, examples: 0, caseStudies: 0, totalSlides: 0 };
  }

  for (const slide of slides) {
    for (const industry of slide.metadata.industries) {
      if (!byIndustry[industry]) {
        byIndustry[industry] = { templates: 0, examples: 0, caseStudies: 0, totalSlides: 0 };
      }
      byIndustry[industry].totalSlides++;

      switch (slide.metadata.contentType) {
        case "template":
          byIndustry[industry].templates++;
          break;
        case "example":
          byIndustry[industry].examples++;
          break;
        case "case_study":
          byIndustry[industry].caseStudies++;
          break;
      }
    }
  }

  // By funnel stage
  const byFunnelStage: Record<string, number> = {};
  for (const slide of slides) {
    for (const stage of slide.metadata.funnelStages) {
      byFunnelStage[stage] = (byFunnelStage[stage] ?? 0) + 1;
    }
  }

  // By content type
  const byContentType: Record<string, number> = {};
  for (const slide of slides) {
    byContentType[slide.metadata.contentType] =
      (byContentType[slide.metadata.contentType] ?? 0) + 1;
  }

  // Identify gaps
  const gaps: string[] = [];
  for (const industry of INDUSTRIES) {
    const data = byIndustry[industry];
    if (data.templates === 0 && data.caseStudies === 0) {
      gaps.push(`${industry}: No templates or case studies`);
    } else if (data.templates === 0) {
      gaps.push(`${industry}: No templates (has ${data.caseStudies} case studies)`);
    } else if (data.caseStudies === 0) {
      gaps.push(`${industry}: No case studies (has ${data.templates} templates)`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalPresentations: presentations.length,
    totalSlides: slides.length,
    lowContentSlides: lowContentCount,
    byIndustry,
    byFunnelStage,
    byContentType,
    gaps,
  };
}

function logCoverageSummary(report: CoverageReport): void {
  console.log("\n--- Coverage Report Summary ---");
  console.log(`Total presentations: ${report.totalPresentations}`);
  console.log(`Total slides: ${report.totalSlides} (${report.lowContentSlides} low-content)`);

  console.log("\nBy Content Type:");
  for (const [type, count] of Object.entries(report.byContentType)) {
    console.log(`  ${type}: ${count}`);
  }

  console.log("\nBy Funnel Stage:");
  for (const [stage, count] of Object.entries(report.byFunnelStage)) {
    console.log(`  ${stage}: ${count}`);
  }

  console.log("\nBy Industry:");
  for (const [industry, data] of Object.entries(report.byIndustry)) {
    if (data.totalSlides > 0) {
      console.log(
        `  ${industry}: ${data.totalSlides} slides (${data.templates} templates, ${data.examples} examples, ${data.caseStudies} case studies)`
      );
    } else {
      console.log(`  ${industry}: 0 slides`);
    }
  }

  if (report.gaps.length > 0) {
    console.log("\nGaps Identified:");
    for (const gap of report.gaps) {
      console.log(`  WARNING: ${gap}`);
    }
  } else {
    console.log("\nNo gaps -- all 11 industries have templates and case studies.");
  }
}

// ────────────────────────────────────────────────────────────
// Phase D: Bulk ingestion
// ────────────────────────────────────────────────────────────

/**
 * Build a SlideDocument for ingestion. When full classified slides are
 * available (from the in-memory pipeline), use them for full text content.
 * When running --ingest-only from manifest, re-extract from Slides API.
 */
function buildSlideDocFromEntry(
  entry: ManifestEntry,
  fullSlide?: ClassifiedSlide
): SlideDocument {
  return {
    documentId: entry.documentId,
    presentationId: entry.presentationId,
    presentationName: entry.presentationName,
    slideObjectId: entry.slideObjectId,
    slideIndex: entry.slideIndex,
    folderPath: entry.folderPath,
    textContent: fullSlide?.textContent ?? entry.textPreview,
    speakerNotes: fullSlide?.speakerNotes ?? entry.speakerNotesPreview,
    isLowContent: entry.isLowContent,
    metadata: entry.metadata as unknown as Record<string, unknown>,
  };
}

/**
 * Phase D: Ingest all pending slides into AtlusAI via Google Drive Docs creation.
 *
 * @param manifest - The content manifest entries
 * @param classifiedSlides - Optional full classified slides (available in full pipeline mode)
 */
async function phaseD(
  manifest: ManifestEntry[],
  classifiedSlides?: ClassifiedSlide[]
): Promise<ManifestEntry[]> {
  console.log("\n========================================");
  console.log("Phase D: Bulk Ingestion");
  console.log("========================================\n");

  // Build lookup from documentId -> ClassifiedSlide for full text access
  const slidesByDocId = new Map<string, ClassifiedSlide>();
  if (classifiedSlides) {
    for (const slide of classifiedSlides) {
      slidesByDocId.set(slide.documentId, slide);
    }
    console.log(`Full text available for ${slidesByDocId.size} slides (in-memory pipeline)`);
  } else {
    console.log("Running from manifest only -- re-extracting text from Slides API for pending entries...");
    // For --ingest-only, we need to re-extract slides from each unique presentation
    const pendingEntries = manifest.filter((m) => m.status === "pending");
    const uniquePresentationIds = [...new Set(pendingEntries.map((e) => e.presentationId))];

    if (uniquePresentationIds.length > 0) {
      console.log(`  Re-extracting from ${uniquePresentationIds.length} presentation(s)...`);
      const { extractSlidesFromPresentation } = await import("../lib/slide-extractor");

      for (const presId of uniquePresentationIds) {
        const sampleEntry = pendingEntries.find((e) => e.presentationId === presId)!;
        try {
          const extracted = await extractSlidesFromPresentation(
            presId,
            sampleEntry.presentationName,
            sampleEntry.folderPath
          );
          for (const slide of extracted) {
            slidesByDocId.set(slide.documentId, slide as ClassifiedSlide);
          }
          console.log(`  Extracted ${extracted.length} slides from "${sampleEntry.presentationName}"`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`  WARNING: Could not re-extract "${sampleEntry.presentationName}": ${msg}`);
        }
      }
    }
  }

  // Filter to pending entries only
  const pending = manifest.filter((entry) => entry.status === "pending");
  const alreadyIngested = manifest.filter((entry) => entry.status === "ingested");

  console.log(`\nTotal entries: ${manifest.length}`);
  console.log(`Already ingested: ${alreadyIngested.length}`);
  console.log(`Pending: ${pending.length}`);

  if (pending.length === 0) {
    console.log("\nAll entries already ingested. Nothing to do.");
    return manifest;
  }

  let ingestedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process in batches
  const totalBatches = Math.ceil(pending.length / INGESTION_BATCH_SIZE);
  console.log(`\nProcessing ${pending.length} slides in ${totalBatches} batches of ${INGESTION_BATCH_SIZE}...\n`);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchStart = batchIdx * INGESTION_BATCH_SIZE;
    const batchEnd = Math.min(batchStart + INGESTION_BATCH_SIZE, pending.length);
    const batch = pending.slice(batchStart, batchEnd);

    console.log(`--- Batch ${batchIdx + 1}/${totalBatches} (slides ${batchStart + 1}-${batchEnd}) ---`);

    for (const entry of batch) {
      // Find the entry in the full manifest to update status
      const manifestIdx = manifest.findIndex((m) => m.documentId === entry.documentId);
      const fullSlide = slidesByDocId.get(entry.documentId);

      const slideDoc = buildSlideDocFromEntry(entry, fullSlide);

      try {
        const result = await ingestDocument(slideDoc, env.GOOGLE_DRIVE_FOLDER_ID);

        if (result.skipped) {
          skippedCount++;
          if (manifestIdx >= 0) manifest[manifestIdx].status = "ingested";
          console.log(
            `  SKIPPED (exists): Slide ${entry.slideIndex} of "${entry.presentationName}"`
          );
        } else if (result.created) {
          ingestedCount++;
          if (manifestIdx >= 0) manifest[manifestIdx].status = "ingested";
          console.log(
            `  INGESTED: Slide ${entry.slideIndex} of "${entry.presentationName}" -> ${result.docId}`
          );
        }
      } catch (error) {
        errorCount++;
        if (manifestIdx >= 0) manifest[manifestIdx].status = "error";
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `  ERROR: Slide ${entry.slideIndex} of "${entry.presentationName}": ${message}`
        );
      }
    }

    // Pause between batches (not after the last batch)
    if (batchIdx < totalBatches - 1) {
      await new Promise((resolve) => setTimeout(resolve, INGESTION_BATCH_DELAY));
    }
  }

  // Write updated manifest back
  await writeFile(CONTENT_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`\n--- Ingestion Summary ---`);
  console.log(`  New ingestions: ${ingestedCount}`);
  console.log(`  Skipped (already exist): ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total processed: ${ingestedCount + skippedCount + errorCount}`);

  if (errorCount > 0) {
    console.warn(`\nWARNING: ${errorCount} slides failed to ingest. Check errors above.`);
  }

  return manifest;
}

// ────────────────────────────────────────────────────────────
// Phase E: Verification queries
// ────────────────────────────────────────────────────────────

async function phaseE(): Promise<void> {
  console.log("\n========================================");
  console.log("Phase E: Verification");
  console.log("========================================\n");

  console.log("NOTE: Semantic search verification requires AtlusAI to re-index the new documents.");
  console.log("AtlusAI monitors the connected Google Drive folder and auto-indexes new documents.");
  console.log("Full indexing may take some time after bulk ingestion.\n");

  console.log("Verification queries (run via Claude Code MCP tools):");
  console.log('  1. knowledge_base_search_semantic: "healthcare digital transformation"');
  console.log('  2. knowledge_base_search_semantic: "financial services case study"');
  console.log('  3. knowledge_base_search_structured: industry = "Consumer Products"');
  console.log("");
  console.log("These queries should each return at least 1 relevant result from ingested content.");
  console.log("If AtlusAI has not yet re-indexed, wait a few minutes and retry.");

  // Verify manifest exists and has ingested entries
  try {
    const raw = await readFile(CONTENT_MANIFEST_PATH, "utf-8");
    const manifest: ManifestEntry[] = JSON.parse(raw);
    const ingested = manifest.filter((m) => m.status === "ingested");
    const errors = manifest.filter((m) => m.status === "error");
    const pending = manifest.filter((m) => m.status === "pending");

    console.log("\nManifest verification:");
    console.log(`  Total entries: ${manifest.length}`);
    console.log(`  Ingested: ${ingested.length}`);
    console.log(`  Errors: ${errors.length}`);
    console.log(`  Pending: ${pending.length}`);

    if (ingested.length > 0) {
      console.log("\nSample ingested entries:");
      for (const entry of ingested.slice(0, 3)) {
        console.log(
          `  - "${entry.presentationName}" slide ${entry.slideIndex}: ${entry.metadata.contentType} [${entry.metadata.industries.join(", ")}]`
        );
      }
    }
  } catch {
    console.warn("WARNING: Could not read content-manifest.json for verification.");
  }
}

// ────────────────────────────────────────────────────────────
// Main pipeline orchestrator
// ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== Lumenalta Bulk Ingestion Pipeline ===");
  console.log(`Mode: ${manifestOnly ? "manifest-only" : ingestOnly ? "ingest-only" : "full pipeline"}`);
  console.log(`Drive folder: ${env.GOOGLE_DRIVE_FOLDER_ID}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (ingestOnly) {
    // Phase D only -- read existing manifest
    console.log("\nRunning Phase D only (ingest-only mode)...");
    let manifest: ManifestEntry[];
    try {
      const raw = await readFile(CONTENT_MANIFEST_PATH, "utf-8");
      manifest = JSON.parse(raw);
      console.log(`Loaded ${manifest.length} entries from content-manifest.json`);
    } catch (error) {
      console.error("ERROR: Could not read content-manifest.json. Run without --ingest-only first.");
      process.exit(1);
    }

    manifest = await phaseD(manifest, undefined);
    await phaseE();
  } else {
    // Full pipeline (or manifest-only)
    const { presentations, slides } = await phaseA();
    const classified = await phaseB(slides);
    const manifest = await phaseC(presentations, classified);

    if (!manifestOnly) {
      await phaseD(manifest, classified);
      await phaseE();
    } else {
      console.log("\n========================================");
      console.log("Manifest-only mode: Phases A-C complete.");
      console.log("Review content-manifest.json and coverage-report.json.");
      console.log("Then run with --ingest-only to proceed with bulk ingestion.");
      console.log("========================================");
    }
  }

  console.log("\n=== Pipeline Complete ===");
}

main().catch((err) => {
  console.error("Ingestion pipeline failed:", err);
  process.exit(1);
});
