"use server";

import {
  getDeckStructures,
  getDeckStructure,
  triggerDeckInference,
} from "@/lib/api-client";
import type {
  DeckStructureSummary,
  DeckStructureDetail,
} from "@/lib/api-client";

export type { DeckStructureSummary, DeckStructureDetail };

export async function getDeckStructuresAction(): Promise<DeckStructureSummary[]> {
  return getDeckStructures();
}

export async function getDeckStructureAction(
  touchType: string,
): Promise<DeckStructureDetail> {
  return getDeckStructure(touchType);
}

export async function triggerInferenceAction(
  touchType: string,
): Promise<{ touchType: string; structure: unknown; confidence: number }> {
  return triggerDeckInference(touchType);
}
