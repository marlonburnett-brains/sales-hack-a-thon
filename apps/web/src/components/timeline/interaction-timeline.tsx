import { FileText } from "lucide-react";
import { TimelineEntry } from "./timeline-entry";
import type { InteractionRecord } from "@/lib/api-client";

interface InteractionTimelineProps {
  interactions: InteractionRecord[];
}

export function InteractionTimeline({
  interactions,
}: InteractionTimelineProps) {
  if (interactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-12">
        <FileText className="h-10 w-10 text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">No interactions yet</p>
        <p className="text-xs text-slate-400">
          Generate an asset to see it appear here.
        </p>
      </div>
    );
  }

  // Sort by createdAt descending (most recent first)
  const sorted = [...interactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-3">
      {sorted.map((interaction) => (
        <TimelineEntry key={interaction.id} interaction={interaction} />
      ))}
    </div>
  );
}
