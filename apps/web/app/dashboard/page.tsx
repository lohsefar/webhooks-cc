"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { UrlBar } from "@/components/dashboard/url-bar";
import { RequestList } from "@/components/dashboard/request-list";
import { RequestDetail, RequestDetailEmpty } from "@/components/dashboard/request-detail";
import { ErrorBoundary } from "@/components/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, Send, Download, ChevronDown } from "lucide-react";
import { WEBHOOK_BASE_URL } from "@/lib/constants";
import { copyToClipboard } from "@/lib/clipboard";
import { useDashboardState } from "@/lib/use-dashboard-state";

export default function DashboardPage() {
  const state = useDashboardState();

  if (state.endpoints === undefined) {
    return <DashboardSkeleton />;
  }

  if (state.endpoints.length === 0) {
    return <EmptyEndpoints />;
  }

  if (!state.currentEndpoint) return null;

  return (
    <ErrorBoundary resetKey={state.currentEndpoint._id}>
      {/* URL Bar */}
      <UrlBar
        endpointId={state.currentEndpoint._id}
        endpointName={state.currentEndpoint.name || state.currentEndpoint.slug}
        slug={state.currentEndpoint.slug}
        mockResponse={state.currentEndpoint.mockResponse}
        extra={
          state.hasRequests ? (
            <ExportDropdown
              onExportJson={state.handleExportJson}
              onExportCsv={state.handleExportCsv}
            />
          ) : undefined
        }
      />

      {/* Split pane or empty state */}
      {state.hasRequests ? (
        <>
          {/* Desktop: side-by-side */}
          <div className="hidden md:flex flex-1 overflow-hidden">
            <div className="w-80 shrink-0 border-r-2 border-foreground overflow-hidden">
              <RequestList
                requests={state.displayedItems}
                selectedId={state.selectedId}
                onSelect={state.handleSelect}
                liveMode={state.liveMode}
                onToggleLiveMode={state.handleToggleLiveMode}
                sortNewest={state.sortNewest}
                onToggleSort={state.handleToggleSort}
                newCount={state.newCount}
                onJumpToNew={state.handleJumpToNew}
                totalCount={state.retainedTotalCount ?? undefined}
                methodFilter={state.methodFilter}
                onMethodFilterChange={state.setMethodFilter}
                searchQuery={state.searchInput}
                onSearchQueryChange={state.setSearchInput}
                onLoadMore={state.handleLoadMore}
                hasMore={state.showHasMore}
                loadingMore={state.loadingMore}
                searchLoading={state.searchLoading}
                searchError={state.searchError}
                onPrefetch={state.handlePrefetchDetail}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <ErrorBoundary resetKey={state.selectedId ?? undefined}>
                {state.displayRequest ? (
                  <RequestDetail request={state.displayRequest} />
                ) : (
                  <RequestDetailEmpty />
                )}
              </ErrorBoundary>
            </div>
          </div>

          {/* Mobile: list or detail */}
          <div className="md:hidden flex-1 overflow-hidden flex flex-col">
            {state.mobileDetail && state.displayRequest ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <button
                  onClick={() => state.setMobileDetail(false)}
                  className="border-b-2 border-foreground px-4 py-2 text-sm font-bold uppercase tracking-wide hover:bg-muted cursor-pointer transition-colors shrink-0"
                >
                  &larr; Back to list
                </button>
                <div className="flex-1 overflow-hidden">
                  <ErrorBoundary resetKey={state.selectedId ?? undefined}>
                    <RequestDetail request={state.displayRequest} />
                  </ErrorBoundary>
                </div>
              </div>
            ) : (
              <RequestList
                requests={state.displayedItems}
                selectedId={state.selectedId}
                onSelect={state.handleSelect}
                liveMode={state.liveMode}
                onToggleLiveMode={state.handleToggleLiveMode}
                sortNewest={state.sortNewest}
                onToggleSort={state.handleToggleSort}
                newCount={state.newCount}
                onJumpToNew={state.handleJumpToNew}
                totalCount={state.retainedTotalCount ?? undefined}
                methodFilter={state.methodFilter}
                onMethodFilterChange={state.setMethodFilter}
                searchQuery={state.searchInput}
                onSearchQueryChange={state.setSearchInput}
                onLoadMore={state.handleLoadMore}
                hasMore={state.showHasMore}
                loadingMore={state.loadingMore}
                searchLoading={state.searchLoading}
                searchError={state.searchError}
                onPrefetch={state.handlePrefetchDetail}
              />
            )}
          </div>
        </>
      ) : (
        <WaitingForRequests slug={state.currentEndpoint.slug} />
      )}
    </ErrorBoundary>
  );
}

