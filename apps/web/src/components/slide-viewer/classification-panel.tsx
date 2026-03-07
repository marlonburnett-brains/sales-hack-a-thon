"use client";

import { useState, useCallback, useMemo } from "react";
import { ThumbsUp, ThumbsDown, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TagEditor } from "@/components/slide-viewer/tag-editor";
import { updateSlideClassificationAction } from "@/lib/actions/slide-actions";
import type { SlideData, CorrectedTags } from "@/lib/actions/slide-actions";

interface ClassificationPanelProps {
  slide: SlideData;
  templateId: string;
  onUpdated: (slide: SlideData) => void;
  onFindSimilar?: (slideId: string) => void;
  isFindingSimilar?: boolean;
}

interface ParsedClassification {
  industries: string[];
  solutionPillars: string[];
  buyerPersonas: string[];
  funnelStages: string[];
  contentType: string;
  slideCategory: string;
  subsectors?: string[];
  touchType?: string[];
  classifiedBy?: string;
}

function parseClassification(slide: SlideData): ParsedClassification {
  // Try classificationJson first
  if (slide.classificationJson) {
    try {
      const parsed = JSON.parse(slide.classificationJson);
      return {
        industries: parsed.industries ?? (slide.industry ? [slide.industry] : []),
        solutionPillars: parsed.solutionPillars ?? (slide.solutionPillar ? [slide.solutionPillar] : []),
        buyerPersonas: parsed.buyerPersonas ?? (slide.persona ? [slide.persona] : []),
        funnelStages: parsed.funnelStages ?? (slide.funnelStage ? [slide.funnelStage] : []),
        contentType: parsed.contentType ?? slide.contentType ?? "template",
        slideCategory: parsed.slideCategory ?? "other",
        subsectors: parsed.subsectors ?? [],
        touchType: parsed.touchType ?? [],
        classifiedBy: parsed.classifiedBy,
      };
    } catch {
      // Fall through to column-based
    }
  }

  // Fallback to individual columns
  return {
    industries: slide.industry ? [slide.industry] : [],
    solutionPillars: slide.solutionPillar ? [slide.solutionPillar] : [],
    buyerPersonas: slide.persona ? [slide.persona] : [],
    funnelStages: slide.funnelStage ? [slide.funnelStage] : [],
    contentType: slide.contentType ?? "template",
    slideCategory: "other",
    subsectors: [],
    touchType: [],
  };
}

