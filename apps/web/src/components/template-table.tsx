"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TemplateStatusBadge } from "@/components/template-status-badge";
import { getTemplateStatus } from "@/lib/template-utils";
import { deleteTemplateAction } from "@/lib/actions/template-actions";
import type { Template } from "@/lib/api-client";

interface TemplateTableProps {
  templates: Template[];
  onDeleted?: () => void;
}

type SortKey = "name" | "lastIngestedAt";
type SortDir = "asc" | "desc";

const TOUCH_LABEL_MAP: Record<string, string> = {
  touch_1: "T1",
  touch_2: "T2",
  touch_3: "T3",
  touch_4: "T4+",
};

function parseTouchTypes(touchTypes: string): string[] {
  try {
    return JSON.parse(touchTypes);
  } catch {
    return [];
  }
}

export function TemplateTable({ templates, onDeleted }: TemplateTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...templates].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "name") {
      return a.name.localeCompare(b.name) * dir;
    }
    const aTime = a.lastIngestedAt ? new Date(a.lastIngestedAt).getTime() : 0;
    const bTime = b.lastIngestedAt ? new Date(b.lastIngestedAt).getTime() : 0;
    return (aTime - bTime) * dir;
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTemplateAction(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
      onDeleted?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete template"
      );
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-600">
                <button
                  onClick={() => toggleSort("name")}
                  className="flex cursor-pointer items-center gap-1"
                >
                  Name
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Touch Types
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Status
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
                <button
                  onClick={() => toggleSort("lastIngestedAt")}
                  className="flex cursor-pointer items-center gap-1"
                >
                  Last Ingested
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </th>
              <th className="hidden px-4 py-3 text-left font-medium text-slate-600 md:table-cell">
                Slides
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((template) => {
              const status = getTemplateStatus(template);
              const touchTypes = parseTouchTypes(template.touchTypes);
              const lastIngested = template.lastIngestedAt
                ? formatDistanceToNow(new Date(template.lastIngestedAt), {
                    addSuffix: true,
                  })
                : "Never";

              return (
                <tr
                  key={template.id}
                  className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {template.name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {touchTypes.map((type) => (
                        <span
                          key={type}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
                        >
                          {TOUCH_LABEL_MAP[type] ?? type}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TemplateStatusBadge status={status} />
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                    {lastIngested}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                    {template.slideCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(template)}
                      className="h-8 w-8 cursor-pointer text-slate-400 hover:text-red-600"
                      aria-label={`Delete ${template.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo;? This will also remove
              all ingested slides.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="cursor-pointer bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
