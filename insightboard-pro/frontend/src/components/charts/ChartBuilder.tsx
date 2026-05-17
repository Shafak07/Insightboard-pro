"use client";

import {
  AreaChart,
  BarChart3,
  Grid3X3,
  LayoutDashboard,
  LineChart as LineChartIcon,
  Save,
  ScatterChart,
  Sigma,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";

import { ChartAIInsight } from "@/components/ai/ChartAIInsight";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { ChartWrapper } from "@/components/charts/ChartWrapper";
import type { ColumnMeta } from "@/components/charts/types";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";
import { useDatasetChartData } from "@/hooks/use-dataset-chart-data";
import {
  getColorPalette,
  inferBestChart,
  inferColumnKind,
  type ColorScheme,
} from "@/lib/chart-utils";
import {
  useChartBuilderStore,
  type BuilderChartType,
} from "@/lib/chart-builder-store";
import { useSavedChartsStore } from "@/lib/saved-charts-store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const CHART_TYPES: {
  id: BuilderChartType;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "line", label: "Line", icon: LineChartIcon },
  { id: "area", label: "Area", icon: AreaChart },
  { id: "bar", label: "Bar", icon: BarChart3 },
  { id: "scatter", label: "Scatter", icon: ScatterChart },
  { id: "heatmap", label: "Heatmap", icon: Grid3X3 },
  { id: "metric", label: "Metric", icon: Sigma },
];

const COLOR_SCHEMES: ColorScheme[] = [
  "corporate",
  "sunset",
  "blue",
  "purple",
  "green",
];

export interface ChartBuilderProps {
  datasetId: string;
  datasetName: string;
  columnsMetadata: ColumnMeta[] | null;
  className?: string;
}

function metaColumns(meta: ColumnMeta[] | null) {
  return meta ?? [];
}

