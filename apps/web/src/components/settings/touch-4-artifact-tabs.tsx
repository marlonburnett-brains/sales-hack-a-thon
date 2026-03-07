"use client";

import { ARTIFACT_TYPES, ARTIFACT_TYPE_LABELS, type ArtifactType } from "@lumenalta/schemas";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TouchTypeDetailView } from "@/components/settings/touch-type-detail-view";
import {
  getDeckStructureAction,
  getDeckStructuresAction,
  type DeckStructureSummary,
} from "@/lib/actions/deck-structure-actions";
import { cn } from "@/lib/utils";

interface Touch4ArtifactTabsProps {
  touchType: string;
  label: string;
}

type SummaryMap = Partial<Record<ArtifactType, DeckStructureSummary>>;

const DetailView = TouchTypeDetailView as unknown as (props: {
  touchType: string;
  label: string;
  artifactType?: ArtifactType;
}) => JSX.Element;

export function Touch4ArtifactTabs({
  touchType,
  label,
}: Touch4ArtifactTabsProps) {
  const [activeArtifact, setActiveArtifact] = useState<ArtifactType>("proposal");
  const [summaries, setSummaries] = useState<SummaryMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedArtifacts, setLoadedArtifacts] = useState<Partial<Record<ArtifactType, true>>>({});

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const allSummaries = await getDeckStructuresAction();
      const nextSummaries = allSummaries.reduce<SummaryMap>((acc, summary) => {
        if (
          summary.touchType === touchType &&
          summary.artifactType &&
          ARTIFACT_TYPES.includes(summary.artifactType as ArtifactType)
        ) {
          acc[summary.artifactType as ArtifactType] = summary;
        }
        return acc;
      }, {});

      setSummaries(nextSummaries);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load Touch 4 artifact summaries",
      );
    } finally {
      setLoading(false);
    }
  }, [touchType]);

  const ensureArtifactLoaded = useCallback(
    async (artifactType: ArtifactType) => {
      if (loadedArtifacts[artifactType]) {
        return;
      }

      await getDeckStructureAction(touchType, artifactType);
      setLoadedArtifacts((prev) => ({ ...prev, [artifactType]: true }));
    },
    [loadedArtifacts, touchType],
  );

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  useEffect(() => {
    if (loading || error) {
      return;
    }

    void ensureArtifactLoaded(activeArtifact);
  }, [activeArtifact, ensureArtifactLoaded, error, loading]);

  const artifactItems = useMemo(
    () =>
      ARTIFACT_TYPES.map((artifactType) => ({
        artifactType,
        label: ARTIFACT_TYPE_LABELS[artifactType],
        summary: summaries[artifactType],
      })),
    [summaries],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void loadSummaries()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Tabs
      value={activeArtifact}
      onValueChange={(value) => setActiveArtifact(value as ArtifactType)}
      className="space-y-6"
    >
      <TabsList
        aria-label="Touch 4 artifact types"
        className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3"
      >
        {artifactItems.map(({ artifactType, label: artifactLabel, summary }) => {
          const isLowConfidence = summary?.confidenceColor === "red";
          const exampleCount = summary?.exampleCount ?? 0;

          return (
            <TabsTrigger
              key={artifactType}
              value={artifactType}
              className={cn(
                "flex h-auto min-h-24 flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm",
                "data-[state=active]:border-slate-900 data-[state=active]:bg-slate-50 data-[state=active]:shadow-sm",
              )}
            >
              <span className="text-sm font-semibold text-slate-900">{artifactLabel}</span>
              <span className="text-xs text-slate-600">
                {summary?.confidenceLabel ?? "Not inferred yet"}
                {isLowConfidence ? " - needs more examples" : ""}
              </span>
              <span className="text-xs text-slate-500">
                {exampleCount} {exampleCount === 1 ? "example" : "examples"}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {artifactItems.map(({ artifactType }) => (
        <TabsContent key={artifactType} value={artifactType} className="mt-0">
          <DetailView
            touchType={touchType}
            label={label}
            artifactType={artifactType}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
