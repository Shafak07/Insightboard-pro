"use client";

import {
  BarChart3,
  LineChart,
  Sigma,
  Table2,
  Type,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BuilderChartType } from "@/lib/chart-builder-store";
import { listDatasets, type DatasetSummary } from "@/lib/datasets";
import { useSavedChartsStore } from "@/lib/saved-charts-store";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store/dashboard-store";

import { savedChartToWidgetConfig } from "./widget-utils";

const CHART_TYPES: { id: BuilderChartType; label: string; icon: typeof BarChart3 }[] = [
  { id: "line", label: "Line", icon: LineChart },
  { id: "bar", label: "Bar", icon: BarChart3 },
  { id: "scatter", label: "Scatter", icon: BarChart3 },
  { id: "area", label: "Area", icon: LineChart },
  { id: "heatmap", label: "Heatmap", icon: Table2 },
  { id: "metric", label: "Metric", icon: Sigma },
];

export function BuilderSidebar() {
  const addWidget = useDashboardStore((s) => s.addWidget);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [datasetId, setDatasetId] = useState<string>("");
  const savedCharts = useSavedChartsStore((s) => s.dashboardCharts);
  const templates = useSavedChartsStore((s) => s.templates);
  const myCharts = [...savedCharts, ...templates];

  useEffect(() => {
    listDatasets(1, 50)
      .then((d) => {
        setDatasets(d.items.filter((x) => x.status === "ready"));
        if (d.items.length && !datasetId) {
          const first = d.items.find((x) => x.status === "ready");
          if (first) setDatasetId(first.id);
        }
      })
      .catch(() => setDatasets([]));
  }, [datasetId]);

  const ds = datasets.find((d) => d.id === datasetId);

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-border bg-card/40">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold">Add widget</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a dataset, then add a visualization.
        </p>
        <div className="mt-3">
          <Label className="text-xs">Dataset</Label>
          <Select value={datasetId || "__none__"} onValueChange={(v) => setDatasetId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Select dataset" />
            </SelectTrigger>
            <SelectContent>
              {datasets.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Chart types
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CHART_TYPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={!datasetId}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border border-border bg-background/50 p-3 text-xs transition hover:border-indigo-500/40 hover:bg-indigo-500/10 disabled:opacity-40"
              )}
              onClick={() =>
                addWidget({
                  type: id === "metric" ? "metric" : "chart",
                  dataset_id: datasetId,
                  chart_config: {
                    chart_type: id,
                    x_col: "",
                    y_col: "",
                    title: `${label} — ${ds?.name ?? "Chart"}`,
                    color_scheme: "corporate",
                    show_ai_insight: false,
                  },
                })
              }
            >
              <Icon className="h-5 w-5 text-indigo-400" />
              {label}
            </button>
          ))}
        </div>

        <Button
          className="mt-3 w-full"
          variant="outline"
          size="sm"
          disabled={!datasetId}
          onClick={() =>
            addWidget({
              type: "metric",
              dataset_id: datasetId,
              chart_config: {
                chart_type: "metric",
                x_col: "",
                y_col: "",
                title: `KPI — ${ds?.name ?? ""}`,
                color_scheme: "corporate",
                show_ai_insight: false,
                aggregation: "sum",
              },
            })
          }
        >
          <Sigma className="mr-2 h-4 w-4" />
          Add metric card
        </Button>

        <Button
          className="mt-2 w-full"
          variant="outline"
          size="sm"
          onClick={() =>
            addWidget({
              type: "text",
              text_content: "Add your narrative, KPI callouts, or section title here.",
              w: 6,
              h: 2,
            })
          }
        >
          <Type className="mr-2 h-4 w-4" />
          Add text block
        </Button>

        <Button
          className="mt-2 w-full"
          variant="outline"
          size="sm"
          disabled={!datasetId}
          onClick={() =>
            addWidget({
              type: "table",
              dataset_id: datasetId,
              w: 8,
              h: 4,
            })
          }
        >
          <Table2 className="mr-2 h-4 w-4" />
          Add table
        </Button>

        <div className="mt-8 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            My charts
          </p>
          {myCharts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Build charts in Chart studio — they appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {myCharts.map((chart) => (
                <li key={chart.id}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-border bg-background/60 px-2 py-2 text-left text-xs transition hover:border-indigo-500/30 hover:bg-indigo-500/10"
                    draggable
                    onDragEnd={() =>
                      addWidget({
                        type: chart.chartType === "metric" ? "metric" : "chart",
                        dataset_id: chart.datasetId,
                        chart_config: savedChartToWidgetConfig(chart),
                      })
                    }
                    onClick={() =>
                      addWidget({
                        type: chart.chartType === "metric" ? "metric" : "chart",
                        dataset_id: chart.datasetId,
                        chart_config: savedChartToWidgetConfig(chart),
                      })
                    }
                  >
                    <span className="font-medium">{chart.chartTitle}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {chart.datasetName} · {chart.chartType}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
