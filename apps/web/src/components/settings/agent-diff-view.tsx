"use client";

import { diffLines, type Change } from "diff";
import { cn } from "@/lib/utils";

interface AgentDiffViewProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

export function AgentDiffView({
  oldText,
  newText,
  oldLabel,
  newLabel,
}: AgentDiffViewProps) {
  const changes: Change[] = diffLines(oldText, newText);

  return (
    <div className="space-y-1.5">
      {(oldLabel || newLabel) && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {oldLabel && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
              {oldLabel}
            </span>
          )}
          {newLabel && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
              {newLabel}
            </span>
          )}
        </div>
      )}
      <div className="max-h-[300px] overflow-y-auto rounded border border-slate-200 bg-slate-50 font-mono text-xs">
        {changes.map((change, i) => {
          const lines = change.value.replace(/\n$/, "").split("\n");
          return lines.map((line, j) => (
            <div
              key={`${i}-${j}`}
              className={cn(
                "px-3 py-0.5",
                change.added &&
                  "bg-green-50 text-green-800 border-l-2 border-green-500",
                change.removed &&
                  "bg-red-50 text-red-800 border-l-2 border-red-500",
                !change.added &&
                  !change.removed &&
                  "text-slate-600",
              )}
            >
              {change.added ? "+ " : change.removed ? "- " : "  "}
              {line || " "}
            </div>
          ));
        })}
      </div>
    </div>
  );
}
