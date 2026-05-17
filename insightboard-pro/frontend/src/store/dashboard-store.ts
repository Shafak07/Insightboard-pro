"use client";

import { create } from "zustand";

import { toast } from "@/hooks/use-toast";
import {
  getDashboard,
  updateDashboard,
  widgetToLayoutItem,
  widgetsToLayout,
  type Dashboard,
  type DashboardTheme,
  type DashboardWidget,
  type LayoutItem,
  type WidgetChartConfig,
  type WidgetType,
} from "@/lib/dashboards";

function newWidgetId() {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nextGridY(widgets: DashboardWidget[]): number {
  if (widgets.length === 0) return 0;
  return Math.max(...widgets.map((w) => w.grid_position.y + w.grid_position.h));
}

const defaultChartConfig = (): WidgetChartConfig => ({
  chart_type: "bar",
  x_col: "",
  y_col: "",
  title: "New chart",
  color_scheme: "corporate",
  show_ai_insight: false,
  show_grid_lines: true,
  show_legend: true,
  show_tooltip: true,
  horizontal_bar: false,
});

interface DashboardState {
  currentDashboard: Dashboard | null;
  selectedWidgetId: string | null;
  isDirty: boolean;
  isPreviewMode: boolean;
  isSaving: boolean;
  saveError: string | null;
  rightPanelOpen: boolean;

  loadDashboard: (id: string) => Promise<void>;
  setTitle: (title: string) => void;
  setTheme: (theme: DashboardTheme) => void;
  setPreviewMode: (v: boolean) => void;
  setSelectedWidget: (id: string | null) => void;
  setRightPanelOpen: (v: boolean) => void;
  addWidget: (partial: {
    type: WidgetType;
    dataset_id?: string;
    chart_config?: WidgetChartConfig;
    text_content?: string;
    w?: number;
    h?: number;
  }) => string;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, changes: Partial<DashboardWidget>) => void;
  updateLayout: (layout: LayoutItem[]) => void;
  markClean: () => void;
  saveDashboard: () => Promise<void>;
  reset: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  currentDashboard: null,
  selectedWidgetId: null,
  isDirty: false,
  isPreviewMode: false,
  isSaving: false,
  saveError: null,
  rightPanelOpen: false,

  loadDashboard: async (id) => {
    const dash = await getDashboard(id);
    const layout =
      dash.layout?.length > 0 ? dash.layout : widgetsToLayout(dash.widgets);
    set({
      currentDashboard: { ...dash, layout },
      isDirty: false,
      selectedWidgetId: null,
      saveError: null,
    });
  },

  setTitle: (title) => {
    const d = get().currentDashboard;
    if (!d) return;
    set({ currentDashboard: { ...d, title }, isDirty: true });
  },

  setTheme: (theme) => {
    const d = get().currentDashboard;
    if (!d) return;
    set({ currentDashboard: { ...d, theme }, isDirty: true });
  },

  setPreviewMode: (isPreviewMode) => set({ isPreviewMode }),

  setSelectedWidget: (selectedWidgetId) =>
    set({ selectedWidgetId, rightPanelOpen: !!selectedWidgetId }),

  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),

  addWidget: (partial) => {
    const d = get().currentDashboard;
    if (!d) return "";
    const id = newWidgetId();
    const y = nextGridY(d.widgets);
    const w = partial.w ?? (partial.type === "metric" ? 3 : partial.type === "text" ? 4 : 6);
    const h = partial.h ?? (partial.type === "metric" ? 2 : partial.type === "text" ? 2 : 4);

    const widget: DashboardWidget = {
      id,
      type: partial.type,
      dataset_id: partial.dataset_id ?? null,
      chart_config:
        partial.type === "chart" || partial.type === "metric"
          ? partial.chart_config ?? defaultChartConfig()
          : null,
      text_content: partial.type === "text" ? partial.text_content ?? "New text block" : null,
      grid_position: { x: 0, y, w, h },
    };

    const widgets = [...d.widgets, widget];
    const layout = [...d.layout, widgetToLayoutItem(widget)];
    set({
      currentDashboard: { ...d, widgets, layout },
      selectedWidgetId: id,
      rightPanelOpen: true,
      isDirty: true,
    });
    return id;
  },

  removeWidget: (widgetId) => {
    const d = get().currentDashboard;
    if (!d) return;
    set({
      currentDashboard: {
        ...d,
        widgets: d.widgets.filter((w) => w.id !== widgetId),
        layout: d.layout.filter((l) => l.i !== widgetId),
      },
      selectedWidgetId:
        get().selectedWidgetId === widgetId ? null : get().selectedWidgetId,
      isDirty: true,
    });
  },

  updateWidget: (widgetId, changes) => {
    const d = get().currentDashboard;
    if (!d) return;
    const widgets = d.widgets.map((w) =>
      w.id === widgetId ? { ...w, ...changes } : w
    );
    const layout = d.layout.map((l) => {
      if (l.i !== widgetId) return l;
      const w = widgets.find((x) => x.id === widgetId);
      if (!w) return l;
      return widgetToLayoutItem(w);
    });
    set({ currentDashboard: { ...d, widgets, layout }, isDirty: true });
  },

  updateLayout: (layout) => {
    const d = get().currentDashboard;
    if (!d) return;
    const byId = Object.fromEntries(layout.map((l) => [l.i, l]));
    const widgets = d.widgets.map((w) => {
      const item = byId[w.id];
      if (!item) return w;
      return {
        ...w,
        grid_position: {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        },
      };
    });
    set({ currentDashboard: { ...d, layout, widgets }, isDirty: true });
  },

  markClean: () => set({ isDirty: false }),

  saveDashboard: async () => {
    const d = get().currentDashboard;
    if (!d || get().isSaving) return;
    set({ isSaving: true, saveError: null });
    try {
      const saved = await updateDashboard(d.id, {
        title: d.title,
        description: d.description ?? null,
        layout: d.layout,
        widgets: d.widgets,
        theme: d.theme,
        refresh_interval: d.refresh_interval ?? null,
      });
      set({
        currentDashboard: saved,
        isDirty: false,
        isSaving: false,
      });
      toast({ title: "Dashboard saved" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      const gone =
        msg.includes("404") || msg.toLowerCase().includes("not found");
      set({
        isSaving: false,
        saveError: gone ? "This dashboard was deleted." : msg,
        ...(gone
          ? {
              currentDashboard: null,
              isDirty: false,
            }
          : {}),
      });
    }
  },

  reset: () =>
    set({
      currentDashboard: null,
      selectedWidgetId: null,
      isDirty: false,
      isPreviewMode: false,
      isSaving: false,
      saveError: null,
      rightPanelOpen: false,
    }),
}));

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2000;

if (typeof window !== "undefined") {
  useDashboardStore.subscribe((state) => {
    if (
      state.isDirty &&
      !state.isSaving &&
      state.currentDashboard &&
      !state.saveError?.includes("deleted")
    ) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void useDashboardStore.getState().saveDashboard();
      }, DEBOUNCE_MS);
    }
  });
}
