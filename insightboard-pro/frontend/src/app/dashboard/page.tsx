"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ResponsiveGridLayout = dynamic(
  () => import("react-grid-layout").then((mod) => mod.Responsive),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> }
);

const sampleLayout = [
  { i: "chart", x: 0, y: 0, w: 8, h: 4 },
  { i: "metrics", x: 8, y: 0, w: 4, h: 2 },
  { i: "table", x: 8, y: 2, w: 4, h: 2 },
];

export default function DashboardPage() {
  const layouts = useMemo(
    () => ({ lg: sampleLayout }),
    []
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Drag widgets to rearrange your layout
            </p>
          </div>
          <Badge variant="success">Live</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <ResponsiveGridLayout
              className="layout"
              layouts={layouts}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
              rowHeight={60}
              width={1200}
              draggableHandle=".drag-handle"
            >
              <Card key="chart" className="overflow-hidden">
                <CardHeader className="drag-handle cursor-move border-b border-border py-3">
                  <CardTitle className="text-sm">Revenue trend</CardTitle>
                </CardHeader>
                <CardContent className="flex h-full items-center justify-center p-6 text-muted-foreground">
                  Recharts integration ready
                </CardContent>
              </Card>
              <Card key="metrics">
                <CardHeader className="drag-handle cursor-move py-3">
                  <CardTitle className="text-sm">Key metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4">
                  {["Users", "Sessions", "Conversion"].map((label) => (
                    <div
                      key={label}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">—</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card key="table">
                <CardHeader className="drag-handle cursor-move py-3">
                  <CardTitle className="text-sm">Recent events</CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Connect your data source to populate this widget.
                </CardContent>
              </Card>
            </ResponsiveGridLayout>
          </TabsContent>
          <TabsContent value="analytics">
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Analytics views will appear here.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
