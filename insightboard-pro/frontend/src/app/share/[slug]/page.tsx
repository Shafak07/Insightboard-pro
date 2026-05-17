import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicDashboardView } from "@/components/dashboard/PublicDashboardView";
import { fetchPublicDashboard } from "@/lib/dashboards";

type PageProps = {
  params: { slug: string };
  searchParams: { embed?: string };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const dash = await fetchPublicDashboard(params.slug);
    return {
      title: `${dash.title} | InsightBoard Pro`,
      description: dash.description ?? `Public analytics dashboard: ${dash.title}`,
      openGraph: {
        title: dash.title,
        description: dash.description ?? undefined,
        type: "website",
      },
    };
  } catch {
    return { title: "Dashboard | InsightBoard Pro" };
  }
}

export default async function PublicSharePage({ params, searchParams }: PageProps) {
  let dashboard;
  try {
    dashboard = await fetchPublicDashboard(params.slug);
  } catch {
    notFound();
  }

  const embed = searchParams.embed === "1";

  return <PublicDashboardView dashboard={dashboard} embed={embed} />;
}
