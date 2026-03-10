import type { slides_v1 } from "googleapis";

import type { ModificationPlan } from "./modification-plan-schema";
import { getSlidesClient, type GoogleAuthOptions } from "../lib/google-auth";

export interface ExecuteModificationsParams {
  presentationId: string;
  plans: ModificationPlan[];
  authOptions?: GoogleAuthOptions;
}

export interface SlideModificationResult {
  slideId: string;
  slideObjectId: string;
  status: "success" | "skipped" | "no_modifications";
  modificationsApplied: number;
  error?: string;
}

export interface ExecuteModificationsResult {
  results: SlideModificationResult[];
  totalApplied: number;
  totalSkipped: number;
}

const LOG_PREFIX = "[modification-executor]";

// ────────────────────────────────────────────────────────────
// Bounding Box Overlap Detection
// ────────────────────────────────────────────────────────────

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function computeBoundingBox(element: slides_v1.Schema$PageElement): Rect | null {
  const size = element.size;
  const transform = element.transform;
  if (!size?.width?.magnitude || !size?.height?.magnitude) return null;

  const w = size.width.magnitude;
  const h = size.height.magnitude;
  const sx = transform?.scaleX ?? 1;
  const sy = transform?.scaleY ?? 1;
  const tx = transform?.translateX ?? 0;
  const ty = transform?.translateY ?? 0;

  return {
    left: tx,
    top: ty,
    right: tx + w * Math.abs(sx),
    bottom: ty + h * Math.abs(sy),
  };
}

function rectArea(r: Rect): number {
  return (r.right - r.left) * (r.bottom - r.top);
}

function overlapRatio(a: Rect, b: Rect): number {
  const overlapLeft = Math.max(a.left, b.left);
  const overlapTop = Math.max(a.top, b.top);
  const overlapRight = Math.min(a.right, b.right);
  const overlapBottom = Math.min(a.bottom, b.bottom);

  if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) return 0;

  const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
  const smallerArea = Math.min(rectArea(a), rectArea(b));
  return smallerArea > 0 ? overlapArea / smallerArea : 0;
}

/**
 * Find modified text elements that overlap spatially.
 * Returns objectIds to delete (the ones behind in z-order).
 *
 * pageElements order = z-order in Google Slides (later = on top).
 * For each overlapping pair, we keep the frontmost and delete the one behind.
 */
function findOverlappingModifiedElements(
  pageElements: slides_v1.Schema$PageElement[],
  modifiedElementIds: Set<string>,
): Set<string> {
  const OVERLAP_THRESHOLD = 0.5;
  const toDelete = new Set<string>();

  // Collect modified elements with bounding boxes, preserving z-order
  const modifiedWithBoxes: Array<{
    objectId: string;
    rect: Rect;
    zIndex: number;
  }> = [];

  flattenElements(pageElements).forEach((element, zIndex) => {
    if (element.objectId && modifiedElementIds.has(element.objectId)) {
      const rect = computeBoundingBox(element);
      if (rect) {
        modifiedWithBoxes.push({ objectId: element.objectId, rect, zIndex });
      }
    }
  });

  // Check all pairs for overlap
  for (let i = 0; i < modifiedWithBoxes.length; i++) {
    for (let j = i + 1; j < modifiedWithBoxes.length; j++) {
      const a = modifiedWithBoxes[i];
      const b = modifiedWithBoxes[j];

      if (toDelete.has(a.objectId) || toDelete.has(b.objectId)) continue;

      const ratio = overlapRatio(a.rect, b.rect);
      if (ratio >= OVERLAP_THRESHOLD) {
        // Delete the one behind (lower z-index)
        const behind = a.zIndex < b.zIndex ? a : b;
        toDelete.add(behind.objectId);
        console.log(
          `${LOG_PREFIX} Overlap detected: ${a.objectId} and ${b.objectId} overlap ${(ratio * 100).toFixed(0)}%, deleting ${behind.objectId} (behind)`,
        );
      }
    }
  }

  return toDelete;
}

/** Flatten pageElements into a flat list preserving z-order (including group children) */
function flattenElements(
  elements: slides_v1.Schema$PageElement[],
): slides_v1.Schema$PageElement[] {
  const flat: slides_v1.Schema$PageElement[] = [];
  for (const el of elements) {
    flat.push(el);
    if (el.elementGroup?.children) {
      flat.push(...flattenElements(el.elementGroup.children));
    }
  }
  return flat;
}

// ────────────────────────────────────────────────────────────
// Style Extraction
// ────────────────────────────────────────────────────────────

/** Style info extracted from an element's first text run */
interface ElementTextStyle {
  /** The text style from the first non-empty text run */
  textStyle?: slides_v1.Schema$TextStyle;
  /** The paragraph style from the first paragraph marker */
  paragraphStyle?: slides_v1.Schema$ParagraphStyle;
}

