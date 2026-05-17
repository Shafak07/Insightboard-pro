"use client";

import { regressionLinear } from "d3-regression";
import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import {
  formatNumber,
  getColorPalette,
  toNumber,
  type ColorScheme,
} from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

import type { SharedChartOptions } from "./types";

export interface ScatterPlotProps extends SharedChartOptions {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  sizeKey?: string;
  colorKey?: string;
  labelKey?: string;
  colorScheme?: ColorScheme;
  showRegression?: boolean;
  className?: string;
}

interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  category: string;
  label: string;
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ScatterPoint }[];
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{p.label}</p>
      <p>X: {formatNumber(p.x)}</p>
      <p>Y: {formatNumber(p.y)}</p>
      <p>Size: {formatNumber(p.z)}</p>
      <p className="text-muted-foreground">Group: {p.category}</p>
    </div>
  );
}

export function ScatterPlot({
  data,
  xKey,
  yKey,
  sizeKey,
  colorKey,
  labelKey,
  colorScheme = "corporate",
  colors,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  showRegression = true,
  height = 320,
  className,
}: ScatterPlotProps) {
  const points = useMemo(() => {
    return data
      .map((row, i) => {
        const x = toNumber(row[xKey]);
        const y = toNumber(row[yKey]);
        if (x == null || y == null) return null;
        const z = sizeKey ? toNumber(row[sizeKey]) ?? 40 : 40;
        return {
          x,
          y,
          z: Math.max(20, Math.min(400, z)),
          category: colorKey ? String(row[colorKey] ?? "default") : "default",
          label: labelKey ? String(row[labelKey]) : `Row ${i + 1}`,
        };
      })
      .filter(Boolean) as ScatterPoint[];
  }, [data, xKey, yKey, sizeKey, colorKey, labelKey]);

  const categories = useMemo(
    () => Array.from(new Set(points.map((p) => p.category))),
    [points]
  );

  const palette = colors ?? getColorPalette(colorScheme, categories.length);
  const colorMap = Object.fromEntries(
    categories.map((c, i) => [c, palette[i % palette.length]])
  );

  const avgX = points.length
    ? points.reduce((s, p) => s + p.x, 0) / points.length
    : 0;
  const avgY = points.length
    ? points.reduce((s, p) => s + p.y, 0) / points.length
    : 0;

  const trendLine = useMemo(() => {
    if (!showRegression || points.length < 3) return [];
    const reg = regressionLinear<ScatterPoint>()
      .x((d) => d.x)
      .y((d) => d.y);
    const line = reg(points);
    if (!line) return [];
    return line.map(([x, y]) => ({ x, y }));
  }, [points, showRegression]);

  const grouped = categories.map((cat) => ({
    name: cat,
    data: points.filter((p) => p.category === cat),
  }));

  return (
    <div className={cn("relative w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart margin={{ top: 12, right: 12, bottom: 8, left: 8 }}>
          {showGrid ? (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          ) : null}
          <XAxis
            type="number"
            dataKey="x"
            name={xKey}
            tickFormatter={formatNumber}
            stroke="hsl(var(--border))"
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yKey}
            tickFormatter={formatNumber}
            stroke="hsl(var(--border))"
          />
          <ZAxis type="number" dataKey="z" range={[40, 400]} />
          <ReferenceLine x={avgX} stroke="#64748b" strokeDasharray="4 4" />
          <ReferenceLine y={avgY} stroke="#64748b" strokeDasharray="4 4" />
          {showTooltip ? <Tooltip content={<ScatterTooltip />} /> : null}
          {showLegend ? <Legend /> : null}
          {grouped.map((g) => (
            <Scatter
              key={g.name}
              name={g.name}
              data={g.data}
              fill={colorMap[g.name]}
            >
              {g.data.map((_, i) => (
                <Cell key={i} fill={colorMap[g.name]} fillOpacity={0.75} />
              ))}
            </Scatter>
          ))}
          {trendLine.length > 1 ? (
            <Line
              data={trendLine}
              type="linear"
              dataKey="y"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
