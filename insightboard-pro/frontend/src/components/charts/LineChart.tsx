"use client";

import { useMemo, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

import type { ChartSeriesConfig, ReferenceLineConfig, SharedChartOptions } from "./types";

export interface InsightLineChartProps extends SharedChartOptions {
  data: Record<string, unknown>[];
  xKey: string;
  series: ChartSeriesConfig[];
  referenceLines?: ReferenceLineConfig[];
  area?: boolean;
  className?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-mono">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function LineChart({
  data,
  xKey,
  series,
  referenceLines = [],
  colors = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"],
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  height = 320,
  area = false,
  className,
}: InsightLineChartProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [brush, setBrush] = useState<{ start?: number; end?: number }>({});

  const visibleSeries = series.filter((s) => !hidden.has(s.dataKey));

  const averages = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of series) {
      const vals = data
        .map((d) => Number(d[s.dataKey]))
        .filter((v) => Number.isFinite(v));
      map[s.dataKey] = vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : 0;
    }
    return map;
  }, [data, series]);

  const toggleSeries = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={cn("w-full", className)}>
      {showLegend ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {series.map((s, i) => {
            const color = s.color ?? colors[i % colors.length];
            const off = hidden.has(s.dataKey);
            return (
              <button
                key={s.dataKey}
                type="button"
                onClick={() => toggleSeries(s.dataKey)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs transition-opacity",
                  off && "opacity-40"
                )}
                style={{ borderColor: color, color }}
              >
                {s.name ?? s.dataKey}
              </button>
            );
          })}
        </div>
      ) : null}

      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: brush.end != null ? 28 : 0 }}
        >
          <defs>
            {visibleSeries.map((s, i) => {
              const c = s.color ?? colors[i % colors.length];
              return (
                <linearGradient
                  key={s.dataKey}
                  id={`grad-${s.dataKey}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {showGrid ? (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          ) : null}
          <XAxis
            dataKey={xKey}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            tickFormatter={(v) => formatNumber(v)}
          />
          {showTooltip ? <Tooltip content={<CustomTooltip />} /> : null}
          {referenceLines.map((rl) => (
            <ReferenceLine
              key={rl.label ?? rl.value}
              y={rl.value}
              stroke={rl.stroke ?? "#94a3b8"}
              strokeDasharray={rl.strokeDasharray ?? "4 4"}
              label={rl.label}
            />
          ))}
          {visibleSeries.map((s, i) => {
            const c = s.color ?? colors[i % colors.length];
            return (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name ?? s.dataKey}
                stroke={c}
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={900}
                fill={area ? `url(#grad-${s.dataKey})` : undefined}
                fillOpacity={area ? 1 : 0}
              />
            );
          })}
          {visibleSeries.map((s) =>
            referenceLines.length === 0 ? (
              <ReferenceLine
                key={`avg-${s.dataKey}`}
                y={averages[s.dataKey]}
                stroke="#64748b"
                strokeDasharray="6 4"
                label={{ value: `avg ${s.dataKey}`, position: "insideTopRight", fill: "#94a3b8", fontSize: 10 }}
              />
            ) : null
          )}
          {brush.start != null && brush.end != null ? (
            <ReferenceArea x1={brush.start} x2={brush.end} strokeOpacity={0.2} fill="#3B82F6" />
          ) : null}
          <Brush
            dataKey={xKey}
            height={24}
            stroke="#3B82F6"
            travellerWidth={8}
            onChange={(range) => {
              if (range && typeof range.startIndex === "number") {
                const start = data[range.startIndex]?.[xKey];
                const end = data[range.endIndex ?? range.startIndex]?.[xKey];
                setBrush({ start: start as number, end: end as number });
              }
            }}
          />
          {showLegend ? (
            <Legend
              wrapperStyle={{ display: "none" }}
              onClick={(e) => toggleSeries(String(e.dataKey))}
            />
          ) : null}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
