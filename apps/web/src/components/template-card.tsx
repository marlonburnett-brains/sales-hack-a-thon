"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  MoreVertical,
  Trash2,
  AlertTriangle,
  Layers,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TemplateStatusBadge } from "@/components/template-status-badge";
import { getTemplateStatus, type TemplateStatus } from "@/lib/template-utils";
import {
  deleteTemplateAction,
  getIngestionProgressAction,
} from "@/lib/actions/template-actions";
import type { Template } from "@/lib/api-client";

interface TemplateCardProps {
  template: Template;
  onDeleted?: () => void;
  onRefresh?: () => void;
}

function parseTouchTypes(touchTypes: string): string[] {
  try {
    return JSON.parse(touchTypes);
  } catch {
    return [];
  }
}

const TOUCH_LABEL_MAP: Record<string, string> = {
  touch_1: "T1",
  touch_2: "T2",
  touch_3: "T3",
  touch_4: "T4+",
};

export function TemplateCard({
  template,
  onDeleted,
  onRefresh,
}: TemplateCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const status: TemplateStatus = getTemplateStatus(template);
  const touchTypes = parseTouchTypes(template.touchTypes);
  const lastIngested = template.lastIngestedAt
    ? formatDistanceToNow(new Date(template.lastIngestedAt), {
        addSuffix: true,
      })
    : "Never";

  // Poll ingestion progress when status is "ingesting"
  useEffect(() => {
    if (status !== "ingesting") {
      setProgress(null);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const p = await getIngestionProgressAction(template.id);
        if (p && p.current > 0) {
          setProgress({ current: p.current, total: p.total });
        }
        if (!p || p.status === "idle" || p.status === "failed") {
          clearInterval(interval);
          setProgress(null);
          onRefresh?.();
          if (p?.status === "idle") {
            const skipped = p.skipped ?? 0;
            if (skipped > 0) {
              toast.success(
                `${template.name} ingested (${p.total - skipped} of ${p.total} slides, ${skipped} skipped)`
              );
            } else {
              toast.success(
                `${template.name} ingested (${p.total} slides)`
              );
            }
          }
        }
      } catch {
        // Silently fail on poll errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, template.id, template.name, onRefresh]);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteTemplateAction(template.id);
      toast.success(`"${template.name}" deleted`);
      onDeleted?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete template"
      );
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <>
      <Card className="cursor-pointer shadow-sm transition-shadow duration-200 hover:shadow-md">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">
            {template.name}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                aria-label="Template actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {touchTypes.map((type) => (
              <span
                key={type}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
              >
                {TOUCH_LABEL_MAP[type] ?? type}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <TemplateStatusBadge status={status} />
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1" title="Slide count">
                <Layers className="h-3.5 w-3.5" />
                {template.slideCount}
              </span>
              <span className="flex items-center gap-1" title="Last ingested">
                <Clock className="h-3.5 w-3.5" />
                {lastIngested}
              </span>
            </div>
          </div>

          {status === "no_access" && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              <span className="text-red-700">
                Share file to enable ingestion
              </span>
            </div>
          )}

          {status === "queued" && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-700">
              Queued for ingestion...
            </div>
          )}

          {status === "ingesting" && (
            <div className="space-y-1.5">
              {progress ? (
                <>
                  <Progress
                    value={(progress.current / progress.total) * 100}
                    className="h-1.5"
                  />
                  <p className="text-xs text-indigo-600">
                    Slide {progress.current} of {progress.total}
                  </p>
                </>
              ) : (
                <p className="text-xs text-indigo-600">
                  Extracting slides...
                </p>
              )}
            </div>
          )}

          {status === "failed" && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              Ingestion failed
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{template.name}&rdquo;? This will also remove all
              ingested slides.
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
