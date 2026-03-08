"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { publishAction } from "@/lib/actions/agent-config-actions";

interface PublishDialogProps {
  agentId: string;
  currentRolePrompt: string;
  draftRolePrompt: string;
  onPublished: () => void;
  onCancel: () => void;
}

/**
 * Simple line-diff: compares lines from current vs draft,
 * highlights added (green) and removed (red) lines.
 */
function LineDiff({
  current,
  draft,
}: {
  current: string;
  draft: string;
}) {
  const currentLines = current.split("\n");
  const draftLines = draft.split("\n");

  const removedSet = new Set<string>();
  const addedSet = new Set<string>();

  // Find lines unique to current (removed) and unique to draft (added)
  const currentCounts = new Map<string, number>();
  const draftCounts = new Map<string, number>();

  for (const line of currentLines) {
    currentCounts.set(line, (currentCounts.get(line) ?? 0) + 1);
  }
  for (const line of draftLines) {
    draftCounts.set(line, (draftCounts.get(line) ?? 0) + 1);
  }

  // Show removed lines then added lines
  const removedLines: string[] = [];
  const addedLines: string[] = [];

  for (const line of currentLines) {
    const draftCount = draftCounts.get(line) ?? 0;
    const currentCount = currentCounts.get(line) ?? 0;
    if (draftCount < currentCount && !removedSet.has(line)) {
      removedLines.push(line);
      removedSet.add(line);
    }
  }

  for (const line of draftLines) {
    const currentCount = currentCounts.get(line) ?? 0;
    const draftCount = draftCounts.get(line) ?? 0;
    if (currentCount < draftCount && !addedSet.has(line)) {
      addedLines.push(line);
      addedSet.add(line);
    }
  }

  if (removedLines.length === 0 && addedLines.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">No visible differences</p>
    );
  }

  return (
    <div className="max-h-[240px] overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs font-mono space-y-0.5">
      {removedLines.map((line, i) => (
        <div key={`r-${i}`} className="bg-red-50 text-red-700 px-2 py-0.5 rounded-sm">
          - {line || " "}
        </div>
      ))}
      {addedLines.map((line, i) => (
        <div key={`a-${i}`} className="bg-green-50 text-green-700 px-2 py-0.5 rounded-sm">
          + {line || " "}
        </div>
      ))}
    </div>
  );
}

export function PublishDialog({
  agentId,
  currentRolePrompt,
  draftRolePrompt,
  onPublished,
  onCancel,
}: PublishDialogProps) {
  const [changeSummary, setChangeSummary] = useState("");
  const [isPublishing, startPublishTransition] = useTransition();

  function handlePublish() {
    startPublishTransition(async () => {
      try {
        await publishAction(agentId, {
          changeSummary: changeSummary.trim() || undefined,
        });
        toast.success("Agent published successfully");
        onPublished();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish",
        );
      }
    });
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Publish Agent Update</AlertDialogTitle>
          <AlertDialogDescription>
            Review the changes below before publishing. This will make the
            updated prompt live immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Diff */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">
              Changes
            </label>
            <LineDiff current={currentRolePrompt} draft={draftRolePrompt} />
          </div>

          {/* Change note */}
          <div className="space-y-1.5">
            <label
              htmlFor="change-summary"
              className="text-xs font-medium text-slate-600"
            >
              Describe what changed (optional)
            </label>
            <input
              id="change-summary"
              type="text"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="e.g., Updated tone to be more conversational"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button
            onClick={handlePublish}
            disabled={isPublishing}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isPublishing && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Publish Changes
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
