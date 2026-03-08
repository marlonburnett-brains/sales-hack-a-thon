"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Zap, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentChatPanelProps {
  agentId: string;
  currentPrompt: string;
  onPromptUpdate: (newPrompt: string) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PendingUpdate {
  prompt: string;
  originalResponse: string;
}

const APPLY_MODE_KEY = "agent-chat-apply-mode";

function getApplyMode(): "auto" | "review" {
  if (typeof window === "undefined") return "review";
  return (localStorage.getItem(APPLY_MODE_KEY) as "auto" | "review") ?? "review";
}

/**
 * Simple inline diff for review mode -- shows removed (red) and added (green) lines.
 */
function InlineDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const maxLen = Math.max(oldLines.length, newLines.length);
  const elements: { type: "same" | "removed" | "added"; text: string }[] = [];

  // Simple longest-common-subsequence based diff for line-level changes
  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === newLine) {
      if (oldLine !== undefined) {
        elements.push({ type: "same", text: oldLine });
      }
    } else {
      if (oldLine !== undefined) {
        elements.push({ type: "removed", text: oldLine });
      }
      if (newLine !== undefined) {
        elements.push({ type: "added", text: newLine });
      }
    }
  }

  return (
    <div className="my-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs font-mono">
      {elements.map((el, i) => (
        <div
          key={i}
          className={cn(
            "px-2 py-0.5",
            el.type === "removed" && "bg-red-50 text-red-700",
            el.type === "added" && "bg-green-50 text-green-700",
            el.type === "same" && "text-slate-600",
          )}
        >
          {el.type === "removed" ? "- " : el.type === "added" ? "+ " : "  "}
          {el.text || " "}
        </div>
      ))}
    </div>
  );
}

export function AgentChatPanel({
  agentId,
  currentPrompt,
  onPromptUpdate,
}: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [applyMode, setApplyMode] = useState<"auto" | "review">(getApplyMode);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist apply mode preference
  useEffect(() => {
    localStorage.setItem(APPLY_MODE_KEY, applyMode);
  }, [applyMode]);

  // Auto-scroll on new messages or streaming text
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Auto-resize textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
    },
    [],
  );

  /**
   * Extract prompt update from between ---PROMPT_UPDATE--- and ---END_PROMPT_UPDATE--- delimiters.
   */
  function extractPromptUpdate(text: string): string | null {
    const startDelim = "---PROMPT_UPDATE---";
    const endDelim = "---END_PROMPT_UPDATE---";
    const startIdx = text.indexOf(startDelim);
    const endIdx = text.indexOf(endDelim);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
    return text.substring(startIdx + startDelim.length, endIdx).trim();
  }

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");
    setPendingUpdate(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          message: trimmed,
          currentPrompt,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamingText(fullText);
      }

      // Parse for prompt update delimiters
      const extractedPrompt = extractPromptUpdate(fullText);

      // Build display text (without the delimiters and raw prompt content)
      let displayText = fullText;
      if (extractedPrompt) {
        const startDelim = "---PROMPT_UPDATE---";
        const endDelim = "---END_PROMPT_UPDATE---";
        const startIdx = fullText.indexOf(startDelim);
        const endIdx = fullText.indexOf(endDelim) + endDelim.length;
        displayText =
          fullText.substring(0, startIdx).trim() +
          "\n\n[Prompt update suggested]" +
          (endIdx < fullText.length
            ? "\n" + fullText.substring(endIdx).trim()
            : "");
        displayText = displayText.trim();
      }

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: displayText },
      ]);
      setStreamingText("");

      // Handle prompt update
      if (extractedPrompt) {
        if (applyMode === "auto") {
          onPromptUpdate(extractedPrompt);
        } else {
          setPendingUpdate({
            prompt: extractedPrompt,
            originalResponse: displayText,
          });
        }
      }
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "An error occurred";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I encountered an error: ${errMsg}` },
      ]);
      setStreamingText("");
    } finally {
      setIsStreaming(false);
    }
  }, [agentId, applyMode, currentPrompt, input, isStreaming, onPromptUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  function handleApplyPending() {
    if (!pendingUpdate) return;
    onPromptUpdate(pendingUpdate.prompt);
    setPendingUpdate(null);
  }

  function handleDismissPending() {
    setPendingUpdate(null);
  }

  return (
    <div className="sticky bottom-0 border-t border-slate-200 bg-white">
      {/* Panel header with mode toggle */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <span className="text-xs font-medium text-slate-500">
          AI Prompt Assistant
        </span>
        <button
          type="button"
          onClick={() =>
            setApplyMode((m) => (m === "auto" ? "review" : "auto"))
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer",
            applyMode === "auto"
              ? "bg-blue-50 text-blue-700"
              : "bg-slate-100 text-slate-600",
          )}
          aria-label={`Current mode: ${applyMode === "auto" ? "Auto-apply" : "Review first"}. Click to toggle.`}
        >
          {applyMode === "auto" ? (
            <>
              <Zap className="h-3 w-3" />
              Auto-apply
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Review first
            </>
          )}
        </button>
      </div>

      {/* Message history */}
      {(messages.length > 0 || streamingText) && (
        <div
          ref={scrollRef}
          className="max-h-64 overflow-y-auto p-4 space-y-3"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg p-3 text-sm whitespace-pre-wrap",
                msg.role === "user"
                  ? "ml-auto max-w-[80%] bg-blue-50 text-slate-900"
                  : "mr-auto max-w-[80%] bg-slate-50 text-slate-700",
              )}
            >
              {msg.content}
            </div>
          ))}
          {isStreaming && streamingText && (
            <div className="mr-auto max-w-[80%] rounded-lg bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
              {streamingText}
              <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-slate-400" />
            </div>
          )}
        </div>
      )}

      {/* Pending review diff */}
      {pendingUpdate && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-1 text-xs font-medium text-slate-600">
            Suggested prompt update:
          </p>
          <InlineDiff oldText={currentPrompt} newText={pendingUpdate.prompt} />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleApplyPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDismissPending}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-4 pt-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI to improve this agent's prompt..."
          className="flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
          rows={1}
          disabled={isStreaming}
          aria-label="Chat message input"
        />
        <Button
          size="sm"
          onClick={() => void handleSend()}
          disabled={isStreaming || !input.trim()}
          className="h-9 w-9 shrink-0 p-0"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
