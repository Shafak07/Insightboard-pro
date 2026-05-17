"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHeaderActions } from "@/components/dashboard/DashboardHeaderActions";
import { AIInsightContent } from "@/components/ai/AIInsightContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RecommendedChart } from "@/lib/ai";
import { chartRecommendationHref } from "@/lib/chart-recommendation";
import { getDataset, type DatasetDetail } from "@/lib/datasets";

export default function DatasetInsightsPage() {
  const params = useParams();
  const router = useRouter();
  const datasetId = String(params.id);

  const [detail, setDetail] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setDetail(await getDataset(datasetId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dataset");
      } finally {
        setLoading(false);
      }
    })();
  }, [datasetId]);

  const handleCreateChart = (chart: RecommendedChart) => {
    router.push(chartRecommendationHref(datasetId, chart));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/datasets"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Datasets
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <h1 className="text-xl font-semibold">AI Insights</h1>
              {detail ? (
                <Badge variant="muted" className="font-normal">
                  {detail.name}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Executive summary, quality score, chart ideas, and natural language Q&A.
            </p>
          </div>
          <DashboardHeaderActions>
            {detail?.status === "ready" ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/datasets/${datasetId}/charts`}>
                  Chart studio
                </Link>
              </Button>
            ) : null}
          </DashboardHeaderActions>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
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
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-400" />
              <p className="font-medium">Dataset is still processing</p>
              <p className="mt-2 text-sm text-muted-foreground">
                AI insights are available once status is <strong>ready</strong>.
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
          <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/5 via-transparent to-violet-500/5 p-6">
            <AIInsightContent
              datasetId={datasetId}
              active
              showToolbar
              onCreateChart={handleCreateChart}
            />
          </div>
        )}
      </main>
    </div>
  );
}

