"use client";

import { BarChart3, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DatasetSummary } from "@/lib/datasets";

function statusVariant(
  s: DatasetSummary["status"]
): "success" | "warning" | "muted" | "destructive" | "secondary" {
  switch (s) {
    case "ready":
      return "success";
    case "processing":
    case "uploading":
      return "warning";
    case "error":
      return "destructive";
    default:
      return "secondary";
  }
}

interface DatasetCardProps {
  dataset: DatasetSummary;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DatasetCard({ dataset, onPreview, onDelete }: DatasetCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-base">{dataset.name}</CardTitle>
          <Badge variant={statusVariant(dataset.status)}>{dataset.status}</Badge>
        </div>
        <CardDescription className="line-clamp-2">{dataset.file_name}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-1 flex-col gap-3">
        <DatasetStats dataset={dataset} />
        <p className="text-[11px] text-muted-foreground">
          {new Date(dataset.created_at).toLocaleString()}
        </p>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={dataset.status !== "ready"}
            onClick={() => onPreview(dataset.id)}
          >
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20"
            disabled={dataset.status !== "ready"}
            asChild
          >
            <Link href={`/dashboard/datasets/${dataset.id}/insights`}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              AI
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => onDelete(dataset.id)}
            aria-label={`Delete ${dataset.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="col-span-3 border-[#3B82F6]/40 text-[#93C5FD] hover:bg-[#3B82F6]/10"
            disabled={dataset.status !== "ready"}
            asChild
          >
            <Link href={`/dashboard/datasets/${dataset.id}/charts`}>
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Build chart
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DatasetStats({ dataset }: { dataset: DatasetSummary }) {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground">
      <span>{dataset.row_count.toLocaleString()} rows</span>
      <span>{dataset.column_count} cols</span>
    </div>
  );
}
