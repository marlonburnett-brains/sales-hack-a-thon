"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface DealStatusFilterProps {
  currentStatus: string;
  dealCount: number;
}

const STATUS_OPTIONS = [
  {
    value: "open",
    label: "Open",
    activeClass: "border-blue-300 bg-blue-100 text-blue-800",
  },
  {
    value: "won",
    label: "Won",
    activeClass: "border-emerald-300 bg-emerald-100 text-emerald-800",
  },
  {
    value: "lost",
    label: "Lost",
    activeClass: "border-red-300 bg-red-100 text-red-800",
  },
  {
    value: "abandoned",
    label: "Abandoned",
    activeClass: "border-slate-400 bg-slate-200 text-slate-700",
  },
  {
    value: "all",
    label: "All",
    activeClass: "border-violet-300 bg-violet-100 text-violet-800",
  },
] as const;

export function DealStatusFilter({
  currentStatus,
  dealCount,
}: DealStatusFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function handleStatusClick(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="mr-1 text-xs font-medium text-slate-500">
        Deals <span className="text-slate-400">({dealCount})</span>
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_OPTIONS.map((option) => {
          const active = currentStatus === option.value;
          return (
            <button
              key={option.value}
              onClick={() => handleStatusClick(option.value)}
              className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                active
                  ? option.activeClass
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
