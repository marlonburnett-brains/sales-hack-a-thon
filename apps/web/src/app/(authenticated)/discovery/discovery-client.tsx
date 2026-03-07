"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Brain,
  Search,
  X,
  LayoutGrid,
  List,
  Inbox,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  Check,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentTypeIcon } from "@/components/document-type-icon";
import { IngestionStatusBadge } from "@/components/ingestion-status";
import { IngestionProgress } from "@/components/ingestion-progress";
import { isIngestible } from "@/lib/document-types";
import { getTemplateStatus, type TemplateStatus } from "@/lib/template-utils";
import {
  browseDocumentsAction,
  searchDocumentsAction,
  startDiscoveryIngestionAction,
  getDiscoveryIngestionProgressAction,
} from "@/lib/actions/discovery-actions";
import type {
  BrowseResult,
  DiscoveryDocument,
} from "@/lib/actions/discovery-actions";

interface DiscoveryClientProps {
  initialBrowse: BrowseResult;
}

type ItemStatus = "idle" | "pending" | "ingesting" | "done" | "error";

/**
 * Map local ItemStatus to TemplateStatus for rendering with shared IngestionStatusBadge.
 */
function itemStatusToTemplateStatus(status: ItemStatus): TemplateStatus {
  switch (status) {
    case "pending":
      return "queued";
    case "ingesting":
      return "ingesting";
    case "done":
      return "ready";
    case "error":
      return "failed";
    default:
      return "not_ingested";
  }
}

