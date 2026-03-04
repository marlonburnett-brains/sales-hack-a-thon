/**
 * Pilot Ingestion Script
 *
 * End-to-end pipeline: discover -> extract -> classify -> ingest for 2-3 pilot decks.
 *
 * Run with: npx tsx --env-file=.env src/ingestion/pilot-ingestion.ts
 *
 * Steps:
 * 1. Discover all presentations in the Drive folder
 * 2. Extract solution pillar taxonomy from Master Solutions + GTM Solutions decks
 * 3. Select 2-3 pilot decks
 * 4. Extract all slides from pilot decks
 * 5. Classify metadata using Gemini
 * 6. Write pilot manifest to manifest/pilot-manifest.json
 * 7. Ingest into AtlusAI (via Google Drive folder-based approach)
 * 8. Verify ingestion via semantic search
 * 9. Log summary
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../env";
import { discoverPresentations, type DrivePresentation } from "./discover-content";
import { extractAllSlides } from "./extract-slides";
import { extractSlidesFromPresentation } from "../lib/slide-extractor";
import { classifyAllSlides, type ClassifiedSlide } from "./classify-metadata";
import { ingestDocument, type SlideDocument } from "../lib/atlusai-client";

// ────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────

const MANIFEST_DIR = join(import.meta.dirname ?? __dirname, "manifest");

/** Deck name patterns for identifying pilot decks and taxonomy sources */
const TAXONOMY_DECK_PATTERNS = [
  "master solutions",
  "gtm solutions",
  "2026 gtm",
];

const PILOT_DECK_PATTERNS = [
  "meet lumenalta",
  "meet lumenalta - 2026",
];

// ────────────────────────────────────────────────────────────
// Helper: Extract solution pillar taxonomy
// ────────────────────────────────────────────────────────────