function TagChips({
  label,
  values,
  colorClasses,
}: {
  label: string;
  values: string[];
  colorClasses: string;
}) {
  if (values.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <span
            key={v}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClasses}`}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ClassificationPanel({
  slide,
  templateId,
  onUpdated,
  onFindSimilar,
  isFindingSimilar,
}: ClassificationPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const classification = useMemo(() => parseClassification(slide), [slide]);
  const confidencePercent = slide.confidence != null ? Math.round(slide.confidence) : null;

  // Reset editing mode when slide changes
  const slideId = slide.id;
  const [lastSlideId, setLastSlideId] = useState(slideId);
  if (slideId !== lastSlideId) {
    setLastSlideId(slideId);
    setIsEditing(false);
  }

  const handleApprove = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSlideClassificationAction(slide.id, templateId, {
        reviewStatus: "approved",
      });
      toast.success("Classification approved");
      onUpdated({
        ...slide,
        reviewStatus: "approved",
        needsReReview: false,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve"
      );
    } finally {
      setIsSaving(false);
    }
  }, [slide, templateId, onUpdated]);

  const handleReject = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleSaveCorrections = useCallback(
    async (tags: CorrectedTags) => {
      setIsSaving(true);
      try {
        await updateSlideClassificationAction(slide.id, templateId, {
          reviewStatus: "needs_correction",
          correctedTags: tags,
        });
        toast.success("Corrections saved");
        onUpdated({
          ...slide,
          reviewStatus: "needs_correction",
          needsReReview: false,
          classificationJson: JSON.stringify(tags),
          industry: tags.industries[0] ?? null,
          solutionPillar: tags.solutionPillars[0] ?? null,
          persona: tags.buyerPersonas[0] ?? null,
          funnelStage: tags.funnelStages[0] ?? null,
          contentType: tags.contentType,
        });
        setIsEditing(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save corrections"
        );
      } finally {
        setIsSaving(false);
      }
    },
    [slide, templateId, onUpdated]
  );

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <div className="space-y-4 p-4">
      {/* Rating buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant={slide.reviewStatus === "approved" ? "default" : "outline"}
          size="sm"
          className={`cursor-pointer ${
            slide.reviewStatus === "approved"
              ? "bg-green-600 text-white hover:bg-green-700"
              : "hover:border-green-300 hover:text-green-600"
          }`}
          onClick={handleApprove}
          disabled={isSaving}
          aria-label="Approve classification"
        >
          <ThumbsUp className="mr-1.5 h-4 w-4" />
          Approve
        </Button>
        <Button
          variant={
            slide.reviewStatus === "needs_correction" || isEditing
              ? "default"
              : "outline"
          }
          size="sm"
          className={`cursor-pointer ${
            slide.reviewStatus === "needs_correction" || isEditing
              ? "bg-red-600 text-white hover:bg-red-700"
              : "hover:border-red-300 hover:text-red-600"
          }`}
          onClick={handleReject}
          disabled={isSaving}
          aria-label="Reject classification and edit tags"
        >
          <ThumbsDown className="mr-1.5 h-4 w-4" />
          Correct
        </Button>

        {/* Status badge */}
        <span
          className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            slide.reviewStatus === "approved"
              ? "bg-green-50 text-green-700"
              : slide.reviewStatus === "needs_correction"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {slide.reviewStatus === "approved"
            ? "Approved"
            : slide.reviewStatus === "needs_correction"
              ? "Corrected"
              : "Unreviewed"}
        </span>
      </div>

      {/* Confidence + Model */}
      <div className="flex items-center gap-2">
        {confidencePercent != null && (
          <div className="flex-1 space-y-1">
            <p className="text-xs text-slate-500">
              {confidencePercent}% confident
            </p>
            <Progress value={confidencePercent} className="h-1.5" />
          </div>
        )}
        {classification.classifiedBy && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              classification.classifiedBy === "gpt-oss"
                ? "bg-violet-100 text-violet-700 border border-violet-200"
                : "bg-sky-100 text-sky-700 border border-sky-200"
            }`}
          >
            {classification.classifiedBy}
          </span>
        )}
      </div>

      {/* Tags display or editor */}
      {isEditing ? (
        <TagEditor
          currentTags={classification}
          onSave={handleSaveCorrections}
          onCancel={handleCancelEdit}
          isSaving={isSaving}
        />
      ) : (
        <div className="space-y-3">
          <TagChips
            label="Industry"
            values={classification.industries}
            colorClasses="border-blue-200 bg-blue-50 text-blue-700"
          />
          <TagChips
            label="Solution Pillar"
            values={classification.solutionPillars}
            colorClasses="border-purple-200 bg-purple-50 text-purple-700"
          />
          <TagChips
            label="Buyer Persona"
            values={classification.buyerPersonas}
            colorClasses="border-green-200 bg-green-50 text-green-700"
          />
          <TagChips
            label="Funnel Stage"
            values={classification.funnelStages}
            colorClasses="border-amber-200 bg-amber-50 text-amber-700"
          />
          <TagChips
            label="Content Type"
            values={[classification.contentType]}
            colorClasses="border-slate-200 bg-slate-100 text-slate-700"
          />
          <TagChips
            label="Slide Category"
            values={[classification.slideCategory]}
            colorClasses="border-indigo-200 bg-indigo-50 text-indigo-700"
          />
        </div>
      )}

      {/* Find Similar button */}
      {onFindSimilar && (
        <div className="border-t border-slate-200 pt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer gap-1.5"
            onClick={() => onFindSimilar(slide.id)}
            disabled={isFindingSimilar}
          >
            <Search className="h-3.5 w-3.5" />
            {isFindingSimilar ? "Searching..." : "Find Similar"}
          </Button>
        </div>
      )}
    </div>
  );
}
