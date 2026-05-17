"use client";

import { FileSpreadsheet, Sheet } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { exportDataAsCSV, exportDataAsExcel } from "@/lib/export-utils";
import { DATA_API_MAX_LIMIT, getDatasetRows } from "@/lib/datasets";

export interface DatasetExportActionsProps {
  datasetId: string;
  filename: string;
  /** Rows already loaded in the UI (exported immediately if provided). */
  rows?: Record<string, unknown>[];
}

export function DatasetExportActions({
  datasetId,
  filename,
  rows,
}: DatasetExportActionsProps) {
  const [loading, setLoading] = useState(false);

  const loadAllRows = async () => {
    if (rows?.length) return rows;
    setLoading(true);
    try {
      const data = await getDatasetRows(datasetId, {
        page: 1,
        limit: DATA_API_MAX_LIMIT,
      });
      return data.rows;
    } finally {
      setLoading(false);
    }
  };

  const handleCsv = async () => {
    const data = await loadAllRows();
    exportDataAsCSV(data, filename);
  };

  const handleExcel = async () => {
    const data = await loadAllRows();
    exportDataAsExcel(data, filename);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => void handleCsv()}
      >
        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
        CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => void handleExcel()}
      >
        <Sheet className="mr-1.5 h-3.5 w-3.5" />
        Excel
      </Button>
    </div>
  );
}
