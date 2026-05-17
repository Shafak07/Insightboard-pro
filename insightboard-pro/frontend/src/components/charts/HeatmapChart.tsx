"use client";

import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface HeatmapChartProps {
  labels: string[];
  matrix: number[][];
  height?: number;
  className?: string;
}

export function HeatmapChart({
  labels,
  matrix,
  height = 360,
  className,
}: HeatmapChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [highlight, setHighlight] = useState<{ i: number; j: number } | null>(
    null
  );
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl || !labels.length) return;

    const width = container.clientWidth || 400;
    const margin = { top: 48, right: 12, bottom: 72, left: 88 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const n = labels.length;
    const cellW = innerW / n;
    const cellH = innerH / n;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const color = d3
      .scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(["#EF4444", "#f8fafc", "#3B82F6"])
      .clamp(true);

    g.selectAll("rect")
      .data(
        matrix.flatMap((row, i) =>
          row.map((value, j) => ({ i, j, value }))
        )
      )
      .join("rect")
      .attr("x", (d) => d.j * cellW)
      .attr("y", (d) => d.i * cellH)
      .attr("width", cellW - 2)
      .attr("height", cellH - 2)
      .attr("rx", 3)
      .attr("fill", (d) => color(d.value))
      .attr("stroke", (d) =>
        highlight && (highlight.i === d.i || highlight.j === d.j)
          ? "#F59E0B"
          : "transparent"
      )
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        const [mx, my] = d3.pointer(event, container);
        setTooltip({
          x: mx,
          y: my,
          text: `${labels[d.i]} × ${labels[d.j]}: ${d.value.toFixed(2)}`,
        });
      })
      .on("mouseleave", () => setTooltip(null))
      .on("click", (_, d) => setHighlight({ i: d.i, j: d.j }));

    g.selectAll("text.cell-val")
      .data(
        matrix.flatMap((row, i) =>
          row.map((value, j) => ({ i, j, value }))
        )
      )
      .join("text")
      .attr("class", "cell-val")
      .attr("x", (d) => d.j * cellW + cellW / 2)
      .attr("y", (d) => d.i * cellH + cellH / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", (d) => (Math.abs(d.value) > 0.55 ? "#fff" : "#334155"))
      .attr("font-size", Math.min(cellW, cellH) > 36 ? 11 : 9)
      .text((d) => d.value.toFixed(2));

    const labelColor = "#94a3b8";
    g.selectAll("text.col-label")
      .data(labels)
      .join("text")
      .attr("class", "col-label")
      .attr("x", (_, i) => i * cellW + cellW / 2)
      .attr("y", -8)
      .attr("text-anchor", "end")
      .attr("transform", (_, i) => {
        const x = i * cellW + cellW / 2;
        return `rotate(-40, ${x}, -8)`;
      })
      .attr("fill", labelColor)
      .attr("font-size", 10)
      .text((d) => d);

    g.selectAll("text.row-label")
      .data(labels)
      .join("text")
      .attr("class", "row-label")
      .attr("x", -8)
      .attr("y", (_, i) => i * cellH + cellH / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .attr("fill", labelColor)
      .attr("font-size", 10)
      .text((d) => d);
  }, [labels, matrix, height, highlight]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <svg ref={svgRef} className="w-full" role="img" aria-label="Correlation heatmap" />
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-card px-2 py-1 text-xs shadow-md"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </div>
  );
}
