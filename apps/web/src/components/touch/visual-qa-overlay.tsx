"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wand2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface VisualQAOverlayProps {
  interactionId: string;
  presentationId: string;
  autoStart: boolean;
}

interface LogEntry {
  type: string;
  detail: string;
  timestamp: number;
}

interface VisualQAResult {
  status: "clean" | "corrected" | "warning";
  iterations: number;
  issues?: string[];
}

type QAStatus = "idle" | "running" | "complete" | "error";

export function VisualQAOverlay({
  interactionId,
  presentationId,
  autoStart,
}: VisualQAOverlayProps) {
  const [qaStatus, setQaStatus] = useState<QAStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<VisualQAResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Auto-scroll log feed
  useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, expanded]);

  // Auto-dismiss "clean" result after 5 seconds
  useEffect(() => {
    if (result?.status === "clean") {
      const timer = setTimeout(() => setDismissed(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const startQA = useCallback(async () => {
    setQaStatus("running");
    setLogs([]);
    setResult(null);
    setErrorMessage(null);
    setDismissed(false);

    try {
      const response = await fetch("/api/visual-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentationId, interactionId }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Visual QA failed: ${text}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === "log") {
                setLogs((prev) => [...prev, data as LogEntry]);
              } else if (currentEvent === "complete") {
                setResult(data as VisualQAResult);
                setQaStatus("complete");
              } else if (currentEvent === "error") {
                setErrorMessage(data.message ?? "Unknown error");
                setQaStatus("error");
              }
            } catch {
              // Skip malformed data
            }
          }
        }
      }

      // If stream ended without a complete/error event, mark as complete
      if (qaStatus === "running") {
        setQaStatus("complete");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Visual QA failed");
      setQaStatus("error");
    }
  }, [presentationId, interactionId, qaStatus]);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && !hasStarted.current) {
      hasStarted.current = true;
      startQA();
    }
  }, [autoStart, startQA]);

  if (dismissed) return null;

  const friendlyLogMessage = (entry: LogEntry): string => {
    switch (entry.type) {
      case "autofit":
        return entry.detail;
      case "checking":
        return entry.detail;
      case "issue_found":
        try {
          const issues = JSON.parse(entry.detail);
          return `Found ${Array.isArray(issues) ? issues.length : 0} issue(s)`;
        } catch {
          return "Issues detected";
        }
      case "correcting":
        return entry.detail;
      case "complete":
        return "Visual QA finished";
      default:
        return entry.detail;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <div className="rounded-lg border border-slate-200 bg-white shadow-lg">
        {/* Idle state */}
        {qaStatus === "idle" && (
          <div className="p-3">
            <Button
              onClick={startQA}
              variant="outline"
              size="sm"
              className="w-full cursor-pointer gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Run Visual QA
            </Button>
            <p className="mt-1.5 text-center text-xs text-slate-500">
              Check slides for text overflow and layout issues
            </p>
          </div>
        )}

        {/* Running state */}
        {qaStatus === "running" && (
          <div className="p-3">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex w-full items-center gap-2 cursor-pointer"
            >
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium text-slate-700">
                Visual QA in progress...
              </span>
              {expanded ? (
                <ChevronUp className="ml-auto h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
              )}
            </button>

            {expanded && logs.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-100 bg-slate-50 p-2">
                {logs.map((entry, i) => (
                  <div
                    key={i}
                    className="py-0.5 text-xs text-slate-600"
                  >
                    {friendlyLogMessage(entry)}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        )}

        {/* Complete: clean */}
        {qaStatus === "complete" && result?.status === "clean" && (
          <div className="flex items-center gap-2 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
              Visual QA: All clear
            </Badge>
          </div>
        )}

        {/* Complete: corrected */}
        {qaStatus === "complete" && result?.status === "corrected" && (
          <div className="p-3">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex w-full items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                Visual QA: Corrections applied
              </Badge>
              {expanded ? (
                <ChevronUp className="ml-auto h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
              )}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              Slides updated in real-time — refresh to see changes
            </p>
            {expanded && logs.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-100 bg-slate-50 p-2">
                {logs.map((entry, i) => (
                  <div
                    key={i}
                    className="py-0.5 text-xs text-slate-600"
                  >
                    {friendlyLogMessage(entry)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Complete: warning */}
        {qaStatus === "complete" && result?.status === "warning" && (
          <div className="p-3">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex w-full items-center gap-2 cursor-pointer"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                Visual QA: {result.issues?.length ?? 0} issues remain
              </Badge>
              {expanded ? (
                <ChevronUp className="ml-auto h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
              )}
            </button>
            {expanded && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-100 bg-slate-50 p-2">
                {result.issues?.map((issue, i) => (
                  <div
                    key={i}
                    className="py-0.5 text-xs text-amber-700"
                  >
                    {issue}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {qaStatus === "error" && (
          <div className="p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">
                {errorMessage ?? "Visual QA failed"}
              </span>
            </div>
            <Button
              onClick={startQA}
              variant="outline"
              size="sm"
              className="mt-2 w-full cursor-pointer gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
