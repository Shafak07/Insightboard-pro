"use client";

import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useChartInsight } from "@/hooks/useAIInsights";
import { cn } from "@/lib/utils";

export interface ChartAIInsightProps {
  chartType: string;
  chartData: Record<string, unknown>[];
  xCol: string;
  yCol: string;
  chartTitle?: string;
  className?: string;
}

export function ChartAIInsight({
  chartType,
  chartData,
  xCol,
  yCol,
  chartTitle,
  className,
}: ChartAIInsightProps) {
  const { mutate, data, isPending, isError } = useChartInsight();
  const lastKey = useRef("");

  const configKey = `${chartType}|${xCol}|${yCol}|${chartData.length}`;

  useEffect(() => {
    if (!xCol || !yCol || chartData.length === 0) return;
    if (lastKey.current === configKey) return;
    lastKey.current = configKey;

    mutate({
      chart_type: chartType,
      chart_data: chartData.slice(0, 80),
      x_col: xCol,
      y_col: yCol,
      chart_title: chartTitle,
    });
  }, [chartType, chartData, xCol, yCol, chartTitle, configKey, mutate]);

  if (!xCol || !yCol) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent px-4 py-3",
        className
      )}
    >
      <motion.div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-indigo-300">
        <Sparkles className="h-3.5 w-3.5" />
        AI chart insight
      </motion.div>
      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          Analyzing chart…
        </div>
      ) : isError ? (
        <motion.div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-400">Could not generate insight.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              mutate({
                chart_type: chartType,
                chart_data: chartData.slice(0, 80),
                x_col: xCol,
                y_col: yCol,
                chart_title: chartTitle,
              })
            }
          >
            Retry
          </Button>
        </motion.div>
      ) : (
        <p className="text-sm leading-relaxed text-foreground/90">
          {data || "Generating insight…"}
        </p>
      )}
    </motion.div>
  );
}
