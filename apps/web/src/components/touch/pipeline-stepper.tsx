"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";

export interface PipelineStep {
  id: string;
  label: string;
}

export interface PipelineStepperProps {
  steps: PipelineStep[];
  completedStepIds: Set<string>;
  activeStepId: string | null;
  errorStepId: string | null;
  errorMessage: string | null;
}

export function PipelineStepper({
  steps,
  completedStepIds,
  activeStepId,
  errorStepId,
  errorMessage,
}: PipelineStepperProps) {
  return (
    <div className="space-y-3 py-4">
      <ul role="list" aria-label="Pipeline progress" className="space-y-2">
        {steps.map((step) => {
          const isCompleted = completedStepIds.has(step.id);
          const isActive = activeStepId === step.id;
          const isError = errorStepId === step.id;

          return (
            <li key={step.id} className="flex items-center gap-2.5">
              {isCompleted ? (
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
              ) : isError ? (
                <XCircle className="h-4 w-4 flex-shrink-0 text-red-600" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-600" />
              ) : (
                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                </span>
              )}
              <span
                className={
                  isCompleted
                    ? "text-sm text-green-700"
                    : isError
                      ? "text-sm font-medium text-red-700"
                      : isActive
                        ? "text-sm font-medium text-blue-700"
                        : "text-sm text-slate-400"
                }
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      {errorMessage && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
