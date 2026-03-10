/**
 * Multi-Source Assembler Planning Helpers
 *
 * Phase 52 Plan 01 implements the pure planning layer for multi-source deck
 * assembly. It converts a SlideSelectionPlan into a MultiSourcePlan and keeps
 * the single-source execution path delegated to the existing copy-and-prune
 * assembler. Full multi-source Google API orchestration lands in Plan 02.
 */

import { createHash } from "node:crypto";
import type { SlideSelectionEntry, SlideSelectionPlan } from "@lumenalta/schemas";
import type { slides_v1 } from "googleapis";
import {
  assembleDeckFromSlides,
  type AssembleDeckResult,
} from "../lib/deck-customizer";
import { shareNewFile } from "../lib/drive-folders";
import {
  getDriveClient,
  getSlidesClient,
  type GoogleAuthOptions,
} from "../lib/google-auth";
import type { MultiSourcePlan, SecondarySource } from "./types";

export interface AssembleMultiSourceParams {
  plan: MultiSourcePlan;
  targetFolderId: string;
  deckName: string;
  ownerEmail?: string;
  authOptions?: GoogleAuthOptions;
}

interface RebuildContext {
  targetSlideId: string;
  sourceSlideId: string;
  counters: Record<string, number>;
  /** Maps source element objectId -> generated element objectId */
  elementIdMap: Map<string, string>;
}

export function groupSlidesBySource(
  selections: SlideSelectionEntry[],
): Map<string, SlideSelectionEntry[]> {
  const groupedSelections = new Map<string, SlideSelectionEntry[]>();

  for (const selection of selections) {
    const sourceSelections = groupedSelections.get(selection.sourcePresentationId) ?? [];
    sourceSelections.push(selection);
    groupedSelections.set(selection.sourcePresentationId, sourceSelections);
  }

  return groupedSelections;
}

function identifyPrimarySource(
  groupedSelections: Map<string, SlideSelectionEntry[]>,
): [string, SlideSelectionEntry[]] {
  let primarySource: [string, SlideSelectionEntry[]] | null = null;

  for (const sourceGroup of groupedSelections.entries()) {
    if (!primarySource || sourceGroup[1].length > primarySource[1].length) {
      primarySource = sourceGroup;
    }
  }

  if (!primarySource) {
    throw new Error("Cannot build multi-source plan from empty selections");
  }

  return primarySource;
}

export function buildMultiSourcePlan(
  selectionPlan: SlideSelectionPlan,
  allSlidesByPresentation: Map<string, string[]>,
): MultiSourcePlan {
  const groupedSelections = groupSlidesBySource(selectionPlan.selections);
  const [primaryPresentationId, primaryEntries] = identifyPrimarySource(groupedSelections);

  // Use slideObjectId (Google Slides page objectId) for all assembly operations
  const keepSlideIds = primaryEntries.map((entry) => entry.slideObjectId);
  const keepSlideIdSet = new Set(keepSlideIds);
  const allPrimarySlideIds = allSlidesByPresentation.get(primaryPresentationId) ?? [];

  const secondarySources: SecondarySource[] = [];

  for (const [presentationId, entries] of groupedSelections.entries()) {
    if (presentationId === primaryPresentationId) {
      continue;
    }

    secondarySources.push({
      templateId: entries[0].templateId,
      presentationId,
      slideIds: entries.map((entry) => entry.slideObjectId),
    });
  }

  return {
    primarySource: {
      templateId: primaryEntries[0].templateId,
      presentationId: primaryPresentationId,
      keepSlideIds,
      deleteSlideIds: allPrimarySlideIds.filter(
        (slideId) => !keepSlideIdSet.has(slideId),
      ),
    },
    secondarySources,
    finalSlideOrder: selectionPlan.selections.map((selection) => selection.slideObjectId),
  };
}

