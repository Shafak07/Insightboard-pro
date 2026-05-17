"use client";

import * as d3 from "d3";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  LineChart,
  Loader2,
  MessageSquare,
  RefreshCw,
  ScatterChart,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAskQuestion, useDatasetSummary } from "@/hooks/useAIInsights";
import type { AskQuestionResult, RecommendedChart } from "@/lib/ai";
import { useChartBuilderStore } from "@/lib/chart-builder-store";
import { cn } from "@/lib/utils";

const FINDING_ICONS = ["📈", "📉", "⚠️", "✅", "📊"];

interface QAPair {
  id: string;
  question: string;
  result: AskQuestionResult;
}

export interface AIInsightContentProps {
  datasetId: string;
  /** When false, skips fetching (e.g. closed sidebar). */
  active?: boolean;
  className?: string;
  /** Tighter layout for dialogs */
  compact?: boolean;
  showToolbar?: boolean;
  onClose?: () => void;
  /** Override chart apply — default uses chart builder store + optional navigate */
  onCreateChart?: (chart: RecommendedChart) => void;
}

function qualityColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  return "#f44336";
}

function chartIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("line") || t.includes("area")) {
    return <LineChart className="h-4 w-4 text-indigo-400" />;
  }
  if (t.includes("scatter")) {
    return <ScatterChart className="h-4 w-4 text-violet-400" />;
  }
  return <BarChart3 className="h-4 w-4 text-purple-400" />;
}

function QualityArc({ score }: { score: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clamped = Math.max(0, Math.min(100, score));
  const color = qualityColor(clamped);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const size = 96;
    const radius = 38;
    const thickness = 8;
    const g = svg
      .attr("width", size)
      .attr("height", size)
      .append("g")
      .attr("transform", `translate(${size / 2},${size / 2})`);
    const arcBg = d3.arc().innerRadius(radius - thickness).outerRadius(radius);
    g.append("path")
      .attr("d", arcBg({ startAngle: 0, endAngle: Math.PI * 2 } as d3.DefaultArcObject)!)
      .attr("fill", "rgba(148,163,184,0.15)");
    const arcFg = d3
      .arc()
      .innerRadius(radius - thickness)
      .outerRadius(radius)
      .cornerRadius(4);
    g.append("path")
      .attr(
        "d",
        arcFg({
          startAngle: -Math.PI / 2,
          endAngle: -Math.PI / 2 + (Math.PI * 2 * clamped) / 100,
        } as d3.DefaultArcObject)!
      )
      .attr("fill", color);
  }, [clamped, color]);

  return (
    <div className="relative flex flex-col items-center">
      <svg ref={svgRef} className="block" />
      <span
        className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums"
        style={{ color }}
      >
        {Math.round(clamped)}
      </span>
    </div>
  );
}

