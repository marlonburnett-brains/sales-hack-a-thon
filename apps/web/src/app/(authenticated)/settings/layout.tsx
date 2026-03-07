"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Plug } from "lucide-react";

const settingsTabs = [
  { href: "/settings/deck-structures", label: "Deck Structures", icon: Layers },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Settings</h1>

      <div className="flex gap-6">
        {/* Left vertical tabs */}
        <nav className="w-48 shrink-0 border-r border-slate-200 pr-4">
          <div className="space-y-1">
            {settingsTabs.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    active
                      ? "bg-slate-100 font-medium text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
