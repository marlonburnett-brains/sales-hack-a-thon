import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import {
  GenerationLogFeed,
  type GenerationLogEntry,
} from "./generation-log-feed";

interface GenerationProgressProps {
  message: string;
  logs?: GenerationLogEntry[];
}

export function GenerationProgress({ message, logs }: GenerationProgressProps) {
  const hasLogs = logs && logs.length > 0;

  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
      {hasLogs ? (
        <div className="w-full pt-2">
          <GenerationLogFeed logs={logs} />
        </div>
      ) : (
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}
    </div>
  );
}
