import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { AppShortcutsProvider } from "@/providers/app-shortcuts-provider";
import { WebSocketProvider } from "@/providers/websocket-provider";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebSocketProvider>
      <AppShortcutsProvider>{children}</AppShortcutsProvider>
    </WebSocketProvider>
  );
}
