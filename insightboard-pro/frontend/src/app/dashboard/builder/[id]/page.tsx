"use client";

import { DashboardBuilder } from "@/components/dashboard/DashboardBuilder";

export default function DashboardBuilderPage({
  params,
}: {
  params: { id: string };
}) {
  return <DashboardBuilder dashboardId={params.id} />;
}
