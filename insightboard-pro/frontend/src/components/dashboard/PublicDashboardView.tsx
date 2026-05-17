"use client";

import Link from "next/link";

import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas";
import type { PublicDashboard } from "@/lib/dashboards";
import { cn } from "@/lib/utils";

export interface PublicDashboardViewProps {
  dashboard: PublicDashboard;
  embed?: boolean;
}

export function PublicDashboardView({ dashboard, embed }: PublicDashboardViewProps) {
  const themeClass =
    dashboard.theme === "light" ? "light" : dashboard.theme === "dark" ? "dark" : "";

  return (
    <div
      className={cn(
        "relative min-h-screen bg-background",
        themeClass,
        embed && "min-h-0"
      )}
    >
      {!embed ? (
        <header className="border-b border-border px-6 py-6">
          <div className="mx-auto max-w-7xl">
            <h1 className="text-2xl font-bold tracking-tight">{dashboard.title}</h1>
            {dashboard.description ? (
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {dashboard.description}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {dashboard.view_count.toLocaleString()} views
            </p>
          </div>
        </header>
      ) : null}

      <main className={cn("mx-auto max-w-7xl p-4", embed && "p-2")}>
        <DashboardCanvas
          widgets={dashboard.widgets}
          layout={dashboard.layout}
          readOnly
          previewMode
        />
      </main>

      {!embed ? (
        <>
          <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-6 pb-4">
            <ShareButton
              network="twitter"
              url={typeof window !== "undefined" ? window.location.href : ""}
              title={dashboard.title}
            />
            <ShareButton
              network="linkedin"
              url={typeof window !== "undefined" ? window.location.href : ""}
              title={dashboard.title}
            />
          </div>
          <a
            href="https://insightboard.pro"
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-4 right-4 rounded-full border border-indigo-500/30 bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow-lg backdrop-blur hover:text-foreground"
          >
            Built with <span className="font-medium text-indigo-300">InsightBoard Pro</span>
          </a>
        </>
      ) : null}
    </div>
  );
}

function ShareButton({
  network,
  url,
  title,
}: {
  network: "twitter" | "linkedin";
  url: string;
  title: string;
}) {
  const href =
    network === "twitter"
      ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
      : `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md border border-border px-3 py-1.5 text-xs capitalize hover:bg-muted"
    >
      Share on {network}
    </Link>
  );
}
