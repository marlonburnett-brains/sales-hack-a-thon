"use server";

import type { ArtifactType } from "@lumenalta/schemas";

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
  artifactType?: ArtifactType | null,
): Promise<DeckStructureDetail> {
  return getDeckStructure(touchType, artifactType);
}

export async function triggerInferenceAction(
  touchType: string,
  artifactType?: ArtifactType | null,
): Promise<{ touchType: string; structure: unknown; confidence: number }> {
  return triggerDeckInference(touchType, artifactType);
}
