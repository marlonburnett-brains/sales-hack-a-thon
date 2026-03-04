"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Lightbulb,
  HelpCircle,
  BookOpen,
  ExternalLink,
} from "lucide-react";

interface PreCallResultsProps {
  companyResearch: {
    companyName: string;
    keyInitiatives: string[];
    recentNews: string[];
    financialHighlights: string[];
    industryPosition: string;
    relevantLumenaltaSolutions: string[];
  };
  hypotheses: {
    buyerRole: string;
    hypotheses: Array<{
      hypothesis: string;
      evidence: string;
      lumenaltaSolution: string;
    }>;
  };
  discoveryQuestions: {
    questions: Array<{
      question: string;
      priority: string;
      rationale: string;
      mappedSolution: string;
    }>;
  };
  caseStudies: Array<{ title: string; content: string }>;
  docUrl: string;
}

function PriorityBadge({ priority }: { priority: string }) {
  const lower = priority.toLowerCase();
  if (lower === "high") {
    return <Badge variant="destructive">High</Badge>;
  }
  if (lower === "medium") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        Medium
      </Badge>
    );
  }
  return <Badge variant="secondary">Low</Badge>;
}

export function PreCallResults({
  companyResearch,
  hypotheses,
  discoveryQuestions,
  caseStudies,
  docUrl,
}: PreCallResultsProps) {
  return (
    <div className="space-y-4">
      {/* Google Doc Link */}
      <div className="flex justify-end">
        <Button asChild variant="outline" className="cursor-pointer gap-2">
          <a href={docUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open in Google Docs
          </a>
        </Button>
      </div>

      {/* Section 1 - Company Snapshot */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-slate-600" />
            Company Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {companyResearch.keyInitiatives.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Key Initiatives
              </p>
              <ul className="list-disc space-y-1 pl-4 text-slate-700">
                {companyResearch.keyInitiatives.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {companyResearch.recentNews.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Recent News
              </p>
              <ul className="list-disc space-y-1 pl-4 text-slate-700">
                {companyResearch.recentNews.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {companyResearch.financialHighlights.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Financial Highlights
              </p>
              <ul className="list-disc space-y-1 pl-4 text-slate-700">
                {companyResearch.financialHighlights.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {companyResearch.industryPosition && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Industry Position
              </p>
              <p className="text-slate-700">
                {companyResearch.industryPosition}
              </p>
            </div>
          )}

          {companyResearch.relevantLumenaltaSolutions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Relevant Lumenalta Solutions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {companyResearch.relevantLumenaltaSolutions.map(
                  (solution, i) => (
                    <Badge key={i} variant="secondary">
                      {solution}
                    </Badge>
                  )
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 - Value Hypotheses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Value Hypotheses
            <Badge variant="outline" className="ml-auto font-normal">
              {hypotheses.buyerRole}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hypotheses.hypotheses.map((h, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 p-3 space-y-1.5"
            >
              <p className="text-sm font-medium text-slate-900">
                {h.hypothesis}
              </p>
              <p className="text-xs italic text-slate-500">{h.evidence}</p>
              <Badge variant="outline" className="text-xs">
                {h.lumenaltaSolution}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 3 - Discovery Questions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            Discovery Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {discoveryQuestions.questions.map((q, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-slate-900">{q.question}</p>
                    <div className="flex items-center gap-1.5">
                      <PriorityBadge priority={q.priority} />
                      <Badge variant="outline" className="text-xs">
                        {q.mappedSolution}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">{q.rationale}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Section 4 - Case Studies */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-green-600" />
            Relevant Case Studies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {caseStudies.length > 0 ? (
            <div className="space-y-3">
              {caseStudies.map((cs, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {cs.title}
                  </p>
                  <p className="text-sm text-slate-600">{cs.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No matching case studies available for this industry.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
