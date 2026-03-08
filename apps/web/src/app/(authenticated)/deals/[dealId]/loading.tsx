import { Skeleton } from "@/components/ui/skeleton";

export default function DealDetailLoading() {
  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 flex min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar skeleton */}
      <div className="hidden w-[200px] shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-200 px-4 py-3 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="space-y-1 px-2 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 min-w-0">
        <div className="border-b border-slate-200 bg-white px-6 py-3">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="px-6 py-4 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
