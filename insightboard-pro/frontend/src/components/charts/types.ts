import type { ColorScheme } from "@/lib/chart-utils";

export interface ChartSeriesConfig {
  dataKey: string;
  name?: string;
  color?: string;
}

export interface SharedChartOptions {
  colors?: string[];
  colorScheme?: ColorScheme;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  height?: number;
}

export interface ReferenceLineConfig {
  value: number;
  label?: string;
  stroke?: string;
  strokeDasharray?: string;
}

export interface ColumnMeta {
  column_name: string;
  dtype?: string;
  numeric_profile?: Record<string, number>;
  string_profile?: Record<string, unknown>;
  [key: string]: unknown;
}
