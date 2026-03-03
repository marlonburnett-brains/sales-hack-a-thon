/**
 * Slide Text Extraction Library
 *
 * Extracts text content and speaker notes from individual slides
 * within a Google Slides presentation using the Slides API.
 *
 * Key patterns:
 * - One presentations.get call per presentation (returns ALL slides)
 * - Speaker notes accessed via notesPage.notesProperties.speakerNotesObjectId
 * - Deterministic document IDs via SHA-256(presentationId:slideObjectId)
 * - Low-content detection for title/divider slides (< 20 chars combined)
 */

import { createHash } from "node:crypto";
import { getSlidesClient } from "./google-auth";
import type { slides_v1 } from "googleapis";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ExtractedSlide {
  /** SHA-256 of presentationId:slideObjectId (first 32 chars) */
  documentId: string;
  presentationId: string;
  presentationName: string;
  folderPath: string;
  slideObjectId: string;
  slideIndex: number;
  textContent: string;
  speakerNotes: string;
  /** true if combined text + notes < 20 chars */
  isLowContent: boolean;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Generate a deterministic document ID from presentationId and slideObjectId.
 * Uses SHA-256 hash, truncated to first 32 hex characters.
 */
function generateDocumentId(
  presentationId: string,
  slideObjectId: string
): string {
  return createHash("sha256")
    .update(`${presentationId}:${slideObjectId}`)
    .digest("hex")
    .substring(0, 32);
}

/**
 * Extract all text from a slide's pageElements.
 * Iterates through all shapes and concatenates TextRun content strings.
 */
function extractTextFromPageElements(
  pageElements: slides_v1.Schema$PageElement[] | undefined
): string {
  if (!pageElements) return "";

  const textParts: string[] = [];

  for (const element of pageElements) {
    // Handle shapes with text
    if (element.shape?.text?.textElements) {
      for (const te of element.shape.text.textElements) {
        if (te.textRun?.content) {
          textParts.push(te.textRun.content);
        }
      }
    }

    // Handle tables (each cell can contain text)
    if (element.table) {
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          if (cell.text?.textElements) {
            for (const te of cell.text.textElements) {
              if (te.textRun?.content) {
                textParts.push(te.textRun.content);
              }
            }
          }
        }
      }
    }

    // Handle groups (recursive element containers)
    if (element.elementGroup?.children) {
      const groupText = extractTextFromPageElements(element.elementGroup.children);
      if (groupText) {
        textParts.push(groupText);
      }
    }
  }

  return textParts.join("").trim();
}

/**
 * Extract speaker notes from a slide's notesPage.
 * Checks for speakerNotesObjectId existence before accessing
 * (may be undefined if no notes were ever added to the slide).
 */
function extractSpeakerNotes(slide: slides_v1.Schema$Page): string {
  const notesPage = slide.slideProperties?.notesPage;
  if (!notesPage) return "";

  const speakerNotesId = notesPage.notesProperties?.speakerNotesObjectId;
  if (!speakerNotesId) return "";

  // Find the shape that matches the speakerNotesObjectId
  const notesShape = notesPage.pageElements?.find(
    (el) => el.objectId === speakerNotesId
  );

  if (!notesShape?.shape?.text?.textElements) return "";

  return notesShape.shape.text.textElements
    .filter((te) => te.textRun?.content)
    .map((te) => te.textRun!.content!)
    .join("")
    .trim();
}

// ────────────────────────────────────────────────────────────
// Main extraction function
// ────────────────────────────────────────────────────────────

/**
 * Extract text content and speaker notes from every slide in a presentation.
 *
 * Makes a single presentations.get API call to fetch all slides at once.
 * Returns an ExtractedSlide for each slide with deterministic document IDs.
 *
 * @param presentationId - Google Slides presentation ID
 * @param presentationName - Human-readable name of the presentation
 * @param folderPath - Slash-separated folder path for context
 */
export async function extractSlidesFromPresentation(
  presentationId: string,
  presentationName: string,
  folderPath: string
): Promise<ExtractedSlide[]> {
  const slides = getSlidesClient();

  // Single API call to get ALL slides including notes pages
  const response = await slides.presentations.get({
    presentationId,
  });

  const presentation = response.data;
  const slidePages = presentation.slides ?? [];
  const extractedSlides: ExtractedSlide[] = [];

  for (let i = 0; i < slidePages.length; i++) {
    const slide = slidePages[i];
    const slideObjectId = slide.objectId ?? `slide_${i}`;

    const textContent = extractTextFromPageElements(slide.pageElements);
    const speakerNotes = extractSpeakerNotes(slide);

    // Low content detection: combined text + notes < 20 chars
    const combinedLength = textContent.length + speakerNotes.length;
    const isLowContent = combinedLength < 20;

    extractedSlides.push({
      documentId: generateDocumentId(presentationId, slideObjectId),
      presentationId,
      presentationName,
      folderPath,
      slideObjectId,
      slideIndex: i,
      textContent,
      speakerNotes,
      isLowContent,
    });
  }

  return extractedSlides;
}
