"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSearch, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import type { InteractionRecord } from "@/lib/api-client";
import { PreCallForm } from "./pre-call-form";

interface PreCallSectionProps {
  dealId: string;
  companyName: string;
  industry: string;
  interactions: InteractionRecord[];
}

interface PriorBriefing {
  id: string;
  buyerRole: string;
  date: string;
  docUrl: string | null;
}

function parsePriorBriefings(
  interactions: InteractionRecord[]
): PriorBriefing[] {
  return interactions
    .filter((i) => i.touchType === "pre_call")
    .map((i) => {
      let buyerRole = "General";
      let docUrl: string | null = null;

      if (i.inputs) {
        try {
          const parsed = JSON.parse(i.inputs) as Record<string, unknown>;
          buyerRole = (parsed.buyerRole as string) ?? "General";
        } catch {
          // ignore parse errors
        }
      }

      if (i.outputRefs) {
        try {
          const parsed = JSON.parse(i.outputRefs) as Record<string, string>;
          docUrl = parsed.briefingDocUrl ?? null;
        } catch {
          // ignore parse errors
        }
      }

      return {
        id: i.id,
        buyerRole,
        date: new Date(i.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        docUrl,
      };
    })
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

export function PreCallSection({
  dealId,
  companyName,
  industry,
  interactions,
}: PreCallSectionProps) {
  const priorBriefings = parsePriorBriefings(interactions);
  const [showPrior, setShowPrior] = useState(false);

  return (
    <div className="space-y-4">
      {/* Section description */}
      <div className="flex items-center gap-2">
        <FileSearch className="h-5 w-5 text-slate-500" />
        <p className="text-sm text-slate-500">
          Prepare for upcoming meetings with AI-generated briefings
        </p>
      </div>

      {/* Prior briefings */}
      {priorBriefings.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            onClick={() => setShowPrior(!showPrior)}
            className="flex w-full cursor-pointer items-center justify-between text-sm font-medium text-slate-700"
          >
            <span>
              Prior Briefings ({priorBriefings.length})
            </span>
            {showPrior ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showPrior && (
            <div className="mt-2 space-y-2">
              {priorBriefings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {b.buyerRole}
                    </Badge>
                    <span className="text-slate-500">{b.date}</span>
                  </div>
                  {b.docUrl && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 cursor-pointer gap-1 px-2 text-xs"
                    >
                      <a
                        href={b.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Doc
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New briefing form */}
      <PreCallForm
        dealId={dealId}
        companyName={companyName}
        industry={industry}
      />
    </div>
  );
}
