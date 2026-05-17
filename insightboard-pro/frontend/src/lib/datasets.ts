import { apiClient } from "@/lib/api";

export type DatasetStatus =
  | "uploading"
  | "processing"
  | "ready"
  | "error";

export interface DatasetSummary {
  id: string;
  name: string;
  description?: string | null;
  file_name: string;
  row_count: number;
  column_count: number;
  status: DatasetStatus;
  created_at: string;
}

export interface DatasetDetail {
  id: string;
  name: string;
  description?: string | null;
  file_name: string;
  file_size: number;
  row_count: number;
  column_count: number;
  columns_metadata?: Record<string, unknown>[] | null;
  eda_profile?: Record<string, unknown> | null;
  status: DatasetStatus;
  storage_path: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  sample_data?: Record<string, unknown>[] | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export async function listDatasets(page = 1, limit = 10) {
  const { data } = await apiClient.get<
    ApiEnvelope<{
      items: DatasetSummary[];
      total: number;
      page: number;
      limit: number;
    }>
  >(`/api/v1/datasets/`, { params: { page, limit } });
  return data.data!;
}

export async function getDataset(id: string) {
  const { data } = await apiClient.get<ApiEnvelope<DatasetDetail>>(
    `/api/v1/datasets/${id}`
  );
  return data.data!;
}

export async function uploadDataset(
  file: File,
  name: string,
  description: string
) {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  form.append("description", description);
  const { data } = await apiClient.post<
    ApiEnvelope<{ dataset_id: string; status: string }>
  >(`/api/v1/datasets/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data!;
}

export async function deleteDataset(id: string) {
  await apiClient.delete(`/api/v1/datasets/${id}`);
}

/** Must match FastAPI `GET .../data` query `limit` max (le=1000). */
export const DATA_API_MAX_LIMIT = 1000;

/** Default row cap for chart builder / dashboard widgets. */
export const CHART_ROW_LIMIT = 500;

export async function getDatasetRows(
  id: string,
  params: {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
  }
) {
  const limit = Math.min(params.limit ?? 50, DATA_API_MAX_LIMIT);
  const { data } = await apiClient.get<
    ApiEnvelope<{
      rows: Record<string, unknown>[];
      total_rows: number;
      page: number;
      limit: number;
      sort_by?: string | null;
      sort_dir: string;
    }>
  >(`/api/v1/datasets/${id}/data`, { params: { ...params, limit } });
  return data.data!;
}

export interface DatasetChartData {
  rows: Record<string, unknown>[];
  total_rows: number;
  columns_metadata?: Record<string, unknown>[] | null;
  correlations?: Record<string, Record<string, number>> | null;
  /** stored_sample = instant from ETL; storage = loaded from file */
  source: string;
}

/** One request for chart studio — uses precomputed ETL sample when available. */
export async function getDatasetChartData(
  id: string,
  options?: {
    limit?: number;
    x_col?: string;
    y_col?: string;
    group_by?: string;
    aggregation?: string;
  }
): Promise<DatasetChartData> {
  const { data } = await apiClient.get<ApiEnvelope<DatasetChartData>>(
    `/api/v1/datasets/${id}/chart-data`,
    {
      params: {
        limit: options?.limit ?? CHART_ROW_LIMIT,
        x_col: options?.x_col,
        y_col: options?.y_col,
        group_by: options?.group_by,
        aggregation: options?.aggregation,
      },
    }
  );
  return data.data!;
}

/** @deprecated Prefer getDatasetChartData — kept for table pagination. */
export async function fetchDatasetRowsForCharts(
  id: string,
  maxRows: number = CHART_ROW_LIMIT
) {
  const data = await getDatasetChartData(id, { limit: maxRows });
  return { rows: data.rows, total_rows: data.total_rows };
}
