import { Skeleton } from "@/components/ui/skeleton";

export default function SlideViewerLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-4 pt-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Slide viewer layout */}
      <div className="flex gap-6">
        {/* Slide thumbnails sidebar */}
        <div className="hidden w-48 shrink-0 space-y-3 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>

        {/* Main slide area */}
        <div className="flex-1 space-y-4">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
