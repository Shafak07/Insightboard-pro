import { getApiBaseUrl } from "@/lib/api";

export interface RecommendedChart {
  chart_type: string;
  x_column: string;
  y_column: string;
  reason: string;
}

export interface DatasetAISummary {
  executive_summary: string;
  key_findings: string[];
  data_quality_issues: string[];
  recommended_charts: RecommendedChart[];
  business_questions: string[];
  anomalies: string[];
  quality_score?: number;
}

export interface AskQuestionResult {
  answer: string;
  sql_query: string;
  confidence: number;
  follow_up_questions: string[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
}

export type SummaryStreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; summary: DatasetAISummary; cached?: boolean };

function parseSseLine(line: string): SummaryStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const json = trimmed.slice(5).trim();
  if (!json) return null;
  try {
    return JSON.parse(json) as SummaryStreamEvent;
  } catch {
    return null;
  }
}

export async function streamDatasetSummary(
  datasetId: string,
  onEvent: (event: SummaryStreamEvent) => void,
  signal?: AbortSignal
): Promise<DatasetAISummary> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/ai/dataset/${datasetId}/summary`, {
    method: "POST",
    credentials: "include",
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `Summary request failed (${res.status})`);
  }

  if (!res.body) {
    throw new Error("No response body for AI summary stream");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalSummary: DatasetAISummary | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const line of parts) {
      const event = parseSseLine(line);
      if (!event) continue;
      onEvent(event);
      if (event.type === "done") {
        finalSummary = event.summary;
      }
    }
  }

  if (buffer.trim()) {
    const event = parseSseLine(buffer);
    if (event) {
      onEvent(event);
      if (event.type === "done") finalSummary = event.summary;
    }
  }

  if (!finalSummary) {
    throw new Error("AI summary stream ended without a result");
  }

  return finalSummary;
}

export async function fetchChartInsight(body: {
  chart_type: string;
  chart_data: Record<string, unknown>[];
  x_col: string;
  y_col: string;
  chart_title?: string;
}): Promise<string> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/ai/chart-insight`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Chart insight failed (${res.status})`);
  }

  const json = (await res.json()) as ApiEnvelope<{ insight: string }>;
  return json.data?.insight ?? "";
}

export async function askDatasetQuestion(body: {
  dataset_id: string;
  question: string;
}): Promise<AskQuestionResult> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/ai/ask`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(errText || `Ask failed (${res.status})`);
  }

  const json = (await res.json()) as ApiEnvelope<AskQuestionResult>;
  if (!json.data) {
    throw new Error("Empty response from ask endpoint");
  }
  return json.data;
}
