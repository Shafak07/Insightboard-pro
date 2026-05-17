import type { RecommendedChart } from "@/lib/ai";

export function chartRecommendationHref(
  datasetId: string,
  chart: Pick<RecommendedChart, "chart_type" | "x_column" | "y_column">
): string {
  const params = new URLSearchParams();
  if (chart.chart_type) params.set("type", chart.chart_type);
  if (chart.x_column) params.set("x", chart.x_column);
  if (chart.y_column) params.set("y", chart.y_column);
  const qs = params.toString();
  return `/dashboard/datasets/${datasetId}/charts${qs ? `?${qs}` : ""}`;
}

export function parseChartRecommendationSearch(
  searchParams: URLSearchParams
): RecommendedChart | null {
  const type = searchParams.get("type");
  const x = searchParams.get("x");
  const y = searchParams.get("y");
  if (!type && !x && !y) return null;
  return {
    chart_type: type ?? "bar",
    x_column: x ?? "",
    y_column: y ?? "",
    reason: "",
  };
}
