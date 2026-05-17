"use client";

import { motion } from "framer-motion";
import { Download, FileSpreadsheet, ImageIcon } from "lucide-react";
import { Component, type ReactNode, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChartSkeleton } from "@/components/ui/skeletons";
import {
  exportChartAsPNG,
  exportDataAsCSV,
} from "@/lib/export-utils";
import { cn } from "@/lib/utils";

export interface ChartWrapperProps {
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
  exportData?: Record<string, unknown>[];
  children: ReactNode;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ChartErrorBoundary extends Component<
  { children: ReactNode; fallback?: string },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-8 text-center"
        >
          <p className="text-sm font-medium text-destructive">
            Could not render this chart
          </p>
          <p className="mt-2 max-w-md text-xs text-muted-foreground">
            {this.props.fallback ??
              "Try changing your column mapping or chart type."}
          </p>
        </motion.div>
      );
    }
    return this.props.children;
  }
}

export function ChartWrapper({
  title,
  description,
  isLoading,
  error,
  exportData,
  children,
  className,
}: ChartWrapperProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const slug = title.replace(/\s+/g, "-").toLowerCase() || "chart";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <Card ref={captureRef} className={cn("overflow-hidden bg-white", className)}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <motion.div className="space-y-1">
            <CardTitle className="text-base font-semibold text-gray-900">
              {title}
            </CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </motion.div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  void exportChartAsPNG(captureRef, { filename: slug })
                }
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                PNG
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!exportData?.length}
                onClick={() => exportDataAsCSV(exportData ?? [], slug)}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton />
          ) : error ? (
            <motion.div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              {error}
            </motion.div>
          ) : (
            <ChartErrorBoundary>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.05 }}
                className="w-full"
              >
                {children}
              </motion.div>
            </ChartErrorBoundary>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
