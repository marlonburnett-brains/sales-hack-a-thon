"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain,
  Search,
  X,
  LayoutGrid,
  List,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  browseDocumentsAction,
  searchDocumentsAction,
} from "@/lib/actions/discovery-actions";
import type {
  BrowseResult,
  DiscoveryDocument,
} from "@/lib/actions/discovery-actions";

interface DiscoveryClientProps {
  initialBrowse: BrowseResult;
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

  // Refs
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  // ── Infinite scroll ──────────────────────────────────────────
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
      // Non-fatal: stop loading more on error
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

  // ── Search with debounce ─────────────────────────────────────
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

  // ── Escape key to close preview ──────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedPreview) {
        setSelectedPreview(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedPreview]);

  // ── Check if document is ingested ────────────────────────────
  function isIngested(doc: DiscoveryDocument): boolean {
    const hashes = mode === "search" ? searchIngestedHashes : ingestedHashes;
    // Check by slideId presence in ingestedHashes (server returns matching IDs)
    return hashes.has(doc.slideId);
  }

  // ── Relevance badge ──────────────────────────────────────────
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

  // ── Ingested badge ───────────────────────────────────────────
  function IngestedBadge({ doc }: { doc: DiscoveryDocument }) {
    if (!isIngested(doc)) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        Ingested
      </span>
    );
  }

  // ── Source badge ─────────────────────────────────────────────
  function SourceBadge({ source }: { source?: string }) {
    if (!source) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        {source === "mcp" ? "MCP" : "Drive"}
      </span>
    );
  }

  // ── Card grid view ───────────────────────────────────────────
  function CardGrid({ docs }: { docs: DiscoveryDocument[] }) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {docs.map((doc) => (
          <div
            key={doc.slideId}
            role="button"
            tabIndex={0}
            className="relative cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
            onClick={() => setSelectedPreview(doc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedPreview(doc);
              }
            }}
          >
            {/* Placeholder checkbox */}
            <div className="absolute right-3 top-3 opacity-30">
              <input type="checkbox" disabled tabIndex={-1} />
            </div>

            <h3 className="line-clamp-2 pr-6 text-sm font-medium text-slate-900">
              {doc.documentTitle}
            </h3>
            <p className="mt-1 line-clamp-3 text-xs text-slate-500">
              {doc.textContent}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <SourceBadge source={doc.source} />
              <IngestedBadge doc={doc} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────
  function ListView({ docs }: { docs: DiscoveryDocument[] }) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200">
        {/* Header */}
        <div className="grid grid-cols-[1fr_2fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
          <span>Title</span>
          <span>Preview</span>
          <span>Status</span>
        </div>

        {docs.map((doc, idx) => (
          <div
            key={doc.slideId}
            role="button"
            tabIndex={0}
            className={`grid cursor-pointer grid-cols-[1fr_2fr_auto] gap-4 px-4 py-3 transition-colors duration-150 hover:bg-slate-100 ${idx % 2 === 0 ? "" : "bg-slate-50"}`}
            onClick={() => setSelectedPreview(doc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedPreview(doc);
              }
            }}
          >
            <span className="truncate text-sm font-medium text-slate-900">
              {doc.documentTitle}
            </span>
            <span className="max-w-md truncate text-xs text-slate-500">
              {doc.textContent}
            </span>
            <div className="flex items-center gap-2">
              <SourceBadge source={doc.source} />
              <IngestedBadge doc={doc} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Search results display ───────────────────────────────────
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
        {results.map((doc) => (
          <div
            key={doc.slideId}
            role="button"
            tabIndex={0}
            className="relative cursor-pointer rounded-lg px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
            onClick={() => setSelectedPreview(doc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedPreview(doc);
              }
            }}
          >
            {/* Placeholder checkbox */}
            <div className="absolute right-3 top-3 opacity-30">
              <input type="checkbox" disabled tabIndex={-1} />
            </div>

            <div className="flex items-start gap-3 pr-8">
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
                <IngestedBadge doc={doc} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Preview side panel ───────────────────────────────────────
  function PreviewPanel() {
    const doc = selectedPreview;
    const isOpen = doc !== null;

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
          className={`fixed inset-y-0 right-0 z-30 w-full transform border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-in-out md:w-[480px] ${
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
                {/* Status badges */}
                <div className="mb-4 flex items-center gap-2">
                  <RelevanceBadge score={doc.relevanceScore} />
                  <IngestedBadge doc={doc} />
                  <SourceBadge source={doc.source} />
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

              {/* Footer with placeholder ingest button */}
              <div className="border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white opacity-50"
                >
                  Ingest Document
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Skeleton loaders for infinite scroll ─────────────────────
  function LoadingSkeletons() {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-lg bg-slate-100"
          />
        ))}
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────
  const displayDocs = mode === "browse" ? documents : searchResults;

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
        <SearchResults results={searchResults} />
      )}

      {/* Preview panel */}
      <PreviewPanel />
    </div>
  );
}