function getSlideElementIds(
  slide: slides_v1.Schema$Page | undefined,
): Set<string> {
  const ids = new Set<string>();
  collectElementIds(slide?.pageElements ?? [], ids);
  return ids;
}

/** Extract text style info from a slide's elements, keyed by element objectId */
function extractElementStyles(
  slide: slides_v1.Schema$Page | undefined,
): Map<string, ElementTextStyle> {
  const styles = new Map<string, ElementTextStyle>();
  collectElementStyles(slide?.pageElements ?? [], styles);
  return styles;
}

function collectElementStyles(
  elements: slides_v1.Schema$PageElement[],
  styles: Map<string, ElementTextStyle>,
): void {
  for (const element of elements) {
    if (element.objectId && element.shape?.text?.textElements) {
      const textElements = element.shape.text.textElements;
      const style: ElementTextStyle = {};

      // Find first non-empty text run with a style
      for (const te of textElements) {
        if (te.textRun?.style && !style.textStyle) {
          style.textStyle = te.textRun.style;
        }
        if (te.paragraphMarker?.style && !style.paragraphStyle) {
          style.paragraphStyle = te.paragraphMarker.style;
        }
        if (style.textStyle && style.paragraphStyle) break;
      }

      if (style.textStyle || style.paragraphStyle) {
        styles.set(element.objectId, style);
      } else {
        console.log(`${LOG_PREFIX} Element ${element.objectId}: shape has text but no style found in ${textElements.length} text elements`);
      }
    }
    if (element.elementGroup?.children) {
      collectElementStyles(element.elementGroup.children, styles);
    }
  }
}

function collectElementIds(
  elements: slides_v1.Schema$PageElement[],
  ids: Set<string>,
): void {
  for (const element of elements) {
    if (element.objectId) {
      ids.add(element.objectId);
    }
    // Recurse into element groups to find nested text shapes
    if (element.elementGroup?.children) {
      collectElementIds(element.elementGroup.children, ids);
    }
  }
}

function buildRequests(
  plan: ModificationPlan,
  currentElementIds: Set<string>,
  elementStyles: Map<string, ElementTextStyle>,
): {
  requests: slides_v1.Schema$Request[];
  modificationsApplied: number;
} {
  const requests: slides_v1.Schema$Request[] = [];
  let modificationsApplied = 0;

  for (const modification of plan.modifications) {
    if (!currentElementIds.has(modification.elementId)) {
      console.warn(
        `${LOG_PREFIX} Element ${modification.elementId} not found on slide ${plan.slideObjectId}, skipping`,
      );
      continue;
    }

    const newText = modification.newContent.replace(/\n$/, "");

    // 1. Delete all existing text
    requests.push({
      deleteText: {
        objectId: modification.elementId,
        textRange: { type: "ALL" },
      },
    });

    // 2. Insert new text
    requests.push({
      insertText: {
        objectId: modification.elementId,
        insertionIndex: 0,
        text: newText,
      },
    });

    // 3. Restore original text style (font, size, color, bold/italic)
    // After deleteText+insertText, the new text loses all formatting.
    // We reapply the style captured from the original first text run.
    const style = elementStyles.get(modification.elementId);
    if (style?.textStyle) {
      // Build fields string from the style properties that are actually set
      // Using "*" would clear properties we don't want to touch
      const styleFields = buildTextStyleFields(style.textStyle);
      if (styleFields) {
        requests.push({
          updateTextStyle: {
            objectId: modification.elementId,
            style: style.textStyle,
            textRange: {
              type: "ALL",
            },
            fields: styleFields,
          },
        });
      }
    }

    modificationsApplied += 1;
  }

  return { requests, modificationsApplied };
}

/**
 * Build a fields mask string from the properties present in a TextStyle.
 * Only includes fields that are actually set to avoid clearing unset properties.
 */
function buildTextStyleFields(style: slides_v1.Schema$TextStyle): string {
  const fields: string[] = [];

  if (style.foregroundColor !== undefined) fields.push("foregroundColor");
  if (style.backgroundColor !== undefined) fields.push("backgroundColor");
  if (style.fontSize !== undefined) fields.push("fontSize");
  if (style.bold !== undefined) fields.push("bold");
  if (style.italic !== undefined) fields.push("italic");
  if (style.underline !== undefined) fields.push("underline");
  if (style.strikethrough !== undefined) fields.push("strikethrough");
  if (style.fontFamily !== undefined) fields.push("fontFamily");
  if (style.weightedFontFamily !== undefined) fields.push("weightedFontFamily");
  if (style.baselineOffset !== undefined) fields.push("baselineOffset");
  if (style.smallCaps !== undefined) fields.push("smallCaps");
  if (style.link !== undefined) fields.push("link");

  return fields.join(",");
}

