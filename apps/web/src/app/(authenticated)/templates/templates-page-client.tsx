"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  LayoutTemplate,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TemplateForm } from "@/components/template-form";
import { TemplateCard } from "@/components/template-card";
import { TemplateTable } from "@/components/template-table";
import { TemplateFilters } from "@/components/template-filters";
import { getTemplateStatus, type TemplateStatus } from "@/lib/template-utils";
import {
  listTemplatesAction,
  checkStalenessAction,
  triggerIngestionAction,
} from "@/lib/actions/template-actions";
import type { Template } from "@/lib/api-client";

type ViewMode = "grid" | "table";

const VIEW_MODE_KEY = "template-view-mode";

interface TemplatesPageClientProps {
  initialTemplates: Template[];
}

function parseTouchTypes(touchTypes: string): string[] {
  try {
    return JSON.parse(touchTypes);
  } catch {
    return [];
  }
}

export function TemplatesPageClient({
  initialTemplates,
}: TemplatesPageClientProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilters, setStatusFilters] = useState<TemplateStatus[]>([]);
  const [touchTypeFilters, setTouchTypeFilters] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "grid" || stored === "table") {
      setViewMode(stored);
    }
  }, []);

  function handleViewChange(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  const refreshTemplates = useCallback(async () => {
    try {
      const updated = await listTemplatesAction();
      setTemplates(updated);
    } catch {
      // silently fail
    }
  }, []);

  const handleTemplateCreated = useCallback(
    async (result?: { template: { id: string; accessStatus: string } }) => {
      await refreshTemplates();
      // Auto-trigger ingestion if the template has confirmed access
      if (result?.template.accessStatus === "accessible") {
        try {
          await triggerIngestionAction(result.template.id);
          // Refresh again to pick up queued status
          await refreshTemplates();
        } catch {
          // Ingestion trigger failed silently -- user can still see the template
        }
      }
    },
    [refreshTemplates]
  );

  async function handleRefreshStatus() {
    setIsRefreshing(true);
    try {
      const accessible = templates.filter(
        (t) => t.accessStatus !== "not_accessible"
      );
      await Promise.all(
        accessible.map((t) => checkStalenessAction(t.id))
      );
      await refreshTemplates();
      toast.success("Status refreshed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh status"
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const filtered = templates.filter((t) => {
    if (statusFilters.length > 0) {
      const status = getTemplateStatus(t);
      if (!statusFilters.includes(status)) return false;
    }
    if (touchTypeFilters.length > 0) {
      const types = parseTouchTypes(t.touchTypes);
      if (!touchTypeFilters.some((f) => types.includes(f))) return false;
    }
    return true;
  });

  const isEmpty = templates.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="text-sm text-slate-500">
            Manage your Google Slides templates for proposal generation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEmpty && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefreshStatus}
                disabled={isRefreshing}
                className="cursor-pointer"
                title="Refresh template statuses"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </Button>

              {/* View toggle */}
              <div className="flex rounded-md border border-slate-200">
                <button
                  onClick={() => handleViewChange("grid")}
                  className={`cursor-pointer rounded-l-md px-2.5 py-1.5 transition-colors ${
                    viewMode === "grid"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="Grid view"
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleViewChange("table")}
                  className={`cursor-pointer rounded-r-md px-2.5 py-1.5 transition-colors ${
                    viewMode === "table"
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="Table view"
                  aria-label="Table view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          <TemplateForm onSuccess={handleTemplateCreated}>
            <Button className="cursor-pointer gap-2">
              <Plus className="h-4 w-4" />
              Add Template
            </Button>
          </TemplateForm>
        </div>
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 py-16">
          <LayoutTemplate className="mb-4 h-12 w-12 text-slate-300" />
          <h2 className="text-lg font-semibold text-slate-700">
            No templates yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add your first Google Slides template to get started
          </p>
          <TemplateForm onSuccess={handleTemplateCreated}>
            <Button className="mt-4 cursor-pointer gap-2">
              <Plus className="h-4 w-4" />
              Add Template
            </Button>
          </TemplateForm>
        </div>
      ) : (
        <>
          {/* Filters */}
          <TemplateFilters
            statusFilters={statusFilters}
            touchTypeFilters={touchTypeFilters}
            onStatusChange={setStatusFilters}
            onTouchTypeChange={setTouchTypeFilters}
          />

          {/* Content */}
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No templates match the selected filters
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDeleted={refreshTemplates}
                  onRefresh={refreshTemplates}
                />
              ))}
            </div>
          ) : (
            <TemplateTable
              templates={filtered}
              onDeleted={refreshTemplates}
            />
          )}
        </>
      )}
    </div>
  );
}
