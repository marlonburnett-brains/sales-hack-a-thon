"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2, MessageSquare, Search, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
  generatePreCallBriefingAction,
  checkPreCallStatusAction,
} from "@/lib/actions/touch-actions";

interface BriefingChatPanelProps {
  dealId: string;
  companyName: string;
  industry: string;
}

export function BriefingChatPanel({
  dealId,
  companyName,
  industry,
}: BriefingChatPanelProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const pollUntilComplete = useCallback(async (runId: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const status = await checkPreCallStatusAction(runId);

      if (status.status === "completed") {
        return status;
      }

      if (status.status === "failed") {
        throw new Error("Briefing generation failed");
      }
    }

    throw new Error("Briefing generation timed out");
  }, []);

  const handleGenerateBriefing = async () => {
    setIsGenerating(true);
    try {
      const result = await generatePreCallBriefingAction(dealId, {
        companyName,
        industry,
        buyerRole: "General",
        meetingContext: "",
      });

      await pollUntilComplete(result.runId);
      toast.success("Briefing generated successfully");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Briefing generation failed";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlaceholderAction = (label: string) => {
    toast.info(`${label} - Coming in a future update`);
  };

  const handleChatSend = () => {
    if (!chatInput.trim()) return;
    toast.info("Chat coming soon");
    setChatInput("");
  };

  const suggestions = [
    {
      label: "Generate full briefing",
      icon: Sparkles,
      action: handleGenerateBriefing,
      functional: true,
    },
    {
      label: "Dig deeper on their tech stack",
      icon: Search,
      action: () => handlePlaceholderAction("Dig deeper on their tech stack"),
      functional: false,
    },
    {
      label: "Suggest discovery questions",
      icon: HelpCircle,
      action: () => handlePlaceholderAction("Suggest discovery questions"),
      functional: false,
    },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* AI Greeting Header */}
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
          <Sparkles className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">
            Meeting Prep Assistant
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            I can help you prepare for your meeting with{" "}
            <span className="font-medium text-slate-700">{companyName}</span>.
            Here are some things I can do:
          </p>
        </div>
      </div>

      {/* Suggestion Buttons */}
      <div className="flex flex-wrap gap-2 px-5 py-4">
        {suggestions.map((suggestion) => {
          const Icon = suggestion.icon;
          const isBriefing = suggestion.functional;

          return (
            <Button
              key={suggestion.label}
              variant={isBriefing ? "default" : "outline"}
              size="sm"
              className="cursor-pointer gap-1.5"
              onClick={suggestion.action}
              disabled={isGenerating && isBriefing}
            >
              {isGenerating && isBriefing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {suggestion.label}
            </Button>
          );
        })}
      </div>

      {/* Generating Status */}
      {isGenerating && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating your briefing... This may take a minute.
        </div>
      )}

      {/* Chat Input Shell */}
      <div className="border-t border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleChatSend();
              }}
              placeholder="Ask about this deal..."
              className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              aria-label="Chat input"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 cursor-pointer rounded-full p-0"
            onClick={handleChatSend}
            aria-label="Send message"
          >
            <Send className="h-4 w-4 text-slate-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}
