"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { DisplayableRequest } from "@/components/dashboard/request-detail";
import type { ClickHouseRequest, ClickHouseSummary, AnyRequestSummary } from "@/types/request";
import {
  buildRetainedCountParams,
  computeShowHasMore,
  incrementRetainedCount,
} from "@/lib/dashboard-count";

const CLICKHOUSE_PAGE_SIZE = 50;

export function useDashboardState() {
  const endpoints = useQuery(api.endpoints.list);
  const searchParams = useSearchParams();
  const endpointSlug = searchParams.get("endpoint");

  const currentEndpoint = endpoints?.find((ep) => ep.slug === endpointSlug) ?? endpoints?.[0];

  // Lightweight summaries for the sidebar (no body/headers/ip)
  const summaries = useQuery(
    api.requests.listSummaries,
    currentEndpoint ? { endpointId: currentEndpoint._id, limit: 50 } : "skip"
  );

  // Selected item ID — can be a Convex _id (string) or a ClickHouse synthetic id
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const [sortNewest, setSortNewest] = useState(true);
  const [mobileDetail, setMobileDetail] = useState(false);
  const prevTopSummaryId = useRef<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ClickHouse state
  const [olderRequests, setOlderRequests] = useState<ClickHouseRequest[]>([]);
  const [searchResults, setSearchResults] = useState<ClickHouseRequest[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [hasLoadedOlderPage, setHasLoadedOlderPage] = useState(false);
  const [retainedTotalCount, setRetainedTotalCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const retainedCountRequestSeq = useRef(0);

  // Map of ClickHouse request details by id for quick lookup
  const clickHouseDetailMap = useRef(new Map<string, ClickHouseRequest>());

  // Debounce search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (searchInput === "") {
      setDebouncedSearch("");
      return;
    }
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchInput]);

  // Detail for selected request — prefer ClickHouse, Convex as fallback
  const isConvexId = selectedId != null && !selectedId.includes(":");
  const [selectedDetail, setSelectedDetail] = useState<ClickHouseRequest | null>(null);

  // Convex fallback for very new requests not yet flushed to ClickHouse
  const selectedRequest = useQuery(
    api.requests.get,
    isConvexId && !selectedDetail ? { id: selectedId as Id<"requests"> } : "skip"
  );

  // Clear stale selectedId when request doesn't exist in either source
  useEffect(() => {
    if (selectedRequest === null && !selectedDetail && selectedId && isConvexId) {
      setSelectedId(null);
    }
  }, [selectedRequest, selectedDetail, selectedId, isConvexId]);

  // Build the displayable request for the detail panel
  const displayRequest = useMemo((): DisplayableRequest | undefined => {
    if (!selectedId) return undefined;
    if (selectedDetail) return selectedDetail;
    if (isConvexId) return selectedRequest ?? undefined;
    return undefined;
  }, [selectedId, selectedDetail, isConvexId, selectedRequest]);

  // Auth token for calling the search API route
  const authToken = useAuthToken();

  // ClickHouse search helper
  const fetchFromClickHouse = useCallback(
    async (params: Record<string, string>): Promise<{ data: ClickHouseRequest[]; ok: boolean }> => {
      if (!authToken) return { data: [], ok: false };
      try {
        const url = new URL("/api/search/requests", window.location.origin);
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!resp.ok) return { data: [], ok: false };
        const results: unknown = await resp.json();
        if (!Array.isArray(results)) return { data: [], ok: false };
        if (results.length > 0) {
          const first = results[0] as Record<string, unknown>;
          if (
            typeof first.id !== "string" ||
            typeof first.method !== "string" ||
            typeof first.receivedAt !== "number"
          ) {
            console.error("ClickHouse response shape mismatch:", first);
            return { data: [], ok: false };
          }
        }
        return { data: results as ClickHouseRequest[], ok: true };
      } catch (err) {
        console.error("ClickHouse search failed:", err);
        return { data: [], ok: false };
      }
    },
    [authToken]
  );

  const fetchCountFromClickHouse = useCallback(
    async (params: Record<string, string>): Promise<{ count: number | null; ok: boolean }> => {
      if (!authToken) return { count: null, ok: false };
      try {
        const url = new URL("/api/search/requests/count", window.location.origin);
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!resp.ok) return { count: null, ok: false };
        const data: unknown = await resp.json();
        if (
          typeof data !== "object" ||
          data === null ||
          !("count" in data) ||
          typeof (data as { count: unknown }).count !== "number"
        ) {
          return { count: null, ok: false };
        }
        return { count: (data as { count: number }).count, ok: true };
      } catch (err) {
        console.error("ClickHouse count failed:", err);
        return { count: null, ok: false };
      }
    },
    [authToken]
  );

  // Store ClickHouse results in the detail map (capped at 500 entries)
  const storeClickHouseResults = useCallback((results: ClickHouseRequest[]) => {
    const map = clickHouseDetailMap.current;
    for (const r of results) {
      map.set(r.id, r);
    }
    if (map.size > 500) {
      const excess = map.size - 500;
      const iter = map.keys();
      for (let i = 0; i < excess; i++) {
        const key = iter.next().value;
        if (key) map.delete(key);
      }
    }
  }, []);

  // Pre-fetch first page from ClickHouse and map Convex IDs to details
  const prefetchedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!currentEndpoint || !summaries?.length || !authToken) return;
    if (prefetchedSlug.current === currentEndpoint.slug) return;

    const slugToFetch = currentEndpoint.slug;
    let cancelled = false;

    fetchFromClickHouse({
      slug: slugToFetch,
      limit: "50",
      order: "desc",
    }).then(({ data: results }) => {
      if (cancelled) return;
      prefetchedSlug.current = slugToFetch;
      storeClickHouseResults(results);
      const consumed = new Set<string>();
      for (const summary of summaries) {
        const match = results.find(
          (r) =>
            !consumed.has(r.id) &&
            r.method === summary.method &&
            Math.abs(r.receivedAt - summary.receivedAt) < 2
        );
        if (match) {
          consumed.add(match.id);
          clickHouseDetailMap.current.set(summary._id, match);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentEndpoint, summaries, authToken, fetchFromClickHouse, storeClickHouseResults]);

  // Fetch detail from ClickHouse when selection changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }

    const cached = clickHouseDetailMap.current.get(selectedId);
    if (cached) {
      setSelectedDetail(cached);
      return;
    }

    setSelectedDetail(null);

    if (!currentEndpoint) {
      return;
    }

    let receivedAt: number | undefined;
    if (isConvexId && summaries) {
      const summary = summaries.find((s) => s._id === selectedId);
      if (summary) receivedAt = summary.receivedAt;
    }

    if (isConvexId && receivedAt == null) {
      setSelectedDetail(null);
      return;
    }

    let cancelled = false;
    const params: Record<string, string> = {
      slug: currentEndpoint.slug,
      limit: "10",
      order: "desc",
    };
    if (receivedAt != null) {
      params.from = String(receivedAt);
      params.to = String(receivedAt);
    }

    fetchFromClickHouse(params).then(({ data: results }) => {
      if (cancelled) return;
      storeClickHouseResults(results);
      if (receivedAt != null && results.length > 0) {
        const summaryMethod = summaries?.find((s) => s._id === selectedId)?.method;
        const candidates = summaryMethod
          ? results.filter((r) => r.method === summaryMethod)
          : results;
        const pool = candidates.length > 0 ? candidates : results;
        const match = pool.reduce((best, r) =>
          Math.abs(r.receivedAt - receivedAt!) < Math.abs(best.receivedAt - receivedAt!) ? r : best
        );
        clickHouseDetailMap.current.set(selectedId, match);
        setSelectedDetail(match);
      } else if (results.length > 0) {
        const match = results.find((r) => r.id === selectedId);
        if (match) setSelectedDetail(match);
      } else {
        setSelectedDetail(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    selectedId,
    isConvexId,
    currentEndpoint,
    summaries,
    fetchFromClickHouse,
    storeClickHouseResults,
  ]);

  // Clear paginated results when filter changes
  const prevMethodFilter = useRef(methodFilter);
  useEffect(() => {
    if (prevMethodFilter.current !== methodFilter) {
      prevMethodFilter.current = methodFilter;
      setOlderRequests([]);
      setHasMore(false);
      setHasLoadedOlderPage(false);
    }
  }, [methodFilter]);

  // Handle Load More
  const handleLoadMore = useCallback(async () => {
    if (!currentEndpoint || loadingMore) return;
    setLoadingMore(true);

    const currentOldest = olderRequests.length > 0 ? olderRequests[olderRequests.length - 1] : null;
    const oldestFromSummaries =
      summaries && summaries.length > 0 ? summaries[summaries.length - 1] : null;

    const toTimestamp = currentOldest
      ? currentOldest.receivedAt
      : oldestFromSummaries
        ? oldestFromSummaries.receivedAt
        : undefined;

    const params: Record<string, string> = {
      slug: currentEndpoint.slug,
      limit: String(CLICKHOUSE_PAGE_SIZE),
      order: "desc",
    };
    if (methodFilter !== "ALL") params.method = methodFilter;
    if (toTimestamp != null) params.to = String(Math.floor(toTimestamp) - 1);

    try {
      const { data: results } = await fetchFromClickHouse(params);
      storeClickHouseResults(results);
      setOlderRequests((prev) => [...prev, ...results]);
      setHasMore(results.length >= CLICKHOUSE_PAGE_SIZE);
      setHasLoadedOlderPage(true);
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [
    currentEndpoint,
    loadingMore,
    olderRequests,
    summaries,
    methodFilter,
    fetchFromClickHouse,
    storeClickHouseResults,
  ]);

  // Handle search via ClickHouse
  useEffect(() => {
    if (!debouncedSearch || !currentEndpoint) {
      setSearchResults([]);
      setSearchError(false);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(false);

    const params: Record<string, string> = {
      slug: currentEndpoint.slug,
      q: debouncedSearch,
      limit: String(CLICKHOUSE_PAGE_SIZE),
      order: "desc",
    };
    if (methodFilter !== "ALL") params.method = methodFilter;

    fetchFromClickHouse(params)
      .then(({ data: results, ok }) => {
        if (cancelled) return;
        if (!ok) {
          setSearchError(true);
          setSearchResults([]);
        } else {
          storeClickHouseResults(results);
          setSearchResults(results);
        }
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, currentEndpoint, methodFilter, fetchFromClickHouse, storeClickHouseResults]);

  const currentSlug = currentEndpoint?.slug;

  const refreshRetainedCount = useCallback(async () => {
    if (!currentSlug) return;
    const requestSeq = ++retainedCountRequestSeq.current;
    const params = buildRetainedCountParams(currentSlug, methodFilter, debouncedSearch);

    const { count, ok } = await fetchCountFromClickHouse(params);
    if (requestSeq !== retainedCountRequestSeq.current) return;
    if (ok && count != null) {
      setRetainedTotalCount(count);
    }
  }, [currentSlug, methodFilter, debouncedSearch, fetchCountFromClickHouse]);

  // ClickHouse-backed retained count
  useEffect(() => {
    if (!currentSlug || !authToken) {
      retainedCountRequestSeq.current++;
      setRetainedTotalCount(null);
      return;
    }
    void refreshRetainedCount();
  }, [currentSlug, authToken, methodFilter, debouncedSearch, refreshRetainedCount]);

  // Re-sync count when the tab becomes active again
  useEffect(() => {
    if (!currentSlug || !authToken) return;

    const onFocus = () => {
      void refreshRetainedCount();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshRetainedCount();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [currentSlug, authToken, refreshRetainedCount]);

  // Compose the list to display
  const displayedItems = useMemo((): AnyRequestSummary[] => {
    if (debouncedSearch) {
      return searchResults.map(
        (r): ClickHouseSummary => ({
          id: r.id,
          method: r.method,
          receivedAt: r.receivedAt,
        })
      );
    }

    const convexSummaries: AnyRequestSummary[] = summaries
      ? methodFilter === "ALL"
        ? summaries
        : summaries.filter((r) => r.method === methodFilter)
      : [];

    const oldestConvex =
      summaries && summaries.length > 0 ? summaries[summaries.length - 1].receivedAt : -Infinity;
    const olderSummaries: ClickHouseSummary[] = olderRequests
      .filter((r) => r.receivedAt < oldestConvex)
      .map((r) => ({
        id: r.id,
        method: r.method,
        receivedAt: r.receivedAt,
      }));

    return [...convexSummaries, ...olderSummaries];
  }, [summaries, olderRequests, searchResults, debouncedSearch, methodFilter]);

  // Track incoming requests for live mode
  useEffect(() => {
    if (!summaries || summaries.length === 0) {
      prevTopSummaryId.current = null;
      return;
    }

    const topId = summaries[0]._id;
    const previousTopId = prevTopSummaryId.current;

    if (previousTopId && topId !== previousTopId) {
      const previousIdx = summaries.findIndex((s) => s._id === previousTopId);
      const arrived = previousIdx >= 0 ? previousIdx : 1;

      if (arrived > 0) {
        if (liveMode) {
          setSelectedId(topId);
        } else {
          setNewCount((prev) => prev + arrived);
        }

        if (!debouncedSearch) {
          const newRows = summaries.slice(0, arrived);
          const matchedCount =
            methodFilter === "ALL"
              ? arrived
              : newRows.filter((r) => r.method === methodFilter).length;
          if (matchedCount > 0) {
            setRetainedTotalCount((prev) => incrementRetainedCount(prev, matchedCount));
          }
        }

        if (previousIdx === -1) {
          void refreshRetainedCount();
        }
      }
    }

    prevTopSummaryId.current = topId;
  }, [summaries, liveMode, methodFilter, debouncedSearch, refreshRetainedCount]);

  // Auto-select first request when requests load and nothing is selected
  useEffect(() => {
    if (summaries && summaries.length > 0 && !selectedId) {
      setSelectedId(summaries[0]._id);
    }
  }, [summaries, selectedId]);

  // Reset state when endpoint changes
  const currentEndpointId = currentEndpoint?._id;
  useEffect(() => {
    setSelectedId(null);
    setSelectedDetail(null);
    setNewCount(0);
    prevTopSummaryId.current = null;
    setMethodFilter("ALL");
    setSearchInput("");
    setDebouncedSearch("");
    setOlderRequests([]);
    setSearchResults([]);
    setHasMore(false);
    setHasLoadedOlderPage(false);
    setRetainedTotalCount(null);
    setLoadingMore(false);
    setSearchLoading(false);
    setSearchError(false);
    clickHouseDetailMap.current.clear();
    prefetchedSlug.current = null;
  }, [currentEndpointId]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
  }, []);

  const handleToggleLiveMode = useCallback(() => setLiveMode((prev) => !prev), []);
  const handleToggleSort = useCallback(() => setSortNewest((prev) => !prev), []);

  const handleJumpToNew = useCallback(() => {
    if (summaries && summaries.length > 0) {
      setSelectedId(summaries[0]._id);
      setNewCount(0);
    }
  }, [summaries]);

  // Export helpers
  const handleExportJson = useCallback(async () => {
    if (!currentEndpoint) return;
    const { exportToJson, downloadFile } = await import("@/lib/export");
    const params: Record<string, string> = {
      slug: currentEndpoint.slug,
      limit: "200",
      order: "desc",
    };
    if (methodFilter !== "ALL") params.method = methodFilter;
    if (debouncedSearch) params.q = debouncedSearch;

    const { data: results, ok } = await fetchFromClickHouse(params);
    if (!ok || results.length === 0) {
      alert("Export failed: could not fetch data. Please try again.");
      return;
    }
    downloadFile(exportToJson(results), "webhooks-export.json", "application/json");
    if (results.length >= 200) {
      alert("Exported first 200 requests. Use search filters to narrow the export.");
    }
  }, [currentEndpoint, methodFilter, debouncedSearch, fetchFromClickHouse]);

  const handleExportCsv = useCallback(async () => {
    if (!currentEndpoint) return;
    const { exportToCsv, downloadFile } = await import("@/lib/export");
    const params: Record<string, string> = {
      slug: currentEndpoint.slug,
      limit: "200",
      order: "desc",
    };
    if (methodFilter !== "ALL") params.method = methodFilter;
    if (debouncedSearch) params.q = debouncedSearch;

    const { data: results, ok } = await fetchFromClickHouse(params);
    if (!ok || results.length === 0) {
      alert("Export failed: could not fetch data. Please try again.");
      return;
    }
    downloadFile(exportToCsv(results), "webhooks-export.csv", "text/csv");
    if (results.length >= 200) {
      alert("Exported first 200 requests. Use search filters to narrow the export.");
    }
  }, [currentEndpoint, methodFilter, debouncedSearch, fetchFromClickHouse]);

  const hasRequests = summaries && summaries.length > 0;
  const loadedCount = displayedItems.length;
  const initialCanLoadMore = (summaries?.length ?? 0) >= CLICKHOUSE_PAGE_SIZE;
  const showHasMore = computeShowHasMore({
    searchQuery: debouncedSearch,
    hasMoreFromPagination: hasMore,
    retainedTotalCount,
    loadedCount,
    hasLoadedOlderPage,
    initialCanLoadMore,
  });

  return {
    // Data
    endpoints,
    currentEndpoint,
    summaries,
    displayedItems,
    displayRequest,
    hasRequests,

    // Selection
    selectedId,
    handleSelect,
    mobileDetail,
    setMobileDetail,

    // Controls
    liveMode,
    handleToggleLiveMode,
    sortNewest,
    handleToggleSort,
    newCount,
    handleJumpToNew,
    methodFilter,
    setMethodFilter,
    searchInput,
    setSearchInput,
    retainedTotalCount,

    // Pagination
    handleLoadMore,
    showHasMore,
    loadingMore,

    // Search
    searchLoading,
    searchError,

    // Export
    handleExportJson,
    handleExportCsv,
  };
}
