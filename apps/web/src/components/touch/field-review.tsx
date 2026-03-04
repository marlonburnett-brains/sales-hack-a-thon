"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

interface TranscriptFields {
  customerContext: string;
  businessOutcomes: string;
  constraints: string;
  stakeholders: string;
  timeline: string;
  budget: string;
}

type FieldSeverity = "error" | "warning" | "ok";

interface FieldReviewProps {
  extractedFields: TranscriptFields;
  fieldSeverity: Record<string, string>;
  hasErrors: boolean;
  onContinue: (reviewedFields: TranscriptFields) => void;
}

/** Human-readable labels for each field key */
const FIELD_LABELS: Record<keyof TranscriptFields, string> = {
  customerContext: "Customer Context",
  businessOutcomes: "Business Outcomes",
  constraints: "Constraints",
  stakeholders: "Stakeholders",
  timeline: "Timeline",
  budget: "Budget",
};

/** Display order: required fields first, then warning fields */
const FIELD_ORDER: (keyof TranscriptFields)[] = [
  "customerContext",
  "businessOutcomes",
  "constraints",
  "stakeholders",
  "timeline",
  "budget",
];

/** Which fields are hard requirements (error when empty) */
const REQUIRED_FIELDS: Set<keyof TranscriptFields> = new Set([
  "customerContext",
  "businessOutcomes",
]);

export function FieldReview({
  extractedFields,
  fieldSeverity: initialSeverity,
  onContinue,
}: FieldReviewProps) {
  const [editedFields, setEditedFields] =
    useState<TranscriptFields>(extractedFields);

  // Compute live severity based on current edited values
  const liveSeverity = useMemo(() => {
    const severity: Record<string, FieldSeverity> = {};
    for (const key of FIELD_ORDER) {
      const isEmpty = editedFields[key].trim() === "";
      if (REQUIRED_FIELDS.has(key)) {
        severity[key] = isEmpty ? "error" : "ok";
      } else {
        severity[key] = isEmpty ? "warning" : "ok";
      }
    }
    return severity;
  }, [editedFields]);

  // Check if continue should be disabled (any required field is still empty)
  const hasBlockingErrors = useMemo(() => {
    return Array.from(REQUIRED_FIELDS).some(
      (key) => editedFields[key].trim() === ""
    );
  }, [editedFields]);

  const handleFieldChange = (
    field: keyof TranscriptFields,
    value: string
  ) => {
    setEditedFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    onContinue(editedFields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-slate-500" />
        <p className="text-sm text-slate-600">
          Review the AI-extracted fields below. Edit any field to correct or add
          missing information.
        </p>
      </div>

      <div className="space-y-3">
        {FIELD_ORDER.map((fieldKey) => {
          const severity = liveSeverity[fieldKey] as FieldSeverity;
          const label = FIELD_LABELS[fieldKey];
          const isRequired = REQUIRED_FIELDS.has(fieldKey);

          return (
            <Card
              key={fieldKey}
              className={`transition-colors duration-200 ${
                severity === "error"
                  ? "border-red-300 bg-red-50/50"
                  : severity === "warning"
                    ? "border-amber-300 bg-amber-50/50"
                    : "border-green-200 bg-green-50/30"
              }`}
            >
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`field-${fieldKey}`}
                    className="text-sm font-medium"
                  >
                    {label}
                    {isRequired && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>
                  <SeverityBadge severity={severity} />
                </div>

                <Textarea
                  id={`field-${fieldKey}`}
                  value={editedFields[fieldKey]}
                  onChange={(e) =>
                    handleFieldChange(fieldKey, e.target.value)
                  }
                  rows={3}
                  className={`text-sm ${
                    severity === "error"
                      ? "border-red-300 focus-visible:ring-red-400"
                      : severity === "warning"
                        ? "border-amber-300 focus-visible:ring-amber-400"
                        : "border-green-200 focus-visible:ring-green-400"
                  }`}
                  placeholder={
                    severity !== "ok"
                      ? `Enter ${label.toLowerCase()} information...`
                      : undefined
                  }
                />

                {severity === "error" && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Required -- please fill in before continuing</span>
                  </div>
                )}
                {severity === "warning" && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Missing from transcript -- add if known</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Continue button */}
      <div className="space-y-2">
        {hasBlockingErrors && (
          <p className="text-xs text-red-600 text-center">
            Fill in required fields (Customer Context and Business Outcomes) to
            continue
          </p>
        )}
        <Button
          onClick={handleContinue}
          disabled={hasBlockingErrors}
          className="w-full cursor-pointer gap-2"
        >
          Continue to Brief Generation
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Severity Badge component
// ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: FieldSeverity }) {
  if (severity === "error") {
    return (
      <Badge
        variant="destructive"
        className="text-xs gap-1 font-normal"
      >
        <AlertTriangle className="h-3 w-3" />
        Required
      </Badge>
    );
  }
  if (severity === "warning") {
    return (
      <Badge
        variant="outline"
        className="text-xs gap-1 font-normal border-amber-400 text-amber-700 bg-amber-50"
      >
        <AlertTriangle className="h-3 w-3" />
        Missing
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-xs gap-1 font-normal border-green-400 text-green-700 bg-green-50"
    >
      <CheckCircle className="h-3 w-3" />
      Extracted
    </Badge>
  );
}
