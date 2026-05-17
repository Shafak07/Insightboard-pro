import { createClient } from "@/lib/supabase/server";
import type { DashboardSummary } from "@/lib/dashboards";

export interface DashboardListPage {
  items: DashboardSummary[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchDashboardsPage(
  page = 1,
  limit = 12
): Promise<DashboardListPage | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
    /\/$/,
    ""
  );
  const res = await fetch(
    `${base}/api/v1/dashboards/?page=${page}&limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      next: { revalidate: 30 },
    }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data?: DashboardListPage };
  return json.data ?? null;
}
