"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import type { InteractionRecord } from "@/lib/api-client";

interface PriorBriefingsListProps {
  interactions: InteractionRecord[];
  dealId: string;
}

interface ParsedBriefing {
  id: string;
  createdAt: Date;
  status: string;
  buyerRole: string;
  meetingContext: string;
  generatedContent: Record<string, unknown> | null;
  docUrl: string | null;
}

function parseBriefings(interactions: InteractionRecord[]): ParsedBriefing[] {
  return interactions
    .filter((i) => i.touchType === "pre_call")
    .map((i) => {
      let buyerRole = "General";
      let meetingContext = "";
      let generatedContent: Record<string, unknown> | null = null;
      let docUrl: string | null = null;

      if (i.inputs) {
        try {
          const parsed = JSON.parse(i.inputs) as Record<string, unknown>;
          buyerRole = (parsed.buyerRole as string) ?? "General";
          meetingContext = (parsed.meetingContext as string) ?? "";
        } catch {
          // ignore
        }
      }

      if (i.generatedContent) {
        try {
          generatedContent = JSON.parse(i.generatedContent) as Record<
            string,
            unknown
          >;
        } catch {
          // ignore
        }
      }

      if (i.outputRefs) {
        try {
          const parsed = JSON.parse(i.outputRefs) as Record<string, string>;
          docUrl = parsed.briefingDocUrl ?? null;
        } catch {
          // ignore
        }
      }

      return {
        id: i.id,
        createdAt: new Date(i.createdAt),
        status: i.status,
        buyerRole,
        meetingContext,
        generatedContent,
        docUrl,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function getContentPreview(
  content: Record<string, unknown> | null
): string {
  if (!content) return "No content generated";

  // Try to extract a meaningful preview from known structures
  const research = content.companyResearch as
    | Record<string, unknown>
    | undefined;
  if (research?.industryPosition) {
    return String(research.industryPosition).slice(0, 120);
  }

  // Fallback: stringify and take first 120 chars
  const raw = JSON.stringify(content);
  if (raw.length <= 120) return raw;
  return raw.slice(0, 120) + "...";
}

function renderContentSection(
  label: string,
  value: unknown
): React.ReactNode {
  if (!value) return null;

  if (typeof value === "string") {
    return (
      <div key={label}>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </h4>
        <p className="mt-1 text-sm text-slate-700">{value}</p>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div key={label}>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </h4>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-700">
          {value.map((item, idx) => (
            <li key={idx}>
              {typeof item === "string" ? item : JSON.stringify(item)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    return (
      <div key={label}>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </h4>
        <div className="mt-1 space-y-2">
          {Object.entries(value as Record<string, unknown>).map(
            ([subKey, subVal]) => renderContentSection(subKey, subVal)
          )}
        </div>
      </div>
    );
  }

  return null;
}

function BriefingCard({ briefing }: { briefing: ParsedBriefing }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    briefing.status === "completed"
      ? "bg-green-50 text-green-700 border-green-200"
      : briefing.status === "failed"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">
                {format(briefing.createdAt, "MMM d, yyyy 'at' h:mm a")}
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${statusColor}`}
              >
                {briefing.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {briefing.buyerRole}
              </Badge>
            </div>
            {!expanded && briefing.generatedContent && (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {getContentPreview(briefing.generatedContent)}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {briefing.docUrl && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer gap-1 px-2 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <a
                href={briefing.docUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
                Doc
              </a>
            </Button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4">
          {briefing.meetingContext && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Meeting Context
              </h4>
              <p className="mt-1 text-sm text-slate-700">
                {briefing.meetingContext}
              </p>
            </div>
          )}

          {briefing.generatedContent ? (
            <div className="space-y-4">
              {Object.entries(briefing.generatedContent).map(([key, val]) =>
                renderContentSection(
                  key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
                  val
                )
              )}
            </div>
          ) : (
            <p className="text-sm italic text-slate-400">
              No generated content available for this briefing.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PriorBriefingsList({
  interactions,
  dealId: _dealId,
}: PriorBriefingsListProps) {
  const briefings = parseBriefings(interactions);

  if (briefings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-600">
          No briefings yet
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Use the AI assistant above to generate your first briefing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {briefings.map((briefing) => (
        <BriefingCard key={briefing.id} briefing={briefing} />
      ))}
    </div>
  );
}
