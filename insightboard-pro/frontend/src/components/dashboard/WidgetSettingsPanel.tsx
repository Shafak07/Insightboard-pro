"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { useMemo } from "react";

import { ChartAIInsight } from "@/components/ai/ChartAIInsight";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDatasetChartData } from "@/hooks/use-dataset-chart-data";
import type { ColorScheme } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store/dashboard-store";

const COLOR_SCHEMES: ColorScheme[] = [
  "corporate",
  "sunset",
  "blue",
  "purple",
  "green",
];

export function WidgetSettingsPanel() {
  const open = useDashboardStore((s) => s.rightPanelOpen);
  const setOpen = useDashboardStore((s) => s.setRightPanelOpen);
  const selectedId = useDashboardStore((s) => s.selectedWidgetId);
  const widgets = useDashboardStore((s) => s.currentDashboard?.widgets ?? []);
  const updateWidget = useDashboardStore((s) => s.updateWidget);

  const widget = useMemo(
    () => widgets.find((w) => w.id === selectedId),
    [widgets, selectedId]
  );

  const datasetId = widget?.dataset_id ?? "";
  const { data } = useDatasetChartData(
    datasetId,
    Boolean(datasetId) && widget?.type === "chart"
  );

  if (!open) {
    return (
      <button
        type="button"
        className="fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-md border border-r-0 border-border bg-card px-1 py-3 shadow-md"
        onClick={() => setOpen(true)}
        aria-label="Open widget settings"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </button>
    );
  }

  if (!widget) {
    return (
      <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-card/60 p-4">
        <p className="text-sm text-muted-foreground">Select a widget to edit settings.</p>
        <button
          type="button"
          className="mt-4 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          Collapse panel
        </button>
      </aside>
    );
  }

  const cfg = widget.chart_config;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-indigo-500/20 bg-gradient-to-b from-card/80 to-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Widget settings</h3>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          Collapse
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {widget.type === "text" ? (
          <div>
            <Label className="text-xs">Text content</Label>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={widget.text_content ?? ""}
              onChange={(e) =>
                updateWidget(widget.id, { text_content: e.target.value })
              }
            />
          </div>
        ) : (
          <>
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                className="mt-1 h-8"
                value={cfg?.title ?? ""}
                onChange={(e) =>
                  updateWidget(widget.id, {
                    chart_config: { ...cfg!, title: e.target.value },
                  })
                }
              />
            </div>
            {widget.type !== "table" ? (
              <>
                <div>
                  <Label className="text-xs">Color scheme</Label>
                  <Select
                    value={cfg?.color_scheme ?? "corporate"}
                    onValueChange={(v) =>
                      updateWidget(widget.id, {
                        chart_config: { ...cfg!, color_scheme: v },
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_SCHEMES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1 text-xs">
                    <Sparkles className="h-3 w-3 text-indigo-400" />
                    Show AI insight
                  </Label>
                  <Switch
                    checked={cfg?.show_ai_insight ?? false}
                    onCheckedChange={(v) =>
                      updateWidget(widget.id, {
                        chart_config: { ...cfg!, show_ai_insight: v },
                      })
                    }
                  />
                </div>
              </>
            ) : null}
          </>
        )}

        {widget.type === "chart" &&
        cfg?.show_ai_insight &&
        data &&
        cfg.x_col &&
        cfg.y_col ? (
          <ChartAIInsight
            chartType={String(cfg.chart_type)}
            chartData={data.rows}
            xCol={cfg.x_col}
            yCol={cfg.y_col}
            chartTitle={cfg.title}
          />
        ) : null}
      </div>
    </aside>
  );
}
