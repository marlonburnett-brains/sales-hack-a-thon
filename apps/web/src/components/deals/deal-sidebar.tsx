"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Hash,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Deal, InteractionRecord } from "@/lib/api-client";

interface DealSidebarProps {
  deal: Deal;
  dealId: string;
}

type TouchStatus = "completed" | "in_progress" | "not_started";

function getTouchStatus(
  interactions: InteractionRecord[],
  touchType: string
): TouchStatus {
  const touchInteractions = interactions.filter(
    (i) => i.touchType === touchType
  );
  if (touchInteractions.length === 0) return "not_started";
  const hasCompleted = touchInteractions.some(
    (i) =>
      i.status === "approved" ||
      i.status === "edited" ||
      i.status === "overridden" ||
      i.status === "delivered"
  );
  if (hasCompleted) return "completed";
  return "in_progress";
}

function TouchStatusIndicator({ status }: { status: TouchStatus }) {
  if (status === "completed") {
    return <Check className="h-3 w-3 text-green-600" />;
  }
  if (status === "in_progress") {
    return <span className="h-2 w-2 rounded-full bg-amber-400" />;
  }
  return <span className="h-2 w-2 rounded-full bg-slate-200" />;
}

const statusVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  won: "default",
  lost: "destructive",
  abandoned: "secondary",
};

const navItems = [
  { label: "Overview", path: "overview", icon: LayoutDashboard },
  { label: "Briefing", path: "briefing", icon: FileText },
];

const touchItems = [
  { label: "Touch 1", path: "touch/1", touchType: "touch_1" },
  { label: "Touch 2", path: "touch/2", touchType: "touch_2" },
  { label: "Touch 3", path: "touch/3", touchType: "touch_3" },
  { label: "Touch 4", path: "touch/4", touchType: "touch_4" },
];

export function DealSidebar({ deal, dealId }: DealSidebarProps) {
  const pathname = usePathname();
  const interactions = deal.interactions ?? [];
  const basePath = `/deals/${dealId}`;

  function isActive(itemPath: string) {
    return pathname === `${basePath}/${itemPath}` ||
      pathname.startsWith(`${basePath}/${itemPath}/`);
  }

  const linkClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-150 cursor-pointer ${
      active
        ? "bg-slate-100 font-medium text-slate-900"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <aside className="hidden w-[200px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      {/* Deal header */}
      <div className="border-b border-slate-200 px-4 py-3">
        <p
          className="truncate text-sm font-medium text-slate-900"
          title={deal.company?.name ?? deal.name}
        >
          {deal.company?.name ?? deal.name}
        </p>
        <Badge
          variant={statusVariantMap[deal.status] ?? "secondary"}
          className="mt-1 text-xs capitalize"
        >
          {deal.status}
        </Badge>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Deal navigation">
        {navItems.map(({ label, path, icon: Icon }) => (
          <Link
            key={path}
            href={`${basePath}/${path}`}
            className={linkClass(isActive(path))}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        ))}

        <div className="my-2 border-t border-slate-100" />

        {touchItems.map(({ label, path, touchType }) => {
          const status = getTouchStatus(interactions, touchType);
          return (
            <Link
              key={path}
              href={`${basePath}/${path}`}
              className={linkClass(isActive(path))}
            >
              <Hash className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <TouchStatusIndicator status={status} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
