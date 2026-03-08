"use client";

import type { DealChatBinding, DealChatMeta, DealChatRouteContext, DealChatSuggestion } from "@lumenalta/schemas";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CornerDownRight, Loader2, MessageSquareText, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmDealChatBinding } from "@/lib/actions/deal-chat-actions";
import type { DealChatMessageData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface DealChatThreadProps {
  dealId: string;
  routeContext: DealChatRouteContext;
  initialMessages: DealChatMessageData[];
  greeting: string | null;
  suggestions: DealChatSuggestion[];
}

type BindingActionMessageId = {
  messageId: string;
  action: "confirm" | "correct" | "save_general_note";
};

const DEAL_CHAT_META_DELIMITER = "\n---DEAL_CHAT_META---\n";

function timestamp() {
  return new Date().toISOString();
}

function defaultDraft(meta: DealChatMeta | null) {
  return (
    meta?.refineBeforeSave?.draftText ??
    meta?.binding?.source.refinedText ??
    meta?.binding?.source.rawText ??
    ""
  );
}

function touchLabel(touchType: string | null | undefined) {
  if (!touchType) return "general notes";
  return touchType.replace("touch_", "Touch ");
}

function sectionTone(section: DealChatRouteContext["section"]) {
  if (section === "briefing") return "bg-amber-50 text-amber-700 border-amber-200";
  if (section === "touch") return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function DealChatThread({ dealId, routeContext, initialMessages, greeting, suggestions }: DealChatThreadProps) {
  const [messages, setMessages] = useState<DealChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeCorrectionId, setActiveCorrectionId] = useState<string | null>(null);
  const [bindingInFlight, setBindingInFlight] = useState<BindingActionMessageId | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const initializedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initializedRef.current || initialMessages.length === 0) {
      return;
    }

    initializedRef.current = true;
    setMessages(initialMessages);
    setDrafts(
      Object.fromEntries(
        initialMessages.map((message) => [message.id, defaultDraft(message.meta)]),
      ),
    );
  }, [initialMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, streamingText]);

  const applyDraft = useCallback((messageId: string, value: string) => {
    setDrafts((current) => ({ ...current, [messageId]: value }));
  }, []);

  const applyBindingResult = useCallback(
    (messageId: string, meta: DealChatMeta | null, confirmationChip: DealChatMeta["confirmationChips"][number]) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId || !meta) return message;
          return {
            ...message,
            meta: {
              ...meta,
              binding: {
                ...meta.binding,
                status: "confirmed",
              },
              confirmationChips: [...meta.confirmationChips, confirmationChip],
            },
          };
        }),
      );
    },
    [],
  );

  const handleBindingAction = useCallback(
    async (
      messageId: string,
      binding: DealChatBinding,
      action: "confirm" | "correct" | "save_general_note",
      touchType?: DealChatBinding["guessedTouchType"] | null,
    ) => {
      const draftText = drafts[messageId] ?? binding.source.refinedText ?? binding.source.rawText;

      setBindingInFlight({ messageId, action });
      try {
        const result = await confirmDealChatBinding(dealId, {
          action,
          touchType: touchType ?? (action === "save_general_note" ? null : binding.guessedTouchType),
          source: binding.source,
          refinedText: draftText,
        });

        const targetMessage = messages.find((message) => message.id === messageId);
        applyBindingResult(messageId, targetMessage?.meta ?? null, result.confirmationChip);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save note");
      } finally {
        setBindingInFlight(null);
      }
    },
    [applyBindingResult, dealId, drafts, messages],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: DealChatMessageData = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      meta: null,
      createdAt: timestamp(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setStreamingText("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/deals/${dealId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId,
          message: trimmed,
          routeContext,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Deal chat failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fullText += decoder.decode(value, { stream: true });
        const delimiterIndex = fullText.indexOf(DEAL_CHAT_META_DELIMITER);
        setStreamingText(
          delimiterIndex >= 0 ? fullText.slice(0, delimiterIndex) : fullText,
        );
      }

      const delimiterIndex = fullText.indexOf(DEAL_CHAT_META_DELIMITER);
      const content = delimiterIndex >= 0 ? fullText.slice(0, delimiterIndex) : fullText;
      let meta: DealChatMeta | null = null;

      if (delimiterIndex >= 0) {
        const metaPayload = fullText.slice(delimiterIndex + DEAL_CHAT_META_DELIMITER.length);
        meta = JSON.parse(metaPayload) as DealChatMeta;
      }

      const assistantMessage: DealChatMessageData = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content,
        meta,
        createdAt: timestamp(),
      };

      setMessages((current) => [...current, assistantMessage]);
      setDrafts((current) => ({
        ...current,
        [assistantMessage.id]: defaultDraft(meta),
      }));
      setStreamingText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
      setStreamingText("");
    } finally {
      setIsSending(false);
    }
  }, [dealId, input, isSending, routeContext]);

  const visibleSuggestions = useMemo(
    () => suggestions.slice(0, 3),
    [suggestions],
  );

  return (
    <div aria-label="Deal assistant thread" className="flex h-full min-h-[28rem] flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-900">Deal assistant</p>
              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", sectionTone(routeContext.section))}>
                {routeContext.pageLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Suggestions stay in sync with {routeContext.pageLabel.toLowerCase()} without interrupting the thread.
            </p>
          </div>
        </div>
        {visibleSuggestions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleSuggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                onClick={() => setInput(suggestion.prompt)}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streamingText ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <MessageSquareText className="h-4 w-4 text-emerald-600" />
              Ready when you are
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{greeting ?? "Ask about the latest touch, save messy notes, or request similar cases."}</p>
          </div>
        ) : null}

        {messages.map((message) => {
          const meta = message.meta;
          const draftValue = drafts[message.id] ?? defaultDraft(meta);
          const binding = meta?.binding;
          const refineBeforeSave = meta?.refineBeforeSave;
          const showAlternateTouches = activeCorrectionId === message.id;
          const isBindingLoading = bindingInFlight?.messageId === message.id;

          return (
            <article
              key={message.id}
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm shadow-sm",
                message.role === "assistant"
                  ? "mr-8 border-slate-200 bg-white text-slate-700"
                  : "ml-8 border-emerald-200 bg-emerald-50 text-slate-900",
              )}
            >
              <p className="whitespace-pre-wrap leading-6">{message.content}</p>

              {meta?.confirmationChips.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {meta.confirmationChips.map((chip) => (
                    <Badge key={chip.id} variant="secondary" className="gap-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {chip.label}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {meta?.suggestions.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {meta.suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => setInput(suggestion.prompt)}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {meta?.response.knowledgeMatches.length ? (
                <div className="mt-4 grid gap-3">
                  {meta.response.knowledgeMatches.map((match) => (
                    <div key={match.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{match.title}</p>
                        <Badge variant="outline">{match.sourceLabel}</Badge>
                      </div>
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Why it fits</p>
                      <p className="mt-1 text-sm text-slate-700">{match.whyFit}</p>
                      <p className="mt-2 text-sm text-slate-600">{match.summary}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {binding ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <CornerDownRight className="mt-0.5 h-4 w-4 text-amber-700" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-amber-900">{binding.confirmationLabel}</p>
                      {binding.reason ? (
                        <p className="mt-1 text-sm text-amber-800">{binding.reason}</p>
                      ) : null}
                    </div>
                  </div>

                  {refineBeforeSave?.required ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                      <p className="text-sm font-medium text-slate-900">Refine before save</p>
                      <p className="mt-1 text-sm text-slate-600">{refineBeforeSave.reason}</p>
                      <Textarea
                        className="mt-3 min-h-24"
                        value={draftValue}
                        onChange={(event) => applyDraft(message.id, event.target.value)}
                        aria-label="Refined note draft"
                      />
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={isBindingLoading}
                      onClick={() => void handleBindingAction(message.id, binding, "confirm", binding.guessedTouchType)}
                    >
                      {isBindingLoading && bindingInFlight?.action === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save to {touchLabel(binding.guessedTouchType)}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBindingLoading}
                      onClick={() => setActiveCorrectionId((current) => (current === message.id ? null : message.id))}
                    >
                      Choose another touch
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBindingLoading}
                      onClick={() => void handleBindingAction(message.id, binding, "save_general_note", null)}
                    >
                      Save as general note
                    </Button>
                  </div>

                  {showAlternateTouches ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["touch_1", "touch_2", "touch_3", "touch_4"] as const).map((touchType) => (
                        <Button
                          key={touchType}
                          size="sm"
                          variant="ghost"
                          className="border border-slate-200 bg-white"
                          disabled={isBindingLoading}
                          onClick={() => void handleBindingAction(message.id, binding, "correct", touchType)}
                        >
                          {touchLabel(touchType)}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}

        {streamingText ? (
          <article className="mr-8 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            <p className="whitespace-pre-wrap leading-6">{streamingText}</p>
          </article>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 px-4 py-4">
        <div className="flex items-end gap-3">
          <Textarea
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={`Ask from ${routeContext.pageLabel.toLowerCase()} context...`}
            aria-label="Chat message input"
            className="min-h-20 resize-none"
            disabled={isSending}
          />
          <Button
            className="h-10 w-10 shrink-0 p-0"
            onClick={() => void handleSend()}
            disabled={isSending || !input.trim()}
            aria-label="Send message"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
