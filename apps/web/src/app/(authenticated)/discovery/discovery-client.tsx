"use client";

import { Brain } from "lucide-react";
import type { BrowseResult } from "@/lib/actions/discovery-actions";

interface DiscoveryClientProps {
  initialBrowse: BrowseResult;
}

export function DiscoveryClient({ initialBrowse }: DiscoveryClientProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-semibold text-slate-900">
          AtlusAI Discovery
        </h1>
      </div>

      <p className="text-sm text-slate-500">
        Browse and search coming in Plan 02.{" "}
        {initialBrowse.documents.length > 0
          ? `${initialBrowse.documents.length} documents loaded.`
          : "No documents available yet."}
      </p>
    </div>
  );
}
