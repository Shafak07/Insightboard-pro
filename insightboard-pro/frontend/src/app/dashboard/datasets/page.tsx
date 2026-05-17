"use client";

import { BarChart3, Database, Plus, Sparkles, Table2, Upload } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DashboardHeaderActions } from "@/components/dashboard/DashboardHeaderActions";
import { AIInsightContent } from "@/components/ai/AIInsightContent";
import { DataPreview } from "@/components/datasets/DataPreview";
import { DatasetExportActions } from "@/components/datasets/DatasetExportActions";
import { DatasetCard } from "@/components/datasets/DatasetCard";
import { UploadModal } from "@/components/datasets/UploadModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RecommendedChart } from "@/lib/ai";
import { chartRecommendationHref } from "@/lib/chart-recommendation";
import {
  deleteDataset,
  getDataset,
  listDatasets,
  type DatasetSummary,
} from "@/lib/datasets";
import { useRouter } from "next/navigation";

import { useWebSocketContext } from "@/providers/websocket-provider";

export default function DatasetsPage() {
  const router = useRouter();
  const [items, setItems] = useState<DatasetSummary[]>([]);
  const [previewTab, setPreviewTab] = useState<"preview" | "charts" | "ai">("preview");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewStatus, setPreviewStatus] = useState<string>("");
  const [previewMeta, setPreviewMeta] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await listDatasets(1, 50);
    setItems(data.items);
    setLoadError(null);
  }, []);

  const { on } = useWebSocketContext();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await refresh();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load datasets");
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    return on("dataset_ready", () => {
      void refresh();
    });
  }, [on, refresh]);

  const handleDelete = async (id: string) => {
    await deleteDataset(id);
    await refresh();
    if (previewId === id) {
      setPreviewId(null);
      setPreviewMeta(null);
    }
  };

  const openPreview = async (id: string, tab: "preview" | "charts" | "ai" = "preview") => {
    setPreviewTab(tab);
    setPreviewId(id);
    try {
      const detail = await getDataset(id);
      setPreviewName(detail.name);
      setPreviewStatus(detail.status);
      setPreviewMeta(
        (detail.columns_metadata as Record<string, unknown>[]) ?? null
      );
    } catch {
      setPreviewName("");
      setPreviewStatus("");
      setPreviewMeta(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Dashboard
            </Link>
            <h1 className="mt-1 text-xl font-semibold">Datasets</h1>
            <p className="text-sm text-muted-foreground">
              Upload CSV → AI insights → preview data → build charts
            </p>
          </div>
          <DashboardHeaderActions>
            <Button
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
              onClick={() => setUploadOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </DashboardHeaderActions>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        {loadError ? (
          <Card className="border-red-500/40 bg-red-500/5">
            <CardContent className="py-8">
              <p className="text-sm font-medium text-red-400">
                Could not load datasets
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                onClick={() => refresh()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading datasets…</p>
        ) : items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-16">
              <Database className="mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="text-lg font-medium">Upload your first dataset</h2>
              <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
                Drop a CSV to profile columns, run AI insights, and power every
                chart on your dashboards.
              </p>
              <Button
                className="bg-[#3B82F6] hover:bg-[#2563EB]"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload your first dataset
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((ds) => (
              <DatasetCard
                key={ds.id}
                dataset={ds}
                onPreview={openPreview}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onComplete={refresh}
      />

      <Dialog
        open={!!previewId}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewId(null);
            setPreviewMeta(null);
            setPreviewTab("preview");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {previewName || "Dataset"}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {previewId && previewStatus === "ready" ? (
                  <DatasetExportActions
                    datasetId={previewId}
                    filename={previewName || "dataset"}
                  />
                ) : null}
                {previewStatus === "ready" && previewId ? (
                  <Button variant="outline" size="sm" className="h-8" asChild>
                    <Link href={`/dashboard/datasets/${previewId}/insights`}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Full AI view
                    </Link>
                  </Button>
                ) : null}
              </div>
            </DialogTitle>
          </DialogHeader>
          {previewId ? (
            <Tabs
              value={previewTab}
              onValueChange={(v) =>
                setPreviewTab(v as "preview" | "charts" | "ai")
              }
            >
              <TabsList>
                <TabsTrigger value="preview" className="gap-2">
                  <Table2 className="h-4 w-4" />
                  Table
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="gap-2"
                  disabled={previewStatus !== "ready"}
                >
                  <Sparkles className="h-4 w-4" />
                  AI Insights
                </TabsTrigger>
                <TabsTrigger
                  value="charts"
                  className="gap-2"
                  disabled={previewStatus !== "ready"}
                >
                  <BarChart3 className="h-4 w-4" />
                  Chart studio
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-4 max-h-[65vh] overflow-auto">
                <DataPreview
                  datasetId={previewId}
                  columnsMetadata={previewMeta}
                />
              </TabsContent>
              <TabsContent value="ai" className="mt-4 max-h-[65vh] overflow-y-auto">
                <AIInsightContent
                  datasetId={previewId}
                  active={previewTab === "ai"}
                  compact
                  showToolbar
                  onCreateChart={(chart: RecommendedChart) => {
                    router.push(chartRecommendationHref(previewId, chart));
                  }}
                />
              </TabsContent>
              <TabsContent value="charts" className="mt-4">
                <p className="mb-4 text-sm text-muted-foreground">
                  Open the full chart builder to map columns and add charts to
                  your dashboard.
                </p>
                <Button className="bg-[#3B82F6] hover:bg-[#2563EB]" asChild>
                  <Link href={`/dashboard/datasets/${previewId}/charts`}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Open chart studio
                  </Link>
                </Button>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
