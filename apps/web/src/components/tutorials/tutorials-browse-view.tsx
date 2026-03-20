"use client";

import type { TutorialBrowseResponse } from "@/lib/api-client";
import { TutorialsPageHeader } from "@/components/tutorials/tutorials-page-header";
import { TutorialCategorySection } from "@/components/tutorials/tutorial-category-section";

interface TutorialsBrowseViewProps {
  data: TutorialBrowseResponse;
}

export function TutorialsBrowseView({ data }: TutorialsBrowseViewProps) {
  const { overall, categories } = data;

  return (
    <div className="space-y-8">
      <TutorialsPageHeader
        completedCount={overall.completedCount}
        totalCount={overall.totalCount}
        completionPercent={overall.completionPercent}
      />

      {categories.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <p className="text-sm text-slate-500">No tutorials available yet.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {categories.map((category) => (
            <TutorialCategorySection key={category.key} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
