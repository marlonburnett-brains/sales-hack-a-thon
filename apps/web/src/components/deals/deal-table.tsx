"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { StackedAvatars } from "./stacked-avatars";
import { FileX } from "lucide-react";
import type { Deal } from "@/lib/api-client";

interface DealTableProps {
  deals: Deal[];
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
  abandoned: "bg-slate-200 text-slate-700",
};

function parseCollaborators(
  collaborators: string
): Array<{ id?: string; email: string; name?: string }> {
  try {
    return JSON.parse(collaborators);
  } catch {
    return [];
  }
}

function TouchIndicatorSmall({
  touchNumber,
  completed,
}: {
  touchNumber: number;
  completed: boolean;
}) {
  return (
    <div
      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
        completed
          ? "bg-blue-600 text-white"
          : "border border-slate-300 text-slate-400"
      }`}
    >
      {touchNumber}
    </div>
  );
}

export function DealTable({ deals }: DealTableProps) {
  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16">
        <FileX className="h-12 w-12 text-slate-400" />
        <h3 className="mt-4 text-lg font-medium text-slate-900">
          No deals match your filters
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Try adjusting your status filters to see more deals.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left font-medium text-slate-600">
              Company
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">
              Deal Name
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">
              Status
            </th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
              Owner
            </th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 lg:table-cell">
              Collaborators
            </th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
              Last Activity
            </th>
            <th className="hidden px-4 py-3 text-left font-medium text-slate-600 lg:table-cell">
              Progress
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
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
            const collabs = parseCollaborators(deal.collaborators);
            const people: Array<{ id?: string; email: string; name?: string }> =
              [];
            if (deal.ownerEmail) {
              people.push({
                id: deal.ownerId ?? undefined,
                email: deal.ownerEmail,
                name: deal.ownerName ?? undefined,
              });
            }
            people.push(...collabs);

            return (
              <tr
                key={deal.id}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/deals/${deal.id}`}
                    className="font-medium text-slate-900 hover:text-blue-600"
                  >
                    {deal.company?.name ?? "Unknown Company"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{deal.name}</td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      STATUS_BADGE_CLASSES[deal.status] ??
                      "bg-slate-100 text-slate-600"
                    }
                  >
                    {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                  </Badge>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  {deal.ownerName || deal.ownerEmail || "--"}
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <StackedAvatars people={people} />
                </td>
                <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                  {lastActivity
                    ? formatDistanceToNow(new Date(lastActivity), {
                        addSuffix: true,
                      })
                    : "--"}
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((n) => (
                      <TouchIndicatorSmall
                        key={n}
                        touchNumber={n}
                        completed={completedTouches.has(`touch_${n}`)}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
