"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Lightbulb } from "lucide-react";
import type { SalesBrief, ROIFraming } from "@lumenalta/schemas";

interface BriefDisplayProps {
  briefData: SalesBrief;
  roiFramingData: ROIFraming;
  interactionId: string;
}

export function BriefDisplay({
  briefData,
  roiFramingData,
}: BriefDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Header: Company, Industry, Subsector */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-slate-900">
          {briefData.companyName}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {briefData.industry}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {briefData.subsector}
        </Badge>
      </div>

      {/* Primary Pillar */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium uppercase tracking-wider text-blue-600">
              Primary Pillar
            </span>
          </div>
          <CardTitle className="text-lg text-slate-900">
            {briefData.primaryPillar}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">
            {briefData.evidence}
          </p>
        </CardContent>
      </Card>

      {/* Secondary Pillars */}
      {briefData.secondaryPillars.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            Secondary Pillars:
          </span>
          {briefData.secondaryPillars.map((pillar) => (
            <Badge
              key={pillar}
              variant="secondary"
              className="bg-slate-100 text-slate-700"
            >
              {pillar}
            </Badge>
          ))}
        </div>
      )}

      {/* Use Cases */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">Use Cases</h4>
        {briefData.useCases.map((useCase) => {
          // Find matching ROI framing for this use case
          const roiMatch = roiFramingData.useCases.find(
            (r) =>
              r.useCaseName.toLowerCase() === useCase.name.toLowerCase()
          );
          const roiOutcomes = roiMatch?.roiOutcomes ?? [useCase.roiOutcome];
          const valueHypothesis =
            roiMatch?.valueHypothesis ?? useCase.valueHypothesis;

          return (
            <Card key={useCase.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{useCase.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-600">
                  {useCase.description}
                </p>

                {/* ROI Outcomes */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs font-medium text-green-700">
                      ROI Outcomes
                    </span>
                  </div>
                  <ul className="ml-5 list-disc space-y-0.5">
                    {roiOutcomes.map((outcome, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-slate-600"
                      >
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Value Hypothesis */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700">
                      Value Hypothesis
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {valueHypothesis}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
