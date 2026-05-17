"use client";

import dynamic from "next/dynamic";
import { LayoutGrid } from "lucide-react";
import { useMemo } from "react";
import type { Layout } from "react-grid-layout";

import type { DashboardWidget, LayoutItem } from "@/lib/dashboards";
import { cn } from "@/lib/utils";

import { DashboardWidgetCard } from "./DashboardWidgetCard";

const ResponsiveGridLayout = dynamic(
  () => import("@/components/dashboard/ResponsiveGridLayout"),
  { ssr: false }
);

export interface DashboardCanvasProps {
  widgets: DashboardWidget[];
  layout: LayoutItem[];
  readOnly?: boolean;
  previewMode?: boolean;
  selectedWidgetId?: string | null;
  onLayoutChange?: (layout: LayoutItem[]) => void;
  onSelectWidget?: (id: string) => void;
  onEditWidget?: (id: string) => void;
  onDeleteWidget?: (id: string) => void;
  className?: string;
}

export function DashboardCanvas({
  widgets,
  layout,
  readOnly = false,
  previewMode = false,
  selectedWidgetId,
  onLayoutChange,
  onSelectWidget,
  onEditWidget,
  onDeleteWidget,
  className,
}: DashboardCanvasProps) {
  const layouts = useMemo(
    () => ({ lg: layout as Layout[] }),
    [layout]
  );

  if (widgets.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[480px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-500/25 bg-indigo-500/5 p-12 text-center",
          className
        )}
      >
        <LayoutGrid className="mb-4 h-12 w-12 text-indigo-400/60" />
        <p className="text-lg font-medium text-foreground/90">
          Drag charts here or click to add
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Use the left sidebar to add widgets from your datasets, or drag saved
          charts onto the canvas.
        </p>
      </div>
    );
  }

  const staticGrid = readOnly || previewMode;

  return (
    <div className={cn("min-h-[520px] rounded-xl bg-muted/10 p-2", className)}>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={80}
        margin={[12, 12]}
        containerPadding={[8, 8]}
        isDraggable={!staticGrid}
        isResizable={!staticGrid}
        draggableHandle=".drag-handle"
        onLayoutChange={(current: Layout[]) => {
          if (staticGrid || !onLayoutChange) return;
          onLayoutChange(
            current.map((l) => ({
              i: l.i,
              x: l.x,
              y: l.y,
              w: l.w,
              h: l.h,
              minW: 2,
              minH: 2,
            }))
          );
        }}
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="overflow-hidden">
            <DashboardWidgetCard
              widget={widget}
              readOnly={readOnly}
              previewMode={previewMode}
              selected={selectedWidgetId === widget.id}
              onSelect={() => onSelectWidget?.(widget.id)}
              onEdit={
                onEditWidget && !staticGrid
                  ? () => onEditWidget(widget.id)
                  : undefined
              }
              onDelete={
                onDeleteWidget && !staticGrid
                  ? () => onDeleteWidget(widget.id)
                  : undefined
              }
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
