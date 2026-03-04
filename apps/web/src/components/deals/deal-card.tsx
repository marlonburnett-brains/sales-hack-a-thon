import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import type { Deal } from "@/lib/api-client";

interface DealCardProps {
  deal: Deal;
}

function TouchIndicator({
  touchNumber,
  completed,
}: {
  touchNumber: number;
  completed: boolean;
}) {
  return (
    <div
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
        completed
          ? "bg-blue-600 text-white"
          : "border border-slate-300 text-slate-400"
      }`}
      title={`Touch ${touchNumber}${completed ? " (complete)" : ""}`}
    >
      {touchNumber}
    </div>
  );
}

export function DealCard({ deal }: DealCardProps) {
  // Determine which touches have been completed
  const interactions = deal.interactions ?? [];
  const completedTouches = new Set(
    interactions
      .filter(
        (i) =>
          i.status === "approved" ||
          i.status === "edited" ||
          i.status === "overridden"
      )
      .map((i) => i.touchType)
  );

  const lastActivity = interactions[0]?.createdAt;

  return (
    <Link href={`/deals/${deal.id}`} className="block cursor-pointer">
      <Card className="transition-colors duration-200 hover:border-blue-300 hover:shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              {deal.company?.name ?? "Unknown Company"}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {deal.company?.industry ?? ""}
            </Badge>
          </div>
          <p className="text-sm text-slate-500">{deal.name}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <TouchIndicator
                touchNumber={1}
                completed={completedTouches.has("touch_1")}
              />
              <TouchIndicator
                touchNumber={2}
                completed={completedTouches.has("touch_2")}
              />
              <TouchIndicator
                touchNumber={3}
                completed={completedTouches.has("touch_3")}
              />
            </div>
            {lastActivity && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                <span>
                  {new Date(lastActivity).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
