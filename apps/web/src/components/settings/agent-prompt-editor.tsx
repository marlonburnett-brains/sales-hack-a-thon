"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveDraftAction } from "@/lib/actions/agent-config-actions";

interface AgentPromptEditorProps {
  agentId: string;
  baselinePrompt: string;
  rolePrompt: string;
  draftRolePrompt?: string;
  publishedVersion: number;
}

export function AgentPromptEditor({
  agentId,
  baselinePrompt,
  rolePrompt,
  draftRolePrompt,
  publishedVersion,
}: AgentPromptEditorProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isBaselineExpanded, setIsBaselineExpanded] = useState(false);

  const initialValue = draftRolePrompt ?? rolePrompt;
  const [currentValue, setCurrentValue] = useState(initialValue);
  const isDirty = currentValue !== initialValue;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [currentValue]);

  function handleSave() {
    startSaveTransition(async () => {
      try {
        await saveDraftAction(agentId, {
          rolePrompt: currentValue,
          expectedVersion: publishedVersion,
        });
        toast.success("Draft saved");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save draft",
        );
      }
    });
  }

  const baselineLines = baselinePrompt.split("\n");
  const shouldTruncate = baselineLines.length > 10;
  const displayedBaseline =
    !isBaselineExpanded && shouldTruncate
      ? baselineLines.slice(0, 10).join("\n") + "\n..."
      : baselinePrompt;

  return (
    <div className="space-y-6">
      {/* Baseline section (read-only) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            Baseline Prompt
          </label>
          <Link
            href="/settings/agents/baseline"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors duration-150"
          >
            <Edit className="h-3 w-3" />
            Edit Baseline
          </Link>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <pre className="whitespace-pre-wrap font-mono text-xs text-slate-600 leading-relaxed">
            {displayedBaseline}
          </pre>
          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setIsBaselineExpanded(!isBaselineExpanded)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-700 underline cursor-pointer"
            >
              {isBaselineExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>

      {/* Role prompt section (editable) */}
      <div className="space-y-2">
        <label
          htmlFor="role-prompt"
          className="text-sm font-medium text-slate-700"
        >
          Role Prompt
        </label>
        <textarea
          ref={textareaRef}
          id="role-prompt"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          className="w-full min-h-[200px] rounded-md border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
          spellCheck={false}
        />
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          size="sm"
        >
          {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save Draft
        </Button>
      </div>
    </div>
  );
}
