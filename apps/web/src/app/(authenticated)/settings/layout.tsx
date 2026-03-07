"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Layers, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

const TOUCH_TYPE_ITEMS = [
  { slug: "touch-1", label: "Touch 1" },
  { slug: "touch-2", label: "Touch 2" },
  { slug: "touch-3", label: "Touch 3" },
  { slug: "touch-4", label: "Touch 4" },
  { slug: "pre-call", label: "Pre-Call" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDeckStructures = pathname.startsWith("/settings/deck-structures");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Settings</h1>

      <div className="flex gap-6">
        {/* Left vertical tabs */}
        <nav className="w-52 shrink-0 border-r border-slate-200 pr-4">
          <div className="space-y-0.5">
            {/* Deck Structures section */}
            <Link
              href="/settings/deck-structures"
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                isDeckStructures
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Layers className="h-4 w-4 shrink-0" />
              <span>Deck Structures</span>
            </Link>

            {/* Touch type sub-items */}
            {isDeckStructures && (
              <div className="ml-6 space-y-0.5 border-l border-slate-200 pl-2">
                {TOUCH_TYPE_ITEMS.map(({ slug, label }) => {
                  const href = `/settings/deck-structures/${slug}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={slug}
                      href={href}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        active
                          ? "bg-blue-50 font-medium text-blue-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                      )}
                    >
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Integrations */}
            <Link
              href="/settings/integrations"
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                pathname.startsWith("/settings/integrations")
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Plug className="h-4 w-4 shrink-0" />
              <span>Integrations</span>
            </Link>
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
