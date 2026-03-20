"use client";

import {
  Rocket,
  Briefcase,
  Hand,
  Layers3,
  ClipboardCheck,
  Settings2,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TutorialCard } from "./tutorial-card";
import type { TutorialBrowseCategory } from "@/lib/api-client";

const ICON_MAP: Record<string, LucideIcon> = {
  getting_started: Rocket,
  sales_process: Briefcase,
  customer_success: Hand,
  product_features: Layers3,
  best_practices: ClipboardCheck,
  settings: Settings2,
};

function getIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? Layers3;
}

interface TutorialCategorySectionProps {
  category: TutorialBrowseCategory;
}

export function TutorialCategorySection({
  category,
}: TutorialCategorySectionProps) {
  const { key, label, tutorialCount, watchedCount, completionPercent, tutorials } =
    category;

  const Icon = getIcon(key);
  const isComplete = tutorialCount > 0 && watchedCount === tutorialCount;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">{label}</h2>
            {isComplete && (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <span className="text-sm text-slate-500">
            {isComplete ? (
              <>
                {watchedCount} of {tutorialCount} &ndash; Complete!
              </>
            ) : (
              <>
                {watchedCount} of {tutorialCount}
              </>
            )}
          </span>
        </div>
        <Progress
          value={completionPercent}
          className={`h-1.5 ${isComplete ? "bg-emerald-100 [&>*]:bg-emerald-500" : ""}`}
        />
      </div>

      {/* Tutorial cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tutorials.map((tutorial) => (
          <TutorialCard key={tutorial.id} tutorial={tutorial} />
        ))}
      </div>
    </section>
  );
}
