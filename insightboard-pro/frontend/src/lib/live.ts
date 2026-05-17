import { apiClient } from "@/lib/api";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface LiveConnectionSummary {
  id: string;
  name: string;
  api_url: string;
  method: string;
  refresh_interval: number;
  last_fetched_at?: string | null;
  last_row_count: number;
  status: string;
  chart_x_field?: string | null;
  chart_y_field?: string | null;
}

export interface LiveConnectPayload {
  name: string;
  api_url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  refresh_seconds: number;
  chart_x_field?: string;
  chart_y_field?: string;
}

export async function testLiveConnection(payload: {
  api_url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}) {
  const { data } = await apiClient.post<ApiEnvelope<{ ok: boolean; preview: Record<string, unknown> }>>(
    "/api/v1/live/test",
    payload
  );
  if (!data.data) throw new Error(data.message ?? "Test failed");
  return data.data;
}

export async function connectLiveApi(payload: LiveConnectPayload) {
  const { data } = await apiClient.post<ApiEnvelope<{ connection_id: string }>>(
    "/api/v1/live/connect",
    payload
  );
  if (!data.data) throw new Error(data.message ?? "Connect failed");
  return data.data.connection_id;
}

export async function ensureBtcDemo() {
  const { data } = await apiClient.post<ApiEnvelope<{ connection_id: string }>>(
    "/api/v1/live/demo"
  );
  if (!data.data) throw new Error(data.message ?? "Demo setup failed");
  return data.data.connection_id;
}

export async function listLiveConnections() {
  const { data } = await apiClient.get<ApiEnvelope<LiveConnectionSummary[]>>(
    "/api/v1/live/connections"
  );
  return data.data ?? [];
}

export async function getLiveSnapshot(connectionId: string) {
  const { data } = await apiClient.get<
    ApiEnvelope<{
      connection_id: string;
      points: Record<string, unknown>[];
      series: Record<string, unknown>[];
    }>
  >(`/api/v1/live/connections/${connectionId}/snapshot`);
  if (!data.data) throw new Error(data.message ?? "Snapshot failed");
  return data.data;
}

export function getWebSocketUrl(userId: string, token: string): string {
  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsBase = apiBase.replace(/^http/, "ws");
  const params = new URLSearchParams({ token });
  return `${wsBase}/api/v1/ws/${userId}?${params.toString()}`;
}
