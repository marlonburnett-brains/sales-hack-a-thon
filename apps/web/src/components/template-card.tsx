"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  MoreVertical,
  Trash2,
  Eye,
  AlertTriangle,
  Layers,
  Clock,
  RefreshCw,
  Play,
  Tag,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
import { IngestionStatusBadge } from "@/components/ingestion-status";
import { IngestionProgress } from "@/components/ingestion-progress";
import {
  getTemplateStatus,
  getClassificationLabel,
  TOUCH_TYPES,
  type TemplateStatus,
} from "@/lib/template-utils";
import {
  deleteTemplateAction,
  checkStalenessAction,
  triggerIngestionAction,
  getIngestionProgressAction,
  classifyTemplateAction,
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
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [classifyType, setClassifyType] = useState<"template" | "example">("template");
  const [selectedTouches, setSelectedTouches] = useState<string[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
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

  // Poll ingestion progress when status is "ingesting" or "queued"
  useEffect(() => {
    if (status !== "ingesting" && status !== "queued") {
      setProgress(null);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const p = await getIngestionProgressAction(template.id);

        // When queued, check if backend has transitioned to ingesting
        if (status === "queued") {
          if (p && (p.status === "ingesting" || p.status === "idle" || p.status === "failed")) {
            // Status has changed -- refresh template data so the card re-renders
            // with the correct status, which will re-trigger this effect
            clearInterval(interval);
            onRefresh?.();
          }
          return;
        }

        // status === "ingesting" -- track progress
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

  async function handleRetryAccess() {
    try {
      toast.info("Re-checking access...");
      await checkStalenessAction(template.id);
      // checkStaleness updates accessStatus -- try ingestion
      try {
        await triggerIngestionAction(template.id);
        toast.success("Access confirmed -- ingestion started");
      } catch {
        // Ingestion refused (still not accessible or already running)
        toast.success("Access re-checked");
      }
      onRefresh?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Still unable to access file"
      );
      onRefresh?.();
    }
  }

  async function handleTriggerIngestion() {
    try {
      await triggerIngestionAction(template.id);
      toast.success("Ingestion started");
      onRefresh?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start ingestion"
      );
    }
  }

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

  async function handleClassify() {
    if (classifyType === "example" && selectedTouches.length === 0) {
      toast.error("Select at least one touch type for examples");
      return;
    }
    setIsClassifying(true);
    try {
      const result = await classifyTemplateAction(
        template.id,
        classifyType,
        classifyType === "example" ? selectedTouches : undefined,
      );
      if (result.success) {
        toast.success(`Classified as ${classifyType}`);
        setClassifyOpen(false);
        onRefresh?.();
      } else {
        toast.error(result.error ?? "Classification failed");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Classification failed"
      );
    } finally {
      setIsClassifying(false);
    }
  }

  function handleToggleTouch(value: string) {
    setSelectedTouches((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : [...prev, value]
    );
  }

  function openClassifyPopover() {
    // Pre-fill with current classification if available
    if (template.contentClassification === "template" || template.contentClassification === "example") {
      setClassifyType(template.contentClassification);
    } else {
      setClassifyType("template");
    }
    setSelectedTouches(template.contentClassification === "example" ? touchTypes : []);
    setClassifyOpen(true);
  }

  const classificationLabel = getClassificationLabel(
    template.contentClassification,
    touchTypes,
  );

  return (
    <>
      <Link href={`/templates/${template.id}/slides`} className="block cursor-pointer">
      <Card
        className="shadow-sm transition-shadow duration-200 hover:shadow-md"
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">
            {template.name}
          </h3>
          <Popover open={classifyOpen} onOpenChange={setClassifyOpen}>
            <PopoverTrigger asChild>
              {/* Hidden trigger -- we open programmatically */}
              <span className="hidden" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 p-3"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            >
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-900">Classify Presentation</p>

                {/* Type selector */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      classifyType === "template"
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                    onClick={() => setClassifyType("template")}
                  >
                    Template
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      classifyType === "example"
                        ? "border-purple-300 bg-purple-50 text-purple-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                    onClick={() => setClassifyType("example")}
                  >
                    Example
                  </button>
                </div>

                {/* Touch type selection (only for Example) */}
                {classifyType === "example" && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">
                      Touch types <span className="text-red-500">*</span>
                    </p>
                    <div className="space-y-1.5">
                      {TOUCH_TYPES.map((t) => (
                        <label
                          key={t.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedTouches.includes(t.value)}
                            onCheckedChange={() => handleToggleTouch(t.value)}
                          />
                          <span className="text-xs text-slate-700">{t.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save button */}
                <Button
                  size="sm"
                  className="w-full cursor-pointer"
                  onClick={handleClassify}
                  disabled={isClassifying || (classifyType === "example" && selectedTouches.length === 0)}
                >
                  {isClassifying ? "Saving..." : "Save"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                aria-label="Template actions"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  router.push(`/templates/${template.id}/slides`);
                }}
                className="cursor-pointer"
              >
                <Eye className="mr-2 h-4 w-4" />
                View Slides
              </DropdownMenuItem>
              {/* Classify action -- only show when template has been ingested */}
              {(status === "ready" || status === "classify") && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openClassifyPopover();
                  }}
                  className="cursor-pointer"
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Classify
                </DropdownMenuItem>
              )}
              {status === "no_access" && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRetryAccess();
                  }}
                  className="cursor-pointer"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Access
                </DropdownMenuItem>
              )}
              {(status === "not_ingested" || status === "stale" || status === "ready" || status === "failed" || status === "classify") && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleTriggerIngestion();
                  }}
                  className="cursor-pointer"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {status === "ready" || status === "failed" || status === "classify" ? "Re-ingest" : "Ingest"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {touchTypes.map((type) => (
              <span
                key={type}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
              >
                {TOUCH_LABEL_MAP[type] ?? type}
              </span>
            ))}
            {/* Show classification label if classified */}
            {template.contentClassification && (
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  template.contentClassification === "template"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-purple-200 bg-purple-50 text-purple-700"
                }`}
              >
                {classificationLabel}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <IngestionStatusBadge status={status} />
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
                <IngestionProgress
                  current={progress.current}
                  total={progress.total}
                />
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
      </Link>

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
