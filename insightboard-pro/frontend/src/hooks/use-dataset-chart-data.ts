"use client";

import { useQuery } from "@tanstack/react-query";

import { getDatasetChartData } from "@/lib/datasets";

export function useDatasetChartData(datasetId: string, enabled = true) {
  return useQuery({
    queryKey: ["dataset-chart-data", datasetId],
    queryFn: () => getDatasetChartData(datasetId),
    enabled: enabled && Boolean(datasetId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
