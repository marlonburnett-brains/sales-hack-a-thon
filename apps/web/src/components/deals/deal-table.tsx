"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { StackedAvatars } from "./stacked-avatars";
import { DealStatusAction } from "./deal-status-action";
import { DealAssignmentPicker } from "./deal-assignment-picker";
import { FileX } from "lucide-react";
import type { Deal, KnownUser } from "@/lib/api-client";

interface DealTableProps {
  deals: Deal[];
  knownUsers: KnownUser[];
}


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

export function DealTable({ deals, knownUsers }: DealTableProps) {
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
                  <div onClick={(e) => e.stopPropagation()}>
                    <DealStatusAction
                      dealId={deal.id}
                      currentStatus={deal.status}
                    />
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  <div onClick={(e) => e.stopPropagation()}>
                    <DealAssignmentPicker
                      dealId={deal.id}
                      currentOwnerId={deal.ownerId}
                      currentOwnerEmail={deal.ownerEmail}
                      currentOwnerName={deal.ownerName}
                      currentCollaborators={collabs}
                      knownUsers={knownUsers}
                    />
                  </div>
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
