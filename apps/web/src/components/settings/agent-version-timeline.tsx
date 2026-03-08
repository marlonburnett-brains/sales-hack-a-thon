"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentDiffView } from "@/components/settings/agent-diff-view";
import { RollbackDialog } from "@/components/settings/rollback-dialog";
import type { AgentConfigVersionItem } from "@/lib/actions/agent-config-actions";
import { cn } from "@/lib/utils";

interface AgentVersionTimelineProps {
  versions: AgentConfigVersionItem[];
  currentPublishedVersion: number;
  currentPublishedRolePrompt: string;
  agentId: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes <= 1 ? "just now" : `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function AgentVersionTimeline({
  versions,
  currentPublishedVersion,
  currentPublishedRolePrompt,
  agentId,
}: AgentVersionTimelineProps) {
  const router = useRouter();
  const [expandedCompare, setExpandedCompare] = useState<number | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);

  // Sort newest first
  const sorted = [...versions].sort((a, b) => b.version - a.version);

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No versions yet
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {sorted.map((v, idx) => {
        const isPublished = v.version === currentPublishedVersion && v.isPublished;
        const isLast = idx === sorted.length - 1;
        const isCompareExpanded = expandedCompare === v.version;

        return (
          <div key={v.id} className="relative pl-8">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200" />
            )}

            {/* Dot */}
            <div
              className={cn(
                "absolute left-1 top-2 h-4 w-4 rounded-full border-2",
                isPublished
                  ? "border-green-500 bg-green-500"
                  : "border-slate-300 bg-white",
              )}
            />

            {/* Content */}
            <div className="pb-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900">
                      v{v.version}
                    </span>
                    {isPublished && (
                      <Badge
                        variant="secondary"
                        className="bg-green-50 text-green-700 border-green-200 text-xs"
                      >
                        Live
                      </Badge>
                    )}
                    <span className="text-xs text-slate-400">
                      {formatDate(v.publishedAt ?? v.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500 truncate">
                    {v.changeSummary || "No description"}
                  </p>
                  {v.publishedBy && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      by {v.publishedBy}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2 cursor-pointer"
                    onClick={() =>
                      setExpandedCompare(
                        isCompareExpanded ? null : v.version,
                      )
                    }
                  >
                    {isCompareExpanded ? "Hide" : "Compare"}
                  </Button>
                  {!isPublished && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50 cursor-pointer"
                      onClick={() => setRollbackTarget(v.version)}
                    >
                      Rollback
                    </Button>
                  )}
                </div>
              </div>

              {/* Inline diff */}
              {isCompareExpanded && (
                <div className="mt-3">
                  <AgentDiffView
                    oldText={v.rolePrompt}
                    newText={currentPublishedRolePrompt}
                    oldLabel={`This version (v${v.version})`}
                    newLabel={`Current (v${currentPublishedVersion})`}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Rollback dialog */}
      {rollbackTarget !== null && (
        <RollbackDialog
          agentId={agentId}
          currentVersion={currentPublishedVersion}
          targetVersion={rollbackTarget}
          onRolledBack={() => {
            setRollbackTarget(null);
            router.refresh();
          }}
          onCancel={() => setRollbackTarget(null)}
        />
      )}
    </div>
  );
}
