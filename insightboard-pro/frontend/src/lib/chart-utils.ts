export type ColumnKind = "numeric" | "datetime" | "categorical" | "unknown";
export type ChartTypeSuggestion =
  | "line"
  | "bar"
  | "scatter"
  | "heatmap"
  | "metric"
  | "area";
export type ColorScheme =
  | "blue"
  | "purple"
  | "green"
  | "sunset"
  | "corporate";
export type AggregationOp = "sum" | "avg" | "count" | "min" | "max";

const PALETTES: Record<ColorScheme, string[]> = {
  corporate: ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"],
  sunset: ["#F97316", "#EC4899", "#8B5CF6", "#06B6D4", "#84CC16"],
  blue: ["#3B82F6", "#60A5FA", "#93C5FD", "#1D4ED8", "#2563EB"],
  purple: ["#8B5CF6", "#A78BFA", "#C4B5FD", "#6D28D9", "#7C3AED"],
  green: ["#10B981", "#34D399", "#6EE7B7", "#059669", "#047857"],
};

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}`;
  if (abs >= 1) return `${sign}${abs.toFixed(1)}`;
  return `${sign}${abs.toPrecision(2)}`;
}

export function formatDate(
  d: Date | string | number,
  granularity: "day" | "month" | "quarter" | "year" = "month"
): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  if (granularity === "year") return String(date.getFullYear());
  if (granularity === "quarter") {
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `Q${q} ${date.getFullYear()}`;
  }
  if (granularity === "day") {
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
  return `${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

export function getColorPalette(scheme: ColorScheme, count: number): string[] {
  const base = PALETTES[scheme] ?? PALETTES.corporate;
  if (count <= base.length) return base.slice(0, count);
  return Array.from({ length: count }, (_, i) => base[i % base.length]);
}

export function inferColumnKind(meta: Record<string, unknown>): ColumnKind {
  const dtype = String(meta.dtype ?? "").toLowerCase();
  const name = String(meta.column_name ?? "").toLowerCase();
  if (
    dtype.includes("datetime") ||
    dtype.includes("date") ||
    name.includes("date") ||
    name.includes("time")
  ) {
    return "datetime";
  }
  if (
    dtype.includes("int") ||
    dtype.includes("float") ||
    dtype.includes("double") ||
    dtype.includes("decimal") ||
    meta.numeric_profile
  ) {
    return "numeric";
  }
  if (dtype.includes("object") || dtype.includes("string") || meta.string_profile) {
    return "categorical";
  }
  return "unknown";
}

export function inferBestChart(
  colXType: ColumnKind,
  colYType: ColumnKind
): ChartTypeSuggestion {
  if (colXType === "datetime" && colYType === "numeric") return "line";
  if (colXType === "categorical" && colYType === "numeric") return "bar";
  if (colXType === "numeric" && colYType === "numeric") return "scatter";
  if (colXType === "unknown" && colYType === "numeric") return "metric";
  if (colXType === "numeric" && colYType === "unknown") return "heatmap";
  return "bar";
}

export function aggregateData(
  data: Record<string, unknown>[],
  groupBy: string,
  metric: string,
  aggregation: AggregationOp
): Record<string, unknown>[] {
  const groups = new Map<string, { values: number[]; row: Record<string, unknown> }>();

  for (const row of data) {
    const key = String(row[groupBy] ?? "—");
    const raw = row[metric];
    const num =
      typeof raw === "number"
        ? raw
        : raw != null && raw !== ""
          ? Number(raw)
          : NaN;

    if (!groups.has(key)) {
      groups.set(key, { values: [], row: { [groupBy]: key } });
    }
    const g = groups.get(key)!;
    if (Number.isFinite(num)) g.values.push(num);
  }

  const result: Record<string, unknown>[] = [];
  for (const g of Array.from(groups.values())) {
    let value = 0;
    const vals = g.values;
    switch (aggregation) {
      case "sum":
        value = vals.reduce((a, b) => a + b, 0);
        break;
      case "avg":
        value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        break;
      case "count":
        value = vals.length;
        break;
      case "min":
        value = vals.length ? Math.min(...vals) : 0;
        break;
      case "max":
        value = vals.length ? Math.max(...vals) : 0;
        break;
    }
    result.push({ ...g.row, [metric]: value });
  }

  return result.sort((a, b) =>
    String(a[groupBy]).localeCompare(String(b[groupBy]))
  );
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildCorrelationMatrix(
  data: Record<string, unknown>[],
  columns: string[]
): { labels: string[]; matrix: number[][] } {
  const numericCols = columns.filter((col) => {
    const vals = data.map((r) => toNumber(r[col])).filter((v) => v != null) as number[];
    return vals.length >= 2;
  });

  const labels = numericCols;
  const n = labels.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0)
  );

  const series = labels.map((col) =>
    data.map((r) => toNumber(r[col])).map((v) => v ?? NaN)
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matrix[i][j] =
        i === j ? 1 : pearsonCorrelation(series[i], series[j]);
    }
  }

  return { labels, matrix };
}

/** Convert ETL sparse correlation dict to heatmap matrix. */
export function correlationsDictToMatrix(
  correlations: Record<string, Record<string, number>>
): { labels: string[]; matrix: number[][] } {
  const labelSet = new Set<string>();
  for (const [a, pairs] of Object.entries(correlations)) {
    labelSet.add(a);
    for (const b of Object.keys(pairs)) labelSet.add(b);
  }
  const labels = Array.from(labelSet).sort();
  const n = labels.length;
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const v =
        correlations[labels[i]]?.[labels[j]] ??
        correlations[labels[j]]?.[labels[i]];
      matrix[i][j] = v ?? 0;
    }
  }
  return { labels, matrix };
}

export function pearsonCorrelation(a: number[], b: number[]): number {
  const pairs: [number, number][] = [];
  for (let k = 0; k < a.length; k++) {
    if (Number.isFinite(a[k]) && Number.isFinite(b[k])) pairs.push([a[k], b[k]]);
  }
  if (pairs.length < 2) return 0;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let k = 0; k < pairs.length; k++) {
    const vx = xs[k] - mx;
    const vy = ys[k] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}
