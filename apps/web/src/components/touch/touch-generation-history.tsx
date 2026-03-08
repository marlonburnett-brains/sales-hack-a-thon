"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HistoryInteraction {
  id: string;
  hitlStage: string | null;
  status: string;
  createdAt: string;
  generatedContent?: string;
}

interface TouchGenerationHistoryProps {
  interactions: HistoryInteraction[];
  currentInteractionId: string | null;
  onSelectRun: (interactionId: string) => void;
}

const STAGE_LABELS: Record<string, string> = {
  skeleton: "Outline",
  lowfi: "Draft",
  highfi: "Final",
  ready: "Completed",
};

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  completed: { className: "bg-green-100 text-green-800", label: "Completed" },
  in_progress: {
    className: "bg-blue-100 text-blue-800",
    label: "In Progress",
  },
  failed: { className: "bg-red-100 text-red-800", label: "Failed" },
  not_started: {
    className: "bg-slate-100 text-slate-600",
    label: "Not Started",
  },
};

export function TouchGenerationHistory({
  interactions,
  currentInteractionId,
  onSelectRun,
}: TouchGenerationHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Exclude the active/current run from history
  const previousRuns = interactions.filter(
    (i) => i.id !== currentInteractionId
  );

  if (previousRuns.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-left transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <span className="text-sm font-medium text-slate-700">
          History ({previousRuns.length} previous{" "}
          {previousRuns.length === 1 ? "run" : "runs"})
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5">
          {previousRuns.map((run) => {
            const statusStyle = STATUS_STYLES[run.status] ?? STATUS_STYLES.not_started;
            const stageLabel = run.hitlStage
              ? STAGE_LABELS[run.hitlStage] ?? run.hitlStage
              : "Not started";
            const dateStr = formatDate(run.createdAt);

            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectRun(run.id)}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm text-slate-700">{dateStr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Stage: {stageLabel}
                  </span>
                  <Badge className={statusStyle.className}>
                    {statusStyle.label}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