export function ChartBuilder({
  datasetId,
  datasetName,
  columnsMetadata,
  className,
}: ChartBuilderProps) {
  const router = useRouter();
  const addToDashboard = useSavedChartsStore((s) => s.addToDashboard);
  const saveTemplate = useSavedChartsStore((s) => s.saveTemplate);
  const [horizontalBar, setHorizontalBar] = useState(false);
  const {
    data: chartData,
    isLoading: loading,
    error: queryError,
    isFetching,
  } = useDatasetChartData(datasetId);
  const rows = chartData?.rows ?? [];
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load chart data"
    : null;

  const {
    selectedChartType,
    xAxisColumn,
    yAxisColumn,
    groupByColumn,
    sizeColumn,
    colorScheme,
    chartTitle,
    showGridLines,
    showLegend,
    showTooltip,
    setChartType,
    setXAxis,
    setYAxis,
    setGroupBy,
    setSizeColumn,
    setColorScheme,
    setChartTitle,
    setShowGridLines,
    setShowLegend,
    setShowTooltip,
  } = useChartBuilderStore();

  const columns = metaColumns(
    (chartData?.columns_metadata as ColumnMeta[] | undefined) ??
      columnsMetadata
  );
  const columnNames = columns.map((c) => String(c.column_name));

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

  const datetimeCols = useMemo(
    () =>
      columns
        .filter((c) => inferColumnKind(c) === "datetime")
        .map((c) => String(c.column_name)),
    [columns]
  );

  const didInit = useRef(false);
  useEffect(() => {
    if (!columns.length || didInit.current || loading) return;
    const x = datetimeCols[0] ?? categoricalCols[0] ?? columnNames[0] ?? "";
    const y = numericCols[0] ?? columnNames[1] ?? columnNames[0] ?? "";
    if (x) setXAxis(x);
    if (y) setYAxis(y);
    const xKind = inferColumnKind(
      columns.find((c) => c.column_name === x) ?? {}
    );
    const yKind = inferColumnKind(
      columns.find((c) => c.column_name === y) ?? {}
    );
    setChartType(inferBestChart(xKind, yKind) as BuilderChartType);
    didInit.current = true;
  }, [
    columns,
    columnNames,
    categoricalCols,
    datetimeCols,
    numericCols,
    setChartType,
    setXAxis,
    setYAxis,
    loading,
  ]);

  const renderConfig = useMemo(
    () => ({
      chartType: selectedChartType,
      xAxisColumn,
      yAxisColumn,
      groupByColumn,
      sizeColumn,
      colorScheme,
      chartTitle,
      showGridLines,
      showLegend,
      showTooltip,
      horizontalBar,
    }),
    [
      selectedChartType,
      xAxisColumn,
      yAxisColumn,
      groupByColumn,
      sizeColumn,
      colorScheme,
      chartTitle,
      showGridLines,
      showLegend,
      showTooltip,
      horizontalBar,
    ]
  );

  const buildSnapshot = () => ({
    datasetId,
    datasetName,
    chartType: selectedChartType,
    xAxisColumn,
    yAxisColumn,
    groupByColumn,
    sizeColumn,
    colorScheme,
    chartTitle,
    showGridLines,
    showLegend,
    showTooltip,
    horizontalBar,
  });

  const handleAddToDashboard = () => {
    if (!yAxisColumn && selectedChartType !== "heatmap") {
      toast({
        title: "Choose columns",
        description: "Pick at least a Y axis before saving.",
        variant: "destructive",
      });
      return;
    }
    addToDashboard(buildSnapshot());
    toast({
      title: "Added to dashboard",
      description: `"${chartTitle}" is now on your dashboard.`,
    });
    router.push("/dashboard");
  };

  const handleSaveTemplate = () => {
    saveTemplate(buildSnapshot());
    toast({
      title: "Template saved",
      description: "Reuse this chart layout from your dashboard.",
    });
  };

  return (
    <div
      className={cn(
        "flex min-h-[520px] flex-col gap-4 lg:flex-row",
        className
      )}
    >
      <aside className="w-full shrink-0 space-y-4 rounded-lg border border-border bg-card/50 p-4 lg:w-[280px]">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">
            Chart type
          </Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CHART_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setChartType(id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border p-2 text-xs transition-colors",
                  selectedChartType === id
                    ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#93C5FD]"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <ColumnSelect
            label="X axis"
            value={xAxisColumn}
            options={columnNames}
            onChange={setXAxis}
          />
          <ColumnSelect
            label="Y axis"
            value={yAxisColumn}
            options={numericCols.length ? numericCols : columnNames}
            onChange={setYAxis}
          />
          <ColumnSelect
            label="Group by"
            value={groupByColumn}
            options={["", ...categoricalCols]}
            onChange={setGroupBy}
            placeholder="Optional"
          />
          {selectedChartType === "scatter" ? (
            <ColumnSelect
              label="Bubble size"
              value={sizeColumn}
              options={["", ...numericCols]}
              onChange={setSizeColumn}
              placeholder="Optional"
            />
          ) : null}
        </div>

        <details className="group rounded-md border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            Customization
          </summary>
          <div className="space-y-3 border-t border-border px-3 py-3">
            <div>
              <Label className="text-xs">Color scheme</Label>
              <div className="mt-2 flex flex-wrap gap-1">
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme}
                    type="button"
                    title={scheme}
                    onClick={() => setColorScheme(scheme)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2",
                      colorScheme === scheme
                        ? "border-white"
                        : "border-transparent"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${getColorPalette(scheme, 3).join(",")})`,
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="chart-title" className="text-xs">
                Title
              </Label>
              <Input
                id="chart-title"
                className="mt-1 h-8"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
              />
            </div>
            <ToggleRow
              label="Grid lines"
              checked={showGridLines}
              onCheckedChange={setShowGridLines}
            />
            <ToggleRow
              label="Legend"
              checked={showLegend}
              onCheckedChange={setShowLegend}
            />
            <ToggleRow
              label="Tooltip"
              checked={showTooltip}
              onCheckedChange={setShowTooltip}
            />
            {selectedChartType === "bar" ? (
              <ToggleRow
                label="Horizontal bars"
                checked={horizontalBar}
                onCheckedChange={setHorizontalBar}
              />
            ) : null}
          </div>
        </details>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <ChartWrapper
          title={chartTitle}
          description={
            chartData
              ? `${datasetName} · ${rows.length} of ${chartData.total_rows.toLocaleString()} rows · ${
                  chartData.source === "stored_sample"
                    ? "ETL sample (fast)"
                    : "from storage"
                }${isFetching && !loading ? " · updating…" : ""}`
              : `${datasetName}`
          }
          isLoading={loading}
          error={error}
          exportData={rows}
        >
          <ChartRenderer
            config={renderConfig}
            rows={rows}
            columnsMetadata={columns}
            correlations={chartData?.correlations}
            height={360}
          />
        </ChartWrapper>
        {xAxisColumn && yAxisColumn && rows.length > 0 ? (
          <ChartAIInsight
            chartType={selectedChartType}
            chartData={rows}
            xCol={xAxisColumn}
            yCol={yAxisColumn}
            chartTitle={chartTitle}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-[#3B82F6] hover:bg-[#2563EB]"
            onClick={handleAddToDashboard}
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Add to Dashboard
          </Button>
          <Button variant="outline" onClick={handleSaveTemplate}>
            <Save className="mr-2 h-4 w-4" />
            Save as Template
          </Button>
        </div>
      </div>
    </div>
  );
}

function ColumnSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select column",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="mt-1 h-8">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt || "__none__"} value={opt || "__none__"}>
              {opt || placeholder}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
