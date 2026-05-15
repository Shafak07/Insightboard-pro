"use client";

import {
  ArrowRight,
  BarChart3,
  LayoutDashboard,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: LayoutDashboard,
    title: "Drag-and-drop dashboards",
    description:
      "Build custom layouts with react-grid-layout. Resize, reorder, and persist widget configurations.",
  },
  {
    icon: BarChart3,
    title: "Rich visualizations",
    description:
      "Charts powered by Recharts — line, bar, area, and composed views with real-time data.",
  },
  {
    icon: Sparkles,
    title: "AI-powered insights",
    description:
      "OpenAI integration surfaces trends, anomalies, and natural-language summaries from your data.",
  },
  {
    icon: Zap,
    title: "Production-ready stack",
    description:
      "FastAPI async backend, PostgreSQL, Redis caching, and Celery background jobs out of the box.",
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0F172A]">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid-pattern opacity-40" />
      <div
        className="pointer-events-none absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-[#3B82F6]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-[400px] w-[400px] rounded-full bg-[#3B82F6]/5 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 border-b border-slate-800/60 bg-[#0F172A]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">
              InsightBoard
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              Features
            </Link>
            <Link
              href="#stack"
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              Stack
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="outline"
              className="hidden border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white sm:inline-flex"
              asChild
            >
              <Link href="/docs">Docs</Link>
            </Button>
            <Button className="bg-[#3B82F6] hover:bg-[#2563EB]" asChild>
              <Link href="/dashboard">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="secondary"
              className="mb-6 border border-[#3B82F6]/30 bg-[#3B82F6]/10 text-[#93C5FD]"
            >
              Now in early access
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
              Analytics dashboards,{" "}
              <span className="bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent">
                built for teams
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
              InsightBoard combines a modern Next.js frontend with a FastAPI
              backend — drag-and-drop layouts, real-time charts, and AI insights
              in one professional platform.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-[#3B82F6] px-8 text-base hover:bg-[#2563EB]"
                asChild
              >
                <Link href="/dashboard">
                  Launch dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-slate-700 bg-transparent px-8 text-base text-slate-300 hover:bg-slate-800 hover:text-white"
                asChild
              >
                <Link href="http://localhost:8000/docs" target="_blank">
                  API documentation
                </Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-20 max-w-4xl">
            <Card className="overflow-hidden border-slate-800 bg-slate-900/50 shadow-2xl shadow-[#3B82F6]/5">
              <CardHeader className="border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-4 text-xs text-slate-500">
                    dashboard.preview
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-3 gap-px bg-slate-800 p-px">
                  {[65, 42, 88, 54, 71, 39].map((value, i) => (
                    <div
                      key={i}
                      className="flex h-24 flex-col justify-end bg-slate-900/80 p-4"
                    >
                      <div
                        className="rounded-sm bg-[#3B82F6]/80 transition-all"
                        style={{ height: `${value}%`, maxHeight: "48px" }}
                      />
                      <span className="mt-2 text-xs text-slate-500">
                        Metric {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="features" className="border-t border-slate-800/60 bg-slate-950/50 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Everything you need to ship
              </h2>
              <p className="mt-4 text-slate-400">
                A complete monorepo with frontend, backend, and shared types.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-slate-800 bg-slate-900/30 transition-colors hover:border-[#3B82F6]/40 hover:bg-slate-900/50"
                >
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[#3B82F6]/15">
                      <feature.icon className="h-5 w-5 text-[#3B82F6]" />
                    </div>
                    <CardTitle className="text-white">{feature.title}</CardTitle>
                    <CardDescription className="text-slate-400">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="stack" className="py-24">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-3xl font-bold text-white">Monorepo stack</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {[
                "Next.js 14",
                "FastAPI",
                "PostgreSQL",
                "Redis",
                "Celery",
                "Zustand",
                "TanStack Query",
                "shadcn/ui",
              ].map((tech) => (
                <Badge
                  key={tech}
                  variant="outline"
                  className="border-slate-700 px-4 py-1.5 text-slate-300"
                >
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-800/60 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} InsightBoard. Built for production.
        </div>
      </footer>
    </div>
  );
}
