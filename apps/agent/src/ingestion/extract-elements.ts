/**
 * Element Map Extraction
 *
 * Extracts structural element data from Google Slides pageElements.
 * Stores position, size, type, text content, and basic styling
 * for downstream programmatic slide manipulation.
 *
 * All positions and sizes are in raw EMU (English Metric Units).
 * 1 EMU = 1/914400 inch. Conversion to pixels happens in the UI layer.
 */

import type { slides_v1 } from "googleapis";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface SlideElementData {
  elementId: string;
  elementType: "shape" | "text" | "image" | "table" | "group";
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  contentText: string;
  fontSize: number | null;
  fontColor: string | null;
  isBold: boolean;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Determine the element type from a Google Slides pageElement.
 * Priority: elementGroup > table > image > shape with text > shape
 */
function extractElementType(
  element: slides_v1.Schema$PageElement
): SlideElementData["elementType"] {
  if (element.elementGroup) return "group";
  if (element.table) return "table";
  if (element.image) return "image";
  if (
    element.shape?.text?.textElements?.some(
      (te) => te.textRun?.content?.trim()
    )
  )
    return "text";
  return "shape";
}

/**
 * Extract text content from a pageElement (shape text or table cells).
 */
function extractTextFromElement(
  element: slides_v1.Schema$PageElement
): string {
  const parts: string[] = [];

  // Shape text
  if (element.shape?.text?.textElements) {
    for (const te of element.shape.text.textElements) {
      if (te.textRun?.content) {
        parts.push(te.textRun.content);
      }
    }
  }

  // Table cell text
  if (element.table) {
    for (const row of element.table.tableRows ?? []) {
      for (const cell of row.tableCells ?? []) {
        if (cell.text?.textElements) {
          for (const te of cell.text.textElements) {
            if (te.textRun?.content) {
              parts.push(te.textRun.content);
            }
          }
        }
      }
    }
  }

  return parts.join("").trim();
}

/**
 * Convert an RGB color object to a hex string (#RRGGBB).
 */
function rgbToHex(rgb: slides_v1.Schema$RgbColor): string {
  const r = Math.round((rgb.red ?? 0) * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round((rgb.green ?? 0) * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round((rgb.blue ?? 0) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
}

// ────────────────────────────────────────────────────────────
// Main extraction
// ────────────────────────────────────────────────────────────

/**
 * Extract structured element data from Google Slides pageElements.
 *
 * Processes each element for position, size, type, text content,
 * and basic styling (font size, color, bold). Recursively processes
 * element groups to include child elements as separate rows.
 *
 * @param pageElements - Raw pageElements from Google Slides API
 * @returns Array of extracted element data
 */
export function extractElements(
  pageElements: slides_v1.Schema$PageElement[]
): SlideElementData[] {
  const result: SlideElementData[] = [];

  for (const el of pageElements) {
    const transform = el.transform;
    const size = el.size;

    // Extract first text style for basic styling info
    let fontSize: number | null = null;
    let fontColor: string | null = null;
    let isBold = false;

    const textElements = el.shape?.text?.textElements ?? [];
    for (const te of textElements) {
      if (te.textRun?.style) {
        const style = te.textRun.style;
        if (style.fontSize?.magnitude) fontSize = style.fontSize.magnitude;
        if (style.foregroundColor?.opaqueColor?.rgbColor) {
          fontColor = rgbToHex(style.foregroundColor.opaqueColor.rgbColor);
        }
        if (style.bold) isBold = true;
        break; // Use first text run's style
      }
    }

    result.push({
      elementId: el.objectId ?? "",
      elementType: extractElementType(el),
      positionX: transform?.translateX ?? 0,
      positionY: transform?.translateY ?? 0,
      width: size?.width?.magnitude ?? 0,
      height: size?.height?.magnitude ?? 0,
      contentText: extractTextFromElement(el),
      fontSize,
      fontColor,
      isBold,
    });

    // Recurse into groups
    if (el.elementGroup?.children) {
      result.push(...extractElements(el.elementGroup.children));
    }
  }

  return result;
}
