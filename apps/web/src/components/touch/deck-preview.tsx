"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from "lucide-react";

interface DeckPreviewProps {
  presentationId: string;
  /** Increment to force a thumbnail re-fetch (e.g. after Visual QA corrections). */
  refreshKey?: number;
}

interface Thumbnail {
  slideIndex: number;
  slideObjectId: string;
  thumbnailUrl: string;
}

const POLL_INTERVAL = 3000;
const MAX_POLLS = 20;

export function DeckPreview({ presentationId, refreshKey = 0 }: DeckPreviewProps) {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  const fetchThumbnails = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/presentations/${presentationId}/thumbnails`,
      );
      if (!res.ok) return false;
      const data = await res.json();

      if (data.thumbnails?.length > 0) {
        setThumbnails(data.thumbnails);
        setLoading(false);
      }

      // Keep polling while backend says caching is still in progress
      if (data.caching) return false;

      // Caching complete (or nothing to cache)
      setLoading(false);
      return true;
    } catch {
      return false;
    }
  }, [presentationId]);

  // Reset polling when refreshKey changes (e.g. after Visual QA corrections)
  useEffect(() => {
    setPollCount(0);
    setLoading(true);
  }, [refreshKey]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function poll() {
      const done = await fetchThumbnails();
      if (!cancelled && !done && pollCount < MAX_POLLS) {
        setPollCount((c) => c + 1);
        timer = setTimeout(poll, POLL_INTERVAL);
      } else if (!done) {
        setLoading(false);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchThumbnails, pollCount, refreshKey]);

  const driveUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

  if (loading) {
    return (
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border">
        <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating slide previews...
          </div>
        </div>
      </div>
    );
  }

  if (thumbnails.length === 0) {
    return (
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-muted">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">
            Preview not available
          </p>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={driveUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Google Slides
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-black">
        <img
          src={thumbnails[currentSlide].thumbnailUrl}
          alt={`Slide ${currentSlide + 1}`}
          className="h-full w-full object-contain"
        />

        {thumbnails.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
              onClick={() =>
                setCurrentSlide((c) =>
                  c === 0 ? thumbnails.length - 1 : c - 1,
                )
              }
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
              onClick={() =>
                setCurrentSlide((c) =>
                  c === thumbnails.length - 1 ? 0 : c + 1,
                )
              }
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
          {currentSlide + 1} / {thumbnails.length}
        </div>
      </div>
    </div>
  );
}
