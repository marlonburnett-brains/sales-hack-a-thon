"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  saveBaselineDraftAction,
  publishBaselineAction,
} from "@/lib/actions/agent-config-actions";

interface BaselineEditorProps {
  baselinePrompt: string;
  hasDraft?: boolean;
}

export function BaselineEditor({
  baselinePrompt,
  hasDraft = false,
}: BaselineEditorProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isPublishing, startPublishTransition] = useTransition();
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");

  const [currentValue, setCurrentValue] = useState(baselinePrompt);
  const isDirty = currentValue !== baselinePrompt;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [currentValue]);

  function handleSaveDraft() {
    startSaveTransition(async () => {
      try {
        await saveBaselineDraftAction({ baselinePrompt: currentValue });
        toast.success("Baseline draft saved");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save baseline draft",
        );
      }
    });
  }

  function handlePublish() {
    startPublishTransition(async () => {
      try {
        const result = await publishBaselineAction({
          changeSummary: changeSummary.trim() || undefined,
        });
        toast.success(
          `Baseline published. ${result.agentsUpdated} agents updated.`,
        );
        setShowPublishConfirm(false);
        setChangeSummary("");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish baseline",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Blast-radius warning */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-800">
          <p className="font-medium">
            Editing the shared baseline affects all 19 agents.
          </p>
          <p className="mt-0.5 text-amber-700">
            Changes to the baseline will recompile every agent&apos;s system
            prompt when published.
          </p>
        </div>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <label
          htmlFor="baseline-prompt"
          className="text-sm font-medium text-slate-700"
        >
          Baseline Prompt
        </label>
        <textarea
          ref={textareaRef}
          id="baseline-prompt"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          className="w-full min-h-[200px] rounded-md border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
          spellCheck={false}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveDraft}
          disabled={!isDirty || isSaving}
        >
          {isSaving && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          )}
          Save Baseline Draft
        </Button>

        {(hasDraft || isDirty) && (
          <Button
            size="sm"
            onClick={() => setShowPublishConfirm(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Publish Baseline
          </Button>
        )}
      </div>

      {/* Publish confirmation dialog */}
      <AlertDialog
        open={showPublishConfirm}
        onOpenChange={setShowPublishConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Baseline Changes</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the compiled prompt for all 19 agents. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5 py-2">
            <label
              htmlFor="baseline-change-note"
              className="text-xs font-medium text-slate-600"
            >
              Describe what changed (optional)
            </label>
            <input
              id="baseline-change-note"
              type="text"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="e.g., Added compliance requirements section"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={isPublishing}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isPublishing && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Publish Baseline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
