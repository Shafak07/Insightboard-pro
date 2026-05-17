import type { ChartRenderConfig } from "@/components/charts/ChartRenderer";
import type { BuilderChartType } from "@/lib/chart-builder-store";
import type { ColorScheme } from "@/lib/chart-utils";
import type { DashboardWidget, WidgetChartConfig } from "@/lib/dashboards";

export function chartConfigToRenderer(
  config: WidgetChartConfig | null | undefined
): ChartRenderConfig {
  const c = config ?? {
    chart_type: "bar",
    x_col: "",
    y_col: "",
    title: "Chart",
    color_scheme: "corporate",
    show_ai_insight: false,
  };
  return {
    chartType: (c.chart_type as BuilderChartType) || "bar",
    xAxisColumn: c.x_col ?? "",
    yAxisColumn: c.y_col ?? "",
    groupByColumn: c.group_by ?? "",
    colorScheme: (c.color_scheme as ColorScheme) || "corporate",
    chartTitle: c.title ?? "Chart",
    showGridLines: c.show_grid_lines ?? true,
    showLegend: c.show_legend ?? true,
    showTooltip: c.show_tooltip ?? true,
    horizontalBar: c.horizontal_bar ?? false,
  };
}

export function savedChartToWidgetConfig(chart: {
  chartType: BuilderChartType;
  xAxisColumn: string;
  yAxisColumn: string;
  groupByColumn: string;
  colorScheme: ColorScheme;
  chartTitle: string;
  showGridLines: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  horizontalBar: boolean;
}): WidgetChartConfig {
  return {
    chart_type: chart.chartType,
    x_col: chart.xAxisColumn,
    y_col: chart.yAxisColumn,
    group_by: chart.groupByColumn || null,
    title: chart.chartTitle,
    color_scheme: chart.colorScheme,
    show_ai_insight: false,
    show_grid_lines: chart.showGridLines,
    show_legend: chart.showLegend,
    show_tooltip: chart.showTooltip,
    horizontal_bar: chart.horizontalBar,
  };
}

export function widgetDatasetId(widget: DashboardWidget): string | null {
  return widget.dataset_id ?? null;
}
