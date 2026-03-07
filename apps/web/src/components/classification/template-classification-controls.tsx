"use client";

import { useMemo, useState } from "react";
import {
  ARTIFACT_TYPES,
  ARTIFACT_TYPE_LABELS,
  type ArtifactType,
} from "@lumenalta/schemas";
import { Button } from "@/components/ui/button";
import { TOUCH_TYPES } from "@/lib/template-utils";

type ClassificationType = "template" | "example";

export interface TemplateClassificationValues {
  classification: ClassificationType;
  touchTypes: string[];
  artifactType: ArtifactType | null;
}

interface TemplateClassificationControlsProps {
  initialClassification?: ClassificationType;
  initialTouchTypes?: string[];
  initialArtifactType?: ArtifactType | null;
  isSaving?: boolean;
  onCancel?: () => void;
  onSave: (values: TemplateClassificationValues) => void | Promise<void>;
}

export function TemplateClassificationControls({
  initialClassification = "template",
  initialTouchTypes = [],
  initialArtifactType = null,
  isSaving = false,
  onCancel,
  onSave,
}: TemplateClassificationControlsProps) {
  const [classification, setClassification] =
    useState<ClassificationType>(initialClassification);
  const [touchTypes, setTouchTypes] = useState<string[]>(initialTouchTypes);
  const [artifactType, setArtifactType] = useState<ArtifactType | null>(
    initialClassification === "example" && initialTouchTypes[0] === "touch_4"
      ? initialArtifactType
      : null,
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const isExample = classification === "example";
  const selectedTouch = isExample ? touchTypes[0] ?? null : null;
  const showArtifactType = selectedTouch === "touch_4";

  const normalizedArtifactType = useMemo(
    () => (showArtifactType ? artifactType : null),
    [artifactType, showArtifactType],
  );

  function updateClassification(next: ClassificationType) {
    setClassification(next);
    setValidationMessage(null);

    if (next === "template") {
      setArtifactType(null);
    } else {
      setTouchTypes((current) => current.slice(0, 1));
    }
  }

  function toggleTemplateTouch(value: string) {
    setTouchTypes((current) => {
      const next = current.includes(value)
        ? current.filter((touch) => touch !== value)
        : [...current, value];
      return next;
    });
    setValidationMessage(null);
  }

  function selectExampleTouch(value: string) {
    setTouchTypes([value]);
    setValidationMessage(null);

    if (value !== "touch_4") {
      setArtifactType(null);
    }
  }

  function selectArtifact(value: ArtifactType) {
    setArtifactType(value);
    setValidationMessage(null);
  }

  async function handleSave() {
    if (isExample && !selectedTouch) {
      setValidationMessage("Select one touch type for examples.");
      return;
    }

    if (showArtifactType && !artifactType) {
      setValidationMessage("Select an artifact type for Touch 4 examples.");
      return;
    }

    setValidationMessage(null);
    await onSave({
      classification,
      touchTypes,
      artifactType: normalizedArtifactType,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            classification === "template"
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
          onClick={() => updateClassification("template")}
        >
          Template
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            classification === "example"
              ? "border-purple-300 bg-purple-50 text-purple-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
          onClick={() => updateClassification("example")}
        >
          Example
        </button>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-slate-500">
          Touch types {isExample ? <span className="text-red-500">*</span> : null}
        </legend>
        <div
          role={isExample ? "radiogroup" : undefined}
          aria-label={isExample ? "Touch types" : undefined}
          className="space-y-1.5"
        >
          {TOUCH_TYPES.map((touch) => {
            const checked = touchTypes.includes(touch.value);

            return (
              <label
                key={touch.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-xs text-slate-700"
              >
                <input
                  type={isExample ? "radio" : "checkbox"}
                  name={isExample ? "touchType" : touch.value}
                  value={touch.value}
                  checked={checked}
                  onChange={() =>
                    isExample
                      ? selectExampleTouch(touch.value)
                      : toggleTemplateTouch(touch.value)
                  }
                />
                <span>{touch.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {isExample && showArtifactType ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-500">
            Artifact type <span className="text-red-500">*</span>
          </legend>
          <div role="radiogroup" aria-label="Artifact type" className="grid gap-2">
            {ARTIFACT_TYPES.map((value) => {
              const checked = artifactType === value;

              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    checked
                      ? "border-purple-300 bg-purple-50 text-purple-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="artifactType"
                    value={value}
                    checked={checked}
                    onChange={() => selectArtifact(value)}
                  />
                  <span>{ARTIFACT_TYPE_LABELS[value]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {validationMessage ? (
        <p className="text-xs font-medium text-red-600">{validationMessage}</p>
      ) : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 cursor-pointer"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
        {onCancel ? (
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
