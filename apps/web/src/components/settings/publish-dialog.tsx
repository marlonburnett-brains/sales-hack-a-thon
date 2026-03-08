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
import { AgentDiffView } from "@/components/settings/agent-diff-view";
import { publishAction } from "@/lib/actions/agent-config-actions";

interface PublishDialogProps {
  agentId: string;
  currentRolePrompt: string;
  draftRolePrompt: string;
  onPublished: () => void;
  onCancel: () => void;
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
            <AgentDiffView
              oldText={currentRolePrompt}
              newText={draftRolePrompt}
              oldLabel="Current Published"
              newLabel="Draft"
            />
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
