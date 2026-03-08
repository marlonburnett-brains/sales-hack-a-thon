"use client";

import type { ArtifactType } from "@lumenalta/schemas";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DeckSectionData, DeckChatMessageData } from "@/lib/api-client";

interface ChatBarProps {
  touchType: string;
  artifactType?: ArtifactType;
  onStructureUpdate: (
    structure: { sections: DeckSectionData[]; sequenceRationale: string },
    diff: { added: string[]; modified: string[] },
  ) => void;
  disabled?: boolean;
  initialMessages?: DeckChatMessageData[];
  onDeleteMessage?: (messageId: string) => Promise<void>;
}

interface LocalMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function ChatBar({
  touchType,
  artifactType,
  onStructureUpdate,
  disabled,
  initialMessages,
  onDeleteMessage,
}: ChatBarProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load initial messages
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(
        initialMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      );
    }
  }, [initialMessages]);

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
      el.style.height = `${Math.min(el.scrollHeight, 96)}px`; // max 3 rows ~96px
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // Add user message
    const userMsg: LocalMessage = {
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/deck-structures/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ touchType, artifactType, message: trimmed }),
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

        // Check if we've received the structure delimiter
        const delimiterIdx = fullText.indexOf("\n---STRUCTURE_UPDATE---\n");
        if (delimiterIdx >= 0) {
          // Show only the text part while streaming
          setStreamingText(fullText.substring(0, delimiterIdx));
        } else {
          setStreamingText(fullText);
        }
      }

      // Parse response: split on delimiter
      const delimiterIdx = fullText.indexOf("\n---STRUCTURE_UPDATE---\n");
      let aiText = fullText;
      let structurePayload: {
        updatedStructure?: { sections: DeckSectionData[]; sequenceRationale: string };
        diff?: { added: string[]; modified: string[] };
      } = {};

      if (delimiterIdx >= 0) {
        aiText = fullText.substring(0, delimiterIdx);
        const jsonPart = fullText.substring(
          delimiterIdx + "\n---STRUCTURE_UPDATE---\n".length,
        );
        try {
          structurePayload = JSON.parse(jsonPart);
        } catch {
          console.warn("[chat-bar] Failed to parse structure update payload");
        }
      }

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: aiText,
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingText("");

      // Notify parent of structure update
      if (structurePayload.updatedStructure && structurePayload.diff) {
        onStructureUpdate(structurePayload.updatedStructure, structurePayload.diff);
      }
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "An error occurred";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I encountered an error: ${errMsg}`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingText("");
    } finally {
      setIsStreaming(false);
    }
  }, [artifactType, input, isStreaming, touchType, onStructureUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  if (disabled) {
    return (
      <div className="border-t border-slate-200 bg-white p-4">
        <p className="text-center text-sm text-slate-400">
          Classify examples for this touch type to enable chat refinement
        </p>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 border-t border-slate-200 bg-white">
      {/* Message history */}
      {(messages.length > 0 || streamingText) && (
        <div
          ref={scrollRef}
          className="max-h-64 overflow-y-auto p-4 space-y-3"
        >
          {messages.map((msg, idx) => (
            <div
              key={msg.id ?? idx}
              className={cn(
                "group relative rounded-lg p-3 text-sm",
                msg.role === "user"
                  ? "ml-auto max-w-[80%] bg-blue-50 text-slate-900"
                  : "mr-auto max-w-[80%] bg-slate-50 text-slate-700",
              )}
            >
              {msg.content}
              {msg.id && onDeleteMessage && (
                <button
                  onClick={() => void onDeleteMessage(msg.id!)}
                  className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 group-hover:flex cursor-pointer"
                  aria-label="Delete message"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {isStreaming && streamingText && (
            <div className="mr-auto max-w-[80%] rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {streamingText}
              <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-slate-400" />
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-4 pt-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Suggest changes to the deck structure..."
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
