"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useSearchParams } from "next/navigation";
import { useShallow } from "zustand/shallow";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { DisplayableRequest } from "@/components/dashboard/request-detail";
import type { ClickHouseRequest, ClickHouseSummary, AnyRequestSummary } from "@/types/request";
import {
  buildRetainedCountParams,
  computeShowHasMore,
  incrementRetainedCount,
} from "@/lib/dashboard-count";
import { useDashboardStore } from "@/lib/dashboard-store";

const CLICKHOUSE_PAGE_SIZE = 50;

export function useDashboardState() {
  // ── Zustand slices ──────────────────────────────────────────────
  const store = useDashboardStore(
    useShallow((s) => ({
      selectedId: s.selectedId,
      setSelectedId: s.setSelectedId,
      select: s.select,
      mobileDetail: s.mobileDetail,
      setMobileDetail: s.setMobileDetail,
      liveMode: s.liveMode,
      toggleLiveMode: s.toggleLiveMode,
      sortNewest: s.sortNewest,
      toggleSort: s.toggleSort,
      newCount: s.newCount,
      setNewCount: s.setNewCount,
      methodFilter: s.methodFilter,
      setMethodFilter: s.setMethodFilter,
      searchInput: s.searchInput,
      setSearchInput: s.setSearchInput,
      debouncedSearch: s.debouncedSearch,
      setDebouncedSearch: s.setDebouncedSearch,
      olderRequests: s.olderRequests,
      setOlderRequests: s.setOlderRequests,
      searchResults: s.searchResults,
      setSearchResults: s.setSearchResults,
      hasMore: s.hasMore,
      setHasMore: s.setHasMore,
      hasLoadedOlderPage: s.hasLoadedOlderPage,
      setHasLoadedOlderPage: s.setHasLoadedOlderPage,
      retainedTotalCount: s.retainedTotalCount,
      setRetainedTotalCount: s.setRetainedTotalCount,
      loadingMore: s.loadingMore,
      setLoadingMore: s.setLoadingMore,
      searchLoading: s.searchLoading,
      setSearchLoading: s.setSearchLoading,
      searchError: s.searchError,
      setSearchError: s.setSearchError,
      selectedDetail: s.selectedDetail,
      setSelectedDetail: s.setSelectedDetail,
      resetForEndpoint: s.resetForEndpoint,
    }))
  );

  // ── Convex queries (must be React hooks) ────────────────────────
  const endpoints = useQuery(api.endpoints.list);
  const searchParams = useSearchParams();
  const endpointSlug = searchParams.get("endpoint");

  const currentEndpoint = endpoints?.find((ep) => ep.slug === endpointSlug) ?? endpoints?.[0];

  const summaries = useQuery(
    api.requests.listSummaries,
    currentEndpoint ? { endpointId: currentEndpoint._id, limit: 50 } : "skip"
  );

  const isConvexId = store.selectedId != null && !store.selectedId.includes(":");
  const selectedRequest = useQuery(
    api.requests.get,
    isConvexId && !store.selectedDetail
      ? { id: store.selectedId as Id<"requests"> }
      : "skip"
  );

  // ── Auth token ──────────────────────────────────────────────────
  const authToken = useAuthToken();

  // ── Debounce search ─────────────────────────────────────────────
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (store.searchInput === "") {
      store.setDebouncedSearch("");
      return;
    }
    searchDebounceRef.current = setTimeout(
      () => store.setDebouncedSearch(store.searchInput),
      400
    );
    return () => clearTimeout(searchDebounceRef.current);
  }, [store.searchInput, store.setDebouncedSearch]);

  // ── Clear stale selection ───────────────────────────────────────
  useEffect(() => {
    if (
      selectedRequest === null &&
      !store.selectedDetail &&
      store.selectedId &&
      isConvexId
    ) {
      store.setSelectedId(null);
    }
  }, [selectedRequest, store.selectedDetail, store.selectedId, isConvexId, store.setSelectedId]);

  // ── Displayable request ─────────────────────────────────────────
  const displayRequest = useMemo((): DisplayableRequest | undefined => {
    if (!store.selectedId) return undefined;
    if (store.selectedDetail) return store.selectedDetail;
    if (isConvexId) return selectedRequest ?? undefined;
    return undefined;
  }, [store.selectedId, store.selectedDetail, isConvexId, selectedRequest]);

  // ── ClickHouse helpers ──────────────────────────────────────────
  const fetchFromClickHouse = useCallback(
    async (
      params: Record<string, string>
    ): Promise<{ data: ClickHouseRequest[]; ok: boolean }> => {
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
    async (
      params: Record<string, string>
    ): Promise<{ count: number | null; ok: boolean }> => {
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

  // ── Detail cache ────────────────────────────────────────────────
  const clickHouseDetailMap = useRef(new Map<string, ClickHouseRequest>());

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

  // ── Pre-fetch first ClickHouse page ─────────────────────────────
  const prefetchedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!currentEndpoint || !summaries?.length || !authToken) return;
    if (prefetchedSlug.current === currentEndpoint.slug) return;

    const slugToFetch = currentEndpoint.slug;
    let cancelled = false;

    fetchFromClickHouse({ slug: slugToFetch, limit: "50", order: "desc" }).then(
      ({ data: results }) => {
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
      }
    );

    return () => {
      cancelled = true;
    };
  }, [currentEndpoint, summaries, authToken, fetchFromClickHouse, storeClickHouseResults]);

  // ── Fetch detail on selection change ────────────────────────────
  useEffect(() => {
    if (!store.selectedId) {
      store.setSelectedDetail(null);
      return;
    }

    const cached = clickHouseDetailMap.current.get(store.selectedId);
    if (cached) {
      store.setSelectedDetail(cached);
      return;
    }

    store.setSelectedDetail(null);
    if (!currentEndpoint) return;

    let receivedAt: number | undefined;
    if (isConvexId && summaries) {
      const summary = summaries.find((s) => s._id === store.selectedId);
      if (summary) receivedAt = summary.receivedAt;
    }

    if (isConvexId && receivedAt == null) {
      store.setSelectedDetail(null);
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
        const summaryMethod = summaries?.find(
          (s) => s._id === store.selectedId
        )?.method;
        const candidates = summaryMethod
          ? results.filter((r) => r.method === summaryMethod)
          : results;
        const pool = candidates.length > 0 ? candidates : results;
        const match = pool.reduce((best, r) =>
          Math.abs(r.receivedAt - receivedAt!) < Math.abs(best.receivedAt - receivedAt!)
            ? r
            : best
        );
        clickHouseDetailMap.current.set(store.selectedId!, match);
        store.setSelectedDetail(match);
      } else if (results.length > 0) {
        const match = results.find((r) => r.id === store.selectedId);
        if (match) store.setSelectedDetail(match);
      } else {
        store.setSelectedDetail(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    store.selectedId,
    isConvexId,
    currentEndpoint,
    summaries,
    fetchFromClickHouse,
    storeClickHouseResults,
    store.setSelectedDetail,
  ]);

  // ── Clear paginated results on filter change ────────────────────
  const prevMethodFilter = useRef(store.methodFilter);
  useEffect(() => {
    if (prevMethodFilter.current !== store.methodFilter) {
      prevMethodFilter.current = store.methodFilter;
      store.setOlderRequests([]);
      store.setHasMore(false);
      store.setHasLoadedOlderPage(false);
    }
  }, [store.methodFilter, store.setOlderRequests, store.setHasMore, store.setHasLoadedOlderPage]);

  // ── Load More ───────────────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    const { loadingMore, olderRequests, methodFilter } = useDashboardStore.getState();
    if (!currentEndpoint || loadingMore) return;
    useDashboardStore.getState().setLoadingMore(true);

    const currentOldest =
      olderRequests.length > 0 ? olderRequests[olderRequests.length - 1] : null;
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
      const s = useDashboardStore.getState();
      s.setOlderRequests((prev) => [...prev, ...results]);
      s.setHasMore(results.length >= CLICKHOUSE_PAGE_SIZE);
      s.setHasLoadedOlderPage(true);
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      useDashboardStore.getState().setLoadingMore(false);
    }
  }, [currentEndpoint, summaries, fetchFromClickHouse, storeClickHouseResults]);

  // ── Search via ClickHouse ───────────────────────────────────────
  useEffect(() => {
    if (!store.debouncedSearch || !currentEndpoint) {
      store.setSearchResults([]);
      store.setSearchError(false);
      store.setSearchLoading(false);
      return;
    }

    let cancelled = false;
    store.setSearchLoading(true);
    store.setSearchError(false);

    const params: Record<string, string> = {
      slug: currentEndpoint.slug,
      q: store.debouncedSearch,
      limit: String(CLICKHOUSE_PAGE_SIZE),
      order: "desc",
    };
    if (store.methodFilter !== "ALL") params.method = store.methodFilter;

    fetchFromClickHouse(params)
      .then(({ data: results, ok }) => {
        if (cancelled) return;
        if (!ok) {
          useDashboardStore.getState().setSearchError(true);
          useDashboardStore.getState().setSearchResults([]);
        } else {
          storeClickHouseResults(results);
          useDashboardStore.getState().setSearchResults(results);
        }
      })
      .finally(() => {
        if (!cancelled) useDashboardStore.getState().setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    store.debouncedSearch,
    currentEndpoint,
    store.methodFilter,
    fetchFromClickHouse,
    storeClickHouseResults,
    store.setSearchResults,
    store.setSearchError,
    store.setSearchLoading,
  ]);

  // ── Retained count ──────────────────────────────────────────────
  const currentSlug = currentEndpoint?.slug;
  const retainedCountRequestSeq = useRef(0);

  const refreshRetainedCount = useCallback(async () => {
    if (!currentSlug) return;
    const requestSeq = ++retainedCountRequestSeq.current;
    const { methodFilter, debouncedSearch } = useDashboardStore.getState();
    const params = buildRetainedCountParams(currentSlug, methodFilter, debouncedSearch);

    const { count, ok } = await fetchCountFromClickHouse(params);
    if (requestSeq !== retainedCountRequestSeq.current) return;
    if (ok && count != null) {
      useDashboardStore.getState().setRetainedTotalCount(count);
    }
  }, [currentSlug, fetchCountFromClickHouse]);

  useEffect(() => {
    if (!currentSlug || !authToken) {
      retainedCountRequestSeq.current++;
      store.setRetainedTotalCount(null);
      return;
    }
    void refreshRetainedCount();
  }, [
    currentSlug,
    authToken,
    store.methodFilter,
    store.debouncedSearch,
    refreshRetainedCount,
    store.setRetainedTotalCount,
  ]);

  // Re-sync count on tab focus
  useEffect(() => {
    if (!currentSlug || !authToken) return;
    const onFocus = () => void refreshRetainedCount();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshRetainedCount();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [currentSlug, authToken, refreshRetainedCount]);

  // ── Displayed items ─────────────────────────────────────────────
  const displayedItems = useMemo((): AnyRequestSummary[] => {
    if (store.debouncedSearch) {
      return store.searchResults.map(
        (r): ClickHouseSummary => ({
          id: r.id,
          method: r.method,
          receivedAt: r.receivedAt,
        })
      );
    }

    const convexSummaries: AnyRequestSummary[] = summaries
      ? store.methodFilter === "ALL"
        ? summaries
        : summaries.filter((r) => r.method === store.methodFilter)
      : [];

    const oldestConvex =
      summaries && summaries.length > 0
        ? summaries[summaries.length - 1].receivedAt
        : -Infinity;
    const olderSummaries: ClickHouseSummary[] = store.olderRequests
      .filter((r) => r.receivedAt < oldestConvex)
      .map((r) => ({ id: r.id, method: r.method, receivedAt: r.receivedAt }));

    return [...convexSummaries, ...olderSummaries];
  }, [summaries, store.olderRequests, store.searchResults, store.debouncedSearch, store.methodFilter]);

  // ── Live mode tracking ──────────────────────────────────────────
  const prevTopSummaryId = useRef<string | null>(null);
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
        const { liveMode, debouncedSearch, methodFilter } =
          useDashboardStore.getState();
        if (liveMode) {
          useDashboardStore.getState().setSelectedId(topId);
        } else {
          useDashboardStore.getState().setNewCount((prev) => prev + arrived);
        }

        if (!debouncedSearch) {
          const newRows = summaries.slice(0, arrived);
          const matchedCount =
            methodFilter === "ALL"
              ? arrived
              : newRows.filter((r) => r.method === methodFilter).length;
          if (matchedCount > 0) {
            useDashboardStore
              .getState()
              .setRetainedTotalCount((prev) => incrementRetainedCount(prev, matchedCount));
          }
        }

        if (previousIdx === -1) {
          void refreshRetainedCount();
        }
      }
    }

    prevTopSummaryId.current = topId;
  }, [summaries, refreshRetainedCount]);

  // ── Auto-select first request ───────────────────────────────────
  useEffect(() => {
    if (summaries && summaries.length > 0 && !useDashboardStore.getState().selectedId) {
      store.setSelectedId(summaries[0]._id);
    }
  }, [summaries, store.setSelectedId]);

  // ── Reset on endpoint change ────────────────────────────────────
  const currentEndpointId = currentEndpoint?._id;
  useEffect(() => {
    store.resetForEndpoint();
    clickHouseDetailMap.current.clear();
    prefetchedSlug.current = null;
  }, [currentEndpointId, store.resetForEndpoint]);

  // ── Jump to new ─────────────────────────────────────────────────
  const handleJumpToNew = useCallback(() => {
    if (summaries && summaries.length > 0) {
      const s = useDashboardStore.getState();
      s.setSelectedId(summaries[0]._id);
      s.setNewCount(0);
    }
  }, [summaries]);

  // ── Export helpers ──────────────────────────────────────────────
  const handleExportJson = useCallback(async () => {
    if (!currentEndpoint) return;
    const { exportToJson, downloadFile } = await import("@/lib/export");
    const { methodFilter, debouncedSearch } = useDashboardStore.getState();
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
  }, [currentEndpoint, fetchFromClickHouse]);

  const handleExportCsv = useCallback(async () => {
    if (!currentEndpoint) return;
    const { exportToCsv, downloadFile } = await import("@/lib/export");
    const { methodFilter, debouncedSearch } = useDashboardStore.getState();
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
  }, [currentEndpoint, fetchFromClickHouse]);

  // ── Hover prefetch ──────────────────────────────────────────────
  const prefetchInflight = useRef(new Set<string>());
  const handlePrefetchDetail = useCallback(
    (id: string) => {
      // Already cached or already fetching
      if (clickHouseDetailMap.current.has(id) || prefetchInflight.current.has(id)) return;
      if (!currentEndpoint) return;

      prefetchInflight.current.add(id);

      // Try to find receivedAt from summaries for Convex IDs
      const isConvex = !id.includes(":");
      let receivedAt: number | undefined;
      if (isConvex && summaries) {
        const summary = summaries.find((s) => s._id === id);
        if (summary) receivedAt = summary.receivedAt;
      }

      if (isConvex && receivedAt == null) {
        prefetchInflight.current.delete(id);
        return;
      }

      const params: Record<string, string> = {
        slug: currentEndpoint.slug,
        limit: "10",
        order: "desc",
      };
      if (receivedAt != null) {
        params.from = String(receivedAt);
        params.to = String(receivedAt);
      }

      fetchFromClickHouse(params)
        .then(({ data: results }) => {
          storeClickHouseResults(results);
          if (receivedAt != null && results.length > 0) {
            const summaryMethod = summaries?.find((s) => s._id === id)?.method;
            const candidates = summaryMethod
              ? results.filter((r) => r.method === summaryMethod)
              : results;
            const pool = candidates.length > 0 ? candidates : results;
            const match = pool.reduce((best, r) =>
              Math.abs(r.receivedAt - receivedAt!) < Math.abs(best.receivedAt - receivedAt!)
                ? r
                : best
            );
            clickHouseDetailMap.current.set(id, match);
          } else if (results.length > 0) {
            const match = results.find((r) => r.id === id);
            if (match) clickHouseDetailMap.current.set(id, match);
          }
        })
        .finally(() => {
          prefetchInflight.current.delete(id);
        });
    },
    [currentEndpoint, summaries, fetchFromClickHouse, storeClickHouseResults]
  );

  // ── Computed values ─────────────────────────────────────────────
  const hasRequests = summaries && summaries.length > 0;
  const loadedCount = displayedItems.length;
  const initialCanLoadMore = (summaries?.length ?? 0) >= CLICKHOUSE_PAGE_SIZE;
  const showHasMore = computeShowHasMore({
    searchQuery: store.debouncedSearch,
    hasMoreFromPagination: store.hasMore,
    retainedTotalCount: store.retainedTotalCount,
    loadedCount,
    hasLoadedOlderPage: store.hasLoadedOlderPage,
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
    selectedId: store.selectedId,
    handleSelect: store.select,
    mobileDetail: store.mobileDetail,
    setMobileDetail: store.setMobileDetail,

    // Controls
    liveMode: store.liveMode,
    handleToggleLiveMode: store.toggleLiveMode,
    sortNewest: store.sortNewest,
    handleToggleSort: store.toggleSort,
    newCount: store.newCount,
    handleJumpToNew,
    methodFilter: store.methodFilter,
    setMethodFilter: store.setMethodFilter,
    searchInput: store.searchInput,
    setSearchInput: store.setSearchInput,
    retainedTotalCount: store.retainedTotalCount,

    // Pagination
    handleLoadMore,
    showHasMore,
    loadingMore: store.loadingMore,

    // Search
    searchLoading: store.searchLoading,
    searchError: store.searchError,

    // Export
    handleExportJson,
    handleExportCsv,

    // Hover prefetch
    handlePrefetchDetail,
  };
}
