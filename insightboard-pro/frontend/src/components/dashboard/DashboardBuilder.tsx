"use client";

import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Moon,
  Save,
  Share2,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { BuilderSidebar } from "@/components/dashboard/BuilderSidebar";
import { DashboardExportButtons } from "@/components/dashboard/DashboardExportButtons";
import { LiveIndicator } from "@/components/live/LiveIndicator";
import { UserMenu } from "@/components/auth/UserMenu";
import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas";
import { ShareModal } from "@/components/dashboard/ShareModal";
import { WidgetEditModal } from "@/components/dashboard/WidgetEditModal";
import { WidgetSettingsPanel } from "@/components/dashboard/WidgetSettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardWidget } from "@/lib/dashboards";
import { cn } from "@/lib/utils";
import { useWebSocketContext } from "@/providers/websocket-provider";
import { useDashboardLiveStore } from "@/store/dashboard-live-store";
import { useDashboardStore } from "@/store/dashboard-store";

export interface DashboardBuilderProps {
  dashboardId: string;
}

export function DashboardBuilder({ dashboardId }: DashboardBuilderProps) {
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);
  const reset = useDashboardStore((s) => s.reset);
  const dashboard = useDashboardStore((s) => s.currentDashboard);
  const isDirty = useDashboardStore((s) => s.isDirty);
  const isSaving = useDashboardStore((s) => s.isSaving);
  const saveError = useDashboardStore((s) => s.saveError);
  const saveDashboard = useDashboardStore((s) => s.saveDashboard);
  const setTitle = useDashboardStore((s) => s.setTitle);
  const setTheme = useDashboardStore((s) => s.setTheme);
  const isPreviewMode = useDashboardStore((s) => s.isPreviewMode);
  const setPreviewMode = useDashboardStore((s) => s.setPreviewMode);
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId);
  const setSelectedWidget = useDashboardStore((s) => s.setSelectedWidget);
  const updateLayout = useDashboardStore((s) => s.updateLayout);
  const removeWidget = useDashboardStore((s) => s.removeWidget);
  const updateWidget = useDashboardStore((s) => s.updateWidget);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const dashboardExportRef = useRef<HTMLDivElement>(null);
  const { sendMessage } = useWebSocketContext();
  const viewerCount = useDashboardLiveStore(
    (s) => s.viewerCounts[dashboardId] ?? 0
  );

  useEffect(() => {
    sendMessage({ type: "dashboard_subscribe", dashboard_id: dashboardId });
    return () => {
      sendMessage({ type: "dashboard_unsubscribe", dashboard_id: dashboardId });
    };
  }, [dashboardId, sendMessage]);

  useEffect(() => {
    let cancelled = false;
    reset();
    setLoading(true);
    setError(null);
    loadDashboard(dashboardId)
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      reset();
    };
  }, [dashboardId, loadDashboard, reset]);

  const handleEditWidget = useCallback(
    (widgetId: string) => {
      const w = dashboard?.widgets.find((x) => x.id === widgetId);
      if (!w) return;
      setSelectedWidget(widgetId);
      setEditingWidget(w);
      setEditOpen(true);
    },
    [dashboard?.widgets, setSelectedWidget]
  );

  const handleSaveWidget = useCallback(
    (updated: DashboardWidget) => {
      updateWidget(updated.id, updated);
      void saveDashboard();
    },
    [updateWidget, saveDashboard]
  );

  const handleDeleteWidget = useCallback(
    (widgetId: string) => {
      removeWidget(widgetId);
    },
    [removeWidget]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error ?? "Dashboard not found"}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back</Link>
        </Button>
      </div>
    );
  }

  const themeClass =
    dashboard.theme === "light"
      ? "light"
      : dashboard.theme === "dark"
        ? "dark"
        : "";

  return (
    <div
      className={cn(
        "flex h-screen flex-col overflow-hidden bg-background",
        themeClass
      )}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/50 px-4 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Dashboards
          </Link>
        </Button>

        {editingTitle ? (
          <Input
            className="h-9 max-w-md font-semibold"
            value={dashboard.title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
          />
        ) : (
          <button
            type="button"
            className="truncate text-left text-lg font-semibold hover:text-indigo-300"
            onClick={() => setEditingTitle(true)}
          >
            {dashboard.title}
          </button>
        )}

        <span className="text-xs text-muted-foreground">
          {isSaving ? "Saving…" : isDirty ? "Unsaved changes" : "Saved"}
        </span>
        {viewerCount > 0 ? (
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
            {viewerCount} viewing
          </span>
        ) : null}
        <LiveIndicator />
        {saveError ? (
          <span className="text-xs text-red-400">{saveError}</span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTheme(dashboard.theme === "dark" ? "light" : "dark")}
          >
            {dashboard.theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(!isPreviewMode)}
          >
            {isPreviewMode ? (
              <>
                <EyeOff className="mr-1 h-4 w-4" /> Edit
              </>
            ) : (
              <>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving || !isDirty}
            onClick={() => void saveDashboard()}
          >
            <Save className="mr-1 h-4 w-4" />
            Save
          </Button>
          <DashboardExportButtons
            dashboardRef={dashboardExportRef}
            title={dashboard.title}
          />
          <Button
            type="button"
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="mr-1 h-4 w-4" />
            Share
          </Button>
          <UserMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!isPreviewMode ? <BuilderSidebar /> : null}
        <main className="min-w-0 flex-1 overflow-auto p-4">
          <div ref={dashboardExportRef} className="min-h-0 rounded-xl bg-white p-2">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              {dashboard.title}
            </h2>
            <DashboardCanvas
              widgets={dashboard.widgets}
              layout={dashboard.layout}
              previewMode={isPreviewMode}
              selectedWidgetId={selectedWidgetId}
              onLayoutChange={updateLayout}
              onSelectWidget={setSelectedWidget}
              onEditWidget={handleEditWidget}
              onDeleteWidget={handleDeleteWidget}
            />
          </div>
        </main>
        {!isPreviewMode ? <WidgetSettingsPanel /> : null}
      </div>

      <ShareModal open={shareOpen} onOpenChange={setShareOpen} />

      <WidgetEditModal
        open={editOpen}
        widget={editingWidget}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingWidget(null);
        }}
        onSave={handleSaveWidget}
      />
    </div>
  );
}
