"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface DeckPreviewProps {
  presentationId: string;
}

export function DeckPreview({ presentationId }: DeckPreviewProps) {
  const [loading, setLoading] = useState(true);
  const previewUrl = `https://docs.google.com/presentation/d/${presentationId}/preview`;

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border">
      {loading && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-lg" />
      )}
      <iframe
        src={previewUrl}
        className="h-full w-full"
        allowFullScreen
        title="Generated deck preview"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
