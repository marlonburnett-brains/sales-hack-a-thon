import { Skeleton } from "@/components/ui/skeleton";

export default function TutorialsLoading() {
  return (
    <div className="space-y-8">
      {/* Page header skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Category sections skeleton */}
      <div className="space-y-10">
        {Array.from({ length: 3 }).map((_, sectionIdx) => (
          <div key={sectionIdx} className="space-y-4">
            {/* Section header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>

            {/* Card grid skeleton */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  {/* Thumbnail skeleton */}
                  <Skeleton className="aspect-video w-full rounded-none" />
                  {/* Card body skeleton */}
                  <div className="space-y-1.5 p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