export async function executeModifications(
  params: ExecuteModificationsParams,
): Promise<ExecuteModificationsResult> {
  const { presentationId, plans, authOptions } = params;
  const slides = getSlidesClient(authOptions);
  const results: SlideModificationResult[] = [];

  for (let plan of plans) {
    if (plan.modifications.length === 0) {
      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "no_modifications",
        modificationsApplied: 0,
      });
      continue;
    }

    try {
      const presentation = await slides.presentations.get({ presentationId });
      const allSlideIds = (presentation.data.slides ?? []).map(s => s.objectId);
      console.log(`${LOG_PREFIX} Presentation ${presentationId} has slides: [${allSlideIds.join(', ')}]`);
      console.log(`${LOG_PREFIX} Looking for slide objectId: ${plan.slideObjectId}`);

      const targetSlide = presentation.data.slides?.find(
        (slide) => slide.objectId === plan.slideObjectId,
      );

      if (!targetSlide) {
        const error = `Slide objectId ${plan.slideObjectId} not found in presentation (available: [${allSlideIds.join(', ')}])`;
        console.warn(`${LOG_PREFIX} ${error}`);
        results.push({
          slideId: plan.slideId,
          slideObjectId: plan.slideObjectId,
          status: "skipped",
          modificationsApplied: 0,
          error,
        });
        continue;
      }

      const currentElementIds = getSlideElementIds(targetSlide);
      const elementStyles = extractElementStyles(targetSlide);
      console.log(`${LOG_PREFIX} Slide ${plan.slideObjectId} has elements: [${[...currentElementIds].join(', ')}]`);
      console.log(`${LOG_PREFIX} Plan targets elements: [${plan.modifications.map(m => m.elementId).join(', ')}]`);
      console.log(`${LOG_PREFIX} Captured styles for ${elementStyles.size} elements`);

      // Detect overlapping modified text elements and remove the ones behind
      const modifiedIds = new Set(plan.modifications.map((m) => m.elementId));
      const overlappingToDelete = findOverlappingModifiedElements(
        targetSlide.pageElements ?? [],
        modifiedIds,
      );

      // Filter out modifications targeting elements we're about to delete
      if (overlappingToDelete.size > 0) {
        plan = {
          ...plan,
          modifications: plan.modifications.filter(
            (m) => !overlappingToDelete.has(m.elementId),
          ),
        };
        console.log(
          `${LOG_PREFIX} Removed ${overlappingToDelete.size} overlapping elements, ${plan.modifications.length} modifications remain`,
        );
      }

      const { requests, modificationsApplied } = buildRequests(
        plan,
        currentElementIds,
        elementStyles,
      );

      // Add deleteObject requests for overlapping elements behind modified ones
      for (const elementId of overlappingToDelete) {
        requests.push({ deleteObject: { objectId: elementId } });
      }

      console.log(`${LOG_PREFIX} Built ${requests.length} requests for ${modificationsApplied} modifications (+ ${overlappingToDelete.size} overlap deletions)`);
      if (requests.length > 0) {
        // Log the actual request types being sent
        for (const req of requests) {
          if (req.deleteText) {
            console.log(`${LOG_PREFIX}   deleteText on ${req.deleteText.objectId} (type: ${req.deleteText.textRange?.type})`);
          }
          if (req.insertText) {
            console.log(`${LOG_PREFIX}   insertText on ${req.insertText.objectId}: "${(req.insertText.text ?? '').slice(0, 50)}..."`);
          }
          if (req.updateTextStyle) {
            console.log(`${LOG_PREFIX}   updateTextStyle on ${req.updateTextStyle.objectId} fields=${req.updateTextStyle.fields}`);
          }
          if (req.deleteObject) {
            console.log(`${LOG_PREFIX}   deleteObject ${req.deleteObject.objectId} (overlapping element)`);
          }
        }

        await slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests },
        });
        console.log(`${LOG_PREFIX} batchUpdate succeeded for slide ${plan.slideObjectId}`);
      }

      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "success",
        modificationsApplied,
      });
    } catch (error) {
      const errorDetail = error instanceof Error ? error.message : String(error);
      // Log full error including any API response body
      const apiError = (error as { response?: { data?: unknown } })?.response?.data;
      console.warn(
        `${LOG_PREFIX} Slide ${plan.slideId} (objectId=${plan.slideObjectId}) FAILED:`,
        errorDetail,
      );
      if (apiError) {
        console.warn(`${LOG_PREFIX} API error response:`, JSON.stringify(apiError, null, 2));
      }
      results.push({
        slideId: plan.slideId,
        slideObjectId: plan.slideObjectId,
        status: "skipped",
        modificationsApplied: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    results,
    totalApplied: results.reduce(
      (sum, result) => sum + result.modificationsApplied,
      0,
    ),
    totalSkipped: results.filter((result) => result.status === "skipped").length,
  };
}
