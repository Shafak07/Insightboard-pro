"use client";

import { animated, useSpring } from "@react-spring/web";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/chart-utils";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MetricCardProps {
  title: string;
  value: number;
  previousValue?: number;
  history?: { value: number }[];
  prefix?: string;
  suffix?: string;
  className?: string;
}

function AnimatedValue({ value }: { value: number }) {
  const spring = useSpring({
    from: { n: 0 },
    to: { n: value },
    config: { tension: 120, friction: 14 },
  });

  return (
    <animated.span className="text-3xl font-bold tracking-tight tabular-nums">
      {spring.n.to((n) => formatNumber(n))}
    </animated.span>
  );
}

export function MetricCard({
  title,
  value,
  previousValue,
  history = [],
  prefix = "",
  suffix = "",
  className,
}: MetricCardProps) {
  const change = useMemo(() => {
    if (previousValue == null || previousValue === 0) return null;
    return ((value - previousValue) / Math.abs(previousValue)) * 100;
  }, [value, previousValue]);

  const positive = change != null && change >= 0;
  const sparkData = history.length
    ? history
    : [{ value }, { value: value * 0.92 }, { value: value * 1.04 }, { value }];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="text-muted-foreground text-sm">{prefix}</span>
            <AnimatedValue value={value} />
            <span className="text-muted-foreground text-sm">{suffix}</span>
          </div>
          {change != null ? (
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                positive
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              )}
            >
              {positive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {positive ? "+" : ""}
              {change.toFixed(1)}%
            </div>
          ) : null}
        </div>
        <div className="h-12 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={positive ? "#10B981" : "#EF4444"}
                strokeWidth={2}
                dot={false}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
