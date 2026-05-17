"use client";

import { BarChart3, Trash2 } from "lucide-react";
import Link from "next/link";

import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { ChartWrapper } from "@/components/charts/ChartWrapper";
import type { ColumnMeta } from "@/components/charts/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDatasetChartData } from "@/hooks/use-dataset-chart-data";
import { useSavedChartsStore, type SavedChartConfig } from "@/lib/saved-charts-store";

function DashboardChartTile({
  chart,
  onRemove,
}: {
  chart: SavedChartConfig;
  onRemove: (id: string) => void;
}) {
  const { data, isLoading, error } = useDatasetChartData(chart.datasetId);

  return (
    <ChartWrapper
      title={chart.chartTitle}
      description={`${chart.datasetName} · ${chart.chartType}`}
      isLoading={isLoading}
      error={
        error
          ? error instanceof Error
            ? error.message
            : "Failed to load"
          : null
      }
      exportData={data?.rows}
    >
      <div className="group relative">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 z-10 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onRemove(chart.id)}
          aria-label="Remove from dashboard"
        >
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
        {data ? (
          <ChartRenderer
            config={chart}
            rows={data.rows}
            columnsMetadata={
              (data.columns_metadata as ColumnMeta[] | undefined) ?? null
            }
            correlations={data.correlations}
            height={280}
          />
        ) : isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : null}
      </div>
    </ChartWrapper>
  );
}

export function DashboardCharts() {
  const charts = useSavedChartsStore((s) => s.dashboardCharts);
  const removeFromDashboard = useSavedChartsStore((s) => s.removeFromDashboard);

  if (charts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-14 text-center">
          <BarChart3 className="mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">No charts on your dashboard yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Open a dataset, build a chart in the chart studio, then click{" "}
            <strong className="text-foreground">Add to Dashboard</strong>.
          </p>
          <Button className="mt-6 bg-[#3B82F6] hover:bg-[#2563EB]" asChild>
            <Link href="/dashboard/datasets">Go to datasets</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {charts.map((chart) => (
        <DashboardChartTile
          key={chart.id}
          chart={chart}
          onRemove={removeFromDashboard}
        />
      ))}
    </div>
  );
}
