"use client";

import { Loader2, RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ColumnMeta } from "@/components/charts/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { DashboardWidget, WidgetChartConfig } from "@/lib/dashboards";
import { getDatasetChartData } from "@/lib/datasets";
import type { BuilderChartType } from "@/lib/chart-builder-store";
import type { ColorScheme } from "@/lib/chart-utils";

const MAX_UNDO = 2;
const COLOR_SCHEMES: ColorScheme[] = [
  "corporate",
  "sunset",
  "blue",
  "purple",
  "green",
];
const CHART_TYPES: BuilderChartType[] = [
  "line",
  "bar",
  "area",
  "scatter",
  "heatmap",
  "metric",
];

function cloneWidget(w: DashboardWidget): DashboardWidget {
  return JSON.parse(JSON.stringify(w)) as DashboardWidget;
}

export interface WidgetEditModalProps {
  open: boolean;
  widget: DashboardWidget | null;
  onOpenChange: (open: boolean) => void;
  onSave: (widget: DashboardWidget) => void;
}

export function WidgetEditModal({
  open,
  widget,
  onOpenChange,
  onSave,
}: WidgetEditModalProps) {
  const originalRef = useRef<DashboardWidget | null>(null);
  const [current, setCurrent] = useState<DashboardWidget | null>(null);
  const [undoStack, setUndoStack] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);

  const undosAvailable = undoStack.length;
  const canUndo = undoStack.length > 0;

  useEffect(() => {
    if (!open || !widget) return;
    const snap = cloneWidget(widget);
    originalRef.current = snap;
    setCurrent(snap);
    setUndoStack([]);
    setLoading(true);
    if (widget.dataset_id && widget.type === "table") {
      getDatasetChartData(widget.dataset_id)
        .then((data) => {
          const rows =
            snap.table_rows ??
            (data.rows as Record<string, unknown>[]);
          const cols =
            (data.columns_metadata as ColumnMeta[]) ?? [];
          setColumns(cols);
          setCurrent((c) =>
            c ? { ...c, table_rows: rows.slice(0, 50) } : c
          );
          originalRef.current = {
            ...snap,
            table_rows: rows.slice(0, 50),
          };
        })
        .finally(() => setLoading(false));
    } else if (widget.dataset_id) {
      getDatasetChartData(widget.dataset_id)
        .then((data) => {
          setColumns((data.columns_metadata as ColumnMeta[]) ?? []);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [open, widget]);

  const applyChange = useCallback(
    (updater: (w: DashboardWidget) => DashboardWidget) => {
      setCurrent((c) => {
        if (!c) return c;
        setUndoStack((stack) => [...stack, cloneWidget(c)].slice(-MAX_UNDO));
        return updater(c);
      });
    },
    []
  );

  const handleUndo = () => {
    if (!canUndo || !current) return;
    const stack = [...undoStack];
    const prev = stack.pop()!;
    setUndoStack(stack);
    setCurrent(prev);
    toast({
      title: "Undone",
      description:
        stack.length === 0
          ? "Restored to version when you opened the editor."
          : `${MAX_UNDO - stack.length} undo step(s) left.`,
    });
  };

  const handleSave = () => {
    if (!current) return;
    onSave(current);
    onOpenChange(false);
    toast({
      title: "Widget saved",
      description: "Your edits are now the saved version for this widget.",
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const columnNames = columns.map((c) => String(c.column_name));
  const cfg = current?.chart_config;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit widget</DialogTitle>
          <DialogDescription>
            Edit this widget manually. Use Undo up to 2 times, then save.
          </DialogDescription>
          <div className="mt-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2.5 text-sm text-indigo-100/90">
            <strong className="text-indigo-200">How editing works:</strong>{" "}
            Change fields or table cells below. You can undo up to{" "}
            <strong>2 times</strong> to step back through your edits. Click{" "}
            <strong>Save as original</strong> when finished — that becomes the
            saved widget. Cancel closes without saving.
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : current ? (
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
            {current.type === "text" ? (
              <div>
                <Label className="text-xs">Text content</Label>
                <textarea
                  className="mt-1 min-h-[160px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={current.text_content ?? ""}
                  onChange={(e) =>
                    applyChange((w) => ({
                      ...w,
                      text_content: e.target.value,
                    }))
                  }
                />
              </div>
            ) : null}

            {(current.type === "chart" || current.type === "metric") && cfg ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input
                    className="mt-1 h-9"
                    value={cfg.title}
                    onChange={(e) =>
                      applyChange((w) => ({
                        ...w,
                        chart_config: {
                          ...w.chart_config!,
                          title: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Chart type</Label>
                  <Select
                    value={cfg.chart_type}
                    onValueChange={(v) =>
                      applyChange((w) => ({
                        ...w,
                        chart_config: {
                          ...w.chart_config!,
                          chart_type: v,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHART_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">X column</Label>
                  <Select
                    value={cfg.x_col || "__none__"}
                    onValueChange={(v) =>
                      applyChange((w) => ({
                        ...w,
                        chart_config: {
                          ...w.chart_config!,
                          x_col: v === "__none__" ? "" : v,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columnNames.map((c) => (
                        <SelectItem key={c} value={c || "__none__"}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Y column</Label>
                  <Select
                    value={cfg.y_col || "__none__"}
                    onValueChange={(v) =>
                      applyChange((w) => ({
                        ...w,
                        chart_config: {
                          ...w.chart_config!,
                          y_col: v === "__none__" ? "" : v,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columnNames.map((c) => (
                        <SelectItem key={c} value={c || "__none__"}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Color scheme</Label>
                  <Select
                    value={cfg.color_scheme}
                    onValueChange={(v) =>
                      applyChange((w) => ({
                        ...w,
                        chart_config: {
                          ...w.chart_config!,
                          color_scheme: v,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1 h-9">
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
                {current.type === "metric" ? (
                  <div>
                    <Label className="text-xs">Aggregation</Label>
                    <Select
                      value={cfg.aggregation ?? "sum"}
                      onValueChange={(v) =>
                        applyChange((w) => ({
                          ...w,
                          chart_config: {
                            ...w.chart_config!,
                            aggregation: v,
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["sum", "avg", "count", "min", "max"].map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}

            {current.type === "table" && current.table_rows ? (
              <div className="overflow-auto rounded-lg border border-border">
                <p className="border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Edit cells directly — changes apply when you save.
                </p>
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {Object.keys(current.table_rows[0] ?? {}).map((col) => (
                        <th key={col} className="px-2 py-1.5 text-left font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.table_rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-border/40">
                        {Object.keys(current.table_rows![0] ?? {}).map((col) => (
                          <td key={col} className="p-0">
                            <input
                              className="w-full min-w-[80px] bg-transparent px-2 py-1.5 outline-none focus:bg-indigo-500/10"
                              value={String(row[col] ?? "")}
                              onChange={(e) =>
                                applyChange((w) => {
                                  const rows = [...(w.table_rows ?? [])];
                                  rows[rowIdx] = {
                                    ...rows[rowIdx],
                                    [col]: e.target.value,
                                  };
                                  return { ...w, table_rows: rows };
                                })
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2 border-t border-border pt-4">
          <p className="mr-auto text-xs text-muted-foreground">
            Undo: {canUndo ? `${undosAvailable} step(s) available` : "none"}
          </p>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canUndo}
            onClick={handleUndo}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Undo
          </Button>
          <Button
            type="button"
            className="bg-indigo-600 hover:bg-indigo-500"
            disabled={!current}
            onClick={handleSave}
          >
            <Save className="mr-1.5 h-4 w-4" />
            Save as original
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
