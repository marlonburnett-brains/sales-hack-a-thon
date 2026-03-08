"use client";

import { DealCard } from "./deal-card";
import type { Deal } from "@/lib/api-client";
import { FileText, Filter } from "lucide-react";

interface DealDashboardProps {
  deals: Deal[];
  isFiltered?: boolean;
}

export function DealDashboard({ deals, isFiltered }: DealDashboardProps) {
  if (deals.length === 0) {
    if (isFiltered) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16">
          <Filter className="h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-lg font-medium text-slate-900">
            No deals match your filters
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Try adjusting your status or assignee filters
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16">
        <FileText className="h-12 w-12 text-slate-400" />
        <h3 className="mt-4 text-lg font-medium text-slate-900">
          No deals yet
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Create your first deal to start generating GTM assets.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  );
}
