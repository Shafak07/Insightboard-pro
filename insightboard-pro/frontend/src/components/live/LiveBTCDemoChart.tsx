"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useWebSocketContext } from "@/providers/websocket-provider";
import { ensureBtcDemo, getLiveSnapshot } from "@/lib/live";
import { cn } from "@/lib/utils";

type ChartPoint = {
  index: number;
  time: string;
  USD: number;
};

function toPoint(rec: Record<string, unknown>, index: number): ChartPoint {
  const usd = Number(rec.USD ?? rec.usd ?? 0);
  const time = String(rec.time ?? rec.updated ?? index);
  return { index, time, USD: usd };
}

export function LiveBTCDemoChart({ className }: { className?: string }) {
  const { on } = useWebSocketContext();
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [series, setSeries] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appendPoints = useCallback((records: Record<string, unknown>[]) => {
    setSeries((prev) => {
      const start = prev.length;
      const added = records.map((r, i) => toPoint(r, start + i));
      const merged = [...prev, ...added];
      return merged.slice(-100);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      setLoading(true);
      setError(null);
      try {
        const id = await ensureBtcDemo();
        if (cancelled) return;
        setConnectionId(id);
        const snap = await getLiveSnapshot(id);
        if (cancelled) return;
        const initial = snap.series.length ? snap.series : snap.points;
        setSeries(initial.map((r, i) => toPoint(r as Record<string, unknown>, i)));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load demo");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!connectionId) return;
    return on("live_data_update", (msg) => {
      if (String(msg.connection_id) !== connectionId) return;
      const points = (msg.points as Record<string, unknown>[]) ?? [];
      if (points.length) appendPoints(points);
    });
  }, [connectionId, on, appendPoints]);

  const latest = series[series.length - 1];
  const yDomain = useMemo(() => {
    if (!series.length) return undefined;
    const vals = series.map((p) => p.USD);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.05 || 100;
    return [min - pad, max + pad] as [number, number];
  }, [series]);

  if (loading) {
    return (
      <div className={cn("flex h-64 items-center justify-center text-sm text-muted-foreground", className)}>
        Loading live BTC feed…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300", className)}>
        {error}
        <p className="mt-2 text-xs text-muted-foreground">
          Ensure Redis, Celery worker, and Celery beat are running.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-lg font-semibold">Live BTC Price Demo</h3>
          <p className="text-xs text-muted-foreground">
            CoinGecko public API · refreshes every 30s
          </p>
        </div>
        {latest ? (
          <p className="text-2xl font-bold tabular-nums text-[#3B82F6]">
            ${latest.USD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        ) : null}
      </div>

      <div className="h-72 w-full rounded-lg border border-border bg-card/40 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="index"
              tick={false}
              axisLine={false}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={56}
              stroke="rgba(255,255,255,0.35)"
            />
            <Tooltip
              formatter={(v: number) => [`$${v.toLocaleString()}`, "USD"]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ChartPoint | undefined;
                return row?.time ?? "";
              }}
            />
            <Line
              type="monotone"
              dataKey="USD"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={400}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        {series.length} points · growing in real time via WebSocket
      </p>
    </div>
  );
}
