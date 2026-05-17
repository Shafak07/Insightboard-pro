import { DashboardHome } from "@/app/dashboard/dashboard-home";
import { fetchDashboardsPage } from "@/lib/dashboards-server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const initialDashboards = await fetchDashboardsPage(1, 12);
  return <DashboardHome initialDashboards={initialDashboards} />;
}
