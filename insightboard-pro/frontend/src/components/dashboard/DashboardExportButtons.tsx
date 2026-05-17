"use client";

import { Download, FileImage, FileText } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportChartAsPNG,
  exportDashboardAsPDF,
} from "@/lib/export-utils";

export interface DashboardExportButtonsProps {
  dashboardRef: RefObject<HTMLElement | null>;
  title: string;
}

export function DashboardExportButtons({
  dashboardRef,
  title,
}: DashboardExportButtonsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            void exportDashboardAsPDF(dashboardRef, {
              title,
              filename: title,
            })
          }
        >
          <FileText className="mr-2 h-4 w-4" />
          PDF (full dashboard)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void exportChartAsPNG(dashboardRef, { filename: title })
          }
        >
          <FileImage className="mr-2 h-4 w-4" />
          PNG (full dashboard)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
