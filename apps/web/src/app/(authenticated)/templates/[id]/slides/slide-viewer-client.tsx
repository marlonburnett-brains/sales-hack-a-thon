"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlidePreview } from "@/components/slide-viewer/slide-preview";
import { ThumbnailStrip } from "@/components/slide-viewer/thumbnail-strip";
import { ClassificationPanel } from "@/components/slide-viewer/classification-panel";
import { ElementMapPanel } from "@/components/slide-viewer/element-map-panel";
import { SimilarityResults } from "@/components/slide-viewer/similarity-results";
import { findSimilarSlidesAction, getSlideThumbnailsAction } from "@/lib/actions/slide-actions";
import type {
  SlideData,
  SlideThumbnail,
  SimilarSlide,
} from "@/lib/actions/slide-actions";

interface SlideViewerClientProps {
  templateId: string;
  templateName: string;
  initialSlides: SlideData[];
  initialThumbnails: SlideThumbnail[];
}

export function SlideViewerClient({
  templateId,
  templateName,
  initialSlides,
  initialThumbnails,
}: SlideViewerClientProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>(initialSlides);
  const [thumbnails, setThumbnails] = useState<SlideThumbnail[]>(initialThumbnails);
  const [isCaching, setIsCaching] = useState(
    initialThumbnails.some((t) => !t.thumbnailUrl)
  );
  const [similarResults, setSimilarResults] = useState<SimilarSlide[] | null>(
    null
  );
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const [searchingSlideId, setSearchingSlideId] = useState<string | null>(null);

  // Poll for thumbnails while caching is in progress
  useEffect(() => {
    if (!isCaching) return;
    const interval = setInterval(async () => {
      try {
        const result = await getSlideThumbnailsAction(templateId);
        setThumbnails(result.thumbnails);
        if (!result.caching) {
          setIsCaching(false);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isCaching, templateId]);

  // Build a map from slideIndex to thumbnailUrl
  const thumbnailMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of thumbnails) {
      if (t.thumbnailUrl) map.set(t.slideIndex, t.thumbnailUrl);
    }
    return map;
  }, [thumbnails]);

  // Sorted thumbnails for the strip
  const sortedThumbnails = useMemo(
    () =>
      thumbnails
        .slice()
        .sort((a, b) => a.slideIndex - b.slideIndex)
        .map((t) => ({
          slideIndex: t.slideIndex,
          thumbnailUrl: t.thumbnailUrl,
        })),
    [thumbnails]
  );

  const currentSlide = slides[currentIndex] ?? null;
  const totalSlides = slides.length;

  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSlides) {
        setCurrentIndex(index);
      }
    },
    [totalSlides]
  );

  const goPrev = useCallback(
    () => goToSlide(currentIndex - 1),
    [currentIndex, goToSlide]
  );
  const goNext = useCallback(
    () => goToSlide(currentIndex + 1),
    [currentIndex, goToSlide]
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext]);

  const handleSlideUpdated = useCallback((updatedSlide: SlideData) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === updatedSlide.id ? updatedSlide : s))
    );
  }, []);

  // Find Similar handler
  const handleFindSimilar = useCallback(async (slideId: string) => {
    setSearchingSlideId(slideId);
    setIsFindingSimilar(true);
    setSimilarResults([]);
    try {
      const { results } = await findSimilarSlidesAction(slideId, 8);
      setSimilarResults(results);
    } catch {
      setSimilarResults([]);
    } finally {
      setIsFindingSimilar(false);
    }
  }, []);

  const closeSimilarity = useCallback(() => {
    setSimilarResults(null);
    setSearchingSlideId(null);
  }, []);

  // Build a slideObjectId -> thumbnailUrl map for SimilarityResults
  const thumbnailObjectIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of thumbnails) {
      if (t.thumbnailUrl) map.set(t.slideObjectId, t.thumbnailUrl);
    }
    return map;
  }, [thumbnails]);

  // Template names map (only this template in per-template viewer)
  const templateNamesMap = useMemo(
    () => new Map([[templateId, templateName]]),
    [templateId, templateName]
  );

  const currentThumbnailUrl = currentSlide
    ? thumbnailMap.get(currentSlide.slideIndex)
    : undefined;

  const thumbnailCurrentIndex = currentSlide?.slideIndex ?? 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          <Link
            href="/templates"
            className="text-slate-500 hover:text-slate-900 transition-colors"
          >
            Templates
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-slate-900 truncate max-w-[300px]">
            {templateName}
          </span>
        </nav>
        <span className="text-xs text-slate-500">
          {currentIndex + 1} of {totalSlides}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex flex-1 items-center justify-center bg-slate-100 p-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 z-10 h-10 w-10 cursor-pointer rounded-full bg-white/80 shadow-sm hover:bg-white"
            onClick={goPrev}
            disabled={currentIndex === 0}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <SlidePreview
            thumbnailUrl={currentThumbnailUrl}
            slideIndex={currentSlide?.slideIndex ?? 0}
            isLoading={!currentSlide}
          />

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 z-10 h-10 w-10 cursor-pointer rounded-full bg-white/80 shadow-sm hover:bg-white"
            onClick={goNext}
            disabled={currentIndex === totalSlides - 1}
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          {currentSlide && (
            <>
              <ClassificationPanel
                slide={currentSlide}
                templateId={templateId}
                onUpdated={handleSlideUpdated}
                onFindSimilar={handleFindSimilar}
                isFindingSimilar={isFindingSimilar}
              />
              <div className="px-4 pb-4">
                <ElementMapPanel elements={currentSlide.elements ?? []} />
              </div>
            </>
          )}
        </div>
      </div>

      <ThumbnailStrip
        thumbnails={sortedThumbnails}
        currentIndex={thumbnailCurrentIndex}
        onSelect={(slideIndex) => {
          const arrayIndex = slides.findIndex(
            (s) => s.slideIndex === slideIndex
          );
          if (arrayIndex >= 0) {
            setCurrentIndex(arrayIndex);
          }
        }}
      />

      {/* Similarity Results Dialog */}
      {similarResults !== null && (
        <SimilarityResults
          results={similarResults}
          sourceSlideId={searchingSlideId ?? ""}
          thumbnails={thumbnailObjectIdMap}
          templateNames={templateNamesMap}
          onClose={closeSimilarity}
          isLoading={isFindingSimilar}
        />
      )}
    </div>
  );
}
