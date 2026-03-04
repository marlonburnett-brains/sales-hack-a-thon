"use client";

import { CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComplianceWarning {
  check: string;
  message: string;
  severity: string;
}

interface BrandComplianceSectionProps {
  result: {
    passed: boolean;
    warnings: ComplianceWarning[];
  } | null;
}

export function BrandComplianceSection({ result }: BrandComplianceSectionProps) {
  if (!result) return null;

  const warnCount = result.warnings.filter((w) => w.severity === "warn").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Brand Compliance
          </h3>
          {result.passed ? (
            <Badge className="bg-green-100 text-green-800">
              All Checks Passed
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800">
              {warnCount} {warnCount === 1 ? "Warning" : "Warnings"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {result.warnings.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              {item.severity === "warn" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              ) : (
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
              )}
              <span className="text-slate-700">{item.message}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