function TypewriterSummary({ text, active }: { text: string; active: boolean }) {
  return (
    <p className="text-sm leading-relaxed text-foreground/90">
      {text || (active ? "Analyzing your dataset…" : "No summary yet.")}
      {active ? (
        <motion.span
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-indigo-400"
        />
      ) : null}
    </p>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300/90">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AIInsightContent({
  datasetId,
  active = true,
  className,
  compact = false,
  showToolbar = false,
  onClose,
  onCreateChart,
}: AIInsightContentProps) {
  const applyRecommendation = useChartBuilderStore((s) => s.applyRecommendation);
  const {
    summary,
    isLoading,
    isStreaming,
    isError,
    error,
    refetchSummary,
  } = useDatasetSummary(datasetId, active);

  const askMutation = useAskQuestion();
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<QAPair[]>([]);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const qualityScore =
    summary?.quality_score ??
    (summary?.data_quality_issues?.length
      ? Math.max(35, 85 - summary.data_quality_issues.length * 8)
      : 72);

  const handleCreateChart = useCallback(
    (chart: RecommendedChart) => {
      if (onCreateChart) {
        onCreateChart(chart);
        return;
      }
      applyRecommendation(chart);
      onClose?.();
    },
    [onCreateChart, applyRecommendation, onClose]
  );

  const submitQuestion = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed || askMutation.isPending) return;
      setQuestion("");
      try {
        const result = await askMutation.mutateAsync({
          dataset_id: datasetId,
          question: trimmed,
        });
        setQaHistory((prev) =>
          [...prev, { id: crypto.randomUUID(), question: trimmed, result }].slice(
            -5
          )
        );
      } catch {
        /* ignore */
      }
    },
    [askMutation, datasetId]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qaHistory, askMutation.isPending]);

  const execText = summary?.executive_summary ?? "";
  const chatMaxH = compact ? "max-h-[200px]" : "max-h-[280px]";

  return (
    <motion.div
      className={cn(
        "flex flex-col",
        compact ? "min-h-0" : "min-h-full",
        className
      )}
    >
      {showToolbar ? (
        <div className="mb-4 flex shrink-0 items-center justify-between gap-2 border-b border-indigo-500/15 pb-3">
          <div className="flex items-center gap-2">
            <motion.div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-violet-600/30">
              <Sparkles className="h-4 w-4 text-indigo-300" />
            </motion.div>
            <div>
              <p className="text-sm font-semibold">AI Insights</p>
              <p className="text-[10px] text-muted-foreground">Powered by Groq</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetchSummary()}
              disabled={isLoading || isStreaming}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (isLoading || isStreaming) && "animate-spin"
                )}
              />
            </Button>
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={cn("flex-1 space-y-8", compact ? "overflow-y-auto pr-1" : "")}>
        {isError ? (
          <motion.div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error instanceof Error ? error.message : "Failed to load insights"}
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => refetchSummary()}
            >
              Retry
            </Button>
          </motion.div>
        ) : isLoading && !summary ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-sm">Generating insights…</p>
          </div>
        ) : (
          <>
            <Section title="Executive summary">
              <TypewriterSummary text={execText} active={isStreaming} />
            </Section>

            {summary?.key_findings?.length ? (
              <Section title="Key findings">
                <ul className="space-y-2">
                  {summary.key_findings.map((finding, i) => (
                    <motion.li
                      key={`${i}-${finding.slice(0, 24)}`}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-lg border border-indigo-500/15 bg-indigo-500/5 px-3 py-2.5 text-sm leading-snug"
                    >
                      <span className="mr-2" aria-hidden>
                        {FINDING_ICONS[i % FINDING_ICONS.length]}
                      </span>
                      {finding}
                    </motion.li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title="Data quality">
              <div className="flex items-start gap-4">
                <QualityArc score={qualityScore} />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Score from nulls, warnings, and anomalies in your EDA profile.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIssuesOpen((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        issuesOpen && "rotate-180"
                      )}
                    />
                    {summary?.data_quality_issues?.length ?? 0} issues
                  </button>
                  <AnimatePresence>
                    {issuesOpen && summary?.data_quality_issues?.length ? (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-1.5 overflow-hidden text-xs text-muted-foreground"
                      >
                        {summary.data_quality_issues.map((issue, i) => (
                          <li
                            key={i}
                            className="flex gap-2 rounded-md bg-amber-500/5 px-2 py-1.5 text-amber-100/80"
                          >
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                            {issue}
                          </li>
                        ))}
                      </motion.ul>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </Section>

            {summary?.recommended_charts?.length ? (
              <Section title="Recommended charts">
                <motion.div className="space-y-2">
                  {summary.recommended_charts.map((chart, i) => (
                    <motion.div
                      key={`${chart.chart_type}-${chart.x_column}-${i}`}
                      className="rounded-lg border border-violet-500/20 bg-gradient-to-br from-indigo-500/10 to-violet-600/5 p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        {chartIcon(chart.chart_type)}
                        <span className="text-xs font-medium capitalize">
                          {chart.chart_type}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {chart.x_column} × {chart.y_column}
                      </p>
                      {chart.reason ? (
                        <p className="mt-1.5 text-xs leading-snug text-foreground/75">
                          {chart.reason}
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3 h-8 w-full bg-indigo-600/80 text-xs hover:bg-indigo-500"
                        onClick={() => handleCreateChart(chart)}
                      >
                        Create this chart
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              </Section>
            ) : null}

            {summary?.anomalies?.length ? (
              <Section title="Anomalies">
                <ul className="space-y-1.5 text-xs text-amber-100/80">
                  {summary.anomalies.map((a, i) => (
                    <li key={i} className="rounded-md bg-amber-500/5 px-2 py-1.5">
                      {a}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <Section title="Ask your data">
              <div
                className={cn(
                  "space-y-3 overflow-y-auto rounded-lg border border-indigo-500/10 bg-black/20 p-2",
                  chatMaxH
                )}
              >
                {qaHistory.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                    <MessageSquare className="mx-auto mb-2 h-5 w-5 opacity-50" />
                    Ask anything about this dataset…
                  </p>
                ) : (
                  qaHistory.map((pair) => (
                    <div key={pair.id} className="space-y-2">
                      <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-sm bg-indigo-600/25 px-3 py-2 text-xs">
                        {pair.question}
                      </div>
                      <motion.div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-sm border border-indigo-500/15 bg-indigo-500/5 px-3 py-2 text-xs leading-relaxed">
                        {pair.result.answer}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Confidence: {Math.round(pair.result.confidence * 100)}%
                        </p>
                      </motion.div>
                      {pair.result.sql_query && pair.result.sql_query !== "--" ? (
                        <details className="rounded-md border border-border/50 bg-black/30 text-[10px]">
                          <summary className="cursor-pointer px-2 py-1.5 text-muted-foreground">
                            View SQL
                          </summary>
                          <pre className="overflow-x-auto px-2 pb-2 font-mono text-indigo-200/90">
                            {pair.result.sql_query}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ))
                )}
                {askMutation.isPending ? (
                  <div className="flex items-center gap-1 px-2 text-xs text-muted-foreground">
                    <span className="inline-flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-indigo-400"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.9,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </span>
                    Thinking…
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              {qaHistory.length > 0 &&
              qaHistory[qaHistory.length - 1].result.follow_up_questions?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {qaHistory[qaHistory.length - 1].result.follow_up_questions.map(
                    (chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => void submitQuestion(chip)}
                        className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-[10px] text-indigo-200 hover:bg-indigo-500/20"
                      >
                        {chip}
                      </button>
                    )
                  )}
                </div>
              ) : summary?.business_questions?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {summary.business_questions.slice(0, 3).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void submitQuestion(chip)}
                      className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] text-violet-200/90 hover:bg-violet-500/20"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}

              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitQuestion(question);
                }}
              >
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask anything about this dataset…"
                  className="h-9 flex-1 border-indigo-500/20 bg-black/30 text-xs"
                  disabled={askMutation.isPending}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!question.trim() || askMutation.isPending}
                  className="shrink-0 bg-indigo-600 hover:bg-indigo-500"
                >
                  Ask
                </Button>
              </form>
            </Section>
          </>
        )}
      </div>
    </motion.div>
  );
}
