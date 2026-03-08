"use client";

import {
  ARTIFACT_TYPE_LABELS,
  type ArtifactType,
  TOUCH_TYPES,
} from "@lumenalta/schemas";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

/** Touch types that produce slide decks (excludes pre_call which is a text/research artifact) */
const DECK_TOUCH_TYPES = TOUCH_TYPES.filter((tt) => tt !== "pre_call");
import { Accordion } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TouchTypeAccordion } from "./touch-type-accordion";
import {
  getDeckStructuresAction,
  getDeckStructureAction,
  type DeckStructureSummary,
} from "@/lib/actions/deck-structure-actions";
import type { DeckStructureDetail } from "@/lib/api-client";

const TOUCH_TYPE_LABELS: Record<string, string> = {
  touch_1: "Touch 1",
  touch_2: "Touch 2",
  touch_3: "Touch 3",
  touch_4: "Touch 4",
  pre_call: "Pre-Call",
};

interface LegacyDeckStructureRow {
  key: string;
  touchType: string;
  artifactType?: ArtifactType;
  label: string;
}

function getStructureKey(touchType: string, artifactType?: ArtifactType): string {
  return artifactType ? `${touchType}:${artifactType}` : touchType;
}

function getRowLabel(summary: DeckStructureSummary): string {
  if (summary.touchType === "touch_4" && summary.artifactType) {
    return ARTIFACT_TYPE_LABELS[summary.artifactType];
  }

  return TOUCH_TYPE_LABELS[summary.touchType] ?? summary.touchType;
}

export function DeckStructureView() {
  const [structures, setStructures] = useState<
    Record<string, DeckStructureDetail>
  >({});
  const [rows, setRows] = useState<LegacyDeckStructureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First load summaries to know which touch types exist
      const summaries = (await getDeckStructuresAction()).filter(
        (summary) => summary.touchType !== "pre_call",
      );
      setRows(
        summaries.map((summary) => ({
          key: getStructureKey(summary.touchType, summary.artifactType ?? undefined),
          touchType: summary.touchType,
          artifactType: summary.artifactType ?? undefined,
          label: getRowLabel(summary),
        })),
      );

      // Then load details for each touch type in parallel
      const detailPromises = summaries.map(async (summary) => {
        try {
          const artifactType = summary.artifactType ?? undefined;
          const detail = await getDeckStructureAction(summary.touchType, artifactType);
          return {
            key: getStructureKey(summary.touchType, artifactType),
            detail,
          };
        } catch {
          // Return a placeholder on individual failure
          return {
            key: getStructureKey(summary.touchType, summary.artifactType ?? undefined),
            detail: {
              touchType: summary.touchType,
              artifactType: summary.artifactType,
              structure: { sections: [], sequenceRationale: "" },
              exampleCount: summary.exampleCount,
              confidence: summary.confidence,
              confidenceColor: summary.confidenceColor,
              confidenceLabel: summary.confidenceLabel,
              chatMessages: [],
              chatContext: null,
              slideIdToThumbnail: {},
              inferredAt: summary.inferredAt,
              lastChatAt: summary.lastChatAt,
            } as DeckStructureDetail,
          };
        }
      });

      const results = await Promise.all(detailPromises);
      const structMap: Record<string, DeckStructureDetail> = {};
      for (const r of results) {
        structMap[r.key] = r.detail;
      }
      setStructures(structMap);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load deck structures";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4">
        {DECK_TOUCH_TYPES.map((tt) => (
          <div key={tt} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          className="mt-2"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Accordion
      type="multiple"
      defaultValue={rows.map((row) => row.key)}
      className="space-y-2"
    >
      {rows.map((row) => (
        <TouchTypeAccordion
          key={row.key}
          value={row.key}
          touchType={row.touchType}
          artifactType={row.artifactType}
          label={row.label}
          structure={structures[row.key] ?? null}
          slideIdToThumbnail={structures[row.key]?.slideIdToThumbnail ?? {}}
        />
      ))}
    </Accordion>
  );
}
