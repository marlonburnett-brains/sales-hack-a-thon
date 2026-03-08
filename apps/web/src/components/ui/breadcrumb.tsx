import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  current?: string;
  className?: string;
}

export function Breadcrumb({ items, current, className = "" }: BreadcrumbProps) {
  return (
    <nav
      className={`flex items-center gap-1 text-sm ${className}`}
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-slate-500 hover:text-slate-900 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-500">{item.label}</span>
          )}
        </span>
      ))}
      {current && (
        <span className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium text-slate-900">{current}</span>
        </span>
      )}
    </nav>
  );
}
