"use client";

import { AnimatePresence, motion } from "framer-motion";

import { AIInsightContent } from "@/components/ai/AIInsightContent";
import type { RecommendedChart } from "@/lib/ai";
import { cn } from "@/lib/utils";

export interface AIInsightPanelProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChart?: (chart: RecommendedChart) => void;
}

export function AIInsightPanel({
  datasetId,
  open,
  onOpenChange,
  onCreateChart,
}: AIInsightPanelProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={cn(
              "fixed right-0 top-0 z-50 flex h-full w-[360px] flex-col border-l border-indigo-500/20",
              "bg-gradient-to-b from-[#0f0f14] via-[#12121a] to-[#0d0d12]",
              "shadow-2xl shadow-indigo-950/40"
            )}
          >
            <AIInsightContent
              datasetId={datasetId}
              active={open}
              showToolbar
              onClose={() => onOpenChange(false)}
              onCreateChart={onCreateChart}
              className="flex h-full flex-col overflow-hidden px-4 py-4"
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
