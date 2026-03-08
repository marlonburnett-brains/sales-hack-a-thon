"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

interface DealViewToggleProps {
  currentView: string;
}

export function DealViewToggle({ currentView }: DealViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function handleViewChange(view: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex rounded-lg border border-slate-200 p-0.5">
      <button
        onClick={() => handleViewChange("grid")}
        className={`cursor-pointer rounded-md p-1.5 transition-colors duration-200 ${
          currentView === "grid"
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-500 hover:bg-slate-50"
        }`}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleViewChange("table")}
        className={`cursor-pointer rounded-md p-1.5 transition-colors duration-200 ${
          currentView === "table"
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-500 hover:bg-slate-50"
        }`}
        aria-label="Table view"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
