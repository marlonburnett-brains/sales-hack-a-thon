"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  Type,
  Image,
  Square,
  Table2,
  Group,
} from "lucide-react";
import type { SlideElementData } from "@/lib/actions/slide-actions";

// EMU to inches conversion (1 inch = 914400 EMU)
const EMU_PER_INCH = 914_400;
function emuToInches(emu: number): string {
  return (emu / EMU_PER_INCH).toFixed(1);
}

function elementTypeIcon(type: string) {
  switch (type) {
    case "text":
      return <Type className="h-3.5 w-3.5 text-blue-500" />;
    case "image":
      return <Image className="h-3.5 w-3.5 text-green-500" />;
    case "table":
      return <Table2 className="h-3.5 w-3.5 text-purple-500" />;
    case "group":
      return <Group className="h-3.5 w-3.5 text-orange-500" />;
    case "shape":
    default:
      return <Square className="h-3.5 w-3.5 text-slate-500" />;
  }
}

interface ElementMapPanelProps {
  elements: SlideElementData[];
}

export function ElementMapPanel({ elements }: ElementMapPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedElements = useMemo(
    () => [...elements].sort((a, b) => a.positionY - b.positionY || a.positionX - b.positionX),
    [elements]
  );

  return (
    <div className="border-t border-slate-200 pt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between py-1 text-left cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Elements ({elements.length})
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? "" : "-rotate-90"
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1">
          {sortedElements.length === 0 ? (
            <p className="text-sm italic text-slate-400">No element data available</p>
          ) : (
            sortedElements.map((el) => {
              const isExpanded = expandedId === el.id;
              const preview = el.contentText
                ? el.contentText.length > 50
                  ? el.contentText.slice(0, 50) + "..."
                  : el.contentText
                : "";

              return (
                <div
                  key={el.id}
                  className="rounded-md border border-slate-100 bg-slate-50/50"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left cursor-pointer hover:bg-slate-100/80 rounded-md transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : el.id)}
                    aria-expanded={isExpanded}
                  >
                    {elementTypeIcon(el.elementType)}
                    <span className="text-xs font-medium text-slate-600 capitalize">
                      {el.elementType}
                    </span>
                    <span className="flex-1 truncate text-xs text-slate-400" title={el.elementId}>
                      {el.elementId.length > 12
                        ? el.elementId.slice(0, 12) + "..."
                        : el.elementId}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 text-slate-300 transition-transform duration-150 ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="space-y-1.5 px-2 pb-2 pt-1">
                      {preview && (
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                            Content
                          </p>
                          <p className="text-xs text-slate-600 break-words">{el.contentText}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                        <span>
                          x: {emuToInches(el.positionX)}in, y: {emuToInches(el.positionY)}in
                        </span>
                        <span>
                          {emuToInches(el.width)}in x {emuToInches(el.height)}in
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                        {el.fontSize != null && <span>Font: {el.fontSize}pt</span>}
                        {el.fontColor && (
                          <span className="flex items-center gap-1">
                            Color:{" "}
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-200"
                              style={{ backgroundColor: el.fontColor }}
                            />
                            {el.fontColor}
                          </span>
                        )}
                        {el.isBold && (
                          <span className="font-bold text-slate-500">Bold</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
