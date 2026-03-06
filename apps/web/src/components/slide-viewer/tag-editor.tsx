"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INDUSTRIES,
  SOLUTION_PILLARS,
  BUYER_PERSONAS,
  FUNNEL_STAGES,
  CONTENT_TYPES,
  SLIDE_CATEGORIES,
} from "@lumenalta/schemas";
import type { CorrectedTags } from "@/lib/actions/slide-actions";

interface TagEditorProps {
  currentTags: CorrectedTags;
  onSave: (tags: CorrectedTags) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function MultiTagField({
  label,
  values,
  options,
  onChange,
  colorClasses,
}: {
  label: string;
  values: string[];
  options: readonly string[];
  onChange: (values: string[]) => void;
  colorClasses: string;
}) {
  const available = options.filter((o) => !values.includes(o));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {/* Selected chips */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <span
              key={v}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${colorClasses}`}
            >
              {v}
              <button
                type="button"
                className="cursor-pointer rounded-full hover:bg-black/10"
                onClick={() => onChange(values.filter((val) => val !== v))}
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Add dropdown */}
      {available.length > 0 && (
        <Select
          onValueChange={(val) => onChange([...values, val])}
          value=""
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={`Add ${label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {available.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function SingleTagField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TagEditor({
  currentTags,
  onSave,
  onCancel,
  isSaving,
}: TagEditorProps) {
  const [tags, setTags] = useState<CorrectedTags>({ ...currentTags });

  return (
    <div className="space-y-3">
      <MultiTagField
        label="Industry"
        values={tags.industries}
        options={INDUSTRIES}
        onChange={(v) => setTags((prev) => ({ ...prev, industries: v }))}
        colorClasses="border-blue-200 bg-blue-50 text-blue-700"
      />
      <MultiTagField
        label="Solution Pillar"
        values={tags.solutionPillars}
        options={SOLUTION_PILLARS}
        onChange={(v) => setTags((prev) => ({ ...prev, solutionPillars: v }))}
        colorClasses="border-purple-200 bg-purple-50 text-purple-700"
      />
      <MultiTagField
        label="Buyer Persona"
        values={tags.buyerPersonas}
        options={BUYER_PERSONAS}
        onChange={(v) => setTags((prev) => ({ ...prev, buyerPersonas: v }))}
        colorClasses="border-green-200 bg-green-50 text-green-700"
      />
      <MultiTagField
        label="Funnel Stage"
        values={tags.funnelStages}
        options={FUNNEL_STAGES}
        onChange={(v) => setTags((prev) => ({ ...prev, funnelStages: v }))}
        colorClasses="border-amber-200 bg-amber-50 text-amber-700"
      />
      <SingleTagField
        label="Content Type"
        value={tags.contentType}
        options={CONTENT_TYPES}
        onChange={(v) => setTags((prev) => ({ ...prev, contentType: v }))}
      />
      <SingleTagField
        label="Slide Category"
        value={tags.slideCategory}
        options={SLIDE_CATEGORIES}
        onChange={(v) => setTags((prev) => ({ ...prev, slideCategory: v }))}
      />

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          className="cursor-pointer"
          onClick={() => onSave(tags)}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save Corrections"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