function ExportDropdown({
  onExportJson,
  onExportCsv,
}: {
  onExportJson: () => void;
  onExportCsv: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="neo-btn-outline py-1.5! px-3! text-xs flex items-center gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Export
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 border-2 border-foreground bg-background shadow-neo z-50 min-w-[140px]">
          <button
            onClick={() => {
              onExportJson();
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-xs font-bold uppercase tracking-wide hover:bg-muted cursor-pointer transition-colors border-b-2 border-foreground"
          >
            Export JSON
          </button>
          <button
            onClick={() => {
              onExportCsv();
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-xs font-bold uppercase tracking-wide hover:bg-muted cursor-pointer transition-colors"
          >
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      {/* URL bar skeleton */}
      <div className="border-b-2 border-foreground bg-card px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 flex-1 max-w-md" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 flex">
        {/* List skeleton */}
        <div className="w-80 shrink-0 border-r-2 border-foreground hidden md:block">
          <div className="border-b-2 border-foreground px-3 py-2">
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-6 w-14" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
        {/* Detail skeleton */}
        <div className="flex-1 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

function WaitingForRequests({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sentTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (sentTimeoutRef.current) clearTimeout(sentTimeoutRef.current);
    };
  }, []);

  const url = `${WEBHOOK_BASE_URL}/w/${slug}`;
  const curlCmd = `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"test": true}'`;

  const handleCopy = async () => {
    const success = await copyToClipboard(curlCmd);
    if (success) {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendTest = async () => {
    setSending(true);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true, sentAt: new Date().toISOString() }),
      });
      setSent(true);
      if (sentTimeoutRef.current) clearTimeout(sentTimeoutRef.current);
      sentTimeoutRef.current = setTimeout(() => setSent(false), 3000);
    } catch {
      // Ignore - might be CORS, request still reaches the receiver
      setSent(true);
      if (sentTimeoutRef.current) clearTimeout(sentTimeoutRef.current);
      sentTimeoutRef.current = setTimeout(() => setSent(false), 3000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
          <p className="font-bold uppercase tracking-wide">Waiting for first request...</p>
        </div>

        <div className="text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Send a test webhook
            </span>
            <button
              onClick={handleCopy}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
          </div>
          <pre className="neo-code text-sm whitespace-pre-wrap break-all text-left">{curlCmd}</pre>
        </div>

        <button
          onClick={handleSendTest}
          disabled={sending}
          className="neo-btn-primary w-full flex items-center justify-center gap-2"
        >
          <Send className="h-4 w-4" />
          {sending ? "Sending..." : sent ? "Sent!" : "Send test request"}
        </button>

        <p className="text-xs text-muted-foreground">
          Need signed provider templates? Use the{" "}
          <span className="font-bold text-foreground">Send</span> button in the URL bar or read{" "}
          <Link
            href="/docs/endpoints/test-webhooks"
            className="underline font-bold text-foreground"
          >
            dashboard test webhook docs
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function EmptyEndpoints() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-2 border-foreground bg-muted flex items-center justify-center mx-auto mb-2">
          <Send className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold uppercase tracking-wide">No endpoints yet</h2>
        <p className="text-muted-foreground max-w-sm">
          Create your first endpoint to start capturing webhooks. Click{" "}
          <span className="font-bold text-foreground">&quot;New Endpoint&quot;</span> above.
        </p>
      </div>
    </div>
  );
}
