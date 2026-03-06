"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { SimilarSlide } from "@/lib/actions/slide-actions";

interface SimilarityResultsProps {
  results: SimilarSlide[];
  sourceSlideId: string;
  thumbnails: Map<string, string>;
  templateNames: Map<string, string>;
  onClose: () => void;
  isLoading: boolean;
}

function getSimilarityColor(similarity: number): string {
  const pct = similarity * 100;
  if (pct >= 80) return "text-green-600";
  if (pct >= 60) return "text-amber-600";
  return "text-slate-500";
}

function parseClassificationTags(json: string | null) {
  if (!json) return { industry: null, pillar: null };
  try {
    const parsed = JSON.parse(json);
    return {
      industry: parsed.industries?.[0] ?? null,
      pillar: parsed.solutionPillars?.[0] ?? null,
    };
  } catch {
    return { industry: null, pillar: null };
  }
}

export function SimilarityResults({
  results,
  sourceSlideId,
  thumbnails,
  templateNames,
  onClose,
  isLoading,
}: SimilarityResultsProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Similar Slides</DialogTitle>
          <DialogDescription>
            Slides ranked by content similarity
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <Skeleton className="aspect-video w-full rounded" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <p className="text-sm text-slate-500">No similar slides found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {results.map((result) => {
              const thumbUrl = result.slideObjectId
                ? thumbnails.get(result.slideObjectId)
                : undefined;
              const templateName =
                templateNames.get(result.templateId) ?? "Unknown Template";
              const tags = parseClassificationTags(result.classificationJson);
              const similarityPct = Math.round(result.similarity * 100);

              return (
                <Link
                  key={result.id}
                  href={`/templates/${result.templateId}/slides`}
                  onClick={onClose}
                  className="group cursor-pointer rounded-lg border border-slate-200 p-3 transition-shadow duration-200 hover:shadow-md"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video w-full overflow-hidden rounded bg-slate-100">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Slide ${result.slideIndex + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No preview
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">
                        Slide {result.slideIndex + 1}
                      </span>
                      <span
                        className={`text-sm font-semibold ${getSimilarityColor(result.similarity)}`}
                      >
                        {similarityPct}%
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">{templateName}</p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {tags.industry && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          {tags.industry}
                        </span>
                      )}
                      {tags.pillar && (
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                          {tags.pillar}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