async function extractSolutionPillars(
  taxonomyDecks: DrivePresentation[],
  _geminiApiKey?: string
): Promise<string[]> {
  console.log("\n=== Step 2: Extracting Solution Pillar Taxonomy ===");

  if (taxonomyDecks.length === 0) {
    console.warn("  No taxonomy decks found. Using empty pillar list.");
    return [];
  }

  // Extract all slides from taxonomy decks
  const allTaxonomySlides = await extractAllSlides(taxonomyDecks);
  console.log(`  Extracted ${allTaxonomySlides.length} slides from ${taxonomyDecks.length} taxonomy decks`);

  // Combine all text content for Gemini analysis
  const combinedText = allTaxonomySlides
    .map(
      (s) =>
        `[Slide ${s.slideIndex} from ${s.presentationName}]\n${s.textContent}\n${s.speakerNotes}`
    )
    .join("\n\n---\n\n");

  const ai = new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION });

  const response = await ai.models.generateContent({
    model: "openai/gpt-oss-120b-maas",
    contents: `You are analyzing Lumenalta's Master Solutions and GTM Solutions decks to extract the complete list of solution pillar names.

A "solution pillar" is a major capability area or service offering that Lumenalta provides to clients. Examples might include "Digital Transformation", "Data Engineering", "Cloud Migration", etc.

Here is the combined text from all slides in the taxonomy decks:

${combinedText.substring(0, 30000)}

INSTRUCTIONS:
1. Identify ALL unique solution pillar names mentioned across these slides.
2. Use the exact naming convention from the decks (preserve capitalization).
3. Deduplicate similar names (e.g., "Data & Analytics" and "Data and Analytics" should be one entry).
4. Return ONLY the pillar names, no descriptions.
5. Order alphabetically.

Return a JSON array of pillar name strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  const text = response.text ?? "[]";
  let pillars: string[];

  try {
    pillars = JSON.parse(text);
    if (!Array.isArray(pillars)) {
      pillars = [];
    }
  } catch {
    console.warn("  Failed to parse pillar list from Gemini. Using empty list.");
    pillars = [];
  }

  console.log(`  Found ${pillars.length} solution pillars:`);
  for (const pillar of pillars) {
    console.log(`    - ${pillar}`);
  }

  return pillars;
}

// ────────────────────────────────────────────────────────────
// Helper: Find decks matching name patterns
// ────────────────────────────────────────────────────────────

function findDecksByPattern(
  presentations: DrivePresentation[],
  patterns: string[]
): DrivePresentation[] {
  return presentations.filter((p) =>
    patterns.some((pattern) =>
      p.name.toLowerCase().includes(pattern.toLowerCase())
    )
  );
}

/**
 * Select pilot decks: the Meet Lumenalta deck + 1-2 additional decks
 * (one example proposal + one case study if discoverable)
 */
function selectPilotDecks(
  presentations: DrivePresentation[],
  taxonomyDeckIds: Set<string>
): DrivePresentation[] {
  const pilots: DrivePresentation[] = [];

  // 1. Find "Meet Lumenalta" deck (Touch 2 template)
  const meetLumenalta = presentations.find(
    (p) =>
      p.name.toLowerCase().includes("meet lumenalta") &&
      !taxonomyDeckIds.has(p.id)
  );
  if (meetLumenalta) {
    pilots.push(meetLumenalta);
    console.log(`  Pilot 1 (Touch 2 template): "${meetLumenalta.name}"`);
  }

  // 2. Find an example proposal
  const proposalPatterns = [
    "alaska",
    "mastercontrol",
    "encompass",
    "wsa",
    "satellite",
    "gravie",
    "proposal",
  ];
  const proposal = presentations.find(
    (p) =>
      proposalPatterns.some((pat) => p.name.toLowerCase().includes(pat)) &&
      !taxonomyDeckIds.has(p.id) &&
      !pilots.some((pilot) => pilot.id === p.id)
  );
  if (proposal) {
    pilots.push(proposal);
    console.log(`  Pilot 2 (example proposal): "${proposal.name}"`);
  }

  // 3. Find a case study deck
  const caseStudyPatterns = ["case study", "case_study", "casestudy"];
  const caseStudy = presentations.find(
    (p) =>
      caseStudyPatterns.some((pat) => p.name.toLowerCase().includes(pat)) &&
      !taxonomyDeckIds.has(p.id) &&
      !pilots.some((pilot) => pilot.id === p.id)
  );
  if (caseStudy) {
    pilots.push(caseStudy);
    console.log(`  Pilot 3 (case study): "${caseStudy.name}"`);
  }

  // If we still don't have 2 pilots, pick any non-taxonomy deck
  if (pilots.length < 2) {
    for (const p of presentations) {
      if (
        !taxonomyDeckIds.has(p.id) &&
        !pilots.some((pilot) => pilot.id === p.id)
      ) {
        pilots.push(p);
        console.log(`  Pilot ${pilots.length} (additional): "${p.name}"`);
        if (pilots.length >= 2) break;
      }
    }
  }

  return pilots;
}

// ────────────────────────────────────────────────────────────
// Helper: Build manifest entry
// ────────────────────────────────────────────────────────────

interface PilotManifestEntry {
  documentId: string;
  presentationId: string;
  presentationName: string;
  slideObjectId: string;
  slideIndex: number;
  textPreview: string;
  speakerNotesPreview: string;
  isLowContent: boolean;
  metadata: ClassifiedSlide["metadata"];
  status: "pending" | "ingested" | "error";
}

function buildManifestEntry(
  slide: ClassifiedSlide,
  status: "pending" | "ingested" | "error" = "pending"
): PilotManifestEntry {
  return {
    documentId: slide.documentId,
    presentationId: slide.presentationId,
    presentationName: slide.presentationName,
    slideObjectId: slide.slideObjectId,
    slideIndex: slide.slideIndex,
    textPreview: slide.textContent.substring(0, 100),
    speakerNotesPreview: slide.speakerNotes.substring(0, 100),
    isLowContent: slide.isLowContent,
    metadata: slide.metadata,
    status,
  };
}

// ────────────────────────────────────────────────────────────
// Main pilot script
// ────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Pilot Ingestion Pipeline ===");
  console.log(`Drive folder ID: ${env.GOOGLE_DRIVE_FOLDER_ID}`);

  if (!env.GOOGLE_CLOUD_PROJECT) {
    console.error("ERROR: GOOGLE_CLOUD_PROJECT environment variable is required for classification.");
    console.error("Set it in apps/agent/.env for Vertex AI authentication.");
    process.exit(1);
  }

  // ── Step 1: Discover all presentations ──
  console.log("\n=== Step 1: Discovering Presentations ===");
  const allPresentations = await discoverPresentations(env.GOOGLE_DRIVE_FOLDER_ID);
  console.log(`Found ${allPresentations.length} presentations total`);

  if (allPresentations.length === 0) {
    console.error("ERROR: No presentations found in Drive folder. Check folder ID and permissions.");
    process.exit(1);
  }

  // List all found presentations
  for (const p of allPresentations) {
    console.log(`  [${p.folderPath || "(root)"}] ${p.name}`);
  }

  // ── Step 2: Extract solution pillar taxonomy ──
  const taxonomyDecks = findDecksByPattern(allPresentations, TAXONOMY_DECK_PATTERNS);
  console.log(`\nFound ${taxonomyDecks.length} taxonomy deck(s):`);
  for (const d of taxonomyDecks) {
    console.log(`  - "${d.name}" (${d.folderPath})`);
  }

  const solutionPillars = await extractSolutionPillars(taxonomyDecks);

  // Write solution pillars to manifest
  await mkdir(MANIFEST_DIR, { recursive: true });
  await writeFile(
    join(MANIFEST_DIR, "solution-pillars.json"),
    JSON.stringify(solutionPillars, null, 2)
  );
  console.log(`  Written to: manifest/solution-pillars.json`);

  // ── Step 3: Select pilot decks ──
  console.log("\n=== Step 3: Selecting Pilot Decks ===");
  const taxonomyDeckIds = new Set(taxonomyDecks.map((d) => d.id));
  const pilotDecks = selectPilotDecks(allPresentations, taxonomyDeckIds);

  if (pilotDecks.length === 0) {
    console.error("ERROR: No pilot decks could be selected.");
    process.exit(1);
  }

  console.log(`Selected ${pilotDecks.length} pilot deck(s)`);

  // ── Step 4: Extract slides from pilot decks ──
  console.log("\n=== Step 4: Extracting Slides from Pilot Decks ===");
  const pilotSlides = await extractAllSlides(pilotDecks);
  console.log(`Extracted ${pilotSlides.length} slides from ${pilotDecks.length} pilot decks`);

  // ── Step 5: Classify metadata ──
  console.log("\n=== Step 5: Classifying Slide Metadata ===");
  const classifiedSlides = await classifyAllSlides(
    pilotSlides,
    solutionPillars,
  );

  // ── Step 6: Write pilot manifest ──
  console.log("\n=== Step 6: Writing Pilot Manifest ===");
  const manifest: PilotManifestEntry[] = classifiedSlides.map((s) =>
    buildManifestEntry(s, "pending")
  );

  await writeFile(
    join(MANIFEST_DIR, "pilot-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`  Written ${manifest.length} entries to manifest/pilot-manifest.json`);

  // ── Step 7: Ingest into AtlusAI via Google Drive ──
  console.log("\n=== Step 7: Ingesting into AtlusAI (via Google Drive) ===");
  let ingestedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < classifiedSlides.length; i++) {
    const slide = classifiedSlides[i];
    const slideDoc: SlideDocument = {
      documentId: slide.documentId,
      presentationId: slide.presentationId,
      presentationName: slide.presentationName,
      slideObjectId: slide.slideObjectId,
      slideIndex: slide.slideIndex,
      folderPath: slide.folderPath,
      textContent: slide.textContent,
      speakerNotes: slide.speakerNotes,
      isLowContent: slide.isLowContent,
      metadata: slide.metadata as unknown as Record<string, unknown>,
    };

    try {
      const result = await ingestDocument(slideDoc, env.GOOGLE_DRIVE_FOLDER_ID);
      if (result.skipped) {
        skippedCount++;
        manifest[i].status = "ingested"; // Already exists
        console.log(
          `  [${i + 1}/${classifiedSlides.length}] SKIPPED (exists): Slide ${slide.slideIndex} of "${slide.presentationName}"`
        );
      } else if (result.created) {
        ingestedCount++;
        manifest[i].status = "ingested";
        console.log(
          `  [${i + 1}/${classifiedSlides.length}] INGESTED: Slide ${slide.slideIndex} of "${slide.presentationName}" -> ${result.docId}`
        );
      }
    } catch (error) {
      errorCount++;
      manifest[i].status = "error";
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `  [${i + 1}/${classifiedSlides.length}] ERROR: Slide ${slide.slideIndex} of "${slide.presentationName}": ${message}`
      );
    }

    // Small delay between Drive API calls
    if (i < classifiedSlides.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Update manifest with final statuses
  await writeFile(
    join(MANIFEST_DIR, "pilot-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  // ── Step 8: Verify ingestion ──
  console.log("\n=== Step 8: Verification ===");
  console.log(
    "  NOTE: Semantic search verification requires AtlusAI to re-index the new documents."
  );
  console.log(
    "  This may take some time. Use Claude Code's MCP tools to verify:"
  );
  console.log(
    '  - knowledge_base_search_semantic with a query related to pilot deck content'
  );

  // ── Step 9: Summary ──
  console.log("\n=== PILOT INGESTION SUMMARY ===");
  console.log(`Total presentations discovered: ${allPresentations.length}`);
  console.log(`Taxonomy decks processed: ${taxonomyDecks.length}`);
  console.log(`Solution pillars extracted: ${solutionPillars.length}`);
  console.log(`Pilot decks processed: ${pilotDecks.length}`);
  console.log(`Total slides extracted: ${pilotSlides.length}`);
  console.log(`Slides classified: ${classifiedSlides.length}`);
  console.log(`Slides ingested (new): ${ingestedCount}`);
  console.log(`Slides skipped (already exist): ${skippedCount}`);
  console.log(`Slides with errors: ${errorCount}`);
  console.log(`\nManifest files:`);
  console.log(`  - manifest/solution-pillars.json (${solutionPillars.length} pillars)`);
  console.log(`  - manifest/pilot-manifest.json (${manifest.length} entries)`);

  if (errorCount > 0) {
    console.log(`\nWARNING: ${errorCount} slides failed to ingest. Check errors above.`);
  }

  console.log("\n=== Pilot Complete ===");
}

main().catch((err) => {
  console.error("Pilot ingestion failed:", err);
  process.exit(1);
});
