import { create } from "zustand";
import type { ClickHouseRequest } from "@/types/request";

/**
 * Zustand store for dashboard UI + ClickHouse state.
 *
 * Convex queries (endpoints, summaries, selectedRequest) remain as React hooks
 * because they must run inside a React render cycle. This store holds everything
 * else so that components can subscribe to fine-grained slices and avoid
 * unnecessary re-renders (e.g. typing in search doesn't re-render the detail pane).
 */

interface DashboardState {
  // Selection
  selectedId: string | null;
  mobileDetail: boolean;

  // Controls
  liveMode: boolean;
  sortNewest: boolean;
  newCount: number;
  methodFilter: string;
  searchInput: string;
  debouncedSearch: string;

  // ClickHouse pagination
  olderRequests: ClickHouseRequest[];
  searchResults: ClickHouseRequest[];
  hasMore: boolean;
  hasLoadedOlderPage: boolean;
  retainedTotalCount: number | null;
  loadingMore: boolean;
  searchLoading: boolean;
  searchError: boolean;

  // ClickHouse detail for selected request
  selectedDetail: ClickHouseRequest | null;

  // Actions
  setSelectedId: (id: string | null) => void;
  select: (id: string) => void;
  setMobileDetail: (v: boolean) => void;
  toggleLiveMode: () => void;
  toggleSort: () => void;
  setNewCount: (v: number | ((prev: number) => number)) => void;
  setMethodFilter: (v: string) => void;
  setSearchInput: (v: string) => void;
  setDebouncedSearch: (v: string) => void;
  setOlderRequests: (v: ClickHouseRequest[] | ((prev: ClickHouseRequest[]) => ClickHouseRequest[])) => void;
  setSearchResults: (v: ClickHouseRequest[]) => void;
  setHasMore: (v: boolean) => void;
  setHasLoadedOlderPage: (v: boolean) => void;
  setRetainedTotalCount: (v: number | null | ((prev: number | null) => number | null)) => void;
  setLoadingMore: (v: boolean) => void;
  setSearchLoading: (v: boolean) => void;
  setSearchError: (v: boolean) => void;
  setSelectedDetail: (v: ClickHouseRequest | null) => void;

  // Bulk reset when endpoint changes
  resetForEndpoint: () => void;
  // Full reset (for unmount / navigation away)
  reset: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  // Selection
  selectedId: null,
  mobileDetail: false,

  // Controls
  liveMode: true,
  sortNewest: true,
  newCount: 0,
  methodFilter: "ALL",
  searchInput: "",
  debouncedSearch: "",

  // ClickHouse pagination
  olderRequests: [],
  searchResults: [],
  hasMore: false,
  hasLoadedOlderPage: false,
  retainedTotalCount: null,
  loadingMore: false,
  searchLoading: false,
  searchError: false,

  // ClickHouse detail
  selectedDetail: null,

  // Actions
  setSelectedId: (id) => set({ selectedId: id }),
  select: (id) => set({ selectedId: id, mobileDetail: true }),
  setMobileDetail: (v) => set({ mobileDetail: v }),
  toggleLiveMode: () => set((s) => ({ liveMode: !s.liveMode })),
  toggleSort: () => set((s) => ({ sortNewest: !s.sortNewest })),
  setNewCount: (v) =>
    set((s) => ({ newCount: typeof v === "function" ? v(s.newCount) : v })),
  setMethodFilter: (v) => set({ methodFilter: v }),
  setSearchInput: (v) => set({ searchInput: v }),
  setDebouncedSearch: (v) => set({ debouncedSearch: v }),
  setOlderRequests: (v) =>
    set((s) => ({
      olderRequests: typeof v === "function" ? v(s.olderRequests) : v,
    })),
  setSearchResults: (v) => set({ searchResults: v }),
  setHasMore: (v) => set({ hasMore: v }),
  setHasLoadedOlderPage: (v) => set({ hasLoadedOlderPage: v }),
  setRetainedTotalCount: (v) =>
    set((s) => ({
      retainedTotalCount: typeof v === "function" ? v(s.retainedTotalCount) : v,
    })),
  setLoadingMore: (v) => set({ loadingMore: v }),
  setSearchLoading: (v) => set({ searchLoading: v }),
  setSearchError: (v) => set({ searchError: v }),
  setSelectedDetail: (v) => set({ selectedDetail: v }),

  resetForEndpoint: () =>
    set({
      selectedId: null,
      selectedDetail: null,
      mobileDetail: false,
      newCount: 0,
      methodFilter: "ALL",
      searchInput: "",
      debouncedSearch: "",
      olderRequests: [],
      searchResults: [],
      hasMore: false,
      hasLoadedOlderPage: false,
      retainedTotalCount: null,
      loadingMore: false,
      searchLoading: false,
      searchError: false,
    }),

  reset: () =>
    set({
      selectedId: null,
      selectedDetail: null,
      mobileDetail: false,
      liveMode: true,
      sortNewest: true,
      newCount: 0,
      methodFilter: "ALL",
      searchInput: "",
      debouncedSearch: "",
      olderRequests: [],
      searchResults: [],
      hasMore: false,
      hasLoadedOlderPage: false,
      retainedTotalCount: null,
      loadingMore: false,
      searchLoading: false,
      searchError: false,
    }),
}));
