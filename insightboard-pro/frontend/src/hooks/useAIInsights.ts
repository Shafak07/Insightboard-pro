"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import {
  askDatasetQuestion,
  fetchChartInsight,
  streamDatasetSummary,
  type AskQuestionResult,
  type DatasetAISummary,
  type SummaryStreamEvent,
} from "@/lib/ai";

const SUMMARY_STALE_MS = 60 * 60 * 1000;

export function useDatasetSummary(datasetId: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const query = useQuery({
    queryKey: ["ai-summary", datasetId],
    enabled: Boolean(datasetId) && enabled,
    staleTime: SUMMARY_STALE_MS,
    queryFn: async (): Promise<DatasetAISummary> => {
      if (!datasetId) {
        throw new Error("dataset_id required");
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setStreamText("");

      const onEvent = (event: SummaryStreamEvent) => {
        if (event.type === "token") {
          setStreamText((prev) => prev + event.text);
        }
      };

      try {
        const summary = await streamDatasetSummary(
          datasetId,
          onEvent,
          controller.signal
        );
        return summary;
      } finally {
        setIsStreaming(false);
      }
    },
  });

  const refetchSummary = useCallback(() => {
    if (!datasetId) return;
    queryClient.removeQueries({ queryKey: ["ai-summary", datasetId] });
    void query.refetch();
  }, [datasetId, query, queryClient]);

  const displaySummary =
    streamText.length > 0
      ? { ...query.data, executive_summary: streamText }
      : query.data;

  return {
    summary: displaySummary as DatasetAISummary | undefined,
    rawSummary: query.data,
    streamText,
    isStreaming,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetchSummary,
  };
}

export function useChartInsight() {
  return useMutation({
    mutationKey: ["ai-chart-insight"],
    mutationFn: fetchChartInsight,
  });
}

export function useAskQuestion() {
  return useMutation({
    mutationKey: ["ai-ask"],
    mutationFn: askDatasetQuestion,
  });
}

export type { AskQuestionResult, DatasetAISummary };
