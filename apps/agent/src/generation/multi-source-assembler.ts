/**
 * Multi-Source Assembler Planning Helpers
 *
 * Phase 52 Plan 01 implements the pure planning layer for multi-source deck
 * assembly. It converts a SlideSelectionPlan into a MultiSourcePlan and keeps
 * the single-source execution path delegated to the existing copy-and-prune
 * assembler. Full multi-source Google API orchestration lands in Plan 02.
 */

import type { SlideSelectionEntry, SlideSelectionPlan } from "@lumenalta/schemas";
import type { slides_v1 } from "googleapis";
import {
  assembleDeckFromSlides,
  type AssembleDeckResult,
} from "../lib/deck-customizer";
import { shareWithOrg } from "../lib/drive-folders";
import { getDriveClient, getSlidesClient } from "../lib/google-auth";
import type { MultiSourcePlan, SecondarySource } from "./types";

export interface AssembleMultiSourceParams {
  plan: MultiSourcePlan;
  targetFolderId: string;
  deckName: string;
  ownerEmail?: string;
}

interface TextElementSnapshot {
  text: string;
  size?: slides_v1.Schema$Size;
  transform?: slides_v1.Schema$AffineTransform;
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

  const keepSlideIds = primaryEntries.map((entry) => entry.slideId);
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
      slideIds: entries.map((entry) => entry.slideId),
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
    finalSlideOrder: selectionPlan.selections.map((selection) => selection.slideId),
  };
}

export async function assembleMultiSourceDeck(
  params: AssembleMultiSourceParams,
): Promise<AssembleDeckResult> {
  if (params.plan.secondarySources.length === 0) {
    return assembleDeckFromSlides({
      sourcePresentationId: params.plan.primarySource.presentationId,
      selectedSlideIds: params.plan.primarySource.keepSlideIds,
      slideOrder: params.plan.finalSlideOrder,
      targetFolderId: params.targetFolderId,
      deckName: params.deckName,
    });
  }

  const drive = getDriveClient();
  const slides = getSlidesClient();
  const tempFileIds: string[] = [];

  try {
    const primaryCopy = await drive.files.copy({
      fileId: params.plan.primarySource.presentationId,
      requestBody: {
        name: params.deckName,
        parents: [params.targetFolderId],
      },
      supportsAllDrives: true,
    });

    const presentationId = primaryCopy.data.id;
    if (!presentationId) {
      throw new Error("Primary presentation copy did not return an id");
    }

    const slideIdMap = new Map<string, string>();
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
          throw new Error(`Missing secondary slide ${slideId} in ${secondarySource.presentationId}`);
        }

        const targetSlideId = `generated-${slideId}`;
        slideIdMap.set(slideId, targetSlideId);

        const requests: slides_v1.Schema$Request[] = [
          {
            createSlide: {
              objectId: targetSlideId,
              insertionIndex: (primaryPresentation.data.slides ?? []).length,
            },
          },
        ];

        const textElements = extractTextElements(sourceSlide);

        for (const [textIndex, textElement] of textElements.entries()) {
          const textBoxId = `${targetSlideId}-shape-${textIndex + 1}`;
          requests.push({
            createShape: {
              objectId: textBoxId,
              shapeType: "TEXT_BOX",
              elementProperties: {
                pageObjectId: targetSlideId,
                size: textElement.size,
                transform: textElement.transform,
              },
            },
          });
          requests.push({
            insertText: {
              objectId: textBoxId,
              insertionIndex: 0,
              text: textElement.text,
            },
          });
        }

        await slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests },
        });

        primaryPresentation = await slides.presentations.get({ presentationId });
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

    await shareWithOrg({
      fileId: presentationId,
      ownerEmail: params.ownerEmail,
    });

    return {
      presentationId,
      driveUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
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

function extractTextElements(slide: slides_v1.Schema$Page): TextElementSnapshot[] {
  const textElements: TextElementSnapshot[] = [];

  for (const element of slide.pageElements ?? []) {
    const text = (element.shape?.text?.textElements ?? [])
      .map((textElement) => textElement.textRun?.content ?? "")
      .join("")
      .trim();

    if (!text) {
      continue;
    }

    textElements.push({
      text,
      size: element.size,
      transform: element.transform,
    });
  }

  return textElements;
}
