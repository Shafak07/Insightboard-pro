"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber, toNumber } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import type { SharedChartOptions } from "./types";

export interface InsightBarChartProps extends SharedChartOptions {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  groupKey?: string;
  horizontal?: boolean;
  colorByValue?: boolean;
  className?: string;
}

type BarMode = "grouped" | "stacked";

function valueColor(value: number, min: number, max: number): string {
  if (max === min) return "#3B82F6";
  const t = (value - min) / (max - min);
  if (t >= 0.66) return "#10B981";
  if (t <= 0.33) return "#EF4444";
  return "#F59E0B";
}

export function BarChart({
  data,
  xKey,
  yKeys,
  colors = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"],
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  height = 320,
  horizontal: horizontalProp = false,
  colorByValue = false,
  className,
}: InsightBarChartProps) {
  const [mode, setMode] = useState<BarMode>("grouped");
  const [horizontal, setHorizontal] = useState(horizontalProp);
  useEffect(() => setHorizontal(horizontalProp), [horizontalProp]);

  const { min, max } = useMemo(() => {
    const vals: number[] = [];
    for (const row of data) {
      for (const k of yKeys) {
        const n = toNumber(row[k]);
        if (n != null) vals.push(n);
      }
    }
    return { min: Math.min(...vals, 0), max: Math.max(...vals, 1) };
  }, [data, yKeys]);

  const layout = horizontal ? "vertical" : "horizontal";

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "grouped" ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => setMode("grouped")}
        >
          Grouped
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "stacked" ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => setMode("stacked")}
        >
          Stacked
        </Button>
        <Button
          type="button"
          size="sm"
          variant={horizontal ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => setHorizontal((h) => !h)}
        >
          {horizontal ? "Horizontal" : "Vertical"}
        </Button>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} layout={layout} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <defs>
            {yKeys.map((k, i) => (
              <linearGradient key={k} id={`bar-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={0.95} />
                <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>
          {showGrid ? (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          ) : null}
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={formatNumber} stroke="hsl(var(--border))" />
              <YAxis
                type="category"
                dataKey={xKey}
                width={100}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                stroke="hsl(var(--border))"
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                stroke="hsl(var(--border))"
              />
              <YAxis tickFormatter={formatNumber} stroke="hsl(var(--border))" />
            </>
          )}
          {showTooltip ? (
            <Tooltip
              formatter={(v: number) => formatNumber(v)}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          ) : null}
          {showLegend ? <Legend /> : null}
          {yKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              stackId={mode === "stacked" ? "stack" : undefined}
              fill={`url(#bar-grad-${k})`}
              radius={[4, 4, 0, 0]}
              isAnimationActive
            >
              {colorByValue && yKeys.length === 1
                ? data.map((row, idx) => {
                    const v = toNumber(row[k]) ?? 0;
                    return <Cell key={idx} fill={valueColor(v, min, max)} />;
                  })
                : null}
              {!horizontal && yKeys.length === 1 ? (
                <LabelList
                  dataKey={k}
                  position="top"
                  fill="hsl(var(--muted-foreground))"
                  fontSize={10}
                  formatter={(v: number) => formatNumber(v)}
                />
              ) : null}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
