/**
 * Multi-Source Assembler Planning Helpers
 *
 * Phase 52 Plan 01 implements the pure planning layer for multi-source deck
 * assembly. It converts a SlideSelectionPlan into a MultiSourcePlan and keeps
 * the single-source execution path delegated to the existing copy-and-prune
 * assembler. Full multi-source Google API orchestration lands in Plan 02.
 */

import type { SlideSelectionEntry, SlideSelectionPlan } from "@lumenalta/schemas";
import {
  assembleDeckFromSlides,
  type AssembleDeckResult,
} from "../lib/deck-customizer";
import type { MultiSourcePlan, SecondarySource } from "./types";

export interface AssembleMultiSourceParams {
  plan: MultiSourcePlan;
  targetFolderId: string;
  deckName: string;
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

  throw new Error("Not implemented");
}
