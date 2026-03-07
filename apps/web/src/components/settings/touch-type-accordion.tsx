"use client";

import { useCallback, useState } from "react";
import { Layers } from "lucide-react";
import Link from "next/link";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { ConfidenceBadge } from "./confidence-badge";
import { SectionFlow } from "./section-flow";
import { ChatBar } from "./chat-bar";
import type {
  DeckStructureDetail,
  DeckSectionData,
} from "@/lib/api-client";

interface TouchTypeAccordionProps {
  touchType: string;
  structure: DeckStructureDetail | null;
  slideIdToThumbnail: Record<string, string>;
}

const TOUCH_TYPE_LABELS: Record<string, string> = {
  touch_1: "Touch 1",
  touch_2: "Touch 2",
  touch_3: "Touch 3",
  touch_4: "Touch 4",
  pre_call: "Pre-Call",
};

export function TouchTypeAccordion({
  touchType,
  structure,
  slideIdToThumbnail,
}: TouchTypeAccordionProps) {
  const label = TOUCH_TYPE_LABELS[touchType] ?? touchType;
  const hasData = structure && structure.exampleCount > 0;
  const sections = structure?.structure.sections ?? [];

  const [localSections, setLocalSections] = useState<DeckSectionData[]>(sections);
  const [localRationale, setLocalRationale] = useState(
    structure?.structure.sequenceRationale ?? "",
  );
  const [diff, setDiff] = useState<{ added: string[]; modified: string[] } | undefined>();

  // Update sections when structure prop changes
  // (Only update if not in the middle of a local diff animation)
  const effectiveSections = diff ? localSections : sections;
  const effectiveRationale = diff
    ? localRationale
    : structure?.structure.sequenceRationale ?? "";

  const handleStructureUpdate = useCallback(
    (
      newStructure: { sections: DeckSectionData[]; sequenceRationale: string },
      newDiff: { added: string[]; modified: string[] },
    ) => {
      setLocalSections(newStructure.sections);
      setLocalRationale(newStructure.sequenceRationale);
      setDiff(newDiff);

      // Clear diff highlights after 3 seconds
      setTimeout(() => setDiff(undefined), 3000);
    },
    [],
  );

  return (
    <AccordionItem value={touchType}>
      <AccordionTrigger className="hover:no-underline px-1">
        <div className="flex flex-1 items-center justify-between pr-2">
          <span className="text-base font-medium text-slate-900">
            {label}
          </span>
          {structure && (
            <ConfidenceBadge
              score={structure.confidence}
              exampleCount={structure.exampleCount}
              color={structure.confidenceColor}
              label={structure.confidenceLabel}
            />
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-1">
        <div className="relative">
          {hasData ? (
            <>
              {/* Section flow visualization */}
              <SectionFlow
                sections={effectiveSections}
                slideIdToThumbnail={slideIdToThumbnail}
                diff={diff}
              />

              {/* Sequence rationale */}
              {effectiveRationale && (
                <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600 italic">
                  {effectiveRationale}
                </div>
              )}

              {/* Chat bar */}
              <div className="mt-4">
                <ChatBar
                  touchType={touchType}
                  onStructureUpdate={handleStructureUpdate}
                  initialMessages={structure?.chatMessages}
                />
              </div>
            </>
          ) : (
            <>
              {/* Empty state */}
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="mb-3 h-12 w-12 text-slate-300" />
                <h3 className="text-base font-medium text-slate-900">
                  No examples classified for {label} yet
                </h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Classify presentations as examples and assign touch types on
                  the Templates page to enable AI inference.
                </p>
                <Link
                  href="/templates"
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Go to Templates
                </Link>
              </div>

              {/* Disabled chat bar */}
              <ChatBar
                touchType={touchType}
                onStructureUpdate={handleStructureUpdate}
                disabled
              />
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
