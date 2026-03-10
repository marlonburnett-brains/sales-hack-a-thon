"use client";

import { useEffect, useRef } from "react";

export interface GenerationLogEntry {
  timestamp: string;
  step: string;
  message: string;
  detail?: string;
}

interface GenerationLogFeedProps {
  logs: GenerationLogEntry[];
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

export function GenerationLogFeed({ logs }: GenerationLogFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  if (logs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Generation Log
      </p>
      <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
        <ul className="space-y-0.5">
          {logs.map((entry, i) => {
            const isLast = i === logs.length - 1;
            return (
              <li
                key={`${entry.timestamp}-${i}`}
                className={`flex items-start gap-2 text-sm leading-relaxed ${
                  isLast ? "animate-pulse" : ""
                }`}
              >
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="text-slate-700">{entry.message}</span>
              </li>
            );
          })}
        </ul>
        <div ref={endRef} />
      </div>
    </div>
  );
}