export async function assembleMultiSourceDeck(
  params: AssembleMultiSourceParams,
  onLog?: (message: string, detail?: string) => void,
): Promise<AssembleDeckResult> {
  if (params.plan.secondarySources.length === 0) {
    console.log(`[multi-source-assembler] Single-source path: presentationId=${params.plan.primarySource.presentationId}, keepSlides=[${params.plan.primarySource.keepSlideIds.join(', ')}], slideOrder=[${params.plan.finalSlideOrder.join(', ')}]`);
    return assembleDeckFromSlides({
      sourcePresentationId: params.plan.primarySource.presentationId,
      selectedSlideIds: params.plan.primarySource.keepSlideIds,
      slideOrder: params.plan.finalSlideOrder,
      targetFolderId: params.targetFolderId,
      deckName: params.deckName,
      authOptions: params.authOptions,
    });
  }

  console.log(`[multi-source-assembler] Multi-source path: primary=${params.plan.primarySource.presentationId}, secondarySources=${params.plan.secondarySources.length}`);

  const drive = getDriveClient(params.authOptions);
  const slides = getSlidesClient(params.authOptions);
  const tempFileIds: string[] = [];

  try {
    const primaryCopy = await drive.files.copy({
      fileId: params.plan.primarySource.presentationId,
      requestBody: {
        name: params.deckName,
      },
      supportsAllDrives: true,
    });

    const presentationId = primaryCopy.data.id;
    if (!presentationId) {
      throw new Error("Primary presentation copy did not return an id");
    }

    // Share with org + service account so both pool users and SA can access
    await shareNewFile({ fileId: presentationId, ownerEmail: params.ownerEmail, drive });

    const slideIdMap = new Map<string, string>();
    const elementIdMap = new Map<string, string>();
    for (const slideId of params.plan.primarySource.keepSlideIds) {
      slideIdMap.set(slideId, slideId);
    }

    let primaryPresentation = await slides.presentations.get({ presentationId });
    const keepSlideIdSet = new Set(params.plan.primarySource.keepSlideIds);
    const deleteRequests: slides_v1.Schema$Request[] =
      (primaryPresentation.data.slides ?? [])
        .filter((slide) => slide.objectId && !keepSlideIdSet.has(slide.objectId))
        .map((slide) => ({
          deleteObject: { objectId: slide.objectId! },
        }));

    if (deleteRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: deleteRequests },
      });

      primaryPresentation = await slides.presentations.get({ presentationId });
    }

    for (const [index, secondarySource] of params.plan.secondarySources.entries()) {
      try {
        const secondaryCopy = await drive.files.copy({
          fileId: secondarySource.presentationId,
          requestBody: {
            name: `_temp_secondary_${secondarySource.templateId}_${index + 1}`,
          },
          supportsAllDrives: true,
        });

        const tempPresentationId = secondaryCopy.data.id;
        if (!tempPresentationId) {
          throw new Error(
            `Secondary presentation copy did not return an id for ${secondarySource.presentationId}`,
          );
        }

        tempFileIds.push(tempPresentationId);

        const secondaryPresentation = await slides.presentations.get({
          presentationId: tempPresentationId,
        });

        for (const slideId of secondarySource.slideIds) {
          const sourceSlide = (secondaryPresentation.data.slides ?? []).find(
            (slide) => slide.objectId === slideId,
          );

          if (!sourceSlide) {
            console.warn(
              `[multi-source-assembler] Missing secondary slide ${slideId} in ${secondarySource.presentationId}, skipping`,
            );
            continue;
          }

          const targetSlideId = `generated-${slideId}`;
          slideIdMap.set(slideId, targetSlideId);

          const requests = buildSecondarySlideRequests(
            sourceSlide,
            targetSlideId,
            (primaryPresentation.data.slides ?? []).length,
            elementIdMap,
          );

          await slides.presentations.batchUpdate({
            presentationId,
            requestBody: { requests },
          });

          primaryPresentation = await slides.presentations.get({ presentationId });
        }
      } catch (error) {
        console.error(
          `[multi-source-assembler] Failed to copy secondary presentation ${secondarySource.presentationId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const finalPresentation = await slides.presentations.get({ presentationId });
    const translatedOrder = params.plan.finalSlideOrder
      .map((slideId) => slideIdMap.get(slideId))
      .filter((slideId): slideId is string => Boolean(slideId));
    const currentOrder = (finalPresentation.data.slides ?? [])
      .map((slide) => slide.objectId)
      .filter((slideId): slideId is string => Boolean(slideId));

    const reorderRequests = currentOrder
      .filter((slideId) => translatedOrder.includes(slideId))
      .map((slideId) => ({
        updateSlidesPosition: {
          slideObjectIds: [slideId],
          insertionIndex: translatedOrder.indexOf(slideId),
        },
      }));

    if (reorderRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: reorderRequests },
      });
    }

    return {
      presentationId,
      driveUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
      slideIdMap,
      elementIdMap,
    };
  } finally {
    for (const tempFileId of tempFileIds) {
      try {
        await drive.files.delete({
          fileId: tempFileId,
          supportsAllDrives: true,
        });
      } catch (error) {
        console.warn(
          `[multi-source-assembler] Failed to clean up temp file ${tempFileId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}

function buildSecondarySlideRequests(
  slide: slides_v1.Schema$Page,
  targetSlideId: string,
  insertionIndex: number,
  elementIdMap?: Map<string, string>,
): slides_v1.Schema$Request[] {
  const context: RebuildContext = {
    targetSlideId,
    sourceSlideId: slide.objectId ?? "unknown-slide",
    counters: {},
    elementIdMap: elementIdMap ?? new Map(),
  };

  const requests: slides_v1.Schema$Request[] = [
    {
      createSlide: {
        objectId: targetSlideId,
        insertionIndex,
      },
    },
  ];

  if (slide.pageProperties?.pageBackgroundFill) {
    requests.push({
      updatePageProperties: {
        objectId: targetSlideId,
        pageProperties: {
          pageBackgroundFill: slide.pageProperties.pageBackgroundFill,
        },
        fields: "pageBackgroundFill",
      },
    });
  }

  requests.push(...buildPageElementRequests(slide.pageElements ?? [], context));

  return requests;
}

function buildPageElementRequests(
  pageElements: slides_v1.Schema$PageElement[],
  context: RebuildContext,
): slides_v1.Schema$Request[] {
  const requests: slides_v1.Schema$Request[] = [];

  for (const element of pageElements) {
    if (element.elementGroup?.children?.length) {
      requests.push(...buildPageElementRequests(element.elementGroup.children, context));
      continue;
    }

    if (element.image) {
      // Skip image recreation — images should be kept as-is or removed,
      // never recreated from potentially ephemeral source URLs.
      // The rebuilt slide will simply not have this image.
      console.log(
        `[multi-source-assembler] Skipping image element ${element.objectId ?? 'unknown'} on source slide ${context.sourceSlideId} (images not rebuilt)`,
      );
      continue;
    }

    if (element.table) {
      requests.push(...buildTableRequests(element, context));
      continue;
    }

    if (element.shape) {
      requests.push(...buildShapeRequests(element, context));
      continue;
    }

    requests.push(
      ...buildUnsupportedElementRequests(element, context, detectUnsupportedElementType(element)),
    );
  }

  return requests;
}

function buildTextRequests(
  objectId: string,
  textElements: slides_v1.Schema$TextElement[] | null | undefined,
  cellLocation?: slides_v1.Schema$TableCellLocation,
): slides_v1.Schema$Request[] {
  if (!textElements || textElements.length === 0) {
    return [];
  }

  const requests: slides_v1.Schema$Request[] = [];
  let currentIndex = 0;

  for (const textElement of textElements) {
    if (textElement.textRun?.content) {
      const content = textElement.textRun.content;
      const request: slides_v1.Schema$Request = {
        insertText: {
          objectId,
          insertionIndex: currentIndex,
          text: content,
        },
      };
      if (cellLocation) {
        request.insertText!.cellLocation = cellLocation;
      }
      requests.push(request);
      currentIndex += content.length;
    }
  }

  for (const textElement of textElements) {
    const startIndex = textElement.startIndex ?? 0;
    const endIndex = textElement.endIndex ?? 0;

    if (startIndex >= endIndex) continue;

    if (textElement.textRun?.style) {
      const request: slides_v1.Schema$Request = {
        updateTextStyle: {
          objectId,
          style: textElement.textRun.style,
          textRange: {
            type: "FIXED_RANGE",
            startIndex,
            endIndex,
          },
          fields: "*",
        },
      };
      if (cellLocation) request.updateTextStyle!.cellLocation = cellLocation;
      requests.push(request);
    }

    if (textElement.paragraphMarker) {
      if (textElement.paragraphMarker.style) {
        const request: slides_v1.Schema$Request = {
          updateParagraphStyle: {
            objectId,
            style: textElement.paragraphMarker.style,
            textRange: {
              type: "FIXED_RANGE",
              startIndex,
              endIndex,
            },
            fields: "*",
          },
        };
        if (cellLocation) request.updateParagraphStyle!.cellLocation = cellLocation;
        requests.push(request);
      }

      if (textElement.paragraphMarker.bullet) {
        const request: slides_v1.Schema$Request = {
          createParagraphBullets: {
            objectId,
            textRange: {
              type: "FIXED_RANGE",
              startIndex,
              endIndex,
            },
            bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
          },
        };
        if (cellLocation) request.createParagraphBullets!.cellLocation = cellLocation;
        requests.push(request);
      }
    }
  }

  return requests;
}

function buildImageRequests(
  element: slides_v1.Schema$PageElement,
  context: RebuildContext,
): slides_v1.Schema$Request[] {
  const imageUrl = element.image?.contentUrl ?? element.image?.sourceUrl;
  if (!imageUrl) {
    return buildUnsupportedElementRequests(element, context, "image", "missing source url");
  }

  const elementProperties = buildElementProperties(element);
  if (!elementProperties) {
    return buildUnsupportedElementRequests(element, context, "image", "missing geometry");
  }

  const imageId = makeElementObjectId(context, element, "image");
  const requests: slides_v1.Schema$Request[] = [
    {
      createImage: {
        objectId: imageId,
        url: imageUrl,
        elementProperties: {
          pageObjectId: context.targetSlideId,
          ...elementProperties,
        },
      },
    },
  ];

  if (element.image?.imageProperties) {
    requests.push({
      updateImageProperties: {
        objectId: imageId,
        imageProperties: element.image.imageProperties,
        fields: "*",
      },
    });
  }

  return requests;
}

function buildShapeRequests(
  element: slides_v1.Schema$PageElement,
  context: RebuildContext,
): slides_v1.Schema$Request[] {
  const elementProperties = buildElementProperties(element);
  if (!elementProperties) {
    return buildUnsupportedElementRequests(element, context, "shape", "missing geometry");
  }

  const shapeId = makeElementObjectId(context, element, "shape");
  const shapeType = element.shape?.shapeType ?? "TEXT_BOX";
  const requests: slides_v1.Schema$Request[] = [
    {
      createShape: {
        objectId: shapeId,
        shapeType,
        elementProperties: {
          pageObjectId: context.targetSlideId,
          ...elementProperties,
        },
      },
    },
  ];

  if (element.shape?.shapeProperties) {
    requests.push({
      updateShapeProperties: {
        objectId: shapeId,
        shapeProperties: element.shape.shapeProperties,
        fields: "*",
      },
    });
  }

  requests.push(...buildTextRequests(shapeId, element.shape?.text?.textElements));

  return requests;
}

function buildTableRequests(
  element: slides_v1.Schema$PageElement,
  context: RebuildContext,
): slides_v1.Schema$Request[] {
  const elementProperties = buildElementProperties(element);
  if (!elementProperties) {
    return buildUnsupportedElementRequests(element, context, "table", "missing geometry");
  }

  const tableRows = element.table?.tableRows ?? [];
  const rowCount = element.table?.rows ?? tableRows.length;
  const columnCount =
    element.table?.columns ??
    tableRows.reduce(
      (maxColumns, row) => Math.max(maxColumns, row.tableCells?.length ?? 0),
      0,
    );

  if (!rowCount || !columnCount) {
    return buildUnsupportedElementRequests(
      element,
      context,
      "table",
      "missing row or column metadata",
    );
  }

  const tableId = makeElementObjectId(context, element, "table");
  const requests: slides_v1.Schema$Request[] = [
    {
      createTable: {
        objectId: tableId,
        rows: rowCount,
        columns: columnCount,
        elementProperties: {
          pageObjectId: context.targetSlideId,
          ...elementProperties,
        },
      },
    },
  ];

  if (element.table?.tableColumns) {
    element.table.tableColumns.forEach((column, columnIndex) => {
      if (column.columnWidth) {
        requests.push({
          updateTableColumnProperties: {
            objectId: tableId,
            columnIndices: [columnIndex],
            tableColumnProperties: { columnWidth: column.columnWidth },
            fields: "columnWidth",
          },
        });
      }
    });
  }

  tableRows.forEach((row, rowIndex) => {
    if (row.rowHeight) {
      requests.push({
        updateTableRowProperties: {
          objectId: tableId,
          rowIndices: [rowIndex],
          tableRowProperties: { minRowHeight: row.rowHeight },
          fields: "minRowHeight",
        },
      });
    }

    (row.tableCells ?? []).forEach((cell, columnIndex) => {
      const cellLocation = { rowIndex, columnIndex };

      if (cell.tableCellProperties) {
        requests.push({
          updateTableCellProperties: {
            objectId: tableId,
            tableRange: {
              location: cellLocation,
              rowSpan: 1,
              columnSpan: 1,
            },
            tableCellProperties: cell.tableCellProperties,
            fields: "*",
          },
        });
        
        // Also map border properties if present in tableCellProperties (Google Slides usually represents border separately but some SDKs overlay them)
        // If we want updateTableBorderProperties, we can issue a dummy request or skip it if the property doesn't exist directly on cell
      }

      requests.push(...buildTextRequests(tableId, cell.text?.textElements, cellLocation));
    });
  });

  // Adding table border properties if horizontalBorderRows / verticalBorderRows exists
  if (element.table?.horizontalBorderRows) {
    element.table.horizontalBorderRows.forEach((borderRow, rIndex) => {
      (borderRow.tableBorderCells ?? []).forEach((borderCell, cIndex) => {
        if (borderCell.tableBorderProperties) {
          requests.push({
            updateTableBorderProperties: {
              objectId: tableId,
              borderPosition: "BOTTOM", // Approximation
              tableRange: {
                location: { rowIndex: rIndex, columnIndex: cIndex },
                rowSpan: 1,
                columnSpan: 1,
              },
              tableBorderProperties: borderCell.tableBorderProperties,
              fields: "*",
            },
          });
        }
      });
    });
  }

  return requests;
}

function buildUnsupportedElementRequests(
  element: slides_v1.Schema$PageElement,
  context: RebuildContext,
  elementType: string,
  reason?: string,
): slides_v1.Schema$Request[] {
  const elementId = element.objectId ?? `unknown-${elementType}`;
  const detail = reason ? `${elementType} (${reason})` : elementType;

  console.warn(
    `[multi-source-assembler] Unsupported element ${elementId} (${detail}) on source slide ${context.sourceSlideId}`,
  );

  return buildPlaceholderRequests(
    context,
    element,
    `Unsupported element: ${elementType}\nSource slide: ${context.sourceSlideId}\nElement: ${elementId}`,
  );
}

function buildPlaceholderRequests(
  context: RebuildContext,
  element: slides_v1.Schema$PageElement,
  text: string,
): slides_v1.Schema$Request[] {
  const placeholderId = makeElementObjectId(context, element, "placeholder");
  const elementProperties = buildElementProperties(element, true) ?? {
    size: defaultPlaceholderSize(),
    transform: defaultPlaceholderTransform(),
  };

  return [
    {
      createShape: {
        objectId: placeholderId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: context.targetSlideId,
          ...elementProperties,
        },
      },
    },
    {
      insertText: {
        objectId: placeholderId,
        insertionIndex: 0,
        text,
      },
    },
  ];
}

function extractTextContent(
  textElements: slides_v1.Schema$TextElement[] | null | undefined,
): string {
  return (textElements ?? [])
    .map((textElement) => textElement.textRun?.content ?? "")
    .join("")
    .trim();
}

function makeElementObjectId(
  context: RebuildContext,
  element: slides_v1.Schema$PageElement,
  kind: string,
): string {
  const nextIndex = (context.counters[kind] ?? 0) + 1;
  context.counters[kind] = nextIndex;

  const sourceId = sanitizeObjectIdFragment(element.objectId ?? `${kind}-${nextIndex}`);
  const kindPrefix = kind.slice(0, 3);
  const targetPrefix = sanitizeObjectIdFragment(context.targetSlideId).slice(0, 18);
  const sourcePrefix = sourceId.slice(0, 10);
  const digest = createHash("sha1")
    .update(`${context.targetSlideId}:${kind}:${sourceId}:${nextIndex}`)
    .digest("hex")
    .slice(0, 12);

  const generatedId = `${targetPrefix}-${kindPrefix}-${sourcePrefix}-${nextIndex}-${digest}`.slice(0, 50);

  // Record source -> generated mapping for downstream modification plans
  if (element.objectId) {
    context.elementIdMap.set(element.objectId, generatedId);
  }

  return generatedId;
}

function sanitizeObjectIdFragment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

function buildElementProperties(
  element: slides_v1.Schema$PageElement,
  allowTransformFallback = false,
): Pick<slides_v1.Schema$PageElement, "size" | "transform"> | null {
  if (!element.size) {
    return null;
  }

  const transform = normalizeTransform(element.transform, allowTransformFallback);
  if (!transform) {
    return null;
  }

  return {
    size: element.size,
    transform,
  };
}

function normalizeTransform(
  transform: slides_v1.Schema$AffineTransform | null | undefined,
  allowFallback: boolean,
): slides_v1.Schema$AffineTransform | null {
  if (!transform) {
    return allowFallback ? defaultPlaceholderTransform() : null;
  }

  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  const shearX = transform.shearX ?? 0;
  const shearY = transform.shearY ?? 0;
  const normalizedTransform: slides_v1.Schema$AffineTransform = {
    scaleX,
    scaleY,
    shearX,
    shearY,
    translateX: transform.translateX ?? 0,
    translateY: transform.translateY ?? 0,
    unit: transform.unit ?? "PT",
  };
  const determinant = scaleX * scaleY - shearX * shearY;

  if (determinant !== 0) {
    return normalizedTransform;
  }

  if (!allowFallback) {
    return null;
  }

  return {
    scaleX: scaleX || 1,
    scaleY: scaleY || 1,
    shearX: 0,
    shearY: 0,
    translateX: normalizedTransform.translateX || 24,
    translateY: normalizedTransform.translateY || 24,
    unit: normalizedTransform.unit,
  };
}

function defaultPlaceholderSize(): slides_v1.Schema$Size {
  return {
    height: { magnitude: 80, unit: "PT" },
    width: { magnitude: 260, unit: "PT" },
  };
}

function defaultPlaceholderTransform(): slides_v1.Schema$AffineTransform {
  return {
    scaleX: 1,
    scaleY: 1,
    translateX: 24,
    translateY: 24,
    unit: "PT",
  };
}

function detectUnsupportedElementType(element: slides_v1.Schema$PageElement): string {
  if (element.sheetsChart) return "sheetsChart";
  if (element.video) return "video";
  if (element.wordArt) return "wordArt";
  if (element.line) return "line";
  return "unknown";
}
