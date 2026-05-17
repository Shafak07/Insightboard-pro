import { create } from "zustand";

import type { ColorScheme } from "@/lib/chart-utils";

export type BuilderChartType =
  | "line"
  | "bar"
  | "scatter"
  | "heatmap"
  | "metric"
  | "area";

interface ChartBuilderState {
  selectedChartType: BuilderChartType;
  xAxisColumn: string;
  yAxisColumn: string;
  groupByColumn: string;
  sizeColumn: string;
  colorScheme: ColorScheme;
  chartTitle: string;
  showGridLines: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  setChartType: (t: BuilderChartType) => void;
  setXAxis: (col: string) => void;
  setYAxis: (col: string) => void;
  setGroupBy: (col: string) => void;
  setSizeColumn: (col: string) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setChartTitle: (title: string) => void;
  setShowGridLines: (v: boolean) => void;
  setShowLegend: (v: boolean) => void;
  setShowTooltip: (v: boolean) => void;
  applyRecommendation: (rec: {
    chart_type: string;
    x_column: string;
    y_column: string;
    reason?: string;
  }) => void;
  reset: () => void;
}

const CHART_TYPE_ALIASES: Record<string, BuilderChartType> = {
  line: "line",
  area: "area",
  bar: "bar",
  column: "bar",
  scatter: "scatter",
  heatmap: "heatmap",
  metric: "metric",
  kpi: "metric",
};

const initial = {
  selectedChartType: "line" as BuilderChartType,
  xAxisColumn: "",
  yAxisColumn: "",
  groupByColumn: "",
  sizeColumn: "",
  colorScheme: "corporate" as ColorScheme,
  chartTitle: "Chart preview",
  showGridLines: true,
  showLegend: true,
  showTooltip: true,
};

export const useChartBuilderStore = create<ChartBuilderState>((set) => ({
  ...initial,
  setChartType: (selectedChartType) => set({ selectedChartType }),
  setXAxis: (xAxisColumn) => set({ xAxisColumn }),
  setYAxis: (yAxisColumn) => set({ yAxisColumn }),
  setGroupBy: (groupByColumn) => set({ groupByColumn }),
  setSizeColumn: (sizeColumn) => set({ sizeColumn }),
  setColorScheme: (colorScheme) => set({ colorScheme }),
  setChartTitle: (chartTitle) => set({ chartTitle }),
  setShowGridLines: (showGridLines) => set({ showGridLines }),
  setShowLegend: (showLegend) => set({ showLegend }),
  setShowTooltip: (showTooltip) => set({ showTooltip }),
  applyRecommendation: (rec) => {
    const key = rec.chart_type.toLowerCase().replace(/\s+/g, "_");
    const selectedChartType = CHART_TYPE_ALIASES[key] ?? "bar";
    const title =
      rec.reason && rec.reason.length > 0
        ? rec.reason.slice(0, 72)
        : "Recommended chart";
    set({
      selectedChartType,
      xAxisColumn: rec.x_column,
      yAxisColumn: rec.y_column,
      chartTitle: title,
    });
  },
  reset: () => set(initial),
}));