export function DiscoveryClient({ initialBrowse }: DiscoveryClientProps) {
  // Browse state
  const [documents, setDocuments] = useState<DiscoveryDocument[]>(
    initialBrowse.documents
  );
  const [ingestedHashes] = useState<Set<string>>(
    () => new Set(initialBrowse.ingestedHashes)
  );
  const [nextCursor, setNextCursor] = useState<string | undefined>(
    initialBrowse.nextCursor
  );
  const [hasMore, setHasMore] = useState(!!initialBrowse.nextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"browse" | "search">("browse");
  const [searchResults, setSearchResults] = useState<DiscoveryDocument[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchIngestedHashes, setSearchIngestedHashes] = useState<
    Set<string>
  >(new Set());

  // Preview panel state
  const [selectedPreview, setSelectedPreview] =
    useState<DiscoveryDocument | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Selection & ingestion state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [itemStatuses, setItemStatuses] = useState<Map<string, ItemStatus>>(
    new Map()
  );
  const [itemErrors, setItemErrors] = useState<Map<string, string>>(
    new Map()
  );
  const [isIngesting, setIsIngesting] = useState(false);

  // Thumbnail loading state
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  // Refs
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const pollIntervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const ingestingRef = useRef<Set<string>>(new Set());

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      pollIntervalsRef.current.forEach((id) => clearInterval(id));
      pollIntervalsRef.current.clear();
    };
  }, []);

  // -- Infinite scroll --
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || mode !== "browse") return;
    setIsLoadingMore(true);
    try {
      const result = await browseDocumentsAction({
        cursor: nextCursor,
        limit: 20,
      });
      setDocuments((prev) => [...prev, ...result.documents]);
      setNextCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, mode, nextCursor]);

  useEffect(() => {
    if (mode !== "browse" || !hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mode, hasMore, loadMore]);

  // -- Search with debounce --
  function handleSearchChange(value: string) {
    setSearchQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setMode("browse");
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setMode("search");

    const capturedValue = value;
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await searchDocumentsAction(capturedValue);
        setSearchResults(result.results);
        setSearchIngestedHashes(new Set(result.ingestedHashes));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }

  function clearSearch() {
    setSearchQuery("");
    setMode("browse");
    setSearchResults([]);
    setIsSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  function triggerSearch(query: string) {
    setSearchQuery(query);
    setIsSearching(true);
    setMode("search");
    searchDocumentsAction(query)
      .then((result) => {
        setSearchResults(result.results);
        setSearchIngestedHashes(new Set(result.ingestedHashes));
      })
      .catch(() => setSearchResults([]))
      .finally(() => setIsSearching(false));
  }

  // -- Escape key to close preview --
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedPreview) {
        setSelectedPreview(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedPreview]);

  // -- Check if document is a Google Slides presentation --
  function isGoogleSlides(doc: DiscoveryDocument): boolean {
    return doc.isGoogleSlides === true;
  }

  // -- Extract presentationId from document --
  function getPresentationId(doc: DiscoveryDocument): string | undefined {
    return doc.presentationId;
  }

  // -- Check if document is ingested --
  function isIngested(doc: DiscoveryDocument): boolean {
    const status = itemStatuses.get(doc.slideId);
    if (status === "done") return true;
    const hashes = mode === "search" ? searchIngestedHashes : ingestedHashes;
    const presId = getPresentationId(doc);
    return presId ? hashes.has(presId) : false;
  }

  // -- Get item status --
  function getItemStatus(doc: DiscoveryDocument): ItemStatus {
    const status = itemStatuses.get(doc.slideId);
    if (status) return status;
    if (isIngested(doc)) return "done";
    return "idle";
  }

  // -- Compute display status for a document --
  // Prioritizes local itemStatuses (more current during active ingestion) over templateData
  function getDisplayStatus(doc: DiscoveryDocument): TemplateStatus | null {
    const localStatus = itemStatuses.get(doc.slideId);
    if (localStatus && localStatus !== "idle") {
      return itemStatusToTemplateStatus(localStatus);
    }
    if (doc.templateData) {
      return getTemplateStatus({
        ...doc.templateData,
        slideCount: doc.templateData.slideCount ?? undefined,
      });
    }
    if (isIngested(doc)) {
      return "ready";
    }
    return null;
  }

  // -- Selection toggle --
  function toggleSelection(doc: DiscoveryDocument) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(doc.slideId)) {
        next.delete(doc.slideId);
      } else {
        next.add(doc.slideId);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // -- Batch ingestion --
  function startPolling(batchId: string, slideIds: string[]) {
    const intervalId = setInterval(async () => {
      try {
        const progress = await getDiscoveryIngestionProgressAction(batchId);

        setItemStatuses((prev) => {
          const next = new Map(prev);
          for (const item of progress.items) {
            const mappedStatus: ItemStatus =
              item.status === "complete" || item.status === "done"
                ? "done"
                : item.status === "error" || item.status === "failed"
                  ? "error"
                  : item.status === "ingesting" || item.status === "processing"
                    ? "ingesting"
                    : "pending";
            next.set(item.id, mappedStatus);

            // Update per-item toast
            if (mappedStatus === "ingesting") {
              toast(`Ingesting...`, { id: `ingest-${item.id}` });
            } else if (mappedStatus === "done") {
              toast.success("Ingestion complete", { id: `ingest-${item.id}` });
            } else if (mappedStatus === "error") {
              toast.error("Ingestion failed", { id: `ingest-${item.id}` });
            }
          }
          return next;
        });

        setItemErrors((prev) => {
          const next = new Map(prev);
          for (const item of progress.items) {
            if (item.error) {
              next.set(item.id, item.error);
            }
          }
          return next;
        });

        if (progress.complete) {
          clearInterval(intervalId);
          pollIntervalsRef.current.delete(intervalId);

          // Remove from ingestingRef
          for (const sid of slideIds) {
            ingestingRef.current.delete(sid);
          }

          setIsIngesting((prev) => {
            if (pollIntervalsRef.current.size === 0) return false;
            return prev;
          });

          const doneCount = progress.items.filter(
            (i) => i.status === "complete" || i.status === "done"
          ).length;
          const errorCount = progress.items.filter(
            (i) => i.status === "error" || i.status === "failed"
          ).length;

          // Summary toast for batch operations
          if (progress.items.length > 1) {
            if (errorCount > 0) {
              toast.success(
                `${doneCount} of ${progress.items.length} documents ingested, ${errorCount} failed`
              );
            } else {
              toast.success(
                `All ${doneCount} documents ingested`
              );
            }
          }
        }
      } catch {
        // Polling error -- keep trying
      }
    }, 2000);

    pollIntervalsRef.current.add(intervalId);
  }

  async function handleBatchIngest(items?: DiscoveryDocument[]) {
    const allDocs =
      mode === "browse"
        ? documents
        : searchResults;

    const selectedItems = items ?? allDocs.filter((d) =>
      selectedIds.has(d.slideId)
    );

    // Only ingest Google Slides documents
    const slidesItems = selectedItems.filter(isGoogleSlides);
    if (slidesItems.length === 0) {
      toast.error("Only Google Slides documents can be ingested.");
      return;
    }

    // Client-side duplicate prevention: skip already in-flight docs
    const newItems = slidesItems.filter(
      (doc) => !ingestingRef.current.has(doc.slideId)
    );
    if (newItems.length === 0) {
      toast.info("These documents are already being ingested.");
      return;
    }

    // Add to ingestingRef immediately (synchronous, no React state delay)
    for (const doc of newItems) {
      ingestingRef.current.add(doc.slideId);
    }

    // Enrich items with googleSlidesUrl for the agent
    const enrichedItems = newItems.map((doc) => {
      const presId = getPresentationId(doc)!;
      const googleSlidesUrl = `https://docs.google.com/presentation/d/${presId}`;
      return { ...doc, presentationId: presId, googleSlidesUrl };
    });

    // Set all selected to pending (optimistic)
    setItemStatuses((prev) => {
      const next = new Map(prev);
      for (const item of newItems) {
        next.set(item.slideId, "pending");
      }
      return next;
    });

    setIsIngesting(true);
    setSelectedIds(new Set()); // Clear selection

    // Show per-item queued toast
    for (const item of newItems) {
      toast("Queued for ingestion", { id: `ingest-${item.slideId}` });
    }

    const slideIds = newItems.map((d) => d.slideId);

    try {
      const { batchId } = await startDiscoveryIngestionAction(enrichedItems);
      startPolling(batchId, slideIds);
    } catch {
      // Rollback: reset statuses and remove from ingestingRef
      setItemStatuses((prev) => {
        const next = new Map(prev);
        for (const item of newItems) {
          next.delete(item.slideId);
        }
        return next;
      });
      for (const sid of slideIds) {
        ingestingRef.current.delete(sid);
      }
      setIsIngesting(false);
      // Replace queued toasts with error
      for (const item of newItems) {
        toast.error("Failed to start ingestion", { id: `ingest-${item.slideId}` });
      }
    }
  }

  // -- Individual retry --
  async function handleRetry(doc: DiscoveryDocument) {
    toast.info("Retrying ingestion...");
    setItemStatuses((prev) => {
      const next = new Map(prev);
      next.set(doc.slideId, "pending");
      return next;
    });
    setItemErrors((prev) => {
      const next = new Map(prev);
      next.delete(doc.slideId);
      return next;
    });

    try {
      const presId = getPresentationId(doc)!;
      const googleSlidesUrl = `https://docs.google.com/presentation/d/${presId}`;
      const enrichedDoc = { ...doc, presentationId: presId, googleSlidesUrl };
      const { batchId } = await startDiscoveryIngestionAction([enrichedDoc]);
      ingestingRef.current.add(doc.slideId);
      setIsIngesting(true);
      startPolling(batchId, [doc.slideId]);
    } catch {
      setItemStatuses((prev) => {
        const next = new Map(prev);
        next.set(doc.slideId, "error");
        return next;
      });
      setItemErrors((prev) => {
        const next = new Map(prev);
        next.set(doc.slideId, "Retry failed");
        return next;
      });
      toast.error("Retry failed. Please try again.");
    }
  }

  // -- Item checkbox --
  function ItemCheckbox({ doc }: { doc: DiscoveryDocument }) {
    const status = getItemStatus(doc);
    const alreadyIngested = isIngested(doc);
    const canIngest = isIngestible(doc.mimeType);
    const isProcessing = status === "pending" || status === "ingesting";
    const isDone = status === "done" || alreadyIngested;
    const isDisabled = !canIngest || isDone || isProcessing || ingestingRef.current.has(doc.slideId);
    const isChecked =
      isDone || isProcessing || selectedIds.has(doc.slideId);

    if (!canIngest) return null; // Hide checkbox for non-ingestible docs

    return (
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        checked={isChecked}
        disabled={isDisabled}
        onChange={() => {
          if (!isDisabled) toggleSelection(doc);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={
          isDone
            ? `${doc.documentTitle} - already ingested`
            : `Select ${doc.documentTitle}`
        }
      />
    );
  }

  // -- Relevance badge --
  function RelevanceBadge({ score }: { score?: number }) {
    if (score == null) return null;
    const pct = Math.round(score * 100);
    let classes: string;
    if (score >= 0.8) {
      classes =
        "inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700";
    } else if (score >= 0.5) {
      classes =
        "inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700";
    } else {
      classes =
        "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600";
    }
    return <span className={classes}>{pct}%</span>;
  }

  // -- Source badge --
  function SourceBadge({ source }: { source?: string }) {
    if (!source) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        {source === "mcp" ? "MCP" : "Drive"}
      </span>
    );
  }

  // -- Thumbnail with skeleton shimmer --
  function ThumbnailArea({ doc }: { doc: DiscoveryDocument }) {
    const hasThumb = !!doc.thumbnailUrl;
    const imageLoaded = loadedImages.has(doc.slideId);

    return (
      <div className="relative aspect-video bg-slate-100">
        {hasThumb ? (
          <>
            {!imageLoaded && (
              <Skeleton className="absolute inset-0 rounded-none" />
            )}
            <Image
              src={doc.thumbnailUrl!}
              alt={doc.documentTitle}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
              onLoad={() =>
                setLoadedImages((prev) => new Set(prev).add(doc.slideId))
              }
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <DocumentTypeIcon mimeType={doc.mimeType} size="lg" />
          </div>
        )}
        {/* Corner file-type badge */}
        <div className="absolute bottom-2 right-2">
          <DocumentTypeIcon mimeType={doc.mimeType} size="sm" />
        </div>
      </div>
    );
  }

  // -- Status row for cards --
  function CardStatusRow({ doc }: { doc: DiscoveryDocument }) {
    const displayStatus = getDisplayStatus(doc);
    const slideCount = doc.templateData?.slideCount;
    const isActivelyIngesting =
      displayStatus === "ingesting" || displayStatus === "queued";
    const progress = doc.templateData?.ingestionProgress;
    const totalSlides = doc.templateData?.slideCount;

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {displayStatus && <IngestionStatusBadge status={displayStatus} />}
          {slideCount != null && slideCount > 0 && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Layers className="h-3 w-3" />
              {slideCount} slides
            </Badge>
          )}
        </div>
        {isActivelyIngesting && displayStatus === "ingesting" && totalSlides != null && totalSlides > 0 && (
          <IngestionProgress
            current={progress ?? 0}
            total={totalSlides}
          />
        )}
      </div>
    );
  }

  // -- Card grid view --
  function CardGrid({ docs }: { docs: DiscoveryDocument[] }) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {docs.map((doc) => {
          const canIngest = isIngestible(doc.mimeType);

          return (
            <Card
              key={doc.slideId}
              role="button"
              tabIndex={0}
              className={cn(
                "overflow-hidden cursor-pointer transition-shadow duration-200 hover:shadow-md",
                !canIngest && "opacity-80"
              )}
              onClick={() => setSelectedPreview(doc)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPreview(doc);
                }
              }}
            >
              {/* Hero thumbnail */}
              <ThumbnailArea doc={doc} />

              <CardContent className="p-4">
                {/* Checkbox row */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-medium text-slate-900">
                    {doc.documentTitle}
                  </h3>
                  <div
                    className="flex-shrink-0 pt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ItemCheckbox doc={doc} />
                  </div>
                </div>

                {/* Status + slide count */}
                <div className="mt-3">
                  <CardStatusRow doc={doc} />
                </div>

                {/* Source badge */}
                <div className="mt-2">
                  <SourceBadge source={doc.source} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // -- List view --
  function ListView({ docs }: { docs: DiscoveryDocument[] }) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200">
        {/* Header */}
        <div className="grid grid-cols-[auto_40px_1fr_2fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
          <span className="w-6" />
          <span />
          <span>Title</span>
          <span>Preview</span>
          <span>Status</span>
        </div>

        {docs.map((doc, idx) => {
          const canIngest = isIngestible(doc.mimeType);
          const displayStatus = getDisplayStatus(doc);
          const slideCount = doc.templateData?.slideCount;

          return (
            <div
              key={doc.slideId}
              role="button"
              tabIndex={0}
              className={cn(
                "grid cursor-pointer grid-cols-[auto_40px_1fr_2fr_auto] gap-4 px-4 py-3 transition-colors duration-150 hover:bg-slate-100",
                idx % 2 !== 0 && "bg-slate-50",
                !canIngest && "opacity-80"
              )}
              onClick={() => setSelectedPreview(doc)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPreview(doc);
                }
              }}
            >
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <ItemCheckbox doc={doc} />
              </div>
              {/* Thumbnail or icon */}
              <div className="flex items-center justify-center">
                {doc.thumbnailUrl ? (
                  <div className="relative h-[30px] w-[40px] overflow-hidden rounded">
                    <Image
                      src={doc.thumbnailUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                ) : (
                  <DocumentTypeIcon mimeType={doc.mimeType} size="sm" />
                )}
              </div>
              <span className="truncate text-sm font-medium text-slate-900">
                {doc.documentTitle}
              </span>
              <span className="max-w-md truncate text-xs text-slate-500">
                {doc.textContent}
              </span>
              <div className="flex items-center gap-2">
                <SourceBadge source={doc.source} />
                {displayStatus && <IngestionStatusBadge status={displayStatus} />}
                {slideCount != null && slideCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Layers className="h-3 w-3" />
                    {slideCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // -- Search results display --
  function SearchResultsHeader({ count }: { count: number }) {
    if (isSearching || count === 0) return null;
    return (
      <p className="text-xs text-slate-500">
        {count} result{count !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
      </p>
    );
  }

  function SearchResults({ results }: { results: DiscoveryDocument[] }) {
    if (isSearching) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      );
    }

    if (results.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">
            No results for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Try broader terms like:
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {[
              "healthcare solutions",
              "case study outcomes",
              "capabilities overview",
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="cursor-pointer text-sm text-blue-600 transition-colors duration-150 hover:text-blue-800 hover:underline"
                onClick={() => triggerSearch(suggestion)}
              >
                &ldquo;{suggestion}&rdquo;
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {results.map((doc) => {
          const displayStatus = getDisplayStatus(doc);
          const canIngest = isIngestible(doc.mimeType);

          return (
            <div
              key={doc.slideId}
              role="button"
              tabIndex={0}
              className={cn(
                "relative cursor-pointer rounded-lg px-4 py-3 transition-colors duration-150 hover:bg-slate-50",
                !canIngest && "opacity-80"
              )}
              onClick={() => setSelectedPreview(doc)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPreview(doc);
                }
              }}
            >
              {/* Checkbox */}
              <div
                className="absolute left-4 top-1/2 -translate-y-1/2"
                onClick={(e) => e.stopPropagation()}
              >
                <ItemCheckbox doc={doc} />
              </div>

              <div className="flex items-start gap-3 pl-8 pr-8">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-slate-900">
                    {doc.documentTitle}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {doc.textContent.length > 200
                      ? doc.textContent.slice(0, 200) + "..."
                      : doc.textContent}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <RelevanceBadge score={doc.relevanceScore} />
                  {displayStatus && <IngestionStatusBadge status={displayStatus} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // -- Preview side panel --
  function PreviewPanel() {
    const doc = selectedPreview;
    const isOpen = doc !== null;

    function renderIngestButton() {
      if (!doc) return null;

      // Non-ingestible documents cannot be ingested
      if (!isIngestible(doc.mimeType)) {
        return (
          <p className="text-center text-xs text-slate-400">
            Only Google Slides documents can be ingested as templates.
          </p>
        );
      }

      const status = getItemStatus(doc);
      const isInFlight = ingestingRef.current.has(doc.slideId);

      if (status === "done" || isIngested(doc)) {
        return (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white opacity-70"
          >
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4" />
              Already Ingested
            </span>
          </button>
        );
      }

      if (status === "pending" || status === "ingesting" || isInFlight) {
        return (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-70"
          >
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ingesting...
            </span>
          </button>
        );
      }

      if (status === "error") {
        return (
          <button
            type="button"
            onClick={() => handleRetry(doc)}
            className="w-full cursor-pointer rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-red-700"
          >
            <span className="inline-flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Retry Ingestion
            </span>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => handleBatchIngest([doc])}
          disabled={isInFlight}
          className="w-full cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Ingest Document
        </button>
      );
    }

    return (
      <>
        {/* Mobile backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setSelectedPreview(null)}
            aria-hidden="true"
          />
        )}

        {/* Panel */}
        <div
          className={`fixed inset-y-0 right-0 z-30 w-full transform border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-in-out motion-reduce:transition-none md:w-[480px] ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
        >
          {doc && (
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="line-clamp-1 text-sm font-semibold text-slate-900">
                  {doc.documentTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedPreview(null)}
                  className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Thumbnail preview */}
                {doc.thumbnailUrl && (
                  <div className="relative mb-4 aspect-video overflow-hidden rounded-lg bg-slate-100">
                    <Image
                      src={doc.thumbnailUrl}
                      alt={doc.documentTitle}
                      fill
                      className="object-cover"
                      sizes="480px"
                    />
                  </div>
                )}

                {/* Status badges */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <RelevanceBadge score={doc.relevanceScore} />
                  {(() => {
                    const displayStatus = getDisplayStatus(doc);
                    return displayStatus ? <IngestionStatusBadge status={displayStatus} /> : null;
                  })()}
                  <SourceBadge source={doc.source} />
                  {doc.templateData?.slideCount != null && doc.templateData.slideCount > 0 && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Layers className="h-3 w-3" />
                      {doc.templateData.slideCount} slides
                    </Badge>
                  )}
                </div>

                {/* Full content */}
                <div className="mb-6">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Content
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {doc.textContent}
                  </p>
                </div>

                {/* Speaker notes (collapsible) */}
                {doc.speakerNotes && (
                  <div className="mb-6">
                    <button
                      type="button"
                      onClick={() => setNotesExpanded(!notesExpanded)}
                      className="flex w-full cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors duration-150 hover:text-slate-600"
                    >
                      <span>Speaker Notes</span>
                      {notesExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    {notesExpanded && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                        {doc.speakerNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Metadata */}
                {doc.metadata &&
                  Object.keys(doc.metadata).length > 0 && (
                    <div className="mb-6">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Metadata
                      </h3>
                      <dl className="space-y-1">
                        {Object.entries(doc.metadata).map(([key, val]) => (
                          <div
                            key={key}
                            className="flex gap-2 text-sm"
                          >
                            <dt className="font-medium text-slate-600">
                              {key}:
                            </dt>
                            <dd className="text-slate-500">
                              {String(val)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
              </div>

              {/* Footer with functional ingest button */}
              <div className="border-t border-slate-200 px-5 py-4">
                {renderIngestButton()}
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // -- Floating toolbar --
  function FloatingToolbar() {
    const count = selectedIds.size;
    if (count === 0) return null;

    const doneCount = Array.from(itemStatuses.values()).filter(
      (s) => s === "done"
    ).length;
    const totalInBatch = Array.from(itemStatuses.values()).filter(
      (s) => s === "pending" || s === "ingesting" || s === "done"
    ).length;

    return (
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 transform transition-transform duration-200">
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-6 py-3 shadow-lg">
          <span className="text-sm font-medium text-slate-700">
            {count} selected
          </span>

          <button
            type="button"
            onClick={clearSelection}
            className="cursor-pointer text-sm text-slate-500 transition-colors duration-150 hover:text-slate-700"
          >
            Clear
          </button>

          {isIngesting ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ingesting... {doneCount}/{totalInBatch}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleBatchIngest()}
              className="cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700"
            >
              Ingest {count} selected
            </button>
          )}
        </div>
      </div>
    );
  }

  // -- Skeleton loaders for infinite scroll --
  function LoadingSkeletons() {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="overflow-hidden">
            <div className="aspect-video">
              <Skeleton className="h-full w-full rounded-none" />
            </div>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // -- Main render --
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-semibold text-slate-900">
          AtlusAI Discovery
        </h1>
      </div>

      {/* Search bar + view toggle */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search AtlusAI content..."
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-slate-400 transition-colors duration-150 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* View toggle -- only in browse mode */}
        {mode === "browse" && (
          <div className="flex items-center rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`cursor-pointer rounded-l-md p-2 transition-colors duration-150 ${
                viewMode === "grid"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`cursor-pointer rounded-r-md p-2 transition-colors duration-150 ${
                viewMode === "list"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Results area */}
      {mode === "browse" ? (
        <>
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">
                No documents found in AtlusAI
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Documents will appear here once AtlusAI content is available.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <CardGrid docs={documents} />
          ) : (
            <ListView docs={documents} />
          )}

          {/* Infinite scroll loading */}
          {isLoadingMore && <LoadingSkeletons />}

          {/* Sentinel for intersection observer */}
          {hasMore && <div ref={sentinelRef} className="h-1" />}
        </>
      ) : (
        <>
          <SearchResultsHeader count={searchResults.length} />
          <SearchResults results={searchResults} />
        </>
      )}

      {/* Preview panel */}
      <PreviewPanel />

      {/* Floating toolbar */}
      <FloatingToolbar />
    </div>
  );
}
