import { apiClient, getApiBaseUrl } from "@/lib/api";
import type { BuilderChartType } from "@/lib/chart-builder-store";
import type { ColorScheme } from "@/lib/chart-utils";

export type DashboardTheme = "dark" | "light" | "system";
export type WidgetType = "chart" | "metric" | "table" | "text";

export interface WidgetChartConfig {
  chart_type: BuilderChartType | string;
  x_col: string;
  y_col: string;
  group_by?: string | null;
  aggregation?: string | null;
  title: string;
  color_scheme: ColorScheme | string;
  show_ai_insight: boolean;
  show_grid_lines?: boolean;
  show_legend?: boolean;
  show_tooltip?: boolean;
  horizontal_bar?: boolean;
}

export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  dataset_id?: string | null;
  chart_config?: WidgetChartConfig | null;
  text_content?: string | null;
  /** Manual table edits saved from the widget editor */
  table_rows?: Record<string, unknown>[] | null;
  grid_position: GridPosition;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface Dashboard {
  id: string;
  title: string;
  description?: string | null;
  layout: LayoutItem[];
  widgets: DashboardWidget[];
  is_public: boolean;
  public_slug: string;
  theme: DashboardTheme;
  refresh_interval?: number | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  id: string;
  title: string;
  description?: string | null;
  is_public: boolean;
  public_slug: string;
  theme: DashboardTheme;
  view_count: number;
  widget_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublicDashboard {
  title: string;
  description?: string | null;
  layout: LayoutItem[];
  widgets: DashboardWidget[];
  theme: DashboardTheme;
  refresh_interval?: number | null;
  view_count: number;
  public_slug: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
}

export function getPublicShareUrl(slug: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/share/${slug}`;
  }
  const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${app.replace(/\/$/, "")}/share/${slug}`;
}

export function getEmbedCode(slug: string, width = 1200, height = 800): string {
  const url = getPublicShareUrl(slug);
  return `<iframe src="${url}?embed=1" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;
}

export async function createDashboard(title = "Untitled Dashboard") {
  const { data } = await apiClient.post<ApiEnvelope<Dashboard>>(
    "/api/v1/dashboards/",
    { title, theme: "dark" }
  );
  return data.data!;
}

export interface DashboardListPage {
  items: DashboardSummary[];
  total: number;
  page: number;
  limit: number;
}

export async function listDashboards(page = 1, limit = 12) {
  const { data } = await apiClient.get<ApiEnvelope<DashboardListPage>>(
    "/api/v1/dashboards/",
    { params: { page, limit } }
  );
  return data.data!;
}

export async function getDashboard(id: string) {
  const { data } = await apiClient.get<ApiEnvelope<Dashboard>>(
    `/api/v1/dashboards/${id}`
  );
  return data.data!;
}

export async function updateDashboard(
  id: string,
  payload: Partial<{
    title: string;
    description: string | null;
    layout: LayoutItem[];
    widgets: DashboardWidget[];
    theme: DashboardTheme;
    refresh_interval: number | null;
  }>
) {
  const { data } = await apiClient.put<ApiEnvelope<Dashboard>>(
    `/api/v1/dashboards/${id}`,
    payload
  );
  return data.data!;
}

export async function deleteDashboard(id: string) {
  await apiClient.delete(`/api/v1/dashboards/${id}`);
}

export async function publishDashboard(id: string) {
  const { data } = await apiClient.post<
    ApiEnvelope<{ is_public: boolean; public_slug: string; public_url?: string }>
  >(`/api/v1/dashboards/${id}/publish`);
  return data.data!;
}

export async function duplicateDashboard(id: string) {
  const { data } = await apiClient.post<ApiEnvelope<Dashboard>>(
    `/api/v1/dashboards/${id}/duplicate`
  );
  return data.data!;
}

/** Server / public fetch — no auth */
export async function fetchPublicDashboard(slug: string): Promise<PublicDashboard> {
  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
    /\/$/,
    ""
  );
  const res = await fetch(`${base}/api/v1/dashboards/public/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Dashboard not found");
  }
  const json = (await res.json()) as ApiEnvelope<PublicDashboard>;
  if (!json.data) throw new Error("Empty response");
  return json.data;
}

/** Browser fetch for public dashboard (share page client refresh) */
export async function fetchPublicDashboardClient(slug: string) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/dashboards/public/${slug}`);
  if (!res.ok) throw new Error("Dashboard not found");
  const json = (await res.json()) as ApiEnvelope<PublicDashboard>;
  return json.data!;
}

export function widgetToLayoutItem(w: DashboardWidget): LayoutItem {
  const p = w.grid_position;
  return {
    i: w.id,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    minW: 2,
    minH: 2,
  };
}

export function widgetsToLayout(widgets: DashboardWidget[]): LayoutItem[] {
  return widgets.map(widgetToLayoutItem);
}
