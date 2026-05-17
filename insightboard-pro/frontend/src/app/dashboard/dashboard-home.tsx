"use client";

import { Database, Radio } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DashboardHeaderActions } from "@/components/dashboard/DashboardHeaderActions";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardList } from "@/components/dashboard/DashboardList";
import { APIConnector } from "@/components/live/APIConnector";
import { LiveBTCDemoChart } from "@/components/live/LiveBTCDemoChart";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardListPage } from "@/lib/dashboards";

export function DashboardHome({
  initialDashboards,
}: {
  initialDashboards: DashboardListPage | null;
}) {
  const [connectorOpen, setConnectorOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Build custom layouts and share them publicly
            </p>
          </div>
          <DashboardHeaderActions>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/datasets" prefetch>
                <Database className="mr-2 h-4 w-4" />
                Datasets
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConnectorOpen(true)}
            >
              <Radio className="mr-2 h-4 w-4" />
              Live API
            </Button>
          </DashboardHeaderActions>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        <Tabs defaultValue="dashboards">
          <TabsList>
            <TabsTrigger value="dashboards">My dashboards</TabsTrigger>
            <TabsTrigger value="charts">Quick charts</TabsTrigger>
            <TabsTrigger value="live">Live data</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboards" className="mt-6">
            <DashboardList initialData={initialDashboards} />
          </TabsContent>
          <TabsContent value="charts" className="mt-6">
            <DashboardCharts />
          </TabsContent>
          <TabsContent value="live" className="mt-6">
            <LiveBTCDemoChart />
          </TabsContent>
        </Tabs>

        <APIConnector open={connectorOpen} onOpenChange={setConnectorOpen} />
      </main>
    </div>
  );
}

