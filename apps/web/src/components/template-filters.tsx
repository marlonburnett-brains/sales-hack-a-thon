"use client";

import { STATUS_CONFIG, TOUCH_TYPES, type TemplateStatus } from "@/lib/template-utils";

interface TemplateFiltersProps {
  statusFilters: TemplateStatus[];
  touchTypeFilters: string[];
  onStatusChange: (filters: TemplateStatus[]) => void;
  onTouchTypeChange: (filters: string[]) => void;
}

export function TemplateFilters({
  statusFilters,
  touchTypeFilters,
  onStatusChange,
  onTouchTypeChange,
}: TemplateFiltersProps) {
  function toggleStatus(status: TemplateStatus) {
    if (statusFilters.includes(status)) {
      onStatusChange(statusFilters.filter((s) => s !== status));
    } else {
      onStatusChange([...statusFilters, status]);
    }
  }

  function toggleTouchType(type: string) {
    if (touchTypeFilters.includes(type)) {
      onTouchTypeChange(touchTypeFilters.filter((t) => t !== type));
    } else {
      onTouchTypeChange([...touchTypeFilters, type]);
    }
  }

  const statusKeys = Object.keys(STATUS_CONFIG) as TemplateStatus[];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-slate-500">Status:</span>
        {statusKeys.map((status) => {
          const config = STATUS_CONFIG[status];
          const active = statusFilters.includes(status);
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                active
                  ? config.className
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-slate-200" />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-slate-500">Touch:</span>
        {TOUCH_TYPES.map((type) => {
          const active = touchTypeFilters.includes(type.value);
          return (
            <button
              key={type.value}
              onClick={() => toggleTouchType(type.value)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                active
                  ? "border-blue-300 bg-blue-100 text-blue-800"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {type.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
