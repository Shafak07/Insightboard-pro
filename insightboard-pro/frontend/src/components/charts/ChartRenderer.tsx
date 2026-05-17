"use client";

import { memo, useMemo } from "react";

import { downsampleRows } from "@/lib/chart-performance";

import { BarChart } from "@/components/charts/BarChart";
import { HeatmapChart } from "@/components/charts/HeatmapChart";
import { LineChart } from "@/components/charts/LineChart";
import { MetricCard } from "@/components/charts/MetricCard";
import { ScatterPlot } from "@/components/charts/ScatterPlot";
import type { ColumnMeta } from "@/components/charts/types";
import type { BuilderChartType } from "@/lib/chart-builder-store";
import {
  aggregateData,
  buildCorrelationMatrix,
  correlationsDictToMatrix,
  getColorPalette,
  inferColumnKind,
  type ColorScheme,
} from "@/lib/chart-utils";

export interface ChartRenderConfig {
  chartType: BuilderChartType;
  xAxisColumn: string;
  yAxisColumn: string;
  groupByColumn?: string;
  sizeColumn?: string;
  colorScheme: ColorScheme;
  chartTitle: string;
  showGridLines: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  horizontalBar?: boolean;
}

export interface ChartRendererProps {
  config: ChartRenderConfig;
  rows: Record<string, unknown>[];
  columnsMetadata?: ColumnMeta[] | null;
  correlations?: Record<string, Record<string, number>> | null;
  height?: number;
}

function ChartRendererInner({
  config,
  rows,
  columnsMetadata,
  correlations: serverCorrelations,
  height = 340,
}: ChartRendererProps) {
  const displayRows = useMemo(() => downsampleRows(rows, 1000), [rows]);
  const columns = columnsMetadata ?? [];

  const numericCols = useMemo(
    () =>
      columns
        .filter((c) => inferColumnKind(c) === "numeric")
        .map((c) => String(c.column_name)),
    [columns]
  );

  const categoricalCols = useMemo(
    () =>
      columns
        .filter((c) => inferColumnKind(c) === "categorical")
        .map((c) => String(c.column_name)),
    [columns]
  );

  const columnNames = useMemo(
    () => columns.map((c) => String(c.column_name)),
    [columns]
  );

  const chartOptions = useMemo(
    () => ({
      colors: getColorPalette(config.colorScheme, 6),
      colorScheme: config.colorScheme,
      showGrid: config.showGridLines,
      showLegend: config.showLegend,
      showTooltip: config.showTooltip,
      height,
    }),
    [config, height]
  );

  const chartData = useMemo(() => {
    if (!displayRows.length || !config.xAxisColumn) return displayRows;
    if (
      config.chartType === "bar" &&
      config.groupByColumn &&
      config.yAxisColumn
    ) {
      return aggregateData(
        displayRows,
        config.xAxisColumn,
        config.yAxisColumn,
        "sum"
      );
    }
    return displayRows;
  }, [displayRows, config]);

  const correlation = useMemo(() => {
    if (
      serverCorrelations &&
      Object.keys(serverCorrelations).length > 0
    ) {
      return correlationsDictToMatrix(serverCorrelations);
    }
    const cols =
      numericCols.length > 1 ? numericCols : columnNames.slice(0, 8);
    return buildCorrelationMatrix(displayRows, cols);
  }, [displayRows, numericCols, columnNames, serverCorrelations]);

  const metricValue = useMemo(() => {
    if (!config.yAxisColumn) return 0;
    const vals = displayRows
      .map((r) => Number(r[config.yAxisColumn]))
      .filter((v) => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [displayRows, config.yAxisColumn]);

  const metricHistory = useMemo(() => {
    if (!config.yAxisColumn) return [];
    return displayRows
      .map((r) => ({ value: Number(r[config.yAxisColumn]) }))
      .filter((r) => Number.isFinite(r.value))
      .slice(-24);
  }, [displayRows, config.yAxisColumn]);

  if (!displayRows.length && config.chartType !== "metric") {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No data matches your filters.
      </p>
    );
  }

  if (!config.xAxisColumn && config.chartType !== "metric") {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Map X and Y columns to display this chart.
      </p>
    );
  }

  if (!config.yAxisColumn && config.chartType !== "heatmap") {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Select a Y axis column for this chart type.
      </p>
    );
  }

  switch (config.chartType) {
    case "line":
    case "area":
      return (
        <LineChart
          {...chartOptions}
          data={chartData}
          xKey={config.xAxisColumn}
          area={config.chartType === "area"}
          series={[{ dataKey: config.yAxisColumn, name: config.yAxisColumn }]}
        />
      );
    case "bar":
      return (
        <BarChart
          {...chartOptions}
          data={chartData}
          xKey={config.xAxisColumn}
          yKeys={[config.yAxisColumn]}
          horizontal={config.horizontalBar}
          colorByValue
        />
      );
    case "scatter":
      return (
        <ScatterPlot
          {...chartOptions}
          data={displayRows}
          xKey={config.xAxisColumn}
          yKey={config.yAxisColumn}
          sizeKey={config.sizeColumn || undefined}
          colorKey={config.groupByColumn || undefined}
          labelKey={categoricalCols[0]}
        />
      );
    case "heatmap":
      return (
        <HeatmapChart
          labels={correlation.labels}
          matrix={correlation.matrix}
          height={height}
        />
      );
    case "metric":
      return (
        <MetricCard
          title={config.chartTitle}
          value={metricValue}
          previousValue={
            metricHistory.length > 1
              ? metricHistory[metricHistory.length - 2].value
              : undefined
          }
          history={metricHistory}
        />
      );
    default:
      return null;
  }
}

export const ChartRenderer = memo(ChartRendererInner);
