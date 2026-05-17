"use client";

import { Download, FileSpreadsheet, GripVertical, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { useMemo, useRef } from "react";

import { ChartAIInsight } from "@/components/ai/ChartAIInsight";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import type { ColumnMeta } from "@/components/charts/types";
import { MetricCard } from "@/components/charts/MetricCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  exportChartAsPNG,
  exportDataAsCSV,
} from "@/lib/export-utils";
import { useDatasetChartData } from "@/hooks/use-dataset-chart-data";
import type { DashboardWidget } from "@/lib/dashboards";
import { cn } from "@/lib/utils";

import { chartConfigToRenderer, widgetDatasetId } from "./widget-utils";

export interface DashboardWidgetCardProps {
  widget: DashboardWidget;
  readOnly?: boolean;
  previewMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function stopGridEvent(e: React.SyntheticEvent) {
  e.stopPropagation();
  e.preventDefault();
}

export function DashboardWidgetCard({
  widget,
  readOnly = false,
  previewMode = false,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
}: DashboardWidgetCardProps) {
  const datasetId = widgetDatasetId(widget);
  const { data, isLoading, error } = useDatasetChartData(
    datasetId ?? "",
    Boolean(datasetId) &&
      (widget.type === "chart" || widget.type === "metric" || widget.type === "table")
  );

  const showChrome = !readOnly && !previewMode;
  const renderConfig = chartConfigToRenderer(widget.chart_config);
  const columns = (data?.columns_metadata as ColumnMeta[] | undefined) ?? null;

  const tableRows = widget.table_rows ?? data?.rows ?? [];

  const metricValue = useMemo(() => {
    const rows = data?.rows ?? [];
    const col = renderConfig.yAxisColumn || renderConfig.xAxisColumn;
    if (!col || rows.length === 0) return 0;
    const agg = widget.chart_config?.aggregation || "sum";
    const nums = rows
      .map((r) => Number(r[col]))
      .filter((n) => !Number.isNaN(n));
    if (agg === "count") return nums.length;
    if (agg === "avg") return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    if (agg === "min") return nums.length ? Math.min(...nums) : 0;
    if (agg === "max") return nums.length ? Math.max(...nums) : 0;
    return nums.reduce((a, b) => a + b, 0);
  }, [data?.rows, renderConfig.xAxisColumn, renderConfig.yAxisColumn, widget.chart_config?.aggregation]);

  const title = widget.chart_config?.title || widget.type;
  const captureRef = useRef<HTMLDivElement>(null);
  const exportSlug = title.replace(/\s+/g, "-").toLowerCase() || "widget";
  const exportRows = data?.rows ?? tableRows;

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border bg-card/80 shadow-sm transition-shadow",
        selected ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-border",
        !readOnly && "hover:shadow-md"
      )}
    >
      {showChrome ? (
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-1 py-1">
          <div
            className="drag-handle flex cursor-grab items-center gap-1 px-1 active:cursor-grabbing"
            onMouseDown={stopGridEvent}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <span
            className="min-w-0 flex-1 truncate px-1 text-[11px] font-medium text-muted-foreground"
            onClick={onSelect}
            onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
            role="presentation"
          >
            {title}
          </span>
          <div
            className="flex shrink-0 gap-0.5"
            onMouseDown={stopGridEvent}
            onPointerDown={stopGridEvent}
            onClick={stopGridEvent}
          >
            {(widget.type === "chart" ||
              widget.type === "metric" ||
              widget.type === "table") &&
            exportRows.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Export widget"
                    onMouseDown={stopGridEvent}
                    onClick={stopGridEvent}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      void exportChartAsPNG(captureRef, { filename: exportSlug })
                    }
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportDataAsCSV(exportRows, exportSlug)}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {onEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Edit widget"
                onMouseDown={stopGridEvent}
                onClick={(e) => {
                  stopGridEvent(e);
                  onEdit();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                title="Delete widget"
                onMouseDown={stopGridEvent}
                onClick={(e) => {
                  stopGridEvent(e);
                  if (
                    window.confirm(
                      `Delete "${title}" from this dashboard? This cannot be undone after save.`
                    )
                  ) {
                    onDelete();
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={captureRef}
        className="min-h-0 flex-1 cursor-pointer overflow-auto bg-white p-2"
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
        role="button"
        tabIndex={0}
      >
        <p className="mb-1 text-xs font-semibold text-gray-900">{title}</p>
        {widget.type === "text" ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {widget.text_content || "Empty text block"}
          </p>
        ) : !datasetId ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Select a dataset in widget settings
          </p>
        ) : isLoading ? (
          <Skeleton className="h-full min-h-[120px] w-full" />
        ) : error ? (
          <p className="py-6 text-center text-xs text-red-400">
            {error instanceof Error ? error.message : "Failed to load data"}
          </p>
        ) : widget.type === "chart" || widget.type === "metric" ? (
          <div className="flex h-full flex-col gap-2">
            {widget.type === "metric" ? (
              <MetricCard title={renderConfig.chartTitle} value={metricValue} />
            ) : (
              <ChartRenderer
                config={renderConfig}
                rows={data?.rows ?? []}
                columnsMetadata={columns}
                correlations={data?.correlations}
                height={Math.max(160, (widget.grid_position.h ?? 3) * 72)}
              />
            )}
            {widget.chart_config?.show_ai_insight &&
            widget.type === "chart" &&
            renderConfig.xAxisColumn &&
            renderConfig.yAxisColumn ? (
              <ChartAIInsight
                chartType={renderConfig.chartType}
                chartData={data?.rows ?? []}
                xCol={renderConfig.xAxisColumn}
                yCol={renderConfig.yAxisColumn}
                chartTitle={renderConfig.chartTitle}
                className="text-xs"
              />
            ) : null}
          </div>
        ) : widget.type === "table" ? (
          <div className="max-h-full overflow-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {tableRows[0]
                    ? Object.keys(tableRows[0])
                        .slice(0, 8)
                        .map((col) => (
                          <th key={col} className="px-2 py-1 text-left font-medium">
                            {col}
                          </th>
                        ))
                    : null}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0, 12).map((row, i) => (
                  <tr key={i} className="border-b border-border/40 odd:bg-muted/20">
                    {Object.keys(tableRows[0] ?? row)
                      .slice(0, 8)
                      .map((col) => (
                        <td key={col} className="max-w-[120px] truncate px-2 py-1">
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
