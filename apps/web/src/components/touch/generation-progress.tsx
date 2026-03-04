import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

interface GenerationProgressProps {
  message: string;
}

export function GenerationProgress({ message }: GenerationProgressProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
      <div className="w-full space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
