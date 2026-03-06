"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { findSimilarSlidesAction } from "@/lib/actions/slide-actions";
import type { SlideThumbnail, SimilarSlide } from "@/lib/actions/slide-actions";
import { SimilarityResults } from "@/components/slide-viewer/similarity-results";
import type { EnrichedSlide } from "./page";

const SLIDES_PER_PAGE = 20;

type FilterType = "all" | "unreviewed" | "approved" | "needs_correction";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unreviewed", label: "Unreviewed" },
  { value: "approved", label: "Approved" },
  { value: "needs_correction", label: "Needs Correction" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
          Approved
        </Badge>
      );
    case "needs_correction":
      return (
        <Badge className="border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
          Needs Correction
        </Badge>
      );
    default:
      return (
        <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
          Unreviewed
        </Badge>
      );
  }
}

interface SlideLibraryClientProps {
  slides: EnrichedSlide[];
  thumbnails: SlideThumbnail[];
  templateNames: Record<string, string>;
}

export function SlideLibraryClient({
  slides,
  thumbnails,
  templateNames,
}: SlideLibraryClientProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(0);
  const [similarResults, setSimilarResults] = useState<SimilarSlide[] | null>(
    null
  );
  const [searchingSlideId, setSearchingSlideId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Build thumbnail lookup map
  const thumbnailMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of thumbnails) {
      map.set(t.slideObjectId, t.thumbnailUrl);
    }
    return map;
  }, [thumbnails]);

  // Build template names map for SimilarityResults
  const templateNamesMap = useMemo(
    () => new Map(Object.entries(templateNames)),
    [templateNames]
  );

  // Filter and sort slides
  const filteredSlides = useMemo(() => {
    let result = slides;
    if (filter !== "all") {
      result = result.filter((s) => s.reviewStatus === filter);
    }
    return result.sort((a, b) => {
      const nameCompare = a.templateName.localeCompare(b.templateName);
      if (nameCompare !== 0) return nameCompare;
      return a.slideIndex - b.slideIndex;
    });
  }, [slides, filter]);

  // Count per filter
  const counts = useMemo(() => {
    const c = { all: slides.length, unreviewed: 0, approved: 0, needs_correction: 0 };
    for (const s of slides) {
      if (s.reviewStatus === "approved") c.approved++;
      else if (s.reviewStatus === "needs_correction") c.needs_correction++;
      else c.unreviewed++;
    }
    return c;
  }, [slides]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSlides.length / SLIDES_PER_PAGE));
  const pageSlides = filteredSlides.slice(
    page * SLIDES_PER_PAGE,
    (page + 1) * SLIDES_PER_PAGE
  );

  // Reset page when filter changes
  function handleFilterChange(newFilter: FilterType) {
    setFilter(newFilter);
    setPage(0);
  }

  async function handleFindSimilar(slideId: string) {
    setSearchingSlideId(slideId);
    setIsSearching(true);
    setSimilarResults([]);
    try {
      const { results } = await findSimilarSlidesAction(slideId, 8);
      setSimilarResults(results);
    } catch {
      setSimilarResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function closeSimilarity() {
    setSimilarResults(null);
    setSearchingSlideId(null);
  }

  // Parse classification for display
  function parseClassification(slide: EnrichedSlide) {
    if (slide.classificationJson) {
      try {
        const parsed = JSON.parse(slide.classificationJson);
        return {
          industry: parsed.industries?.[0] ?? slide.industry,
          pillar: parsed.solutionPillars?.[0] ?? slide.solutionPillar,
        };
      } catch {
        // fall through
      }
    }
    return {
      industry: slide.industry,
      pillar: slide.solutionPillar,
    };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Slide Library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Browse and search all ingested slides
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleFilterChange(opt.value)}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              filter === opt.value
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {opt.label}{" "}
            <span className="ml-1 opacity-70">
              {counts[opt.value]}
            </span>
          </button>
        ))}
      </div>

      {/* Slide grid */}
      {pageSlides.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-slate-500">No slides match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {pageSlides.map((slide) => {
            const thumbUrl = slide.slideObjectId
              ? thumbnailMap.get(slide.slideObjectId)
              : undefined;
            const classification = parseClassification(slide);

            return (
              <div
                key={slide.id}
                className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                {/* Thumbnail */}
                <Link
                  href={`/templates/${slide.templateId}/slides`}
                  className="block aspect-video w-full overflow-hidden bg-slate-100"
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={`Slide ${slide.slideIndex + 1}`}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      No preview
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Slide {slide.slideIndex + 1}
                    </span>
                    {getStatusBadge(slide.reviewStatus)}
                  </div>

                  <Link
                    href={`/templates/${slide.templateId}/slides`}
                    className="text-sm font-medium text-slate-900 hover:text-blue-600"
                  >
                    {slide.templateName}
                  </Link>

                  {/* Confidence */}
                  {slide.confidence != null && (
                    <span className="text-xs text-slate-500">
                      {Math.round(slide.confidence)}% confidence
                    </span>
                  )}

                  {/* Classification chips */}
                  <div className="flex flex-wrap gap-1">
                    {classification.industry && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {classification.industry}
                      </span>
                    )}
                    {classification.pillar && (
                      <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        {classification.pillar}
                      </span>
                    )}
                  </div>

                  {/* Find Similar button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-auto w-full cursor-pointer justify-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleFindSimilar(slide.id);
                    }}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Find Similar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Similarity Results Dialog */}
      {similarResults !== null && (
        <SimilarityResults
          results={similarResults}
          sourceSlideId={searchingSlideId ?? ""}
          thumbnails={thumbnailMap}
          templateNames={templateNamesMap}
          onClose={closeSimilarity}
          isLoading={isSearching}
        />
      )}
    </div>
  );
}
