"use client";

import { useEffect, useMemo, useState } from "react";
import type { DealChatRouteContext, DealChatSuggestion, DealChatSection, DealChatTouchType } from "@lumenalta/schemas";
import { MessageSquare, Minimize2, PanelRightOpen, X } from "lucide-react";
import { usePathname, useSelectedLayoutSegments } from "next/navigation";

import { DealChatThread } from "@/components/deals/deal-chat-thread";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDealChatBootstrap } from "@/lib/actions/deal-chat-actions";
import type { DealChatMessageData } from "@/lib/api-client";

type ChatMode = "dock" | "panel";

function parseTouchType(segment: string | undefined): DealChatTouchType | null {
  if (!segment) return null;
  const parsed = Number(segment);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) return null;
  return `touch_${parsed}` as DealChatTouchType;
}

function buildRouteContext(pathname: string, segments: string[]): DealChatRouteContext {
  const sectionSegment = segments[0];
  const section: DealChatSection = sectionSegment === "briefing" ? "briefing" : sectionSegment === "touch" ? "touch" : "overview";
  const touchType = section === "touch" ? parseTouchType(segments[1]) : null;
  const pageLabel = section === "touch" && touchType
    ? `Touch ${touchType.replace("touch_", "")}`
    : section === "briefing"
      ? "Briefing"
      : "Overview";

  return {
    section,
    touchType,
    pathname,
    pageLabel,
  };
}

export function PersistentDealChat({ dealId }: { dealId: string }) {
  const pathname = usePathname();
  const segments = useSelectedLayoutSegments();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("dock");
  const [messages, setMessages] = useState<DealChatMessageData[]>([]);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DealChatSuggestion[]>([]);

  // Stabilize segments into a primitive key so useMemo doesn't recompute
  // on every render (useSelectedLayoutSegments returns a new array each time).
  const segmentsKey = segments.join("/");
  const routeContext = useMemo(
    () => buildRouteContext(pathname, segments),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- segments is derived from segmentsKey
    [pathname, segmentsKey],
  );

  useEffect(() => {
    let active = true;

    void getDealChatBootstrap(dealId, routeContext)
      .then((data) => {
        if (!active) return;
        setGreeting(data.greeting);
        setSuggestions(data.suggestions);
        setMessages((current) => (current.length === 0 ? data.messages : current));
      })
      .catch(() => {
        if (!active) return;
        setGreeting("Ask for next steps, save meeting notes, or compare similar wins.");
        setSuggestions([]);
      });

    return () => {
      active = false;
    };
  }, [dealId, routeContext]);

  const thread = (
    <DealChatThread
      dealId={dealId}
      routeContext={routeContext}
      initialMessages={messages}
      greeting={greeting}
      suggestions={suggestions}
    />
  );

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:justify-end sm:px-6">
        <div className="pointer-events-auto w-full max-w-2xl sm:max-w-xl">
          {!isOpen || mode !== "dock" ? (
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
              <button
                type="button"
                onClick={() => {
                  setMode("dock");
                  setIsOpen(true);
                }}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-label="Open deal assistant"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Deal assistant</p>
                    <p className="line-clamp-2 text-xs text-slate-500">
                      {greeting ?? `${routeContext.pageLabel}: keep one thread, refresh the prompts.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                    {routeContext.pageLabel}
                  </span>
                  <PanelRightOpen className="h-4 w-4" />
                </div>
              </button>
              {suggestions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.slice(0, 3).map((suggestion) => (
                    <span
                      key={suggestion.id}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {suggestion.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Deal assistant</p>
                  <p className="text-xs text-slate-500">{routeContext.pageLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMode("panel")} aria-label="Switch to side panel">
                    <PanelRightOpen className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} aria-label="Collapse deal assistant">
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="h-[32rem]">{thread}</div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isOpen && mode === "panel"}>
        <DialogContent className="right-0 left-auto top-0 h-screen w-full max-w-2xl translate-x-0 translate-y-0 rounded-none border-l border-slate-200 p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>Deal assistant</DialogTitle>
                <DialogDescription>
                  Persistent help for {routeContext.pageLabel.toLowerCase()} and nearby deal context.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setMode("dock")} aria-label="Switch to dock mode">
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} aria-label="Close side panel">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="h-[calc(100vh-5rem)]">{thread}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
