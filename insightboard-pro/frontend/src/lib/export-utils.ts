import html2canvas from "html2canvas";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import type { RefObject } from "react";
import * as XLSX from "xlsx";

import { toast } from "@/hooks/use-toast";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_") || "export";
}

/** Flatten nested objects for tabular export. */
export function flattenRow(
  row: Record<string, unknown>,
  prefix = ""
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(row)) {
    const col = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) {
      out[col] = null;
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[col] = value;
    } else if (Array.isArray(value)) {
      out[col] = JSON.stringify(value);
    } else if (typeof value === "object") {
      Object.assign(
        out,
        flattenRow(value as Record<string, unknown>, col)
      );
    } else {
      out[col] = String(value);
    }
  }
  return out;
}

function rowsToFlat(data: object[]): Record<string, string | number | boolean | null>[] {
  return data.map((row) => flattenRow(row as Record<string, unknown>));
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportDataAsCSV(data: object[], filename: string): void {
  if (!data.length) {
    toast({
      title: "Nothing to export",
      description: "No rows available for CSV export.",
      variant: "destructive",
    });
    return;
  }

  const flat = rowsToFlat(data);
  const keys = Array.from(
    flat.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const lines = [
    keys.map(escapeCsvCell).join(","),
    ...flat.map((row) => keys.map((k) => escapeCsvCell(row[k])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `${sanitizeFilename(filename)}.csv`);
  toast({ title: "CSV downloaded", description: filename });
}

export function exportDataAsExcel(data: object[], filename: string): void {
  if (!data.length) {
    toast({
      title: "Nothing to export",
      description: "No rows available for Excel export.",
      variant: "destructive",
    });
    return;
  }

  const flat = rowsToFlat(data);
  const keys = Array.from(
    flat.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const aoa: (string | number | boolean | null)[][] = [
    keys,
    ...flat.map((row) =>
      keys.map((k) => {
        const v = row[k];
        if (v === null || v === undefined) return "";
        return v;
      })
    ),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths = keys.map((key, colIdx) => {
    let maxLen = key.length;
    for (let r = 1; r < aoa.length; r++) {
      const cell = aoa[r][colIdx];
      maxLen = Math.max(maxLen, String(cell ?? "").length);
    }
    return { wch: Math.min(Math.max(maxLen + 2, 8), 48) };
  });
  ws["!cols"] = colWidths;

  const headerRow = 0;
  for (let c = 0; c < keys.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    const cell = ws[addr];
    if (cell) {
      cell.s = { font: { bold: true } };
    }
  }

  for (let r = 1; r < aoa.length; r++) {
    for (let c = 0; c < keys.length; c++) {
      const val = aoa[r][c];
      if (typeof val === "number") {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) cell.z = "#,##0.00";
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${sanitizeFilename(filename)}.xlsx`);
  toast({ title: "Excel downloaded", description: filename });
}

export async function exportChartAsPNG(
  chartRef: RefObject<HTMLElement | null>,
  options?: { filename?: string }
): Promise<void> {
  const el = chartRef.current;
  if (!el) {
    toast({
      title: "Export failed",
      description: "Chart element is not ready.",
      variant: "destructive",
    });
    return;
  }

  try {
    const dataUrl = await toPng(el, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const name = sanitizeFilename(options?.filename ?? "chart");
    triggerDownload(blob, `${name}.png`);
    toast({ title: "Chart saved as PNG" });
  } catch (e) {
    toast({
      title: "PNG export failed",
      description: e instanceof Error ? e.message : "Unknown error",
      variant: "destructive",
    });
  }
}

export interface DashboardPdfOptions {
  title: string;
  filename?: string;
}

export async function exportDashboardAsPDF(
  dashboardRef: RefObject<HTMLElement | null>,
  options: DashboardPdfOptions
): Promise<void> {
  const el = dashboardRef.current;
  if (!el) {
    toast({
      title: "Export failed",
      description: "Dashboard is not ready for export.",
      variant: "destructive",
    });
    return;
  }

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const headerH = 14;
    const footerH = 10;
    const contentTop = margin + headerH;
    const contentBottom = pageHeight - margin - footerH;
    const contentHeight = contentBottom - contentTop;

    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const imgData = canvas.toDataURL("image/png");
    const dateStr = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let heightLeft = imgHeight;
    let offsetY = 0;
    let pageNum = 1;
    const totalPages = Math.max(1, Math.ceil(imgHeight / contentHeight));

    const drawHeaderFooter = () => {
      pdf.setFontSize(11);
      pdf.setTextColor(30, 30, 30);
      pdf.text(options.title, margin, margin + 5);
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(dateStr, margin, margin + 10);

      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(
        "Generated by InsightBoard Pro",
        margin,
        pageHeight - margin - 2
      );
      pdf.text(
        `Page ${pageNum} of ${totalPages}`,
        pageWidth - margin - 28,
        pageHeight - margin - 2
      );
    };

    while (heightLeft > 0) {
      if (pageNum > 1) pdf.addPage();
      drawHeaderFooter();

      pdf.addImage(
        imgData,
        "PNG",
        margin,
        contentTop - offsetY,
        imgWidth,
        imgHeight
      );

      heightLeft -= contentHeight;
      offsetY += contentHeight;
      pageNum += 1;
    }

    const fname = sanitizeFilename(options.filename ?? options.title);
    pdf.save(`${fname}.pdf`);
    toast({ title: "Dashboard exported as PDF" });
  } catch (e) {
    toast({
      title: "PDF export failed",
      description: e instanceof Error ? e.message : "Unknown error",
      variant: "destructive",
    });
  }
}
