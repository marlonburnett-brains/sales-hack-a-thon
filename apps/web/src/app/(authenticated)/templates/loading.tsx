import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Template cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-6 space-y-3"
          >
            <div className="flex items-start justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-8" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
