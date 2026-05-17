"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDatasetRows } from "@/lib/datasets";
import { cn } from "@/lib/utils";

type ColumnType = "number" | "text" | "date";

function dtypeToBadge(dtype: string | undefined): ColumnType {
  if (!dtype) return "text";
  const d = dtype.toLowerCase();
  if (d.includes("int") || d.includes("float") || d === "number") return "number";
  if (d.includes("datetime") || d.includes("date")) return "date";
  return "text";
}

function inferBadge(sample: unknown): ColumnType {
  if (sample == null) return "text";
  if (typeof sample === "number") return "number";
  const s = String(sample);
  if (/^\d{4}-\d{2}-\d{2}/.test(s) || !Number.isNaN(Date.parse(s)))
    return "date";
  return "text";
}

interface DataPreviewProps {
  datasetId: string;
  columnsMetadata?: Record<string, unknown>[] | null;
}

export function DataPreview({ datasetId, columnsMetadata }: DataPreviewProps) {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [columns, setColumns] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDatasetRows(datasetId, {
        page,
        limit,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setRows(data.rows);
      setTotalRows(data.total_rows);
      if (data.rows.length > 0) {
        setColumns(Object.keys(data.rows[0]));
      }
    } finally {
      setLoading(false);
    }
  }, [datasetId, page, limit, sortBy, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  const maxPage = Math.max(1, Math.ceil(totalRows / limit));

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const typeByCol = useMemo(() => {
    const m: Record<string, ColumnType> = {};
    const metaByName = new Map<string, Record<string, unknown>>();
    if (columnsMetadata) {
      for (const item of columnsMetadata) {
        const name = String(item.column_name ?? "");
        if (name) metaByName.set(name, item);
      }
    }
    for (const c of columns) {
      const meta = metaByName.get(c);
      if (meta) {
        m[c] = dtypeToBadge(String(meta.dtype ?? ""));
      } else {
        const first = rows.find((r) => r[c] != null)?.[c];
        m[c] = inferBadge(first);
      }
    }
    return m;
  }, [rows, columns, columnsMetadata]);

  if (loading && rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading preview…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card shadow-sm">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-3 py-2 text-left font-medium"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-left hover:text-foreground"
                    onClick={() => toggleSort(col)}
                  >
                    <span className="truncate">{col}</span>
                    <Badge variant="muted" className="text-[10px] uppercase">
                      {typeByCol[col] ?? "text"}
                    </Badge>
                    {sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/60 odd:bg-muted/20 hover:bg-muted/40"
              >
                {columns.map((col) => {
                  const v = row[col];
                  const isNull = v == null || v === "";
                  return (
                    <td
                      key={col}
                      className={cn(
                        "max-w-[240px] truncate px-3 py-1.5 font-mono text-xs",
                        isNull && "bg-red-500/10 text-red-400"
                      )}
                      title={isNull ? "null" : String(v)}
                    >
                      {isNull ? "null" : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalRows === 0 ? 0 : (page - 1) * limit + 1}–
          {Math.min(page * limit, totalRows)} of {totalRows} rows
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            Page {page} / {maxPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= maxPage}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
