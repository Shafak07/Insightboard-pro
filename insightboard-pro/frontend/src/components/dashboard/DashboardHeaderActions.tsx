"use client";

import { LiveIndicator } from "@/components/live/LiveIndicator";
import { UserMenu } from "@/components/auth/UserMenu";

export function DashboardHeaderActions({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {children}
      <LiveIndicator />
      <UserMenu />
    </div>
  );
}
