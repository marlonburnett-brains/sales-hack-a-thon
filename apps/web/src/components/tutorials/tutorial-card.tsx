"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, CheckCircle2 } from "lucide-react";
import type { TutorialBrowseCard } from "@/lib/api-client";

interface TutorialCardProps {
  tutorial: TutorialBrowseCard;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TutorialCard({ tutorial }: TutorialCardProps) {
  const { slug, title, description, durationSec, thumbnailUrl, watched } =
    tutorial;

  return (
    <Link
      href={`/tutorials/${slug}`}
      className="group block cursor-pointer rounded-lg border border-slate-200 bg-white transition-shadow duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-slate-100">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div
            data-testid="thumbnail-fallback"
            className="flex h-full w-full items-center justify-center bg-slate-200"
          >
            <Play className="h-8 w-8 text-slate-400 opacity-60" />
          </div>
        )}

        {/* Duration pill */}
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(durationSec)}
        </span>

        {/* Watched checkmark */}
        {watched && (
          <span
            data-testid="watched-checkmark"
            className="absolute left-2 top-2"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-500 drop-shadow" />
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-slate-900">
          {title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
          {description}
        </p>
      </div>
    </Link>
  );
}
