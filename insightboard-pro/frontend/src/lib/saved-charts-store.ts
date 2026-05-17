import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { BuilderChartType } from "@/lib/chart-builder-store";
import type { ColorScheme } from "@/lib/chart-utils";

export interface SavedChartConfig {
  id: string;
  datasetId: string;
  datasetName: string;
  chartType: BuilderChartType;
  xAxisColumn: string;
  yAxisColumn: string;
  groupByColumn: string;
  sizeColumn: string;
  colorScheme: ColorScheme;
  chartTitle: string;
  showGridLines: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  horizontalBar: boolean;
  createdAt: string;
  isTemplate?: boolean;
}

interface SavedChartsState {
  dashboardCharts: SavedChartConfig[];
  templates: SavedChartConfig[];
  addToDashboard: (chart: Omit<SavedChartConfig, "id" | "createdAt">) => string;
  saveTemplate: (chart: Omit<SavedChartConfig, "id" | "createdAt" | "isTemplate">) => string;
  removeFromDashboard: (id: string) => void;
  removeTemplate: (id: string) => void;
}

function newId() {
  return `chart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useSavedChartsStore = create<SavedChartsState>()(
  persist(
    (set) => ({
      dashboardCharts: [],
      templates: [],
      addToDashboard: (chart) => {
        const id = newId();
        set((state) => ({
          dashboardCharts: [
            ...state.dashboardCharts,
            { ...chart, id, createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },
      saveTemplate: (chart) => {
        const id = newId();
        set((state) => ({
          templates: [
            ...state.templates,
            {
              ...chart,
              id,
              isTemplate: true,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
        return id;
      },
      removeFromDashboard: (id) =>
        set((state) => ({
          dashboardCharts: state.dashboardCharts.filter((c) => c.id !== id),
        })),
      removeTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((c) => c.id !== id),
        })),
    }),
    { name: "insightboard-saved-charts" }
  )
);
