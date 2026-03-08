"use client";

import { ARTIFACT_TYPE_LABELS, type ArtifactType } from "@lumenalta/schemas";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Layers, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "./confidence-badge";
import { SectionFlow } from "./section-flow";
import { ChatBar } from "./chat-bar";
import { getDeckStructureAction } from "@/lib/actions/deck-structure-actions";
import type { DeckStructureDetail, DeckSectionData } from "@/lib/api-client";

interface TouchTypeDetailViewProps {
  touchType: string;
  label: string;
  artifactType?: ArtifactType;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

export function TouchTypeDetailView({
  touchType,
  label,
  artifactType,
  emptyStateTitle,
  emptyStateDescription,
}: TouchTypeDetailViewProps) {
  const [structure, setStructure] = useState<DeckStructureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localSections, setLocalSections] = useState<DeckSectionData[]>([]);
  const [localRationale, setLocalRationale] = useState("");
  const [slideIdToThumbnail, setSlideIdToThumbnail] = useState<
    Record<string, string>
  >({});
  const [diff, setDiff] = useState<
    { added: string[]; modified: string[] } | undefined
  >();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const detail = await getDeckStructureAction(touchType, artifactType);
      setStructure(detail);
      setLocalSections(detail.structure.sections);
      setLocalRationale(detail.structure.sequenceRationale);
      setSlideIdToThumbnail(detail.slideIdToThumbnail ?? {});
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load deck structure";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [artifactType, touchType]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStructureUpdate = useCallback(
    (
      newStructure: { sections: DeckSectionData[]; sequenceRationale: string },
      newDiff: { added: string[]; modified: string[] },
    ) => {
      setStructure((prev) =>
        prev
          ? {
              ...prev,
              structure: newStructure,
            }
          : prev,
      );
      setLocalSections(newStructure.sections);
      setLocalRationale(newStructure.sequenceRationale);
      setDiff(newDiff);
      setTimeout(() => setDiff(undefined), 3000);
    },
    [],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
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

  const hasData = structure && structure.exampleCount > 0;
  const artifactLabel = artifactType ? ARTIFACT_TYPE_LABELS[artifactType] : label;
  const isTouch4Artifact = touchType === "touch_4" && Boolean(artifactType);
  const resolvedEmptyStateTitle =
    emptyStateTitle ?? `No ${artifactLabel} examples classified yet`;
  const resolvedEmptyStateDescription =
    emptyStateDescription ??
    (isTouch4Artifact
      ? `Classify ${artifactLabel} examples on Templates to improve this structure.`
      : "Classify presentations as examples and assign touch types on the Templates page to enable AI inference.");
  const effectiveSections = localSections;
  const effectiveRationale = localRationale;

  if (!hasData) {
    return (
      <div>
        {/* Confidence */}
        {structure && (
          <div className="mb-6">
            <ConfidenceBadge
              score={structure.confidence}
              exampleCount={structure.exampleCount}
              color={structure.confidenceColor}
              label={structure.confidenceLabel}
            />
          </div>
        )}

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-16 text-center">
          <Layers className="mb-3 h-12 w-12 text-slate-300" />
          <h3 className="text-base font-medium text-slate-900">
            {resolvedEmptyStateTitle}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {resolvedEmptyStateDescription}
          </p>
          <Link
            href="/templates"
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            Go to Templates
          </Link>
        </div>

        {/* Disabled chat */}
        <div className="mt-4">
          <ChatBar
            touchType={touchType}
            artifactType={artifactType}
            onStructureUpdate={handleStructureUpdate}
            disabled={!isTouch4Artifact}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Confidence badge */}
      <div className="mb-6">
        <ConfidenceBadge
          score={structure.confidence}
          exampleCount={structure.exampleCount}
          color={structure.confidenceColor}
          label={structure.confidenceLabel}
        />
      </div>

      {/* Section flow */}
      <SectionFlow
        sections={effectiveSections}
        slideIdToThumbnail={slideIdToThumbnail}
        diff={diff}
      />

      {/* Sequence rationale */}
      {effectiveRationale && (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600 italic">
          {effectiveRationale}
        </div>
      )}

      {/* Chat bar */}
      <div className="mt-6">
        <ChatBar
          touchType={touchType}
          artifactType={artifactType}
          onStructureUpdate={handleStructureUpdate}
          initialMessages={structure.chatMessages}
        />
      </div>
    </div>
  );
}
