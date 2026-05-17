import { create } from "zustand";

interface DashboardLiveState {
  viewerCounts: Record<string, number>;
  setViewerCount: (dashboardId: string, count: number) => void;
}

export const useDashboardLiveStore = create<DashboardLiveState>((set) => ({
  viewerCounts: {},
  setViewerCount: (dashboardId, count) =>
    set((s) => ({
      viewerCounts: { ...s.viewerCounts, [dashboardId]: count },
    })),
}));
