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
  const logEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Auto-scroll log feed
  useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, expanded]);

  const startQA = useCallback(async () => {
    setQaStatus("running");
    setLogs([]);
    setResult(null);
    setErrorMessage(null);
    setExpanded(true);

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
      setQaStatus((prev) => (prev === "running" ? "complete" : prev));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Visual QA failed");
      setQaStatus("error");
    }
  }, [presentationId, interactionId]);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && !hasStarted.current) {
      hasStarted.current = true;
      startQA();
    }
  }, [autoStart, startQA]);

  const friendlyLogMessage = (entry: LogEntry): string => {
    switch (entry.type) {
      case "autofit":
        return entry.detail;
      case "info":
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

  const hasIssues =
    qaStatus === "complete" &&
    (result?.status === "warning" || result?.status === "corrected");

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white">
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">
            Visual QA
          </span>

          {/* Status badge */}
          {qaStatus === "running" && (
            <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running...
            </Badge>
          )}
          {qaStatus === "complete" && result?.status === "clean" && (
            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              All clear
            </Badge>
          )}
          {qaStatus === "complete" && result?.status === "corrected" && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Corrections applied
            </Badge>
          )}
          {qaStatus === "complete" && result?.status === "warning" && (
            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {result.issues?.length ?? 0} issues remain
            </Badge>
          )}
          {qaStatus === "error" && (
            <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
              <XCircle className="mr-1 h-3 w-3" />
              Failed
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Re-run / Run button */}
          {qaStatus === "idle" && (
            <Button
              onClick={startQA}
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 text-xs"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Run Visual QA
            </Button>
          )}
          {(qaStatus === "complete" || qaStatus === "error") && (
            <Button
              onClick={startQA}
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-run
            </Button>
          )}

          {/* Expand/collapse log feed */}
          {(qaStatus === "running" || logs.length > 0) && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="cursor-pointer rounded p-1 hover:bg-slate-100"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Status message */}
      {hasIssues && !expanded && (
        <div className="border-t border-slate-100 px-4 py-2">
          <p className="text-xs text-slate-500">
            {result?.status === "corrected"
              ? "Slides were updated in real-time. Refresh the preview to see changes."
              : "Some issues could not be auto-fixed. Click Re-run to try again or expand to see details."}
          </p>
        </div>
      )}

      {qaStatus === "error" && !expanded && (
        <div className="border-t border-slate-100 px-4 py-2">
          <p className="text-xs text-red-600">
            {errorMessage ?? "Visual QA failed"}
          </p>
        </div>
      )}

      {/* Expandable log feed */}
      {expanded && logs.length > 0 && (
        <div className="border-t border-slate-100">
          <div className="max-h-48 overflow-y-auto px-4 py-2">
            {logs.map((entry, i) => (
              <div
                key={i}
                className="flex items-start gap-2 py-0.5 text-xs text-slate-600"
              >
                <span className="shrink-0 text-slate-400">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span>{friendlyLogMessage(entry)}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Expand warning issues when expanded */}
      {expanded && qaStatus === "complete" && result?.status === "warning" && result.issues && (
        <div className="border-t border-slate-100 px-4 py-2">
          <p className="mb-1 text-xs font-medium text-amber-700">Remaining issues:</p>
          {result.issues.map((issue, i) => (
            <div key={i} className="py-0.5 text-xs text-amber-600">
              {issue}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
