"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DeckSectionData } from "@/lib/api-client";

interface SectionFlowProps {
  sections: DeckSectionData[];
  slideIdToThumbnail?: Record<string, string>;
  diff?: { added: string[]; modified: string[] };
}

export function SectionFlow({
  sections,
  slideIdToThumbnail,
  diff,
}: SectionFlowProps) {
  const [animating, setAnimating] = useState(true);

  // Clear animation after 3 seconds
  useEffect(() => {
    if (diff && (diff.added.length > 0 || diff.modified.length > 0)) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 3000);
      return () => clearTimeout(timer);
    }
    setAnimating(false);
  }, [diff]);

  if (sections.length === 0) {
    return (
      <p className="py-4 text-sm text-slate-400">
        No sections inferred yet. Classify more examples to improve accuracy.
      </p>
    );
  }

  const sorted = [...sections].sort((a, b) => a.order - b.order);

  return (
    <div className="relative space-y-0">
      {sorted.map((section, idx) => {
        const isAdded = diff?.added.includes(section.name) ?? false;
        const isModified = diff?.modified.includes(section.name) ?? false;
        const showPulse = animating && (isAdded || isModified);

        return (
          <div key={section.name} className="relative flex items-start gap-4">
            {/* Vertical connecting line */}
            {idx < sorted.length - 1 && (
              <div
                className="absolute left-4 top-10 h-[calc(100%-1rem)] w-0.5 bg-slate-200"
                aria-hidden
              />
            )}

            {/* Numbered circle */}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {section.order}
            </div>

            {/* Section card */}
            <div
              className={cn(
                "mb-3 flex-1 rounded-lg border border-slate-200 bg-white p-3",
                isAdded && "ring-2 ring-green-400 bg-green-50",
                isModified && "ring-2 ring-amber-400 bg-amber-50",
                showPulse && "animate-pulse",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">
                  {section.name}
                </span>
                {section.isOptional && (
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {section.purpose}
              </p>
              <div className="mt-1 flex items-center gap-4">
                <span className="text-xs text-slate-400">
                  {section.variationCount} variation
                  {section.variationCount !== 1 ? "s" : ""}
                </span>

                {/* Reference slide thumbnails */}
                {section.slideIds.length > 0 && slideIdToThumbnail && (
                  <div className="flex items-center gap-1">
                    {section.slideIds.slice(0, 4).map((slideId) => {
                      const url = slideIdToThumbnail[slideId];
                      return url ? (
                        <img
                          key={slideId}
                          src={url}
                          alt={`Reference slide for ${section.name}`}
                          className="h-12 w-16 rounded border border-slate-200 object-cover"
                        />
                      ) : null;
                    })}
                    {section.slideIds.length > 4 && (
                      <span className="text-xs text-slate-400">
                        +{section.slideIds.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
