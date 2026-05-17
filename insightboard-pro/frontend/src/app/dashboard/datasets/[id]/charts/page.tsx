"use client";

import { BarChart3, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Suspense, useEffect, useState } from "react";

import { DashboardHeaderActions } from "@/components/dashboard/DashboardHeaderActions";
import { AIInsightPanel } from "@/components/ai/AIInsightPanel";
import { ChartBuilder } from "@/components/charts/ChartBuilder";
import type { ColumnMeta } from "@/components/charts/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDataset, type DatasetDetail } from "@/lib/datasets";
import { parseChartRecommendationSearch } from "@/lib/chart-recommendation";
import { useChartBuilderStore } from "@/lib/chart-builder-store";

function DatasetChartsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const datasetId = String(params.id);
  const resetBuilder = useChartBuilderStore((s) => s.reset);
  const applyRecommendation = useChartBuilderStore((s) => s.applyRecommendation);

  const [detail, setDetail] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    resetBuilder();
  }, [datasetId, resetBuilder]);

  useEffect(() => {
    const rec = parseChartRecommendationSearch(searchParams);
    if (rec) {
      applyRecommendation(rec);
    }
  }, [searchParams, applyRecommendation]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await getDataset(datasetId);
        setDetail(d);
        if (d.name) {
          useChartBuilderStore.getState().setChartTitle(`${d.name} — chart`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dataset");
      } finally {
        setLoading(false);
      }
    })();
  }, [datasetId]);

  const columnsMetadata =
    (detail?.columns_metadata as ColumnMeta[] | undefined) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/datasets"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Datasets
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#3B82F6]" />
              <h1 className="text-xl font-semibold">Chart studio</h1>
              {detail ? (
                <Badge variant="muted" className="font-normal">
                  {detail.name}
                </Badge>
              ) : null}
              {detail?.status ? (
                <Badge
                  variant={
                    detail.status === "ready"
                      ? "success"
                      : detail.status === "error"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {detail.status}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Map columns, pick a chart type, and add visuals to your dashboard.
            </p>
          </div>
          <DashboardHeaderActions>
            {detail?.status === "ready" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20"
                  asChild
                >
                  <Link href={`/dashboard/datasets/${datasetId}/insights`}>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    AI page
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20"
                  onClick={() => setAiOpen(true)}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  AI panel
                </Button>
              </>
            ) : null}
          </DashboardHeaderActions>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading dataset…
          </div>
        ) : error ? (
          <Card className="border-red-500/40 bg-red-500/5">
            <CardContent className="py-8">
              <p className="text-sm text-red-400">{error}</p>
              <Button className="mt-4" variant="outline" asChild>
                <Link href="/dashboard/datasets">Back to datasets</Link>
              </Button>
            </CardContent>
          </Card>
        ) : detail?.status !== "ready" ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#3B82F6]" />
              <p className="font-medium">Dataset is still processing</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Wait until status is <strong>ready</strong>, then refresh this
                page to build charts.
              </p>
              <Button
                className="mt-6"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <ChartBuilder
              datasetId={datasetId}
              datasetName={detail.name}
              columnsMetadata={columnsMetadata}
              className={aiOpen ? "lg:pr-[380px]" : undefined}
            />
            <AIInsightPanel
              datasetId={datasetId}
              open={aiOpen}
              onOpenChange={setAiOpen}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default function DatasetChartsPageWithSuspense() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <DatasetChartsPage />
    </Suspense>
  );
}
